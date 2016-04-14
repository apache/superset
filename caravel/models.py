"""A collection of ORM sqlalchemy models for Caravel"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import functools
import json
import logging
import textwrap
from collections import namedtuple
from copy import deepcopy, copy
from datetime import timedelta, datetime, date

import humanize
import pandas as pd
import requests
import sqlalchemy as sqla
import sqlparse
from dateutil.parser import parse
from flask import flash, request, g
from flask.ext.appbuilder import Model
from flask.ext.appbuilder.models.mixins import AuditMixin
from pydruid import client
from pydruid.utils.filters import Dimension, Filter
from six import string_types
from sqlalchemy import (
    Column, Integer, String, ForeignKey, Text, Boolean, DateTime, Date,
    Table, create_engine, MetaData, desc, select, and_, func)
from sqlalchemy.engine import reflection
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.orm import relationship
from sqlalchemy.sql import table, literal_column, text, column
from sqlalchemy.sql.elements import ColumnClause
from sqlalchemy_utils import EncryptedType

from caravel import app, db, get_session, utils
from caravel.viz import viz_types

config = app.config

QueryResult = namedtuple('namedtuple', ['df', 'query', 'duration'])


class AuditMixinNullable(AuditMixin):

    """Altering the AuditMixin to use nullable fields

    Allows creating objects programmatically outside of CRUD
    """

    created_on = Column(DateTime, default=datetime.now, nullable=True)
    changed_on = Column(
        DateTime, default=datetime.now,
        onupdate=datetime.now, nullable=True)

    @declared_attr
    def created_by_fk(cls):  # noqa
        return Column(Integer, ForeignKey('ab_user.id'),
                      default=cls.get_user_id, nullable=True)

    @declared_attr
    def changed_by_fk(cls):  # noqa
        return Column(
            Integer, ForeignKey('ab_user.id'),
            default=cls.get_user_id, onupdate=cls.get_user_id, nullable=True)

    @property
    def created_by_(self):  # noqa
        return '{}'.format(self.created_by or '')

    @property # noqa
    def changed_by_(self):
        return '{}'.format(self.changed_by or '')

    @property
    def modified(self):
        s = humanize.naturaltime(datetime.now() - self.changed_on)
        return '<span class="no-wrap">{}</nobr>'.format(s)

    @property
    def icons(self):
        return """
        <a
                href="{self.datasource_edit_url}"
                data-toggle="tooltip"
                title="{self.datasource}">
            <i class="fa fa-database"></i>
        </a>
        """.format(**locals())


class Url(Model, AuditMixinNullable):

    """Used for the short url feature"""

    __tablename__ = 'url'
    id = Column(Integer, primary_key=True)
    url = Column(Text)


class CssTemplate(Model, AuditMixinNullable):

    """CSS templates for dashboards"""

    __tablename__ = 'css_templates'
    id = Column(Integer, primary_key=True)
    template_name = Column(String(250))
    css = Column(Text, default='')


class Slice(Model, AuditMixinNullable):

    """A slice is essentially a report or a view on data"""

    __tablename__ = 'slices'
    id = Column(Integer, primary_key=True)
    slice_name = Column(String(250))
    druid_datasource_id = Column(Integer, ForeignKey('datasources.id'))
    table_id = Column(Integer, ForeignKey('tables.id'))
    datasource_type = Column(String(200))
    datasource_name = Column(String(2000))
    viz_type = Column(String(250))
    params = Column(Text)
    description = Column(Text)
    cache_timeout = Column(Integer)

    table = relationship(
        'SqlaTable', foreign_keys=[table_id], backref='slices')
    druid_datasource = relationship(
        'DruidDatasource', foreign_keys=[druid_datasource_id], backref='slices')

    def __repr__(self):
        return self.slice_name

    @property
    def datasource(self):
        return self.table or self.druid_datasource

    @property
    def datasource_link(self):
        if self.table:
            return self.table.link
        elif self.druid_datasource:
            return self.druid_datasource.link

    @property
    def datasource_edit_url(self):
        if self.table:
            return self.table.url
        elif self.druid_datasource:
            return self.druid_datasource.url

    @property
    @utils.memoized
    def viz(self):
        d = json.loads(self.params)
        viz_class = viz_types[self.viz_type]
        return viz_class(self.datasource, form_data=d)

    @property
    def description_markeddown(self):
        return utils.markdown(self.description)

    @property
    def datasource_id(self):
        return self.table_id or self.druid_datasource_id

    @property
    def data(self):
        d = {}
        self.token = ''
        try:
            d = self.viz.data
            self.token = d.get('token')
        except Exception as e:
            d['error'] = str(e)
        d['slice_id'] = self.id
        return d

    @property
    def json_data(self):
        return json.dumps(self.data)

    @property
    def slice_url(self):
        """Defines the url to access the slice"""
        try:
            slice_params = json.loads(self.params)
        except Exception as e:
            logging.exception(e)
            slice_params = {}
        slice_params['slice_id'] = self.id
        slice_params['json'] = "false"
        slice_params['slice_name'] = self.slice_name
        from werkzeug.urls import Href
        href = Href(
            "/caravel/explore/{obj.datasource_type}/"
            "{obj.datasource_id}/".format(obj=self))
        return href(slice_params)

    @property
    def edit_url(self):
        return "/slicemodelview/edit/{}".format(self.id)

    @property
    def slice_link(self):
        url = self.slice_url
        return '<a href="{url}">{obj.slice_name}</a>'.format(
            url=url, obj=self)


dashboard_slices = Table(
    'dashboard_slices', Model.metadata,
    Column('id', Integer, primary_key=True),
    Column('dashboard_id', Integer, ForeignKey('dashboards.id')),
    Column('slice_id', Integer, ForeignKey('slices.id')),
)


class Dashboard(Model, AuditMixinNullable):

    """The dashboard object!"""

    __tablename__ = 'dashboards'
    id = Column(Integer, primary_key=True)
    dashboard_title = Column(String(500))
    position_json = Column(Text)
    description = Column(Text)
    css = Column(Text)
    json_metadata = Column(Text)
    slug = Column(String(255), unique=True)
    slices = relationship(
        'Slice', secondary=dashboard_slices, backref='dashboards')

    def __repr__(self):
        return self.dashboard_title

    @property
    def url(self):
        return "/caravel/dashboard/{}/".format(self.slug or self.id)

    @property
    def metadata_dejson(self):
        if self.json_metadata:
            return json.loads(self.json_metadata)
        else:
            return {}

    def dashboard_link(self):
        return '<a href="{obj.url}">{obj.dashboard_title}</a>'.format(obj=self)

    @property
    def json_data(self):
        d = {
            'id': self.id,
            'metadata': self.metadata_dejson,
            'dashboard_title': self.dashboard_title,
            'slug': self.slug,
            'slices': [slc.data for slc in self.slices],
        }
        return json.dumps(d)


class Queryable(object):

    """A common interface to objects that are queryable (tables and datasources)"""

    @property
    def column_names(self):
        return sorted([c.column_name for c in self.columns])

    @property
    def main_dttm_col(self):
        return "timestamp"

    @property
    def groupby_column_names(self):
        return sorted([c.column_name for c in self.columns if c.groupby])

    @property
    def filterable_column_names(self):
        return sorted([c.column_name for c in self.columns if c.filterable])

    @property
    def dttm_cols(self):
        return []


class Database(Model, AuditMixinNullable):

    """An ORM object that stores Database related information"""

    __tablename__ = 'dbs'
    id = Column(Integer, primary_key=True)
    database_name = Column(String(250), unique=True)
    sqlalchemy_uri = Column(String(1024))
    password = Column(EncryptedType(String(1024), config.get('SECRET_KEY')))
    cache_timeout = Column(Integer)
    extra = Column(Text, default=textwrap.dedent("""\
    {
        "metadata_params": {},
        "engine_params": {}
    }
    """))

    def __repr__(self):
        return self.database_name

    def get_sqla_engine(self):
        extra = self.get_extra()
        params = extra.get('engine_params', {})
        return create_engine(self.sqlalchemy_uri_decrypted, **params)

    def safe_sqlalchemy_uri(self):
        return self.sqlalchemy_uri

    def grains(self):
        """Defines time granularity database-specific expressions.

        The idea here is to make it easy for users to change the time grain
        form a datetime (maybe the source grain is arbitrary timestamps, daily
        or 5 minutes increments) to another, "truncated" datetime. Since
        each database has slightly different but similar datetime functions,
        this allows a mapping between database engines and actual functions.
        """
        Grain = namedtuple('Grain', 'name function')
        db_time_grains = {
            'presto': (
                Grain('Time Column', '{col}'),
                Grain('week', "date_trunc('week', CAST({col} AS DATE))"),
                Grain('month', "date_trunc('month', CAST({col} AS DATE))"),
                Grain("week_ending_saturday", "date_add('day', 5, "
                      "date_trunc('week', date_add('day', 1, CAST({col} AS DATE))))"),
                Grain("week_start_sunday", "date_add('day', -1, "
                      "date_trunc('week', date_add('day', 1, CAST({col} AS DATE))))")
            ),
            'mysql': (
                Grain('Time Column', '{col}'),
                Grain('day', 'DATE({col})'),
                Grain("week", "DATE(DATE_SUB({col}, "
                      "INTERVAL DAYOFWEEK({col}) - 1 DAY))"),
                Grain("month", "DATE(DATE_SUB({col}, "
                      "INTERVAL DAYOFMONTH({col}) - 1 DAY))"),
            ),
            'postgresql': (
                Grain("Time Column", "{col}"),
                Grain("hour", "DATE_TRUNC('hour', {col})"),
                Grain("day", "DATE_TRUNC('day', {col})"),
                Grain("week", "DATE_TRUNC('week', {col})"),
                Grain("month", "DATE_TRUNC('month', {col})"),
                Grain("year", "DATE_TRUNC('year', {col})"),
            ),
        }
        db_time_grains['redshift'] = db_time_grains['postgresql']
        for db_type, grains in db_time_grains.items():
            if self.sqlalchemy_uri.startswith(db_type):
                return grains

    def grains_dict(self):
        return {grain.name: grain for grain in self.grains()}

    def get_extra(self):
        extra = {}
        if self.extra:
            try:
                extra = json.loads(self.extra)
            except Exception as e:
                logging.error(e)
        return extra

    def get_table(self, table_name, schema=None):
        extra = self.get_extra()
        meta = MetaData(**extra.get('metadata_params', {}))
        return Table(
            table_name, meta,
            schema=schema or None,
            autoload=True,
            autoload_with=self.get_sqla_engine())

    def get_columns(self, table_name):
        engine = self.get_sqla_engine()
        insp = reflection.Inspector.from_engine(engine)
        return insp.get_columns(table_name)

    @property
    def sqlalchemy_uri_decrypted(self):
        conn = sqla.engine.url.make_url(self.sqlalchemy_uri)
        conn.password = self.password
        return str(conn)

    @property
    def sql_url(self):
        return '/caravel/sql/{}/'.format(self.id)

    @property
    def sql_link(self):
        return '<a href="{}">SQL</a>'.format(self.sql_url)


class SqlaTable(Model, Queryable, AuditMixinNullable):

    """An ORM object for SqlAlchemy table references"""

    type = "table"

    __tablename__ = 'tables'
    id = Column(Integer, primary_key=True)
    table_name = Column(String(250), unique=True)
    main_dttm_col = Column(String(250))
    description = Column(Text)
    default_endpoint = Column(Text)
    database_id = Column(Integer, ForeignKey('dbs.id'), nullable=False)
    is_featured = Column(Boolean, default=False)
    user_id = Column(Integer, ForeignKey('ab_user.id'))
    owner = relationship('User', backref='tables', foreign_keys=[user_id])
    database = relationship(
        'Database', backref='tables', foreign_keys=[database_id])
    offset = Column(Integer, default=0)
    cache_timeout = Column(Integer)
    schema = Column(String(256))

    baselink = "tablemodelview"

    def __repr__(self):
        return self.table_name

    @property
    def description_markeddown(self):
        return utils.markdown(self.description)

    @property
    def url(self):
        return '/tablemodelview/edit/{}'.format(self.id)

    @property
    def link(self):
        return '<a href="{self.url}">{self.table_name}</a>'.format(**locals())

    @property
    def perm(self):
        return (
            "[{obj.database}].[{obj.table_name}]"
            "(id:{obj.id})").format(obj=self)

    @property
    def full_name(self):
        return "[{obj.database}].[{obj.table_name}]".format(obj=self)

    @property
    def dttm_cols(self):
        l = [c.column_name for c in self.columns if c.is_dttm]
        if self.main_dttm_col not in l:
            l.append(self.main_dttm_col)
        return l

    @property
    def any_dttm_col(self):
        cols = self.dttm_cols
        if cols:
            return cols[0]

    @property
    def html(self):
        t = ((c.column_name, c.type) for c in self.columns)
        df = pd.DataFrame(t)
        df.columns = ['field', 'type']
        return df.to_html(
            index=False,
            classes=(
                "dataframe table table-striped table-bordered "
                "table-condensed"))

    @property
    def name(self):
        return self.table_name

    @property
    def explore_url(self):
        if self.default_endpoint:
            return self.default_endpoint
        else:
            return "/caravel/explore/{obj.type}/{obj.id}/".format(obj=self)

    @property
    def table_link(self):
        return '<a href="{obj.explore_url}">{obj.table_name}</a>'.format(obj=self)

    @property
    def metrics_combo(self):
        return sorted(
            [
                (m.metric_name, m.verbose_name or m.metric_name)
                for m in self.metrics],
            key=lambda x: x[1])

    @property
    def sql_url(self):
        return self.database.sql_url + "?table_name=" + str(self.table_name)

    @property
    def sql_link(self):
        return '<a href="{}">SQL</a>'.format(self.sql_url)

    def query(  # sqla
            self, groupby, metrics,
            granularity,
            from_dttm, to_dttm,
            filter=None,  # noqa
            is_timeseries=True,
            timeseries_limit=15, row_limit=None,
            inner_from_dttm=None, inner_to_dttm=None,
            extras=None,
            columns=None):
        """Querying any sqla table from this common interface"""
        # For backward compatibility
        if granularity not in self.dttm_cols:
            granularity = self.main_dttm_col

        cols = {col.column_name: col for col in self.columns}
        qry_start_dttm = datetime.now()

        if not granularity and is_timeseries:
            raise Exception(
                "Datetime column not provided as part table configuration "
                "and is required by this type of chart")

        metrics_exprs = [
            literal_column(m.expression).label(m.metric_name)
            for m in self.metrics if m.metric_name in metrics]

        if metrics:
            main_metric_expr = literal_column([
                m.expression for m in self.metrics
                if m.metric_name == metrics[0]][0])
        else:
            main_metric_expr = literal_column("COUNT(*)")

        select_exprs = []
        groupby_exprs = []

        if groupby:
            select_exprs = []
            inner_select_exprs = []
            inner_groupby_exprs = []
            for s in groupby:
                col = cols[s]
                expr = col.expression
                if expr:
                    outer = literal_column(expr).label(s)
                    inner = literal_column(expr).label('__' + s)
                else:
                    outer = column(s).label(s)
                    inner = column(s).label('__' + s)

                groupby_exprs.append(outer)
                select_exprs.append(outer)
                inner_groupby_exprs.append(inner)
                inner_select_exprs.append(inner)
        elif columns:
            for s in columns:
                select_exprs.append(s)
            metrics_exprs = []

        if granularity:
            dttm_expr = cols[granularity].expression or granularity
            timestamp = literal_column(dttm_expr).label('timestamp')

            # Transforming time grain into an expression based on configuration
            time_grain_sqla = extras.get('time_grain_sqla')
            if time_grain_sqla:
                udf = self.database.grains_dict().get(time_grain_sqla, '{col}')
                timestamp_grain = literal_column(
                    udf.function.format(col=dttm_expr)).label('timestamp')
            else:
                timestamp_grain = timestamp

            if is_timeseries:
                select_exprs += [timestamp_grain]
                groupby_exprs += [timestamp_grain]

            tf = '%Y-%m-%d %H:%M:%S.%f'
            time_filter = [
                timestamp >= from_dttm.strftime(tf),
                timestamp <= to_dttm.strftime(tf),
            ]
            inner_time_filter = copy(time_filter)
            if inner_from_dttm:
                inner_time_filter[0] = timestamp >= inner_from_dttm.strftime(tf)
            if inner_to_dttm:
                inner_time_filter[1] = timestamp <= inner_to_dttm.strftime(tf)
        else:
            inner_time_filter = []

        select_exprs += metrics_exprs
        qry = select(select_exprs)

        tbl = table(self.table_name)
        if self.schema:
            tbl.schema = self.schema

        if not columns:
            qry = qry.group_by(*groupby_exprs)

        where_clause_and = []
        having_clause_and = []
        for col, op, eq in filter:
            col_obj = cols[col]
            if op in ('in', 'not in'):
                values = eq.split(",")
                if col_obj.expression:
                    cond = ColumnClause(
                        col_obj.expression, is_literal=True).in_(values)
                else:
                    cond = column(col).in_(values)
                if op == 'not in':
                    cond = ~cond
                where_clause_and.append(cond)
        if extras and 'where' in extras:
            where_clause_and += [text(extras['where'])]
        if extras and 'having' in extras:
            having_clause_and += [text(extras['having'])]
        if granularity:
            qry = qry.where(and_(*(time_filter + where_clause_and)))
        else:
            qry = qry.where(and_(*where_clause_and))
        qry = qry.having(and_(*having_clause_and))
        if groupby:
            qry = qry.order_by(desc(main_metric_expr))
        qry = qry.limit(row_limit)

        if timeseries_limit and groupby:
            subq = select(inner_select_exprs)
            subq = subq.select_from(tbl)
            subq = subq.where(and_(*(where_clause_and + inner_time_filter)))
            subq = subq.group_by(*inner_groupby_exprs)
            subq = subq.order_by(desc(main_metric_expr))
            subq = subq.limit(timeseries_limit)
            on_clause = []
            for i, gb in enumerate(groupby):
                on_clause.append(
                    groupby_exprs[i] == column("__" + gb))

            tbl = tbl.join(subq.alias(), and_(*on_clause))

        qry = qry.select_from(tbl)

        engine = self.database.get_sqla_engine()
        sql = "{}".format(
            qry.compile(engine, compile_kwargs={"literal_binds": True}))
        df = pd.read_sql_query(
            sql=sql,
            con=engine
        )
        sql = sqlparse.format(sql, reindent=True)
        return QueryResult(
            df=df, duration=datetime.now() - qry_start_dttm, query=sql)

    def fetch_metadata(self):
        """Fetches the metadata for the table and merges it in"""
        try:
            table = self.database.get_table(self.table_name, schema=self.schema)
        except Exception as e:
            flash(str(e))
            flash(
                "Table doesn't seem to exist in the specified database, "
                "couldn't fetch column information", "danger")
            return

        TC = TableColumn  # noqa shortcut to class
        M = SqlMetric  # noqa
        metrics = []
        any_date_col = None
        for col in table.columns:
            try:
                datatype = str(col.type)
            except Exception as e:
                datatype = "UNKNOWN"
            dbcol = (
                db.session
                .query(TC)
                .filter(TC.table == self)
                .filter(TC.column_name == col.name)
                .first()
            )
            db.session.flush()
            if not dbcol:
                dbcol = TableColumn(column_name=col.name)
                num_types = ('DOUBLE', 'FLOAT', 'INT', 'BIGINT', 'LONG')
                datatype = str(datatype).upper()
                if (
                        str(datatype).startswith('VARCHAR') or
                        str(datatype).startswith('STRING')):
                    dbcol.groupby = True
                    dbcol.filterable = True
                elif any([t in datatype for t in num_types]):
                    dbcol.sum = True
            db.session.merge(self)
            self.columns.append(dbcol)

            if not any_date_col and 'date' in datatype.lower():
                any_date_col = col.name

            quoted = "{}".format(
                column(dbcol.column_name).compile(dialect=db.engine.dialect))
            if dbcol.sum:
                metrics.append(M(
                    metric_name='sum__' + dbcol.column_name,
                    verbose_name='sum__' + dbcol.column_name,
                    metric_type='sum',
                    expression="SUM({})".format(quoted)
                ))
            if dbcol.max:
                metrics.append(M(
                    metric_name='max__' + dbcol.column_name,
                    verbose_name='max__' + dbcol.column_name,
                    metric_type='max',
                    expression="MAX({})".format(quoted)
                ))
            if dbcol.min:
                metrics.append(M(
                    metric_name='min__' + dbcol.column_name,
                    verbose_name='min__' + dbcol.column_name,
                    metric_type='min',
                    expression="MIN({})".format(quoted)
                ))
            if dbcol.count_distinct:
                metrics.append(M(
                    metric_name='count_distinct__' + dbcol.column_name,
                    verbose_name='count_distinct__' + dbcol.column_name,
                    metric_type='count_distinct',
                    expression="COUNT(DISTINCT {})".format(quoted)
                ))
            dbcol.type = datatype
            db.session.merge(self)
            db.session.commit()

        metrics.append(M(
            metric_name='count',
            verbose_name='COUNT(*)',
            metric_type='count',
            expression="COUNT(*)"
        ))
        for metric in metrics:
            m = (
                db.session.query(M)
                .filter(M.metric_name == metric.metric_name)
                .filter(M.table_id == self.id)
                .first()
            )
            metric.table_id = self.id
            if not m:
                db.session.add(metric)
                db.session.commit()
        if not self.main_dttm_col:
            self.main_dttm_col = any_date_col


class SqlMetric(Model, AuditMixinNullable):

    """ORM object for metrics, each table can have multiple metrics"""

    __tablename__ = 'sql_metrics'
    id = Column(Integer, primary_key=True)
    metric_name = Column(String(512))
    verbose_name = Column(String(1024))
    metric_type = Column(String(32))
    table_id = Column(Integer, ForeignKey('tables.id'))
    table = relationship(
        'SqlaTable', backref='metrics', foreign_keys=[table_id])
    expression = Column(Text)
    description = Column(Text)


class TableColumn(Model, AuditMixinNullable):

    """ORM object for table columns, each table can have multiple columns"""

    __tablename__ = 'table_columns'
    id = Column(Integer, primary_key=True)
    table_id = Column(Integer, ForeignKey('tables.id'))
    table = relationship(
        'SqlaTable', backref='columns', foreign_keys=[table_id])
    column_name = Column(String(256))
    is_dttm = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    type = Column(String(32), default='')
    groupby = Column(Boolean, default=False)
    count_distinct = Column(Boolean, default=False)
    sum = Column(Boolean, default=False)
    max = Column(Boolean, default=False)
    min = Column(Boolean, default=False)
    filterable = Column(Boolean, default=False)
    expression = Column(Text, default='')
    description = Column(Text, default='')

    def __repr__(self):
        return self.column_name

    @property
    def isnum(self):
        types = ('LONG', 'DOUBLE', 'FLOAT', 'BIGINT', 'INT')
        return any([t in self.type.upper() for t in types])


class DruidCluster(Model, AuditMixinNullable):

    """ORM object referencing the Druid clusters"""

    __tablename__ = 'clusters'
    id = Column(Integer, primary_key=True)
    cluster_name = Column(String(250), unique=True)
    coordinator_host = Column(String(256))
    coordinator_port = Column(Integer)
    coordinator_endpoint = Column(
        String(256), default='druid/coordinator/v1/metadata')
    broker_host = Column(String(256))
    broker_port = Column(Integer)
    broker_endpoint = Column(String(256), default='druid/v2')
    metadata_last_refreshed = Column(DateTime)

    def __repr__(self):
        return self.cluster_name

    def get_pydruid_client(self):
        cli = client.PyDruid(
            "http://{0}:{1}/".format(self.broker_host, self.broker_port),
            self.broker_endpoint)
        return cli

    def refresh_datasources(self):
        endpoint = (
            "http://{obj.coordinator_host}:{obj.coordinator_port}/"
            "{obj.coordinator_endpoint}/datasources"
        ).format(obj=self)

        datasources = json.loads(requests.get(endpoint).text)
        for datasource in datasources:
            DruidDatasource.sync_to_db(datasource, self)


class DruidDatasource(Model, AuditMixinNullable, Queryable):

    """ORM object referencing Druid datasources (tables)"""

    type = "druid"

    baselink = "datasourcemodelview"

    __tablename__ = 'datasources'
    id = Column(Integer, primary_key=True)
    datasource_name = Column(String(250), unique=True)
    is_featured = Column(Boolean, default=False)
    is_hidden = Column(Boolean, default=False)
    description = Column(Text)
    default_endpoint = Column(Text)
    user_id = Column(Integer, ForeignKey('ab_user.id'))
    owner = relationship('User', backref='datasources', foreign_keys=[user_id])
    cluster_name = Column(
        String(250), ForeignKey('clusters.cluster_name'))
    cluster = relationship(
        'DruidCluster', backref='datasources', foreign_keys=[cluster_name])
    offset = Column(Integer, default=0)
    cache_timeout = Column(Integer)

    @property
    def metrics_combo(self):
        return sorted(
            [(m.metric_name, m.verbose_name) for m in self.metrics],
            key=lambda x: x[1])

    @property
    def name(self):
        return self.datasource_name

    @property
    def perm(self):
        return (
            "[{obj.cluster_name}].[{obj.datasource_name}]"
            "(id:{obj.id})").format(obj=self)

    @property
    def url(self):
        return '/datasourcemodelview/edit/{}'.format(self.id)

    @property
    def link(self):
        return (
            '<a href="{self.url}">'
            '{self.datasource_name}</a>').format(**locals())

    @property
    def full_name(self):
        return (
            "[{obj.cluster_name}]."
            "[{obj.datasource_name}]").format(obj=self)

    def __repr__(self):
        return self.datasource_name

    @property
    def datasource_link(self):
        url = "/caravel/explore/{obj.type}/{obj.id}/".format(obj=self)
        return '<a href="{url}">{obj.datasource_name}</a>'.format(
            url=url, obj=self)

    def get_metric_obj(self, metric_name):
        return [
            m.json_obj for m in self.metrics
            if m.metric_name == metric_name
        ][0]

    def latest_metadata(self):
        """Returns segment metadata from the latest segment"""
        client = self.cluster.get_pydruid_client()
        results = client.time_boundary(datasource=self.datasource_name)
        if not results:
            return
        max_time = results[0]['result']['maxTime']
        max_time = parse(max_time)
        # Query segmentMetadata for 7 days back. However, due to a bug,
        # we need to set this interval to more than 1 day ago to exclude
        # realtime segments, which trigged a bug (fixed in druid 0.8.2).
        # https://groups.google.com/forum/#!topic/druid-user/gVCqqspHqOQ
        intervals = (max_time - timedelta(days=7)).isoformat() + '/'
        intervals += (max_time - timedelta(days=1)).isoformat()
        segment_metadata = client.segment_metadata(
            datasource=self.datasource_name,
            intervals=intervals)
        if segment_metadata:
            return segment_metadata[-1]['columns']

    def generate_metrics(self):
        for col in self.columns:
            col.generate_metrics()

    @classmethod
    def sync_to_db(cls, name, cluster):
        """Fetches metadata for that datasource and merges the Caravel db"""
        print("Syncing Druid datasource [{}]".format(name))
        session = get_session()
        datasource = session.query(cls).filter_by(datasource_name=name).first()
        if not datasource:
            datasource = cls(datasource_name=name)
            session.add(datasource)
            flash("Adding new datasource [{}]".format(name), "success")
        else:
            flash("Refreshing datasource [{}]".format(name), "info")
        datasource.cluster = cluster

        cols = datasource.latest_metadata()
        if not cols:
            return
        for col in cols:
            col_obj = (
                session
                .query(DruidColumn)
                .filter_by(datasource_name=name, column_name=col)
                .first()
            )
            datatype = cols[col]['type']
            if not col_obj:
                col_obj = DruidColumn(datasource_name=name, column_name=col)
                session.add(col_obj)
            if datatype == "STRING":
                col_obj.groupby = True
                col_obj.filterable = True
            if col_obj:
                col_obj.type = cols[col]['type']
            col_obj.datasource = datasource
            col_obj.generate_metrics()

    def query(
            self, groupby, metrics,
            granularity,
            from_dttm, to_dttm,
            filter=None,  # noqa
            is_timeseries=True,
            timeseries_limit=None,
            row_limit=None,
            inner_from_dttm=None, inner_to_dttm=None,
            extras=None,  # noqa
            select=None,):  # noqa
        """Runs a query against Druid and returns a dataframe.

        This query interface is common to SqlAlchemy and Druid
        """
        # TODO refactor into using a TBD Query object
        qry_start_dttm = datetime.now()

        inner_from_dttm = inner_from_dttm or from_dttm
        inner_to_dttm = inner_to_dttm or to_dttm

        # add tzinfo to native datetime with config
        from_dttm = from_dttm.replace(tzinfo=config.get("DRUID_TZ"))
        to_dttm = to_dttm.replace(tzinfo=config.get("DRUID_TZ"))

        query_str = ""
        aggregations = {
            m.metric_name: m.json_obj
            for m in self.metrics if m.metric_name in metrics
        }
        granularity = granularity or "all"
        if granularity != "all":
            granularity = utils.parse_human_timedelta(
                granularity).total_seconds() * 1000
        if not isinstance(granularity, string_types):
            granularity = {"type": "duration", "duration": granularity}

        qry = dict(
            datasource=self.datasource_name,
            dimensions=groupby,
            aggregations=aggregations,
            granularity=granularity,
            intervals=from_dttm.isoformat() + '/' + to_dttm.isoformat(),
        )
        filters = None
        for col, op, eq in filter:
            cond = None
            if op == '==':
                cond = Dimension(col) == eq
            elif op == '!=':
                cond = ~(Dimension(col) == eq)
            elif op in ('in', 'not in'):
                fields = []
                splitted = eq.split(',')
                if len(splitted) > 1:
                    for s in eq.split(','):
                        s = s.strip()
                        fields.append(Filter.build_filter(Dimension(col) == s))
                    cond = Filter(type="or", fields=fields)
                else:
                    cond = Dimension(col) == eq
                if op == 'not in':
                    cond = ~cond
            if filters:
                filters = Filter(type="and", fields=[
                    Filter.build_filter(cond),
                    Filter.build_filter(filters)
                ])
            else:
                filters = cond

        if filters:
            qry['filter'] = filters

        client = self.cluster.get_pydruid_client()
        orig_filters = filters
        if timeseries_limit and is_timeseries:
            # Limit on the number of timeseries, doing a two-phases query
            pre_qry = deepcopy(qry)
            pre_qry['granularity'] = "all"
            pre_qry['limit_spec'] = {
                "type": "default",
                "limit": timeseries_limit,
                'intervals': (
                    inner_from_dttm.isoformat() + '/' +
                    inner_to_dttm.isoformat()),
                "columns": [{
                    "dimension": metrics[0] if metrics else self.metrics[0],
                    "direction": "descending",
                }],
            }
            client.groupby(**pre_qry)
            query_str += "// Two phase query\n// Phase 1\n"
            query_str += json.dumps(client.query_dict, indent=2) + "\n"
            query_str += "//\nPhase 2 (built based on phase one's results)\n"
            df = client.export_pandas()
            if df is not None and not df.empty:
                dims = qry['dimensions']
                filters = []
                for _, row in df.iterrows():
                    fields = []
                    for dim in dims:
                        f = Filter.build_filter(Dimension(dim) == row[dim])
                        fields.append(f)
                    if len(fields) > 1:
                        filt = Filter(type="and", fields=fields)
                        filters.append(Filter.build_filter(filt))
                    elif fields:
                        filters.append(fields[0])

                if filters:
                    ff = Filter(type="or", fields=filters)
                    if not orig_filters:
                        qry['filter'] = ff
                    else:
                        qry['filter'] = Filter(type="and", fields=[
                            Filter.build_filter(ff),
                            Filter.build_filter(orig_filters)])
                qry['limit_spec'] = None
        if row_limit:
            qry['limit_spec'] = {
                "type": "default",
                "limit": row_limit,
                "columns": [{
                    "dimension": metrics[0] if metrics else self.metrics[0],
                    "direction": "descending",
                }],
            }
        client.groupby(**qry)
        query_str += json.dumps(client.query_dict, indent=2)
        df = client.export_pandas()
        if df is None or df.size == 0:
            raise Exception("No data was returned.")

        if (
                not is_timeseries and
                granularity == "all" and
                'timestamp' in df.columns):
            del df['timestamp']

        # Reordering columns
        cols = []
        if 'timestamp' in df.columns:
            cols += ['timestamp']
        cols += [col for col in groupby if col in df.columns]
        cols += [col for col in metrics if col in df.columns]
        cols += [col for col in df.columns if col not in cols]
        df = df[cols]
        return QueryResult(
            df=df,
            query=query_str,
            duration=datetime.now() - qry_start_dttm)


class Log(Model):

    """ORM object used to log Caravel actions to the database"""

    __tablename__ = 'logs'

    id = Column(Integer, primary_key=True)
    action = Column(String(512))
    user_id = Column(Integer, ForeignKey('ab_user.id'))
    dashboard_id = Column(Integer)
    slice_id = Column(Integer)
    user_id = Column(Integer, ForeignKey('ab_user.id'))
    json = Column(Text)
    user = relationship('User', backref='logs', foreign_keys=[user_id])
    dttm = Column(DateTime, default=func.now())
    dt = Column(Date, default=date.today())

    @classmethod
    def log_this(cls, f):
        """Decorator to log user actions"""
        @functools.wraps(f)
        def wrapper(*args, **kwargs):
            user_id = None
            if g.user:
                user_id = g.user.id
            d = request.args.to_dict()
            d.update(kwargs)
            log = cls(
                action=f.__name__,
                json=json.dumps(d),
                dashboard_id=d.get('dashboard_id') or None,
                slice_id=d.get('slice_id') or None,
                user_id=user_id)
            db.session.add(log)
            db.session.commit()
            return f(*args, **kwargs)
        return wrapper


class DruidMetric(Model, AuditMixinNullable):

    """ORM object referencing Druid metrics for a datasource"""

    __tablename__ = 'metrics'
    id = Column(Integer, primary_key=True)
    metric_name = Column(String(512))
    verbose_name = Column(String(1024))
    metric_type = Column(String(32))
    datasource_name = Column(
        String(250),
        ForeignKey('datasources.datasource_name'))
    # Setting enable_typechecks=False disables polymorphic inheritance.
    datasource = relationship('DruidDatasource', backref='metrics',
                              enable_typechecks=False)
    json = Column(Text)
    description = Column(Text)

    @property
    def json_obj(self):
        try:
            obj = json.loads(self.json)
        except Exception:
            obj = {}
        return obj


class DruidColumn(Model, AuditMixinNullable):

    """ORM model for storing Druid datasource column metadata"""

    __tablename__ = 'columns'
    id = Column(Integer, primary_key=True)
    datasource_name = Column(
        String(250),
        ForeignKey('datasources.datasource_name'))
    # Setting enable_typechecks=False disables polymorphic inheritance.
    datasource = relationship('DruidDatasource', backref='columns',
                              enable_typechecks=False)
    column_name = Column(String(256))
    is_active = Column(Boolean, default=True)
    type = Column(String(32))
    groupby = Column(Boolean, default=False)
    count_distinct = Column(Boolean, default=False)
    sum = Column(Boolean, default=False)
    max = Column(Boolean, default=False)
    min = Column(Boolean, default=False)
    filterable = Column(Boolean, default=False)
    description = Column(Text)

    def __repr__(self):
        return self.column_name

    @property
    def isnum(self):
        return self.type in ('LONG', 'DOUBLE', 'FLOAT')

    def generate_metrics(self):
        """Generate metrics based on the column metadata"""
        M = DruidMetric  # noqa
        metrics = []
        metrics.append(DruidMetric(
            metric_name='count',
            verbose_name='COUNT(*)',
            metric_type='count',
            json=json.dumps({'type': 'count', 'name': 'count'})
        ))
        # Somehow we need to reassign this for UDAFs
        if self.type in ('DOUBLE', 'FLOAT'):
            corrected_type = 'DOUBLE'
        else:
            corrected_type = self.type

        if self.sum and self.isnum:
            mt = corrected_type.lower() + 'Sum'
            name = 'sum__' + self.column_name
            metrics.append(DruidMetric(
                metric_name=name,
                metric_type='sum',
                verbose_name='SUM({})'.format(self.column_name),
                json=json.dumps({
                    'type': mt, 'name': name, 'fieldName': self.column_name})
            ))
        if self.min and self.isnum:
            mt = corrected_type.lower() + 'Min'
            name = 'min__' + self.column_name
            metrics.append(DruidMetric(
                metric_name=name,
                metric_type='min',
                verbose_name='MIN({})'.format(self.column_name),
                json=json.dumps({
                    'type': mt, 'name': name, 'fieldName': self.column_name})
            ))
        if self.max and self.isnum:
            mt = corrected_type.lower() + 'Max'
            name = 'max__' + self.column_name
            metrics.append(DruidMetric(
                metric_name=name,
                metric_type='max',
                verbose_name='MAX({})'.format(self.column_name),
                json=json.dumps({
                    'type': mt, 'name': name, 'fieldName': self.column_name})
            ))
        if self.count_distinct:
            mt = 'count_distinct'
            name = 'count_distinct__' + self.column_name
            metrics.append(DruidMetric(
                metric_name=name,
                verbose_name='COUNT(DISTINCT {})'.format(self.column_name),
                metric_type='count_distinct',
                json=json.dumps({
                    'type': 'cardinality',
                    'name': name,
                    'fieldNames': [self.column_name]})
            ))
        session = get_session()
        for metric in metrics:
            m = (
                session.query(M)
                .filter(M.metric_name == metric.metric_name)
                .filter(M.datasource_name == self.datasource_name)
                .filter(DruidCluster.cluster_name == self.datasource.cluster_name)
                .first()
            )
            metric.datasource_name = self.datasource_name
            if not m:
                session.add(metric)
                session.commit()


class FavStar(Model):
    __tablename__ = 'favstar'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('ab_user.id'))
    class_name = Column(String(50))
    obj_id = Column(Integer)
    dttm = Column(DateTime, default=func.now())
