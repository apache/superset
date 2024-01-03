from flask_babel import gettext as __

from superset.extensions import appbuilder, feature_flag_manager
from superset.initialization import SupersetAppInitializer


class DVTAppInitializer(SupersetAppInitializer):
    def init_views(self) -> None:
        # pylint: disable=import-outside-toplevel
        #
        # We're doing local imports, as several of them import
        # models which in turn try to import
        # the global Flask app
        #
        # pylint: disable=import-outside-toplevel,too-many-locals,too-many-statements
        from superset import security_manager
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
        from superset.dashboards.filter_sets.api import FilterSetRestApi
        from superset.dashboards.filter_state.api import DashboardFilterStateRestApi
        from superset.dashboards.permalink.api import DashboardPermalinkRestApi
        from superset.databases.api import DatabaseRestApi
        from superset.datasets.api import DatasetRestApi
        from superset.datasets.columns.api import DatasetColumnsRestApi
        from superset.datasets.metrics.api import DatasetMetricRestApi
        from superset.datasource.api import DatasourceRestApi
        from superset.dvt_auth.login import DVTAuthDBView
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
        from superset.views.all_entities import TaggedObjectsModelView, TaggedObjectView
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
        from superset.views.database.views import (
            ColumnarToDatabaseView,
            CsvToDatabaseView,
            DatabaseView,
            ExcelToDatabaseView,
        )
        from superset.views.datasource.views import DatasetEditor, Datasource
        from superset.views.dvt_sqllab import DVTSqlHubView
        from superset.views.dynamic_plugins import DynamicPluginsView
        from superset.views.explore import ExplorePermalinkView, ExploreView
        from superset.views.key_value import KV
        from superset.views.log.api import LogRestApi
        from superset.views.log.views import LogModelView
        from superset.views.profile import ProfileView
        from superset.views.redirects import R
        from superset.views.sql_lab.views import (
            SavedQueryView,
            SavedQueryViewApi,
            SqlLab,
            TableSchemaView,
            TabStateView,
        )
        from superset.views.tags import TagModelView, TagView
        from superset.views.users.api import CurrentUserRestApi

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
        appbuilder.add_api(FilterSetRestApi)
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
        appbuilder.add_view_no_menu(CsvToDatabaseView)
        appbuilder.add_view_no_menu(ExcelToDatabaseView)
        appbuilder.add_view_no_menu(ColumnarToDatabaseView)
        appbuilder.add_view_no_menu(Dashboard)
        appbuilder.add_view_no_menu(DashboardModelViewAsync)
        appbuilder.add_view_no_menu(Datasource)
        appbuilder.add_view_no_menu(DatasetEditor)
        appbuilder.add_view_no_menu(EmbeddedView)
        appbuilder.add_view_no_menu(ExploreView)
        appbuilder.add_view_no_menu(ExplorePermalinkView)
        appbuilder.add_view_no_menu(KV)
        appbuilder.add_view_no_menu(R)
        appbuilder.add_view_no_menu(ProfileView)
        appbuilder.add_view_no_menu(SavedQueryView)
        appbuilder.add_view_no_menu(SavedQueryViewApi)
        appbuilder.add_view_no_menu(SliceAsync)
        appbuilder.add_view_no_menu(SqlLab)
        appbuilder.add_view_no_menu(DVTSqlHubView)
        appbuilder.add_view_no_menu(SqlMetricInlineView)
        appbuilder.add_view_no_menu(Superset)
        appbuilder.add_view_no_menu(TableColumnInlineView)
        appbuilder.add_view_no_menu(TableModelView)
        appbuilder.add_view_no_menu(TableSchemaView)
        appbuilder.add_view_no_menu(TabStateView)
        appbuilder.add_view_no_menu(TaggedObjectView)
        appbuilder.add_view_no_menu(TaggedObjectsModelView)
        appbuilder.add_view_no_menu(TagView)
        appbuilder.add_view_no_menu(ReportView)

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
            cond=lambda: (
                security_manager.can_access("can_import_dashboards", "Superset")
                and not feature_flag_manager.is_feature_enabled("VERSIONED_EXPORT")
            ),
        )

        appbuilder.add_link(
            "SQL Editor",
            label=__("SQL Lab"),
            href="/sqlhub/",
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
            href="/sqlhub/history/",
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

        appbuilder.add_view(
            DVTAuthDBView,
            href="/login/",
            name="Login",
            category="Security",
            category_icon="fa-cogs",
            icon="fa-group",
        )
