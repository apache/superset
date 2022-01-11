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

import logging
import os
from typing import Any, Callable, Dict, TYPE_CHECKING

import wtforms_json
from deprecation import deprecated
from flask import Flask, redirect
from flask_appbuilder import expose, IndexView
from flask_babel import gettext as __, lazy_gettext as _
from flask_compress import Compress
from werkzeug.middleware.proxy_fix import ProxyFix

from superset.connectors.connector_registry import ConnectorRegistry
from superset.constants import CHANGE_ME_SECRET_KEY
from superset.extensions import (
    _event_logger,
    APP_DIR,
    appbuilder,
    async_query_manager,
    cache_manager,
    celery_app,
    csrf,
    db,
    encrypted_field_factory,
    feature_flag_manager,
    machine_auth_provider_factory,
    manifest_processor,
    migrate,
    profiling,
    results_backend_manager,
    talisman,
)
from superset.security import SupersetSecurityManager
from superset.typing import FlaskResponse
from superset.utils.core import pessimistic_connection_handling
from superset.utils.log import DBEventLogger, get_event_logger_from_cfg_value

if TYPE_CHECKING:
    from superset.app import SupersetApp

logger = logging.getLogger(__name__)


class SupersetAppInitializer:  # pylint: disable=too-many-public-methods
    def __init__(self, app: SupersetApp) -> None:
        super().__init__()

        self.superset_app = app
        self.config = app.config
        self.manifest: Dict[Any, Any] = {}

    @deprecated(details="use self.superset_app instead of self.flask_app")  # type: ignore   # pylint: disable=line-too-long,useless-suppression
    @property
    def flask_app(self) -> SupersetApp:
        return self.superset_app

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
        superset_app = self.superset_app

        # Here, we want to ensure that every call into Celery task has an app context
        # setup properly
        task_base = celery_app.Task

        class AppContextTask(task_base):  # type: ignore
            # pylint: disable=too-few-public-methods
            abstract = True

            # Grab each call into the task and set up an app context
            def __call__(self, *args: Any, **kwargs: Any) -> Any:
                with superset_app.app_context():
                    return task_base.__call__(self, *args, **kwargs)

        celery_app.Task = AppContextTask

    def init_views(self) -> None:
        #
        # We're doing local imports, as several of them import
        # models which in turn try to import
        # the global Flask app
        #
        # pylint: disable=import-outside-toplevel,too-many-locals,too-many-statements
        from superset.annotation_layers.annotations.api import AnnotationRestApi
        from superset.annotation_layers.api import AnnotationLayerRestApi
        from superset.async_events.api import AsyncEventsRestApi
        from superset.cachekeys.api import CacheRestApi
        from superset.charts.api import ChartRestApi
        from superset.charts.data.api import ChartDataRestApi
        from superset.connectors.druid.views import (
            Druid,
            DruidClusterModelView,
            DruidColumnInlineView,
            DruidDatasourceModelView,
            DruidMetricInlineView,
        )
        from superset.connectors.sqla.views import (
            RowLevelSecurityFiltersModelView,
            SqlMetricInlineView,
            TableColumnInlineView,
            TableModelView,
        )
        from superset.css_templates.api import CssTemplateRestApi
        from superset.dashboards.api import DashboardRestApi
        from superset.dashboards.filter_sets.api import FilterSetRestApi
        from superset.dashboards.filter_state.api import DashboardFilterStateRestApi
        from superset.databases.api import DatabaseRestApi
        from superset.datasets.api import DatasetRestApi
        from superset.datasets.columns.api import DatasetColumnsRestApi
        from superset.datasets.metrics.api import DatasetMetricRestApi
        from superset.queries.api import QueryRestApi
        from superset.queries.saved_queries.api import SavedQueryRestApi
        from superset.reports.api import ReportScheduleRestApi
        from superset.reports.logs.api import ReportExecutionLogRestApi
        from superset.security.api import SecurityRestApi
        from superset.views.access_requests import AccessRequestsModelView
        from superset.views.alerts import (
            AlertLogModelView,
            AlertModelView,
            AlertObservationModelView,
            AlertView,
            ReportView,
        )
        from superset.views.annotations import (
            AnnotationLayerModelView,
            AnnotationModelView,
        )
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
        from superset.views.database.views import (
            ColumnarToDatabaseView,
            CsvToDatabaseView,
            DatabaseView,
            ExcelToDatabaseView,
        )
        from superset.views.datasource.views import Datasource
        from superset.views.dynamic_plugins import DynamicPluginsView
        from superset.views.key_value import KV
        from superset.views.log.api import LogRestApi
        from superset.views.log.views import LogModelView
        from superset.views.redirects import R
        from superset.views.schedules import (
            DashboardEmailScheduleView,
            SliceEmailScheduleView,
        )
        from superset.views.sql_lab import (
            SavedQueryView,
            SavedQueryViewApi,
            SqlLab,
            TableSchemaView,
            TabStateView,
        )
        from superset.views.tags import TagView

        #
        # Setup API views
        #
        appbuilder.add_api(AnnotationRestApi)
        appbuilder.add_api(AnnotationLayerRestApi)
        appbuilder.add_api(AsyncEventsRestApi)
        appbuilder.add_api(CacheRestApi)
        appbuilder.add_api(ChartRestApi)
        appbuilder.add_api(ChartDataRestApi)
        appbuilder.add_api(CssTemplateRestApi)
        appbuilder.add_api(DashboardRestApi)
        appbuilder.add_api(DatabaseRestApi)
        appbuilder.add_api(DatasetRestApi)
        appbuilder.add_api(DatasetColumnsRestApi)
        appbuilder.add_api(DatasetMetricRestApi)
        appbuilder.add_api(QueryRestApi)
        appbuilder.add_api(SavedQueryRestApi)
        appbuilder.add_api(ReportScheduleRestApi)
        appbuilder.add_api(ReportExecutionLogRestApi)
        appbuilder.add_api(FilterSetRestApi)
        appbuilder.add_api(DashboardFilterStateRestApi)
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
            AnnotationLayerModelView,
            "Annotation Layers",
            label=__("Annotation Layers"),
            icon="fa-comment",
            category="Manage",
            category_label=__("Manage"),
            category_icon="",
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
        appbuilder.add_view(
            RowLevelSecurityFiltersModelView,
            "Row Level Security",
            label=__("Row Level Security"),
            category="Security",
            category_label=__("Security"),
            icon="fa-lock",
            menu_cond=lambda: feature_flag_manager.is_feature_enabled(
                "ROW_LEVEL_SECURITY"
            ),
        )

        #
        # Setup views with no menu
        #
        appbuilder.add_view_no_menu(Api)
        appbuilder.add_view_no_menu(CssTemplateAsyncModelView)
        appbuilder.add_view_no_menu(CsvToDatabaseView)
        appbuilder.add_view_no_menu(ExcelToDatabaseView)
        appbuilder.add_view_no_menu(ColumnarToDatabaseView)
        appbuilder.add_view_no_menu(Dashboard)
        appbuilder.add_view_no_menu(DashboardModelViewAsync)
        appbuilder.add_view_no_menu(Datasource)
        appbuilder.add_view_no_menu(KV)
        appbuilder.add_view_no_menu(R)
        appbuilder.add_view_no_menu(SavedQueryView)
        appbuilder.add_view_no_menu(SavedQueryViewApi)
        appbuilder.add_view_no_menu(SliceAsync)
        appbuilder.add_view_no_menu(SqlLab)
        appbuilder.add_view_no_menu(SqlMetricInlineView)
        appbuilder.add_view_no_menu(AnnotationModelView)
        appbuilder.add_view_no_menu(Superset)
        appbuilder.add_view_no_menu(TableColumnInlineView)
        appbuilder.add_view_no_menu(TableModelView)
        appbuilder.add_view_no_menu(TableSchemaView)
        appbuilder.add_view_no_menu(TabStateView)
        appbuilder.add_view_no_menu(TagView)

        #
        # Add links
        #
        appbuilder.add_link(
            "Import Dashboards",
            label=__("Import Dashboards"),
            href="/superset/import_dashboards/",
            icon="fa-cloud-upload",
            category="Manage",
            category_label=__("Manage"),
            category_icon="fa-wrench",
            cond=lambda: not feature_flag_manager.is_feature_enabled(
                "VERSIONED_EXPORT"
            ),
        )
        appbuilder.add_link(
            "SQL Editor",
            label=_("SQL Editor"),
            href="/superset/sqllab/",
            category_icon="fa-flask",
            icon="fa-flask",
            category="SQL Lab",
            category_label=__("SQL Lab"),
        )
        appbuilder.add_link(
            __("Saved Queries"),
            href="/savedqueryview/list/",
            icon="fa-save",
            category="SQL Lab",
        )
        appbuilder.add_link(
            "Query Search",
            label=_("Query History"),
            href="/superset/sqllab/history/",
            icon="fa-search",
            category_icon="fa-flask",
            category="SQL Lab",
            category_label=__("SQL Lab"),
        )
        appbuilder.add_view(
            DatabaseView,
            "Databases",
            label=__("Databases"),
            icon="fa-database",
            category="Data",
            category_label=__("Data"),
            category_icon="fa-database",
        )
        appbuilder.add_link(
            "Datasets",
            label=__("Datasets"),
            href="/tablemodelview/list/",
            icon="fa-table",
            category="Data",
            category_label=__("Data"),
            category_icon="fa-table",
        )
        appbuilder.add_separator("Data")
        appbuilder.add_link(
            "Upload a CSV",
            label=__("Upload a CSV"),
            href="/csvtodatabaseview/form",
            icon="fa-upload",
            category="Data",
            category_label=__("Data"),
            category_icon="fa-wrench",
            cond=lambda: bool(
                self.config["CSV_EXTENSIONS"].intersection(
                    self.config["ALLOWED_EXTENSIONS"]
                )
            ),
        )
        appbuilder.add_link(
            "Upload a Columnar file",
            label=__("Upload a Columnar File"),
            href="/columnartodatabaseview/form",
            icon="fa-upload",
            category="Data",
            category_label=__("Data"),
            category_icon="fa-wrench",
            cond=lambda: bool(
                self.config["COLUMNAR_EXTENSIONS"].intersection(
                    self.config["ALLOWED_EXTENSIONS"]
                )
            ),
        )
        try:
            import xlrd  # pylint: disable=unused-import

            appbuilder.add_link(
                "Upload Excel",
                label=__("Upload Excel"),
                href="/exceltodatabaseview/form",
                icon="fa-upload",
                category="Data",
                category_label=__("Data"),
                category_icon="fa-wrench",
                cond=lambda: bool(
                    self.config["EXCEL_EXTENSIONS"].intersection(
                        self.config["ALLOWED_EXTENSIONS"]
                    )
                ),
            )
        except ImportError:
            pass

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
        if self.config["ENABLE_SCHEDULED_EMAIL_REPORTS"]:
            logging.warning(
                "ENABLE_SCHEDULED_EMAIL_REPORTS "
                "is deprecated and will be removed in version 2.0.0"
            )

        appbuilder.add_separator(
            "Manage", cond=lambda: self.config["ENABLE_SCHEDULED_EMAIL_REPORTS"]
        )
        appbuilder.add_view(
            DashboardEmailScheduleView,
            "Dashboard Email Schedules",
            label=__("Dashboard Emails"),
            category="Manage",
            category_label=__("Manage"),
            icon="fa-search",
            menu_cond=lambda: self.config["ENABLE_SCHEDULED_EMAIL_REPORTS"],
        )
        appbuilder.add_view(
            SliceEmailScheduleView,
            "Chart Emails",
            label=__("Chart Email Schedules"),
            category="Manage",
            category_label=__("Manage"),
            icon="fa-search",
            menu_cond=lambda: self.config["ENABLE_SCHEDULED_EMAIL_REPORTS"],
        )

        if self.config["ENABLE_ALERTS"]:
            logging.warning(
                "ENABLE_ALERTS is deprecated and will be removed in version 2.0.0"
            )

        appbuilder.add_view(
            AlertModelView,
            "Alerts",
            label=__("Alerts"),
            category="Manage",
            category_label=__("Manage"),
            icon="fa-exclamation-triangle",
            menu_cond=lambda: bool(self.config["ENABLE_ALERTS"]),
        )
        appbuilder.add_view_no_menu(AlertLogModelView)
        appbuilder.add_view_no_menu(AlertObservationModelView)

        appbuilder.add_view(
            AlertView,
            "Alerts & Report",
            label=__("Alerts & Reports"),
            category="Manage",
            category_label=__("Manage"),
            icon="fa-exclamation-triangle",
            menu_cond=lambda: feature_flag_manager.is_feature_enabled("ALERT_REPORTS"),
        )
        appbuilder.add_view_no_menu(ReportView)

        appbuilder.add_view(
            AccessRequestsModelView,
            "Access requests",
            label=__("Access requests"),
            category="Security",
            category_label=__("Security"),
            icon="fa-table",
            menu_cond=lambda: bool(self.config["ENABLE_ACCESS_REQUEST"]),
        )

        #
        # Druid Views
        #
        appbuilder.add_separator(
            "Data", cond=lambda: bool(self.config["DRUID_IS_ACTIVE"])
        )
        appbuilder.add_view(
            DruidDatasourceModelView,
            "Druid Datasources",
            label=__("Druid Datasources"),
            category="Data",
            category_label=__("Data"),
            icon="fa-cube",
            menu_cond=lambda: bool(self.config["DRUID_IS_ACTIVE"]),
        )
        appbuilder.add_view(
            DruidClusterModelView,
            name="Druid Clusters",
            label=__("Druid Clusters"),
            icon="fa-cubes",
            category="Data",
            category_label=__("Data"),
            category_icon="fa-database",
            menu_cond=lambda: bool(self.config["DRUID_IS_ACTIVE"]),
        )
        appbuilder.add_view_no_menu(DruidMetricInlineView)
        appbuilder.add_view_no_menu(DruidColumnInlineView)
        appbuilder.add_view_no_menu(Druid)

        appbuilder.add_link(
            "Scan New Datasources",
            label=__("Scan New Datasources"),
            href="/druid/scan_new_datasources/",
            category="Data",
            category_label=__("Data"),
            category_icon="fa-database",
            icon="fa-refresh",
            cond=lambda: bool(
                self.config["DRUID_IS_ACTIVE"]
                and self.config["DRUID_METADATA_LINKS_ENABLED"]
            ),
        )
        appbuilder.add_link(
            "Refresh Druid Metadata",
            label=__("Refresh Druid Metadata"),
            href="/druid/refresh_datasources/",
            category="Data",
            category_label=__("Data"),
            category_icon="fa-database",
            icon="fa-cog",
            cond=lambda: bool(
                self.config["DRUID_IS_ACTIVE"]
                and self.config["DRUID_METADATA_LINKS_ENABLED"]
            ),
        )
        appbuilder.add_separator(
            "Data", cond=lambda: bool(self.config["DRUID_IS_ACTIVE"])
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

        # Hook that provides administrators a handle on the Flask APP
        # after initialization
        flask_app_mutator = self.config["FLASK_APP_MUTATOR"]
        if flask_app_mutator:
            flask_app_mutator(self.superset_app)

        self.init_views()

    def check_secret_key(self) -> None:
        if self.config["SECRET_KEY"] == CHANGE_ME_SECRET_KEY:
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

    def init_app(self) -> None:
        """
        Main entry point which will delegate to other methods in
        order to fully init the app
        """
        self.pre_init()
        self.check_secret_key()
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

        with self.superset_app.app_context():
            self.init_app_in_ctx()

        self.post_init()

    def configure_auth_provider(self) -> None:
        machine_auth_provider_factory.init_app(self.superset_app)

    def setup_event_logger(self) -> None:
        _event_logger["event_logger"] = get_event_logger_from_cfg_value(
            self.superset_app.config.get("EVENT_LOGGER", DBEventLogger())
        )

    def configure_data_sources(self) -> None:
        # Registering sources
        module_datasource_map = self.config["DEFAULT_MODULE_DS_MAP"]
        module_datasource_map.update(self.config["ADDITIONAL_MODULE_DS_MAP"])
        ConnectorRegistry.register_sources(module_datasource_map)

    def configure_cache(self) -> None:
        cache_manager.init_app(self.superset_app)
        results_backend_manager.init_app(self.superset_app)

    def configure_feature_flags(self) -> None:
        feature_flag_manager.init_app(self.superset_app)

    def configure_fab(self) -> None:
        if self.config["SILENCE_FAB"]:
            logging.getLogger("flask_appbuilder").setLevel(logging.ERROR)

        custom_sm = self.config["CUSTOM_SECURITY_MANAGER"] or SupersetSecurityManager
        if not issubclass(custom_sm, SupersetSecurityManager):
            raise Exception(
                """Your CUSTOM_SECURITY_MANAGER must now extend SupersetSecurityManager,
                 not FAB's security manager.
                 See [4565] in UPDATING.md"""
            )

        appbuilder.indexview = SupersetIndexView
        appbuilder.base_template = "superset/base.html"
        appbuilder.security_manager_class = custom_sm
        appbuilder.init_app(self.superset_app, db.session)

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

        self.superset_app.url_map.converters["regex"] = RegexConverter
        self.superset_app.url_map.converters["object_type"] = ObjectTypeConverter

    def configure_middlewares(self) -> None:
        if self.config["ENABLE_CORS"]:
            # pylint: disable=import-outside-toplevel
            from flask_cors import CORS

            CORS(self.superset_app, **self.config["CORS_OPTIONS"])

        if self.config["ENABLE_PROXY_FIX"]:
            self.superset_app.wsgi_app = ProxyFix(  # type: ignore
                self.superset_app.wsgi_app, **self.config["PROXY_FIX_CONFIG"]
            )

        if self.config["ENABLE_CHUNK_ENCODING"]:

            class ChunkedEncodingFix:  # pylint: disable=too-few-public-methods
                def __init__(self, app: Flask) -> None:
                    self.app = app

                def __call__(
                    self, environ: Dict[str, Any], start_response: Callable[..., Any]
                ) -> Any:
                    # Setting wsgi.input_terminated tells werkzeug.wsgi to ignore
                    # content-length and read the stream till the end.
                    if environ.get("HTTP_TRANSFER_ENCODING", "").lower() == "chunked":
                        environ["wsgi.input_terminated"] = True
                    return self.app(environ, start_response)

            self.superset_app.wsgi_app = ChunkedEncodingFix(  # type: ignore
                self.superset_app.wsgi_app  # type: ignore
            )

        if self.config["UPLOAD_FOLDER"]:
            try:
                os.makedirs(self.config["UPLOAD_FOLDER"])
            except OSError:
                pass

        for middleware in self.config["ADDITIONAL_MIDDLEWARE"]:
            self.superset_app.wsgi_app = middleware(  # type: ignore
                self.superset_app.wsgi_app
            )

        # Flask-Compress
        Compress(self.superset_app)

        if self.config["TALISMAN_ENABLED"]:
            talisman.init_app(self.superset_app, **self.config["TALISMAN_CONFIG"])

    def configure_logging(self) -> None:
        self.config["LOGGING_CONFIGURATOR"].configure_logging(
            self.config, self.superset_app.debug
        )

    def configure_db_encrypt(self) -> None:
        encrypted_field_factory.init_app(self.superset_app)

    def setup_db(self) -> None:
        db.init_app(self.superset_app)

        with self.superset_app.app_context():
            pessimistic_connection_handling(db.engine)

        migrate.init_app(self.superset_app, db=db, directory=APP_DIR + "/migrations")

    def configure_wtf(self) -> None:
        if self.config["WTF_CSRF_ENABLED"]:
            csrf.init_app(self.superset_app)
            csrf_exempt_list = self.config["WTF_CSRF_EXEMPT_LIST"]
            for ex in csrf_exempt_list:
                csrf.exempt(ex)

    def configure_async_queries(self) -> None:
        if feature_flag_manager.is_feature_enabled("GLOBAL_ASYNC_QUERIES"):
            async_query_manager.init_app(self.superset_app)

    def register_blueprints(self) -> None:
        for bp in self.config["BLUEPRINTS"]:
            try:
                logger.info("Registering blueprint: %s", bp.name)
                self.superset_app.register_blueprint(bp)
            except Exception:  # pylint: disable=broad-except
                logger.exception("blueprint registration failed")

    def setup_bundle_manifest(self) -> None:
        manifest_processor.init_app(self.superset_app)

    def enable_profiling(self) -> None:
        if self.config["PROFILING"]:
            profiling.init_app(self.superset_app)


class SupersetIndexView(IndexView):
    @expose("/")
    def index(self) -> FlaskResponse:
        return redirect("/superset/welcome/")
