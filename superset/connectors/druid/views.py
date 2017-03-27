from datetime import datetime
import logging

import sqlalchemy as sqla

from flask import Markup, flash, redirect
from flask_appbuilder import CompactCRUDMixin, expose
from flask_appbuilder.models.sqla.interface import SQLAInterface

from flask_babel import lazy_gettext as _
from flask_babel import gettext as __

import superset
from superset import db, utils, appbuilder, sm, security
from superset.connectors.connector_registry import ConnectorRegistry
from superset.utils import has_access
from superset.views.base import BaseSupersetView
from superset.views.base import (
    SupersetModelView, validate_json, DeleteMixin, ListWidgetWithCheckboxes,
    DatasourceFilter, get_datasource_exist_error_mgs)

from . import models


class DruidColumnInlineView(CompactCRUDMixin, SupersetModelView):  # noqa
    datamodel = SQLAInterface(models.DruidColumn)
    edit_columns = [
        'column_name', 'description', 'dimension_spec_json', 'datasource',
        'groupby', 'count_distinct', 'sum', 'min', 'max']
    add_columns = edit_columns
    list_columns = [
        'column_name', 'type', 'groupby', 'filterable', 'count_distinct',
        'sum', 'min', 'max']
    can_delete = False
    page_size = 500
    label_columns = {
        'column_name': _("Column"),
        'type': _("Type"),
        'datasource': _("Datasource"),
        'groupby': _("Groupable"),
        'filterable': _("Filterable"),
        'count_distinct': _("Count Distinct"),
        'sum': _("Sum"),
        'min': _("Min"),
        'max': _("Max"),
    }
    description_columns = {
        'dimension_spec_json': utils.markdown(
            "this field can be used to specify  "
            "a `dimensionSpec` as documented [here]"
            "(http://druid.io/docs/latest/querying/dimensionspecs.html). "
            "Make sure to input valid JSON and that the "
            "`outputName` matches the `column_name` defined "
            "above.",
            True),
    }

    def post_update(self, col):
        col.generate_metrics()
        utils.validate_json(col.dimension_spec_json)

    def post_add(self, col):
        self.post_update(col)

appbuilder.add_view_no_menu(DruidColumnInlineView)


class DruidMetricInlineView(CompactCRUDMixin, SupersetModelView):  # noqa
    datamodel = SQLAInterface(models.DruidMetric)
    list_columns = ['metric_name', 'verbose_name', 'metric_type']
    edit_columns = [
        'metric_name', 'description', 'verbose_name', 'metric_type', 'json',
        'datasource', 'd3format', 'is_restricted']
    add_columns = edit_columns
    page_size = 500
    validators_columns = {
        'json': [validate_json],
    }
    description_columns = {
        'metric_type': utils.markdown(
            "use `postagg` as the metric type if you are defining a "
            "[Druid Post Aggregation]"
            "(http://druid.io/docs/latest/querying/post-aggregations.html)",
            True),
        'is_restricted': _("Whether the access to this metric is restricted "
                           "to certain roles. Only roles with the permission "
                           "'metric access on XXX (the name of this metric)' "
                           "are allowed to access this metric"),
    }
    label_columns = {
        'metric_name': _("Metric"),
        'description': _("Description"),
        'verbose_name': _("Verbose Name"),
        'metric_type': _("Type"),
        'json': _("JSON"),
        'datasource': _("Druid Datasource"),
    }

    def post_add(self, metric):
        utils.init_metrics_perm(superset, [metric])

    def post_update(self, metric):
        utils.init_metrics_perm(superset, [metric])


appbuilder.add_view_no_menu(DruidMetricInlineView)


class DruidClusterModelView(SupersetModelView, DeleteMixin):  # noqa
    datamodel = SQLAInterface(models.DruidCluster)
    add_columns = [
        'verbose_name', 'coordinator_host', 'coordinator_port',
        'coordinator_endpoint', 'broker_host', 'broker_port',
        'broker_endpoint', 'cache_timeout', 'cluster_name',
    ]
    edit_columns = add_columns
    list_columns = ['cluster_name', 'metadata_last_refreshed']
    label_columns = {
        'cluster_name': _("Cluster"),
        'coordinator_host': _("Coordinator Host"),
        'coordinator_port': _("Coordinator Port"),
        'coordinator_endpoint': _("Coordinator Endpoint"),
        'broker_host': _("Broker Host"),
        'broker_port': _("Broker Port"),
        'broker_endpoint': _("Broker Endpoint"),
    }

    def pre_add(self, cluster):
        security.merge_perm(sm, 'database_access', cluster.perm)

    def pre_update(self, cluster):
        self.pre_add(cluster)


appbuilder.add_view(
    DruidClusterModelView,
    name="Druid Clusters",
    label=__("Druid Clusters"),
    icon="fa-cubes",
    category="Sources",
    category_label=__("Sources"),
    category_icon='fa-database',)


class DruidDatasourceModelView(SupersetModelView, DeleteMixin):  # noqa
    datamodel = SQLAInterface(models.DruidDatasource)
    list_widget = ListWidgetWithCheckboxes
    list_columns = [
        'datasource_link', 'cluster', 'changed_by_', 'changed_on_', 'offset']
    order_columns = [
        'datasource_link', 'changed_on_', 'offset']
    related_views = [DruidColumnInlineView, DruidMetricInlineView]
    edit_columns = [
        'datasource_name', 'cluster', 'description', 'owner',
        'is_featured', 'is_hidden',
        'filter_select_enabled', 'fetch_values_from',
        'default_endpoint', 'offset', 'cache_timeout']
    add_columns = edit_columns
    show_columns = add_columns + ['perm']
    page_size = 500
    base_order = ('datasource_name', 'asc')
    description_columns = {
        'offset': _("Timezone offset (in hours) for this datasource"),
        'description': Markup(
            "Supports <a href='"
            "https://daringfireball.net/projects/markdown/'>markdown</a>"),
        'fetch_values_from': _(
            "Time expression to use as a predicate when retrieving "
            "distinct values to populate the filter component"),
    }
    base_filters = [['id', DatasourceFilter, lambda: []]]
    label_columns = {
        'datasource_link': _("Data Source"),
        'cluster': _("Cluster"),
        'description': _("Description"),
        'owner': _("Owner"),
        'is_featured': _("Is Featured"),
        'is_hidden': _("Is Hidden"),
        'filter_select_enabled': _("Enable Filter Select"),
        'default_endpoint': _("Default Endpoint"),
        'offset': _("Time Offset"),
        'cache_timeout': _("Cache Timeout"),
    }

    def pre_add(self, datasource):
        number_of_existing_datasources = db.session.query(
            sqla.func.count('*')).filter(
            models.DruidDatasource.datasource_name ==
                datasource.datasource_name,
            models.DruidDatasource.cluster_name == datasource.cluster.id
        ).scalar()

        # table object is already added to the session
        if number_of_existing_datasources > 1:
            raise Exception(get_datasource_exist_error_mgs(
                datasource.full_name))

    def post_add(self, datasource):
        datasource.generate_metrics()
        security.merge_perm(sm, 'datasource_access', datasource.get_perm())
        if datasource.schema:
            security.merge_perm(sm, 'schema_access', datasource.schema_perm)

    def post_update(self, datasource):
        self.post_add(datasource)

appbuilder.add_view(
    DruidDatasourceModelView,
    "Druid Datasources",
    label=__("Druid Datasources"),
    category="Sources",
    category_label=__("Sources"),
    icon="fa-cube")


class Druid(BaseSupersetView):
    """The base views for Superset!"""

    @has_access
    @expose("/refresh_datasources/")
    def refresh_datasources(self):
        """endpoint that refreshes druid datasources metadata"""
        session = db.session()
        DruidCluster = ConnectorRegistry.sources['druid'].cluster_class
        for cluster in session.query(DruidCluster).all():
            cluster_name = cluster.cluster_name
            try:
                cluster.refresh_datasources()
            except Exception as e:
                flash(
                    "Error while processing cluster '{}'\n{}".format(
                        cluster_name, utils.error_msg_from_exception(e)),
                    "danger")
                logging.exception(e)
                return redirect('/druidclustermodelview/list/')
            cluster.metadata_last_refreshed = datetime.now()
            flash(
                "Refreshed metadata from cluster "
                "[" + cluster.cluster_name + "]",
                'info')
        session.commit()
        return redirect("/druiddatasourcemodelview/list/")

appbuilder.add_view_no_menu(Druid)

appbuilder.add_link(
    "Refresh Druid Metadata",
    label=__("Refresh Druid Metadata"),
    href='/druid/refresh_datasources/',
    category='Sources',
    category_label=__("Sources"),
    category_icon='fa-database',
    icon="fa-cog")


appbuilder.add_separator("Sources", )
