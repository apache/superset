from datetime import datetime
import json
import logging

from flask import flash, Markup, redirect
from flask_appbuilder import CompactCRUDMixin, expose
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import gettext as __
from flask_babel import lazy_gettext as _

from superset import appbuilder, db, security, sm, utils
from superset.connectors.base.views import DatasourceModelView
from superset.connectors.connector_registry import ConnectorRegistry
from superset.utils import has_access
from superset.views.base import (
    BaseSupersetView, DatasourceFilter, DeleteMixin,
    get_datasource_exist_error_mgs, ListWidgetWithCheckboxes, SupersetModelView,
    validate_json, YamlExportMixin,
)
from . import models


class DruidColumnInlineView(CompactCRUDMixin, SupersetModelView):  # noqa
    datamodel = SQLAInterface(models.DruidColumn)

    list_title = _('List Druid Column')
    show_title = _('Show Druid Column')
    add_title = _('Add Druid Column')
    edit_title = _('Edit Druid Column')

    edit_columns = [
        'column_name', 'description', 'dimension_spec_json', 'datasource',
        'groupby', 'filterable', 'count_distinct', 'sum', 'min', 'max']
    add_columns = edit_columns
    list_columns = [
        'column_name', 'verbose_name', 'type', 'groupby', 'filterable', 'count_distinct',
        'sum', 'min', 'max']
    can_delete = False
    page_size = 500
    label_columns = {
        'column_name': _('Column'),
        'type': _('Type'),
        'datasource': _('Datasource'),
        'groupby': _('Groupable'),
        'filterable': _('Filterable'),
        'count_distinct': _('Count Distinct'),
        'sum': _('Sum'),
        'min': _('Min'),
        'max': _('Max'),
    }
    description_columns = {
        'filterable': _(
            'Whether this column is exposed in the `Filters` section '
            'of the explore view.'),
        'dimension_spec_json': utils.markdown(
            'this field can be used to specify  '
            'a `dimensionSpec` as documented [here]'
            '(http://druid.io/docs/latest/querying/dimensionspecs.html). '
            'Make sure to input valid JSON and that the '
            '`outputName` matches the `column_name` defined '
            'above.',
            True),
    }

    def pre_update(self, col):
        # If a dimension spec JSON is given, ensure that it is
        # valid JSON and that `outputName` is specified
        if col.dimension_spec_json:
            try:
                dimension_spec = json.loads(col.dimension_spec_json)
            except ValueError as e:
                raise ValueError('Invalid Dimension Spec JSON: ' + str(e))
            if not isinstance(dimension_spec, dict):
                raise ValueError('Dimension Spec must be a JSON object')
            if 'outputName' not in dimension_spec:
                raise ValueError('Dimension Spec does not contain `outputName`')
            if 'dimension' not in dimension_spec:
                raise ValueError('Dimension Spec is missing `dimension`')
            # `outputName` should be the same as the `column_name`
            if dimension_spec['outputName'] != col.column_name:
                raise ValueError(
                    '`outputName` [{}] unequal to `column_name` [{}]'
                    .format(dimension_spec['outputName'], col.column_name))

    def post_update(self, col):
        col.generate_metrics()

    def post_add(self, col):
        self.post_update(col)


appbuilder.add_view_no_menu(DruidColumnInlineView)


class DruidMetricInlineView(CompactCRUDMixin, SupersetModelView):  # noqa
    datamodel = SQLAInterface(models.DruidMetric)

    list_title = _('List Druid Metric')
    show_title = _('Show Druid Metric')
    add_title = _('Add Druid Metric')
    edit_title = _('Edit Druid Metric')

    list_columns = ['metric_name', 'verbose_name', 'metric_type']
    edit_columns = [
        'metric_name', 'description', 'verbose_name', 'metric_type', 'json',
        'datasource', 'd3format', 'is_restricted', 'warning_text']
    add_columns = edit_columns
    page_size = 500
    validators_columns = {
        'json': [validate_json],
    }
    description_columns = {
        'metric_type': utils.markdown(
            'use `postagg` as the metric type if you are defining a '
            '[Druid Post Aggregation]'
            '(http://druid.io/docs/latest/querying/post-aggregations.html)',
            True),
        'is_restricted': _('Whether the access to this metric is restricted '
                           'to certain roles. Only roles with the permission '
                           "'metric access on XXX (the name of this metric)' "
                           'are allowed to access this metric'),
    }
    label_columns = {
        'metric_name': _('Metric'),
        'description': _('Description'),
        'verbose_name': _('Verbose Name'),
        'metric_type': _('Type'),
        'json': _('JSON'),
        'datasource': _('Druid Datasource'),
        'warning_text': _('Warning Message'),
    }

    def post_add(self, metric):
        if metric.is_restricted:
            security.merge_perm(sm, 'metric_access', metric.get_perm())

    def post_update(self, metric):
        if metric.is_restricted:
            security.merge_perm(sm, 'metric_access', metric.get_perm())


appbuilder.add_view_no_menu(DruidMetricInlineView)


class DruidClusterModelView(SupersetModelView, DeleteMixin, YamlExportMixin):  # noqa
    datamodel = SQLAInterface(models.DruidCluster)

    list_title = _('List Druid Cluster')
    show_title = _('Show Druid Cluster')
    add_title = _('Add Druid Cluster')
    edit_title = _('Edit Druid Cluster')

    add_columns = [
        'verbose_name', 'coordinator_host', 'coordinator_port',
        'coordinator_endpoint', 'broker_host', 'broker_port',
        'broker_endpoint', 'cache_timeout', 'cluster_name',
    ]
    edit_columns = add_columns
    list_columns = ['cluster_name', 'metadata_last_refreshed']
    search_columns = ('cluster_name',)
    label_columns = {
        'cluster_name': _('Cluster'),
        'coordinator_host': _('Coordinator Host'),
        'coordinator_port': _('Coordinator Port'),
        'coordinator_endpoint': _('Coordinator Endpoint'),
        'broker_host': _('Broker Host'),
        'broker_port': _('Broker Port'),
        'broker_endpoint': _('Broker Endpoint'),
    }

    def pre_add(self, cluster):
        security.merge_perm(sm, 'database_access', cluster.perm)

    def pre_update(self, cluster):
        self.pre_add(cluster)

    def _delete(self, pk):
        DeleteMixin._delete(self, pk)


appbuilder.add_view(
    DruidClusterModelView,
    name='Druid Clusters',
    label=__('Druid Clusters'),
    icon='fa-cubes',
    category='Sources',
    category_label=__('Sources'),
    category_icon='fa-database',)


class DruidDatasourceModelView(DatasourceModelView, DeleteMixin, YamlExportMixin):  # noqa
    datamodel = SQLAInterface(models.DruidDatasource)

    list_title = _('List Druid Datasource')
    show_title = _('Show Druid Datasource')
    add_title = _('Add Druid Datasource')
    edit_title = _('Edit Druid Datasource')

    list_widget = ListWidgetWithCheckboxes
    list_columns = [
        'datasource_link', 'cluster', 'changed_by_', 'modified']
    order_columns = ['datasource_link', 'modified']
    related_views = [DruidColumnInlineView, DruidMetricInlineView]
    edit_columns = [
        'datasource_name', 'cluster', 'slices', 'description', 'owner',
        'is_hidden',
        'filter_select_enabled', 'fetch_values_from',
        'default_endpoint', 'offset', 'cache_timeout']
    search_columns = (
        'datasource_name', 'cluster', 'description', 'owner',
    )
    add_columns = edit_columns
    show_columns = add_columns + ['perm']
    page_size = 500
    base_order = ('datasource_name', 'asc')
    description_columns = {
        'slices': _(
            'The list of slices associated with this table. By '
            'altering this datasource, you may change how these associated '
            'slices behave. '
            'Also note that slices need to point to a datasource, so '
            'this form will fail at saving if removing slices from a '
            'datasource. If you want to change the datasource for a slice, '
            "overwrite the slice from the 'explore view'"),
        'offset': _('Timezone offset (in hours) for this datasource'),
        'description': Markup(
            'Supports <a href="'
            'https://daringfireball.net/projects/markdown/">markdown</a>'),
        'fetch_values_from': _(
            'Time expression to use as a predicate when retrieving '
            'distinct values to populate the filter component. '
            'Only applies when `Enable Filter Select` is on. If '
            'you enter `7 days ago`, the distinct list of values in '
            'the filter will be populated based on the distinct value over '
            'the past week'),
        'filter_select_enabled': _(
            "Whether to populate the filter's dropdown in the explore "
            "view's filter section with a list of distinct values fetched "
            'from the backend on the fly'),
        'default_endpoint': _(
            'Redirects to this endpoint when clicking on the datasource '
            'from the datasource list'),
    }
    base_filters = [['id', DatasourceFilter, lambda: []]]
    label_columns = {
        'slices': _('Associated Slices'),
        'datasource_link': _('Data Source'),
        'cluster': _('Cluster'),
        'description': _('Description'),
        'owner': _('Owner'),
        'is_hidden': _('Is Hidden'),
        'filter_select_enabled': _('Enable Filter Select'),
        'default_endpoint': _('Default Endpoint'),
        'offset': _('Time Offset'),
        'cache_timeout': _('Cache Timeout'),
    }

    def pre_add(self, datasource):
        with db.session.no_autoflush:
            query = (
                db.session.query(models.DruidDatasource)
                .filter(models.DruidDatasource.datasource_name ==
                        datasource.datasource_name,
                        models.DruidDatasource.cluster_name ==
                        datasource.cluster.id)
            )
            if db.session.query(query.exists()).scalar():
                raise Exception(get_datasource_exist_error_mgs(
                    datasource.full_name))

    def post_add(self, datasource):
        datasource.generate_metrics()
        security.merge_perm(sm, 'datasource_access', datasource.get_perm())
        if datasource.schema:
            security.merge_perm(sm, 'schema_access', datasource.schema_perm)

    def post_update(self, datasource):
        self.post_add(datasource)

    def _delete(self, pk):
        DeleteMixin._delete(self, pk)


appbuilder.add_view(
    DruidDatasourceModelView,
    'Druid Datasources',
    label=__('Druid Datasources'),
    category='Sources',
    category_label=__('Sources'),
    icon='fa-cube')


class Druid(BaseSupersetView):
    """The base views for Superset!"""

    @has_access
    @expose('/refresh_datasources/')
    def refresh_datasources(self, refreshAll=True):
        """endpoint that refreshes druid datasources metadata"""
        session = db.session()
        DruidCluster = ConnectorRegistry.sources['druid'].cluster_class
        for cluster in session.query(DruidCluster).all():
            cluster_name = cluster.cluster_name
            try:
                cluster.refresh_datasources(refreshAll=refreshAll)
            except Exception as e:
                flash(
                    "Error while processing cluster '{}'\n{}".format(
                        cluster_name, utils.error_msg_from_exception(e)),
                    'danger')
                logging.exception(e)
                return redirect('/druidclustermodelview/list/')
            cluster.metadata_last_refreshed = datetime.now()
            flash(
                'Refreshed metadata from cluster '
                '[' + cluster.cluster_name + ']',
                'info')
        session.commit()
        return redirect('/druiddatasourcemodelview/list/')

    @has_access
    @expose('/scan_new_datasources/')
    def scan_new_datasources(self):
        """
        Calling this endpoint will cause a scan for new
        datasources only and add them.
        """
        return self.refresh_datasources(refreshAll=False)


appbuilder.add_view_no_menu(Druid)

appbuilder.add_link(
    'Scan New Datasources',
    label=__('Scan New Datasources'),
    href='/druid/scan_new_datasources/',
    category='Sources',
    category_label=__('Sources'),
    category_icon='fa-database',
    icon='fa-refresh')
appbuilder.add_link(
    'Refresh Druid Metadata',
    label=__('Refresh Druid Metadata'),
    href='/druid/refresh_datasources/',
    category='Sources',
    category_label=__('Sources'),
    category_icon='fa-database',
    icon='fa-cog')


appbuilder.add_separator('Sources', )
