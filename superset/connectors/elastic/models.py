# pylint: disable=invalid-unary-operand-type
import json
import logging
from datetime import datetime, timedelta
from six import string_types

import requests
import sqlalchemy as sa
from sqlalchemy import (
    Column, Integer, String, ForeignKey, Text, Boolean,
    DateTime,
)
from sqlalchemy.orm import backref, relationship
from dateutil.parser import parse as dparse

from flask import Markup, escape
from flask_appbuilder.models.decorators import renders
from flask_appbuilder import Model

from flask_babel import lazy_gettext as _

from elasticsearch import Elasticsearch

from superset import conf, db, import_util, utils, sm, get_session
from superset.utils import flasher
from superset.connectors.base import BaseDatasource, BaseColumn, BaseMetric
from superset.models.helpers import AuditMixinNullable, QueryResult, set_perm


class ElasticCluster(Model, AuditMixinNullable):

    """ORM object referencing the Elastic clusters"""

    __tablename__ = 'elastic_clusters'
    type = "elastic"

    id = Column(Integer, primary_key=True)
    cluster_name = Column(String(250), unique=True)
    hosts_json = Column(Text)
    metadata_last_refreshed = Column(DateTime)
    cache_timeout = Column(Integer)

    def __repr__(self):
        return self.cluster_name

    @property
    def hosts(self):
        return json.loads(self.hosts_json)

    def get_client(self):
        return Elasticsearch(self.hosts)

    def get_mappings(self):
        client = self.get_client()
        return client.indices.get_mapping()

    def refresh_datasources(self, datasource_name=None, merge_flag=False):
        """Refresh metadata of all datasources in the cluster
        If ``datasource_name`` is specified, only that datasource is updated
        """
        for index_name, index_metadata in self.get_mappings().items():
            for name, mapping_metadata in index_metadata.get('mappings').items():
                ElasticDatasource.sync_to_db(
                    '{}.{}'.format(index_name, name), mapping_metadata, self)

    @property
    def perm(self):
        return "[{obj.cluster_name}].(id:{obj.id})".format(obj=self)

    def get_perm(self):
        return self.perm

    @property
    def name(self):
        return self.verbose_name if self.verbose_name else self.cluster_name

    @property
    def unique_name(self):
        return self.verbose_name if self.verbose_name else self.cluster_name


class ElasticColumn(Model, BaseColumn):
    """ORM model for storing Elastic datasource column metadata"""

    __tablename__ = 'elastic_columns'

    datasource_name = Column(
        String(255),
        ForeignKey('elastic_datasources.datasource_name'))
    # Setting enable_typechecks=False disables polymorphic inheritance.
    datasource = relationship(
        'ElasticDatasource',
        backref=backref('columns', cascade='all, delete-orphan'),
        enable_typechecks=False)
    json = Column(Text)

    export_fields = (
        'datasource_name', 'column_name', 'is_active', 'type', 'groupby',
        'count_distinct', 'sum', 'avg', 'max', 'min', 'filterable',
        'description', 'dimension_spec_json'
    )

    @property
    def expression(self):
        return self.json

    def __repr__(self):
        return self.column_name

    @property
    def dimension_spec(self):
        if self.dimension_spec_json:
            return json.loads(self.dimension_spec_json)

    def generate_metrics(self):
        """Generate metrics based on the column metadata"""
        M = ElasticMetric  # noqa
        metrics = []
        metrics.append(ElasticMetric(
            metric_name='count',
            verbose_name='COUNT(*)',
            metric_type='count',
            json=json.dumps({'type': 'count', 'name': 'count'})
        ))
        if self.sum and self.is_num:
            mt = self.type.lower() + 'Sum'
            name = 'sum__' + self.column_name
            metrics.append(ElasticMetric(
                metric_name=name,
                metric_type='sum',
                verbose_name='SUM({})'.format(self.column_name),
                json=json.dumps({'sum': {'field': self.column_name}})
            ))

        if self.avg and self.is_num:
            mt = self.type.lower() + 'Avg'
            name = 'avg__' + self.column_name
            metrics.append(ElasticMetric(
                metric_name=name,
                metric_type='avg',
                verbose_name='AVG({})'.format(self.column_name),
                json=json.dumps({'avg': {'field': self.column_name}})
            ))

        if self.min and self.is_num:
            mt = self.type.lower() + 'Min'
            name = 'min__' + self.column_name
            metrics.append(ElasticMetric(
                metric_name=name,
                metric_type='min',
                verbose_name='MIN({})'.format(self.column_name),
                json=json.dumps({'min': {'field': self.column_name}})
            ))
        if self.max and self.is_num:
            mt = self.type.lower() + 'Max'
            name = 'max__' + self.column_name
            metrics.append(ElasticMetric(
                metric_name=name,
                metric_type='max',
                verbose_name='MAX({})'.format(self.column_name),
                json=json.dumps({'max': {'field': self.column_name}})
            ))
        if self.count_distinct:
            mt = 'count_distinct'
            metrics.append(ElasticMetric(
                metric_name=name,
                verbose_name='COUNT(DISTINCT {})'.format(self.column_name),
                metric_type='count_distinct',
                json=json.dumps({'cardinality': {'field': self.column_name}})
            ))
        session = get_session()
        new_metrics = []
        for metric in metrics:
            m = (
                session.query(M)
                .filter(M.metric_name == metric.metric_name)
                .filter(M.datasource_name == self.datasource_name)
                .filter(ElasticCluster.cluster_name == self.datasource.cluster_name)
                .first()
            )
            metric.datasource_name = self.datasource_name
            if not m:
                new_metrics.append(metric)
                session.add(metric)
                session.flush()

    @classmethod
    def import_obj(cls, i_column):
        def lookup_obj(lookup_column):
            return db.session.query(ElasticColumn).filter(
                ElasticColumn.datasource_name == lookup_column.datasource_name,
                ElasticColumn.column_name == lookup_column.column_name).first()

        return import_util.import_simple_obj(db.session, i_column, lookup_obj)


class ElasticMetric(Model, BaseMetric):

    """ORM object referencing Elastic metrics for a datasource"""

    __tablename__ = 'elastic_metrics'
    datasource_name = Column(
        String(255),
        ForeignKey('elastic_datasources.datasource_name'))
    # Setting enable_typechecks=False disables polymorphic inheritance.
    datasource = relationship(
        'ElasticDatasource',
        backref=backref('metrics', cascade='all, delete-orphan'),
        enable_typechecks=False)
    json = Column(Text)

    export_fields = (
        'metric_name', 'verbose_name', 'metric_type', 'datasource_name',
        'json', 'description', 'is_restricted', 'd3format'
    )

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
            "{parent_name}.[{obj.metric_name}](id:{obj.id})"
        ).format(obj=self,
                 parent_name=self.datasource.full_name
                 ) if self.datasource else None

    @classmethod
    def import_obj(cls, i_metric):
        def lookup_obj(lookup_metric):
            return db.session.query(ElasticMetric).filter(
                ElasticMetric.datasource_name == lookup_metric.datasource_name,
                ElasticMetric.metric_name == lookup_metric.metric_name).first()
        return import_util.import_simple_obj(db.session, i_metric, lookup_obj)


class ElasticDatasource(Model, BaseDatasource):

    """ORM object referencing Elastic datasources (tables)"""

    __tablename__ = 'elastic_datasources'

    type = "elastic"
    query_langtage = "json"
    cluster_class = ElasticCluster
    metric_class = ElasticMetric
    column_class = ElasticColumn

    baselink = "elasticdatasourcemodelview"

    # Columns
    datasource_name = Column(String(255), unique=True)
    is_hidden = Column(Boolean, default=False)
    fetch_values_from = Column(String(100))
    cluster_name = Column(
        String(250), ForeignKey('elastic_clusters.cluster_name'))
    cluster = relationship(
        'ElasticCluster', backref='datasources', foreign_keys=[cluster_name])
    user_id = Column(Integer, ForeignKey('ab_user.id'))
    owner = relationship(
        sm.user_model,
        backref=backref('elastic_datasources', cascade='all, delete-orphan'),
        foreign_keys=[user_id])

    export_fields = (
        'datasource_name', 'is_hidden', 'description', 'default_endpoint',
        'cluster_name', 'offset', 'cache_timeout', 'params'
    )
    slices = relationship(
        'Slice',
        primaryjoin=(
            "ElasticDatasource.id == foreign(Slice.datasource_id) and "
            "Slice.datasource_type == 'elastic'"))

    @property
    def database(self):
        return self.cluster

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
            "[{obj.cluster_name}].[{obj.datasource_name}]"
            "(id:{obj.id})").format(obj=self)

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
            "time_columns": [
                'all', '5 seconds', '30 seconds', '1 minute',
                '5 minutes', '1 hour', '6 hour', '1 day', '7 days',
                'week', 'week_starting_sunday', 'week_ending_saturday',
                'month',
            ],
            "time_grains": ['now']
        }

    def __repr__(self):
        return self.datasource_name

    @renders('datasource_name')
    def datasource_link(self):
        url = "/superset/explore/{obj.type}/{obj.id}/".format(obj=self)
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
            return db.session.query(ElasticDatasource).join(ElasticCluster).filter(
                ElasticDatasource.datasource_name == d.datasource_name,
                ElasticCluster.cluster_name == d.cluster_name,
            ).first()

        def lookup_cluster(d):
            return db.session.query(ElasticCluster).filter_by(
                cluster_name=d.cluster_name).one()
        return import_util.import_datasource(
            db.session, i_datasource, lookup_cluster, lookup_datasource,
            import_time)

    @staticmethod
    def version_higher(v1, v2):
        """is v1 higher than v2

        >>> ElasticDatasource.version_higher('0.8.2', '0.9.1')
        False
        >>> ElasticDatasource.version_higher('0.8.2', '0.6.1')
        True
        >>> ElasticDatasource.version_higher('0.8.2', '0.8.2')
        False
        >>> ElasticDatasource.version_higher('0.8.2', '0.9.BETA')
        False
        >>> ElasticDatasource.version_higher('0.8.2', '0.9')
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
        return v1nums[0] > v2nums[0] or \
            (v1nums[0] == v2nums[0] and v1nums[1] > v2nums[1]) or \
            (v1nums[0] == v2nums[0] and v1nums[1] == v2nums[1] and v1nums[2] > v2nums[2])

    def generate_metrics(self):
        for col in self.columns:
            col.generate_metrics()

    def query_str(self):
        d = {"query": None}
        return json.dumps(d)

    @classmethod
    def sync_to_db(cls, name, metadata, cluster):
        """Fetches metadata for that datasource and merges the Superset db"""
        logging.info("Syncing Elastic datasource [{}]".format(name))
        session = get_session()
        datasource = session.query(cls).filter_by(datasource_name=name).first()
        if not datasource:
            datasource = cls(datasource_name=name)
            session.add(datasource)
            flasher("Adding new datasource [{}]".format(name), "success")
        else:
            flasher("Refreshing datasource [{}]".format(name), "info")
        session.flush()
        datasource.cluster = cluster
        session.flush()

        for col_name, col_metadata in metadata.get('properties').items():
            cls.merge_column(col_name, col_metadata, datasource, session)

    @classmethod
    def merge_column(cls, col_name, col_metadata, datasource, sesh):
        col_obj = (
            sesh
            .query(ElasticColumn)
            .filter_by(
                datasource_name=datasource.datasource_name,
                column_name=col_name)
            .first()
        )
        datatype = col_metadata.get('type')
        if not col_obj:
            col_obj = ElasticColumn(
                datasource_name=datasource.datasource_name,
                column_name=col_name)
            sesh.add(col_obj)
        if datatype == "string":
            col_obj.groupby = True
            col_obj.filterable = True
        if col_obj.is_num:
            col_obj.sum = True
        if col_obj:
            col_obj.type = datatype
        sesh.flush()
        col_obj.datasource = datasource
        col_obj.generate_metrics()
        sesh.flush()


    @staticmethod
    def time_offset(granularity):
        if granularity == 'week_ending_saturday':
            return 6 * 24 * 3600 * 1000  # 6 days
        return 0

    # uses https://en.wikipedia.org/wiki/ISO_8601
    # http://elastic.io/docs/0.8.0/querying/granularities.html
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

    def values_for_column(self,
                          column_name,
                          limit=10000):
        """Retrieve some values for the given column"""
        # TODO


    def get_query_str(self, query_obj, phase=1, client=None):
        return self.run_query(client=client, phase=phase, **query_obj)

    def run_query(  # noqa / elastic
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
            columns=None, phase=2, client=None, form_data=None):
        """Runs a query against Elastic and returns a dataframe.
        """
        pass

    @property
    def index(self):
        self.datasource_name.split('.')[0]

    def query(self, query_obj):
        client = self.cluster.get_client()
        equery = {}

        # Aggregations
        equery['aggregations'] = {}
        for m in self.metrics:
            if m.metric_name in query_obj.get('metrics'):
                equery['aggregations'][m.metric_name] = m.json_obj

        print(equery)
        data = client.search(index=self.index, body=equery)
        from pprint import pprint
        print('-='*20)
        pprint(data)
        print('-='*20)
        query_str = self.query_str()
        qry_start_dttm = datetime.now()
        df = None
        return QueryResult(
            df=df,
            query=query_str,
            duration=datetime.now() - qry_start_dttm)

    def get_filters(self, raw_filters):  # noqa
        return

    @classmethod
    def query_datasources_by_name(
            cls, session, database, datasource_name, schema=None):
        return (
            session.query(cls)
            .filter_by(cluster_name=database.id)
            .filter_by(datasource_name=datasource_name)
            .all()
        )

sa.event.listen(ElasticDatasource, 'after_insert', set_perm)
sa.event.listen(ElasticDatasource, 'after_update', set_perm)
