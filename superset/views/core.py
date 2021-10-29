# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
# pylint: disable=too-many-lines, invalid-name
from __future__ import annotations

import logging
import re
from contextlib import closing
from datetime import datetime, timedelta
from typing import Any, Callable, cast, Dict, List, Optional, Union
from urllib import parse

import backoff
import humanize
import pandas as pd
import simplejson as json
from flask import abort, flash, g, Markup, redirect, render_template, request, Response
from flask_appbuilder import expose
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import (
    has_access,
    has_access_api,
    permission_name,
)
from flask_appbuilder.security.sqla import models as ab_models
from flask_babel import gettext as __, lazy_gettext as _
from sqlalchemy import and_, or_
from sqlalchemy.engine.url import make_url
from sqlalchemy.exc import ArgumentError, DBAPIError, NoSuchModuleError, SQLAlchemyError
from sqlalchemy.orm.session import Session
from sqlalchemy.sql import functions as func
from werkzeug.urls import Href

from superset import (
    app,
    appbuilder,
    conf,
    db,
    event_logger,
    get_feature_flags,
    is_feature_enabled,
    results_backend,
    results_backend_use_msgpack,
    security_manager,
    sql_lab,
    viz,
)
from superset.charts.dao import ChartDAO
from superset.common.db_query_status import QueryStatus
from superset.connectors.base.models import BaseDatasource
from superset.connectors.connector_registry import ConnectorRegistry
from superset.connectors.sqla.models import (
    AnnotationDatasource,
    SqlaTable,
    SqlMetric,
    TableColumn,
)
from superset.dashboards.commands.importers.v0 import ImportDashboardsCommand
from superset.dashboards.dao import DashboardDAO
from superset.databases.dao import DatabaseDAO
from superset.databases.filters import DatabaseFilter
from superset.datasets.commands.exceptions import DatasetNotFoundError
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    CacheLoadError,
    CertificateException,
    DatabaseNotFound,
    SerializationError,
    SupersetCancelQueryException,
    SupersetErrorException,
    SupersetException,
    SupersetGenericErrorException,
    SupersetSecurityException,
    SupersetTimeoutException,
)
from superset.extensions import async_query_manager, cache_manager
from superset.jinja_context import get_template_processor
from superset.models.core import Database, FavStar, Log
from superset.models.dashboard import Dashboard
from superset.models.datasource_access_request import DatasourceAccessRequest
from superset.models.slice import Slice
from superset.models.sql_lab import Query, TabState
from superset.models.user_attributes import UserAttribute
from superset.queries.dao import QueryDAO
from superset.security.analytics_db_safety import check_sqlalchemy_uri
from superset.sql_lab import get_sql_results
from superset.sql_parse import ParsedQuery, Table
from superset.sql_validators import get_validator_by_name
from superset.sqllab.command import CommandResult, ExecuteSqlCommand
from superset.sqllab.command_status import SqlJsonExecutionStatus
from superset.sqllab.exceptions import (
    QueryIsForbiddenToAccessException,
    SqlLabException,
)
from superset.sqllab.execution_context_convertor import ExecutionContextConvertorImpl
from superset.sqllab.limiting_factor import LimitingFactor
from superset.sqllab.query_render import SqlQueryRenderImpl
from superset.sqllab.sql_json_executer import (
    ASynchronousSqlJsonExecutor,
    SqlJsonExecutor,
    SynchronousSqlJsonExecutor,
)
from superset.sqllab.sqllab_execution_context import SqlJsonExecutionContext
from superset.sqllab.utils import apply_display_max_row_configuration_if_require
from superset.sqllab.validators import CanAccessQueryValidatorImpl
from superset.tasks.async_queries import load_explore_json_into_cache
from superset.typing import FlaskResponse
from superset.utils import core as utils, csv
from superset.utils.async_query_manager import AsyncQueryTokenException
from superset.utils.cache import etag_cache
from superset.utils.core import apply_max_row_limit, ReservedUrlParameters
from superset.utils.dates import now_as_float
from superset.utils.decorators import check_dashboard_access
from superset.views.base import (
    api,
    BaseSupersetView,
    check_ownership,
    common_bootstrap_payload,
    create_table_permissions,
    CsvResponse,
    data_payload_response,
    generate_download_headers,
    get_error_msg,
    get_user_roles,
    handle_api_exception,
    json_error_response,
    json_errors_response,
    json_success,
    validate_sqlatable,
)
from superset.views.utils import (
    _deserialize_results_payload,
    bootstrap_user_data,
    check_datasource_perms,
    check_explore_cache_perms,
    check_resource_permissions,
    check_slice_perms,
    get_dashboard_extra_filters,
    get_datasource_info,
    get_form_data,
    get_viz,
    is_owner,
)
from superset.viz import BaseViz

config = app.config
SQLLAB_QUERY_COST_ESTIMATE_TIMEOUT = config["SQLLAB_QUERY_COST_ESTIMATE_TIMEOUT"]
stats_logger = config["STATS_LOGGER"]
DAR = DatasourceAccessRequest
logger = logging.getLogger(__name__)

DATABASE_KEYS = [
    "allow_file_upload",
    "allow_ctas",
    "allow_cvas",
    "allow_dml",
    "allow_multi_schema_metadata_fetch",
    "allow_run_async",
    "allows_subquery",
    "backend",
    "database_name",
    "expose_in_sqllab",
    "force_ctas_schema",
    "id",
]

DATASOURCE_MISSING_ERR = __("The data source seems to have been deleted")
USER_MISSING_ERR = __("The user seems to have been deleted")
PARAMETER_MISSING_ERR = (
    "Please check your template parameters for syntax errors and make sure "
    "they match across your SQL query and Set Parameters. Then, try running "
    "your query again."
)

SqlResults = Dict[str, Any]


class Superset(BaseSupersetView):  # pylint: disable=too-many-public-methods
    """The base views for Superset!"""

    logger = logging.getLogger(__name__)

    @has_access_api
    @event_logger.log_this
    @expose("/datasources/")
    def datasources(self) -> FlaskResponse:
        return self.json_response(
            sorted(
                [
                    datasource.short_data
                    for datasource in security_manager.get_user_datasources()
                    if datasource.short_data.get("name")
                ],
                key=lambda datasource: datasource["name"],
            )
        )

    @has_access_api
    @event_logger.log_this
    @expose("/override_role_permissions/", methods=["POST"])
    def override_role_permissions(self) -> FlaskResponse:
        """Updates the role with the give datasource permissions.

          Permissions not in the request will be revoked. This endpoint should
          be available to admins only. Expects JSON in the format:
           {
            'role_name': '{role_name}',
            'database': [{
                'datasource_type': '{table|druid}',
                'name': '{database_name}',
                'schema': [{
                    'name': '{schema_name}',
                    'datasources': ['{datasource name}, {datasource name}']
                }]
            }]
        }
        """
        data = request.get_json(force=True)
        role_name = data["role_name"]
        databases = data["database"]

        db_ds_names = set()
        for dbs in databases:
            for schema in dbs["schema"]:
                for ds_name in schema["datasources"]:
                    fullname = utils.get_datasource_full_name(
                        dbs["name"], ds_name, schema=schema["name"]
                    )
                    db_ds_names.add(fullname)

        existing_datasources = ConnectorRegistry.get_all_datasources(db.session)
        datasources = [d for d in existing_datasources if d.full_name in db_ds_names]
        role = security_manager.find_role(role_name)
        # remove all permissions
        role.permissions = []
        # grant permissions to the list of datasources
        granted_perms = []
        for datasource in datasources:
            view_menu_perm = security_manager.find_permission_view_menu(
                view_menu_name=datasource.perm, permission_name="datasource_access"
            )
            # prevent creating empty permissions
            if view_menu_perm and view_menu_perm.view_menu:
                role.permissions.append(view_menu_perm)
                granted_perms.append(view_menu_perm.view_menu.name)
        db.session.commit()
        return self.json_response(
            {"granted": granted_perms, "requested": list(db_ds_names)}, status=201
        )

    @has_access
    @event_logger.log_this
    @expose("/request_access/")
    def request_access(self) -> FlaskResponse:
        datasources = set()
        dashboard_id = request.args.get("dashboard_id")
        if dashboard_id:
            dash = db.session.query(Dashboard).filter_by(id=int(dashboard_id)).one()
            datasources |= dash.datasources
        datasource_id = request.args.get("datasource_id")
        datasource_type = request.args.get("datasource_type")
        if datasource_id and datasource_type:
            ds_class = ConnectorRegistry.sources.get(datasource_type)
            datasource = (
                db.session.query(ds_class).filter_by(id=int(datasource_id)).one()
            )
            datasources.add(datasource)

        has_access_ = all(
            (
                datasource and security_manager.can_access_datasource(datasource)
                for datasource in datasources
            )
        )
        if has_access_:
            return redirect("/superset/dashboard/{}".format(dashboard_id))

        if request.args.get("action") == "go":
            for datasource in datasources:
                access_request = DAR(
                    datasource_id=datasource.id, datasource_type=datasource.type
                )
                db.session.add(access_request)
                db.session.commit()
            flash(__("Access was requested"), "info")
            return redirect("/")

        return self.render_template(
            "superset/request_access.html",
            datasources=datasources,
            datasource_names=", ".join([o.name for o in datasources]),
        )

    @has_access
    @event_logger.log_this
    @expose("/approve")
    def approve(self) -> FlaskResponse:  # pylint: disable=too-many-locals,no-self-use
        def clean_fulfilled_requests(session: Session) -> None:
            for dar in session.query(DAR).all():
                datasource = ConnectorRegistry.get_datasource(
                    dar.datasource_type, dar.datasource_id, session,
                )
                if not datasource or security_manager.can_access_datasource(datasource):
                    # Dataset does not exist anymore
                    session.delete(dar)
            session.commit()

        datasource_type = request.args["datasource_type"]
        datasource_id = request.args["datasource_id"]
        created_by_username = request.args.get("created_by")
        role_to_grant = request.args.get("role_to_grant")
        role_to_extend = request.args.get("role_to_extend")

        session = db.session
        datasource = ConnectorRegistry.get_datasource(
            datasource_type, datasource_id, session
        )

        if not datasource:
            flash(DATASOURCE_MISSING_ERR, "alert")
            return json_error_response(DATASOURCE_MISSING_ERR)

        requested_by = security_manager.find_user(username=created_by_username)
        if not requested_by:
            flash(USER_MISSING_ERR, "alert")
            return json_error_response(USER_MISSING_ERR)

        requests = (
            session.query(DAR)
            .filter(  # pylint: disable=comparison-with-callable
                DAR.datasource_id == datasource_id,
                DAR.datasource_type == datasource_type,
                DAR.created_by_fk == requested_by.id,
            )
            .all()
        )

        if not requests:
            err = __("The access requests seem to have been deleted")
            flash(err, "alert")
            return json_error_response(err)

        # check if you can approve
        if security_manager.can_access_all_datasources() or check_ownership(
            datasource, raise_if_false=False
        ):
            # can by done by admin only
            if role_to_grant:
                role = security_manager.find_role(role_to_grant)
                requested_by.roles.append(role)
                msg = __(
                    "%(user)s was granted the role %(role)s that gives access "
                    "to the %(datasource)s",
                    user=requested_by.username,
                    role=role_to_grant,
                    datasource=datasource.full_name,
                )
                utils.notify_user_about_perm_udate(
                    g.user,
                    requested_by,
                    role,
                    datasource,
                    "email/role_granted.txt",
                    app.config,
                )
                flash(msg, "info")

            if role_to_extend:
                perm_view = security_manager.find_permission_view_menu(
                    "email/datasource_access", datasource.perm
                )
                role = security_manager.find_role(role_to_extend)
                security_manager.add_permission_role(role, perm_view)
                msg = __(
                    "Role %(r)s was extended to provide the access to "
                    "the datasource %(ds)s",
                    r=role_to_extend,
                    ds=datasource.full_name,
                )
                utils.notify_user_about_perm_udate(
                    g.user,
                    requested_by,
                    role,
                    datasource,
                    "email/role_extended.txt",
                    app.config,
                )
                flash(msg, "info")
            clean_fulfilled_requests(session)
        else:
            flash(__("You have no permission to approve this request"), "danger")
            return redirect("/accessrequestsmodelview/list/")
        for request_ in requests:
            session.delete(request_)
        session.commit()
        return redirect("/accessrequestsmodelview/list/")

    @has_access
    @event_logger.log_this
    @expose("/slice/<int:slice_id>/")
    def slice(self, slice_id: int) -> FlaskResponse:  # pylint: disable=no-self-use
        _, slc = get_form_data(slice_id, use_slice_data=True)
        if not slc:
            abort(404)
        endpoint = "/superset/explore/?form_data={}".format(
            parse.quote(json.dumps({"slice_id": slice_id}))
        )

        is_standalone_mode = ReservedUrlParameters.is_standalone_mode()
        if is_standalone_mode:
            endpoint += f"&{ReservedUrlParameters.STANDALONE}={is_standalone_mode}"
        return redirect(endpoint)

    def get_query_string_response(self, viz_obj: BaseViz) -> FlaskResponse:
        query = None
        try:
            query_obj = viz_obj.query_obj()
            if query_obj:
                query = viz_obj.datasource.get_query_str(query_obj)
        except Exception as ex:  # pylint: disable=broad-except
            err_msg = utils.error_msg_from_exception(ex)
            logger.exception(err_msg)
            return json_error_response(err_msg)

        if not query:
            query = "No query."

        return self.json_response(
            {"query": query, "language": viz_obj.datasource.query_language}
        )

    def get_raw_results(self, viz_obj: BaseViz) -> FlaskResponse:
        payload = viz_obj.get_df_payload()
        if viz_obj.has_error(payload):
            return json_error_response(payload=payload, status=400)
        return self.json_response({"data": payload["df"].to_dict("records")})

    def get_samples(self, viz_obj: BaseViz) -> FlaskResponse:
        return self.json_response({"data": viz_obj.get_samples()})

    @staticmethod
    def send_data_payload_response(viz_obj: BaseViz, payload: Any) -> FlaskResponse:
        return data_payload_response(*viz_obj.payload_json_and_has_error(payload))

    def generate_json(
        self, viz_obj: BaseViz, response_type: Optional[str] = None
    ) -> FlaskResponse:
        if response_type == utils.ChartDataResultFormat.CSV:
            return CsvResponse(
                viz_obj.get_csv(), headers=generate_download_headers("csv")
            )

        if response_type == utils.ChartDataResultType.QUERY:
            return self.get_query_string_response(viz_obj)

        if response_type == utils.ChartDataResultType.RESULTS:
            return self.get_raw_results(viz_obj)

        if response_type == utils.ChartDataResultType.SAMPLES:
            return self.get_samples(viz_obj)

        payload = viz_obj.get_payload()
        return self.send_data_payload_response(viz_obj, payload)

    @event_logger.log_this
    @api
    @has_access_api
    @expose("/slice_json/<int:slice_id>")
    @etag_cache()
    @check_resource_permissions(check_slice_perms)
    def slice_json(self, slice_id: int) -> FlaskResponse:
        form_data, slc = get_form_data(slice_id, use_slice_data=True)
        if not slc:
            return json_error_response("The slice does not exist")

        if not slc.datasource:
            return json_error_response("The slice's datasource does not exist")

        try:
            viz_obj = get_viz(
                datasource_type=slc.datasource.type,
                datasource_id=slc.datasource.id,
                form_data=form_data,
                force=False,
            )
            return self.generate_json(viz_obj)
        except SupersetException as ex:
            return json_error_response(utils.error_msg_from_exception(ex))

    @api
    @has_access_api
    @event_logger.log_this
    @expose("/annotation_json/<int:layer_id>")
    def annotation_json(  # pylint: disable=no-self-use
        self, layer_id: int
    ) -> FlaskResponse:
        form_data = get_form_data()[0]
        force = utils.parse_boolean_string(request.args.get("force"))

        form_data["layer_id"] = layer_id
        form_data["filters"] = [{"col": "layer_id", "op": "==", "val": layer_id}]
        # Set all_columns to ensure the TableViz returns the necessary columns to the
        # frontend.
        form_data["all_columns"] = [
            "created_on",
            "changed_on",
            "id",
            "start_dttm",
            "end_dttm",
            "layer_id",
            "short_descr",
            "long_descr",
            "json_metadata",
            "created_by_fk",
            "changed_by_fk",
        ]
        datasource = AnnotationDatasource()
        viz_obj = viz.viz_types["table"](datasource, form_data=form_data, force=force)
        payload = viz_obj.get_payload()
        return data_payload_response(*viz_obj.payload_json_and_has_error(payload))

    @event_logger.log_this
    @api
    @has_access_api
    @handle_api_exception
    @permission_name("explore_json")
    @expose("/explore_json/data/<cache_key>", methods=["GET"])
    @check_resource_permissions(check_explore_cache_perms)
    def explore_json_data(self, cache_key: str) -> FlaskResponse:
        """Serves cached result data for async explore_json calls

        `self.generate_json` receives this input and returns different
        payloads based on the request args in the first block

        TODO: form_data should not be loaded twice from cache
          (also loaded in `check_explore_cache_perms`)
        """
        try:
            cached = cache_manager.cache.get(cache_key)
            if not cached:
                raise CacheLoadError("Cached data not found")

            form_data = cached.get("form_data")
            response_type = cached.get("response_type")

            datasource_id, datasource_type = get_datasource_info(None, None, form_data)

            viz_obj = get_viz(
                datasource_type=cast(str, datasource_type),
                datasource_id=datasource_id,
                form_data=form_data,
                force_cached=True,
            )

            return self.generate_json(viz_obj, response_type)
        except SupersetException as ex:
            return json_error_response(utils.error_msg_from_exception(ex), 400)

    EXPLORE_JSON_METHODS = ["POST"]
    if not is_feature_enabled("ENABLE_EXPLORE_JSON_CSRF_PROTECTION"):
        EXPLORE_JSON_METHODS.append("GET")

    @api
    @has_access_api
    @handle_api_exception
    @event_logger.log_this
    @expose(
        "/explore_json/<datasource_type>/<int:datasource_id>/",
        methods=EXPLORE_JSON_METHODS,
    )
    @expose("/explore_json/", methods=EXPLORE_JSON_METHODS)
    @etag_cache()
    @check_resource_permissions(check_datasource_perms)
    def explore_json(
        self, datasource_type: Optional[str] = None, datasource_id: Optional[int] = None
    ) -> FlaskResponse:
        """Serves all request that GET or POST form_data

        This endpoint evolved to be the entry point of many different
        requests that GETs or POSTs a form_data.

        `self.generate_json` receives this input and returns different
        payloads based on the request args in the first block

        TODO: break into one endpoint for each return shape"""

        response_type = utils.ChartDataResultFormat.JSON.value
        responses: List[
            Union[utils.ChartDataResultFormat, utils.ChartDataResultType]
        ] = list(utils.ChartDataResultFormat)
        responses.extend(list(utils.ChartDataResultType))
        for response_option in responses:
            if request.args.get(response_option) == "true":
                response_type = response_option
                break

        # Verify user has permission to export CSV file
        if (
            response_type == utils.ChartDataResultFormat.CSV
            and not security_manager.can_access("can_csv", "Superset")
        ):
            return json_error_response(
                _("You don't have the rights to ") + _("download as csv"), status=403,
            )

        form_data = get_form_data()[0]
        try:
            datasource_id, datasource_type = get_datasource_info(
                datasource_id, datasource_type, form_data
            )

            force = request.args.get("force") == "true"

            # TODO: support CSV, SQL query and other non-JSON types
            if (
                is_feature_enabled("GLOBAL_ASYNC_QUERIES")
                and response_type == utils.ChartDataResultFormat.JSON
            ):
                # First, look for the chart query results in the cache.
                try:
                    viz_obj = get_viz(
                        datasource_type=cast(str, datasource_type),
                        datasource_id=datasource_id,
                        form_data=form_data,
                        force_cached=True,
                        force=force,
                    )
                    payload = viz_obj.get_payload()
                except CacheLoadError:
                    payload = None  # type: ignore

                already_cached_result = payload is not None

                # If the chart query has already been cached, return it immediately.
                if already_cached_result:
                    return self.send_data_payload_response(viz_obj, payload)

                # Otherwise, kick off a background job to run the chart query.
                # Clients will either poll or be notified of query completion,
                # at which point they will call the /explore_json/data/<cache_key>
                # endpoint to retrieve the results.
                try:
                    async_channel_id = async_query_manager.parse_jwt_from_request(
                        request
                    )["channel"]
                    job_metadata = async_query_manager.init_job(
                        async_channel_id, g.user.get_id()
                    )
                    load_explore_json_into_cache.delay(
                        job_metadata, form_data, response_type, force
                    )
                except AsyncQueryTokenException:
                    return json_error_response("Not authorized", 401)

                return json_success(json.dumps(job_metadata), status=202)

            viz_obj = get_viz(
                datasource_type=cast(str, datasource_type),
                datasource_id=datasource_id,
                form_data=form_data,
                force=force,
            )

            return self.generate_json(viz_obj, response_type)
        except SupersetException as ex:
            return json_error_response(utils.error_msg_from_exception(ex), 400)

    @has_access
    @event_logger.log_this
    @expose("/import_dashboards/", methods=["GET", "POST"])
    def import_dashboards(self) -> FlaskResponse:
        """Overrides the dashboards using json instances from the file."""
        import_file = request.files.get("file")
        if request.method == "POST" and import_file:
            success = False
            database_id = request.form.get("db_id")
            try:
                ImportDashboardsCommand(
                    {import_file.filename: import_file.read()}, database_id
                ).run()
                success = True
            except DatabaseNotFound as ex:
                logger.exception(ex)
                flash(
                    _(
                        "Cannot import dashboard: %(db_error)s.\n"
                        "Make sure to create the database before "
                        "importing the dashboard.",
                        db_error=ex,
                    ),
                    "danger",
                )
            except Exception as ex:  # pylint: disable=broad-except
                logger.exception(ex)
                flash(
                    _(
                        "An unknown error occurred. "
                        "Please contact your Superset administrator"
                    ),
                    "danger",
                )
            if success:
                flash("Dashboard(s) have been imported", "success")
                return redirect("/dashboard/list/")

        databases = db.session.query(Database).all()
        return self.render_template(
            "superset/import_dashboards.html", databases=databases
        )

    @has_access
    @event_logger.log_this
    @expose("/explore/<datasource_type>/<int:datasource_id>/", methods=["GET", "POST"])
    @expose("/explore/", methods=["GET", "POST"])
    # pylint: disable=too-many-locals,too-many-branches,too-many-statements
    def explore(
        self, datasource_type: Optional[str] = None, datasource_id: Optional[int] = None
    ) -> FlaskResponse:
        form_data, slc = get_form_data(use_slice_data=True)
        query_context = request.form.get("query_context")
        # Flash the SIP-15 message if the slice is owned by the current user and has not
        # been updated, i.e., is not using the [start, end) interval.
        if (
            config["SIP_15_ENABLED"]
            and slc
            and g.user in slc.owners
            and (
                not form_data.get("time_range_endpoints")
                or form_data["time_range_endpoints"]
                != (
                    utils.TimeRangeEndpoint.INCLUSIVE,
                    utils.TimeRangeEndpoint.EXCLUSIVE,
                )
            )
        ):
            url = Href("/superset/explore/")(
                {
                    "form_data": json.dumps(
                        {
                            "slice_id": slc.id,
                            "time_range_endpoints": (
                                utils.TimeRangeEndpoint.INCLUSIVE.value,
                                utils.TimeRangeEndpoint.EXCLUSIVE.value,
                            ),
                        }
                    )
                }
            )
            flash(Markup(config["SIP_15_TOAST_MESSAGE"].format(url=url)))

        try:
            datasource_id, datasource_type = get_datasource_info(
                datasource_id, datasource_type, form_data
            )
        except SupersetException:
            datasource_id = None
            # fallback unkonw datasource to table type
            datasource_type = SqlaTable.type

        datasource: Optional[BaseDatasource] = None
        if datasource_id is not None:
            try:
                datasource = ConnectorRegistry.get_datasource(
                    cast(str, datasource_type), datasource_id, db.session
                )
            except DatasetNotFoundError:
                pass
        datasource_name = datasource.name if datasource else _("[Missing Dataset]")

        if datasource:
            if config["ENABLE_ACCESS_REQUEST"] and (
                not security_manager.can_access_datasource(datasource)
            ):
                flash(
                    __(security_manager.get_datasource_access_error_msg(datasource)),
                    "danger",
                )
                return redirect(
                    "superset/request_access/?"
                    f"datasource_type={datasource_type}&"
                    f"datasource_id={datasource_id}&"
                )

        viz_type = form_data.get("viz_type")
        if not viz_type and datasource and datasource.default_endpoint:
            return redirect(datasource.default_endpoint)

        # slc perms
        slice_add_perm = security_manager.can_access("can_write", "Chart")
        slice_overwrite_perm = is_owner(slc, g.user) if slc else False
        slice_download_perm = security_manager.can_access("can_csv", "Superset")

        form_data["datasource"] = str(datasource_id) + "__" + cast(str, datasource_type)

        # On explore, merge legacy and extra filters into the form data
        utils.convert_legacy_filters_into_adhoc(form_data)
        utils.merge_extra_filters(form_data)

        # merge request url params
        if request.method == "GET":
            utils.merge_request_params(form_data, request.args)

        # handle save or overwrite
        action = request.args.get("action")

        if action == "overwrite" and not slice_overwrite_perm:
            return json_error_response(
                _("You don't have the rights to ") + _("alter this ") + _("chart"),
                status=403,
            )

        if action == "saveas" and not slice_add_perm:
            return json_error_response(
                _("You don't have the rights to ") + _("create a ") + _("chart"),
                status=403,
            )

        if action in ("saveas", "overwrite") and datasource:
            return self.save_or_overwrite_slice(
                slc,
                slice_add_perm,
                slice_overwrite_perm,
                slice_download_perm,
                datasource.id,
                datasource.type,
                datasource.name,
                query_context,
            )
        standalone_mode = ReservedUrlParameters.is_standalone_mode()
        dummy_datasource_data: Dict[str, Any] = {
            "type": datasource_type,
            "name": datasource_name,
            "columns": [],
            "metrics": [],
            "database": {"id": 0, "backend": ""},
        }
        try:
            datasource_data = datasource.data if datasource else dummy_datasource_data
            datasource_database = datasource_data.get("database")
            if datasource_database:
                datasource_database["parameters"] = {}
        except (SupersetException, SQLAlchemyError):
            datasource_data = dummy_datasource_data

        if datasource:
            datasource_data["owners"] = datasource.owners_data

        bootstrap_data = {
            "can_add": slice_add_perm,
            "can_download": slice_download_perm,
            "datasource": datasource_data,
            "form_data": form_data,
            "datasource_id": datasource_id,
            "datasource_type": datasource_type,
            "slice": slc.data if slc else None,
            "standalone": standalone_mode,
            "user": bootstrap_user_data(g.user, include_perms=True),
            "forced_height": request.args.get("height"),
            "common": common_bootstrap_payload(),
        }
        if slc:
            title = slc.slice_name
        elif datasource:
            table_name = (
                datasource.table_name
                if datasource_type == "table"
                else datasource.datasource_name
            )
            title = _("Explore - %(table)s", table=table_name)
        else:
            title = _("Explore")

        return self.render_template(
            "superset/basic.html",
            bootstrap_data=json.dumps(
                bootstrap_data, default=utils.pessimistic_json_iso_dttm_ser
            ),
            entry="explore",
            title=title.__str__(),
            standalone_mode=standalone_mode,
        )

    @api
    @handle_api_exception
    @has_access_api
    @event_logger.log_this
    @expose("/filter/<datasource_type>/<int:datasource_id>/<column>/")
    def filter(  # pylint: disable=no-self-use
        self, datasource_type: str, datasource_id: int, column: str
    ) -> FlaskResponse:
        """
        Endpoint to retrieve values for specified column.

        :param datasource_type: Type of datasource e.g. table
        :param datasource_id: Datasource id
        :param column: Column name to retrieve values for
        :returns: The Flask response
        :raises SupersetSecurityException: If the user cannot access the resource
        """
        # TODO: Cache endpoint by user, datasource and column
        datasource = ConnectorRegistry.get_datasource(
            datasource_type, datasource_id, db.session,
        )
        if not datasource:
            return json_error_response(DATASOURCE_MISSING_ERR)

        datasource.raise_for_access()
        row_limit = apply_max_row_limit(config["FILTER_SELECT_ROW_LIMIT"])
        payload = json.dumps(
            datasource.values_for_column(
                column_name=column, limit=row_limit, contain_null=False,
            ),
            default=utils.json_int_dttm_ser,
            ignore_nan=True,
        )
        return json_success(payload)

    @staticmethod
    def remove_extra_filters(filters: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extra filters are ones inherited from the dashboard's temporary context
        Those should not be saved when saving the chart"""
        return [f for f in filters if not f.get("isExtra")]

    def save_or_overwrite_slice(
        # pylint: disable=too-many-arguments,too-many-locals
        self,
        slc: Optional[Slice],
        slice_add_perm: bool,
        slice_overwrite_perm: bool,
        slice_download_perm: bool,
        datasource_id: int,
        datasource_type: str,
        datasource_name: str,
        query_context: Optional[str] = None,
    ) -> FlaskResponse:
        """Save or overwrite a slice"""
        slice_name = request.args.get("slice_name")
        action = request.args.get("action")
        form_data = get_form_data()[0]

        if action == "saveas":
            if "slice_id" in form_data:
                form_data.pop("slice_id")  # don't save old slice_id
            slc = Slice(owners=[g.user] if g.user else [])

        form_data["adhoc_filters"] = self.remove_extra_filters(
            form_data.get("adhoc_filters", [])
        )

        assert slc
        slc.params = json.dumps(form_data, indent=2, sort_keys=True)
        slc.datasource_name = datasource_name
        slc.viz_type = form_data["viz_type"]
        slc.datasource_type = datasource_type
        slc.datasource_id = datasource_id
        slc.last_saved_by = g.user
        slc.last_saved_at = datetime.now()
        slc.slice_name = slice_name
        slc.query_context = query_context

        if action == "saveas" and slice_add_perm:
            ChartDAO.save(slc)
            msg = _("Chart [{}] has been saved").format(slc.slice_name)
            flash(msg, "info")
        elif action == "overwrite" and slice_overwrite_perm:
            ChartDAO.overwrite(slc)
            msg = _("Chart [{}] has been overwritten").format(slc.slice_name)
            flash(msg, "info")

        # Adding slice to a dashboard if requested
        dash: Optional[Dashboard] = None

        save_to_dashboard_id = request.args.get("save_to_dashboard_id")
        new_dashboard_name = request.args.get("new_dashboard_name")
        if save_to_dashboard_id:
            # Adding the chart to an existing dashboard
            dash = cast(
                Dashboard,
                db.session.query(Dashboard)
                .filter_by(id=int(save_to_dashboard_id))
                .one(),
            )
            # check edit dashboard permissions
            dash_overwrite_perm = check_ownership(dash, raise_if_false=False)
            if not dash_overwrite_perm:
                return json_error_response(
                    _("You don't have the rights to ")
                    + _("alter this ")
                    + _("dashboard"),
                    status=403,
                )

            flash(
                _("Chart [{}] was added to dashboard [{}]").format(
                    slc.slice_name, dash.dashboard_title
                ),
                "info",
            )
        elif new_dashboard_name:
            # Creating and adding to a new dashboard
            # check create dashboard permissions
            dash_add_perm = security_manager.can_access("can_write", "Dashboard")
            if not dash_add_perm:
                return json_error_response(
                    _("You don't have the rights to ")
                    + _("create a ")
                    + _("dashboard"),
                    status=403,
                )

            dash = Dashboard(
                dashboard_title=request.args.get("new_dashboard_name"),
                owners=[g.user] if g.user else [],
            )
            flash(
                _(
                    "Dashboard [{}] just got created and chart [{}] was added " "to it"
                ).format(dash.dashboard_title, slc.slice_name),
                "info",
            )

        if dash and slc not in dash.slices:
            dash.slices.append(slc)
            db.session.commit()

        response = {
            "can_add": slice_add_perm,
            "can_download": slice_download_perm,
            "form_data": slc.form_data,
            "slice": slc.data,
            "dashboard_url": dash.url if dash else None,
            "dashboard_id": dash.id if dash else None,
        }

        if dash and request.args.get("goto_dash") == "true":
            response.update({"dashboard": dash.url})

        return json_success(json.dumps(response))

    @api
    @has_access_api
    @event_logger.log_this
    @expose("/schemas/<int:db_id>/")
    @expose("/schemas/<int:db_id>/<force_refresh>/")
    def schemas(  # pylint: disable=no-self-use
        self, db_id: int, force_refresh: str = "false"
    ) -> FlaskResponse:
        logger.warning(
            "This API endpoint is deprecated and will be removed in version 2.0.0"
        )
        db_id = int(db_id)
        database = db.session.query(Database).get(db_id)
        if database:
            schemas = database.get_all_schema_names(
                cache=database.schema_cache_enabled,
                cache_timeout=database.schema_cache_timeout,
                force=force_refresh.lower() == "true",
            )
            schemas = security_manager.get_schemas_accessible_by_user(database, schemas)
        else:
            schemas = []

        return Response(json.dumps({"schemas": schemas}), mimetype="application/json")

    @api
    @has_access_api
    @event_logger.log_this
    @expose("/tables/<int:db_id>/<schema>/<substr>/")
    @expose("/tables/<int:db_id>/<schema>/<substr>/<force_refresh>/")
    @expose("/tables/<int:db_id>/<schema>/<substr>/<force_refresh>/<exact_match>")
    def tables(  # pylint: disable=too-many-locals,no-self-use,too-many-arguments
        self,
        db_id: int,
        schema: str,
        substr: str,
        force_refresh: str = "false",
        exact_match: str = "false",
    ) -> FlaskResponse:
        """Endpoint to fetch the list of tables for given database"""
        # Guarantees database filtering by security access
        query = db.session.query(Database)
        query = DatabaseFilter("id", SQLAInterface(Database, db.session)).apply(
            query, None
        )
        database = query.filter_by(id=db_id).one_or_none()
        if not database:
            return json_error_response("Not found", 404)

        force_refresh_parsed = force_refresh.lower() == "true"
        exact_match_parsed = exact_match.lower() == "true"
        schema_parsed = utils.parse_js_uri_path_item(schema, eval_undefined=True)
        substr_parsed = utils.parse_js_uri_path_item(substr, eval_undefined=True)

        if schema_parsed:
            tables = (
                database.get_all_table_names_in_schema(
                    schema=schema_parsed,
                    force=force_refresh_parsed,
                    cache=database.table_cache_enabled,
                    cache_timeout=database.table_cache_timeout,
                )
                or []
            )
            views = (
                database.get_all_view_names_in_schema(
                    schema=schema_parsed,
                    force=force_refresh_parsed,
                    cache=database.table_cache_enabled,
                    cache_timeout=database.table_cache_timeout,
                )
                or []
            )
        else:
            tables = database.get_all_table_names_in_database(
                cache=True, force=False, cache_timeout=24 * 60 * 60
            )
            views = database.get_all_view_names_in_database(
                cache=True, force=False, cache_timeout=24 * 60 * 60
            )
        tables = security_manager.get_datasources_accessible_by_user(
            database, tables, schema_parsed
        )
        views = security_manager.get_datasources_accessible_by_user(
            database, views, schema_parsed
        )

        def get_datasource_label(ds_name: utils.DatasourceName) -> str:
            return (
                ds_name.table if schema_parsed else f"{ds_name.schema}.{ds_name.table}"
            )

        def is_match(src: str, target: utils.DatasourceName) -> bool:
            target_label = get_datasource_label(target)
            if exact_match_parsed:
                return src == target_label
            return src in target_label

        if substr_parsed:
            tables = [tn for tn in tables if is_match(substr_parsed, tn)]
            views = [vn for vn in views if is_match(substr_parsed, vn)]

        if not schema_parsed and database.default_schemas:
            user_schemas = (
                [g.user.email.split("@")[0]] if hasattr(g.user, "email") else []
            )
            valid_schemas = set(database.default_schemas + user_schemas)

            tables = [tn for tn in tables if tn.schema in valid_schemas]
            views = [vn for vn in views if vn.schema in valid_schemas]

        max_items = config["MAX_TABLE_NAMES"] or len(tables)
        total_items = len(tables) + len(views)
        max_tables = len(tables)
        max_views = len(views)
        if total_items and substr_parsed:
            max_tables = max_items * len(tables) // total_items
            max_views = max_items * len(views) // total_items

        dataset_tables = {table.name: table for table in database.tables}

        table_options = [
            {
                "value": tn.table,
                "schema": tn.schema,
                "label": get_datasource_label(tn),
                "title": get_datasource_label(tn),
                "type": "table",
                "extra": dataset_tables[f"{tn.schema}.{tn.table}"].extra_dict
                if (f"{tn.schema}.{tn.table}" in dataset_tables)
                else None,
            }
            for tn in tables[:max_tables]
        ]
        table_options.extend(
            [
                {
                    "value": vn.table,
                    "schema": vn.schema,
                    "label": get_datasource_label(vn),
                    "title": get_datasource_label(vn),
                    "type": "view",
                }
                for vn in views[:max_views]
            ]
        )
        table_options.sort(key=lambda value: value["label"])
        payload = {"tableLength": len(tables) + len(views), "options": table_options}
        return json_success(json.dumps(payload))

    @api
    @has_access_api
    @event_logger.log_this
    @expose("/copy_dash/<int:dashboard_id>/", methods=["GET", "POST"])
    def copy_dash(  # pylint: disable=no-self-use
        self, dashboard_id: int
    ) -> FlaskResponse:
        """Copy dashboard"""
        session = db.session()
        data = json.loads(request.form["data"])
        # client-side send back last_modified_time which was set when
        # the dashboard was open. it was use to avoid mid-air collision.
        # remove it to avoid confusion.
        data.pop("last_modified_time", None)

        dash = Dashboard()
        original_dash = session.query(Dashboard).get(dashboard_id)

        dash.owners = [g.user] if g.user else []
        dash.dashboard_title = data["dashboard_title"]

        old_to_new_slice_ids: Dict[int, int] = {}
        if data["duplicate_slices"]:
            # Duplicating slices as well, mapping old ids to new ones
            for slc in original_dash.slices:
                new_slice = slc.clone()
                new_slice.owners = [g.user] if g.user else []
                session.add(new_slice)
                session.flush()
                new_slice.dashboards.append(dash)
                old_to_new_slice_ids[slc.id] = new_slice.id

            # update chartId of layout entities
            for value in data["positions"].values():
                if isinstance(value, dict) and value.get("meta", {}).get("chartId"):
                    old_id = value["meta"]["chartId"]
                    new_id = old_to_new_slice_ids.get(old_id)
                    value["meta"]["chartId"] = new_id
        else:
            dash.slices = original_dash.slices

        dash.params = original_dash.params

        DashboardDAO.set_dash_metadata(dash, data, old_to_new_slice_ids)
        session.add(dash)
        session.commit()
        dash_json = json.dumps(dash.data)
        session.close()
        return json_success(dash_json)

    @api
    @has_access_api
    @event_logger.log_this
    @expose("/save_dash/<int:dashboard_id>/", methods=["GET", "POST"])
    def save_dash(  # pylint: disable=no-self-use
        self, dashboard_id: int
    ) -> FlaskResponse:
        """Save a dashboard's metadata"""
        session = db.session()
        dash = session.query(Dashboard).get(dashboard_id)
        check_ownership(dash, raise_if_false=True)
        data = json.loads(request.form["data"])
        # client-side send back last_modified_time which was set when
        # the dashboard was open. it was use to avoid mid-air collision.
        remote_last_modified_time = data.get("last_modified_time")
        current_last_modified_time = dash.changed_on.replace(microsecond=0).timestamp()
        if (
            remote_last_modified_time
            and remote_last_modified_time < current_last_modified_time
        ):
            return json_error_response(
                __(
                    "This dashboard was changed recently. "
                    "Please reload dashboard to get latest version."
                ),
                412,
            )
        # remove to avoid confusion.
        data.pop("last_modified_time", None)

        DashboardDAO.set_dash_metadata(dash, data)
        session.merge(dash)
        session.commit()

        # get updated changed_on
        dash = session.query(Dashboard).get(dashboard_id)
        last_modified_time = dash.changed_on.replace(microsecond=0).timestamp()
        session.close()
        return json_success(
            json.dumps({"status": "SUCCESS", "last_modified_time": last_modified_time})
        )

    @api
    @has_access_api
    @event_logger.log_this
    @expose("/add_slices/<int:dashboard_id>/", methods=["POST"])
    def add_slices(  # pylint: disable=no-self-use
        self, dashboard_id: int
    ) -> FlaskResponse:
        """Add and save slices to a dashboard"""
        data = json.loads(request.form["data"])
        session = db.session()
        dash = session.query(Dashboard).get(dashboard_id)
        check_ownership(dash, raise_if_false=True)
        new_slices = session.query(Slice).filter(Slice.id.in_(data["slice_ids"]))
        dash.slices += new_slices
        session.merge(dash)
        session.commit()
        session.close()
        return "SLICES ADDED"

    @api
    @has_access_api
    @event_logger.log_this
    @expose("/testconn", methods=["POST", "GET"])
    def testconn(self) -> FlaskResponse:  # pylint: disable=no-self-use
        """Tests a sqla connection"""
        db_name = request.json.get("name")
        uri = request.json.get("uri")
        try:
            if app.config["PREVENT_UNSAFE_DB_CONNECTIONS"]:
                check_sqlalchemy_uri(make_url(uri))
            # if the database already exists in the database, only its safe
            # (password-masked) URI would be shown in the UI and would be passed in the
            # form data so if the database already exists and the form was submitted
            # with the safe URI, we assume we should retrieve the decrypted URI to test
            # the connection.
            if db_name:
                existing_database = (
                    db.session.query(Database)
                    .filter_by(database_name=db_name)
                    .one_or_none()
                )
                if existing_database and uri == existing_database.safe_sqlalchemy_uri():
                    uri = existing_database.sqlalchemy_uri_decrypted

            # This is the database instance that will be tested. Note the extra fields
            # are represented as JSON encoded strings in the model.
            database = Database(
                server_cert=request.json.get("server_cert"),
                extra=json.dumps(request.json.get("extra", {})),
                impersonate_user=request.json.get("impersonate_user"),
                encrypted_extra=json.dumps(request.json.get("encrypted_extra", {})),
            )
            database.set_sqlalchemy_uri(uri)
            database.db_engine_spec.mutate_db_for_connection_test(database)

            username = (
                g.user.username if g.user and hasattr(g.user, "username") else None
            )
            engine = database.get_sqla_engine(user_name=username)

            with closing(engine.raw_connection()) as conn:
                if engine.dialect.do_ping(conn):
                    return json_success('"OK"')

                raise DBAPIError(None, None, None)
        except CertificateException as ex:
            logger.info("Certificate exception")
            return json_error_response(ex.message)
        except (NoSuchModuleError, ModuleNotFoundError):
            logger.info("Invalid driver")
            driver_name = make_url(uri).drivername
            return json_error_response(
                _(
                    "Could not load database driver: %(driver_name)s",
                    driver_name=driver_name,
                ),
                400,
            )
        except ArgumentError:
            logger.info("Invalid URI")
            return json_error_response(
                _(
                    "Invalid connection string, a valid string usually follows:\n"
                    "'DRIVER://USER:PASSWORD@DB-HOST/DATABASE-NAME'"
                )
            )
        except DBAPIError:
            logger.warning("Connection failed")
            return json_error_response(
                _("Connection failed, please check your connection settings"), 400
            )
        except SupersetSecurityException as ex:
            logger.warning("Stopped an unsafe database connection")
            return json_error_response(_(str(ex)), 400)
        except Exception as ex:  # pylint: disable=broad-except
            logger.warning("Unexpected error %s", type(ex).__name__)
            return json_error_response(
                _("Unexpected error occurred, please check your logs for details"), 400
            )

    @api
    @has_access_api
    @event_logger.log_this
    @expose("/recent_activity/<int:user_id>/", methods=["GET"])
    def recent_activity(  # pylint: disable=no-self-use
        self, user_id: int
    ) -> FlaskResponse:
        """Recent activity (actions) for a given user"""
        limit = request.args.get("limit")
        limit = int(limit) if limit and limit.isdigit() else 100
        actions = request.args.get("actions", "explore,dashboard").split(",")
        # whether to get distinct subjects
        distinct = request.args.get("distinct") != "false"

        has_subject_title = or_(
            and_(
                Dashboard.dashboard_title is not None, Dashboard.dashboard_title != "",
            ),
            and_(Slice.slice_name is not None, Slice.slice_name != ""),
        )

        if distinct:
            one_year_ago = datetime.today() - timedelta(days=365)
            subqry = (
                db.session.query(
                    Log.dashboard_id,
                    Log.slice_id,
                    Log.action,
                    func.max(Log.dttm).label("dttm"),
                )
                .group_by(Log.dashboard_id, Log.slice_id, Log.action)
                .filter(
                    and_(
                        Log.action.in_(actions),
                        Log.user_id == user_id,
                        # limit to one year of data to improve performance
                        Log.dttm > one_year_ago,
                        or_(Log.dashboard_id.isnot(None), Log.slice_id.isnot(None)),
                    )
                )
                .subquery()
            )
            qry = (
                db.session.query(
                    subqry,
                    Dashboard.slug.label("dashboard_slug"),
                    Dashboard.dashboard_title,
                    Slice.slice_name,
                )
                .outerjoin(Dashboard, Dashboard.id == subqry.c.dashboard_id)
                .outerjoin(Slice, Slice.id == subqry.c.slice_id,)
                .filter(has_subject_title)
                .order_by(subqry.c.dttm.desc())
                .limit(limit)
            )
        else:
            qry = (
                db.session.query(
                    Log.dttm,
                    Log.action,
                    Log.dashboard_id,
                    Log.slice_id,
                    Dashboard.slug.label("dashboard_slug"),
                    Dashboard.dashboard_title,
                    Slice.slice_name,
                )
                .outerjoin(Dashboard, Dashboard.id == Log.dashboard_id)
                .outerjoin(Slice, Slice.id == Log.slice_id)
                .filter(has_subject_title)
                .order_by(Log.dttm.desc())
                .limit(limit)
            )

        payload = []
        for log in qry.all():
            item_url = None
            item_title = None
            item_type = None
            if log.dashboard_id:
                item_type = "dashboard"
                item_url = Dashboard(id=log.dashboard_id, slug=log.dashboard_slug).url
                item_title = log.dashboard_title
            elif log.slice_id:
                slc = Slice(id=log.slice_id, slice_name=log.slice_name)
                item_type = "slice"
                item_url = slc.slice_url
                item_title = slc.chart

            payload.append(
                {
                    "action": log.action,
                    "item_type": item_type,
                    "item_url": item_url,
                    "item_title": item_title,
                    "time": log.dttm,
                    "time_delta_humanized": humanize.naturaltime(
                        datetime.now() - log.dttm
                    ),
                }
            )
        return json_success(json.dumps(payload, default=utils.json_int_dttm_ser))

    @api
    @has_access_api
    @event_logger.log_this
    @expose("/csrf_token/", methods=["GET"])
    def csrf_token(self) -> FlaskResponse:
        logger.warning(
            "This API endpoint is deprecated and will be removed in version 2.0.0"
        )
        return Response(
            self.render_template("superset/csrf_token.json"), mimetype="text/json"
        )

    @api
    @has_access_api
    @event_logger.log_this
    @expose("/available_domains/", methods=["GET"])
    def available_domains(self) -> FlaskResponse:  # pylint: disable=no-self-use
        """
        Returns the list of available Superset Webserver domains (if any)
        defined in config. This enables charts embedded in other apps to
        leverage domain sharding if appropriately configured.
        """
        return Response(
            json.dumps(conf.get("SUPERSET_WEBSERVER_DOMAINS")), mimetype="text/json"
        )

    @api
    @has_access_api
    @event_logger.log_this
    @expose("/fave_dashboards_by_username/<username>/", methods=["GET"])
    def fave_dashboards_by_username(self, username: str) -> FlaskResponse:
        """This lets us use a user's username to pull favourite dashboards"""
        user = security_manager.find_user(username=username)
        return self.fave_dashboards(user.get_id())

    @api
    @has_access_api
    @event_logger.log_this
    @expose("/fave_dashboards/<int:user_id>/", methods=["GET"])
    def fave_dashboards(  # pylint: disable=no-self-use
        self, user_id: int
    ) -> FlaskResponse:
        qry = (
            db.session.query(Dashboard, FavStar.dttm)
            .join(
                FavStar,
                and_(
                    FavStar.user_id == int(user_id),
                    FavStar.class_name == "Dashboard",
                    Dashboard.id == FavStar.obj_id,
                ),
            )
            .order_by(FavStar.dttm.desc())
        )
        payload = []
        for o in qry.all():
            dash = {
                "id": o.Dashboard.id,
                "dashboard": o.Dashboard.dashboard_link(),
                "title": o.Dashboard.dashboard_title,
                "url": o.Dashboard.url,
                "dttm": o.dttm,
            }
            if o.Dashboard.created_by:
                user = o.Dashboard.created_by
                dash["creator"] = str(user)
                dash["creator_url"] = "/superset/profile/{}/".format(user.username)
            payload.append(dash)
        return json_success(json.dumps(payload, default=utils.json_int_dttm_ser))

    @api
    @has_access_api
    @event_logger.log_this
    @expose("/created_dashboards/<int:user_id>/", methods=["GET"])
    def created_dashboards(  # pylint: disable=no-self-use
        self, user_id: int
    ) -> FlaskResponse:
        Dash = Dashboard
        qry = (
            db.session.query(Dash)
            .filter(  # pylint: disable=comparison-with-callable
                or_(Dash.created_by_fk == user_id, Dash.changed_by_fk == user_id)
            )
            .order_by(Dash.changed_on.desc())
        )
        payload = [
            {
                "id": o.id,
                "dashboard": o.dashboard_link(),
                "title": o.dashboard_title,
                "url": o.url,
                "dttm": o.changed_on,
            }
            for o in qry.all()
        ]
        return json_success(json.dumps(payload, default=utils.json_int_dttm_ser))

    @api
    @has_access_api
    @event_logger.log_this
    @expose("/user_slices", methods=["GET"])
    @expose("/user_slices/<int:user_id>/", methods=["GET"])
    def user_slices(  # pylint: disable=no-self-use
        self, user_id: Optional[int] = None
    ) -> FlaskResponse:
        """List of slices a user owns, created, modified or faved"""
        if not user_id:
            user_id = g.user.get_id()

        owner_ids_query = (
            db.session.query(Slice.id)
            .join(Slice.owners)
            .filter(security_manager.user_model.id == user_id)
        )

        qry = (
            db.session.query(Slice, FavStar.dttm)
            .join(
                FavStar,
                and_(
                    FavStar.user_id == user_id,
                    FavStar.class_name == "slice",
                    Slice.id == FavStar.obj_id,
                ),
                isouter=True,
            )
            .filter(  # pylint: disable=comparison-with-callable
                or_(
                    Slice.id.in_(owner_ids_query),
                    Slice.created_by_fk == user_id,
                    Slice.changed_by_fk == user_id,
                    FavStar.user_id == user_id,
                )
            )
            .order_by(Slice.slice_name.asc())
        )
        payload = [
            {
                "id": o.Slice.id,
                "title": o.Slice.slice_name,
                "url": o.Slice.slice_url,
                "data": o.Slice.form_data,
                "dttm": o.dttm if o.dttm else o.Slice.changed_on,
                "viz_type": o.Slice.viz_type,
            }
            for o in qry.all()
        ]
        return json_success(json.dumps(payload, default=utils.json_int_dttm_ser))

    @api
    @has_access_api
    @event_logger.log_this
    @expose("/created_slices", methods=["GET"])
    @expose("/created_slices/<int:user_id>/", methods=["GET"])
    def created_slices(  # pylint: disable=no-self-use
        self, user_id: Optional[int] = None
    ) -> FlaskResponse:
        """List of slices created by this user"""
        if not user_id:
            user_id = g.user.get_id()
        qry = (
            db.session.query(Slice)
            .filter(  # pylint: disable=comparison-with-callable
                or_(Slice.created_by_fk == user_id, Slice.changed_by_fk == user_id)
            )
            .order_by(Slice.changed_on.desc())
        )
        payload = [
            {
                "id": o.id,
                "title": o.slice_name,
                "url": o.slice_url,
                "dttm": o.changed_on,
                "viz_type": o.viz_type,
            }
            for o in qry.all()
        ]
        return json_success(json.dumps(payload, default=utils.json_int_dttm_ser))

    @api
    @has_access_api
    @event_logger.log_this
    @expose("/fave_slices", methods=["GET"])
    @expose("/fave_slices/<int:user_id>/", methods=["GET"])
    def fave_slices(  # pylint: disable=no-self-use
        self, user_id: Optional[int] = None
    ) -> FlaskResponse:
        """Favorite slices for a user"""
        if not user_id:
            user_id = g.user.get_id()
        qry = (
            db.session.query(Slice, FavStar.dttm)
            .join(
                FavStar,
                and_(
                    FavStar.user_id == user_id,
                    FavStar.class_name == "slice",
                    Slice.id == FavStar.obj_id,
                ),
            )
            .order_by(FavStar.dttm.desc())
        )
        payload = []
        for o in qry.all():
            dash = {
                "id": o.Slice.id,
                "title": o.Slice.slice_name,
                "url": o.Slice.slice_url,
                "dttm": o.dttm,
                "viz_type": o.Slice.viz_type,
            }
            if o.Slice.created_by:
                user = o.Slice.created_by
                dash["creator"] = str(user)
                dash["creator_url"] = "/superset/profile/{}/".format(user.username)
            payload.append(dash)
        return json_success(json.dumps(payload, default=utils.json_int_dttm_ser))

    @event_logger.log_this
    @api
    @has_access_api
    @expose("/warm_up_cache/", methods=["GET"])
    def warm_up_cache(  # pylint: disable=too-many-locals,no-self-use
        self,
    ) -> FlaskResponse:
        """Warms up the cache for the slice or table.

        Note for slices a force refresh occurs.

        In terms of the `extra_filters` these can be obtained from records in the JSON
        encoded `logs.json` column associated with the `explore_json` action.
        """
        session = db.session()
        slice_id = request.args.get("slice_id")
        dashboard_id = request.args.get("dashboard_id")
        table_name = request.args.get("table_name")
        db_name = request.args.get("db_name")
        extra_filters = request.args.get("extra_filters")
        slices: List[Slice] = []

        if not slice_id and not (table_name and db_name):
            return json_error_response(
                __(
                    "Malformed request. slice_id or table_name and db_name "
                    "arguments are expected"
                ),
                status=400,
            )
        if slice_id:
            slices = session.query(Slice).filter_by(id=slice_id).all()
            if not slices:
                return json_error_response(
                    __("Chart %(id)s not found", id=slice_id), status=404
                )
        elif table_name and db_name:
            table = (
                session.query(SqlaTable)
                .join(Database)
                .filter(
                    Database.database_name == db_name
                    or SqlaTable.table_name == table_name
                )
            ).one_or_none()
            if not table:
                return json_error_response(
                    __(
                        "Table %(table)s wasn't found in the database %(db)s",
                        table=table_name,
                        db=db_name,
                    ),
                    status=404,
                )
            slices = (
                session.query(Slice)
                .filter_by(datasource_id=table.id, datasource_type=table.type)
                .all()
            )

        result = []

        for slc in slices:
            try:
                form_data = get_form_data(slc.id, use_slice_data=True)[0]
                if dashboard_id:
                    form_data["extra_filters"] = (
                        json.loads(extra_filters)
                        if extra_filters
                        else get_dashboard_extra_filters(slc.id, dashboard_id)
                    )

                if not slc.datasource:
                    raise Exception("Slice's datasource does not exist")

                obj = get_viz(
                    datasource_type=slc.datasource.type,
                    datasource_id=slc.datasource.id,
                    form_data=form_data,
                    force=True,
                )

                g.form_data = form_data
                payload = obj.get_payload()
                delattr(g, "form_data")
                error = payload["errors"] or None
                status = payload["status"]
            except Exception as ex:  # pylint: disable=broad-except
                error = utils.error_msg_from_exception(ex)
                status = None

            result.append(
                {"slice_id": slc.id, "viz_error": error, "viz_status": status}
            )

        return json_success(json.dumps(result))

    @has_access_api
    @event_logger.log_this
    @expose("/favstar/<class_name>/<int:obj_id>/<action>/")
    def favstar(  # pylint: disable=no-self-use
        self, class_name: str, obj_id: int, action: str
    ) -> FlaskResponse:
        """Toggle favorite stars on Slices and Dashboard"""
        if not g.user.get_id():
            return json_error_response("ERROR: Favstar toggling denied", status=403)
        session = db.session()
        count = 0
        favs = (
            session.query(FavStar)
            .filter_by(class_name=class_name, obj_id=obj_id, user_id=g.user.get_id())
            .all()
        )
        if action == "select":
            if not favs:
                session.add(
                    FavStar(
                        class_name=class_name,
                        obj_id=obj_id,
                        user_id=g.user.get_id(),
                        dttm=datetime.now(),
                    )
                )
            count = 1
        elif action == "unselect":
            for fav in favs:
                session.delete(fav)
        else:
            count = len(favs)
        session.commit()
        return json_success(json.dumps({"count": count}))

    @api
    @has_access_api
    @event_logger.log_this
    @expose("/dashboard/<int:dashboard_id>/published/", methods=("GET", "POST"))
    def publish(  # pylint: disable=no-self-use
        self, dashboard_id: int
    ) -> FlaskResponse:
        """Gets and toggles published status on dashboards"""
        logger.warning(
            "This API endpoint is deprecated and will be removed in version 2.0.0"
        )
        session = db.session()
        Role = ab_models.Role
        dash = (
            session.query(Dashboard).filter(Dashboard.id == dashboard_id).one_or_none()
        )
        admin_role = session.query(Role).filter(Role.name == "Admin").one_or_none()

        if request.method == "GET":
            if dash:
                return json_success(json.dumps({"published": dash.published}))

            return json_error_response(
                f"ERROR: cannot find dashboard {dashboard_id}", status=404
            )

        edit_perm = is_owner(dash, g.user) or admin_role in get_user_roles()
        if not edit_perm:
            username = g.user.username if hasattr(g.user, "username") else "user"
            return json_error_response(
                f'ERROR: "{username}" cannot alter '
                f'dashboard "{dash.dashboard_title}"',
                status=403,
            )

        dash.published = str(request.form["published"]).lower() == "true"
        session.commit()
        return json_success(json.dumps({"published": dash.published}))

    @has_access
    @expose("/dashboard/<dashboard_id_or_slug>/")
    @event_logger.log_this_with_extra_payload
    @check_dashboard_access(
        on_error=lambda self, ex: Response(
            utils.error_msg_from_exception(ex), status=403
        )
    )
    def dashboard(
        self,
        dashboard_id_or_slug: str,  # pylint: disable=unused-argument
        add_extra_log_payload: Callable[..., None] = lambda **kwargs: None,
        dashboard: Optional[Dashboard] = None,
    ) -> FlaskResponse:
        """
        Server side rendering for a dashboard
        :param dashboard_id_or_slug: identifier for dashboard. used in the decorators
        :param add_extra_log_payload: added by `log_this_with_manual_updates`, set a
            default value to appease pylint
        :param dashboard: added by `check_dashboard_access`
        """
        if not dashboard:
            abort(404)

        if config["ENABLE_ACCESS_REQUEST"]:
            for datasource in dashboard.datasources:
                datasource = ConnectorRegistry.get_datasource(
                    datasource_type=datasource.type,
                    datasource_id=datasource.id,
                    session=db.session(),
                )
                if datasource and not security_manager.can_access_datasource(
                    datasource=datasource
                ):
                    flash(
                        __(
                            security_manager.get_datasource_access_error_msg(datasource)
                        ),
                        "danger",
                    )
                    return redirect(
                        f"/superset/request_access/?dashboard_id={dashboard.id}"
                    )

        dash_edit_perm = check_ownership(
            dashboard, raise_if_false=False
        ) and security_manager.can_access("can_save_dash", "Superset")
        edit_mode = (
            request.args.get(utils.ReservedUrlParameters.EDIT_MODE.value) == "true"
        )

        add_extra_log_payload(
            dashboard_id=dashboard.id,
            dashboard_version="v2",
            dash_edit_perm=dash_edit_perm,
            edit_mode=edit_mode,
        )

        bootstrap_data = {
            "user": bootstrap_user_data(g.user, include_perms=True),
            "common": common_bootstrap_payload(),
        }

        return self.render_template(
            "superset/spa.html",
            entry="spa",
            bootstrap_data=json.dumps(
                bootstrap_data, default=utils.pessimistic_json_iso_dttm_ser
            ),
        )

    @api
    @has_access
    @event_logger.log_this
    @expose("/log/", methods=["POST"])
    def log(self) -> FlaskResponse:  # pylint: disable=no-self-use
        return Response(status=200)

    @has_access
    @expose("/sync_druid/", methods=["POST"])
    @event_logger.log_this
    def sync_druid_source(self) -> FlaskResponse:  # pylint: disable=no-self-use
        """Syncs the druid datasource in main db with the provided config.

        The endpoint takes 3 arguments:
            user - user name to perform the operation as
            cluster - name of the druid cluster
            config - configuration stored in json that contains:
                name: druid datasource name
                dimensions: list of the dimensions, they become druid columns
                    with the type STRING
                metrics_spec: list of metrics (dictionary). Metric consists of
                    2 attributes: type and name. Type can be count,
                    etc. `count` type is stored internally as longSum
                    other fields will be ignored.

            Example: {
                'name': 'test_click',
                'metrics_spec': [{'type': 'count', 'name': 'count'}],
                'dimensions': ['affiliate_id', 'campaign', 'first_seen']
            }
        """
        payload = request.get_json(force=True)
        druid_config = payload["config"]
        user_name = payload["user"]
        cluster_name = payload["cluster"]

        user = security_manager.find_user(username=user_name)
        DruidDatasource = ConnectorRegistry.sources[  # pylint: disable=invalid-name
            "druid"
        ]
        DruidCluster = DruidDatasource.cluster_class  # pylint: disable=invalid-name
        if not user:
            err_msg = __(
                "Can't find User '%(name)s', please ask your admin " "to create one.",
                name=user_name,
            )
            logger.error(err_msg, exc_info=True)
            return json_error_response(err_msg)
        cluster = (
            db.session.query(DruidCluster)
            .filter_by(cluster_name=cluster_name)
            .one_or_none()
        )
        if not cluster:
            err_msg = __(
                "Can't find DruidCluster with cluster_name = " "'%(name)s'",
                name=cluster_name,
            )
            logger.error(err_msg, exc_info=True)
            return json_error_response(err_msg)
        try:
            DruidDatasource.sync_to_db_from_config(druid_config, user, cluster)
        except Exception as ex:  # pylint: disable=broad-except
            err_msg = utils.error_msg_from_exception(ex)
            logger.exception(err_msg)
            return json_error_response(err_msg)
        return Response(status=201)

    @has_access
    @expose("/get_or_create_table/", methods=["POST"])
    @event_logger.log_this
    def sqllab_table_viz(self) -> FlaskResponse:  # pylint: disable=no-self-use
        """Gets or creates a table object with attributes passed to the API.

        It expects the json with params:
        * datasourceName - e.g. table name, required
        * dbId - database id, required
        * schema - table schema, optional
        * templateParams - params for the Jinja templating syntax, optional
        :return: Response
        """
        data = json.loads(request.form["data"])
        table_name = data["datasourceName"]
        database_id = data["dbId"]
        table = (
            db.session.query(SqlaTable)
            .filter_by(database_id=database_id, table_name=table_name)
            .one_or_none()
        )
        if not table:
            # Create table if doesn't exist.
            with db.session.no_autoflush:
                table = SqlaTable(table_name=table_name, owners=[g.user])
                table.database_id = database_id
                table.database = (
                    db.session.query(Database).filter_by(id=database_id).one()
                )
                table.schema = data.get("schema")
                table.template_params = data.get("templateParams")
                # needed for the table validation.
                validate_sqlatable(table)

            db.session.add(table)
            table.fetch_metadata()
            create_table_permissions(table)
            db.session.commit()

        return json_success(json.dumps({"table_id": table.id}))

    @has_access
    @expose("/sqllab_viz/", methods=["POST"])
    @event_logger.log_this
    def sqllab_viz(self) -> FlaskResponse:  # pylint: disable=no-self-use
        data = json.loads(request.form["data"])
        try:
            table_name = data["datasourceName"]
            database_id = data["dbId"]
        except KeyError as ex:
            raise SupersetGenericErrorException(
                __(
                    "One or more required fields are missing in the request. Please try "
                    "again, and if the problem persists conctact your administrator."
                ),
                status=400,
            ) from ex
        database = db.session.query(Database).get(database_id)
        if not database:
            raise SupersetErrorException(
                SupersetError(
                    message=__("The database was not found."),
                    error_type=SupersetErrorType.DATABASE_NOT_FOUND_ERROR,
                    level=ErrorLevel.ERROR,
                ),
                status=404,
            )
        table = (
            db.session.query(SqlaTable)
            .filter_by(database_id=database_id, table_name=table_name)
            .one_or_none()
        )
        if not table:
            table = SqlaTable(table_name=table_name, owners=[g.user])
        table.database = database
        table.schema = data.get("schema")
        table.template_params = data.get("templateParams")
        table.is_sqllab_view = True
        table.sql = ParsedQuery(data.get("sql")).stripped()
        db.session.add(table)
        cols = []
        for config_ in data.get("columns"):
            column_name = config_.get("name")
            col = TableColumn(
                column_name=column_name,
                filterable=True,
                groupby=True,
                is_dttm=config_.get("is_date", False),
                type=config_.get("type", False),
            )
            cols.append(col)

        table.columns = cols
        table.metrics = [SqlMetric(metric_name="count", expression="count(*)")]
        db.session.commit()
        return json_success(json.dumps({"table_id": table.id}))

    @has_access
    @expose("/extra_table_metadata/<int:database_id>/<table_name>/<schema>/")
    @event_logger.log_this
    def extra_table_metadata(  # pylint: disable=no-self-use
        self, database_id: int, table_name: str, schema: str
    ) -> FlaskResponse:
        parsed_schema = utils.parse_js_uri_path_item(schema, eval_undefined=True)
        table_name = utils.parse_js_uri_path_item(table_name)  # type: ignore
        mydb = db.session.query(Database).filter_by(id=database_id).one()
        payload = mydb.db_engine_spec.extra_table_metadata(
            mydb, table_name, parsed_schema
        )
        return json_success(json.dumps(payload))

    @has_access
    @expose("/select_star/<int:database_id>/<table_name>")
    @expose("/select_star/<int:database_id>/<table_name>/<schema>")
    @event_logger.log_this
    def select_star(
        self, database_id: int, table_name: str, schema: Optional[str] = None
    ) -> FlaskResponse:
        logging.warning(
            "%s.select_star "
            "This API endpoint is deprecated and will be removed in version 2.0.0",
            self.__class__.__name__,
        )
        stats_logger.incr(f"{self.__class__.__name__}.select_star.init")
        database = db.session.query(Database).get(database_id)
        if not database:
            stats_logger.incr(
                f"deprecated.{self.__class__.__name__}.select_star.database_not_found"
            )
            raise SupersetErrorException(
                SupersetError(
                    message=__("The database was not found."),
                    error_type=SupersetErrorType.DATABASE_NOT_FOUND_ERROR,
                    level=ErrorLevel.ERROR,
                ),
                status=404,
            )
        schema = utils.parse_js_uri_path_item(schema, eval_undefined=True)
        table_name = utils.parse_js_uri_path_item(table_name)  # type: ignore
        if not self.appbuilder.sm.can_access_table(database, Table(table_name, schema)):
            stats_logger.incr(
                f"deprecated.{self.__class__.__name__}.select_star.permission_denied"
            )
            logging.warning(
                "Permission denied for user %s on table: %s schema: %s",
                str(g.user),
                table_name,
                schema,
            )
            raise SupersetErrorException(
                SupersetError(
                    message=__(
                        "You are not authorized to fetch samples from this table. If "
                        "you think this is an error, please reach out to your "
                        "administrator."
                    ),
                    error_type=SupersetErrorType.QUERY_SECURITY_ACCESS_ERROR,
                    level=ErrorLevel.ERROR,
                ),
                status=403,
            )
        stats_logger.incr(f"deprecated.{self.__class__.__name__}.select_star.success")
        return json_success(
            database.select_star(
                table_name, schema, latest_partition=True, show_cols=True
            )
        )

    @has_access_api
    @expose("/estimate_query_cost/<int:database_id>/", methods=["POST"])
    @expose("/estimate_query_cost/<int:database_id>/<schema>/", methods=["POST"])
    @event_logger.log_this
    def estimate_query_cost(  # pylint: disable=no-self-use
        self, database_id: int, schema: Optional[str] = None
    ) -> FlaskResponse:
        mydb = db.session.query(Database).get(database_id)

        sql = json.loads(request.form.get("sql", '""'))
        template_params = json.loads(request.form.get("templateParams") or "{}")
        if template_params:
            template_processor = get_template_processor(mydb)
            sql = template_processor.process_template(sql, **template_params)

        timeout = SQLLAB_QUERY_COST_ESTIMATE_TIMEOUT
        timeout_msg = f"The estimation exceeded the {timeout} seconds timeout."
        try:
            with utils.timeout(seconds=timeout, error_message=timeout_msg):
                cost = mydb.db_engine_spec.estimate_query_cost(
                    mydb, schema, sql, utils.QuerySource.SQL_LAB
                )
        except SupersetTimeoutException as ex:
            logger.exception(ex)
            return json_errors_response([ex.error])
        except Exception as ex:  # pylint: disable=broad-except
            return json_error_response(utils.error_msg_from_exception(ex))

        spec = mydb.db_engine_spec
        query_cost_formatters: Dict[str, Any] = get_feature_flags().get(
            "QUERY_COST_FORMATTERS_BY_ENGINE", {}
        )
        query_cost_formatter = query_cost_formatters.get(
            spec.engine, spec.query_cost_formatter
        )
        cost = query_cost_formatter(cost)

        return json_success(json.dumps(cost))

    @expose("/theme/")
    def theme(self) -> FlaskResponse:
        return self.render_template("superset/theme.html")

    @has_access_api
    @expose("/results/<key>/")
    @event_logger.log_this
    def results(self, key: str) -> FlaskResponse:
        return self.results_exec(key)

    @staticmethod
    def results_exec(key: str) -> FlaskResponse:
        """Serves a key off of the results backend

        It is possible to pass the `rows` query argument to limit the number
        of rows returned.
        """
        if not results_backend:
            raise SupersetErrorException(
                SupersetError(
                    message=__("Results backend is not configured."),
                    error_type=SupersetErrorType.RESULTS_BACKEND_NOT_CONFIGURED_ERROR,
                    level=ErrorLevel.ERROR,
                )
            )

        read_from_results_backend_start = now_as_float()
        blob = results_backend.get(key)
        stats_logger.timing(
            "sqllab.query.results_backend_read",
            now_as_float() - read_from_results_backend_start,
        )
        if not blob:
            raise SupersetErrorException(
                SupersetError(
                    message=__(
                        "Data could not be retrieved from the results backend. You "
                        "need to re-run the original query."
                    ),
                    error_type=SupersetErrorType.RESULTS_BACKEND_ERROR,
                    level=ErrorLevel.ERROR,
                ),
                status=410,
            )

        query = db.session.query(Query).filter_by(results_key=key).one_or_none()
        if query is None:
            raise SupersetErrorException(
                SupersetError(
                    message=__(
                        "The query associated with these results could not be find. "
                        "You need to re-run the original query."
                    ),
                    error_type=SupersetErrorType.RESULTS_BACKEND_ERROR,
                    level=ErrorLevel.ERROR,
                ),
                status=404,
            )

        try:
            query.raise_for_access()
        except SupersetSecurityException as ex:
            raise SupersetErrorException(
                SupersetError(
                    message=__(
                        "You are not authorized to see this query. If you think this "
                        "is an error, please reach out to your administrator."
                    ),
                    error_type=SupersetErrorType.QUERY_SECURITY_ACCESS_ERROR,
                    level=ErrorLevel.ERROR,
                ),
                status=403,
            ) from ex

        payload = utils.zlib_decompress(blob, decode=not results_backend_use_msgpack)
        try:
            obj = _deserialize_results_payload(
                payload, query, cast(bool, results_backend_use_msgpack)
            )
        except SerializationError as ex:
            raise SupersetErrorException(
                SupersetError(
                    message=__(
                        "Data could not be deserialized from the results backend. The "
                        "storage format might have changed, rendering the old data "
                        "stake. You need to re-run the original query."
                    ),
                    error_type=SupersetErrorType.RESULTS_BACKEND_ERROR,
                    level=ErrorLevel.ERROR,
                ),
                status=404,
            ) from ex

        if "rows" in request.args:
            try:
                rows = int(request.args["rows"])
            except ValueError as ex:
                raise SupersetErrorException(
                    SupersetError(
                        message=__(
                            "The provided `rows` argument is not a valid integer."
                        ),
                        error_type=SupersetErrorType.INVALID_PAYLOAD_SCHEMA_ERROR,
                        level=ErrorLevel.ERROR,
                    ),
                    status=400,
                ) from ex

            obj = apply_display_max_row_configuration_if_require(obj, rows)

        return json_success(
            json.dumps(
                obj, default=utils.json_iso_dttm_ser, ignore_nan=True, encoding=None
            )
        )

    @has_access_api
    @handle_api_exception
    @expose("/stop_query/", methods=["POST"])
    @event_logger.log_this
    @backoff.on_exception(
        backoff.constant,
        Exception,
        interval=1,
        on_backoff=lambda details: db.session.rollback(),
        on_giveup=lambda details: db.session.rollback(),
        max_tries=5,
    )
    def stop_query(self) -> FlaskResponse:
        client_id = request.form.get("client_id")

        query = db.session.query(Query).filter_by(client_id=client_id).one()
        if query.status in [
            QueryStatus.FAILED,
            QueryStatus.SUCCESS,
            QueryStatus.TIMED_OUT,
        ]:
            logger.warning(
                "Query with client_id %s could not be stopped: "
                "query already complete",
                str(client_id),
            )
            return self.json_response("OK")

        if not sql_lab.cancel_query(query, g.user.username if g.user else None):
            raise SupersetCancelQueryException("Could not cancel query")

        query.status = QueryStatus.STOPPED
        db.session.commit()

        return self.json_response("OK")

    @has_access_api
    @event_logger.log_this
    @expose("/validate_sql_json/", methods=["POST", "GET"])
    def validate_sql_json(
        # pylint: disable=too-many-locals,no-self-use
        self,
    ) -> FlaskResponse:
        """Validates that arbitrary sql is acceptable for the given database.
        Returns a list of error/warning annotations as json.
        """
        sql = request.form["sql"]
        database_id = request.form["database_id"]
        schema = request.form.get("schema") or None
        template_params = json.loads(request.form.get("templateParams") or "{}")

        if len(template_params) > 0:
            # TODO: factor the Database object out of template rendering
            #       or provide it as mydb so we can render template params
            #       without having to also persist a Query ORM object.
            return json_error_response(
                "SQL validation does not support template parameters", status=400
            )

        session = db.session()
        mydb = session.query(Database).filter_by(id=database_id).one_or_none()
        if not mydb:
            return json_error_response(
                "Database with id {} is missing.".format(database_id), status=400
            )

        spec = mydb.db_engine_spec
        validators_by_engine = get_feature_flags().get("SQL_VALIDATORS_BY_ENGINE")
        if not validators_by_engine or spec.engine not in validators_by_engine:
            return json_error_response(
                "no SQL validator is configured for {}".format(spec.engine), status=400
            )
        validator_name = validators_by_engine[spec.engine]
        validator = get_validator_by_name(validator_name)
        if not validator:
            return json_error_response(
                "No validator named {} found (configured for the {} engine)".format(
                    validator_name, spec.engine
                )
            )

        try:
            timeout = config["SQLLAB_VALIDATION_TIMEOUT"]
            timeout_msg = f"The query exceeded the {timeout} seconds timeout."
            with utils.timeout(seconds=timeout, error_message=timeout_msg):
                errors = validator.validate(sql, schema, mydb)
            payload = json.dumps(
                [err.to_dict() for err in errors],
                default=utils.pessimistic_json_iso_dttm_ser,
                ignore_nan=True,
                encoding=None,
            )
            return json_success(payload)
        except Exception as ex:  # pylint: disable=broad-except
            logger.exception(ex)
            msg = _(
                "%(validator)s was unable to check your query.\n"
                "Please recheck your query.\n"
                "Exception: %(ex)s",
                validator=validator.name,
                ex=ex,
            )
            # Return as a 400 if the database error message says we got a 4xx error
            if re.search(r"([\W]|^)4\d{2}([\W]|$)", str(ex)):
                return json_error_response(f"{msg}", status=400)
            return json_error_response(f"{msg}")

    @has_access_api
    @handle_api_exception
    @event_logger.log_this
    @expose("/sql_json/", methods=["POST"])
    def sql_json(self) -> FlaskResponse:
        try:
            log_params = {
                "user_agent": cast(Optional[str], request.headers.get("USER_AGENT"))
            }
            execution_context = SqlJsonExecutionContext(request.json)
            command = self._create_sql_json_command(execution_context, log_params)
            command_result: CommandResult = command.run()
            return self._create_response_from_execution_context(command_result)
        except SqlLabException as ex:
            logger.error(ex.message)
            self._set_http_status_into_Sql_lab_exception(ex)
            payload = {"errors": [ex.to_dict()]}
            return json_error_response(status=ex.status, payload=payload)

    @staticmethod
    def _create_sql_json_command(
        execution_context: SqlJsonExecutionContext, log_params: Optional[Dict[str, Any]]
    ) -> ExecuteSqlCommand:
        query_dao = QueryDAO()
        sql_json_executor = Superset._create_sql_json_executor(
            execution_context, query_dao
        )
        execution_context_convertor = ExecutionContextConvertorImpl()
        execution_context_convertor.set_max_row_in_display(
            int(config.get("DISPLAY_MAX_ROW"))  # type: ignore
        )
        return ExecuteSqlCommand(
            execution_context,
            query_dao,
            DatabaseDAO(),
            CanAccessQueryValidatorImpl(),
            SqlQueryRenderImpl(get_template_processor),
            sql_json_executor,
            execution_context_convertor,
            config.get("SQLLAB_CTAS_NO_LIMIT"),  # type: ignore
            log_params,
        )

    @staticmethod
    def _create_sql_json_executor(
        execution_context: SqlJsonExecutionContext, query_dao: QueryDAO
    ) -> SqlJsonExecutor:
        sql_json_executor: SqlJsonExecutor
        if execution_context.is_run_asynchronous():
            sql_json_executor = ASynchronousSqlJsonExecutor(query_dao, get_sql_results)
        else:
            sql_json_executor = SynchronousSqlJsonExecutor(
                query_dao,
                get_sql_results,
                config.get("SQLLAB_TIMEOUT"),  # type: ignore
                is_feature_enabled("SQLLAB_BACKEND_PERSISTENCE"),
            )
        return sql_json_executor

    @staticmethod
    def _set_http_status_into_Sql_lab_exception(ex: SqlLabException) -> None:
        if isinstance(ex, QueryIsForbiddenToAccessException):
            ex.status = 403

    def _create_response_from_execution_context(  # pylint: disable=invalid-name, no-self-use
        self, command_result: CommandResult,
    ) -> FlaskResponse:

        status_code = 200
        if command_result["status"] == SqlJsonExecutionStatus.QUERY_IS_RUNNING:
            status_code = 202
        return json_success(command_result["payload"], status_code)

    @has_access
    @event_logger.log_this
    @expose("/csv/<client_id>")
    def csv(  # pylint: disable=no-self-use,too-many-locals
        self, client_id: str
    ) -> FlaskResponse:
        """Download the query results as csv."""
        logger.info("Exporting CSV file [%s]", client_id)
        query = db.session.query(Query).filter_by(client_id=client_id).one()

        try:
            query.raise_for_access()
        except SupersetSecurityException as ex:
            flash(ex.error.message)
            return redirect("/")

        blob = None
        if results_backend and query.results_key:
            logger.info("Fetching CSV from results backend [%s]", query.results_key)
            blob = results_backend.get(query.results_key)
        if blob:
            logger.info("Decompressing")
            payload = utils.zlib_decompress(
                blob, decode=not results_backend_use_msgpack
            )
            obj = _deserialize_results_payload(
                payload, query, cast(bool, results_backend_use_msgpack)
            )
            columns = [c["name"] for c in obj["columns"]]
            df = pd.DataFrame.from_records(obj["data"], columns=columns)
            logger.info("Using pandas to convert to CSV")
        else:
            logger.info("Running a query to turn into CSV")
            if query.select_sql:
                sql = query.select_sql
                limit = None
            else:
                sql = query.executed_sql
                limit = ParsedQuery(sql).limit
            if limit is not None and query.limiting_factor in {
                LimitingFactor.QUERY,
                LimitingFactor.DROPDOWN,
                LimitingFactor.QUERY_AND_DROPDOWN,
            }:
                # remove extra row from `increased_limit`
                limit -= 1
            df = query.database.get_df(sql, query.schema)[:limit]

        csv_data = csv.df_to_escaped_csv(df, index=False, **config["CSV_EXPORT"])
        quoted_csv_name = parse.quote(query.name)
        response = CsvResponse(
            csv_data, headers=generate_download_headers("csv", quoted_csv_name)
        )
        event_info = {
            "event_type": "data_export",
            "client_id": client_id,
            "row_count": len(df.index),
            "database": query.database.name,
            "schema": query.schema,
            "sql": query.sql,
            "exported_format": "csv",
        }
        event_rep = repr(event_info)
        logger.debug(
            "CSV exported: %s", event_rep, extra={"superset_event": event_info}
        )
        return response

    @api
    @handle_api_exception
    @has_access
    @event_logger.log_this
    @expose("/fetch_datasource_metadata")
    def fetch_datasource_metadata(self) -> FlaskResponse:  # pylint: disable=no-self-use
        """
        Fetch the datasource metadata.

        :returns: The Flask response
        :raises SupersetSecurityException: If the user cannot access the resource
        """

        datasource_id, datasource_type = request.args["datasourceKey"].split("__")
        datasource = ConnectorRegistry.get_datasource(
            datasource_type, datasource_id, db.session,
        )
        # Check if datasource exists
        if not datasource:
            return json_error_response(DATASOURCE_MISSING_ERR)

        datasource.raise_for_access()
        return json_success(json.dumps(datasource.data))

    @has_access_api
    @event_logger.log_this
    @expose("/queries/<float:last_updated_ms>")
    @expose("/queries/<int:last_updated_ms>")
    def queries(self, last_updated_ms: Union[float, int]) -> FlaskResponse:
        """
        Get the updated queries.

        :param last_updated_ms: Unix time (milliseconds)
        """

        return self.queries_exec(last_updated_ms)

    @staticmethod
    def queries_exec(last_updated_ms: Union[float, int]) -> FlaskResponse:
        stats_logger.incr("queries")
        if not g.user.get_id():
            return json_error_response(
                "Please login to access the queries.", status=403
            )

        # UTC date time, same that is stored in the DB.
        last_updated_dt = datetime.utcfromtimestamp(last_updated_ms / 1000)

        sql_queries = (
            db.session.query(Query)
            .filter(
                Query.user_id == g.user.get_id(), Query.changed_on >= last_updated_dt
            )
            .all()
        )
        dict_queries = {q.client_id: q.to_dict() for q in sql_queries}
        return json_success(json.dumps(dict_queries, default=utils.json_int_dttm_ser))

    @has_access
    @event_logger.log_this
    @expose("/search_queries")
    def search_queries(self) -> FlaskResponse:  # pylint: disable=no-self-use
        """
        Search for previously run sqllab queries. Used for Sqllab Query Search
        page /superset/sqllab#search.

        Custom permission can_only_search_queries_owned restricts queries
        to only queries run by current user.

        :returns: Response with list of sql query dicts
        """
        if security_manager.can_access_all_queries():
            search_user_id = request.args.get("user_id")
        elif request.args.get("user_id") is not None:
            try:
                search_user_id = int(cast(int, request.args.get("user_id")))
            except ValueError:
                return Response(status=400, mimetype="application/json")
            if search_user_id != g.user.get_user_id():
                return Response(status=403, mimetype="application/json")
        else:
            search_user_id = g.user.get_user_id()
        database_id = request.args.get("database_id")
        search_text = request.args.get("search_text")
        status = request.args.get("status")
        # From and To time stamp should be Epoch timestamp in seconds
        from_time = request.args.get("from")
        to_time = request.args.get("to")

        query = db.session.query(Query)
        if search_user_id:
            # Filter on user_id
            query = query.filter(Query.user_id == search_user_id)

        if database_id:
            # Filter on db Id
            query = query.filter(Query.database_id == database_id)

        if status:
            # Filter on status
            query = query.filter(Query.status == status)

        if search_text:
            # Filter on search text
            query = query.filter(Query.sql.like(f"%{search_text}%"))

        if from_time:
            query = query.filter(Query.start_time > int(from_time))

        if to_time:
            query = query.filter(Query.start_time < int(to_time))

        query_limit = config["QUERY_SEARCH_LIMIT"]
        sql_queries = query.order_by(Query.start_time.asc()).limit(query_limit).all()

        dict_queries = [q.to_dict() for q in sql_queries]

        return Response(
            json.dumps(dict_queries, default=utils.json_int_dttm_ser),
            status=200,
            mimetype="application/json",
        )

    @app.errorhandler(500)
    def show_traceback(self) -> FlaskResponse:  # pylint: disable=no-self-use
        return (
            render_template("superset/traceback.html", error_msg=get_error_msg()),
            500,
        )

    @event_logger.log_this
    @expose("/welcome/")
    def welcome(self) -> FlaskResponse:
        """Personalized welcome page"""
        if not g.user or not g.user.get_id():
            if conf.get("PUBLIC_ROLE_LIKE_GAMMA", False) or conf["PUBLIC_ROLE_LIKE"]:
                return self.render_template("superset/public_welcome.html")
            return redirect(appbuilder.get_url_for_login)

        welcome_dashboard_id = (
            db.session.query(UserAttribute.welcome_dashboard_id)
            .filter_by(user_id=g.user.get_id())
            .scalar()
        )
        if welcome_dashboard_id:
            return self.dashboard(dashboard_id_or_slug=str(welcome_dashboard_id))

        payload = {
            "user": bootstrap_user_data(g.user, include_perms=True),
            "common": common_bootstrap_payload(),
        }

        return self.render_template(
            "superset/spa.html",
            entry="spa",
            bootstrap_data=json.dumps(
                payload, default=utils.pessimistic_json_iso_dttm_ser
            ),
        )

    @has_access
    @event_logger.log_this
    @expose("/profile/<username>/")
    def profile(self, username: str) -> FlaskResponse:
        """User profile page"""
        user = (
            db.session.query(ab_models.User).filter_by(username=username).one_or_none()
        )
        if not user:
            abort(404, description=f"User: {username} does not exist.")

        payload = {
            "user": bootstrap_user_data(user, include_perms=True),
            "common": common_bootstrap_payload(),
        }

        return self.render_template(
            "superset/basic.html",
            title=_("%(user)s's profile", user=username).__str__(),
            entry="profile",
            bootstrap_data=json.dumps(
                payload, default=utils.pessimistic_json_iso_dttm_ser
            ),
        )

    @staticmethod
    def _get_sqllab_tabs(user_id: int) -> Dict[str, Any]:
        # send list of tab state ids
        tabs_state = (
            db.session.query(TabState.id, TabState.label)
            .filter_by(user_id=user_id)
            .all()
        )
        tab_state_ids = [str(tab_state[0]) for tab_state in tabs_state]
        # return first active tab, or fallback to another one if no tab is active
        active_tab = (
            db.session.query(TabState)
            .filter_by(user_id=user_id)
            .order_by(TabState.active.desc())
            .first()
        )

        databases: Dict[int, Any] = {}
        for database in DatabaseDAO.find_all():
            databases[database.id] = {
                k: v for k, v in database.to_json().items() if k in DATABASE_KEYS
            }
            databases[database.id]["backend"] = database.backend
        queries: Dict[str, Any] = {}

        # These are unnecessary if sqllab backend persistence is disabled
        if is_feature_enabled("SQLLAB_BACKEND_PERSISTENCE"):
            # return all user queries associated with existing SQL editors
            user_queries = (
                db.session.query(Query)
                .filter_by(user_id=user_id)
                .filter(Query.sql_editor_id.in_(tab_state_ids))
                .all()
            )
            queries = {
                query.client_id: dict(query.to_dict().items()) for query in user_queries
            }

        return {
            "tab_state_ids": tabs_state,
            "active_tab": active_tab.to_dict() if active_tab else None,
            "databases": databases,
            "queries": queries,
        }

    @has_access
    @event_logger.log_this
    @expose("/sqllab/", methods=["GET", "POST"])
    def sqllab(self) -> FlaskResponse:
        """SQL Editor"""
        payload = {
            "defaultDbId": config["SQLLAB_DEFAULT_DBID"],
            "common": common_bootstrap_payload(),
            **self._get_sqllab_tabs(g.user.get_id()),
        }

        form_data = request.form.get("form_data")
        if form_data:
            try:
                payload["requested_query"] = json.loads(form_data)
            except json.JSONDecodeError:
                pass

        payload["user"] = bootstrap_user_data(g.user, include_perms=True)
        bootstrap_data = json.dumps(
            payload, default=utils.pessimistic_json_iso_dttm_ser
        )

        return self.render_template(
            "superset/basic.html", entry="sqllab", bootstrap_data=bootstrap_data
        )

    @has_access
    @event_logger.log_this
    @expose("/sqllab/history/", methods=["GET"])
    @event_logger.log_this
    def sqllab_history(self) -> FlaskResponse:
        if not is_feature_enabled("ENABLE_REACT_CRUD_VIEWS"):
            return redirect("/superset/sqllab#search", code=307)

        return super().render_app_template()

    @api
    @has_access_api
    @event_logger.log_this
    @expose("/schemas_access_for_file_upload")
    def schemas_access_for_file_upload(self) -> FlaskResponse:
        """
        This method exposes an API endpoint to
        get the schema access control settings for file upload in this database
        """
        if not request.args.get("db_id"):
            return json_error_response("No database is allowed for your csv upload")

        db_id = int(request.args["db_id"])
        database = db.session.query(Database).filter_by(id=db_id).one()
        try:
            schemas_allowed = database.get_schema_access_for_file_upload()
            if security_manager.can_access_database(database):
                return self.json_response(schemas_allowed)
            # the list schemas_allowed should not be empty here
            # and the list schemas_allowed_processed returned from security_manager
            # should not be empty either,
            # otherwise the database should have been filtered out
            # in CsvToDatabaseForm
            schemas_allowed_processed = security_manager.get_schemas_accessible_by_user(
                database, schemas_allowed, False
            )
            return self.json_response(schemas_allowed_processed)
        except Exception as ex:  # pylint: disable=broad-except
            logger.exception(ex)
            return json_error_response(
                "Failed to fetch schemas allowed for csv upload in this database! "
                "Please contact your Superset Admin!"
            )
