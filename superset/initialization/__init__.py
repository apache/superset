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
from typing import Any, Callable, TYPE_CHECKING

import wtforms_json
from deprecation import deprecated
from flask import abort, Flask, redirect, request, session, url_for
from flask_appbuilder import expose, IndexView
from flask_appbuilder.api import safe
from flask_appbuilder.utils.base import get_safe_redirect

# using lazy_gettext since initialization happens prior to the request scope
# and confuses flask-babel
from flask_babel import lazy_gettext as _, refresh
from flask_compress import Compress
from flask_session import Session
from sqlalchemy import inspect
from werkzeug.middleware.proxy_fix import ProxyFix

from superset.constants import CHANGE_ME_SECRET_KEY
from superset.databases.utils import make_url_safe
from superset.extensions import (
    _event_logger,
    APP_DIR,
    appbuilder,
    async_query_manager_factory,
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
    ssh_manager_factory,
    stats_logger_manager,
    talisman,
)
from superset.security import SupersetSecurityManager
from superset.sql.parse import SQLGLOT_DIALECTS
from superset.superset_typing import FlaskResponse
from superset.tags.core import register_sqla_event_listeners
from superset.utils.core import is_test, pessimistic_connection_handling
from superset.utils.decorators import transaction
from superset.utils.log import DBEventLogger, get_event_logger_from_cfg_value

if TYPE_CHECKING:
    from superset.app import SupersetApp

logger = logging.getLogger(__name__)


class SupersetAppInitializer:  # pylint: disable=too-many-public-methods
    def __init__(self, app: SupersetApp) -> None:
        super().__init__()

        self.superset_app = app
        self.config = app.config
        self.manifest: dict[Any, Any] = {}

    @deprecated(details="use self.superset_app instead of self.flask_app")  # type: ignore
    @property
    def flask_app(self) -> SupersetApp:
        return self.superset_app

    def pre_init(self) -> None:
        """
        Called before all other init tasks are complete
        """
        wtforms_json.init()

        os.makedirs(self.config["DATA_DIR"], exist_ok=True)

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
        from superset.advanced_data_type.api import AdvancedDataTypeRestApi
        from superset.annotation_layers.annotations.api import AnnotationRestApi
        from superset.annotation_layers.api import AnnotationLayerRestApi
        from superset.async_events.api import AsyncEventsRestApi
        from superset.available_domains.api import AvailableDomainsRestApi
        from superset.cachekeys.api import CacheRestApi
        from superset.charts.api import ChartRestApi
        from superset.charts.data.api import ChartDataRestApi
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
        from superset.security.api import (
            RoleRestAPI,
            SecurityRestApi,
            UserRegistrationsRestAPI,
        )
        from superset.sqllab.api import SqlLabRestApi
        from superset.sqllab.permalink.api import SqlLabPermalinkRestApi
        from superset.tags.api import TagRestApi
        from superset.themes.api import ThemeRestApi
        from superset.views.alerts import AlertView, ReportView
        from superset.views.all_entities import TaggedObjectsModelView
        from superset.views.annotations import AnnotationLayerView
        from superset.views.api import Api
        from superset.views.chart.views import SliceModelView
        from superset.views.core import Superset
        from superset.views.css_templates import CssTemplateModelView
        from superset.views.dashboard.views import (
            Dashboard,
            DashboardModelView,
        )
        from superset.views.database.views import DatabaseView
        from superset.views.datasource.views import DatasetEditor, Datasource
        from superset.views.dynamic_plugins import DynamicPluginsView
        from superset.views.error_handling import set_app_error_handlers
        from superset.views.explore import ExplorePermalinkView, ExploreView
        from superset.views.groups import GroupsListView
        from superset.views.log.api import LogRestApi
        from superset.views.logs import ActionLogView
        from superset.views.roles import RolesListView
        from superset.views.sql_lab.views import (
            SavedQueryView,
            TableSchemaView,
            TabStateView,
        )
        from superset.views.sqla import (
            RowLevelSecurityView,
            TableModelView,
        )
        from superset.views.sqllab import SqllabView
        from superset.views.tags import TagModelView, TagView
        from superset.views.themes import ThemeModelView
        from superset.views.user_info import UserInfoView
        from superset.views.user_registrations import UserRegistrationsView
        from superset.views.users.api import CurrentUserRestApi, UserRestApi
        from superset.views.users_list import UsersListView

        set_app_error_handlers(self.superset_app)

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
        appbuilder.add_api(ThemeRestApi)
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
        appbuilder.add_api(SqlLabPermalinkRestApi)
        appbuilder.add_api(LogRestApi)
        #
        # Setup regular views
        #
        app_root = appbuilder.app.config["APPLICATION_ROOT"]
        if app_root.endswith("/"):
            app_root = app_root.rstrip("/")

        appbuilder.add_link(
            "Home",
            label=_("Home"),
            href="/superset/welcome/",
            cond=lambda: bool(appbuilder.app.config["LOGO_TARGET_PATH"]),
        )

        appbuilder.add_view(
            DatabaseView,
            "Databases",
            label=_("Database Connections"),
            icon="fa-database",
            category="Data",
            category_label=_("Data"),
        )
        appbuilder.add_view(
            DashboardModelView,
            "Dashboards",
            label=_("Dashboards"),
            icon="fa-dashboard",
            category="",
            category_icon="",
        )
        appbuilder.add_view(
            SliceModelView,
            "Charts",
            label=_("Charts"),
            icon="fa-bar-chart",
            category="",
            category_icon="",
        )

        appbuilder.add_link(
            "Datasets",
            label=_("Datasets"),
            href=f"{app_root}/tablemodelview/list/",
            icon="fa-table",
            category="",
            category_icon="",
        )

        appbuilder.add_view(
            RolesListView,
            "List Roles",
            label=_("List Roles"),
            category="Security",
            category_label=_("Security"),
            menu_cond=lambda: bool(
                appbuilder.app.config.get("SUPERSET_SECURITY_VIEW_MENU", True)
            ),
        )

        appbuilder.add_view(
            UserRegistrationsView,
            "User Registrations",
            label=_("User Registrations"),
            category="Security",
            category_label=_("Security"),
            menu_cond=lambda: bool(appbuilder.app.config["AUTH_USER_REGISTRATION"]),
        )

        appbuilder.add_view(
            UsersListView,
            "List Users",
            label=_("List Users"),
            category="Security",
            category_label=_("Security"),
            menu_cond=lambda: bool(
                appbuilder.app.config.get("SUPERSET_SECURITY_VIEW_MENU", True)
            ),
        )

        appbuilder.add_view(
            GroupsListView,
            "List Groups",
            label=_("List Groups"),
            category="Security",
            category_label=_("Security"),
            menu_cond=lambda: bool(
                appbuilder.app.config.get("SUPERSET_SECURITY_VIEW_MENU", True)
            ),
        )

        appbuilder.add_view(
            DynamicPluginsView,
            "Plugins",
            label=_("Plugins"),
            category="Manage",
            category_label=_("Manage"),
            icon="fa-puzzle-piece",
            menu_cond=lambda: feature_flag_manager.is_feature_enabled(
                "DYNAMIC_PLUGINS"
            ),
        )
        appbuilder.add_view(
            CssTemplateModelView,
            "CSS Templates",
            label=_("CSS Templates"),
            icon="fa-css3",
            category="Manage",
            category_label=_("Manage"),
            category_icon="",
            menu_cond=lambda: feature_flag_manager.is_feature_enabled("CSS_TEMPLATES"),
        )
        appbuilder.add_view(
            ThemeModelView,
            "Themes",
            href="/theme/list/",
            label=_("Themes"),
            icon="fa-palette",
            category="Manage",
            category_label=_("Manage"),
            category_icon="",
        )

        #
        # Setup views with no menu
        #
        appbuilder.add_view_no_menu(Api)
        appbuilder.add_view_no_menu(Dashboard)
        appbuilder.add_view_no_menu(Datasource)
        appbuilder.add_view_no_menu(DatasetEditor)
        appbuilder.add_view_no_menu(EmbeddedView)
        appbuilder.add_view_no_menu(ExploreView)
        appbuilder.add_view_no_menu(ExplorePermalinkView)
        appbuilder.add_view_no_menu(SavedQueryView)
        appbuilder.add_view_no_menu(SqllabView)
        appbuilder.add_view_no_menu(Superset)
        appbuilder.add_view_no_menu(TableModelView)
        appbuilder.add_view_no_menu(TableSchemaView)
        appbuilder.add_view_no_menu(TabStateView)
        appbuilder.add_view_no_menu(TaggedObjectsModelView)
        appbuilder.add_view_no_menu(TagView)
        appbuilder.add_view_no_menu(ReportView)
        appbuilder.add_view_no_menu(RoleRestAPI)
        appbuilder.add_view_no_menu(UserInfoView)

        #
        # Add links
        #
        appbuilder.add_link(
            "SQL Editor",
            label=_("SQL Lab"),
            href=f"{app_root}/sqllab/",
            category_icon="fa-flask",
            icon="fa-flask",
            category="SQL Lab",
            category_label=_("SQL"),
        )
        appbuilder.add_link(
            "Saved Queries",
            label=_("Saved Queries"),
            href=f"{app_root}/savedqueryview/list/",
            icon="fa-save",
            category="SQL Lab",
            category_label=_("SQL"),
        )
        appbuilder.add_link(
            "Query Search",
            label=_("Query History"),
            href=f"{app_root}/sqllab/history/",
            icon="fa-search",
            category_icon="fa-flask",
            category="SQL Lab",
            category_label=_("SQL Lab"),
        )
        appbuilder.add_view(
            TagModelView,
            "Tags",
            label=_("Tags"),
            icon="",
            category_icon="",
            category="Manage",
            menu_cond=lambda: feature_flag_manager.is_feature_enabled("TAGGING_SYSTEM"),
        )
        appbuilder.add_api(LogRestApi)
        appbuilder.add_api(UserRegistrationsRestAPI)
        appbuilder.add_view(
            ActionLogView,
            "Action Log",
            label=_("Action Log"),
            category="Security",
            category_label=_("Security"),
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
            label=_("Alerts & Reports"),
            category="Manage",
            category_label=_("Manage"),
            icon="fa-exclamation-triangle",
            menu_cond=lambda: feature_flag_manager.is_feature_enabled("ALERT_REPORTS"),
        )

        appbuilder.add_view(
            AnnotationLayerView,
            "Annotation Layers",
            label=_("Annotation Layers"),
            href="AnnotationLayerView.list",
            icon="fa-comment",
            category_icon="",
            category="Manage",
            category_label=_("Manage"),
        )

        appbuilder.add_view(
            RowLevelSecurityView,
            "Row Level Security",
            href="RowLevelSecurityView.list",
            label=_("Row Level Security"),
            category="Security",
            category_label=_("Security"),
            icon="fa-lock",
        )

    def _init_database_dependent_features(self) -> None:
        """
        Initialize features that require database tables to exist.
        This is called during app initialization but checks table existence
        to handle cases where the app starts before database migration.
        """
        inspector = inspect(db.engine)

        # Check if core tables exist (use 'dashboards' as proxy for Superset tables)
        if not inspector.has_table("dashboards"):
            logger.debug(
                "Superset tables not yet created. Skipping database-dependent "
                "initialization. These features will be initialized after migration."
            )
            return

        # Register SQLA event listeners for tagging system
        if feature_flag_manager.is_feature_enabled("TAGGING_SYSTEM"):
            register_sqla_event_listeners()

        # Seed system themes from configuration
        from superset.commands.theme.seed import SeedSystemThemesCommand

        SeedSystemThemesCommand().run()

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
            flask_app_mutator(self.superset_app)

        # Initialize database-dependent features only if database is ready
        self._init_database_dependent_features()

        self.init_views()

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
                "a sufficiently random sequence, ex: openssl rand -base64 42 \n"
                "For more info, see: https://superset.apache.org/docs/"
                "configuration/configuring-superset#specifying-a-secret_key"
            )
            logger.warning(bottom_banner)

        if self.config["SECRET_KEY"] == CHANGE_ME_SECRET_KEY:
            if (
                self.superset_app.debug
                or self.superset_app.config["TESTING"]
                or is_test()
            ):
                logger.warning("Debug mode identified with default secret key")
                log_default_secret_key_warning()
                return
            log_default_secret_key_warning()
            logger.error("Refusing to start due to insecure SECRET_KEY")
            sys.exit(1)

    def configure_session(self) -> None:
        if self.config["SESSION_SERVER_SIDE"]:
            Session(self.superset_app)

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
        self.set_db_default_isolation()
        self.configure_sqlglot_dialects()

        with self.superset_app.app_context():
            self.init_app_in_ctx()

        self.post_init()

    def set_db_default_isolation(self) -> None:
        # This block sets the default isolation level for mysql to READ COMMITTED if not
        # specified in the config. You can set your isolation in the config by using
        # SQLALCHEMY_ENGINE_OPTIONS
        eng_options = self.config["SQLALCHEMY_ENGINE_OPTIONS"] or {}
        isolation_level = eng_options.get("isolation_level")
        set_isolation_level_to = None

        if not isolation_level:
            backend = make_url_safe(
                self.config["SQLALCHEMY_DATABASE_URI"]
            ).get_backend_name()
            if backend in ("mysql", "postgresql"):
                set_isolation_level_to = "READ COMMITTED"

        if set_isolation_level_to:
            logger.info(
                "Setting database isolation level to %s",
                set_isolation_level_to,
            )
            with self.superset_app.app_context():
                db.engine.execution_options(isolation_level=set_isolation_level_to)

    def configure_auth_provider(self) -> None:
        machine_auth_provider_factory.init_app(self.superset_app)

    def configure_ssh_manager(self) -> None:
        ssh_manager_factory.init_app(self.superset_app)

    def configure_stats_manager(self) -> None:
        stats_logger_manager.init_app(self.superset_app)

    def setup_event_logger(self) -> None:
        _event_logger["event_logger"] = get_event_logger_from_cfg_value(
            self.superset_app.config.get("EVENT_LOGGER", DBEventLogger())
        )

    def configure_data_sources(self) -> None:
        # Registering sources
        module_datasource_map = self.config["DEFAULT_MODULE_DS_MAP"]
        module_datasource_map.update(self.config["ADDITIONAL_MODULE_DS_MAP"])

        # todo(hughhhh): fully remove the datasource config register
        for module_name, class_names in module_datasource_map.items():
            class_names = [str(s) for s in class_names]
            __import__(module_name, fromlist=class_names)

    def configure_cache(self) -> None:
        cache_manager.init_app(self.superset_app)
        results_backend_manager.init_app(self.superset_app)

    def configure_feature_flags(self) -> None:
        feature_flag_manager.init_app(self.superset_app)

    def configure_sqlglot_dialects(self) -> None:
        extensions = self.config["SQLGLOT_DIALECTS_EXTENSIONS"]

        if callable(extensions):
            extensions = extensions()

        SQLGLOT_DIALECTS.update(extensions)

    @transaction()
    def configure_fab(self) -> None:
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

    def configure_middlewares(self) -> None:  # noqa: C901
        if self.config["ENABLE_CORS"]:
            # pylint: disable=import-outside-toplevel
            from flask_cors import CORS

            CORS(self.superset_app, **self.config["CORS_OPTIONS"])

        if self.config["ENABLE_PROXY_FIX"]:
            self.superset_app.wsgi_app = ProxyFix(
                self.superset_app.wsgi_app, **self.config["PROXY_FIX_CONFIG"]
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

            self.superset_app.wsgi_app = ChunkedEncodingFix(self.superset_app.wsgi_app)

        if self.config["UPLOAD_FOLDER"]:
            with contextlib.suppress(OSError):
                os.makedirs(self.config["UPLOAD_FOLDER"])
        for middleware in self.config["ADDITIONAL_MIDDLEWARE"]:
            self.superset_app.wsgi_app = middleware(self.superset_app.wsgi_app)

        # Flask-Compress
        Compress(self.superset_app)

        # Talisman
        talisman_enabled = self.config["TALISMAN_ENABLED"]
        talisman_config = (
            self.config["TALISMAN_DEV_CONFIG"]
            if self.superset_app.debug or self.config["DEBUG"]
            else self.config["TALISMAN_CONFIG"]
        )
        csp_warning = self.config["CONTENT_SECURITY_POLICY_WARNING"]

        if talisman_enabled:
            talisman.init_app(self.superset_app, **talisman_config)

        show_csp_warning = False
        if (
            csp_warning
            and not self.superset_app.debug
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
                "software. Failing to configure CSP have serious security implications. "  # noqa: E501
                "Check https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP for more "
                "information. You can disable this warning using the "
                "CONTENT_SECURITY_POLICY_WARNING key."
            )

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
            async_query_manager_factory.init_app(self.superset_app)

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
        return redirect(url_for("Superset.welcome"))

    @expose("/lang/<string:locale>")
    @safe
    def patch_flask_locale(self, locale: str) -> FlaskResponse:
        """
        Change user's locale and redirect back to the previous page.

        Overrides FAB's babel.views.LocaleView so we can use the request
        Referrer as the redirect target, in case our previous page was actually
        served by the frontend (and thus not added to the session's page_history
        stack).
        """
        if locale not in self.appbuilder.bm.languages:
            abort(404, description="Locale not supported.")
        session["locale"] = locale
        refresh()
        self.update_redirect()

        if redirect_to := request.headers.get("Referer"):
            return redirect(get_safe_redirect(redirect_to))
        return redirect(self.get_redirect())
