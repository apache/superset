# pylint: disable=invalid-unary-operand-type
from collections import OrderedDict
from copy import deepcopy
from datetime import datetime, timedelta
import json
import logging
from multiprocessing.pool import ThreadPool

from dateutil.parser import parse as dparse
from flask import escape, Markup
from flask_appbuilder import Model
from flask_appbuilder.models.decorators import renders
from flask_babel import lazy_gettext as _
from pydruid.client import PyDruid
from pydruid.utils.aggregators import count
from pydruid.utils.filters import Bound, Dimension, Filter
from pydruid.utils.having import Aggregation
from pydruid.utils.postaggregator import (
    Const, Field, HyperUniqueCardinality, Postaggregator, Quantile, Quantiles,
)
import requests
from six import string_types
import sqlalchemy as sa
from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, Integer, or_, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import backref, relationship

from superset import conf, db, import_util, sm, utils
from superset.connectors.base.models import BaseColumn, BaseDatasource, BaseMetric
from superset.models.helpers import (
  AuditMixinNullable, ImportMixin, QueryResult, set_perm,
)
from superset.utils import (
    DimSelector, DTTM_ALIAS, flasher, MetricPermException,
)

DRUID_TZ = conf.get('DRUID_TZ')


# Function wrapper because bound methods cannot
# be passed to processes
def _fetch_metadata_for(datasource):
    return datasource.latest_metadata()


class JavascriptPostAggregator(Postaggregator):
    def __init__(self, name, field_names, function):
        self.post_aggregator = {
            'type': 'javascript',
            'fieldNames': field_names,
            'name': name,
            'function': function,
        }
        self.name = name


class CustomPostAggregator(Postaggregator):
    """A way to allow users to specify completely custom PostAggregators"""
    def __init__(self, name, post_aggregator):
        self.name = name
        self.post_aggregator = post_aggregator


class DruidCluster(Model, AuditMixinNullable, ImportMixin):

    """ORM object referencing the Druid clusters"""

    __tablename__ = 'clusters'
    type = 'druid'

    id = Column(Integer, primary_key=True)
    verbose_name = Column(String(250), unique=True)
    # short unique name, used in permissions
    cluster_name = Column(String(250), unique=True)
    coordinator_host = Column(String(255))
    coordinator_port = Column(Integer, default=8081)
    coordinator_endpoint = Column(
        String(255), default='druid/coordinator/v1/metadata')
    broker_host = Column(String(255))
    broker_port = Column(Integer, default=8082)
    broker_endpoint = Column(String(255), default='druid/v2')
    metadata_last_refreshed = Column(DateTime)
    cache_timeout = Column(Integer)

    export_fields = ('cluster_name', 'coordinator_host', 'coordinator_port',
                     'coordinator_endpoint', 'broker_host', 'broker_port',
                     'broker_endpoint', 'cache_timeout')
    export_children = ['datasources']

    def __repr__(self):
        return self.verbose_name if self.verbose_name else self.cluster_name

    def get_pydruid_client(self):
        cli = PyDruid(
            'http://{0}:{1}/'.format(self.broker_host, self.broker_port),
            self.broker_endpoint)
        return cli

    def get_datasources(self):
        endpoint = (
            'http://{obj.coordinator_host}:{obj.coordinator_port}/'
            '{obj.coordinator_endpoint}/datasources'
        ).format(obj=self)

        return json.loads(requests.get(endpoint).text)

    def get_druid_version(self):
        endpoint = (
            'http://{obj.coordinator_host}:{obj.coordinator_port}/status'
        ).format(obj=self)
        return json.loads(requests.get(endpoint).text)['version']

    def refresh_datasources(
            self,
            datasource_name=None,
            merge_flag=True,
            refreshAll=True):
        """Refresh metadata of all datasources in the cluster
        If ``datasource_name`` is specified, only that datasource is updated
        """
        self.druid_version = self.get_druid_version()
        ds_list = self.get_datasources()
        blacklist = conf.get('DRUID_DATA_SOURCE_BLACKLIST', [])
        ds_refresh = []
        if not datasource_name:
            ds_refresh = list(filter(lambda ds: ds not in blacklist, ds_list))
        elif datasource_name not in blacklist and datasource_name in ds_list:
            ds_refresh.append(datasource_name)
        else:
            return
        self.refresh(ds_refresh, merge_flag, refreshAll)

    def refresh(self, datasource_names, merge_flag, refreshAll):
        """
        Fetches metadata for the specified datasources andm
        merges to the Superset database
        """
        session = db.session
        ds_list = (
            session.query(DruidDatasource)
            .filter(or_(DruidDatasource.datasource_name == name
                    for name in datasource_names))
        )

        ds_map = {ds.name: ds for ds in ds_list}
        for ds_name in datasource_names:
            datasource = ds_map.get(ds_name, None)
            if not datasource:
                datasource = DruidDatasource(datasource_name=ds_name)
                with session.no_autoflush:
                    session.add(datasource)
                flasher(
                    'Adding new datasource [{}]'.format(ds_name), 'success')
                ds_map[ds_name] = datasource
            elif refreshAll:
                flasher(
                    'Refreshing datasource [{}]'.format(ds_name), 'info')
            else:
                del ds_map[ds_name]
                continue
            datasource.cluster = self
            datasource.merge_flag = merge_flag
        session.flush()

        # Prepare multithreaded executation
        pool = ThreadPool()
        ds_refresh = list(ds_map.values())
        metadata = pool.map(_fetch_metadata_for, ds_refresh)
        pool.close()
        pool.join()

        for i in range(0, len(ds_refresh)):
            datasource = ds_refresh[i]
            cols = metadata[i]
            if cols:
                col_objs_list = (
                    session.query(DruidColumn)
                    .filter(DruidColumn.datasource_id == datasource.id)
                    .filter(or_(DruidColumn.column_name == col for col in cols))
                )
                col_objs = {col.column_name: col for col in col_objs_list}
                for col in cols:
                    if col == '__time':  # skip the time column
                        continue
                    col_obj = col_objs.get(col, None)
                    if not col_obj:
                        col_obj = DruidColumn(
                            datasource_id=datasource.id,
                            column_name=col)
                        with session.no_autoflush:
                            session.add(col_obj)
                    datatype = cols[col]['type']
                    if datatype == 'STRING':
                        col_obj.groupby = True
                        col_obj.filterable = True
                    if datatype == 'hyperUnique' or datatype == 'thetaSketch':
                        col_obj.count_distinct = True
                    # Allow sum/min/max for long or double
                    if datatype == 'LONG' or datatype == 'DOUBLE':
                        col_obj.sum = True
                        col_obj.min = True
                        col_obj.max = True
                    col_obj.type = datatype
                    col_obj.datasource = datasource
                datasource.generate_metrics_for(col_objs_list)
        session.commit()

    @property
    def perm(self):
        return '[{obj.cluster_name}].(id:{obj.id})'.format(obj=self)

    def get_perm(self):
        return self.perm

    @property
    def name(self):
        return self.verbose_name if self.verbose_name else self.cluster_name

    @property
    def unique_name(self):
        return self.verbose_name if self.verbose_name else self.cluster_name


class DruidColumn(Model, BaseColumn):
    """ORM model for storing Druid datasource column metadata"""

    __tablename__ = 'columns'
    __table_args__ = (UniqueConstraint('column_name', 'datasource_id'),)

    datasource_id = Column(
        Integer,
        ForeignKey('datasources.id'))
    # Setting enable_typechecks=False disables polymorphic inheritance.
    datasource = relationship(
        'DruidDatasource',
        backref=backref('columns', cascade='all, delete-orphan'),
        enable_typechecks=False)
    dimension_spec_json = Column(Text)

    export_fields = (
        'datasource_id', 'column_name', 'is_active', 'type', 'groupby',
        'count_distinct', 'sum', 'avg', 'max', 'min', 'filterable',
        'description', 'dimension_spec_json', 'verbose_name',
    )
    export_parent = 'datasource'

    def __repr__(self):
        return self.column_name

    @property
    def expression(self):
        return self.dimension_spec_json

    @property
    def dimension_spec(self):
        if self.dimension_spec_json:
            return json.loads(self.dimension_spec_json)

    def get_metrics(self):
        metrics = {}
        metrics['count'] = DruidMetric(
            metric_name='count',
            verbose_name='COUNT(*)',
            metric_type='count',
            json=json.dumps({'type': 'count', 'name': 'count'}),
        )
        # Somehow we need to reassign this for UDAFs
        if self.type in ('DOUBLE', 'FLOAT'):
            corrected_type = 'DOUBLE'
        else:
            corrected_type = self.type

        if self.sum and self.is_num:
            mt = corrected_type.lower() + 'Sum'
            name = 'sum__' + self.column_name
            metrics[name] = DruidMetric(
                metric_name=name,
                metric_type='sum',
                verbose_name='SUM({})'.format(self.column_name),
                json=json.dumps({
                    'type': mt, 'name': name, 'fieldName': self.column_name}),
            )

        if self.avg and self.is_num:
            mt = corrected_type.lower() + 'Avg'
            name = 'avg__' + self.column_name
            metrics[name] = DruidMetric(
                metric_name=name,
                metric_type='avg',
                verbose_name='AVG({})'.format(self.column_name),
                json=json.dumps({
                    'type': mt, 'name': name, 'fieldName': self.column_name}),
            )

        if self.min and self.is_num:
            mt = corrected_type.lower() + 'Min'
            name = 'min__' + self.column_name
            metrics[name] = DruidMetric(
                metric_name=name,
                metric_type='min',
                verbose_name='MIN({})'.format(self.column_name),
                json=json.dumps({
                    'type': mt, 'name': name, 'fieldName': self.column_name}),
            )
        if self.max and self.is_num:
            mt = corrected_type.lower() + 'Max'
            name = 'max__' + self.column_name
            metrics[name] = DruidMetric(
                metric_name=name,
                metric_type='max',
                verbose_name='MAX({})'.format(self.column_name),
                json=json.dumps({
                    'type': mt, 'name': name, 'fieldName': self.column_name}),
            )
        if self.count_distinct:
            name = 'count_distinct__' + self.column_name
            if self.type == 'hyperUnique' or self.type == 'thetaSketch':
                metrics[name] = DruidMetric(
                    metric_name=name,
                    verbose_name='COUNT(DISTINCT {})'.format(self.column_name),
                    metric_type=self.type,
                    json=json.dumps({
                        'type': self.type,
                        'name': name,
                        'fieldName': self.column_name,
                    }),
                )
            else:
                metrics[name] = DruidMetric(
                    metric_name=name,
                    verbose_name='COUNT(DISTINCT {})'.format(self.column_name),
                    metric_type='count_distinct',
                    json=json.dumps({
                        'type': 'cardinality',
                        'name': name,
                        'fieldNames': [self.column_name]}),
                )
        return metrics

    def generate_metrics(self):
        """Generate metrics based on the column metadata"""
        metrics = self.get_metrics()
        dbmetrics = (
            db.session.query(DruidMetric)
            .filter(DruidMetric.datasource_id == self.datasource_id)
            .filter(or_(
                DruidMetric.metric_name == m for m in metrics
            ))
        )
        dbmetrics = {metric.metric_name: metric for metric in dbmetrics}
        for metric in metrics.values():
            metric.datasource_id = self.datasource_id
            if not dbmetrics.get(metric.metric_name, None):
                db.session.add(metric)

    @classmethod
    def import_obj(cls, i_column):
        def lookup_obj(lookup_column):
            return db.session.query(DruidColumn).filter(
                DruidColumn.datasource_id == lookup_column.datasource_id,
                DruidColumn.column_name == lookup_column.column_name).first()

        return import_util.import_simple_obj(db.session, i_column, lookup_obj)


class DruidMetric(Model, BaseMetric):

    """ORM object referencing Druid metrics for a datasource"""

    __tablename__ = 'metrics'
    __table_args__ = (UniqueConstraint('metric_name', 'datasource_id'),)
    datasource_id = Column(
        Integer,
        ForeignKey('datasources.id'))
    # Setting enable_typechecks=False disables polymorphic inheritance.
    datasource = relationship(
        'DruidDatasource',
        backref=backref('metrics', cascade='all, delete-orphan'),
        enable_typechecks=False)
    json = Column(Text)

    export_fields = (
        'metric_name', 'verbose_name', 'metric_type', 'datasource_id',
        'json', 'description', 'is_restricted', 'd3format',
    )
    export_parent = 'datasource'

    @property
    def expression(self):
        return self.json

    @property
    def json_obj(self):
        try:
            obj = json.loads(self.json)
        except Exception:
            obj = {}
        return obj

    @property
    def perm(self):
        return (
            '{parent_name}.[{obj.metric_name}](id:{obj.id})'
        ).format(obj=self,
                 parent_name=self.datasource.full_name,
                 ) if self.datasource else None

    @classmethod
    def import_obj(cls, i_metric):
        def lookup_obj(lookup_metric):
            return db.session.query(DruidMetric).filter(
                DruidMetric.datasource_id == lookup_metric.datasource_id,
                DruidMetric.metric_name == lookup_metric.metric_name).first()
        return import_util.import_simple_obj(db.session, i_metric, lookup_obj)


class DruidDatasource(Model, BaseDatasource):

    """ORM object referencing Druid datasources (tables)"""

    __tablename__ = 'datasources'
    __table_args__ = (UniqueConstraint('datasource_name', 'cluster_name'),)

    type = 'druid'
    query_langtage = 'json'
    cluster_class = DruidCluster
    metric_class = DruidMetric
    column_class = DruidColumn

    baselink = 'druiddatasourcemodelview'

    # Columns
    datasource_name = Column(String(255))
    is_hidden = Column(Boolean, default=False)
    fetch_values_from = Column(String(100))
    cluster_name = Column(
        String(250), ForeignKey('clusters.cluster_name'))
    cluster = relationship(
        'DruidCluster', backref='datasources', foreign_keys=[cluster_name])
    user_id = Column(Integer, ForeignKey('ab_user.id'))
    owner = relationship(
        sm.user_model,
        backref=backref('datasources', cascade='all, delete-orphan'),
        foreign_keys=[user_id])
    UniqueConstraint('cluster_name', 'datasource_name')

    export_fields = (
        'datasource_name', 'is_hidden', 'description', 'default_endpoint',
        'cluster_name', 'offset', 'cache_timeout', 'params',
    )

    export_parent = 'cluster'
    export_children = ['columns', 'metrics']

    @property
    def database(self):
        return self.cluster

    @property
    def connection(self):
        return str(self.database)

    @property
    def num_cols(self):
        return [c.column_name for c in self.columns if c.is_num]

    @property
    def name(self):
        return self.datasource_name

    @property
    def schema(self):
        ds_name = self.datasource_name or ''
        name_pieces = ds_name.split('.')
        if len(name_pieces) > 1:
            return name_pieces[0]
        else:
            return None

    @property
    def schema_perm(self):
        """Returns schema permission if present, cluster one otherwise."""
        return utils.get_schema_perm(self.cluster, self.schema)

    def get_perm(self):
        return (
            '[{obj.cluster_name}].[{obj.datasource_name}]'
            '(id:{obj.id})').format(obj=self)

    @property
    def link(self):
        name = escape(self.datasource_name)
        return Markup('<a href="{self.url}">{name}</a>').format(**locals())

    @property
    def full_name(self):
        return utils.get_datasource_full_name(
            self.cluster_name, self.datasource_name)

    @property
    def time_column_grains(self):
        return {
            'time_columns': [
                'all', '5 seconds', '30 seconds', '1 minute',
                '5 minutes', '1 hour', '6 hour', '1 day', '7 days',
                'week', 'week_starting_sunday', 'week_ending_saturday',
                'month',
            ],
            'time_grains': ['now'],
        }

    def __repr__(self):
        return self.datasource_name

    @renders('datasource_name')
    def datasource_link(self):
        url = '/superset/explore/{obj.type}/{obj.id}/'.format(obj=self)
        name = escape(self.datasource_name)
        return Markup('<a href="{url}">{name}</a>'.format(**locals()))

    def get_metric_obj(self, metric_name):
        return [
            m.json_obj for m in self.metrics
            if m.metric_name == metric_name
        ][0]

    @classmethod
    def import_obj(cls, i_datasource, import_time=None):
        """Imports the datasource from the object to the database.

         Metrics and columns and datasource will be overridden if exists.
         This function can be used to import/export dashboards between multiple
         superset instances. Audit metadata isn't copies over.
        """
        def lookup_datasource(d):
            return db.session.query(DruidDatasource).filter(
                DruidDatasource.datasource_name == d.datasource_name,
                DruidCluster.cluster_name == d.cluster_name,
            ).first()

        def lookup_cluster(d):
            return db.session.query(DruidCluster).filter_by(
                cluster_name=d.cluster_name).one()
        return import_util.import_datasource(
            db.session, i_datasource, lookup_cluster, lookup_datasource,
            import_time)

    @staticmethod
    def version_higher(v1, v2):
        """is v1 higher than v2

        >>> DruidDatasource.version_higher('0.8.2', '0.9.1')
        False
        >>> DruidDatasource.version_higher('0.8.2', '0.6.1')
        True
        >>> DruidDatasource.version_higher('0.8.2', '0.8.2')
        False
        >>> DruidDatasource.version_higher('0.8.2', '0.9.BETA')
        False
        >>> DruidDatasource.version_higher('0.8.2', '0.9')
        False
        """
        def int_or_0(v):
            try:
                v = int(v)
            except (TypeError, ValueError):
                v = 0
            return v
        v1nums = [int_or_0(n) for n in v1.split('.')]
        v2nums = [int_or_0(n) for n in v2.split('.')]
        v1nums = (v1nums + [0, 0, 0])[:3]
        v2nums = (v2nums + [0, 0, 0])[:3]
        return (
                   v1nums[0] > v2nums[0] or
                   (v1nums[0] == v2nums[0] and v1nums[1] > v2nums[1]) or
                   (v1nums[0] == v2nums[0] and v1nums[1] == v2nums[1] and
                       v1nums[2] > v2nums[2])
               )

    def latest_metadata(self):
        """Returns segment metadata from the latest segment"""
        logging.info('Syncing datasource [{}]'.format(self.datasource_name))
        client = self.cluster.get_pydruid_client()
        try:
            results = client.time_boundary(datasource=self.datasource_name)
        except IOError:
            results = None
        if results:
            max_time = results[0]['result']['maxTime']
            max_time = dparse(max_time)
        else:
            max_time = datetime.now()
        # Query segmentMetadata for 7 days back. However, due to a bug,
        # we need to set this interval to more than 1 day ago to exclude
        # realtime segments, which triggered a bug (fixed in druid 0.8.2).
        # https://groups.google.com/forum/#!topic/druid-user/gVCqqspHqOQ
        lbound = (max_time - timedelta(days=7)).isoformat()
        if not self.version_higher(self.cluster.druid_version, '0.8.2'):
            rbound = (max_time - timedelta(1)).isoformat()
        else:
            rbound = max_time.isoformat()
        segment_metadata = None
        try:
            segment_metadata = client.segment_metadata(
                datasource=self.datasource_name,
                intervals=lbound + '/' + rbound,
                merge=self.merge_flag,
                analysisTypes=[])
        except Exception as e:
            logging.warning('Failed first attempt to get latest segment')
            logging.exception(e)
        if not segment_metadata:
            # if no segments in the past 7 days, look at all segments
            lbound = datetime(1901, 1, 1).isoformat()[:10]
            if not self.version_higher(self.cluster.druid_version, '0.8.2'):
                rbound = datetime.now().isoformat()
            else:
                rbound = datetime(2050, 1, 1).isoformat()[:10]
            try:
                segment_metadata = client.segment_metadata(
                    datasource=self.datasource_name,
                    intervals=lbound + '/' + rbound,
                    merge=self.merge_flag,
                    analysisTypes=[])
            except Exception as e:
                logging.warning('Failed 2nd attempt to get latest segment')
                logging.exception(e)
        if segment_metadata:
            return segment_metadata[-1]['columns']

    def generate_metrics(self):
        self.generate_metrics_for(self.columns)

    def generate_metrics_for(self, columns):
        metrics = {}
        for col in columns:
            metrics.update(col.get_metrics())
        dbmetrics = (
            db.session.query(DruidMetric)
            .filter(DruidMetric.datasource_id == self.id)
            .filter(or_(DruidMetric.metric_name == m for m in metrics))
        )
        dbmetrics = {metric.metric_name: metric for metric in dbmetrics}
        for metric in metrics.values():
            metric.datasource_id = self.id
            if not dbmetrics.get(metric.metric_name, None):
                with db.session.no_autoflush:
                    db.session.add(metric)

    @classmethod
    def sync_to_db_from_config(
            cls,
            druid_config,
            user,
            cluster,
            refresh=True):
        """Merges the ds config from druid_config into one stored in the db."""
        session = db.session
        datasource = (
            session.query(cls)
            .filter_by(datasource_name=druid_config['name'])
            .first()
        )
        # Create a new datasource.
        if not datasource:
            datasource = cls(
                datasource_name=druid_config['name'],
                cluster=cluster,
                owner=user,
                changed_by_fk=user.id,
                created_by_fk=user.id,
            )
            session.add(datasource)
        elif not refresh:
            return

        dimensions = druid_config['dimensions']
        col_objs = (
            session.query(DruidColumn)
            .filter(DruidColumn.datasource_id == datasource.id)
            .filter(or_(DruidColumn.column_name == dim for dim in dimensions))
        )
        col_objs = {col.column_name: col for col in col_objs}
        for dim in dimensions:
            col_obj = col_objs.get(dim, None)
            if not col_obj:
                col_obj = DruidColumn(
                    datasource_id=datasource.id,
                    column_name=dim,
                    groupby=True,
                    filterable=True,
                    # TODO: fetch type from Hive.
                    type='STRING',
                    datasource=datasource,
                )
                session.add(col_obj)
        # Import Druid metrics
        metric_objs = (
            session.query(DruidMetric)
            .filter(DruidMetric.datasource_id == datasource.id)
            .filter(or_(DruidMetric.metric_name == spec['name']
                    for spec in druid_config['metrics_spec']))
        )
        metric_objs = {metric.metric_name: metric for metric in metric_objs}
        for metric_spec in druid_config['metrics_spec']:
            metric_name = metric_spec['name']
            metric_type = metric_spec['type']
            metric_json = json.dumps(metric_spec)

            if metric_type == 'count':
                metric_type = 'longSum'
                metric_json = json.dumps({
                    'type': 'longSum',
                    'name': metric_name,
                    'fieldName': metric_name,
                })

            metric_obj = metric_objs.get(metric_name, None)
            if not metric_obj:
                metric_obj = DruidMetric(
                    metric_name=metric_name,
                    metric_type=metric_type,
                    verbose_name='%s(%s)' % (metric_type, metric_name),
                    datasource=datasource,
                    json=metric_json,
                    description=(
                        'Imported from the airolap config dir for %s' %
                        druid_config['name']),
                )
                session.add(metric_obj)
        session.commit()

    @staticmethod
    def time_offset(granularity):
        if granularity == 'week_ending_saturday':
            return 6 * 24 * 3600 * 1000  # 6 days
        return 0

    # uses https://en.wikipedia.org/wiki/ISO_8601
    # http://druid.io/docs/0.8.0/querying/granularities.html
    # TODO: pass origin from the UI
    @staticmethod
    def granularity(period_name, timezone=None, origin=None):
        if not period_name or period_name == 'all':
            return 'all'
        iso_8601_dict = {
            '5 seconds': 'PT5S',
            '30 seconds': 'PT30S',
            '1 minute': 'PT1M',
            '5 minutes': 'PT5M',
            '1 hour': 'PT1H',
            '6 hour': 'PT6H',
            'one day': 'P1D',
            '1 day': 'P1D',
            '7 days': 'P7D',
            'week': 'P1W',
            'week_starting_sunday': 'P1W',
            'week_ending_saturday': 'P1W',
            'month': 'P1M',
        }

        granularity = {'type': 'period'}
        if timezone:
            granularity['timeZone'] = timezone

        if origin:
            dttm = utils.parse_human_datetime(origin)
            granularity['origin'] = dttm.isoformat()

        if period_name in iso_8601_dict:
            granularity['period'] = iso_8601_dict[period_name]
            if period_name in ('week_ending_saturday', 'week_starting_sunday'):
                # use Sunday as start of the week
                granularity['origin'] = '2016-01-03T00:00:00'
        elif not isinstance(period_name, string_types):
            granularity['type'] = 'duration'
            granularity['duration'] = period_name
        elif period_name.startswith('P'):
            # identify if the string is the iso_8601 period
            granularity['period'] = period_name
        else:
            granularity['type'] = 'duration'
            granularity['duration'] = utils.parse_human_timedelta(
                period_name).total_seconds() * 1000
        return granularity

    @staticmethod
    def get_post_agg(mconf):
        """
        For a metric specified as `postagg` returns the
        kind of post aggregation for pydruid.
        """
        if mconf.get('type') == 'javascript':
            return JavascriptPostAggregator(
                name=mconf.get('name', ''),
                field_names=mconf.get('fieldNames', []),
                function=mconf.get('function', ''))
        elif mconf.get('type') == 'quantile':
            return Quantile(
                mconf.get('name', ''),
                mconf.get('probability', ''),
            )
        elif mconf.get('type') == 'quantiles':
            return Quantiles(
                mconf.get('name', ''),
                mconf.get('probabilities', ''),
            )
        elif mconf.get('type') == 'fieldAccess':
            return Field(mconf.get('name'))
        elif mconf.get('type') == 'constant':
            return Const(
                mconf.get('value'),
                output_name=mconf.get('name', ''),
            )
        elif mconf.get('type') == 'hyperUniqueCardinality':
            return HyperUniqueCardinality(
                mconf.get('name'),
            )
        elif mconf.get('type') == 'arithmetic':
            return Postaggregator(
                mconf.get('fn', '/'),
                mconf.get('fields', []),
                mconf.get('name', ''))
        else:
            return CustomPostAggregator(
                mconf.get('name', ''),
                mconf)

    @staticmethod
    def find_postaggs_for(postagg_names, metrics_dict):
        """Return a list of metrics that are post aggregations"""
        postagg_metrics = [
            metrics_dict[name] for name in postagg_names
            if metrics_dict[name].metric_type == 'postagg'
        ]
        # Remove post aggregations that were found
        for postagg in postagg_metrics:
            postagg_names.remove(postagg.metric_name)
        return postagg_metrics

    @staticmethod
    def recursive_get_fields(_conf):
        _type = _conf.get('type')
        _field = _conf.get('field')
        _fields = _conf.get('fields')
        field_names = []
        if _type in ['fieldAccess', 'hyperUniqueCardinality',
                     'quantile', 'quantiles']:
            field_names.append(_conf.get('fieldName', ''))
        if _field:
            field_names += DruidDatasource.recursive_get_fields(_field)
        if _fields:
            for _f in _fields:
                field_names += DruidDatasource.recursive_get_fields(_f)
        return list(set(field_names))

    @staticmethod
    def resolve_postagg(postagg, post_aggs, agg_names, visited_postaggs, metrics_dict):
        mconf = postagg.json_obj
        required_fields = set(
            DruidDatasource.recursive_get_fields(mconf)
            + mconf.get('fieldNames', []))
        # Check if the fields are already in aggs
        # or is a previous postagg
        required_fields = set([
            field for field in required_fields
            if field not in visited_postaggs and field not in agg_names
        ])
        # First try to find postaggs that match
        if len(required_fields) > 0:
            missing_postaggs = DruidDatasource.find_postaggs_for(
                required_fields, metrics_dict)
            for missing_metric in required_fields:
                agg_names.add(missing_metric)
            for missing_postagg in missing_postaggs:
                # Add to visited first to avoid infinite recursion
                # if post aggregations are cyclicly dependent
                visited_postaggs.add(missing_postagg.metric_name)
            for missing_postagg in missing_postaggs:
                DruidDatasource.resolve_postagg(
                    missing_postagg, post_aggs, agg_names, visited_postaggs, metrics_dict)
        post_aggs[postagg.metric_name] = DruidDatasource.get_post_agg(postagg.json_obj)

    @staticmethod
    def metrics_and_post_aggs(metrics, metrics_dict):
        # Separate metrics into those that are aggregations
        # and those that are post aggregations
        agg_names = set()
        postagg_names = []
        for metric_name in metrics:
            if metrics_dict[metric_name].metric_type != 'postagg':
                agg_names.add(metric_name)
            else:
                postagg_names.append(metric_name)
        # Create the post aggregations, maintain order since postaggs
        # may depend on previous ones
        post_aggs = OrderedDict()
        visited_postaggs = set()
        for postagg_name in postagg_names:
            postagg = metrics_dict[postagg_name]
            visited_postaggs.add(postagg_name)
            DruidDatasource.resolve_postagg(
                postagg, post_aggs, agg_names, visited_postaggs, metrics_dict)
        return list(agg_names), post_aggs

    def values_for_column(self,
                          column_name,
                          limit=10000):
        """Retrieve some values for the given column"""
        logging.info(
            'Getting values for columns [{}] limited to [{}]'
            .format(column_name, limit))
        # TODO: Use Lexicographic TopNMetricSpec once supported by PyDruid
        if self.fetch_values_from:
            from_dttm = utils.parse_human_datetime(self.fetch_values_from)
        else:
            from_dttm = datetime(1970, 1, 1)

        qry = dict(
            datasource=self.datasource_name,
            granularity='all',
            intervals=from_dttm.isoformat() + '/' + datetime.now().isoformat(),
            aggregations=dict(count=count('count')),
            dimension=column_name,
            metric='count',
            threshold=limit,
        )

        client = self.cluster.get_pydruid_client()
        client.topn(**qry)
        df = client.export_pandas()
        return [row[column_name] for row in df.to_records(index=False)]

    def get_query_str(self, query_obj, phase=1, client=None):
        return self.run_query(client=client, phase=phase, **query_obj)

    def _add_filter_from_pre_query_data(self, df, dimensions, dim_filter):
        ret = dim_filter
        if df is not None and not df.empty:
            new_filters = []
            for unused, row in df.iterrows():
                fields = []
                for dim in dimensions:
                    f = Dimension(dim) == row[dim]
                    fields.append(f)
                if len(fields) > 1:
                    term = Filter(type='and', fields=fields)
                    new_filters.append(term)
                elif fields:
                    new_filters.append(fields[0])
            if new_filters:
                ff = Filter(type='or', fields=new_filters)
                if not dim_filter:
                    ret = ff
                else:
                    ret = Filter(type='and', fields=[ff, dim_filter])
        return ret

    def get_aggregations(self, all_metrics):
        aggregations = OrderedDict()
        for m in self.metrics:
            if m.metric_name in all_metrics:
                aggregations[m.metric_name] = m.json_obj
        return aggregations

    def check_restricted_metrics(self, aggregations):
        rejected_metrics = [
            m.metric_name for m in self.metrics
            if m.is_restricted and
            m.metric_name in aggregations.keys() and
            not sm.has_access('metric_access', m.perm)
        ]
        if rejected_metrics:
            raise MetricPermException(
                'Access to the metrics denied: ' + ', '.join(rejected_metrics),
            )

    def get_dimensions(self, groupby, columns_dict):
        dimensions = []
        groupby = [gb for gb in groupby if gb in columns_dict]
        for column_name in groupby:
            col = columns_dict.get(column_name)
            dim_spec = col.dimension_spec if col else None
            if dim_spec:
                dimensions.append(dim_spec)
            else:
                dimensions.append(column_name)
        return dimensions

    def run_query(  # noqa / druid
            self,
            groupby, metrics,
            granularity,
            from_dttm, to_dttm,
            filter=None,  # noqa
            is_timeseries=True,
            timeseries_limit=None,
            timeseries_limit_metric=None,
            row_limit=None,
            inner_from_dttm=None, inner_to_dttm=None,
            orderby=None,
            extras=None,  # noqa
            select=None,  # noqa
            columns=None, phase=2, client=None, form_data=None,
            order_desc=True):
        """Runs a query against Druid and returns a dataframe.
        """
        # TODO refactor into using a TBD Query object
        client = client or self.cluster.get_pydruid_client()

        if not is_timeseries:
            granularity = 'all'
        inner_from_dttm = inner_from_dttm or from_dttm
        inner_to_dttm = inner_to_dttm or to_dttm

        # add tzinfo to native datetime with config
        from_dttm = from_dttm.replace(tzinfo=DRUID_TZ)
        to_dttm = to_dttm.replace(tzinfo=DRUID_TZ)
        timezone = from_dttm.tzname()

        query_str = ''
        metrics_dict = {m.metric_name: m for m in self.metrics}
        columns_dict = {c.column_name: c for c in self.columns}

        all_metrics, post_aggs = DruidDatasource.metrics_and_post_aggs(
            metrics,
            metrics_dict)

        aggregations = self.get_aggregations(all_metrics)
        self.check_restricted_metrics(aggregations)

        # the dimensions list with dimensionSpecs expanded
        dimensions = self.get_dimensions(groupby, columns_dict)
        extras = extras or {}
        qry = dict(
            datasource=self.datasource_name,
            dimensions=dimensions,
            aggregations=aggregations,
            granularity=DruidDatasource.granularity(
                granularity,
                timezone=timezone,
                origin=extras.get('druid_time_origin'),
            ),
            post_aggregations=post_aggs,
            intervals=from_dttm.isoformat() + '/' + to_dttm.isoformat(),
        )

        filters = DruidDatasource.get_filters(filter, self.num_cols)
        if filters:
            qry['filter'] = filters

        having_filters = self.get_having_filters(extras.get('having_druid'))
        if having_filters:
            qry['having'] = having_filters

        order_direction = 'descending' if order_desc else 'ascending'

        if len(groupby) == 0 and not having_filters:
            logging.info('Running timeseries query for no groupby values')
            del qry['dimensions']
            client.timeseries(**qry)
        elif (
            not having_filters and
            len(groupby) == 1 and
            order_desc
        ):
            dim = list(qry.get('dimensions'))[0]
            logging.info('Running two-phase topn query for dimension [{}]'.format(dim))
            if timeseries_limit_metric:
                order_by = timeseries_limit_metric
            else:
                order_by = list(qry['aggregations'].keys())[0]
            # Limit on the number of timeseries, doing a two-phases query
            pre_qry = deepcopy(qry)
            pre_qry['granularity'] = 'all'
            pre_qry['threshold'] = min(row_limit,
                                       timeseries_limit or row_limit)
            pre_qry['metric'] = order_by
            if isinstance(dim, dict):
                if 'dimension' in dim:
                    pre_qry['dimension'] = dim['dimension']
            else:
                pre_qry['dimension'] = dim
            del pre_qry['dimensions']
            client.topn(**pre_qry)
            logging.info('Phase 1 Complete')
            query_str += '// Two phase query\n// Phase 1\n'
            query_str += json.dumps(
                client.query_builder.last_query.query_dict, indent=2)
            query_str += '\n'
            if phase == 1:
                return query_str
            query_str += (
                "// Phase 2 (built based on phase one's results)\n")
            df = client.export_pandas()
            qry['filter'] = self._add_filter_from_pre_query_data(
                df,
                [pre_qry['dimension']],
                filters)
            qry['threshold'] = timeseries_limit or 1000
            if row_limit and granularity == 'all':
                qry['threshold'] = row_limit
            qry['dimension'] = dim
            del qry['dimensions']
            qry['metric'] = list(qry['aggregations'].keys())[0]
            client.topn(**qry)
            logging.info('Phase 2 Complete')
        elif len(groupby) > 0:
            # If grouping on multiple fields or using a having filter
            # we have to force a groupby query
            logging.info('Running groupby query for dimensions [{}]'.format(dimensions))
            if timeseries_limit and is_timeseries:
                logging.info('Running two-phase query for timeseries')
                order_by = metrics[0] if metrics else self.metrics[0]
                if timeseries_limit_metric:
                    order_by = timeseries_limit_metric
                # Limit on the number of timeseries, doing a two-phases query
                pre_qry = deepcopy(qry)
                pre_qry['granularity'] = 'all'
                pre_qry['limit_spec'] = {
                    'type': 'default',
                    'limit': min(timeseries_limit, row_limit),
                    'intervals': (
                        inner_from_dttm.isoformat() + '/' +
                        inner_to_dttm.isoformat()),
                    'columns': [{
                        'dimension': order_by,
                        'direction': order_direction,
                    }],
                }
                pre_qry_dims = []
                # Replace dimensions specs with their `dimension`
                # values, and ignore those without
                for dim in qry['dimensions']:
                    if isinstance(dim, dict):
                        if 'dimension' in dim:
                            pre_qry_dims.append(dim['dimension'])
                    else:
                        pre_qry_dims.append(dim)
                pre_qry['dimensions'] = list(set(pre_qry_dims))
                client.groupby(**pre_qry)
                logging.info('Phase 1 Complete')
                query_str += '// Two phase query\n// Phase 1\n'
                query_str += json.dumps(
                    client.query_builder.last_query.query_dict, indent=2)
                query_str += '\n'
                if phase == 1:
                    return query_str
                query_str += (
                    "// Phase 2 (built based on phase one's results)\n")
                df = client.export_pandas()
                qry['filter'] = self._add_filter_from_pre_query_data(
                    df,
                    pre_qry['dimensions'],
                    filters,
                )
                qry['limit_spec'] = None
            if row_limit:
                qry['limit_spec'] = {
                    'type': 'default',
                    'limit': row_limit,
                    'columns': [{
                        'dimension': (
                            metrics[0] if metrics else self.metrics[0]),
                        'direction': order_direction,
                    }],
                }
            client.groupby(**qry)
            logging.info('Query Complete')
        query_str += json.dumps(
            client.query_builder.last_query.query_dict, indent=2)
        return query_str

    def query(self, query_obj):
        qry_start_dttm = datetime.now()
        client = self.cluster.get_pydruid_client()
        query_str = self.get_query_str(
            client=client, query_obj=query_obj, phase=2)
        df = client.export_pandas()

        if df is None or df.size == 0:
            raise Exception(_('No data was returned.'))
        df.columns = [
            DTTM_ALIAS if c == 'timestamp' else c for c in df.columns]

        is_timeseries = query_obj['is_timeseries'] \
            if 'is_timeseries' in query_obj else True
        if (
                not is_timeseries and
                DTTM_ALIAS in df.columns):
            del df[DTTM_ALIAS]

        # Reordering columns
        cols = []
        if DTTM_ALIAS in df.columns:
            cols += [DTTM_ALIAS]
        cols += [col for col in query_obj['groupby'] if col in df.columns]
        cols += [col for col in query_obj['metrics'] if col in df.columns]
        df = df[cols]

        time_offset = DruidDatasource.time_offset(query_obj['granularity'])

        def increment_timestamp(ts):
            dt = utils.parse_human_datetime(ts).replace(
                tzinfo=DRUID_TZ)
            return dt + timedelta(milliseconds=time_offset)
        if DTTM_ALIAS in df.columns and time_offset:
            df[DTTM_ALIAS] = df[DTTM_ALIAS].apply(increment_timestamp)

        return QueryResult(
            df=df,
            query=query_str,
            duration=datetime.now() - qry_start_dttm)

    @staticmethod
    def get_filters(raw_filters, num_cols):  # noqa
        filters = None
        for flt in raw_filters:
            if not all(f in flt for f in ['col', 'op', 'val']):
                continue

            col = flt['col']
            op = flt['op']
            eq = flt['val']
            cond = None
            if op in ('in', 'not in'):
                eq = [
                    types.replace('"', '').strip()
                    if isinstance(types, string_types)
                    else types
                    for types in eq]
            elif not isinstance(flt['val'], string_types):
                eq = eq[0] if eq and len(eq) > 0 else ''

            is_numeric_col = col in num_cols
            if is_numeric_col:
                if op in ('in', 'not in'):
                    eq = [utils.string_to_num(v) for v in eq]
                else:
                    eq = utils.string_to_num(eq)

            if op == '==':
                cond = Dimension(col) == eq
            elif op == '!=':
                cond = Dimension(col) != eq
            elif op in ('in', 'not in'):
                fields = []

                # ignore the filter if it has no value
                if not len(eq):
                    continue
                elif len(eq) == 1:
                    cond = Dimension(col) == eq[0]
                else:
                    for s in eq:
                        fields.append(Dimension(col) == s)
                    cond = Filter(type='or', fields=fields)

                if op == 'not in':
                    cond = ~cond

            elif op == 'regex':
                cond = Filter(type='regex', pattern=eq, dimension=col)
            elif op == '>=':
                cond = Bound(col, eq, None, alphaNumeric=is_numeric_col)
            elif op == '<=':
                cond = Bound(col, None, eq, alphaNumeric=is_numeric_col)
            elif op == '>':
                cond = Bound(
                    col, eq, None,
                    lowerStrict=True, alphaNumeric=is_numeric_col,
                )
            elif op == '<':
                cond = Bound(
                    col, None, eq,
                    upperStrict=True, alphaNumeric=is_numeric_col,
                )

            if filters:
                filters = Filter(type='and', fields=[
                    cond,
                    filters,
                ])
            else:
                filters = cond

        return filters

    def _get_having_obj(self, col, op, eq):
        cond = None
        if op == '==':
            if col in self.column_names:
                cond = DimSelector(dimension=col, value=eq)
            else:
                cond = Aggregation(col) == eq
        elif op == '>':
            cond = Aggregation(col) > eq
        elif op == '<':
            cond = Aggregation(col) < eq

        return cond

    def get_having_filters(self, raw_filters):
        filters = None
        reversed_op_map = {
            '!=': '==',
            '>=': '<',
            '<=': '>',
        }

        for flt in raw_filters:
            if not all(f in flt for f in ['col', 'op', 'val']):
                continue
            col = flt['col']
            op = flt['op']
            eq = flt['val']
            cond = None
            if op in ['==', '>', '<']:
                cond = self._get_having_obj(col, op, eq)
            elif op in reversed_op_map:
                cond = ~self._get_having_obj(col, reversed_op_map[op], eq)

            if filters:
                filters = filters & cond
            else:
                filters = cond
        return filters

    @classmethod
    def query_datasources_by_name(
            cls, session, database, datasource_name, schema=None):
        return (
            session.query(cls)
            .filter_by(cluster_name=database.id)
            .filter_by(datasource_name=datasource_name)
            .all()
        )


sa.event.listen(DruidDatasource, 'after_insert', set_perm)
sa.event.listen(DruidDatasource, 'after_update', set_perm)
