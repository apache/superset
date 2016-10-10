"""A collection of ORM sqlalchemy models for Caravel"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import functools
import json
import logging
import re
import textwrap
from collections import namedtuple
from copy import deepcopy, copy
from datetime import timedelta, datetime, date

import humanize
import pandas as pd
import requests
import sqlalchemy as sqla
from sqlalchemy.engine.url import make_url
import sqlparse
from dateutil.parser import parse

from flask import escape, g, Markup, request
from flask_appbuilder import Model
from flask_appbuilder.models.mixins import AuditMixin
from flask_appbuilder.models.decorators import renders
from flask_babel import lazy_gettext as _

from pydruid.client import PyDruid
from pydruid.utils.filters import Dimension, Filter
from pydruid.utils.postaggregator import Postaggregator
from pydruid.utils.having import Aggregation
from six import string_types

from sqlalchemy import (
    Column, Integer, String, ForeignKey, Text, Boolean,
    DateTime, Date, Table, Numeric,
    create_engine, MetaData, desc, asc, select, and_, func
)
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.orm import backref, relationship
from sqlalchemy.sql import table, literal_column, text, column
from sqlalchemy.sql.expression import ColumnClause, TextAsFrom
from sqlalchemy_utils import EncryptedType

from werkzeug.datastructures import ImmutableMultiDict

import caravel
from caravel import app, db, get_session, utils, sm
from caravel.source_registry import SourceRegistry
from caravel.viz import viz_types
from caravel.utils import flasher, MetricPermException, DimSelector

config = app.config

QueryResult = namedtuple('namedtuple', ['df', 'query', 'duration'])
FillterPattern = re.compile(r'''((?:[^,"']|"[^"]*"|'[^']*')+)''')


class JavascriptPostAggregator(Postaggregator):
    def __init__(self, name, field_names, function):
        self.post_aggregator = {
            'type': 'javascript',
            'fieldNames': field_names,
            'name': name,
            'function': function,
        }
        self.name = name


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

    @renders('created_on')
    def creator(self):  # noqa
        return '{}'.format(self.created_by or '')

    @property
    def changed_by_(self):
        return '{}'.format(self.changed_by or '')

    @renders('changed_on')
    def changed_on_(self):
        return Markup(
            '<span class="no-wrap">{}</span>'.format(self.changed_on))

    @renders('changed_on')
    def modified(self):
        s = humanize.naturaltime(datetime.now() - self.changed_on)
        return Markup('<span class="no-wrap">{}</span>'.format(s))

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


slice_user = Table('slice_user', Model.metadata,
    Column('id', Integer, primary_key=True),
    Column('user_id', Integer, ForeignKey('ab_user.id')),
    Column('slice_id', Integer, ForeignKey('slices.id'))
)


class Slice(Model, AuditMixinNullable):

    """A slice is essentially a report or a view on data"""

    __tablename__ = 'slices'
    id = Column(Integer, primary_key=True)
    slice_name = Column(String(250))
    datasource_id = Column(Integer)
    datasource_type = Column(String(200))
    datasource_name = Column(String(2000))
    viz_type = Column(String(250))
    params = Column(Text)
    description = Column(Text)
    cache_timeout = Column(Integer)
    perm = Column(String(2000))
    owners = relationship("User", secondary=slice_user)

    def __repr__(self):
        return self.slice_name

    @property
    def cls_model(self):
        return SourceRegistry.sources[self.datasource_type]

    @property
    def datasource(self):
        return self.get_datasource

    @datasource.getter
    @utils.memoized
    def get_datasource(self):
        ds = db.session.query(
            self.cls_model).filter_by(
            id=self.datasource_id).first()
        return ds

    @renders('datasource_name')
    def datasource_link(self):
        datasource = self.datasource
        if datasource:
            return self.datasource.link

    @property
    def datasource_edit_url(self):
        self.datasource.url

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
    def data(self):
        """Data used to render slice in templates"""
        d = {}
        self.token = ''
        try:
            d = self.viz.data
            self.token = d.get('token')
        except Exception as e:
            d['error'] = str(e)
        d['slice_id'] = self.id
        d['slice_name'] = self.slice_name
        d['description'] = self.description
        d['slice_url'] = self.slice_url
        d['edit_url'] = self.edit_url
        d['description_markeddown'] = self.description_markeddown
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
        name = escape(self.slice_name)
        return Markup('<a href="{url}">{name}</a>'.format(**locals()))

    def get_viz(self, url_params_multidict=None):
        """Creates :py:class:viz.BaseViz object from the url_params_multidict.

        :param werkzeug.datastructures.MultiDict url_params_multidict:
            Contains the visualization params, they override the self.params
            stored in the database
        :return: object of the 'viz_type' type that is taken from the
            url_params_multidict or self.params.
        :rtype: :py:class:viz.BaseViz
        """
        slice_params = json.loads(self.params)  # {}
        slice_params['slice_id'] = self.id
        slice_params['json'] = "false"
        slice_params['slice_name'] = self.slice_name
        slice_params['viz_type'] = self.viz_type if self.viz_type else "table"
        if url_params_multidict:
            slice_params.update(url_params_multidict)
            to_del = [k for k in slice_params if k not in url_params_multidict]
            for k in to_del:
                del slice_params[k]

        immutable_slice_params = ImmutableMultiDict(slice_params)
        return viz_types[immutable_slice_params.get('viz_type')](
            self.datasource,
            form_data=immutable_slice_params,
            slice_=self
        )


def set_perm(mapper, connection, target):  # noqa
    src_class = target.cls_model
    id_ = target.datasource_id
    ds = db.session.query(src_class).filter_by(id=int(id_)).first()
    target.perm = ds.perm

sqla.event.listen(Slice, 'before_insert', set_perm)
sqla.event.listen(Slice, 'before_update', set_perm)


dashboard_slices = Table(
    'dashboard_slices', Model.metadata,
    Column('id', Integer, primary_key=True),
    Column('dashboard_id', Integer, ForeignKey('dashboards.id')),
    Column('slice_id', Integer, ForeignKey('slices.id')),
)

dashboard_user = Table(
    'dashboard_user', Model.metadata,
    Column('id', Integer, primary_key=True),
    Column('user_id', Integer, ForeignKey('ab_user.id')),
    Column('dashboard_id', Integer, ForeignKey('dashboards.id'))
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
    owners = relationship("User", secondary=dashboard_user)

    def __repr__(self):
        return self.dashboard_title

    @property
    def table_names(self):
        return ", ".join({"{}".format(s.datasource) for s in self.slices})

    @property
    def url(self):
        return "/caravel/dashboard/{}/".format(self.slug or self.id)

    @property
    def datasources(self):
        return {slc.datasource for slc in self.slices}

    @property
    def metadata_dejson(self):
        if self.json_metadata:
            return json.loads(self.json_metadata)
        else:
            return {}

    @property
    def sqla_metadata(self):
        metadata = MetaData(bind=self.get_sqla_engine())
        return metadata.reflect()

    def dashboard_link(self):
        title = escape(self.dashboard_title)
        return Markup(
            '<a href="{self.url}">{title}</a>'.format(**locals()))

    @property
    def json_data(self):
        d = {
            'id': self.id,
            'metadata': self.metadata_dejson,
            'dashboard_title': self.dashboard_title,
            'slug': self.slug,
            'slices': [slc.data for slc in self.slices],
            'position_json': json.loads(self.position_json) if self.position_json else [],
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

    @property
    def url(self):
        return '/{}/edit/{}'.format(self.baselink, self.id)

    @property
    def explore_url(self):
        if self.default_endpoint:
            return self.default_endpoint
        else:
            return "/caravel/explore/{obj.type}/{obj.id}/".format(obj=self)


class Database(Model, AuditMixinNullable):

    """An ORM object that stores Database related information"""

    __tablename__ = 'dbs'
    id = Column(Integer, primary_key=True)
    database_name = Column(String(250), unique=True)
    sqlalchemy_uri = Column(String(1024))
    password = Column(EncryptedType(String(1024), config.get('SECRET_KEY')))
    cache_timeout = Column(Integer)
    select_as_create_table_as = Column(Boolean, default=False)
    expose_in_sqllab = Column(Boolean, default=False)
    allow_run_sync = Column(Boolean, default=True)
    allow_run_async = Column(Boolean, default=False)
    allow_ctas = Column(Boolean, default=False)
    allow_dml = Column(Boolean, default=False)
    force_ctas_schema = Column(String(250))
    extra = Column(Text, default=textwrap.dedent("""\
    {
        "metadata_params": {},
        "engine_params": {}
    }
    """))

    def __repr__(self):
        return self.database_name

    @property
    def backend(self):
        url = make_url(self.sqlalchemy_uri_decrypted)
        return url.get_backend_name()

    def set_sqlalchemy_uri(self, uri):
        conn = sqla.engine.url.make_url(uri)
        self.password = conn.password
        conn.password = "X" * 10 if conn.password else None
        self.sqlalchemy_uri = str(conn)  # hides the password

    def get_sqla_engine(self, schema=None):
        extra = self.get_extra()
        url = make_url(self.sqlalchemy_uri_decrypted)
        params = extra.get('engine_params', {})
        if self.backend == 'presto' and schema:
            if '/' in url.database:
                url.database = url.database.split('/')[0] + '/' + schema
            else:
                url.database += '/' + schema
        elif schema:
            url.database = schema
        return create_engine(url, **params)

    def get_df(self, sql, schema):
        eng = self.get_sqla_engine(schema=schema)
        cur = eng.execute(sql, schema=schema)
        cols = [col[0] for col in cur.cursor.description]
        df = pd.DataFrame(cur.fetchall(), columns=cols)
        return df

    def compile_sqla_query(self, qry, schema=None):
        eng = self.get_sqla_engine(schema=schema)
        compiled = qry.compile(eng, compile_kwargs={"literal_binds": True})
        return '{}'.format(compiled)

    def select_star(self, table_name, schema=None, limit=1000):
        """Generates a ``select *`` statement in the proper dialect"""
        qry = select('*').select_from(text(table_name))
        if limit:
            qry = qry.limit(limit)
        return self.compile_sqla_query(qry)

    def wrap_sql_limit(self, sql, limit=1000):
        qry = (
            select('*')
            .select_from(TextAsFrom(text(sql), ['*'])
            .alias('inner_qry')).limit(limit)
        )
        return self.compile_sqla_query(qry)

    def safe_sqlalchemy_uri(self):
        return self.sqlalchemy_uri

    @property
    def inspector(self):
        engine = self.get_sqla_engine()
        return sqla.inspect(engine)

    def all_table_names(self, schema=None):
        return sorted(self.inspector.get_table_names(schema))

    def all_view_names(self, schema=None):
        views = []
        try:
            views = self.inspector.get_view_names(schema)
        except Exception as e:
            pass
        return views

    def all_schema_names(self):
        return sorted(self.inspector.get_schema_names())

    def grains(self):
        """Defines time granularity database-specific expressions.

        The idea here is to make it easy for users to change the time grain
        form a datetime (maybe the source grain is arbitrary timestamps, daily
        or 5 minutes increments) to another, "truncated" datetime. Since
        each database has slightly different but similar datetime functions,
        this allows a mapping between database engines and actual functions.
        """
        Grain = namedtuple('Grain', 'name label function')
        db_time_grains = {
            'presto': (
                Grain('Time Column', _('Time Column'), '{col}'),
                Grain('second', _('second'),
                      "date_trunc('second', CAST({col} AS TIMESTAMP))"),
                Grain('minute', _('minute'),
                      "date_trunc('minute', CAST({col} AS TIMESTAMP))"),
                Grain('hour', _('hour'),
                      "date_trunc('hour', CAST({col} AS TIMESTAMP))"),
                Grain('day', _('day'),
                      "date_trunc('day', CAST({col} AS TIMESTAMP))"),
                Grain('week', _('week'),
                      "date_trunc('week', CAST({col} AS TIMESTAMP))"),
                Grain('month', _('month'),
                      "date_trunc('month', CAST({col} AS TIMESTAMP))"),
                Grain('quarter', _('quarter'),
                      "date_trunc('quarter', CAST({col} AS TIMESTAMP))"),
                Grain("week_ending_saturday", _('week_ending_saturday'),
                      "date_add('day', 5, date_trunc('week', date_add('day', 1, "
                      "CAST({col} AS TIMESTAMP))))"),
                Grain("week_start_sunday", _('week_start_sunday'),
                      "date_add('day', -1, date_trunc('week', "
                      "date_add('day', 1, CAST({col} AS TIMESTAMP))))"),
            ),
            'mysql': (
                Grain('Time Column', _('Time Column'), '{col}'),
                Grain("second", _('second'), "DATE_ADD(DATE({col}), "
                      "INTERVAL (HOUR({col})*60*60 + MINUTE({col})*60"
                      " + SECOND({col})) SECOND)"),
                Grain("minute", _('minute'), "DATE_ADD(DATE({col}), "
                      "INTERVAL (HOUR({col})*60 + MINUTE({col})) MINUTE)"),
                Grain("hour", _('hour'), "DATE_ADD(DATE({col}), "
                      "INTERVAL HOUR({col}) HOUR)"),
                Grain('day', _('day'), 'DATE({col})'),
                Grain("week", _('week'), "DATE(DATE_SUB({col}, "
                      "INTERVAL DAYOFWEEK({col}) - 1 DAY))"),
                Grain("month", _('month'), "DATE(DATE_SUB({col}, "
                      "INTERVAL DAYOFMONTH({col}) - 1 DAY))"),
            ),
            'sqlite': (
                Grain('Time Column', _('Time Column'), '{col}'),
                Grain('day', _('day'), 'DATE({col})'),
                Grain("week", _('week'),
                      "DATE({col}, -strftime('%w', {col}) || ' days')"),
                Grain("month", _('month'),
                      "DATE({col}, -strftime('%d', {col}) || ' days')"),
            ),
            'postgresql': (
                Grain("Time Column", _('Time Column'), "{col}"),
                Grain("second", _('second'), "DATE_TRUNC('second', {col})"),
                Grain("minute", _('minute'), "DATE_TRUNC('minute', {col})"),
                Grain("hour", _('hour'), "DATE_TRUNC('hour', {col})"),
                Grain("day", _('day'), "DATE_TRUNC('day', {col})"),
                Grain("week", _('week'), "DATE_TRUNC('week', {col})"),
                Grain("month", _('month'), "DATE_TRUNC('month', {col})"),
                Grain("year", _('year'), "DATE_TRUNC('year', {col})"),
            ),
            'mssql': (
                Grain("Time Column", _('Time Column'), "{col}"),
                Grain("second", _('second'), "DATEADD(second, "
                      "DATEDIFF(second, '2000-01-01', {col}), '2000-01-01')"),
                Grain("minute", _('minute'), "DATEADD(minute, "
                      "DATEDIFF(minute, 0, {col}), 0)"),
                Grain("5 minute", _('5 minute'), "DATEADD(minute, "
                      "DATEDIFF(minute, 0, {col}) / 5 * 5, 0)"),
                Grain("half hour", _('half hour'), "DATEADD(minute, "
                      "DATEDIFF(minute, 0, {col}) / 30 * 30, 0)"),
                Grain("hour", _('hour'), "DATEADD(hour, "
                      "DATEDIFF(hour, 0, {col}), 0)"),
                Grain("day", _('day'), "DATEADD(day, "
                      "DATEDIFF(day, 0, {col}), 0)"),
                Grain("week", _('week'), "DATEADD(week, "
                      "DATEDIFF(week, 0, {col}), 0)"),
                Grain("month", _('month'), "DATEADD(month, "
                      "DATEDIFF(month, 0, {col}), 0)"),
                Grain("quarter", _('quarter'), "DATEADD(quarter, "
                      "DATEDIFF(quarter, 0, {col}), 0)"),
                Grain("year", _('year'), "DATEADD(year, "
                      "DATEDIFF(year, 0, {col}), 0)"),
            ),
        }
        db_time_grains['redshift'] = db_time_grains['postgresql']
        db_time_grains['vertica'] = db_time_grains['postgresql']
        for db_type, grains in db_time_grains.items():
            if self.sqlalchemy_uri.startswith(db_type):
                return grains

    def grains_dict(self):
        return {grain.name: grain for grain in self.grains()}

    def epoch_to_dttm(self, ms=False):
        """Database-specific SQL to convert unix timestamp to datetime
        """
        ts2date_exprs = {
            'sqlite': "datetime({col}, 'unixepoch')",
            'postgresql': "(timestamp 'epoch' + {col} * interval '1 second')",
            'mysql': "from_unixtime({col})",
            'mssql': "dateadd(S, {col}, '1970-01-01')"
        }
        ts2date_exprs['redshift'] = ts2date_exprs['postgresql']
        ts2date_exprs['vertica'] = ts2date_exprs['postgresql']
        for db_type, expr in ts2date_exprs.items():
            if self.sqlalchemy_uri.startswith(db_type):
                return expr.replace('{col}', '({col}/1000.0)') if ms else expr
        raise Exception(_("Unable to convert unix epoch to datetime"))

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

    def get_columns(self, table_name, schema=None):
        return self.inspector.get_columns(table_name, schema)

    def get_indexes(self, table_name, schema=None):
        return self.inspector.get_indexes(table_name, schema)

    @property
    def sqlalchemy_uri_decrypted(self):
        conn = sqla.engine.url.make_url(self.sqlalchemy_uri)
        conn.password = self.password
        return str(conn)

    @property
    def sql_url(self):
        return '/caravel/sql/{}/'.format(self.id)

    @property
    def perm(self):
        return (
            "[{obj.database_name}].(id:{obj.id})").format(obj=self)


class SqlaTable(Model, Queryable, AuditMixinNullable):

    """An ORM object for SqlAlchemy table references"""

    type = "table"

    __tablename__ = 'tables'
    id = Column(Integer, primary_key=True)
    table_name = Column(String(250))
    main_dttm_col = Column(String(250))
    description = Column(Text)
    default_endpoint = Column(Text)
    database_id = Column(Integer, ForeignKey('dbs.id'), nullable=False)
    is_featured = Column(Boolean, default=False)
    user_id = Column(Integer, ForeignKey('ab_user.id'))
    owner = relationship('User', backref='tables', foreign_keys=[user_id])
    database = relationship(
        'Database',
        backref=backref('tables', cascade='all, delete-orphan'),
        foreign_keys=[database_id])
    offset = Column(Integer, default=0)
    cache_timeout = Column(Integer)
    schema = Column(String(255))
    sql = Column(Text)
    table_columns = relationship("TableColumn", back_populates="table")

    baselink = "tablemodelview"

    __table_args__ = (
        sqla.UniqueConstraint(
            'database_id', 'schema', 'table_name',
            name='_customer_location_uc'),)

    def __repr__(self):
        return self.table_name

    @property
    def description_markeddown(self):
        return utils.markdown(self.description)

    @property
    def link(self):
        table_name = escape(self.table_name)
        return Markup(
            '<a href="{self.explore_url}">{table_name}</a>'.format(**locals()))

    @property
    def perm(self):
        return (
            "[{obj.database}].[{obj.table_name}]"
            "(id:{obj.id})").format(obj=self)

    @property
    def name(self):
        return self.table_name

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
    def num_cols(self):
        return [c.column_name for c in self.columns if c.isnum]

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
    def time_column_grains(self):
        return {
            "time_columns": self.dttm_cols,
            "time_grains": [grain.name for grain in self.database.grains()]
        }

    def get_col(self, col_name):
        columns = self.table_columns
        for col in columns:
            if col_name == col.column_name:
                return col

    def query(  # sqla
            self, groupby, metrics,
            granularity,
            from_dttm, to_dttm,
            filter=None,  # noqa
            is_timeseries=True,
            timeseries_limit=15, row_limit=None,
            inner_from_dttm=None, inner_to_dttm=None,
            orderby=None,
            extras=None,
            columns=None):
        """Querying any sqla table from this common interface"""
        # For backward compatibility
        if granularity not in self.dttm_cols:
            granularity = self.main_dttm_col

        cols = {col.column_name: col for col in self.columns}
        metrics_dict = {m.metric_name: m for m in self.metrics}
        qry_start_dttm = datetime.now()

        if not granularity and is_timeseries:
            raise Exception(_(
                "Datetime column not provided as part table configuration "
                "and is required by this type of chart"))

        metrics_exprs = [metrics_dict.get(m).sqla_col for m in metrics]

        if metrics:
            main_metric_expr = metrics_exprs[0]
        else:
            main_metric_expr = literal_column("COUNT(*)").label("ccount")

        select_exprs = []
        groupby_exprs = []

        if groupby:
            select_exprs = []
            inner_select_exprs = []
            inner_groupby_exprs = []
            for s in groupby:
                col = cols[s]
                outer = col.sqla_col
                inner = col.sqla_col.label(col.column_name + '__')

                groupby_exprs.append(outer)
                select_exprs.append(outer)
                inner_groupby_exprs.append(inner)
                inner_select_exprs.append(inner)
        elif columns:
            for s in columns:
                select_exprs.append(cols[s].sqla_col)
            metrics_exprs = []

        if granularity:

            # TODO: sqlalchemy 1.2 release should be doing this on its own.
            # Patch only if the column clause is specific for DateTime set and
            # granularity is selected.
            @compiles(ColumnClause)
            def visit_column(element, compiler, **kw):
                text = compiler.visit_column(element, **kw)
                try:
                    if element.is_literal and hasattr(element.type, 'python_type') and \
                            type(element.type) is DateTime:

                        text = text.replace('%%', '%')
                except NotImplementedError:
                    pass  # Some elements raise NotImplementedError for python_type
                return text

            dttm_col = cols[granularity]
            dttm_expr = dttm_col.sqla_col.label('timestamp')
            timestamp = dttm_expr

            # Transforming time grain into an expression based on configuration
            time_grain_sqla = extras.get('time_grain_sqla')
            if time_grain_sqla:
                if dttm_col.python_date_format == 'epoch_s':
                    dttm_expr = self.database.epoch_to_dttm().format(
                        col=dttm_expr)
                elif dttm_col.python_date_format == 'epoch_ms':
                    dttm_expr = self.database.epoch_to_dttm(ms=True).format(
                        col=dttm_expr)
                udf = self.database.grains_dict().get(time_grain_sqla, '{col}')
                timestamp_grain = literal_column(
                    udf.function.format(col=dttm_expr), type_=DateTime).label('timestamp')
            else:
                timestamp_grain = timestamp

            if is_timeseries:
                select_exprs += [timestamp_grain]
                groupby_exprs += [timestamp_grain]

            outer_from = text(dttm_col.dttm_sql_literal(from_dttm))
            outer_to = text(dttm_col.dttm_sql_literal(to_dttm))

            time_filter = [
                timestamp >= outer_from,
                timestamp <= outer_to,
            ]
            inner_time_filter = copy(time_filter)
            if inner_from_dttm:
                inner_time_filter[0] = timestamp >= text(
                    dttm_col.dttm_sql_literal(inner_from_dttm))
            if inner_to_dttm:
                inner_time_filter[1] = timestamp <= text(
                    dttm_col.dttm_sql_literal(inner_to_dttm))
        else:
            inner_time_filter = []

        select_exprs += metrics_exprs
        qry = select(select_exprs)

        tbl = table(self.table_name)
        if self.schema:
            tbl.schema = self.schema

        # Supporting arbitrary SQL statements in place of tables
        if self.sql:
            tbl = text('(' + self.sql + ') as expr_qry ')

        if not columns:
            qry = qry.group_by(*groupby_exprs)

        where_clause_and = []
        having_clause_and = []
        for col, op, eq in filter:
            col_obj = cols[col]
            if op in ('in', 'not in'):
                splitted = FillterPattern.split(eq)[1::2]
                values = [types.replace("'", '').strip() for types in splitted]
                cond = col_obj.sqla_col.in_(values)
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
        elif orderby:
            for col, ascending in orderby:
                direction = asc if ascending else desc
                qry = qry.order_by(direction(col))

        qry = qry.limit(row_limit)

        if timeseries_limit and groupby:
            # some sql dialects require for order by expressions
            # to also be in the select clause
            inner_select_exprs += [main_metric_expr]
            subq = select(inner_select_exprs)
            subq = subq.select_from(tbl)
            subq = subq.where(and_(*(where_clause_and + inner_time_filter)))
            subq = subq.group_by(*inner_groupby_exprs)
            subq = subq.order_by(desc(main_metric_expr))
            subq = subq.limit(timeseries_limit)
            on_clause = []
            for i, gb in enumerate(groupby):
                on_clause.append(
                    groupby_exprs[i] == column(gb + '__'))

            tbl = tbl.join(subq.alias(), and_(*on_clause))

        qry = qry.select_from(tbl)

        engine = self.database.get_sqla_engine()
        sql = "{}".format(
            qry.compile(
                engine, compile_kwargs={"literal_binds": True},),
        )
        df = pd.read_sql_query(
            sql=sql,
            con=engine
        )
        sql = sqlparse.format(sql, reindent=True)
        return QueryResult(
            df=df, duration=datetime.now() - qry_start_dttm, query=sql)

    def get_sqla_table_object(self):
        return self.database.get_table(self.table_name, schema=self.schema)

    def fetch_metadata(self):
        """Fetches the metadata for the table and merges it in"""
        try:
            table = self.get_sqla_table_object()
        except Exception:
            raise Exception(
                "Table doesn't seem to exist in the specified database, "
                "couldn't fetch column information")

        TC = TableColumn  # noqa shortcut to class
        M = SqlMetric  # noqa
        metrics = []
        any_date_col = None
        for col in table.columns:
            try:
                datatype = "{}".format(col.type).upper()
            except Exception as e:
                datatype = "UNKNOWN"
                logging.error(
                    "Unrecognized data type in {}.{}".format(table, col.name))
                logging.exception(e)
            dbcol = (
                db.session
                .query(TC)
                .filter(TC.table == self)
                .filter(TC.column_name == col.name)
                .first()
            )
            db.session.flush()
            if not dbcol:
                dbcol = TableColumn(column_name=col.name, type=datatype)
                dbcol.groupby = dbcol.is_string
                dbcol.filterable = dbcol.is_string
                dbcol.sum = dbcol.isnum
                dbcol.is_dttm = dbcol.is_time

            db.session.merge(self)
            self.columns.append(dbcol)

            if not any_date_col and dbcol.is_time:
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
        'SqlaTable',
        backref=backref('metrics', cascade='all, delete-orphan'),
        foreign_keys=[table_id])
    expression = Column(Text)
    description = Column(Text)
    is_restricted = Column(Boolean, default=False, nullable=True)
    d3format = Column(String(128))

    @property
    def sqla_col(self):
        name = self.metric_name
        return literal_column(self.expression).label(name)

    @property
    def perm(self):
        return (
            "{parent_name}.[{obj.metric_name}](id:{obj.id})"
        ).format(obj=self,
                 parent_name=self.table.full_name) if self.table else None


class TableColumn(Model, AuditMixinNullable):

    """ORM object for table columns, each table can have multiple columns"""

    __tablename__ = 'table_columns'
    id = Column(Integer, primary_key=True)
    table_id = Column(Integer, ForeignKey('tables.id'))
    table = relationship(
        'SqlaTable',
        backref=backref('columns', cascade='all, delete-orphan'),
        foreign_keys=[table_id])
    column_name = Column(String(255))
    verbose_name = Column(String(1024))
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
    python_date_format = Column(String(255))
    database_expression = Column(String(255))

    num_types = ('DOUBLE', 'FLOAT', 'INT', 'BIGINT', 'LONG')
    date_types = ('DATE', 'TIME')
    str_types = ('VARCHAR', 'STRING', 'CHAR')

    def __repr__(self):
        return self.column_name

    @property
    def isnum(self):
        return any([t in self.type.upper() for t in self.num_types])

    @property
    def is_time(self):
        return any([t in self.type.upper() for t in self.date_types])

    @property
    def is_string(self):
        return any([t in self.type.upper() for t in self.str_types])

    @property
    def sqla_col(self):
        name = self.column_name
        if not self.expression:
            col = column(self.column_name).label(name)
        else:
            col = literal_column(self.expression).label(name)
        return col

    def dttm_sql_literal(self, dttm):
        """Convert datetime object to string

        If database_expression is empty, the internal dttm
        will be parsed as the string with the pattern that
        the user inputted (python_date_format)
        If database_expression is not empty, the internal dttm
        will be parsed as the sql sentence for the database to convert
        """
        tf = self.python_date_format or '%Y-%m-%d %H:%M:%S.%f'
        if self.database_expression:
            return self.database_expression.format(dttm.strftime('%Y-%m-%d %H:%M:%S'))
        elif tf == 'epoch_s':
            return str((dttm - datetime(1970, 1, 1)).total_seconds())
        elif tf == 'epoch_ms':
            return str((dttm - datetime(1970, 1, 1)).total_seconds() * 1000.0)
        else:
            default = "'{}'".format(dttm.strftime(tf))
            iso = dttm.isoformat()
            d = {
                'mssql': "CONVERT(DATETIME, '{}', 126)".format(iso),  # untested
                'mysql': default,
                'oracle':
                    """TO_TIMESTAMP('{}', 'YYYY-MM-DD"T"HH24:MI:SS.ff6')""".format(
                        dttm.isoformat()),
                'presto': default,
                'sqlite': default,
            }
            for k, v in d.items():
                if self.table.database.sqlalchemy_uri.startswith(k):
                    return v
            return default


class DruidCluster(Model, AuditMixinNullable):

    """ORM object referencing the Druid clusters"""

    __tablename__ = 'clusters'
    id = Column(Integer, primary_key=True)
    cluster_name = Column(String(250), unique=True)
    coordinator_host = Column(String(255))
    coordinator_port = Column(Integer)
    coordinator_endpoint = Column(
        String(255), default='druid/coordinator/v1/metadata')
    broker_host = Column(String(255))
    broker_port = Column(Integer)
    broker_endpoint = Column(String(255), default='druid/v2')
    metadata_last_refreshed = Column(DateTime)
    cache_timeout = Column(Integer)

    def __repr__(self):
        return self.cluster_name

    def get_pydruid_client(self):
        cli = PyDruid(
            "http://{0}:{1}/".format(self.broker_host, self.broker_port),
            self.broker_endpoint)
        return cli

    def get_datasources(self):
        endpoint = (
            "http://{obj.coordinator_host}:{obj.coordinator_port}/"
            "{obj.coordinator_endpoint}/datasources"
        ).format(obj=self)

        return json.loads(requests.get(endpoint).text)

    def get_druid_version(self):
        endpoint = (
            "http://{obj.coordinator_host}:{obj.coordinator_port}/status"
        ).format(obj=self)
        return json.loads(requests.get(endpoint).text)['version']

    def refresh_datasources(self):
        self.druid_version = self.get_druid_version()
        for datasource in self.get_datasources():
            if datasource not in config.get('DRUID_DATA_SOURCE_BLACKLIST'):
                DruidDatasource.sync_to_db(datasource, self)

    @property
    def perm(self):
        return "[{obj.cluster_name}].(id:{obj.id})".format(obj=self)


class DruidDatasource(Model, AuditMixinNullable, Queryable):

    """ORM object referencing Druid datasources (tables)"""

    type = "druid"

    baselink = "druiddatasourcemodelview"

    __tablename__ = 'datasources'
    id = Column(Integer, primary_key=True)
    datasource_name = Column(String(255), unique=True)
    is_featured = Column(Boolean, default=False)
    is_hidden = Column(Boolean, default=False)
    description = Column(Text)
    default_endpoint = Column(Text)
    user_id = Column(Integer, ForeignKey('ab_user.id'))
    owner = relationship(
        'User',
        backref=backref('datasources', cascade='all, delete-orphan'),
        foreign_keys=[user_id])
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
    def database(self):
        return self.cluster

    @property
    def num_cols(self):
        return [c.column_name for c in self.columns if c.isnum]

    @property
    def name(self):
        return self.datasource_name

    @property
    def perm(self):
        return (
            "[{obj.cluster_name}].[{obj.datasource_name}]"
            "(id:{obj.id})").format(obj=self)

    @property
    def link(self):
        name = escape(self.datasource_name)
        return Markup('<a href="{self.url}">{name}</a>').format(**locals())

    @property
    def full_name(self):
        return (
            "[{obj.cluster_name}]."
            "[{obj.datasource_name}]").format(obj=self)

    @property
    def time_column_grains(self):
        return {
            "time_columns": [
                'all', '5 seconds', '30 seconds', '1 minute',
                '5 minutes', '1 hour', '6 hour', '1 day', '7 days'
            ],
            "time_grains": ['now']
        }

    def __repr__(self):
        return self.datasource_name

    @renders('datasource_name')
    def datasource_link(self):
        url = "/caravel/explore/{obj.type}/{obj.id}/".format(obj=self)
        name = escape(self.datasource_name)
        return Markup('<a href="{url}">{name}</a>'.format(**locals()))

    def get_metric_obj(self, metric_name):
        return [
            m.json_obj for m in self.metrics
            if m.metric_name == metric_name
        ][0]

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
        return v1nums[0] > v2nums[0] or \
            (v1nums[0] == v2nums[0] and v1nums[1] > v2nums[1]) or \
            (v1nums[0] == v2nums[0] and v1nums[1] == v2nums[1] and v1nums[2] > v2nums[2])

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
        start = (0 if self.version_higher(self.cluster.druid_version, '0.8.2') else 1)
        intervals = (max_time - timedelta(days=7)).isoformat() + '/'
        intervals += (max_time - timedelta(days=start)).isoformat()
        segment_metadata = client.segment_metadata(
            datasource=self.datasource_name,
            intervals=intervals)
        if segment_metadata:
            return segment_metadata[-1]['columns']

    def generate_metrics(self):
        for col in self.columns:
            col.generate_metrics()

    @classmethod
    def sync_to_db_from_config(cls, druid_config, user, cluster):
        """Merges the ds config from druid_config into one stored in the db."""
        session = db.session()
        datasource = (
            session.query(DruidDatasource)
            .filter_by(
                datasource_name=druid_config['name'])
        ).first()
        # Create a new datasource.
        if not datasource:
            datasource = DruidDatasource(
                datasource_name=druid_config['name'],
                cluster=cluster,
                owner=user,
                changed_by_fk=user.id,
                created_by_fk=user.id,
            )
            session.add(datasource)

        dimensions = druid_config['dimensions']
        for dim in dimensions:
            col_obj = (
                session.query(DruidColumn)
                .filter_by(
                    datasource_name=druid_config['name'],
                    column_name=dim)
            ).first()
            if not col_obj:
                col_obj = DruidColumn(
                    datasource_name=druid_config['name'],
                    column_name=dim,
                    groupby=True,
                    filterable=True,
                    # TODO: fetch type from Hive.
                    type="STRING",
                    datasource=datasource
                )
                session.add(col_obj)
        # Import Druid metrics
        for metric_spec in druid_config["metrics_spec"]:
            metric_name = metric_spec["name"]
            metric_type = metric_spec["type"]
            metric_json = json.dumps(metric_spec)

            if metric_type == "count":
                metric_type = "longSum"
                metric_json = json.dumps({
                    "type": "longSum",
                    "name": metric_name,
                    "fieldName": metric_name,
                })

            metric_obj = (
                session.query(DruidMetric)
                .filter_by(
                    datasource_name=druid_config['name'],
                    metric_name=metric_name)
            ).first()
            if not metric_obj:
                metric_obj = DruidMetric(
                    metric_name=metric_name,
                    metric_type=metric_type,
                    verbose_name="%s(%s)" % (metric_type, metric_name),
                    datasource=datasource,
                    json=metric_json,
                    description=(
                        "Imported from the airolap config dir for %s" %
                        druid_config['name']),
                )
                session.add(metric_obj)
        session.commit()

    @classmethod
    def sync_to_db(cls, name, cluster):
        """Fetches metadata for that datasource and merges the Caravel db"""
        logging.info("Syncing Druid datasource [{}]".format(name))
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
            if datatype == "hyperUnique" or datatype == "thetaSketch":
                col_obj.count_distinct = True
            if col_obj:
                col_obj.type = cols[col]['type']
            session.flush()
            col_obj.datasource = datasource
            col_obj.generate_metrics()
            session.flush()

    def query(  # druid
            self, groupby, metrics,
            granularity,
            from_dttm, to_dttm,
            filter=None,  # noqa
            is_timeseries=True,
            timeseries_limit=None,
            row_limit=None,
            inner_from_dttm=None, inner_to_dttm=None,
            orderby=None,
            extras=None,  # noqa
            select=None,  # noqa
            columns=None, ):
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
        metrics_dict = {m.metric_name: m for m in self.metrics}
        all_metrics = []
        post_aggs = {}

        def recursive_get_fields(_conf):
            _fields = _conf.get('fields', [])
            field_names = []
            for _f in _fields:
                _type = _f.get('type')
                if _type in ['fieldAccess', 'hyperUniqueCardinality']:
                    field_names.append(_f.get('fieldName'))
                elif _type == 'arithmetic':
                    field_names += recursive_get_fields(_f)

            return list(set(field_names))

        for metric_name in metrics:
            metric = metrics_dict[metric_name]
            if metric.metric_type != 'postagg':
                all_metrics.append(metric_name)
            else:
                conf = metric.json_obj
                all_metrics += recursive_get_fields(conf)
                all_metrics += conf.get('fieldNames', [])
                if conf.get('type') == 'javascript':
                    post_aggs[metric_name] = JavascriptPostAggregator(
                        name=conf.get('name'),
                        field_names=conf.get('fieldNames'),
                        function=conf.get('function'))
                else:
                    post_aggs[metric_name] = Postaggregator(
                        conf.get('fn', "/"),
                        conf.get('fields', []),
                        conf.get('name', ''))

        aggregations = {
            m.metric_name: m.json_obj
            for m in self.metrics
            if m.metric_name in all_metrics
        }

        rejected_metrics = [
            m.metric_name for m in self.metrics
            if m.is_restricted and
            m.metric_name in aggregations.keys() and
            not sm.has_access('metric_access', m.perm)
        ]

        if rejected_metrics:
            raise MetricPermException(
                "Access to the metrics denied: " + ', '.join(rejected_metrics)
            )

        granularity = granularity or "all"
        if granularity != "all":
            granularity = utils.parse_human_timedelta(
                granularity).total_seconds() * 1000
        if not isinstance(granularity, string_types):
            granularity = {"type": "duration", "duration": granularity}
            origin = extras.get('druid_time_origin')
            if origin:
                dttm = utils.parse_human_datetime(origin)
                granularity['origin'] = dttm.isoformat()

        qry = dict(
            datasource=self.datasource_name,
            dimensions=groupby,
            aggregations=aggregations,
            granularity=granularity,
            post_aggregations=post_aggs,
            intervals=from_dttm.isoformat() + '/' + to_dttm.isoformat(),
        )

        filters = self.get_filters(filter)
        if filters:
            qry['filter'] = filters

        having_filters = self.get_having_filters(extras.get('having_druid'))
        if having_filters:
            qry['having'] = having_filters

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
            query_str += json.dumps(
                client.query_builder.last_query.query_dict, indent=2) + "\n"
            query_str += "//\nPhase 2 (built based on phase one's results)\n"
            df = client.export_pandas()
            if df is not None and not df.empty:
                dims = qry['dimensions']
                filters = []
                for unused, row in df.iterrows():
                    fields = []
                    for dim in dims:
                        f = Dimension(dim) == row[dim]
                        fields.append(f)
                    if len(fields) > 1:
                        filt = Filter(type="and", fields=fields)
                        filters.append(filt)
                    elif fields:
                        filters.append(fields[0])

                if filters:
                    ff = Filter(type="or", fields=filters)
                    if not orig_filters:
                        qry['filter'] = ff
                    else:
                        qry['filter'] = Filter(type="and", fields=[
                            ff,
                            orig_filters])
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
        query_str += json.dumps(
            client.query_builder.last_query.query_dict, indent=2)
        df = client.export_pandas()
        if df is None or df.size == 0:
            raise Exception(_("No data was returned."))

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
        df = df[cols]
        return QueryResult(
            df=df,
            query=query_str,
            duration=datetime.now() - qry_start_dttm)

    @staticmethod
    def get_filters(raw_filters):
        filters = None
        for col, op, eq in raw_filters:
            cond = None
            if op == '==':
                cond = Dimension(col) == eq
            elif op == '!=':
                cond = ~(Dimension(col) == eq)
            elif op in ('in', 'not in'):
                fields = []
                # Distinguish quoted values with regular value types
                splitted = FillterPattern.split(eq)[1::2]
                values = [types.replace("'", '') for types in splitted]
                if len(values) > 1:
                    for s in values:
                        s = s.strip()
                        fields.append(Dimension(col) == s)
                    cond = Filter(type="or", fields=fields)
                else:
                    cond = Dimension(col) == eq
                if op == 'not in':
                    cond = ~cond
            elif op == 'regex':
                cond = Filter(type="regex", pattern=eq, dimension=col)
            if filters:
                filters = Filter(type="and", fields=[
                    cond,
                    filters
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
            '<=': '>'
        }

        for col, op, eq in raw_filters:
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


class Log(Model):

    """ORM object used to log Caravel actions to the database"""

    __tablename__ = 'logs'

    id = Column(Integer, primary_key=True)
    action = Column(String(512))
    user_id = Column(Integer, ForeignKey('ab_user.id'))
    dashboard_id = Column(Integer)
    slice_id = Column(Integer)
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
                user_id = g.user.get_id()
            d = request.args.to_dict()
            d.update(kwargs)
            slice_id = d.get('slice_id', 0)
            try:
                slice_id = int(slice_id) if slice_id else 0
            except ValueError:
                slice_id = 0
            params = ""
            try:
                params = json.dumps(d)
            except:
                pass
            log = cls(
                action=f.__name__,
                json=params,
                dashboard_id=d.get('dashboard_id') or None,
                slice_id=slice_id,
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
        String(255),
        ForeignKey('datasources.datasource_name'))
    # Setting enable_typechecks=False disables polymorphic inheritance.
    datasource = relationship(
        'DruidDatasource',
        backref=backref('metrics', cascade='all, delete-orphan'),
        enable_typechecks=False)
    json = Column(Text)
    description = Column(Text)
    is_restricted = Column(Boolean, default=False, nullable=True)
    d3format = Column(String(128))

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


class DruidColumn(Model, AuditMixinNullable):

    """ORM model for storing Druid datasource column metadata"""

    __tablename__ = 'columns'
    id = Column(Integer, primary_key=True)
    datasource_name = Column(
        String(255),
        ForeignKey('datasources.datasource_name'))
    # Setting enable_typechecks=False disables polymorphic inheritance.
    datasource = relationship(
        'DruidDatasource',
        backref=backref('columns', cascade='all, delete-orphan'),
        enable_typechecks=False)
    column_name = Column(String(255))
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
        return self.type in ('LONG', 'DOUBLE', 'FLOAT', 'INT')

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
            name = 'count_distinct__' + self.column_name
            if self.type == 'hyperUnique' or self.type == 'thetaSketch':
                metrics.append(DruidMetric(
                    metric_name=name,
                    verbose_name='COUNT(DISTINCT {})'.format(self.column_name),
                    metric_type=self.type,
                    json=json.dumps({
                        'type': self.type,
                        'name': name,
                        'fieldName': self.column_name
                    })
                ))
            else:
                mt = 'count_distinct'
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
        new_metrics = []
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
                new_metrics.append(metric)
                session.add(metric)
                session.flush()

        utils.init_metrics_perm(caravel, new_metrics)


class FavStar(Model):
    __tablename__ = 'favstar'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('ab_user.id'))
    class_name = Column(String(50))
    obj_id = Column(Integer)
    dttm = Column(DateTime, default=func.now())


class QueryStatus:
    CANCELLED = 'cancelled'
    FAILED = 'failed'
    PENDING = 'pending'
    RUNNING = 'running'
    SCHEDULED = 'scheduled'
    SUCCESS = 'success'
    TIMED_OUT = 'timed_out'


class Query(Model):

    """ORM model for SQL query"""

    __tablename__ = 'query'
    id = Column(Integer, primary_key=True)
    client_id = Column(String(11), unique=True, nullable=False)

    database_id = Column(Integer, ForeignKey('dbs.id'), nullable=False)

    # Store the tmp table into the DB only if the user asks for it.
    tmp_table_name = Column(String(256))
    user_id = Column(
        Integer, ForeignKey('ab_user.id'), nullable=True)
    status = Column(String(16), default=QueryStatus.PENDING)
    tab_name = Column(String(256))
    sql_editor_id = Column(String(256))
    schema = Column(String(256))
    sql = Column(Text)
    # Query to retrieve the results,
    # used only in case of select_as_cta_used is true.
    select_sql = Column(Text)
    executed_sql = Column(Text)
    # Could be configured in the caravel config.
    limit = Column(Integer)
    limit_used = Column(Boolean, default=False)
    limit_reached = Column(Boolean, default=False)
    select_as_cta = Column(Boolean)
    select_as_cta_used = Column(Boolean, default=False)

    progress = Column(Integer, default=0)  # 1..100
    # # of rows in the result set or rows modified.
    rows = Column(Integer)
    error_message = Column(Text)

    # Using Numeric in place of DateTime for sub-second precision
    # stored as seconds since epoch, allowing for milliseconds
    start_time = Column(Numeric(precision=3))
    end_time = Column(Numeric(precision=3))
    changed_on = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)

    database = relationship(
        'Database', foreign_keys=[database_id], backref='queries')
    user = relationship(
        'User',
        backref=backref('queries', cascade='all, delete-orphan'),
        foreign_keys=[user_id])

    __table_args__ = (
        sqla.Index('ti_user_id_changed_on', user_id, changed_on),
    )

    @property
    def limit_reached(self):
        return self.rows == self.limit if self.limit_used else False

    def to_dict(self):
        return {
            'changedOn': self.changed_on,
            'changed_on': self.changed_on.isoformat(),
            'dbId': self.database_id,
            'db': self.database.database_name,
            'endDttm': self.end_time,
            'errorMessage': self.error_message,
            'executedSql': self.executed_sql,
            'id': self.client_id,
            'limit': self.limit,
            'progress': self.progress,
            'rows': self.rows,
            'schema': self.schema,
            'ctas': self.select_as_cta,
            'serverId': self.id,
            'sql': self.sql,
            'sqlEditorId': self.sql_editor_id,
            'startDttm': self.start_time,
            'state': self.status.lower(),
            'tab': self.tab_name,
            'tempTable': self.tmp_table_name,
            'userId': self.user_id,
            'user': self.user.username,
            'limit_reached': self.limit_reached,
        }

    @property
    def name(self):
        ts = datetime.now().isoformat()
        ts = ts.replace('-', '').replace(':', '').split('.')[0]
        tab = self.tab_name.replace(' ', '_').lower() if self.tab_name else 'notab'
        tab = re.sub(r'\W+', '', tab)
        return "sqllab_{tab}_{ts}".format(**locals())


class DatasourceAccessRequest(Model, AuditMixinNullable):
    """ORM model for the access requests for datasources and dbs."""
    __tablename__ = 'access_request'
    id = Column(Integer, primary_key=True)

    datasource_id = Column(Integer)
    datasource_type = Column(String(200))

    ROLES_BLACKLIST = set(['Admin', 'Alpha', 'Gamma', 'Public'])

    @property
    def cls_model(self):
        return SourceRegistry.sources[self.datasource_type]

    @property
    def username(self):
        return self.creator()

    @property
    def datasource(self):
        return self.get_datasource

    @datasource.getter
    @utils.memoized
    def get_datasource(self):
        ds = db.session.query(self.cls_model).filter_by(
            id=self.datasource_id).first()
        return ds

    @property
    def datasource_link(self):
        return self.datasource.link

    @property
    def roles_with_datasource(self):
        action_list = ''
        pv = sm.find_permission_view_menu(
            'datasource_access', self.datasource.perm)
        for r in pv.role:
            if r.name in self.ROLES_BLACKLIST:
                continue
            url = (
                '/caravel/approve?datasource_type={self.datasource_type}&'
                'datasource_id={self.datasource_id}&'
                'created_by={self.created_by.username}&role_to_grant={r.name}'
                .format(**locals())
            )
            href = '<a href="{}">Grant {} Role</a>'.format(url, r.name)
            action_list = action_list + '<li>' + href + '</li>'
        return '<ul>' + action_list + '</ul>'

    @property
    def user_roles(self):
        action_list = ''
        for r in self.created_by.roles:
            url = (
                '/caravel/approve?datasource_type={self.datasource_type}&'
                'datasource_id={self.datasource_id}&'
                'created_by={self.created_by.username}&role_to_extend={r.name}'
                .format(**locals())
            )
            href = '<a href="{}">Extend {} Role</a>'.format(url, r.name)
            if r.name in self.ROLES_BLACKLIST:
                href = "{} Role".format(r.name)
            action_list = action_list + '<li>' + href + '</li>'
        return '<ul>' + action_list + '</ul>'
