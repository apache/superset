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
# pylint: disable=comparison-with-callable
import logging
import re
from collections import defaultdict
from contextlib import closing
from datetime import datetime
from typing import Any, cast, Dict, List, Optional, Union
from urllib import parse

import backoff
import pandas as pd
import simplejson as json
from flask import abort, flash, g, Markup, redirect, render_template, request, Response
from flask_appbuilder import expose
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import has_access, has_access_api
from flask_appbuilder.security.sqla import models as ab_models
from flask_babel import gettext as __, lazy_gettext as _
from sqlalchemy import and_, or_, select
from sqlalchemy.engine.url import make_url
from sqlalchemy.exc import (
    ArgumentError,
    NoSuchModuleError,
    OperationalError,
    SQLAlchemyError,
)
from sqlalchemy.orm.session import Session
from werkzeug.urls import Href

import superset.models.core as models
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
from superset.connectors.connector_registry import ConnectorRegistry
from superset.connectors.sqla.models import (
    AnnotationDatasource,
    SqlaTable,
    SqlMetric,
    TableColumn,
)
from superset.dashboards.dao import DashboardDAO
from superset.exceptions import (
    CertificateException,
    DatabaseNotFound,
    SupersetException,
    SupersetSecurityException,
    SupersetTimeoutException,
)
from superset.jinja_context import get_template_processor
from superset.models.dashboard import Dashboard
from superset.models.datasource_access_request import DatasourceAccessRequest
from superset.models.slice import Slice
from superset.models.sql_lab import Query, TabState
from superset.models.user_attributes import UserAttribute
from superset.security.analytics_db_safety import (
    check_sqlalchemy_uri,
    DBSecurityException,
)
from superset.sql_parse import CtasMethod, ParsedQuery, Table
from superset.sql_validators import get_validator_by_name
from superset.typing import FlaskResponse
from superset.utils import core as utils, dashboard_import_export
from superset.utils.dates import now_as_float
from superset.utils.decorators import etag_cache
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
from superset.views.database.filters import DatabaseFilter
from superset.views.utils import (
    _deserialize_results_payload,
    apply_display_max_row_limit,
    bootstrap_user_data,
    check_datasource_perms,
    check_slice_perms,
    get_cta_schema_name,
    get_dashboard_extra_filters,
    get_datasource_info,
    get_form_data,
    get_viz,
    is_owner,
)
from superset.viz import BaseViz

config = app.config
CACHE_DEFAULT_TIMEOUT = config["CACHE_DEFAULT_TIMEOUT"]
SQLLAB_QUERY_COST_ESTIMATE_TIMEOUT = config["SQLLAB_QUERY_COST_ESTIMATE_TIMEOUT"]
stats_logger = config["STATS_LOGGER"]
DAR = DatasourceAccessRequest
QueryStatus = utils.QueryStatus
logger = logging.getLogger(__name__)

DATABASE_KEYS = [
    "allow_csv_upload",
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


class Superset(BaseSupersetView):  # pylint: disable=too-many-public-methods
    """The base views for Superset!"""

    logger = logging.getLogger(__name__)

    @has_access_api
    @expose("/datasources/")
    def datasources(self) -> FlaskResponse:
        return self.json_response(
            sorted(
                [
                    datasource.short_data
                    for datasource in ConnectorRegistry.get_all_datasources(db.session)
                    if datasource.short_data.get("name")
                ],
                key=lambda datasource: datasource["name"],
            )
        )

    @has_access_api
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

    @event_logger.log_this
    @has_access
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

    @event_logger.log_this
    @has_access
    @expose("/approve")
    def approve(self) -> FlaskResponse:  # pylint: disable=too-many-locals,no-self-use
        def clean_fulfilled_requests(session: Session) -> None:
            for dar in session.query(DAR).all():
                datasource = ConnectorRegistry.get_datasource(
                    dar.datasource_type, dar.datasource_id, session
                )
                if not datasource or security_manager.can_access_datasource(datasource):
                    # datasource does not exist anymore
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
            .filter(
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
    @expose("/slice/<int:slice_id>/")
    def slice(self, slice_id: int) -> FlaskResponse:  # pylint: disable=no-self-use
        _, slc = get_form_data(slice_id, use_slice_data=True)
        if not slc:
            abort(404)
        endpoint = "/superset/explore/?form_data={}".format(
            parse.quote(json.dumps({"slice_id": slice_id}))
        )
        param = utils.ReservedUrlParameters.STANDALONE.value
        if request.args.get(param) == "true":
            endpoint += f"&{param}=true"
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
        return self.json_response(
            {"data": viz_obj.get_df_payload()["df"].to_dict("records")}
        )

    def get_samples(self, viz_obj: BaseViz) -> FlaskResponse:
        return self.json_response({"data": viz_obj.get_samples()})

    def generate_json(
        self, viz_obj: BaseViz, response_type: Optional[str] = None
    ) -> FlaskResponse:
        if response_type == utils.ChartDataResultFormat.CSV:
            return CsvResponse(
                viz_obj.get_csv(),
                status=200,
                headers=generate_download_headers("csv"),
                mimetype="application/csv",
            )

        if response_type == utils.ChartDataResultType.QUERY:
            return self.get_query_string_response(viz_obj)

        if response_type == utils.ChartDataResultType.RESULTS:
            return self.get_raw_results(viz_obj)

        if response_type == utils.ChartDataResultType.SAMPLES:
            return self.get_samples(viz_obj)

        payload = viz_obj.get_payload()
        return data_payload_response(*viz_obj.payload_json_and_has_error(payload))

    @event_logger.log_this
    @api
    @has_access_api
    @expose("/slice_json/<int:slice_id>")
    @etag_cache(CACHE_DEFAULT_TIMEOUT, check_perms=check_slice_perms)
    def slice_json(self, slice_id: int) -> FlaskResponse:
        form_data, slc = get_form_data(slice_id, use_slice_data=True)
        if not slc:
            return json_error_response("The slice does not exist")
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

    @event_logger.log_this
    @api
    @has_access_api
    @expose("/annotation_json/<int:layer_id>")
    def annotation_json(  # pylint: disable=no-self-use
        self, layer_id: int
    ) -> FlaskResponse:
        form_data = get_form_data()[0]
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
        viz_obj = viz.viz_types["table"](datasource, form_data=form_data, force=False)
        payload = viz_obj.get_payload()
        return data_payload_response(*viz_obj.payload_json_and_has_error(payload))

    EXPLORE_JSON_METHODS = ["POST"]
    if not is_feature_enabled("ENABLE_EXPLORE_JSON_CSRF_PROTECTION"):
        EXPLORE_JSON_METHODS.append("GET")

    @event_logger.log_this
    @api
    @has_access_api
    @handle_api_exception
    @expose(
        "/explore_json/<datasource_type>/<int:datasource_id>/",
        methods=EXPLORE_JSON_METHODS,
    )
    @expose("/explore_json/", methods=EXPLORE_JSON_METHODS)
    @etag_cache(CACHE_DEFAULT_TIMEOUT, check_perms=check_datasource_perms)
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

        form_data = get_form_data()[0]

        try:
            datasource_id, datasource_type = get_datasource_info(
                datasource_id, datasource_type, form_data
            )

            viz_obj = get_viz(
                datasource_type=cast(str, datasource_type),
                datasource_id=datasource_id,
                form_data=form_data,
                force=request.args.get("force") == "true",
            )

            return self.generate_json(viz_obj, response_type)
        except SupersetException as ex:
            return json_error_response(utils.error_msg_from_exception(ex))

    @event_logger.log_this
    @has_access
    @expose("/import_dashboards", methods=["GET", "POST"])
    def import_dashboards(self) -> FlaskResponse:
        """Overrides the dashboards using json instances from the file."""
        f = request.files.get("file")
        if request.method == "POST" and f:
            try:
                dashboard_import_export.import_dashboards(db.session, f.stream)
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
            return redirect("/dashboard/list/")
        return self.render_template("superset/import_dashboards.html")

    @event_logger.log_this
    @has_access
    @expose("/explore/<datasource_type>/<int:datasource_id>/", methods=["GET", "POST"])
    @expose("/explore/", methods=["GET", "POST"])
    def explore(  # pylint: disable=too-many-locals,too-many-return-statements
        self, datasource_type: Optional[str] = None, datasource_id: Optional[int] = None
    ) -> FlaskResponse:
        user_id = g.user.get_id() if g.user else None
        form_data, slc = get_form_data(use_slice_data=True)

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

        error_redirect = "/chart/list/"
        try:
            datasource_id, datasource_type = get_datasource_info(
                datasource_id, datasource_type, form_data
            )
        except SupersetException:
            return redirect(error_redirect)

        datasource = ConnectorRegistry.get_datasource(
            cast(str, datasource_type), datasource_id, db.session
        )
        if not datasource:
            flash(DATASOURCE_MISSING_ERR, "danger")
            return redirect(error_redirect)

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
        if not viz_type and datasource.default_endpoint:
            return redirect(datasource.default_endpoint)

        # slc perms
        slice_add_perm = security_manager.can_access("can_add", "SliceModelView")
        slice_overwrite_perm = is_owner(slc, g.user) if slc else False
        slice_download_perm = security_manager.can_access(
            "can_download", "SliceModelView"
        )

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
                status=400,
            )

        if action == "saveas" and not slice_add_perm:
            return json_error_response(
                _("You don't have the rights to ") + _("create a ") + _("chart"),
                status=400,
            )

        if action in ("saveas", "overwrite"):
            return self.save_or_overwrite_slice(
                slc,
                slice_add_perm,
                slice_overwrite_perm,
                slice_download_perm,
                datasource_id,
                cast(str, datasource_type),
                datasource.name,
            )

        standalone = (
            request.args.get(utils.ReservedUrlParameters.STANDALONE.value) == "true"
        )
        bootstrap_data = {
            "can_add": slice_add_perm,
            "can_download": slice_download_perm,
            "can_overwrite": slice_overwrite_perm,
            "datasource": datasource.data,
            "form_data": form_data,
            "datasource_id": datasource_id,
            "datasource_type": datasource_type,
            "slice": slc.data if slc else None,
            "standalone": standalone,
            "user_id": user_id,
            "forced_height": request.args.get("height"),
            "common": common_bootstrap_payload(),
        }
        table_name = (
            datasource.table_name
            if datasource_type == "table"
            else datasource.datasource_name
        )
        if slc:
            title = slc.slice_name
        else:
            title = _("Explore - %(table)s", table=table_name)
        return self.render_template(
            "superset/basic.html",
            bootstrap_data=json.dumps(
                bootstrap_data, default=utils.pessimistic_json_iso_dttm_ser
            ),
            entry="explore",
            title=title,
            standalone_mode=standalone,
        )

    @api
    @handle_api_exception
    @has_access_api
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
            datasource_type, datasource_id, db.session
        )
        if not datasource:
            return json_error_response(DATASOURCE_MISSING_ERR)

        datasource.raise_for_access()
        payload = json.dumps(
            datasource.values_for_column(column, config["FILTER_SELECT_ROW_LIMIT"]),
            default=utils.json_int_dttm_ser,
            ignore_nan=True,
        )
        return json_success(payload)

    @staticmethod
    def remove_extra_filters(filters: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extra filters are ones inherited from the dashboard's temporary context
        Those should not be saved when saving the chart"""
        return [f for f in filters if not f.get("isExtra")]

    def save_or_overwrite_slice(  # pylint: disable=too-many-arguments,too-many-locals,no-self-use
        self,
        slc: Optional[Slice],
        slice_add_perm: bool,
        slice_overwrite_perm: bool,
        slice_download_perm: bool,
        datasource_id: int,
        datasource_type: str,
        datasource_name: str,
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
        slc.slice_name = slice_name

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

        if request.args.get("add_to_dash") == "existing":
            dash = cast(
                Dashboard,
                db.session.query(Dashboard)
                .filter_by(id=int(request.args["save_to_dashboard_id"]))
                .one(),
            )
            # check edit dashboard permissions
            dash_overwrite_perm = check_ownership(dash, raise_if_false=False)
            if not dash_overwrite_perm:
                return json_error_response(
                    _("You don't have the rights to ")
                    + _("alter this ")
                    + _("dashboard"),
                    status=400,
                )

            flash(
                _("Chart [{}] was added to dashboard [{}]").format(
                    slc.slice_name, dash.dashboard_title
                ),
                "info",
            )
        elif request.args.get("add_to_dash") == "new":
            # check create dashboard permissions
            dash_add_perm = security_manager.can_access("can_add", "DashboardModelView")
            if not dash_add_perm:
                return json_error_response(
                    _("You don't have the rights to ")
                    + _("create a ")
                    + _("dashboard"),
                    status=400,
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
            "can_overwrite": is_owner(slc, g.user),
            "form_data": slc.form_data,
            "slice": slc.data,
            "dashboard_id": dash.id if dash else None,
        }

        if dash and request.args.get("goto_dash") == "true":
            response.update({"dashboard": dash.url})

        return json_success(json.dumps(response))

    @api
    @has_access_api
    @expose("/schemas/<int:db_id>/")
    @expose("/schemas/<int:db_id>/<force_refresh>/")
    def schemas(  # pylint: disable=no-self-use
        self, db_id: int, force_refresh: str = "false"
    ) -> FlaskResponse:
        db_id = int(db_id)
        database = db.session.query(models.Database).get(db_id)
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
    @expose("/tables/<int:db_id>/<schema>/<substr>/")
    @expose("/tables/<int:db_id>/<schema>/<substr>/<force_refresh>/")
    def tables(  # pylint: disable=too-many-locals,no-self-use
        self, db_id: int, schema: str, substr: str, force_refresh: str = "false"
    ) -> FlaskResponse:
        """Endpoint to fetch the list of tables for given database"""
        # Guarantees database filtering by security access
        query = db.session.query(models.Database)
        query = DatabaseFilter("id", SQLAInterface(models.Database, db.session)).apply(
            query, None
        )
        database = query.filter_by(id=db_id).one_or_none()
        if not database:
            return json_error_response("Not found", 404)

        force_refresh_parsed = force_refresh.lower() == "true"
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

        if substr_parsed:
            tables = [tn for tn in tables if substr_parsed in get_datasource_label(tn)]
            views = [vn for vn in views if substr_parsed in get_datasource_label(vn)]

        if not schema_parsed and database.default_schemas:
            user_schema = g.user.email.split("@")[0]
            valid_schemas = set(database.default_schemas + [user_schema])

            tables = [tn for tn in tables if tn.schema in valid_schemas]
            views = [vn for vn in views if vn.schema in valid_schemas]

        max_items = config["MAX_TABLE_NAMES"] or len(tables)
        total_items = len(tables) + len(views)
        max_tables = len(tables)
        max_views = len(views)
        if total_items and substr_parsed:
            max_tables = max_items * len(tables) // total_items
            max_views = max_items * len(views) // total_items

        table_options = [
            {
                "value": tn.table,
                "schema": tn.schema,
                "label": get_datasource_label(tn),
                "title": get_datasource_label(tn),
                "type": "table",
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
    @expose("/copy_dash/<int:dashboard_id>/", methods=["GET", "POST"])
    def copy_dash(  # pylint: disable=no-self-use
        self, dashboard_id: int
    ) -> FlaskResponse:
        """Copy dashboard"""
        session = db.session()
        data = json.loads(request.form["data"])
        dash = models.Dashboard()
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
                    new_id = old_to_new_slice_ids[old_id]
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
    @expose("/save_dash/<int:dashboard_id>/", methods=["GET", "POST"])
    def save_dash(  # pylint: disable=no-self-use
        self, dashboard_id: int
    ) -> FlaskResponse:
        """Save a dashboard's metadata"""
        session = db.session()
        dash = session.query(Dashboard).get(dashboard_id)
        check_ownership(dash, raise_if_false=True)
        data = json.loads(request.form["data"])
        DashboardDAO.set_dash_metadata(dash, data)
        session.merge(dash)
        session.commit()
        session.close()
        return json_success(json.dumps({"status": "SUCCESS"}))

    @api
    @has_access_api
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
    @expose("/testconn", methods=["POST", "GET"])
    def testconn(  # pylint: disable=too-many-return-statements,no-self-use
        self,
    ) -> FlaskResponse:
        """Tests a sqla connection"""
        db_name = request.json.get("name")
        uri = request.json.get("uri")
        try:
            if app.config["PREVENT_UNSAFE_DB_CONNECTIONS"]:
                check_sqlalchemy_uri(uri)
            # if the database already exists in the database, only its safe
            # (password-masked) URI would be shown in the UI and would be passed in the
            # form data so if the database already exists and the form was submitted
            # with the safe URI, we assume we should retrieve the decrypted URI to test
            # the connection.
            if db_name:
                existing_database = (
                    db.session.query(models.Database)
                    .filter_by(database_name=db_name)
                    .one_or_none()
                )
                if existing_database and uri == existing_database.safe_sqlalchemy_uri():
                    uri = existing_database.sqlalchemy_uri_decrypted

            # this is the database instance that will be tested
            database = models.Database(
                # extras is sent as json, but required to be a string in the Database
                # model
                server_cert=request.json.get("server_cert"),
                extra=json.dumps(request.json.get("extras", {})),
                impersonate_user=request.json.get("impersonate_user"),
                encrypted_extra=json.dumps(request.json.get("encrypted_extra", {})),
            )
            database.set_sqlalchemy_uri(uri)
            database.db_engine_spec.mutate_db_for_connection_test(database)

            username = g.user.username if g.user is not None else None
            engine = database.get_sqla_engine(user_name=username)

            with closing(engine.connect()) as conn:
                conn.scalar(select([1]))
                return json_success('"OK"')
        except CertificateException as ex:
            logger.info(ex.message)
            return json_error_response(ex.message)
        except (NoSuchModuleError, ModuleNotFoundError) as ex:
            logger.info("Invalid driver %s", ex)
            driver_name = make_url(uri).drivername
            return json_error_response(
                _(
                    "Could not load database driver: %(driver_name)s",
                    driver_name=driver_name,
                ),
                400,
            )
        except ArgumentError as ex:
            logger.info("Invalid URI %s", ex)
            return json_error_response(
                _(
                    "Invalid connection string, a valid string usually follows:\n"
                    "'DRIVER://USER:PASSWORD@DB-HOST/DATABASE-NAME'"
                )
            )
        except OperationalError as ex:
            logger.warning("Connection failed %s", ex)
            return json_error_response(
                _("Connection failed, please check your connection settings."), 400
            )
        except DBSecurityException as ex:
            logger.warning("Stopped an unsafe database connection. %s", ex)
            return json_error_response(_(str(ex)), 400)
        except Exception as ex:  # pylint: disable=broad-except
            logger.error("Unexpected error %s", ex)
            return json_error_response(
                _("Unexpected error occurred, please check your logs for details"), 400
            )

    @api
    @has_access_api
    @expose("/recent_activity/<int:user_id>/", methods=["GET"])
    def recent_activity(  # pylint: disable=no-self-use
        self, user_id: int
    ) -> FlaskResponse:
        """Recent activity (actions) for a given user"""
        if request.args.get("limit"):
            limit = int(request.args["limit"])
        else:
            limit = 1000

        qry = (
            db.session.query(models.Log, models.Dashboard, Slice)
            .outerjoin(models.Dashboard, models.Dashboard.id == models.Log.dashboard_id)
            .outerjoin(Slice, Slice.id == models.Log.slice_id)
            .filter(
                and_(
                    ~models.Log.action.in_(("queries", "shortner", "sql_json")),
                    models.Log.user_id == user_id,
                )
            )
            .order_by(models.Log.dttm.desc())
            .limit(limit)
        )
        payload = []
        for log in qry.all():
            item_url = None
            item_title = None
            if log.Dashboard:
                item_url = log.Dashboard.url
                item_title = log.Dashboard.dashboard_title
            elif log.Slice:
                item_url = log.Slice.slice_url
                item_title = log.Slice.slice_name

            payload.append(
                {
                    "action": log.Log.action,
                    "item_url": item_url,
                    "item_title": item_title,
                    "time": log.Log.dttm,
                }
            )
        return json_success(json.dumps(payload, default=utils.json_int_dttm_ser))

    @api
    @has_access_api
    @expose("/csrf_token/", methods=["GET"])
    def csrf_token(self) -> FlaskResponse:
        return Response(
            self.render_template("superset/csrf_token.json"), mimetype="text/json"
        )

    @api
    @has_access_api
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
    @expose("/fave_dashboards_by_username/<username>/", methods=["GET"])
    def fave_dashboards_by_username(self, username: str) -> FlaskResponse:
        """This lets us use a user's username to pull favourite dashboards"""
        user = security_manager.find_user(username=username)
        return self.fave_dashboards(user.get_id())

    @api
    @has_access_api
    @expose("/fave_dashboards/<int:user_id>/", methods=["GET"])
    def fave_dashboards(  # pylint: disable=no-self-use
        self, user_id: int
    ) -> FlaskResponse:
        qry = (
            db.session.query(Dashboard, models.FavStar.dttm)
            .join(
                models.FavStar,
                and_(
                    models.FavStar.user_id == int(user_id),
                    models.FavStar.class_name == "Dashboard",
                    Dashboard.id == models.FavStar.obj_id,
                ),
            )
            .order_by(models.FavStar.dttm.desc())
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
    @expose("/created_dashboards/<int:user_id>/", methods=["GET"])
    def created_dashboards(  # pylint: disable=no-self-use
        self, user_id: int
    ) -> FlaskResponse:
        Dash = Dashboard
        qry = (
            db.session.query(Dash)
            .filter(
                or_(  # pylint: disable=comparison-with-callable
                    Dash.created_by_fk == user_id, Dash.changed_by_fk == user_id
                )
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
    @expose("/user_slices", methods=["GET"])
    @expose("/user_slices/<int:user_id>/", methods=["GET"])
    def user_slices(  # pylint: disable=no-self-use
        self, user_id: Optional[int] = None
    ) -> FlaskResponse:
        """List of slices a user owns, created, modified or faved"""
        if not user_id:
            user_id = g.user.id
        FavStar = models.FavStar

        owner_ids_query = (
            db.session.query(Slice.id)
            .join(Slice.owners)
            .filter(security_manager.user_model.id == user_id)
        )

        qry = (
            db.session.query(Slice, FavStar.dttm)
            .join(
                models.FavStar,
                and_(
                    models.FavStar.user_id == user_id,
                    models.FavStar.class_name == "slice",
                    Slice.id == models.FavStar.obj_id,
                ),
                isouter=True,
            )
            .filter(
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
    @expose("/created_slices", methods=["GET"])
    @expose("/created_slices/<int:user_id>/", methods=["GET"])
    def created_slices(  # pylint: disable=no-self-use
        self, user_id: Optional[int] = None
    ) -> FlaskResponse:
        """List of slices created by this user"""
        if not user_id:
            user_id = g.user.id
        qry = (
            db.session.query(Slice)
            .filter(or_(Slice.created_by_fk == user_id, Slice.changed_by_fk == user_id))
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
    @expose("/fave_slices", methods=["GET"])
    @expose("/fave_slices/<int:user_id>/", methods=["GET"])
    def fave_slices(  # pylint: disable=no-self-use
        self, user_id: Optional[int] = None
    ) -> FlaskResponse:
        """Favorite slices for a user"""
        if not user_id:
            user_id = g.user.id
        qry = (
            db.session.query(Slice, models.FavStar.dttm)
            .join(
                models.FavStar,
                and_(
                    models.FavStar.user_id == user_id,
                    models.FavStar.class_name == "slice",
                    Slice.id == models.FavStar.obj_id,
                ),
            )
            .order_by(models.FavStar.dttm.desc())
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
        """
        session = db.session()
        slice_id = request.args.get("slice_id")
        dashboard_id = request.args.get("dashboard_id")
        table_name = request.args.get("table_name")
        db_name = request.args.get("db_name")

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
                .join(models.Database)
                .filter(
                    models.Database.database_name == db_name
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
                    form_data["extra_filters"] = get_dashboard_extra_filters(
                        slc.id, dashboard_id
                    )

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
    @expose("/favstar/<class_name>/<int:obj_id>/<action>/")
    def favstar(  # pylint: disable=no-self-use
        self, class_name: str, obj_id: int, action: str
    ) -> FlaskResponse:
        """Toggle favorite stars on Slices and Dashboard"""
        session = db.session()
        FavStar = models.FavStar
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
    @expose("/dashboard/<int:dashboard_id>/published/", methods=("GET", "POST"))
    def publish(  # pylint: disable=no-self-use
        self, dashboard_id: int
    ) -> FlaskResponse:
        """Gets and toggles published status on dashboards"""
        logger.warning(
            "This API endpoint is deprecated and will be removed in version 1.0.0"
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
            return json_error_response(
                f'ERROR: "{g.user.username}" cannot alter '
                f'dashboard "{dash.dashboard_title}"',
                status=403,
            )

        dash.published = str(request.form["published"]).lower() == "true"
        session.commit()
        return json_success(json.dumps({"published": dash.published}))

    @has_access
    @expose("/dashboard/<dashboard_id_or_slug>/")
    def dashboard(  # pylint: disable=too-many-locals
        self, dashboard_id_or_slug: str
    ) -> FlaskResponse:
        """Server side rendering for a dashboard"""
        session = db.session()
        qry = session.query(Dashboard)
        if dashboard_id_or_slug.isdigit():
            qry = qry.filter_by(id=int(dashboard_id_or_slug))
        else:
            qry = qry.filter_by(slug=dashboard_id_or_slug)

        dash = qry.one_or_none()
        if not dash:
            abort(404)

        datasources = defaultdict(list)
        for slc in dash.slices:
            datasource = slc.datasource
            if datasource:
                datasources[datasource].append(slc)

        if config["ENABLE_ACCESS_REQUEST"]:
            for datasource in datasources:
                if datasource and not security_manager.can_access_datasource(
                    datasource
                ):
                    flash(
                        __(
                            security_manager.get_datasource_access_error_msg(datasource)
                        ),
                        "danger",
                    )
                    return redirect(
                        "superset/request_access/?" f"dashboard_id={dash.id}&"
                    )

        # Filter out unneeded fields from the datasource payload
        datasources_payload = {
            datasource.uid: datasource.data_for_slices(slices)
            if is_feature_enabled("REDUCE_DASHBOARD_BOOTSTRAP_PAYLOAD")
            else datasource.data
            for datasource, slices in datasources.items()
        }

        dash_edit_perm = check_ownership(
            dash, raise_if_false=False
        ) and security_manager.can_access("can_save_dash", "Superset")
        dash_save_perm = security_manager.can_access("can_save_dash", "Superset")
        superset_can_explore = security_manager.can_access("can_explore", "Superset")
        superset_can_csv = security_manager.can_access("can_csv", "Superset")
        slice_can_edit = security_manager.can_access("can_edit", "SliceModelView")

        standalone_mode = (
            request.args.get(utils.ReservedUrlParameters.STANDALONE.value) == "true"
        )
        edit_mode = (
            request.args.get(utils.ReservedUrlParameters.EDIT_MODE.value) == "true"
        )

        # Hack to log the dashboard_id properly, even when getting a slug
        @event_logger.log_this
        def dashboard(**_: Any) -> None:
            pass

        dashboard(
            dashboard_id=dash.id,
            dashboard_version="v2",
            dash_edit_perm=dash_edit_perm,
            edit_mode=edit_mode,
        )

        dashboard_data = dash.data
        dashboard_data.update(
            {
                "standalone_mode": standalone_mode,
                "dash_save_perm": dash_save_perm,
                "dash_edit_perm": dash_edit_perm,
                "superset_can_explore": superset_can_explore,
                "superset_can_csv": superset_can_csv,
                "slice_can_edit": slice_can_edit,
            }
        )
        url_params = {
            key: value
            for key, value in request.args.items()
            if key not in [param.value for param in utils.ReservedUrlParameters]
        }

        bootstrap_data = {
            "user_id": g.user.get_id(),
            "dashboard_data": dashboard_data,
            "datasources": datasources_payload,
            "common": common_bootstrap_payload(),
            "editMode": edit_mode,
            "urlParams": url_params,
        }

        if request.args.get("json") == "true":
            return json_success(
                json.dumps(bootstrap_data, default=utils.pessimistic_json_iso_dttm_ser)
            )

        return self.render_template(
            "superset/dashboard.html",
            entry="dashboard",
            standalone_mode=standalone_mode,
            title=dash.dashboard_title,
            bootstrap_data=json.dumps(
                bootstrap_data, default=utils.pessimistic_json_iso_dttm_ser
            ),
        )

    @api
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
            logger.error(err_msg)
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
            logger.error(err_msg)
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
        """ Gets or creates a table object with attributes passed to the API.

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
                    db.session.query(models.Database).filter_by(id=database_id).one()
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
        table_name = data["datasourceName"]
        database_id = data["dbId"]
        table = (
            db.session.query(SqlaTable)
            .filter_by(database_id=database_id, table_name=table_name)
            .one_or_none()
        )
        if not table:
            table = SqlaTable(table_name=table_name, owners=[g.user])
        table.database_id = database_id
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
        mydb = db.session.query(models.Database).filter_by(id=database_id).one()
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
            "This API endpoint is deprecated and will be removed in version 1.0.0",
            self.__class__.__name__,
        )
        stats_logger.incr(f"{self.__class__.__name__}.select_star.init")
        database = db.session.query(models.Database).get(database_id)
        if not database:
            stats_logger.incr(
                f"deprecated.{self.__class__.__name__}.select_star.database_not_found"
            )
            return json_error_response("Not found", 404)
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
            return json_error_response("Not found", 404)
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
        mydb = db.session.query(models.Database).get(database_id)

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
            return json_error_response(timeout_msg)
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
            return json_error_response("Results backend isn't configured")

        read_from_results_backend_start = now_as_float()
        blob = results_backend.get(key)
        stats_logger.timing(
            "sqllab.query.results_backend_read",
            now_as_float() - read_from_results_backend_start,
        )
        if not blob:
            return json_error_response(
                "Data could not be retrieved. " "You may want to re-run the query.",
                status=410,
            )

        query = db.session.query(Query).filter_by(results_key=key).one_or_none()
        if query is None:
            return json_error_response(
                "Data could not be retrieved. You may want to re-run the query.",
                status=404,
            )

        try:
            query.raise_for_access()
        except SupersetSecurityException as ex:
            return json_errors_response([ex.error], status=403)

        payload = utils.zlib_decompress(blob, decode=not results_backend_use_msgpack)
        obj = _deserialize_results_payload(
            payload, query, cast(bool, results_backend_use_msgpack)
        )

        if "rows" in request.args:
            try:
                rows = int(request.args["rows"])
            except ValueError:
                return json_error_response("Invalid `rows` argument", status=400)
            obj = apply_display_max_row_limit(obj, rows)

        return json_success(
            json.dumps(obj, default=utils.json_iso_dttm_ser, ignore_nan=True)
        )

    @has_access_api
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
            logger.error(
                "Query with client_id %s could not be stopped: "
                "query already complete",
                str(client_id),
            )
            return self.json_response("OK")
        query.status = QueryStatus.STOPPED
        db.session.commit()

        return self.json_response("OK")

    @has_access_api
    @expose("/validate_sql_json/", methods=["POST", "GET"])
    @event_logger.log_this
    def validate_sql_json(  # pylint: disable=too-many-locals,too-many-return-statements,no-self-use
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
        mydb = session.query(models.Database).filter_by(id=database_id).one_or_none()
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

    @staticmethod
    def _sql_json_async(  # pylint: disable=too-many-arguments
        session: Session,
        rendered_query: str,
        query: Query,
        expand_data: bool,
        log_params: Optional[Dict[str, Any]] = None,
    ) -> FlaskResponse:
        """
        Send SQL JSON query to celery workers.

        :param session: SQLAlchemy session object
        :param rendered_query: the rendered query to perform by workers
        :param query: The query (SQLAlchemy) object
        :return: A Flask Response
        """
        logger.info("Query %i: Running query on a Celery worker", query.id)
        # Ignore the celery future object and the request may time out.
        try:
            sql_lab.get_sql_results.delay(
                query.id,
                rendered_query,
                return_results=False,
                store_results=not query.select_as_cta,
                user_name=g.user.username if g.user else None,
                start_time=now_as_float(),
                expand_data=expand_data,
                log_params=log_params,
            )
        except Exception as ex:  # pylint: disable=broad-except
            logger.exception("Query %i: %s", query.id, str(ex))
            msg = _(
                "Failed to start remote query on a worker. "
                "Tell your administrator to verify the availability of "
                "the message queue."
            )
            query.status = QueryStatus.FAILED
            query.error_message = msg
            session.commit()
            return json_error_response("{}".format(msg))
        resp = json_success(
            json.dumps(
                {"query": query.to_dict()},
                default=utils.json_int_dttm_ser,
                ignore_nan=True,
            ),
            status=202,
        )
        session.commit()
        return resp

    @staticmethod
    def _sql_json_sync(
        _session: Session,
        rendered_query: str,
        query: Query,
        expand_data: bool,
        log_params: Optional[Dict[str, Any]] = None,
    ) -> FlaskResponse:
        """
        Execute SQL query (sql json).

        :param rendered_query: The rendered query (included templates)
        :param query: The query SQL (SQLAlchemy) object
        :return: A Flask Response
        """
        try:
            timeout = config["SQLLAB_TIMEOUT"]
            timeout_msg = f"The query exceeded the {timeout} seconds timeout."
            store_results = (
                is_feature_enabled("SQLLAB_BACKEND_PERSISTENCE")
                and not query.select_as_cta
            )
            with utils.timeout(seconds=timeout, error_message=timeout_msg):
                # pylint: disable=no-value-for-parameter
                data = sql_lab.get_sql_results(
                    query.id,
                    rendered_query,
                    return_results=True,
                    store_results=store_results,
                    user_name=g.user.username if g.user else None,
                    expand_data=expand_data,
                    log_params=log_params,
                )

            payload = json.dumps(
                apply_display_max_row_limit(data),
                default=utils.pessimistic_json_iso_dttm_ser,
                ignore_nan=True,
                encoding=None,
            )
        except Exception as ex:  # pylint: disable=broad-except
            logger.exception("Query %i: %s", query.id, str(ex))
            return json_error_response(utils.error_msg_from_exception(ex))
        if data.get("status") == QueryStatus.FAILED:
            return json_error_response(payload=data)
        return json_success(payload)

    @has_access_api
    @expose("/sql_json/", methods=["POST"])
    @event_logger.log_this
    def sql_json(self) -> FlaskResponse:
        log_params = {
            "user_agent": cast(Optional[str], request.headers.get("USER_AGENT"))
        }
        return self.sql_json_exec(request.json, log_params)

    def sql_json_exec(  # pylint: disable=too-many-statements,too-many-locals
        self, query_params: Dict[str, Any], log_params: Optional[Dict[str, Any]] = None
    ) -> FlaskResponse:
        """Runs arbitrary sql and returns data as json"""
        # Collect Values
        database_id: int = cast(int, query_params.get("database_id"))
        schema: str = cast(str, query_params.get("schema"))
        sql: str = cast(str, query_params.get("sql"))
        try:
            template_params = json.loads(query_params.get("templateParams") or "{}")
        except json.JSONDecodeError:
            logger.warning(
                "Invalid template parameter %s" " specified. Defaulting to empty dict",
                str(query_params.get("templateParams")),
            )
            template_params = {}
        limit: int = query_params.get("queryLimit") or app.config["SQL_MAX_ROW"]
        async_flag: bool = cast(bool, query_params.get("runAsync"))
        if limit < 0:
            logger.warning(
                "Invalid limit of %i specified. Defaulting to max limit.", limit
            )
            limit = 0
        select_as_cta: bool = cast(bool, query_params.get("select_as_cta"))
        ctas_method: CtasMethod = cast(
            CtasMethod, query_params.get("ctas_method", CtasMethod.TABLE)
        )
        tmp_table_name: str = cast(str, query_params.get("tmp_table_name"))
        client_id: str = cast(
            str, query_params.get("client_id") or utils.shortid()[:10]
        )
        sql_editor_id: str = cast(str, query_params.get("sql_editor_id"))
        tab_name: str = cast(str, query_params.get("tab"))
        status: str = QueryStatus.PENDING if async_flag else QueryStatus.RUNNING

        session = db.session()
        mydb = session.query(models.Database).get(database_id)
        if not mydb:
            return json_error_response("Database with id %i is missing.", database_id)

        # Set tmp_schema_name for CTA
        # TODO(bkyryliuk): consider parsing, splitting tmp_schema_name from
        #  tmp_table_name if user enters
        # <schema_name>.<table_name>
        tmp_schema_name: Optional[str] = schema
        if select_as_cta and mydb.force_ctas_schema:
            tmp_schema_name = mydb.force_ctas_schema
        elif select_as_cta:
            tmp_schema_name = get_cta_schema_name(mydb, g.user, schema, sql)

        # Save current query
        query = Query(
            database_id=database_id,
            sql=sql,
            schema=schema,
            select_as_cta=select_as_cta,
            ctas_method=ctas_method,
            start_time=now_as_float(),
            tab_name=tab_name,
            status=status,
            sql_editor_id=sql_editor_id,
            tmp_table_name=tmp_table_name,
            tmp_schema_name=tmp_schema_name,
            user_id=g.user.get_id() if g.user else None,
            client_id=client_id,
        )
        try:
            session.add(query)
            session.flush()
            query_id = query.id
            session.commit()  # shouldn't be necessary
        except SQLAlchemyError as ex:
            logger.error("Errors saving query details %s", str(ex))
            session.rollback()
            raise Exception(_("Query record was not created as expected."))
        if not query_id:
            raise Exception(_("Query record was not created as expected."))

        logger.info("Triggering query_id: %i", query_id)

        try:
            query.raise_for_access()
        except SupersetSecurityException as ex:
            query.status = QueryStatus.FAILED
            session.commit()
            return json_errors_response([ex.error], status=403)

        try:
            template_processor = get_template_processor(
                database=query.database, query=query
            )
            rendered_query = template_processor.process_template(
                query.sql, **template_params
            )
        except Exception as ex:  # pylint: disable=broad-except
            error_msg = utils.error_msg_from_exception(ex)
            return json_error_response(
                f"Query {query_id}: Template rendering failed: {error_msg}"
            )

        # Limit is not applied to the CTA queries if SQLLAB_CTAS_NO_LIMIT flag is set
        # to True.
        if not (config.get("SQLLAB_CTAS_NO_LIMIT") and select_as_cta):
            # set LIMIT after template processing
            limits = [mydb.db_engine_spec.get_limit_from_sql(rendered_query), limit]
            query.limit = min(lim for lim in limits if lim is not None)

        # Flag for whether or not to expand data
        # (feature that will expand Presto row objects and arrays)
        expand_data: bool = cast(
            bool,
            is_feature_enabled("PRESTO_EXPAND_DATA")
            and query_params.get("expand_data"),
        )

        # Async request.
        if async_flag:
            return self._sql_json_async(
                session, rendered_query, query, expand_data, log_params
            )
        # Sync request.
        return self._sql_json_sync(
            session, rendered_query, query, expand_data, log_params
        )

    @has_access
    @expose("/csv/<client_id>")
    @event_logger.log_this
    def csv(self, client_id: str) -> FlaskResponse:  # pylint: disable=no-self-use
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
            csv = df.to_csv(index=False, **config["CSV_EXPORT"])
        else:
            logger.info("Running a query to turn into CSV")
            sql = query.select_sql or query.executed_sql
            df = query.database.get_df(sql, query.schema)
            # TODO(bkyryliuk): add compression=gzip for big files.
            csv = df.to_csv(index=False, **config["CSV_EXPORT"])
        response = Response(csv, mimetype="text/csv")
        response.headers[
            "Content-Disposition"
        ] = f"attachment; filename={query.name}.csv"
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
        logger.info("CSV exported: %s", event_rep, extra={"superset_event": event_info})
        return response

    @api
    @handle_api_exception
    @has_access
    @expose("/fetch_datasource_metadata")
    @event_logger.log_this
    def fetch_datasource_metadata(self) -> FlaskResponse:  # pylint: disable=no-self-use
        """
        Fetch the datasource metadata.

        :returns: The Flask response
        :raises SupersetSecurityException: If the user cannot access the resource
        """

        datasource_id, datasource_type = request.args["datasourceKey"].split("__")
        datasource = ConnectorRegistry.get_datasource(
            datasource_type, datasource_id, db.session
        )
        # Check if datasource exists
        if not datasource:
            return json_error_response(DATASOURCE_MISSING_ERR)

        datasource.raise_for_access()
        return json_success(json.dumps(datasource.data))

    @has_access_api
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
    @expose("/search_queries")
    @event_logger.log_this
    def search_queries(self) -> FlaskResponse:  # pylint: disable=no-self-use
        """
        Search for previously run sqllab queries. Used for Sqllab Query Search
        page /superset/sqllab#search.

        Custom permission can_only_search_queries_owned restricts queries
        to only queries run by current user.

        :returns: Response with list of sql query dicts
        """
        query = db.session.query(Query)
        if security_manager.can_access_all_queries():
            search_user_id = request.args.get("user_id")
        elif (
            request.args.get("user_id") is not None
            and request.args.get("user_id") != g.user.get_user_id()
        ):
            return Response(status=403, mimetype="application/json")
        else:
            search_user_id = g.user.get_user_id()
        database_id = request.args.get("database_id")
        search_text = request.args.get("search_text")
        status = request.args.get("status")
        # From and To time stamp should be Epoch timestamp in seconds
        from_time = request.args.get("from")
        to_time = request.args.get("to")

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
            query = query.filter(Query.sql.like("%{}%".format(search_text)))

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

    @expose("/welcome")
    def welcome(self) -> FlaskResponse:
        """Personalized welcome page"""
        if not g.user or not g.user.get_id():
            return redirect(appbuilder.get_url_for_login)

        welcome_dashboard_id = (
            db.session.query(UserAttribute.welcome_dashboard_id)
            .filter_by(user_id=g.user.get_id())
            .scalar()
        )
        if welcome_dashboard_id:
            return self.dashboard(str(welcome_dashboard_id))

        payload = {
            "user": bootstrap_user_data(g.user),
            "common": common_bootstrap_payload(),
        }

        return self.render_template(
            "superset/welcome.html",
            entry="welcome",
            bootstrap_data=json.dumps(
                payload, default=utils.pessimistic_json_iso_dttm_ser
            ),
        )

    @has_access
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
            title=_("%(user)s's profile", user=username),
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
        queries: Dict[str, Any] = {}

        # These are unnecessary if sqllab backend persistence is disabled
        if is_feature_enabled("SQLLAB_BACKEND_PERSISTENCE"):
            databases = {
                database.id: {
                    k: v for k, v in database.to_json().items() if k in DATABASE_KEYS
                }
                for database in db.session.query(models.Database).all()
            }
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
    @expose("/sqllab", methods=["GET", "POST"])
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
        bootstrap_data = json.dumps(
            payload, default=utils.pessimistic_json_iso_dttm_ser
        )

        return self.render_template(
            "superset/basic.html", entry="sqllab", bootstrap_data=bootstrap_data
        )

    @api
    @has_access_api
    @expose("/schemas_access_for_csv_upload")
    def schemas_access_for_csv_upload(self) -> FlaskResponse:
        """
        This method exposes an API endpoint to
        get the schema access control settings for csv upload in this database
        """
        if not request.args.get("db_id"):
            return json_error_response("No database is allowed for your csv upload")

        db_id = int(request.args["db_id"])
        database = db.session.query(models.Database).filter_by(id=db_id).one()
        try:
            schemas_allowed = database.get_schema_access_for_csv_upload()
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
