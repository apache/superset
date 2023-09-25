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
from datetime import datetime
from typing import Any, Callable, cast
from urllib import parse

import simplejson as json
from flask import abort, flash, g, redirect, render_template, request, Response
from flask_appbuilder import expose
from flask_appbuilder.security.decorators import (
    has_access,
    has_access_api,
    permission_name,
)
from flask_babel import gettext as __, lazy_gettext as _
from sqlalchemy.exc import SQLAlchemyError

from superset import (
    app,
    appbuilder,
    conf,
    db,
    event_logger,
    is_feature_enabled,
    security_manager,
)
from superset.charts.commands.exceptions import ChartNotFoundError
from superset.charts.commands.warm_up_cache import ChartWarmUpCacheCommand
from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.connectors.base.models import BaseDatasource
from superset.connectors.sqla.models import SqlaTable
from superset.daos.chart import ChartDAO
from superset.daos.database import DatabaseDAO
from superset.daos.datasource import DatasourceDAO
from superset.dashboards.commands.importers.v0 import ImportDashboardsCommand
from superset.dashboards.permalink.commands.get import GetDashboardPermalinkCommand
from superset.dashboards.permalink.exceptions import DashboardPermalinkGetFailedError
from superset.datasets.commands.exceptions import DatasetNotFoundError
from superset.exceptions import (
    CacheLoadError,
    DatabaseNotFound,
    SupersetException,
    SupersetSecurityException,
)
from superset.explore.form_data.commands.create import CreateFormDataCommand
from superset.explore.form_data.commands.get import GetFormDataCommand
from superset.explore.form_data.commands.parameters import CommandParameters
from superset.explore.permalink.commands.get import GetExplorePermalinkCommand
from superset.explore.permalink.exceptions import ExplorePermalinkGetFailedError
from superset.extensions import async_query_manager, cache_manager
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.models.sql_lab import Query, TabState
from superset.models.user_attributes import UserAttribute
from superset.superset_typing import FlaskResponse
from superset.tasks.async_queries import load_explore_json_into_cache
from superset.utils import core as utils
from superset.utils.async_query_manager import AsyncQueryTokenException
from superset.utils.cache import etag_cache
from superset.utils.core import (
    base_json_conv,
    DatasourceType,
    get_user_id,
    get_username,
    ReservedUrlParameters,
)
from superset.views.base import (
    api,
    BaseSupersetView,
    common_bootstrap_payload,
    CsvResponse,
    data_payload_response,
    deprecated,
    generate_download_headers,
    get_error_msg,
    handle_api_exception,
    json_error_response,
    json_success,
)
from superset.views.utils import (
    bootstrap_user_data,
    check_datasource_perms,
    check_explore_cache_perms,
    check_resource_permissions,
    get_datasource_info,
    get_form_data,
    get_viz,
    loads_request_json,
    redirect_with_flash,
    sanitize_datasource_data,
)
from superset.viz import BaseViz

config = app.config
SQLLAB_QUERY_COST_ESTIMATE_TIMEOUT = config["SQLLAB_QUERY_COST_ESTIMATE_TIMEOUT"]
stats_logger = config["STATS_LOGGER"]
logger = logging.getLogger(__name__)

DATABASE_KEYS = [
    "allow_file_upload",
    "allow_ctas",
    "allow_cvas",
    "allow_dml",
    "allow_run_async",
    "allows_subquery",
    "backend",
    "database_name",
    "expose_in_sqllab",
    "force_ctas_schema",
    "id",
    "disable_data_preview",
]

DATASOURCE_MISSING_ERR = __("The data source seems to have been deleted")
USER_MISSING_ERR = __("The user seems to have been deleted")
PARAMETER_MISSING_ERR = __(
    "Please check your template parameters for syntax errors and make sure "
    "they match across your SQL query and Set Parameters. Then, try running "
    "your query again."
)

SqlResults = dict[str, Any]


class Superset(BaseSupersetView):  # pylint: disable=too-many-public-methods
    """The base views for Superset!"""

    logger = logging.getLogger(__name__)

    @has_access
    @event_logger.log_this
    @expose("/slice/<int:slice_id>/")
    def slice(self, slice_id: int) -> FlaskResponse:  # pylint: disable=no-self-use
        _, slc = get_form_data(slice_id, use_slice_data=True)
        if not slc:
            abort(404)
        endpoint = "/explore/?form_data={}".format(
            parse.quote(json.dumps({"slice_id": slice_id}))
        )

        is_standalone_mode = ReservedUrlParameters.is_standalone_mode()
        if is_standalone_mode:
            endpoint += f"&{ReservedUrlParameters.STANDALONE}=true"
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
        return self.json_response(
            {
                "data": payload["df"].to_dict("records"),
                "colnames": payload.get("colnames"),
                "coltypes": payload.get("coltypes"),
            },
        )

    def get_samples(self, viz_obj: BaseViz) -> FlaskResponse:
        return self.json_response(viz_obj.get_samples())

    @staticmethod
    def send_data_payload_response(viz_obj: BaseViz, payload: Any) -> FlaskResponse:
        return data_payload_response(*viz_obj.payload_json_and_has_error(payload))

    def generate_json(
        self, viz_obj: BaseViz, response_type: str | None = None
    ) -> FlaskResponse:
        if response_type == ChartDataResultFormat.CSV:
            return CsvResponse(
                viz_obj.get_csv(), headers=generate_download_headers("csv")
            )

        if response_type == ChartDataResultType.QUERY:
            return self.get_query_string_response(viz_obj)

        if response_type == ChartDataResultType.RESULTS:
            return self.get_raw_results(viz_obj)

        if response_type == ChartDataResultType.SAMPLES:
            return self.get_samples(viz_obj)

        payload = viz_obj.get_payload()
        return self.send_data_payload_response(viz_obj, payload)

    @event_logger.log_this
    @api
    @has_access_api
    @handle_api_exception
    @permission_name("explore_json")
    @expose("/explore_json/data/<cache_key>", methods=("GET",))
    @check_resource_permissions(check_explore_cache_perms)
    @deprecated(eol_version="4.0.0")
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
            # Set form_data in Flask Global as it is used as a fallback
            # for async queries with jinja context
            setattr(g, "form_data", form_data)
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
    @deprecated(eol_version="4.0.0")
    def explore_json(
        self, datasource_type: str | None = None, datasource_id: int | None = None
    ) -> FlaskResponse:
        """Serves all request that GET or POST form_data

        This endpoint evolved to be the entry point of many different
        requests that GETs or POSTs a form_data.

        `self.generate_json` receives this input and returns different
        payloads based on the request args in the first block

        TODO: break into one endpoint for each return shape"""

        response_type = ChartDataResultFormat.JSON.value
        responses: list[ChartDataResultFormat | ChartDataResultType] = list(
            ChartDataResultFormat
        )
        responses.extend(list(ChartDataResultType))
        for response_option in responses:
            if request.args.get(response_option) == "true":
                response_type = response_option
                break

        # Verify user has permission to export CSV file
        if (
            response_type == ChartDataResultFormat.CSV
            and not security_manager.can_access("can_csv", "Superset")
        ):
            return json_error_response(
                _("You don't have the rights to download as csv"),
                status=403,
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
                and response_type == ChartDataResultFormat.JSON
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
                    # If the chart query has already been cached, return it immediately.
                    if payload is not None:
                        return self.send_data_payload_response(viz_obj, payload)
                except CacheLoadError:
                    pass

                # Otherwise, kick off a background job to run the chart query.
                # Clients will either poll or be notified of query completion,
                # at which point they will call the /explore_json/data/<cache_key>
                # endpoint to retrieve the results.
                try:
                    async_channel_id = async_query_manager.parse_jwt_from_request(
                        request
                    )["channel"]
                    job_metadata = async_query_manager.init_job(
                        async_channel_id, get_user_id()
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
    @expose(
        "/import_dashboards/",
        methods=(
            "GET",
            "POST",
        ),
    )
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

    @staticmethod
    def get_redirect_url() -> str:
        """Assembles the redirect URL to the new endpoint. It also replaces
        the form_data param with a form_data_key by saving the original content
        to the cache layer.
        """
        redirect_url = request.url.replace("/superset/explore", "/explore")
        form_data_key = None
        if request_form_data := request.args.get("form_data"):
            parsed_form_data = loads_request_json(request_form_data)
            slice_id = parsed_form_data.get(
                "slice_id", int(request.args.get("slice_id", 0))
            )
            datasource = parsed_form_data.get("datasource")
            if datasource:
                datasource_id, datasource_type = datasource.split("__")
                parameters = CommandParameters(
                    datasource_id=datasource_id,
                    datasource_type=datasource_type,
                    chart_id=slice_id,
                    form_data=request_form_data,
                )
                form_data_key = CreateFormDataCommand(parameters).run()
        if form_data_key:
            url = parse.urlparse(redirect_url)
            query = parse.parse_qs(url.query)
            query.pop("form_data")
            query["form_data_key"] = [form_data_key]
            url = url._replace(query=parse.urlencode(query, True))
            redirect_url = parse.urlunparse(url)

        # Return a relative URL
        url = parse.urlparse(redirect_url)
        if url.query:
            return f"{url.path}?{url.query}"
        return url.path

    @has_access
    @event_logger.log_this
    @expose(
        "/explore/<datasource_type>/<int:datasource_id>/",
        methods=(
            "GET",
            "POST",
        ),
    )
    @expose(
        "/explore/",
        methods=(
            "GET",
            "POST",
        ),
    )
    @deprecated()
    # pylint: disable=too-many-locals,too-many-branches,too-many-statements
    def explore(
        self,
        datasource_type: str | None = None,
        datasource_id: int | None = None,
        key: str | None = None,
    ) -> FlaskResponse:
        if request.method == "GET":
            return redirect(Superset.get_redirect_url())

        initial_form_data = {}

        form_data_key = request.args.get("form_data_key")
        if key is not None:
            command = GetExplorePermalinkCommand(key)
            try:
                permalink_value = command.run()
                if permalink_value:
                    state = permalink_value["state"]
                    initial_form_data = state["formData"]
                    url_params = state.get("urlParams")
                    if url_params:
                        initial_form_data["url_params"] = dict(url_params)
                else:
                    return json_error_response(
                        _("Error: permalink state not found"), status=404
                    )
            except (ChartNotFoundError, ExplorePermalinkGetFailedError) as ex:
                flash(__("Error: %(msg)s", msg=ex.message), "danger")
                return redirect("/chart/list/")
        elif form_data_key:
            parameters = CommandParameters(key=form_data_key)
            value = GetFormDataCommand(parameters).run()
            initial_form_data = json.loads(value) if value else {}

        if not initial_form_data:
            slice_id = request.args.get("slice_id")
            dataset_id = request.args.get("dataset_id")
            if slice_id:
                initial_form_data["slice_id"] = slice_id
                if form_data_key:
                    flash(
                        _("Form data not found in cache, reverting to chart metadata.")
                    )
            elif dataset_id:
                initial_form_data["datasource"] = f"{dataset_id}__table"
                if form_data_key:
                    flash(
                        _(
                            "Form data not found in cache, reverting to dataset metadata."
                        )
                    )

        form_data, slc = get_form_data(
            use_slice_data=True, initial_form_data=initial_form_data
        )

        query_context = request.form.get("query_context")

        try:
            datasource_id, datasource_type = get_datasource_info(
                datasource_id, datasource_type, form_data
            )
        except SupersetException:
            datasource_id = None
            # fallback unknown datasource to table type
            datasource_type = SqlaTable.type

        datasource: BaseDatasource | None = None
        if datasource_id is not None:
            try:
                datasource = DatasourceDAO.get_datasource(
                    db.session,
                    DatasourceType("table"),
                    datasource_id,
                )
            except DatasetNotFoundError:
                pass
        datasource_name = datasource.name if datasource else _("[Missing Dataset]")
        viz_type = form_data.get("viz_type")
        if not viz_type and datasource and datasource.default_endpoint:
            return redirect(datasource.default_endpoint)

        selectedColumns = []

        if "selectedColumns" in form_data:
            selectedColumns = form_data.pop("selectedColumns")

        if "viz_type" not in form_data:
            form_data["viz_type"] = app.config["DEFAULT_VIZ_TYPE"]
            if app.config["DEFAULT_VIZ_TYPE"] == "table":
                all_columns = []
                for x in selectedColumns:
                    all_columns.append(x["name"])
                form_data["all_columns"] = all_columns

        # slc perms
        slice_add_perm = security_manager.can_access("can_write", "Chart")
        slice_overwrite_perm = security_manager.is_owner(slc) if slc else False
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
                _("You don't have the rights to alter this chart"),
                status=403,
            )

        if action == "saveas" and not slice_add_perm:
            return json_error_response(
                _("You don't have the rights to create a chart"),
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
        force = request.args.get("force") in {"force", "1", "true"}
        dummy_datasource_data: dict[str, Any] = {
            "type": datasource_type,
            "name": datasource_name,
            "columns": [],
            "metrics": [],
            "database": {"id": 0, "backend": ""},
        }
        try:
            datasource_data = datasource.data if datasource else dummy_datasource_data
        except (SupersetException, SQLAlchemyError):
            datasource_data = dummy_datasource_data

        if datasource:
            datasource_data["owners"] = datasource.owners_data
            if isinstance(datasource, Query):
                datasource_data["columns"] = datasource.columns

        bootstrap_data = {
            "can_add": slice_add_perm,
            "datasource": sanitize_datasource_data(datasource_data),
            "form_data": form_data,
            "datasource_id": datasource_id,
            "datasource_type": datasource_type,
            "slice": slc.data if slc else None,
            "standalone": standalone_mode,
            "force": force,
            "user": bootstrap_user_data(g.user, include_perms=True),
            "forced_height": request.args.get("height"),
            "common": common_bootstrap_payload(g.user),
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

    @staticmethod
    def save_or_overwrite_slice(
        # pylint: disable=too-many-arguments,too-many-locals
        slc: Slice | None,
        slice_add_perm: bool,
        slice_overwrite_perm: bool,
        slice_download_perm: bool,
        datasource_id: int,
        datasource_type: str,
        datasource_name: str,
        query_context: str | None = None,
    ) -> FlaskResponse:
        """Save or overwrite a slice"""
        slice_name = request.args.get("slice_name")
        action = request.args.get("action")
        form_data = get_form_data()[0]

        if action == "saveas":
            if "slice_id" in form_data:
                form_data.pop("slice_id")  # don't save old slice_id
            slc = Slice(owners=[g.user] if g.user else [])

        utils.remove_extra_adhoc_filters(form_data)

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
            flash(msg, "success")
        elif action == "overwrite" and slice_overwrite_perm:
            ChartDAO.overwrite(slc)
            msg = _("Chart [{}] has been overwritten").format(slc.slice_name)
            flash(msg, "success")

        # Adding slice to a dashboard if requested
        dash: Dashboard | None = None

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
            dash_overwrite_perm = security_manager.is_owner(dash)
            if not dash_overwrite_perm:
                return json_error_response(
                    _("You don't have the rights to alter this dashboard"),
                    status=403,
                )

            flash(
                _("Chart [{}] was added to dashboard [{}]").format(
                    slc.slice_name, dash.dashboard_title
                ),
                "success",
            )
        elif new_dashboard_name:
            # Creating and adding to a new dashboard
            # check create dashboard permissions
            dash_add_perm = security_manager.can_access("can_write", "Dashboard")
            if not dash_add_perm:
                return json_error_response(
                    _("You don't have the rights to create a dashboard"),
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
                "success",
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

    @event_logger.log_this
    @api
    @has_access_api
    @expose("/warm_up_cache/", methods=("GET",))
    @deprecated(new_target="api/v1/chart/warm_up_cache/")
    def warm_up_cache(  # pylint: disable=no-self-use
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
        slices: list[Slice] = []

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

        return json_success(
            json.dumps(
                [
                    {
                        "slice_id" if key == "chart_id" else key: value
                        for key, value in ChartWarmUpCacheCommand(
                            slc, dashboard_id, extra_filters
                        )
                        .run()
                        .items()
                    }
                    for slc in slices
                ],
                default=base_json_conv,
            ),
        )

    @has_access
    @expose("/dashboard/<dashboard_id_or_slug>/")
    @event_logger.log_this_with_extra_payload
    def dashboard(
        self,
        dashboard_id_or_slug: str,
        add_extra_log_payload: Callable[..., None] = lambda **kwargs: None,
    ) -> FlaskResponse:
        """
        Server side rendering for a dashboard.

        :param dashboard_id_or_slug: identifier for dashboard
        :param add_extra_log_payload: added by `log_this_with_manual_updates`, set a
            default value to appease pylint
        """

        dashboard = Dashboard.get(dashboard_id_or_slug)

        if not dashboard:
            abort(404)

        try:
            dashboard.raise_for_access()
        except SupersetSecurityException as ex:
            return redirect_with_flash(
                url="/dashboard/list/",
                message=utils.error_msg_from_exception(ex),
                category="danger",
            )
        add_extra_log_payload(
            dashboard_id=dashboard.id,
            dashboard_version="v2",
            dash_edit_perm=(
                security_manager.is_owner(dashboard)
                and security_manager.can_access("can_write", "Dashboard")
            ),
            edit_mode=(
                request.args.get(ReservedUrlParameters.EDIT_MODE.value) == "true"
            ),
        )

        return self.render_template(
            "superset/spa.html",
            entry="spa",
            title=dashboard.dashboard_title,  # dashboard title is always visible
            bootstrap_data=json.dumps(
                {
                    "user": bootstrap_user_data(g.user, include_perms=True),
                    "common": common_bootstrap_payload(g.user),
                },
                default=utils.pessimistic_json_iso_dttm_ser,
            ),
            standalone_mode=ReservedUrlParameters.is_standalone_mode(),
        )

    @has_access
    @expose("/dashboard/p/<key>/", methods=("GET",))
    def dashboard_permalink(  # pylint: disable=no-self-use
        self,
        key: str,
    ) -> FlaskResponse:
        try:
            value = GetDashboardPermalinkCommand(key).run()
        except DashboardPermalinkGetFailedError as ex:
            flash(__("Error: %(msg)s", msg=ex.message), "danger")
            return redirect("/dashboard/list/")
        if not value:
            return json_error_response(_("permalink state not found"), status=404)
        dashboard_id, state = value["dashboardId"], value.get("state", {})
        url = f"/superset/dashboard/{dashboard_id}?permalink_key={key}"
        if url_params := state.get("urlParams"):
            params = parse.urlencode(url_params)
            url = f"{url}&{params}"
        hash_ = state.get("anchor", state.get("hash"))
        if hash_:
            url = f"{url}#{hash_}"
        return redirect(url)

    @api
    @has_access
    @event_logger.log_this
    @expose("/log/", methods=("POST",))
    def log(self) -> FlaskResponse:  # pylint: disable=no-self-use
        return Response(status=200)

    @expose("/theme/")
    def theme(self) -> FlaskResponse:
        return self.render_template("superset/theme.html")

    @api
    @handle_api_exception
    @has_access
    @event_logger.log_this
    @expose("/fetch_datasource_metadata")
    @deprecated(
        new_target="api/v1/database/<int:pk>/table/<path:table_name>/<schema_name>/"
    )
    # pylint: disable=no-self-use
    def fetch_datasource_metadata(self) -> FlaskResponse:
        """
        Fetch the datasource metadata.

        :returns: The Flask response
        :raises SupersetSecurityException: If the user cannot access the resource
        """
        datasource_id, datasource_type = request.args["datasourceKey"].split("__")
        datasource = DatasourceDAO.get_datasource(
            db.session, DatasourceType(datasource_type), int(datasource_id)
        )
        # Check if datasource exists
        if not datasource:
            return json_error_response(DATASOURCE_MISSING_ERR)

        datasource.raise_for_access()
        return json_success(json.dumps(sanitize_datasource_data(datasource.data)))

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
        if not g.user or not get_user_id():
            if conf["PUBLIC_ROLE_LIKE"]:
                return self.render_template("superset/public_welcome.html")
            return redirect(appbuilder.get_url_for_login)

        welcome_dashboard_id = (
            db.session.query(UserAttribute.welcome_dashboard_id)
            .filter_by(user_id=get_user_id())
            .scalar()
        )
        if welcome_dashboard_id:
            return self.dashboard(dashboard_id_or_slug=str(welcome_dashboard_id))

        payload = {
            "user": bootstrap_user_data(g.user, include_perms=True),
            "common": common_bootstrap_payload(g.user),
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
    @expose("/profile/")
    def profile(self) -> FlaskResponse:
        """User profile page"""
        user = g.user if hasattr(g, "user") and g.user else None
        if not user or security_manager.is_guest_user(user) or user.is_anonymous:
            abort(404)
        payload = {
            "user": bootstrap_user_data(user, include_perms=True),
            "common": common_bootstrap_payload(user),
        }

        return self.render_template(
            "superset/basic.html",
            title=_("%(user)s's profile", user=get_username()).__str__(),
            entry="profile",
            bootstrap_data=json.dumps(
                payload, default=utils.pessimistic_json_iso_dttm_ser
            ),
        )

    @staticmethod
    def _get_sqllab_tabs(user_id: int | None) -> dict[str, Any]:
        tabs_state: list[Any] = []
        active_tab: Any = None
        databases: dict[int, Any] = {}
        for database in DatabaseDAO.find_all():
            databases[database.id] = {
                k: v for k, v in database.to_json().items() if k in DATABASE_KEYS
            }
            databases[database.id]["backend"] = database.backend
        queries: dict[str, Any] = {}

        # These are unnecessary if sqllab backend persistence is disabled
        if is_feature_enabled("SQLLAB_BACKEND_PERSISTENCE"):
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
    @expose(
        "/sqllab/",
        methods=(
            "GET",
            "POST",
        ),
    )
    def sqllab(self) -> FlaskResponse:
        """SQL Editor"""
        payload = {
            "defaultDbId": config["SQLLAB_DEFAULT_DBID"],
            "common": common_bootstrap_payload(g.user),
            **self._get_sqllab_tabs(get_user_id()),
        }

        if form_data := request.form.get("form_data"):
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
    @expose("/sqllab/history/", methods=("GET",))
    @event_logger.log_this
    def sqllab_history(self) -> FlaskResponse:
        return super().render_app_template()
