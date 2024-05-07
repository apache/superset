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
from __future__ import annotations

import contextlib
import logging
import os
import sys
from importlib.resources import files
from typing import Any, Callable, TYPE_CHECKING

import simplejson as json
import sqlalchemy as sqla
import wtforms_json
from deprecation import deprecated
from flask import (
    Flask,
    redirect,
    render_template,
    request,
    Response,
    send_file,
)
from flask_appbuilder import expose, IndexView
from flask_babel import gettext as __
from flask_compress import Compress
from flask_session import Session
from flask_wtf.csrf import CSRFError
from werkzeug.exceptions import HTTPException
from werkzeug.middleware.proxy_fix import ProxyFix

from superset.commands.exceptions import CommandException, CommandInvalidError
from superset.constants import CHANGE_ME_SECRET_KEY
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetErrorException, SupersetErrorsException
from superset.extensions import (
    APP_DIR,
    appbuilder,
    async_query_manager_factory,
    cache_manager,
    celery_app,
    csrf,
    db,
    encrypted_field_factory,
    event_logger_manager,
    feature_flag_manager,
    machine_auth_provider_factory,
    manifest_processor,
    migrate,
    profiling,
    results_backend_manager,
    security_manager,
    ssh_manager_factory,
    stats_logger_manager,
    talisman,
)
from superset.security import SupersetSecurityManager
from superset.superset_typing import FlaskResponse
from superset.tags.core import (
    register_sqla_event_listeners as register_tag_event_listeners,
)
from superset.utils import core as utils, json as json_utils
from superset.utils.core import is_test, pessimistic_connection_handling
from superset.utils.log import DBEventLogger, get_event_logger_from_cfg_value

if TYPE_CHECKING:
    from superset.app import SupersetApp

logger = logging.getLogger(__name__)


def get_error_level_from_status_code(  # pylint: disable=invalid-name
    status: int,
) -> ErrorLevel:
    if status < 400:
        return ErrorLevel.INFO
    if status < 500:
        return ErrorLevel.WARNING
    return ErrorLevel.ERROR


class SupersetAppInitializer:  # pylint: disable=too-many-public-methods
    def __init__(self, app: SupersetApp) -> None:
        super().__init__()

        self.app = app
        self.superset_app = app
        self.config = app.config
        self.manifest: dict[Any, Any] = {}
        self.app.stats_logger = app.config["STATS_LOGGER"]

    @deprecated(details="use self.app instead of self.flask_app")  # type: ignore
    @property
    def flask_app(self) -> SupersetApp:
        return self.app

    def pre_init(self) -> None:
        """
        Called before all other init tasks are complete
        """
        wtforms_json.init()

        if not os.path.exists(self.config["DATA_DIR"]):
            os.makedirs(self.config["DATA_DIR"])

    def post_init(self) -> None:
        """
        Called after any other init tasks
        """

    def configure_celery(self) -> None:
        celery_app.config_from_object(self.config["CELERY_CONFIG"])
        celery_app.set_default()
        app = self.app

        # Here, we want to ensure that every call into Celery task has an app context
        # setup properly
        task_base = celery_app.Task

        class AppContextTask(task_base):  # type: ignore
            # pylint: disable=too-few-public-methods
            abstract = True

            # Grab each call into the task and set up an app context
            def __call__(self, *args: Any, **kwargs: Any) -> Any:
                with app.app_context():
                    return task_base.__call__(self, *args, **kwargs)

        celery_app.Task = AppContextTask

    def init_views(self) -> None:
        #
        # We're doing local imports, as several of them import
        # models which in turn try to import
        # the global Flask app
        #
        # pylint: disable=import-outside-toplevel,too-many-locals,too-many-statements
        from superset.advanced_data_type.api import AdvancedDataTypeRestApi
        from superset.annotation_layers.annotations.api import AnnotationRestApi
        from superset.annotation_layers.api import AnnotationLayerRestApi
        from superset.async_events.api import AsyncEventsRestApi
        from superset.available_domains.api import AvailableDomainsRestApi
        from superset.cachekeys.api import CacheRestApi
        from superset.charts.api import ChartRestApi
        from superset.charts.data.api import ChartDataRestApi
        from superset.connectors.sqla.views import (
            RowLevelSecurityView,
            SqlMetricInlineView,
            TableColumnInlineView,
            TableModelView,
        )
        from superset.css_templates.api import CssTemplateRestApi
        from superset.dashboards.api import DashboardRestApi
        from superset.dashboards.filter_state.api import DashboardFilterStateRestApi
        from superset.dashboards.permalink.api import DashboardPermalinkRestApi
        from superset.databases.api import DatabaseRestApi
        from superset.datasets.api import DatasetRestApi
        from superset.datasets.columns.api import DatasetColumnsRestApi
        from superset.datasets.metrics.api import DatasetMetricRestApi
        from superset.datasource.api import DatasourceRestApi
        from superset.embedded.api import EmbeddedDashboardRestApi
        from superset.embedded.view import EmbeddedView
        from superset.explore.api import ExploreRestApi
        from superset.explore.form_data.api import ExploreFormDataRestApi
        from superset.explore.permalink.api import ExplorePermalinkRestApi
        from superset.importexport.api import ImportExportRestApi
        from superset.queries.api import QueryRestApi
        from superset.queries.saved_queries.api import SavedQueryRestApi
        from superset.reports.api import ReportScheduleRestApi
        from superset.reports.logs.api import ReportExecutionLogRestApi
        from superset.row_level_security.api import RLSRestApi
        from superset.security.api import SecurityRestApi
        from superset.sqllab.api import SqlLabRestApi
        from superset.tags.api import TagRestApi
        from superset.views.alerts import AlertView, ReportView
        from superset.views.all_entities import TaggedObjectsModelView
        from superset.views.annotations import AnnotationLayerView
        from superset.views.api import Api
        from superset.views.chart.views import SliceAsync, SliceModelView
        from superset.views.core import Superset
        from superset.views.css_templates import (
            CssTemplateAsyncModelView,
            CssTemplateModelView,
        )
        from superset.views.dashboard.views import (
            Dashboard,
            DashboardModelView,
            DashboardModelViewAsync,
        )
        from superset.views.database.views import DatabaseView
        from superset.views.datasource.views import DatasetEditor, Datasource
        from superset.views.dynamic_plugins import DynamicPluginsView
        from superset.views.explore import ExplorePermalinkView, ExploreView
        from superset.views.key_value import KV
        from superset.views.log.api import LogRestApi
        from superset.views.log.views import LogModelView
        from superset.views.sql_lab.views import (
            SavedQueryView,
            SavedQueryViewApi,
            TableSchemaView,
            TabStateView,
        )
        from superset.views.sqllab import SqllabView
        from superset.views.tags import TagModelView, TagView
        from superset.views.users.api import CurrentUserRestApi, UserRestApi

        #
        # Setup API views
        #
        appbuilder.add_api(AnnotationRestApi)
        appbuilder.add_api(AnnotationLayerRestApi)
        appbuilder.add_api(AsyncEventsRestApi)
        appbuilder.add_api(AdvancedDataTypeRestApi)
        appbuilder.add_api(AvailableDomainsRestApi)
        appbuilder.add_api(CacheRestApi)
        appbuilder.add_api(ChartRestApi)
        appbuilder.add_api(ChartDataRestApi)
        appbuilder.add_api(CssTemplateRestApi)
        appbuilder.add_api(CurrentUserRestApi)
        appbuilder.add_api(UserRestApi)
        appbuilder.add_api(DashboardFilterStateRestApi)
        appbuilder.add_api(DashboardPermalinkRestApi)
        appbuilder.add_api(DashboardRestApi)
        appbuilder.add_api(DatabaseRestApi)
        appbuilder.add_api(DatasetRestApi)
        appbuilder.add_api(DatasetColumnsRestApi)
        appbuilder.add_api(DatasetMetricRestApi)
        appbuilder.add_api(DatasourceRestApi)
        appbuilder.add_api(EmbeddedDashboardRestApi)
        appbuilder.add_api(ExploreRestApi)
        appbuilder.add_api(ExploreFormDataRestApi)
        appbuilder.add_api(ExplorePermalinkRestApi)
        appbuilder.add_api(ImportExportRestApi)
        appbuilder.add_api(QueryRestApi)
        appbuilder.add_api(ReportScheduleRestApi)
        appbuilder.add_api(ReportExecutionLogRestApi)
        appbuilder.add_api(RLSRestApi)
        appbuilder.add_api(SavedQueryRestApi)
        appbuilder.add_api(TagRestApi)
        appbuilder.add_api(SqlLabRestApi)
        #
        # Setup regular views
        #
        appbuilder.add_link(
            "Home",
            label=__("Home"),
            href="/superset/welcome/",
            cond=lambda: bool(appbuilder.app.config["LOGO_TARGET_PATH"]),
        )

        appbuilder.add_view(
            DatabaseView,
            "Databases",
            label=__("Database Connections"),
            icon="fa-database",
            category="Data",
            category_label=__("Data"),
        )
        appbuilder.add_view(
            DashboardModelView,
            "Dashboards",
            label=__("Dashboards"),
            icon="fa-dashboard",
            category="",
            category_icon="",
        )
        appbuilder.add_view(
            SliceModelView,
            "Charts",
            label=__("Charts"),
            icon="fa-bar-chart",
            category="",
            category_icon="",
        )

        appbuilder.add_link(
            "Datasets",
            label=__("Datasets"),
            href="/tablemodelview/list/",
            icon="fa-table",
            category="",
            category_icon="",
        )

        appbuilder.add_view(
            DynamicPluginsView,
            "Plugins",
            label=__("Plugins"),
            category="Manage",
            category_label=__("Manage"),
            icon="fa-puzzle-piece",
            menu_cond=lambda: feature_flag_manager.is_feature_enabled(
                "DYNAMIC_PLUGINS"
            ),
        )
        appbuilder.add_view(
            CssTemplateModelView,
            "CSS Templates",
            label=__("CSS Templates"),
            icon="fa-css3",
            category="Manage",
            category_label=__("Manage"),
            category_icon="",
        )

        #
        # Setup views with no menu
        #
        appbuilder.add_view_no_menu(Api)
        appbuilder.add_view_no_menu(CssTemplateAsyncModelView)
        appbuilder.add_view_no_menu(Dashboard)
        appbuilder.add_view_no_menu(DashboardModelViewAsync)
        appbuilder.add_view_no_menu(Datasource)
        appbuilder.add_view_no_menu(DatasetEditor)
        appbuilder.add_view_no_menu(EmbeddedView)
        appbuilder.add_view_no_menu(ExploreView)
        appbuilder.add_view_no_menu(ExplorePermalinkView)
        appbuilder.add_view_no_menu(KV)
        appbuilder.add_view_no_menu(SavedQueryView)
        appbuilder.add_view_no_menu(SavedQueryViewApi)
        appbuilder.add_view_no_menu(SliceAsync)
        appbuilder.add_view_no_menu(SqllabView)
        appbuilder.add_view_no_menu(SqlMetricInlineView)
        appbuilder.add_view_no_menu(Superset)
        appbuilder.add_view_no_menu(TableColumnInlineView)
        appbuilder.add_view_no_menu(TableModelView)
        appbuilder.add_view_no_menu(TableSchemaView)
        appbuilder.add_view_no_menu(TabStateView)
        appbuilder.add_view_no_menu(TaggedObjectsModelView)
        appbuilder.add_view_no_menu(TagView)
        appbuilder.add_view_no_menu(ReportView)

        #
        # Add links
        #
        appbuilder.add_link(
            "SQL Editor",
            label=__("SQL Lab"),
            href="/sqllab/",
            category_icon="fa-flask",
            icon="fa-flask",
            category="SQL Lab",
            category_label=__("SQL"),
        )
        appbuilder.add_link(
            "Saved Queries",
            label=__("Saved Queries"),
            href="/savedqueryview/list/",
            icon="fa-save",
            category="SQL Lab",
            category_label=__("SQL"),
        )
        appbuilder.add_link(
            "Query Search",
            label=__("Query History"),
            href="/sqllab/history/",
            icon="fa-search",
            category_icon="fa-flask",
            category="SQL Lab",
            category_label=__("SQL Lab"),
        )
        appbuilder.add_view(
            TagModelView,
            "Tags",
            label=__("Tags"),
            icon="",
            category_icon="",
            category="Manage",
            menu_cond=lambda: feature_flag_manager.is_feature_enabled("TAGGING_SYSTEM"),
        )
        appbuilder.add_api(LogRestApi)
        appbuilder.add_view(
            LogModelView,
            "Action Log",
            label=__("Action Log"),
            category="Security",
            category_label=__("Security"),
            icon="fa-list-ol",
            menu_cond=lambda: (
                self.config["FAB_ADD_SECURITY_VIEWS"]
                and self.config["SUPERSET_LOG_VIEW"]
            ),
        )
        appbuilder.add_api(SecurityRestApi)
        #
        # Conditionally setup email views
        #

        appbuilder.add_view(
            AlertView,
            "Alerts & Report",
            label=__("Alerts & Reports"),
            category="Manage",
            category_label=__("Manage"),
            icon="fa-exclamation-triangle",
            menu_cond=lambda: feature_flag_manager.is_feature_enabled("ALERT_REPORTS"),
        )

        appbuilder.add_view(
            AnnotationLayerView,
            "Annotation Layers",
            label=__("Annotation Layers"),
            href="/annotationlayer/list/",
            icon="fa-comment",
            category_icon="",
            category="Manage",
            category_label=__("Manage"),
        )

        appbuilder.add_view(
            RowLevelSecurityView,
            "Row Level Security",
            href="/rowlevelsecurity/list/",
            label=__("Row Level Security"),
            category="Security",
            category_label=__("Security"),
            icon="fa-lock",
        )

    def init_app_in_ctx(self) -> None:
        """
        Runs init logic in the context of the app
        """
        self.configure_fab()
        self.configure_url_map_converters()
        self.configure_data_sources()
        self.configure_auth_provider()
        self.configure_async_queries()
        self.configure_ssh_manager()
        self.configure_stats_manager()

        # Hook that provides administrators a handle on the Flask APP
        # after initialization
        if flask_app_mutator := self.config["FLASK_APP_MUTATOR"]:
            flask_app_mutator(self.app)

        self.init_views()

        self.register_sqla_event_listeners()
        self.register_error_handlers()
        self.register_other_views()

    def register_other_views(self) -> None:
        @talisman(force_https=False)
        @self.app.route("/health")
        @self.app.route("/healthcheck")
        @self.app.route("/ping")
        def health() -> FlaskResponse:
            self.app.stats_logger.incr("health")
            return "OK"

    def register_sqla_event_listeners(self) -> None:
        # pylint: disable=import-outside-toplevel
        from superset.models.core import Database

        # TODO move all sqla.event.listen to this method
        if feature_flag_manager.is_feature_enabled("TAGGING_SYSTEM"):
            register_tag_event_listeners()

        # Using lambdas for security manager to prevent referencing it in module scope
        sqla.event.listen(
            Database,
            "after_insert",
            security_manager.database_after_insert,
        )
        sqla.event.listen(
            Database,
            "after_update",
            security_manager.database_after_update,
        )
        sqla.event.listen(
            Database,
            "after_delete",
            security_manager.database_after_delete,
        )

    def register_error_handlers(self) -> None:
        # pylint: disable=import-outside-toplevel
        from superset.views.utils import get_error_msg, json_errors_response

        # SIP-40 compatible error responses; make sure APIs raise
        # SupersetErrorException or SupersetErrorsException
        @self.app.errorhandler(SupersetErrorException)
        def show_superset_error(ex: SupersetErrorException) -> FlaskResponse:
            logger.warning("SupersetErrorException", exc_info=True)
            return json_errors_response(errors=[ex.error], status=ex.status)

        @self.app.errorhandler(SupersetErrorsException)
        def show_superset_errors(ex: SupersetErrorsException) -> FlaskResponse:
            logger.warning("SupersetErrorsException", exc_info=True)
            return json_errors_response(errors=ex.errors, status=ex.status)

        # Redirect to login if the CSRF token is expired
        @self.app.errorhandler(CSRFError)
        def refresh_csrf_token(ex: CSRFError) -> FlaskResponse:
            logger.warning("Refresh CSRF token error", exc_info=True)

            if request.is_json:
                return show_http_exception(ex)

            return redirect(appbuilder.get_url_for_login)

        @self.app.errorhandler(HTTPException)
        def show_http_exception(ex: HTTPException) -> FlaskResponse:
            logger.warning("HTTPException", exc_info=True)
            if (
                "text/html" in request.accept_mimetypes
                and not self.app.config["DEBUG"]
                and ex.code in {404, 500}
            ):
                path = files("superset") / f"static/assets/{ex.code}.html"
                return send_file(path, max_age=0), ex.code

            return json_errors_response(
                errors=[
                    SupersetError(
                        message=utils.error_msg_from_exception(ex),
                        error_type=SupersetErrorType.GENERIC_BACKEND_ERROR,
                        level=ErrorLevel.ERROR,
                    ),
                ],
                status=ex.code or 500,
            )

        @self.app.errorhandler(500)
        def show_traceback(self) -> FlaskResponse:  # type: ignore # pylint: disable=unused-argument
            return (
                render_template("superset/traceback.html", error_msg=get_error_msg()),
                500,
            )

        # Temporary handler for CommandException; if an API raises a
        # CommandException it should be fixed to map it to SupersetErrorException
        # or SupersetErrorsException, with a specific status code and error type
        @self.app.errorhandler(CommandException)
        def show_command_errors(ex: CommandException) -> FlaskResponse:
            logger.warning("CommandException", exc_info=True)
            if "text/html" in request.accept_mimetypes and not self.app.config["DEBUG"]:
                path = files("superset") / "static/assets/500.html"
                return send_file(path, max_age=0), 500

            extra = (
                ex.normalized_messages() if isinstance(ex, CommandInvalidError) else {}
            )
            return json_errors_response(
                errors=[
                    SupersetError(
                        message=ex.message,
                        error_type=SupersetErrorType.GENERIC_COMMAND_ERROR,
                        level=get_error_level_from_status_code(ex.status),
                        extra=extra,
                    ),
                ],
                status=ex.status,
            )

        # Catch-all, to ensure all errors from the backend conform to SIP-40
        @self.app.errorhandler(Exception)
        def show_unexpected_exception(ex: Exception) -> FlaskResponse:
            logger.exception(ex)
            if "text/html" in request.accept_mimetypes and not self.app.config["DEBUG"]:
                path = files("superset") / "static/assets/500.html"
                return send_file(path, max_age=0), 500

            return json_errors_response(
                errors=[
                    SupersetError(
                        message=utils.error_msg_from_exception(ex),
                        error_type=SupersetErrorType.GENERIC_BACKEND_ERROR,
                        level=ErrorLevel.ERROR,
                    ),
                ],
            )

        @self.app.context_processor
        def get_common_bootstrap_data() -> dict[str, Any]:
            from superset.initialization.bootstrap import common_bootstrap_payload

            def serialize_bootstrap_data() -> str:
                return json.dumps(
                    {"common": common_bootstrap_payload()},
                    default=json_utils.pessimistic_json_iso_dttm_ser,
                )

            return {"bootstrap_data": serialize_bootstrap_data}

        @self.app.after_request
        def apply_http_headers(response: Response) -> Response:
            """Applies the configuration's http headers to all responses"""

            # HTTP_HEADERS is deprecated, this provides backwards compatibility
            response.headers.extend(
                {
                    **self.app.config["OVERRIDE_HTTP_HEADERS"],
                    **self.app.config["HTTP_HEADERS"],
                }
            )

            for k, v in self.app.config["DEFAULT_HTTP_HEADERS"].items():
                if k not in response.headers:
                    response.headers[k] = v
            return response

    def check_secret_key(self) -> None:
        def log_default_secret_key_warning() -> None:
            top_banner = 80 * "-" + "\n" + 36 * " " + "WARNING\n" + 80 * "-"
            bottom_banner = 80 * "-" + "\n" + 80 * "-"
            logger.warning(top_banner)
            logger.warning(
                "A Default SECRET_KEY was detected, please use superset_config.py "
                "to override it.\n"
                "Use a strong complex alphanumeric string and use a tool to help"
                " you generate \n"
                "a sufficiently random sequence, ex: openssl rand -base64 42"
            )
            logger.warning(bottom_banner)

        if self.config["SECRET_KEY"] == CHANGE_ME_SECRET_KEY:
            if self.app.debug or self.app.config["TESTING"] or is_test():
                logger.warning("Debug mode identified with default secret key")
                log_default_secret_key_warning()
                return
            log_default_secret_key_warning()
            logger.error("Refusing to start due to insecure SECRET_KEY")
            sys.exit(1)

    def configure_session(self) -> None:
        if self.config["SESSION_SERVER_SIDE"]:
            Session(self.app)

    def init_app(self) -> None:
        """
        Main entry point which will delegate to other methods in
        order to fully init the app
        """
        self.pre_init()
        self.check_secret_key()
        self.configure_session()
        # Configuration of logging must be done first to apply the formatter properly
        self.configure_logging()
        # Configuration of feature_flags must be done first to allow init features
        # conditionally
        self.configure_feature_flags()
        self.configure_db_encrypt()
        self.setup_db()
        self.configure_celery()
        self.enable_profiling()
        self.setup_event_logger()
        self.setup_bundle_manifest()
        self.register_blueprints()
        self.configure_wtf()
        self.configure_middlewares()
        self.configure_cache()

        with self.app.app_context():
            self.init_app_in_ctx()

        self.post_init()

    def configure_auth_provider(self) -> None:
        machine_auth_provider_factory.init_app(self.app)

    def configure_ssh_manager(self) -> None:
        ssh_manager_factory.init_app(self.app)

    def configure_stats_manager(self) -> None:
        stats_logger_manager.init_app(self.app)

    def setup_event_logger(self) -> None:
        event_logger = get_event_logger_from_cfg_value(
            self.app.config.get("EVENT_LOGGER") or DBEventLogger()
        )
        event_logger_manager.set_event_logger(event_logger)

    def configure_data_sources(self) -> None:
        # Registering sources
        module_datasource_map = self.config["DEFAULT_MODULE_DS_MAP"]
        module_datasource_map.update(self.config["ADDITIONAL_MODULE_DS_MAP"])

        # todo(hughhhh): fully remove the datasource config register
        for module_name, class_names in module_datasource_map.items():
            class_names = [str(s) for s in class_names]
            __import__(module_name, fromlist=class_names)

    def configure_cache(self) -> None:
        cache_manager.init_app(self.app)
        results_backend_manager.init_app(self.app)

    def configure_feature_flags(self) -> None:
        feature_flag_manager.init_app(self.app)

    def configure_fab(self) -> None:
        """
        NOTE: somehow appbuilder.init_app will run a `db.create_all`
        which creates the foundation db models FAB needs. This needs to happen
        before other [superset] models are initialized. For this
        reason we tend to do late imports in this module. A simple
        `from superset.models import core` in this context would lead to FAB
        creating models, and conflict with db migrations happening later in
        the installation flows
        """
        if self.config["SILENCE_FAB"]:
            logging.getLogger("flask_appbuilder").setLevel(logging.ERROR)

        custom_sm = self.config["CUSTOM_SECURITY_MANAGER"] or SupersetSecurityManager
        if not issubclass(custom_sm, SupersetSecurityManager):
            raise Exception(  # pylint: disable=broad-exception-raised
                """Your CUSTOM_SECURITY_MANAGER must now extend SupersetSecurityManager,
                 not FAB's security manager.
                 See [4565] in UPDATING.md"""
            )

        appbuilder.indexview = SupersetIndexView
        appbuilder.base_template = "superset/base.html"
        appbuilder.security_manager_class = custom_sm
        appbuilder.init_app(self.app, db.session)

    def configure_url_map_converters(self) -> None:
        #
        # Doing local imports here as model importing causes a reference to
        # app.config to be invoked and we need the current_app to have been setup
        #
        # pylint: disable=import-outside-toplevel
        from superset.utils.url_map_converters import (
            ObjectTypeConverter,
            RegexConverter,
        )

        self.app.url_map.converters["regex"] = RegexConverter
        self.app.url_map.converters["object_type"] = ObjectTypeConverter

    def configure_middlewares(self) -> None:
        if self.config["ENABLE_CORS"]:
            # pylint: disable=import-outside-toplevel
            from flask_cors import CORS

            CORS(self.app, **self.config["CORS_OPTIONS"])

        if self.config["ENABLE_PROXY_FIX"]:
            self.app.wsgi_app = ProxyFix(
                self.app.wsgi_app, **self.config["PROXY_FIX_CONFIG"]
            )

        if self.config["ENABLE_CHUNK_ENCODING"]:

            class ChunkedEncodingFix:  # pylint: disable=too-few-public-methods
                def __init__(self, app: Flask) -> None:
                    self.app = app

                def __call__(
                    self, environ: dict[str, Any], start_response: Callable[..., Any]
                ) -> Any:
                    # Setting wsgi.input_terminated tells werkzeug.wsgi to ignore
                    # content-length and read the stream till the end.
                    if environ.get("HTTP_TRANSFER_ENCODING", "").lower() == "chunked":
                        environ["wsgi.input_terminated"] = True
                    return self.app(environ, start_response)

            self.app.wsgi_app = ChunkedEncodingFix(self.app.wsgi_app)

        if self.config["UPLOAD_FOLDER"]:
            with contextlib.suppress(OSError):
                os.makedirs(self.config["UPLOAD_FOLDER"])
        for middleware in self.config["ADDITIONAL_MIDDLEWARE"]:
            self.app.wsgi_app = middleware(self.app.wsgi_app)

        # Flask-Compress
        Compress(self.app)

        # Talisman
        talisman_enabled = self.config["TALISMAN_ENABLED"]
        talisman_config = (
            self.config["TALISMAN_DEV_CONFIG"]
            if self.app.debug
            else self.config["TALISMAN_CONFIG"]
        )
        csp_warning = self.config["CONTENT_SECURITY_POLICY_WARNING"]

        if talisman_enabled:
            talisman.init_app(self.app, **talisman_config)

        show_csp_warning = False
        if (
            csp_warning
            and not self.app.debug
            and (
                not talisman_enabled
                or not talisman_config
                or not talisman_config.get("content_security_policy")
            )
        ):
            show_csp_warning = True

        if show_csp_warning:
            logger.warning(
                "We haven't found any Content Security Policy (CSP) defined in "
                "the configurations. Please make sure to configure CSP using the "
                "TALISMAN_ENABLED and TALISMAN_CONFIG keys or any other external "
                "software. Failing to configure CSP have serious security implications. "
                "Check https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP for more "
                "information. You can disable this warning using the "
                "CONTENT_SECURITY_POLICY_WARNING key."
            )

    def configure_logging(self) -> None:
        self.config["LOGGING_CONFIGURATOR"].configure_logging(
            self.config, self.app.debug
        )

    def configure_db_encrypt(self) -> None:
        encrypted_field_factory.init_app(self.app)

    def setup_db(self) -> None:
        db.init_app(self.app)

        with self.app.app_context():
            pessimistic_connection_handling(db.engine)

        migrate.init_app(self.app, db=db, directory=APP_DIR + "/migrations")

    def configure_wtf(self) -> None:
        if self.config["WTF_CSRF_ENABLED"]:
            csrf.init_app(self.app)
            csrf_exempt_list = self.config["WTF_CSRF_EXEMPT_LIST"]
            for ex in csrf_exempt_list:
                csrf.exempt(ex)

    def configure_async_queries(self) -> None:
        if feature_flag_manager.is_feature_enabled("GLOBAL_ASYNC_QUERIES"):
            async_query_manager_factory.init_app(self.app)

    def register_blueprints(self) -> None:
        for bp in self.config["BLUEPRINTS"]:
            try:
                logger.info("Registering blueprint: %s", bp.name)
                self.app.register_blueprint(bp)
            except Exception:  # pylint: disable=broad-except
                logger.exception("blueprint registration failed")

    def setup_bundle_manifest(self) -> None:
        manifest_processor.init_app(self.app)

    def enable_profiling(self) -> None:
        if self.config["PROFILING"]:
            profiling.init_app(self.app)


class SupersetIndexView(IndexView):
    @expose("/")
    def index(self) -> FlaskResponse:
        return redirect("/superset/welcome/")
