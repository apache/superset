# -*- coding: utf-8 -*-
# pylint: disable=C,R,W
# pylint: disable=invalid-unary-operand-type
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from collections import OrderedDict
from copy import deepcopy
from datetime import datetime, timedelta
from distutils.version import LooseVersion
import json
import logging
from multiprocessing.pool import ThreadPool
import re

import vaex

from dateutil.parser import parse as dparse
from flask import escape, Markup
from flask_appbuilder import Model
from flask_appbuilder.models.decorators import renders
from flask_babel import lazy_gettext as _
import pandas

import requests
from six import string_types
import sqlalchemy as sa
from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import backref, relationship

from superset import conf, db, import_util, security_manager, utils
from superset.connectors.base.models import BaseColumn, BaseDatasource, BaseMetric
from superset.exceptions import MetricPermException, SupersetException
from superset.models.helpers import (
    AuditMixinNullable, ImportMixin, QueryResult,
)
from superset.utils import (
    DimSelector, DTTM_ALIAS, flasher,
)

# Function wrapper because bound methods cannot
# be passed to processes
def _fetch_metadata_for(datasource):
    return datasource.latest_metadata()

class VaexCluster(Model, AuditMixinNullable, ImportMixin):

    """ORM object referencing the Vaex clusters"""

    __tablename__ = 'clusters'
    type = 'vaex'

    id = Column(Integer, primary_key=True)
    verbose_name = Column(String(250), unique=True)
    # short unique name, used in permissions
    cluster_name = Column(String(250), unique=True)
    coordinator_host = Column(String(255))
    coordinator_port = Column(Integer, default=8081)
    coordinator_endpoint = Column(
        String(255), default='vaex/coordinator/v1/metadata')
    broker_host = Column(String(255))
    broker_port = Column(Integer, default=8082)
    broker_endpoint = Column(String(255), default='vaex/v2')
    metadata_last_refreshed = Column(DateTime)
    cache_timeout = Column(Integer)

    export_fields = ('cluster_name', 'coordinator_host', 'coordinator_port',
                     'coordinator_endpoint', 'broker_host', 'broker_port',
                     'broker_endpoint', 'cache_timeout')
    update_from_object_fields = export_fields
    export_children = ['vaex_datasources']

    def __repr__(self):
        return self.verbose_name if self.verbose_name else self.cluster_name

    def __html__(self):
        return self.__repr__()

    @property
    def data(self):
        return {
            'id': self.id,
            'name': self.cluster_name,
            'backend': 'vaex',
        }

    @staticmethod
    def get_base_url(host, port):
        if not re.match('http(s)?://', host):
            host = 'http://' + host

        url = '{0}:{1}'.format(host, port) if port else host
        return url

    def get_base_broker_url(self):
        base_url = self.get_base_url(
            self.broker_host, self.broker_port)
        return '{base_url}/{self.broker_endpoint}'.format(**locals())

    def get_datasources(self):
        endpoint = self.get_base_broker_url() + '/vaex_datasources'
        return json.loads(requests.get(endpoint).text)

    def get_vaex_version(self):
        endpoint = self.get_base_url(
            self.coordinator_host, self.coordinator_port) + '/status'
        return json.loads(requests.get(endpoint).text)['version']

    @property
    @utils.memoized
    def vaex_version(self):
        return self.get_vaex_version()

    def refresh_datasources(
            self,
            datasource_name=None,
            merge_flag=True,
            refreshAll=True):
        """Refresh metadata of all datasources in the cluster
        If ``datasource_name`` is specified, only that datasource is updated
        """
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
        Fetches metadata for the specified datasources and
        merges to the Superset database
        """
        session = db.session
        ds_list = (
            session.query(VaexDatasource)
            .filter(VaexDatasource.cluster_name == self.cluster_name)
            .filter(VaexDatasource.datasource_name.in_(datasource_names))
        )
        ds_map = {ds.name: ds for ds in ds_list}
        for ds_name in datasource_names:
            datasource = ds_map.get(ds_name, None)
            if not datasource:
                datasource = VaexDatasource(datasource_name=ds_name)
                with session.no_autoflush:
                    session.add(datasource)
                flasher(
                    _('Adding new datasource [{}]').format(ds_name), 'success')
                ds_map[ds_name] = datasource
            elif refreshAll:
                flasher(
                    _('Refreshing datasource [{}]').format(ds_name), 'info')
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
                    session.query(VaexColumn)
                    .filter(VaexColumn.datasource_id == datasource.id)
                    .filter(VaexColumn.column_name.in_(cols.keys()))
                )
                col_objs = {col.column_name: col for col in col_objs_list}
                for col in cols:
                    if col == '__time':  # skip the time column
                        continue
                    col_obj = col_objs.get(col)
                    if not col_obj:
                        col_obj = VaexColumn(
                            datasource_id=datasource.id,
                            column_name=col)
                        with session.no_autoflush:
                            session.add(col_obj)
                    col_obj.type = cols[col]['type']
                    col_obj.datasource = datasource
                    if col_obj.type == 'STRING':
                        col_obj.groupby = True
                        col_obj.filterable = True
                    if col_obj.type == 'hyperUnique' or col_obj.type == 'thetaSketch':
                        col_obj.count_distinct = True
                    if col_obj.is_num:
                        col_obj.sum = True
                        col_obj.min = True
                        col_obj.max = True
                datasource.refresh_metrics()
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


class VaexColumn(Model, BaseColumn):
    """ORM model for storing Vaex datasource column metadata"""

    __tablename__ = 'vaex_columns'
    __table_args__ = (UniqueConstraint('column_name', 'vaex_datasource_id'),)

    vaex_datasource_id = Column(
        Integer,
        ForeignKey('vaex_datasources.id'))
    # Setting enable_typechecks=False disables polymorphic inheritance.
    datasource = relationship(
        'VaexDatasource',
        backref=backref('columns', cascade='all, delete-orphan'),
        enable_typechecks=False)

    export_fields = (
        'vaex_datasource_id', 'column_name', 'is_active', 'type', 'groupby',
        'count_distinct', 'sum', 'avg', 'max', 'min', 'filterable',
        'description',  'verbose_name',
    )
    update_from_object_fields = export_fields
    export_parent = 'datasource'

    def __repr__(self):
        return self.column_name

    @property
    def expression(self):
        return self.column_name

    def get_metrics(self):
        metrics = {}
        metrics['count'] = VaexMetric(
            metric_name='count',
            verbose_name='COUNT(*)',
            metric_type='count',
            # json=json.dumps({'type': 'count', 'name': 'count'}),
        )
        # Somehow we need to reassign this for UDAFs
        if self.type in ('DOUBLE', 'FLOAT'):
            corrected_type = 'DOUBLE'
        else:
            corrected_type = self.type

        if self.sum and self.is_num:
            mt = corrected_type.lower() + 'Sum'
            name = 'sum__' + self.column_name
            metrics[name] = VaexMetric(
                metric_name=name,
                metric_type='sum',
                verbose_name='SUM({})'.format(self.column_name),
                # json=json.dumps({
                #     'type': mt, 'name': name, 'fieldName': self.column_name}),
            )

        if self.avg and self.is_num:
            mt = corrected_type.lower() + 'Avg'
            name = 'avg__' + self.column_name
            metrics[name] = VaexMetric(
                metric_name=name,
                metric_type='avg',
                verbose_name='AVG({})'.format(self.column_name),
                # json=json.dumps({
                #     'type': mt, 'name': name, 'fieldName': self.column_name}),
            )

        if self.min and self.is_num:
            mt = corrected_type.lower() + 'Min'
            name = 'min__' + self.column_name
            metrics[name] = VaexMetric(
                metric_name=name,
                metric_type='min',
                verbose_name='MIN({})'.format(self.column_name),
                # json=json.dumps({
                #     'type': mt, 'name': name, 'fieldName': self.column_name}),
            )
        if self.max and self.is_num:
            mt = corrected_type.lower() + 'Max'
            name = 'max__' + self.column_name
            metrics[name] = VaexMetric(
                metric_name=name,
                metric_type='max',
                verbose_name='MAX({})'.format(self.column_name),
                # json=json.dumps({
                #     'type': mt, 'name': name, 'fieldName': self.column_name}),
            )
        if self.count_distinct:
            name = 'count_distinct__' + self.column_name
            if self.type == 'hyperUnique' or self.type == 'thetaSketch':
                metrics[name] = VaexMetric(
                    metric_name=name,
                    verbose_name='COUNT(DISTINCT {})'.format(self.column_name),
                    metric_type=self.type,
                    # json=json.dumps({
                    #     'type': self.type,
                    #     'name': name,
                    #     'fieldName': self.column_name,
                    # }),
                )
            else:
                metrics[name] = VaexMetric(
                    metric_name=name,
                    verbose_name='COUNT(DISTINCT {})'.format(self.column_name),
                    metric_type='count_distinct',
                    # json=json.dumps({
                    #     'type': 'cardinality',
                    #     'name': name,
                    #     'fieldNames': [self.column_name]}),
                )
        return metrics


    @classmethod
    def import_obj(cls, i_column):
        def lookup_obj(lookup_column):
            return db.session.query(VaexColumn).filter(
                VaexColumn.datasource_id == lookup_column.datasource_id,
                VaexColumn.column_name == lookup_column.column_name).first()

        return import_util.import_simple_obj(db.session, i_column, lookup_obj)


class VaexMetric(Model, BaseMetric):

    """ORM object referencing Vaex metrics for a datasource"""

    __tablename__ = 'vaex_metrics'
    __table_args__ = (UniqueConstraint('metric_name', 'vaex_datasource_id'),)
    vaex_datasource_id = Column(
        Integer,
        ForeignKey('vaex_datasources.id'))
    # Setting enable_typechecks=False disables polymorphic inheritance.
    datasource = relationship(
        'VaexDatasource',
        backref=backref('metrics', cascade='all, delete-orphan'),
        enable_typechecks=False)
    # json = Column(Text)

    export_fields = (
        'metric_name', 'verbose_name', 'metric_type', 'vaex_datasource_id',
        'description', 'is_restricted', 'd3format', 'warning_text',
    )
    update_from_object_fields = export_fields
    export_parent = 'datasource'

    @property
    def expression(self):
        return self.verbose_name

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
            return db.session.query(VaexMetric).filter(
                VaexMetric.datasource_id == lookup_metric.datasource_id,
                VaexMetric.metric_name == lookup_metric.metric_name).first()
        return import_util.import_simple_obj(db.session, i_metric, lookup_obj)


class VaexDatasource(Model, BaseDatasource):

    """ORM object referencing Vaex datasources (tables)"""

    __tablename__ = 'vaex_datasources'
    __table_args__ = (UniqueConstraint('name', 'source_url'),)

    type = 'vaex'
    query_language = 'json'
    cluster_class = VaexCluster
    metric_class = VaexMetric
    column_class = VaexColumn

    baselink = 'vaexdatasourcemodelview'

    # Columns
    # datasource_name = Column(String(255))
    # is_hidden = Column(Boolean, default=False)
    # filter_select_enabled = Column(Boolean, default=True)  # override default
    # fetch_values_from = Column(String(100))
    # cluster_name = Column(
    #     String(250), ForeignKey('clusters.cluster_name'))
    # cluster = relationship(
    #     'VaexCluster', backref='vaex_datasources', foreign_keys=[cluster_name])
    # user_id = Column(Integer, ForeignKey('ab_user.id'))
    # owner = relationship(
    #     security_manager.user_model,
    #     backref=backref('vaex_datasources', cascade='all, delete-orphan'),
    #     foreign_keys=[user_id])
    # UniqueConstraint('cluster_name', 'datasource_name')

    name = Column(String(100), nullable=False)
    source_url = Column(String(1000), nullable=False)
    format = Column(String(1000), nullable=False)
    
    export_fields = (
        'name', 'source_url', 'format'
    )
    update_from_object_fields = export_fields

    export_parent = 'cluster'
    export_children = ['columns', 'metrics']

    _ds = None

    @property
    def ds(self):
        if self._ds is None:
            self._ds = vaex.open(self.source_url)
        return self._ds

    def update_metadata(self):
        try:
            import vaex
            ds = vaex.open(self.source_url)
            print(ds.get_column_names())
            for column_name in ds.get_column_names():
                print(column_name)
                col = VaexColumn(column_name=column_name, type=str(ds.dtype(column_name)), datasource=self)
                print(col)
                self.columns.append(col)
            db.session.merge(self)
            db.session.commit()
            print('save')
        except:
            print('nopooo')
            logging.exception('error not ok')
            raise


    @property
    def database(self):
        class Wrapper:
            pass
        wrapper = Wrapper()
        wrapper.data = 'hi data'
        wrapper.cache_timeout = 2
        return wrapper

    @property
    def datasource_name(self):
        return self.source_url
    

        #return self.cluster

    @property
    def connection(self):
        return str(self.database)

    @property
    def num_cols(self):
        return [c.column_name for c in self.columns if c.is_num]

    # @property
    # def name(self):
    #     return self.name

    @property
    def schema(self):
        ds_name = self.name or ''
        name_pieces = ds_name.split('.')
        if len(name_pieces) > 1:
            return name_pieces[0]
        else:
            return None

    @property
    def schema_perm(self):
        """Returns schema permission if present, cluster one otherwise."""
        return security_manager.get_schema_perm(self.cluster, self.schema)

    def get_perm(self):
        return (
            '[{obj.source_url}]'
            '(id:{obj.id})').format(obj=self)

    def update_from_object(self, obj):
        return NotImplementedError()

    @property
    def link(self):
        name = escape(self.source_url)
        return Markup('<a href="{self.url}">{name}</a>').format(**locals())

    @property
    def full_name(self):
        return utils.get_datasource_full_name(
            self.cluster_name, self.source_url)

    @property
    def time_column_grains(self):
        return {
            'time_columns': [
                'all', '5 seconds', '30 seconds', '1 minute', '5 minutes'
                '30 minutes', '1 hour', '6 hour', '1 day', '7 days',
                'week', 'week_starting_sunday', 'week_ending_saturday',
                'month', 'quarter', 'year',
            ],
            'time_grains': ['now'],
        }

    def __repr__(self):
        return self.source_url

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

    def latest_metadata(self):
        """Returns segment metadata from the latest segment"""
        logging.info('Syncing datasource [{}]'.format(self.datasource_name))
        results = None
        max_time = datetime.now()
        lbound = (max_time - timedelta(days=7)).isoformat()
        segment_metadata = None
        column_names = self.ds.get_column_names()
        def type(column_name):
            mapping = dict(float64='FLOAT')
            mapping['datetime64[ns]'] = 'DATETIME'
            type_name = str(self.ds.dtype(column_name))
            return mapping.get(type_name, type_name)
        info = {column_name: {'type': type(column_name), 'nullable': True, 'default': None, 'autoincrement': "auto"} for column_name in column_names}
        print(info)
        return info



    def query(self, query_obj):
        print(query_obj)
        import vaex
        import numpy as np
        qry_start_dttm = datetime.now()
        ds = vaex.from_arrays(x=np.arange(5), y=np.arange(5)**2)
        df = ds.to_pandas_df()
        ds = self.ds
        for group in query_obj['groupby']:
            if not ds.iscategory(group):
                ds.categorize(group)

        if query_obj['is_timeseries']:
            column = ds['tpep_pickup_datetime'].dt.dayofyear
            binby = [column]
            limits = [1, 366]
            shape = 365
            time = np.arange('2015-01-01', '2016-01-01', dtype=np.datetime64)
            x = time.astype('datetime64[ns]')#.astype(np.int64)
            if len(query_obj['groupby']) == 0:
                count = ds.count(binby=column, limits=limits, shape=shape)
                namex = '__timestamp'
                namey = query_obj['metrics'][0]
                y = count
                print(x.shape, y.shape)
                df = pandas.DataFrame(data={namex: x, namey:y})#, query_obj['metrics'][0]: flatv})
            elif len(query_obj['groupby']) == 1:
                grid = ds.count(binby=[query_obj['groupby'][0], column], limits=[None, limits], shape=[None, shape])

                namex, namey, namez = query_obj['groupby'][0], '__timestamp', query_obj['metrics'][0] 
                labelsx = ds.category_labels(namex)
                # labelsy = ds.category_labels(namey)
                labelsy = time
                flatx = []
                flaty = []
                flatv = []
                for i, x in enumerate(labelsx):
                    for j, y in enumerate(labelsy):
                        flatx.append(int(x))
                        flaty.append(y)
                        flatv.append(grid[i,j])
                df = pandas.DataFrame(data={namex: flatx, namey:flaty, namez: flatv})


        elif query_obj['metrics'] == ['count']:
            ds = self.ds
            print('we can handle count')
            grid = ds.count(binby=query_obj['groupby'])
            if len(query_obj['groupby']) > 2:
                raise ValueError('cannot groupby with more than 2')
            if len(query_obj['groupby']) == 2:
                namex, namey = query_obj['groupby']
                labelsx = ds.category_labels(namex)
                labelsy = ds.category_labels(namey)
                flatx = []
                flaty = []
                flatv = []
                for i, x in enumerate(labelsx):
                    for j, y in enumerate(labelsy):
                        flatx.append(int(x))
                        flaty.append(int(y))
                        flatv.append(grid[i,j])
                df = pandas.DataFrame(data={namex: flatx, namey:flaty, query_obj['metrics'][0]: flatv})
            else:
                name = query_obj['groupby'][0]
                labels = ds.category_labels(name)
                df = pandas.DataFrame(index=labels, data={name: labels, query_obj['metrics'][0]: grid})
                print(grid)
        query_str = 'vaex internal'
        return QueryResult(
            df=df,
            query=query_str,
            duration=datetime.now() - qry_start_dttm)

    @classmethod
    def query_datasources_by_name(
            cls, session, database, datasource_name, schema=None):
        return (
            session.query(cls)
            .filter_by(cluster_name=database.id)
            .filter_by(datasource_name=datasource_name)
            .all()
        )

    def external_metadata(self):
        self.merge_flag = True
        return [
            {
                'name': k,
                'type': v.get('type'),
            }
            for k, v in self.latest_metadata().items()
        ]


sa.event.listen(VaexDatasource, 'after_insert', security_manager.set_perm)
sa.event.listen(VaexDatasource, 'after_update', security_manager.set_perm)
