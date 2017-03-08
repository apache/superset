"""A collection of ORM sqlalchemy models for Superset"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from collections import OrderedDict
import functools
import json
import logging
import numpy
import pickle
import re
import textwrap
from future.standard_library import install_aliases
install_aliases()
from urllib import parse
from copy import deepcopy, copy
from datetime import timedelta, datetime, date

import humanize
import pandas as pd
import requests
import sqlalchemy as sqla
from sqlalchemy.engine.url import make_url
from sqlalchemy.orm import subqueryload

import sqlparse
from dateutil.parser import parse as dparse

from flask import escape, g, Markup, request
from flask_appbuilder import Model
from flask_appbuilder.models.mixins import AuditMixin
from flask_appbuilder.models.decorators import renders
from flask_babel import lazy_gettext as _

from pydruid.client import PyDruid
from pydruid.utils.aggregators import count
from pydruid.utils.filters import Dimension, Filter
from pydruid.utils.postaggregator import (
    Postaggregator, Quantile, Quantiles, Field, Const, HyperUniqueCardinality,
)
from pydruid.utils.having import Aggregation
from six import string_types

from sqlalchemy import (
    Column, Integer, String, ForeignKey, Text, Boolean,
    DateTime, Date, Table, Numeric,
    create_engine, MetaData, desc, asc, select, and_
)
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.orm import backref, relationship
from sqlalchemy.orm.session import make_transient
from sqlalchemy.sql import table, literal_column, text, column
from sqlalchemy.sql.expression import ColumnClause, TextAsFrom
from sqlalchemy_utils import EncryptedType

from superset import (
    app, db, db_engine_specs, get_session, utils, sm, import_util,
)
from superset.legacy import cast_form_data
from superset.source_registry import SourceRegistry
from superset.viz import viz_types
from superset.jinja_context import get_template_processor
from superset.utils import (
    flasher, MetricPermException, DimSelector, wrap_clause_in_parens,
    DTTM_ALIAS, QueryStatus,
)

config = app.config


class QueryResult(object):

    """Object returned by the query interface"""

    def __init__(  # noqa
            self,
            df,
            query,
            duration,
            status=QueryStatus.SUCCESS,
            error_message=None):
        self.df = df
        self.query = query
        self.duration = duration
        self.status = status
        self.error_message = error_message


def set_perm(mapper, connection, target):  # noqa
    if target.perm != target.get_perm():
        link_table = target.__table__
        connection.execute(
            link_table.update()
            .where(link_table.c.id == target.id)
            .values(perm=target.get_perm())
        )


def set_related_perm(mapper, connection, target):  # noqa
    src_class = target.cls_model
    id_ = target.datasource_id
    ds = db.session.query(src_class).filter_by(id=int(id_)).first()
    target.perm = ds.perm


class JavascriptPostAggregator(Postaggregator):
    def __init__(self, name, field_names, function):
        self.post_aggregator = {
            'type': 'javascript',
            'fieldNames': field_names,
            'name': name,
            'function': function,
        }
        self.name = name


class ImportMixin(object):
    def override(self, obj):
        """Overrides the plain fields of the dashboard."""
        for field in obj.__class__.export_fields:
            setattr(self, field, getattr(obj, field))

    def copy(self):
        """Creates a copy of the dashboard without relationships."""
        new_obj = self.__class__()
        new_obj.override(self)
        return new_obj

    def alter_params(self, **kwargs):
        d = self.params_dict
        d.update(kwargs)
        self.params = json.dumps(d)

    @property
    def params_dict(self):
        if self.params:
            params = re.sub(",[ \t\r\n]+}", "}", self.params)
            params = re.sub(",[ \t\r\n]+\]", "]", params)
            return json.loads(params)
        else:
            return {}


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

    def _user_link(self, user):
        if not user:
            return ''
        url = '/superset/profile/{}/'.format(user.username)
        return Markup('<a href="{}">{}</a>'.format(url, escape(user) or ''))

    @renders('created_by')
    def creator(self):  # noqa
        return self._user_link(self.created_by)

    @property
    def changed_by_(self):
        return self._user_link(self.changed_by)

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


class KeyValue(Model):

    """Used for any type of key-value store"""

    __tablename__ = 'keyvalue'
    id = Column(Integer, primary_key=True)
    value = Column(Text, nullable=False)


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


class Slice(Model, AuditMixinNullable, ImportMixin):

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
    perm = Column(String(1000))
    owners = relationship("User", secondary=slice_user)

    export_fields = ('slice_name', 'datasource_type', 'datasource_name',
                     'viz_type', 'params', 'cache_timeout')

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
            logging.exception(e)
            d['error'] = str(e)
        return {
            'datasource': self.datasource_name,
            'description': self.description,
            'description_markeddown': self.description_markeddown,
            'edit_url': self.edit_url,
            'form_data': self.form_data,
            'slice_id': self.id,
            'slice_name': self.slice_name,
            'slice_url': self.slice_url,
        }

    @property
    def json_data(self):
        return json.dumps(self.data)

    @property
    def form_data(self):
        form_data = json.loads(self.params)
        form_data['slice_id'] = self.id
        form_data['viz_type'] = self.viz_type
        form_data['datasource'] = (
            str(self.datasource_id) + '__' + self.datasource_type)
        return form_data

    @property
    def slice_url(self):
        """Defines the url to access the slice"""
        return (
            "/superset/explore/{obj.datasource_type}/"
            "{obj.datasource_id}/?form_data={params}".format(
                obj=self, params=parse.quote(json.dumps(self.form_data))))

    @property
    def slice_id_url(self):
        return (
            "/superset/{slc.datasource_type}/{slc.datasource_id}/{slc.id}/"
        ).format(slc=self)

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
        slice_params = json.loads(self.params)
        slice_params['slice_id'] = self.id
        slice_params['json'] = "false"
        slice_params['slice_name'] = self.slice_name
        slice_params['viz_type'] = self.viz_type if self.viz_type else "table"

        return viz_types[slice_params.get('viz_type')](
            self.datasource,
            form_data=slice_params,
            slice_=self
        )

    @classmethod
    def import_obj(cls, slc_to_import, import_time=None):
        """Inserts or overrides slc in the database.

        remote_id and import_time fields in params_dict are set to track the
        slice origin and ensure correct overrides for multiple imports.
        Slice.perm is used to find the datasources and connect them.
        """
        session = db.session
        make_transient(slc_to_import)
        slc_to_import.dashboards = []
        slc_to_import.alter_params(
            remote_id=slc_to_import.id, import_time=import_time)

        # find if the slice was already imported
        slc_to_override = None
        for slc in session.query(Slice).all():
            if ('remote_id' in slc.params_dict and
                    slc.params_dict['remote_id'] == slc_to_import.id):
                slc_to_override = slc

        slc_to_import = slc_to_import.copy()
        params = slc_to_import.params_dict
        slc_to_import.datasource_id = SourceRegistry.get_datasource_by_name(
            session, slc_to_import.datasource_type, params['datasource_name'],
            params['schema'], params['database_name']).id
        if slc_to_override:
            slc_to_override.override(slc_to_import)
            session.flush()
            return slc_to_override.id
        session.add(slc_to_import)
        logging.info('Final slice: {}'.format(slc_to_import.to_json()))
        session.flush()
        return slc_to_import.id


sqla.event.listen(Slice, 'before_insert', set_related_perm)
sqla.event.listen(Slice, 'before_update', set_related_perm)


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


class Dashboard(Model, AuditMixinNullable, ImportMixin):

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

    export_fields = ('dashboard_title', 'position_json', 'json_metadata',
                     'description', 'css', 'slug')

    def __repr__(self):
        return self.dashboard_title

    @property
    def table_names(self):
        return ", ".join(
            {"{}".format(s.datasource.name) for s in self.slices})

    @property
    def url(self):
        return "/superset/dashboard/{}/".format(self.slug or self.id)

    @property
    def datasources(self):
        return {slc.datasource for slc in self.slices}

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
        positions = self.position_json
        if positions:
            positions = json.loads(positions)
        d = {
            'id': self.id,
            'metadata': self.params_dict,
            'css': self.css,
            'dashboard_title': self.dashboard_title,
            'slug': self.slug,
            'slices': [slc.data for slc in self.slices],
            'position_json': positions,
        }
        return json.dumps(d)

    @property
    def params(self):
        return self.json_metadata

    @params.setter
    def params(self, value):
        self.json_metadata = value

    @property
    def position_array(self):
        if self.position_json:
            return json.loads(self.position_json)
        return []

    @classmethod
    def import_obj(cls, dashboard_to_import, import_time=None):
        """Imports the dashboard from the object to the database.

         Once dashboard is imported, json_metadata field is extended and stores
         remote_id and import_time. It helps to decide if the dashboard has to
         be overridden or just copies over. Slices that belong to this
         dashboard will be wired to existing tables. This function can be used
         to import/export dashboards between multiple superset instances.
         Audit metadata isn't copies over.
        """
        def alter_positions(dashboard, old_to_new_slc_id_dict):
            """ Updates slice_ids in the position json.

            Sample position json:
            [{
                "col": 5,
                "row": 10,
                "size_x": 4,
                "size_y": 2,
                "slice_id": "3610"
            }]
            """
            position_array = dashboard.position_array
            for position in position_array:
                if 'slice_id' not in position:
                    continue
                old_slice_id = int(position['slice_id'])
                if old_slice_id in old_to_new_slc_id_dict:
                    position['slice_id'] = '{}'.format(
                        old_to_new_slc_id_dict[old_slice_id])
            dashboard.position_json = json.dumps(position_array)

        logging.info('Started import of the dashboard: {}'
                     .format(dashboard_to_import.to_json()))
        session = db.session
        logging.info('Dashboard has {} slices'
                     .format(len(dashboard_to_import.slices)))
        # copy slices object as Slice.import_slice will mutate the slice
        # and will remove the existing dashboard - slice association
        slices = copy(dashboard_to_import.slices)
        old_to_new_slc_id_dict = {}
        new_filter_immune_slices = []
        new_expanded_slices = {}
        i_params_dict = dashboard_to_import.params_dict
        for slc in slices:
            logging.info('Importing slice {} from the dashboard: {}'.format(
                slc.to_json(), dashboard_to_import.dashboard_title))
            new_slc_id = Slice.import_obj(slc, import_time=import_time)
            old_to_new_slc_id_dict[slc.id] = new_slc_id
            # update json metadata that deals with slice ids
            new_slc_id_str = '{}'.format(new_slc_id)
            old_slc_id_str = '{}'.format(slc.id)
            if ('filter_immune_slices' in i_params_dict and
                    old_slc_id_str in i_params_dict['filter_immune_slices']):
                new_filter_immune_slices.append(new_slc_id_str)
            if ('expanded_slices' in i_params_dict and
                    old_slc_id_str in i_params_dict['expanded_slices']):
                new_expanded_slices[new_slc_id_str] = (
                    i_params_dict['expanded_slices'][old_slc_id_str])

        # override the dashboard
        existing_dashboard = None
        for dash in session.query(Dashboard).all():
            if ('remote_id' in dash.params_dict and
                    dash.params_dict['remote_id'] ==
                    dashboard_to_import.id):
                existing_dashboard = dash

        dashboard_to_import.id = None
        alter_positions(dashboard_to_import, old_to_new_slc_id_dict)
        dashboard_to_import.alter_params(import_time=import_time)
        if new_expanded_slices:
            dashboard_to_import.alter_params(
                expanded_slices=new_expanded_slices)
        if new_filter_immune_slices:
            dashboard_to_import.alter_params(
                filter_immune_slices=new_filter_immune_slices)

        new_slices = session.query(Slice).filter(
            Slice.id.in_(old_to_new_slc_id_dict.values())).all()

        if existing_dashboard:
            existing_dashboard.override(dashboard_to_import)
            existing_dashboard.slices = new_slices
            session.flush()
            return existing_dashboard.id
        else:
            # session.add(dashboard_to_import) causes sqlachemy failures
            # related to the attached users / slices. Creating new object
            # allows to avoid conflicts in the sql alchemy state.
            copied_dash = dashboard_to_import.copy()
            copied_dash.slices = new_slices
            session.add(copied_dash)
            session.flush()
            return copied_dash.id

    @classmethod
    def export_dashboards(cls, dashboard_ids):
        copied_dashboards = []
        datasource_ids = set()
        for dashboard_id in dashboard_ids:
            # make sure that dashboard_id is an integer
            dashboard_id = int(dashboard_id)
            copied_dashboard = (
                db.session.query(Dashboard)
                .options(subqueryload(Dashboard.slices))
                .filter_by(id=dashboard_id).first()
            )
            make_transient(copied_dashboard)
            for slc in copied_dashboard.slices:
                datasource_ids.add((slc.datasource_id, slc.datasource_type))
                # add extra params for the import
                slc.alter_params(
                    remote_id=slc.id,
                    datasource_name=slc.datasource.name,
                    schema=slc.datasource.name,
                    database_name=slc.datasource.database.name,
                )
            copied_dashboard.alter_params(remote_id=dashboard_id)
            copied_dashboards.append(copied_dashboard)

            eager_datasources = []
            for dashboard_id, dashboard_type in datasource_ids:
                eager_datasource = SourceRegistry.get_eager_datasource(
                    db.session, dashboard_type, dashboard_id)
                eager_datasource.alter_params(
                    remote_id=eager_datasource.id,
                    database_name=eager_datasource.database.name,
                )
                make_transient(eager_datasource)
                eager_datasources.append(eager_datasource)

        return pickle.dumps({
            'dashboards': copied_dashboards,
            'datasources': eager_datasources,
        })


class Datasource(object):

    """A common interface to objects that are queryable (tables and datasources)"""

    # Used to do code highlighting when displaying the query in the UI
    query_language = None

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
            return "/superset/explore/{obj.type}/{obj.id}/".format(obj=self)

    @property
    def column_formats(self):
        return {
            m.metric_name: m.d3format
            for m in self.metrics
            if m.d3format
        }

    @property
    def data(self):
        """data representation of the datasource sent to the frontend"""
        order_by_choices = []
        for s in sorted(self.column_names):
            order_by_choices.append((json.dumps([s, True]), s + ' [asc]'))
            order_by_choices.append((json.dumps([s, False]), s + ' [desc]'))

        d = {
            'all_cols': utils.choicify(self.column_names),
            'column_formats': self.column_formats,
            'edit_url' : self.url,
            'filter_select': self.filter_select_enabled,
            'filterable_cols': utils.choicify(self.filterable_column_names),
            'gb_cols': utils.choicify(self.groupby_column_names),
            'id': self.id,
            'metrics_combo': self.metrics_combo,
            'name': self.name,
            'order_by_choices': order_by_choices,
            'type': self.type,
        }
        if self.type == 'table':
            grains = self.database.grains() or []
            if grains:
                grains = [(g.name, g.name) for g in grains]
            d['granularity_sqla'] = utils.choicify(self.dttm_cols)
            d['time_grain_sqla'] = grains
        return d


class Database(Model, AuditMixinNullable):

    """An ORM object that stores Database related information"""

    __tablename__ = 'dbs'
    type = "table"

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
    perm = Column(String(1000))

    def __repr__(self):
        return self.database_name

    @property
    def name(self):
        return self.database_name

    @property
    def backend(self):
        url = make_url(self.sqlalchemy_uri_decrypted)
        return url.get_backend_name()

    def set_sqlalchemy_uri(self, uri):
        password_mask = "X" * 10
        conn = sqla.engine.url.make_url(uri)
        if conn.password != password_mask:
            # do not over-write the password with the password mask
            self.password = conn.password
        conn.password = password_mask if conn.password else None
        self.sqlalchemy_uri = str(conn)  # hides the password

    def get_sqla_engine(self, schema=None):
        extra = self.get_extra()
        url = make_url(self.sqlalchemy_uri_decrypted)
        params = extra.get('engine_params', {})
        url.database = self.get_database_for_various_backend(url, schema)
        return create_engine(url, **params)

    def get_database_for_various_backend(self, uri, default_database=None):
        database = uri.database
        if self.backend == 'presto' and default_database:
            if '/' in database:
                database = database.split('/')[0] + '/' + default_database
            else:
                database += '/' + default_database
        # Postgres and Redshift use the concept of schema as a logical entity
        # on top of the database, so the database should not be changed
        # even if passed default_database
        elif self.backend == 'redshift' or self.backend == 'postgresql':
            pass
        elif default_database:
            database = default_database
        return database

    def get_reserved_words(self):
        return self.get_sqla_engine().dialect.preparer.reserved_words

    def get_quoter(self):
        return self.get_sqla_engine().dialect.identifier_preparer.quote

    def get_df(self, sql, schema):
        sql = sql.strip().strip(';')
        eng = self.get_sqla_engine(schema=schema)
        cur = eng.execute(sql, schema=schema)
        cols = [col[0] for col in cur.cursor.description]
        df = pd.DataFrame(cur.fetchall(), columns=cols)

        def needs_conversion(df_series):
            if df_series.empty:
                return False
            for df_type in [list, dict]:
                if isinstance(df_series[0], df_type):
                    return True
            return False

        for k, v in df.dtypes.iteritems():
            if v.type == numpy.object_ and needs_conversion(df[k]):
                df[k] = df[k].apply(utils.json_dumps_w_dates)
        return df

    def compile_sqla_query(self, qry, schema=None):
        eng = self.get_sqla_engine(schema=schema)
        compiled = qry.compile(eng, compile_kwargs={"literal_binds": True})
        return '{}'.format(compiled)

    def select_star(
            self, table_name, schema=None, limit=100, show_cols=False,
            indent=True):
        """Generates a ``select *`` statement in the proper dialect"""
        return self.db_engine_spec.select_star(
            self, table_name, schema=schema, limit=limit, show_cols=show_cols,
            indent=indent)

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

    def all_table_names(self, schema=None, force=False):
        if not schema:
            tables_dict = self.db_engine_spec.fetch_result_sets(
                self, 'table', force=force)
            return tables_dict.get("", [])
        return sorted(self.inspector.get_table_names(schema))

    def all_view_names(self, schema=None, force=False):
        if not schema:
            views_dict = self.db_engine_spec.fetch_result_sets(
                self, 'view', force=force)
            return views_dict.get("", [])
        views = []
        try:
            views = self.inspector.get_view_names(schema)
        except Exception:
            pass
        return views

    def all_schema_names(self):
        return sorted(self.inspector.get_schema_names())

    @property
    def db_engine_spec(self):
        engine_name = self.get_sqla_engine().name or 'base'
        return db_engine_specs.engines.get(
            engine_name, db_engine_specs.BaseEngineSpec)

    def grains(self):
        """Defines time granularity database-specific expressions.

        The idea here is to make it easy for users to change the time grain
        form a datetime (maybe the source grain is arbitrary timestamps, daily
        or 5 minutes increments) to another, "truncated" datetime. Since
        each database has slightly different but similar datetime functions,
        this allows a mapping between database engines and actual functions.
        """
        return self.db_engine_spec.time_grains

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

    def get_columns(self, table_name, schema=None):
        return self.inspector.get_columns(table_name, schema)

    def get_indexes(self, table_name, schema=None):
        return self.inspector.get_indexes(table_name, schema)

    def get_pk_constraint(self, table_name, schema=None):
        return self.inspector.get_pk_constraint(table_name, schema)

    def get_foreign_keys(self, table_name, schema=None):
        return self.inspector.get_foreign_keys(table_name, schema)

    @property
    def sqlalchemy_uri_decrypted(self):
        conn = sqla.engine.url.make_url(self.sqlalchemy_uri)
        conn.password = self.password
        return str(conn)

    @property
    def sql_url(self):
        return '/superset/sql/{}/'.format(self.id)

    def get_perm(self):
        return (
            "[{obj.database_name}].(id:{obj.id})").format(obj=self)

sqla.event.listen(Database, 'after_insert', set_perm)
sqla.event.listen(Database, 'after_update', set_perm)


class TableColumn(Model, AuditMixinNullable, ImportMixin):

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
    avg = Column(Boolean, default=False)
    max = Column(Boolean, default=False)
    min = Column(Boolean, default=False)
    filterable = Column(Boolean, default=False)
    expression = Column(Text, default='')
    description = Column(Text, default='')
    python_date_format = Column(String(255))
    database_expression = Column(String(255))

    num_types = ('DOUBLE', 'FLOAT', 'INT', 'BIGINT', 'LONG', 'REAL', 'NUMERIC')
    date_types = ('DATE', 'TIME')
    str_types = ('VARCHAR', 'STRING', 'CHAR')
    export_fields = (
        'table_id', 'column_name', 'verbose_name', 'is_dttm', 'is_active',
        'type', 'groupby', 'count_distinct', 'sum', 'avg', 'max', 'min',
        'filterable', 'expression', 'description', 'python_date_format',
        'database_expression'
    )

    def __repr__(self):
        return self.column_name

    @property
    def is_num(self):
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

    def get_time_filter(self, start_dttm, end_dttm):
        col = self.sqla_col.label('__time')
        return and_(
            col >= text(self.dttm_sql_literal(start_dttm)),
            col <= text(self.dttm_sql_literal(end_dttm)),
        )

    def get_timestamp_expression(self, time_grain):
        """Getting the time component of the query"""
        expr = self.expression or self.column_name
        if not self.expression and not time_grain:
            return column(expr, type_=DateTime).label(DTTM_ALIAS)
        if time_grain:
            pdf = self.python_date_format
            if pdf in ('epoch_s', 'epoch_ms'):
                # if epoch, translate to DATE using db specific conf
                db_spec = self.table.database.db_engine_spec
                if pdf == 'epoch_s':
                    expr = db_spec.epoch_to_dttm().format(col=expr)
                elif pdf == 'epoch_ms':
                    expr = db_spec.epoch_ms_to_dttm().format(col=expr)
            grain = self.table.database.grains_dict().get(time_grain, '{col}')
            expr = grain.function.format(col=expr)
        return literal_column(expr, type_=DateTime).label(DTTM_ALIAS)

    @classmethod
    def import_obj(cls, i_column):
        def lookup_obj(lookup_column):
            return db.session.query(TableColumn).filter(
                TableColumn.table_id == lookup_column.table_id,
                TableColumn.column_name == lookup_column.column_name).first()
        return import_util.import_simple_obj(db.session, i_column, lookup_obj)

    def dttm_sql_literal(self, dttm):
        """Convert datetime object to a SQL expression string

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
            s = self.table.database.db_engine_spec.convert_dttm(
                self.type, dttm)
            return s or "'{}'".format(dttm.strftime(tf))


class SqlMetric(Model, AuditMixinNullable, ImportMixin):

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

    export_fields = (
        'metric_name', 'verbose_name', 'metric_type', 'table_id', 'expression',
        'description', 'is_restricted', 'd3format')

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

    @classmethod
    def import_obj(cls, i_metric):
        def lookup_obj(lookup_metric):
            return db.session.query(SqlMetric).filter(
                SqlMetric.table_id == lookup_metric.table_id,
                SqlMetric.metric_name == lookup_metric.metric_name).first()
        return import_util.import_simple_obj(db.session, i_metric, lookup_obj)


class SqlaTable(Model, Datasource, AuditMixinNullable, ImportMixin):

    """An ORM object for SqlAlchemy table references"""

    type = "table"
    query_language = 'sql'

    __tablename__ = 'tables'
    id = Column(Integer, primary_key=True)
    table_name = Column(String(250))
    main_dttm_col = Column(String(250))
    description = Column(Text)
    default_endpoint = Column(Text)
    database_id = Column(Integer, ForeignKey('dbs.id'), nullable=False)
    is_featured = Column(Boolean, default=False)
    filter_select_enabled = Column(Boolean, default=False)
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
    params = Column(Text)
    perm = Column(String(1000))

    baselink = "tablemodelview"
    column_cls = TableColumn
    metric_cls = SqlMetric
    export_fields = (
        'table_name', 'main_dttm_col', 'description', 'default_endpoint',
        'database_id', 'is_featured', 'offset', 'cache_timeout', 'schema',
        'sql', 'params')

    __table_args__ = (
        sqla.UniqueConstraint(
            'database_id', 'schema', 'table_name',
            name='_customer_location_uc'),)

    def __repr__(self):
        return self.name

    @property
    def description_markeddown(self):
        return utils.markdown(self.description)

    @property
    def link(self):
        name = escape(self.name)
        return Markup(
            '<a href="{self.explore_url}">{name}</a>'.format(**locals()))

    @property
    def schema_perm(self):
        """Returns schema permission if present, database one otherwise."""
        return utils.get_schema_perm(self.database, self.schema)

    def get_perm(self):
        return (
            "[{obj.database}].[{obj.table_name}]"
            "(id:{obj.id})").format(obj=self)

    @property
    def name(self):
        if not self.schema:
            return self.table_name
        return "{}.{}".format(self.schema, self.table_name)

    @property
    def full_name(self):
        return utils.get_datasource_full_name(
            self.database, self.table_name, schema=self.schema)

    @property
    def dttm_cols(self):
        l = [c.column_name for c in self.columns if c.is_dttm]
        if self.main_dttm_col and self.main_dttm_col not in l:
            l.append(self.main_dttm_col)
        return l

    @property
    def num_cols(self):
        return [c.column_name for c in self.columns if c.is_num]

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
        columns = self.columns
        for col in columns:
            if col_name == col.column_name:
                return col

    def values_for_column(self,
                          column_name,
                          from_dttm,
                          to_dttm,
                          limit=500):
        """Runs query against sqla to retrieve some
        sample values for the given column.
        """
        granularity = self.main_dttm_col

        cols = {col.column_name: col for col in self.columns}
        target_col = cols[column_name]

        tbl = table(self.table_name)
        qry = select([target_col.sqla_col])
        qry = qry.select_from(tbl)
        qry = qry.distinct(column_name)
        qry = qry.limit(limit)

        if granularity:
            dttm_col = cols[granularity]
            timestamp = dttm_col.sqla_col.label('timestamp')
            time_filter = [
                timestamp >= text(dttm_col.dttm_sql_literal(from_dttm)),
                timestamp <= text(dttm_col.dttm_sql_literal(to_dttm)),
            ]
            qry = qry.where(and_(*time_filter))

        engine = self.database.get_sqla_engine()
        sql = "{}".format(
            qry.compile(
                engine, compile_kwargs={"literal_binds": True}, ),
        )

        return pd.read_sql_query(
            sql=sql,
            con=engine
        )

    def get_query_str(  # sqla
            self, engine, qry_start_dttm,
            groupby, metrics,
            granularity,
            from_dttm, to_dttm,
            filter=None,  # noqa
            is_timeseries=True,
            timeseries_limit=15,
            timeseries_limit_metric=None,
            row_limit=None,
            inner_from_dttm=None,
            inner_to_dttm=None,
            orderby=None,
            extras=None,
            columns=None):
        """Querying any sqla table from this common interface"""
        template_processor = get_template_processor(
            table=self, database=self.database)

        # For backward compatibility
        if granularity not in self.dttm_cols:
            granularity = self.main_dttm_col

        cols = {col.column_name: col for col in self.columns}
        metrics_dict = {m.metric_name: m for m in self.metrics}

        if not granularity and is_timeseries:
            raise Exception(_(
                "Datetime column not provided as part table configuration "
                "and is required by this type of chart"))
        for m in metrics:
            if m not in metrics_dict:
                raise Exception(_("Metric '{}' is not valid".format(m)))
        metrics_exprs = [metrics_dict.get(m).sqla_col for m in metrics]
        timeseries_limit_metric = metrics_dict.get(timeseries_limit_metric)
        timeseries_limit_metric_expr = None
        if timeseries_limit_metric:
            timeseries_limit_metric_expr = \
                timeseries_limit_metric.sqla_col
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
            @compiles(ColumnClause)
            def visit_column(element, compiler, **kw):
                """Patch for sqlalchemy bug

                TODO: sqlalchemy 1.2 release should be doing this on its own.
                Patch only if the column clause is specific for DateTime
                set and granularity is selected.
                """
                text = compiler.visit_column(element, **kw)
                try:
                    if (
                            element.is_literal and
                            hasattr(element.type, 'python_type') and
                            type(element.type) is DateTime
                    ):
                        text = text.replace('%%', '%')
                except NotImplementedError:
                    # Some elements raise NotImplementedError for python_type
                    pass
                return text

            dttm_col = cols[granularity]
            time_grain = extras.get('time_grain_sqla')

            if is_timeseries:
                timestamp = dttm_col.get_timestamp_expression(time_grain)
                select_exprs += [timestamp]
                groupby_exprs += [timestamp]

            time_filter = dttm_col.get_time_filter(from_dttm, to_dttm)

        select_exprs += metrics_exprs
        qry = select(select_exprs)

        tbl = table(self.table_name)
        if self.schema:
            tbl.schema = self.schema

        # Supporting arbitrary SQL statements in place of tables
        if self.sql:
            tbl = TextAsFrom(sqla.text(self.sql), []).alias('expr_qry')

        if not columns:
            qry = qry.group_by(*groupby_exprs)

        where_clause_and = []
        having_clause_and = []
        for flt in filter:
            if not all([flt.get(s) for s in ['col', 'op', 'val']]):
                continue
            col = flt['col']
            op = flt['op']
            eq = flt['val']
            col_obj = cols.get(col)
            if col_obj and op in ('in', 'not in'):
                values = [types.strip("'").strip('"') for types in eq]
                if col_obj.is_num:
                    values = [utils.js_string_to_num(s) for s in values]
                cond = col_obj.sqla_col.in_(values)
                if op == 'not in':
                    cond = ~cond
                where_clause_and.append(cond)
        if extras:
            where = extras.get('where')
            if where:
                where_clause_and += [wrap_clause_in_parens(
                    template_processor.process_template(where))]
            having = extras.get('having')
            if having:
                having_clause_and += [wrap_clause_in_parens(
                    template_processor.process_template(having))]
        if granularity:
            qry = qry.where(and_(*([time_filter] + where_clause_and)))
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

        if is_timeseries and timeseries_limit and groupby:
            # some sql dialects require for order by expressions
            # to also be in the select clause -- others, e.g. vertica,
            # require a unique inner alias
            inner_main_metric_expr = main_metric_expr.label('mme_inner__')
            inner_select_exprs += [inner_main_metric_expr]
            subq = select(inner_select_exprs)
            subq = subq.select_from(tbl)
            inner_time_filter = dttm_col.get_time_filter(
                inner_from_dttm or from_dttm,
                inner_to_dttm or to_dttm,
            )
            subq = subq.where(and_(*(where_clause_and + [inner_time_filter])))
            subq = subq.group_by(*inner_groupby_exprs)
            ob = inner_main_metric_expr
            if timeseries_limit_metric_expr is not None:
                ob = timeseries_limit_metric_expr
            subq = subq.order_by(desc(ob))
            subq = subq.limit(timeseries_limit)
            on_clause = []
            for i, gb in enumerate(groupby):
                on_clause.append(
                    groupby_exprs[i] == column(gb + '__'))

            tbl = tbl.join(subq.alias(), and_(*on_clause))

        qry = qry.select_from(tbl)

        sql = "{}".format(
            qry.compile(
                engine, compile_kwargs={"literal_binds": True},),
        )
        logging.info(sql)
        sql = sqlparse.format(sql, reindent=True)
        return sql

    def query(self, query_obj):
        qry_start_dttm = datetime.now()
        engine = self.database.get_sqla_engine()
        sql = self.get_query_str(engine, qry_start_dttm, **query_obj)
        status = QueryStatus.SUCCESS
        error_message = None
        df = None
        try:
            df = pd.read_sql_query(sql, con=engine)
        except Exception as e:
            status = QueryStatus.FAILED
            error_message = str(e)

        return QueryResult(
            status=status,
            df=df,
            duration=datetime.now() - qry_start_dttm,
            query=sql,
            error_message=error_message)

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
                dbcol.sum = dbcol.is_num
                dbcol.avg = dbcol.is_num
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
            if dbcol.avg:
                metrics.append(M(
                    metric_name='avg__' + dbcol.column_name,
                    verbose_name='avg__' + dbcol.column_name,
                    metric_type='avg',
                    expression="AVG({})".format(quoted)
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

    @classmethod
    def import_obj(cls, i_datasource, import_time=None):
        """Imports the datasource from the object to the database.

         Metrics and columns and datasource will be overrided if exists.
         This function can be used to import/export dashboards between multiple
         superset instances. Audit metadata isn't copies over.
        """
        def lookup_sqlatable(table):
            return db.session.query(SqlaTable).join(Database).filter(
                SqlaTable.table_name == table.table_name,
                SqlaTable.schema == table.schema,
                Database.id == table.database_id,
            ).first()

        def lookup_database(table):
            return db.session.query(Database).filter_by(
                database_name=table.params_dict['database_name']).one()
        return import_util.import_datasource(
            db.session, i_datasource, lookup_database, lookup_sqlatable,
            import_time)

sqla.event.listen(SqlaTable, 'after_insert', set_perm)
sqla.event.listen(SqlaTable, 'after_update', set_perm)


class DruidCluster(Model, AuditMixinNullable):

    """ORM object referencing the Druid clusters"""

    __tablename__ = 'clusters'
    type = "druid"

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

    def refresh_datasources(self, datasource_name=None, merge_flag=False):
        """Refresh metadata of all datasources in the cluster
        If ``datasource_name`` is specified, only that datasource is updated
        """
        self.druid_version = self.get_druid_version()
        for datasource in self.get_datasources():
            if datasource not in config.get('DRUID_DATA_SOURCE_BLACKLIST'):
                if not datasource_name or datasource_name == datasource:
                    DruidDatasource.sync_to_db(datasource, self, merge_flag)

    @property
    def perm(self):
        return "[{obj.cluster_name}].(id:{obj.id})".format(obj=self)

    @property
    def name(self):
        return self.cluster_name


class DruidColumn(Model, AuditMixinNullable, ImportMixin):
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
    avg = Column(Boolean, default=False)
    max = Column(Boolean, default=False)
    min = Column(Boolean, default=False)
    filterable = Column(Boolean, default=False)
    description = Column(Text)
    dimension_spec_json = Column(Text)

    export_fields = (
        'datasource_name', 'column_name', 'is_active', 'type', 'groupby',
        'count_distinct', 'sum', 'avg', 'max', 'min', 'filterable',
        'description', 'dimension_spec_json'
    )

    def __repr__(self):
        return self.column_name

    @property
    def is_num(self):
        return self.type in ('LONG', 'DOUBLE', 'FLOAT', 'INT')

    @property
    def dimension_spec(self):
        if self.dimension_spec_json:
            return json.loads(self.dimension_spec_json)

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

        if self.sum and self.is_num:
            mt = corrected_type.lower() + 'Sum'
            name = 'sum__' + self.column_name
            metrics.append(DruidMetric(
                metric_name=name,
                metric_type='sum',
                verbose_name='SUM({})'.format(self.column_name),
                json=json.dumps({
                    'type': mt, 'name': name, 'fieldName': self.column_name})
            ))

        if self.avg and self.is_num:
            mt = corrected_type.lower() + 'Avg'
            name = 'avg__' + self.column_name
            metrics.append(DruidMetric(
                metric_name=name,
                metric_type='avg',
                verbose_name='AVG({})'.format(self.column_name),
                json=json.dumps({
                    'type': mt, 'name': name, 'fieldName': self.column_name})
            ))

        if self.min and self.is_num:
            mt = corrected_type.lower() + 'Min'
            name = 'min__' + self.column_name
            metrics.append(DruidMetric(
                metric_name=name,
                metric_type='min',
                verbose_name='MIN({})'.format(self.column_name),
                json=json.dumps({
                    'type': mt, 'name': name, 'fieldName': self.column_name})
            ))
        if self.max and self.is_num:
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

    @classmethod
    def import_obj(cls, i_column):
        def lookup_obj(lookup_column):
            return db.session.query(DruidColumn).filter(
                DruidColumn.datasource_name == lookup_column.datasource_name,
                DruidColumn.column_name == lookup_column.column_name).first()

        return import_util.import_simple_obj(db.session, i_column, lookup_obj)


class DruidMetric(Model, AuditMixinNullable, ImportMixin):

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

    def refresh_datasources(self, datasource_name=None, merge_flag=False):
        """Refresh metadata of all datasources in the cluster

        If ``datasource_name`` is specified, only that datasource is updated
        """
        self.druid_version = self.get_druid_version()
        for datasource in self.get_datasources():
            if datasource not in config.get('DRUID_DATA_SOURCE_BLACKLIST'):
                if not datasource_name or datasource_name == datasource:
                    DruidDatasource.sync_to_db(datasource, self, merge_flag)
    export_fields = (
        'metric_name', 'verbose_name', 'metric_type', 'datasource_name',
        'json', 'description', 'is_restricted', 'd3format'
    )

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
            return db.session.query(DruidMetric).filter(
                DruidMetric.datasource_name == lookup_metric.datasource_name,
                DruidMetric.metric_name == lookup_metric.metric_name).first()
        return import_util.import_simple_obj(db.session, i_metric, lookup_obj)


class DruidDatasource(Model, AuditMixinNullable, Datasource, ImportMixin):

    """ORM object referencing Druid datasources (tables)"""

    type = "druid"
    query_langtage = "json"

    baselink = "druiddatasourcemodelview"

    __tablename__ = 'datasources'
    id = Column(Integer, primary_key=True)
    datasource_name = Column(String(255), unique=True)
    is_featured = Column(Boolean, default=False)
    is_hidden = Column(Boolean, default=False)
    filter_select_enabled = Column(Boolean, default=False)
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
    params = Column(String(1000))
    perm = Column(String(1000))

    metric_cls = DruidMetric
    column_cls = DruidColumn

    export_fields = (
        'datasource_name', 'is_hidden', 'description', 'default_endpoint',
        'cluster_name', 'is_featured', 'offset', 'cache_timeout', 'params'
    )

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
        return [c.column_name for c in self.columns if c.is_num]

    @property
    def name(self):
        return self.datasource_name

    @property
    def schema(self):
        name_pieces = self.datasource_name.split('.')
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
            return db.session.query(DruidDatasource).join(DruidCluster).filter(
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
        max_time = dparse(max_time)
        # Query segmentMetadata for 7 days back. However, due to a bug,
        # we need to set this interval to more than 1 day ago to exclude
        # realtime segments, which triggered a bug (fixed in druid 0.8.2).
        # https://groups.google.com/forum/#!topic/druid-user/gVCqqspHqOQ
        lbound = (max_time - timedelta(days=7)).isoformat()
        rbound = max_time.isoformat()
        if not self.version_higher(self.cluster.druid_version, '0.8.2'):
            rbound = (max_time - timedelta(1)).isoformat()
        segment_metadata = None
        try:
            segment_metadata = client.segment_metadata(
                datasource=self.datasource_name,
                intervals=lbound + '/' + rbound,
                merge=self.merge_flag,
                analysisTypes=config.get('DRUID_ANALYSIS_TYPES'))
        except Exception as e:
            logging.warning("Failed first attempt to get latest segment")
            logging.exception(e)
        if not segment_metadata:
            # if no segments in the past 7 days, look at all segments
            lbound = datetime(1901, 1, 1).isoformat()[:10]
            rbound = datetime(2050, 1, 1).isoformat()[:10]
            if not self.version_higher(self.cluster.druid_version, '0.8.2'):
                rbound = datetime.now().isoformat()[:10]
            try:
                segment_metadata = client.segment_metadata(
                    datasource=self.datasource_name,
                    intervals=lbound + '/' + rbound,
                    merge=self.merge_flag,
                    analysisTypes=config.get('DRUID_ANALYSIS_TYPES'))
            except Exception as e:
                logging.warning("Failed 2nd attempt to get latest segment")
                logging.exception(e)
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
    def sync_to_db(cls, name, cluster, merge):
        """Fetches metadata for that datasource and merges the Superset db"""
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
        datasource.merge_flag = merge
        session.flush()

        cols = datasource.latest_metadata()
        if not cols:
            logging.error("Failed at fetching the latest segment")
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

    def values_for_column(self,
                          column_name,
                          from_dttm,
                          to_dttm,
                          limit=500):
        """Retrieve some values for the given column"""
        # TODO: Use Lexicographic TopNMetricSpec once supported by PyDruid
        from_dttm = from_dttm.replace(tzinfo=config.get("DRUID_TZ"))
        to_dttm = to_dttm.replace(tzinfo=config.get("DRUID_TZ"))

        qry = dict(
            datasource=self.datasource_name,
            granularity="all",
            intervals=from_dttm.isoformat() + '/' + to_dttm.isoformat(),
            aggregations=dict(count=count("count")),
            dimension=column_name,
            metric="count",
            threshold=limit,
        )

        client = self.cluster.get_pydruid_client()
        client.topn(**qry)
        df = client.export_pandas()

        if df is None or df.size == 0:
            raise Exception(_("No data was returned."))

        return df

    def get_query_str(  # druid
            self, client, qry_start_dttm,
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
            columns=None, phase=2):
        """Runs a query against Druid and returns a dataframe.

        This query interface is common to SqlAlchemy and Druid
        """
        # TODO refactor into using a TBD Query object
        if not is_timeseries:
            granularity = 'all'
        inner_from_dttm = inner_from_dttm or from_dttm
        inner_to_dttm = inner_to_dttm or to_dttm

        # add tzinfo to native datetime with config
        from_dttm = from_dttm.replace(tzinfo=config.get("DRUID_TZ"))
        to_dttm = to_dttm.replace(tzinfo=config.get("DRUID_TZ"))
        timezone = from_dttm.tzname()

        query_str = ""
        metrics_dict = {m.metric_name: m for m in self.metrics}
        all_metrics = []
        post_aggs = {}

        columns_dict = {c.column_name: c for c in self.columns}

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
                        name=conf.get('name', ''),
                        field_names=conf.get('fieldNames', []),
                        function=conf.get('function', ''))
                elif conf.get('type') == 'quantile':
                    post_aggs[metric_name] = Quantile(
                        conf.get('name', ''),
                        conf.get('probability', ''),
                    )
                elif conf.get('type') == 'quantiles':
                    post_aggs[metric_name] = Quantiles(
                        conf.get('name', ''),
                        conf.get('probabilities', ''),
                    )
                elif conf.get('type') == 'fieldAccess':
                    post_aggs[metric_name] = Field(conf.get('name'), '')
                elif conf.get('type') == 'constant':
                    post_aggs[metric_name] = Const(
                        conf.get('value'),
                        output_name=conf.get('name', '')
                    )
                elif conf.get('type') == 'hyperUniqueCardinality':
                    post_aggs[metric_name] = HyperUniqueCardinality(
                        conf.get('name'), ''
                    )
                else:
                    post_aggs[metric_name] = Postaggregator(
                        conf.get('fn', "/"),
                        conf.get('fields', []),
                        conf.get('name', ''))

        aggregations = OrderedDict()
        for m in self.metrics:
            if m.metric_name in all_metrics:
                aggregations[m.metric_name] = m.json_obj

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

        # the dimensions list with dimensionSpecs expanded
        dimensions = []
        groupby = [gb for gb in groupby if gb in columns_dict]
        for column_name in groupby:
            col = columns_dict.get(column_name)
            dim_spec = col.dimension_spec
            if dim_spec:
                dimensions.append(dim_spec)
            else:
                dimensions.append(column_name)
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

        filters = self.get_filters(filter)
        if filters:
            qry['filter'] = filters

        having_filters = self.get_having_filters(extras.get('having_druid'))
        if having_filters:
            qry['having'] = having_filters

        orig_filters = filters
        if len(groupby) == 0:
            del qry['dimensions']
            client.timeseries(**qry)
        if not having_filters and len(groupby) == 1:
            qry['threshold'] = timeseries_limit or 1000
            if row_limit and granularity == 'all':
                qry['threshold'] = row_limit
            qry['dimension'] = list(qry.get('dimensions'))[0]
            del qry['dimensions']
            qry['metric'] = list(qry['aggregations'].keys())[0]
            client.topn(**qry)
        elif len(groupby) > 1 or having_filters:
            # If grouping on multiple fields or using a having filter
            # we have to force a groupby query
            if timeseries_limit and is_timeseries:
                order_by = metrics[0] if metrics else self.metrics[0]
                if timeseries_limit_metric:
                    order_by = timeseries_limit_metric
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
                        "dimension": order_by,
                        "direction": "descending",
                    }],
                }
                client.groupby(**pre_qry)
                query_str += "// Two phase query\n// Phase 1\n"
                query_str += json.dumps(
                    client.query_builder.last_query.query_dict, indent=2)
                query_str += "\n"
                if phase == 1:
                    return query_str
                query_str += (
                    "//\nPhase 2 (built based on phase one's results)\n")
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
                        "dimension": (
                            metrics[0] if metrics else self.metrics[0]),
                        "direction": "descending",
                    }],
                }
            client.groupby(**qry)
        query_str += json.dumps(
            client.query_builder.last_query.query_dict, indent=2)
        return query_str

    def query(self, query_obj):
        qry_start_dttm = datetime.now()
        client = self.cluster.get_pydruid_client()
        query_str = self.get_query_str(client, qry_start_dttm, **query_obj)
        df = client.export_pandas()

        if df is None or df.size == 0:
            raise Exception(_("No data was returned."))
        df.columns = [
            DTTM_ALIAS if c == 'timestamp' else c for c in df.columns]

        is_timeseries = query_obj['is_timeseries'] \
            if 'is_timeseries' in query_obj else True
        if (
                not is_timeseries and
                query_obj['granularity'] == "all" and
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
                tzinfo=config.get("DRUID_TZ"))
            return dt + timedelta(milliseconds=time_offset)
        if DTTM_ALIAS in df.columns and time_offset:
            df[DTTM_ALIAS] = df[DTTM_ALIAS].apply(increment_timestamp)

        return QueryResult(
            df=df,
            query=query_str,
            duration=datetime.now() - qry_start_dttm)

    def get_filters(self, raw_filters):
        filters = None
        for flt in raw_filters:
            if not all(f in flt for f in ['col', 'op', 'val']):
                continue
            col = flt['col']
            op = flt['op']
            eq = flt['val']
            cond = None
            if op in ('in', 'not in'):
                eq = [types.replace("'", '').strip() for types in eq]
            elif not isinstance(flt['val'], basestring):
                eq = eq[0] if len(eq) > 0 else ''
            if col in self.num_cols:
                if op in ('in', 'not in'):
                    eq = [utils.js_string_to_num(v) for v in eq]
                else:
                    eq = utils.js_string_to_num(eq)
            if op == '==':
                cond = Dimension(col) == eq
            elif op == '!=':
                cond = ~(Dimension(col) == eq)
            elif op in ('in', 'not in'):
                fields = []
                if len(eq) > 1:
                    for s in eq:
                        fields.append(Dimension(col) == s)
                    cond = Filter(type="or", fields=fields)
                elif len(eq) == 1:
                    cond = Dimension(col) == eq[0]
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

sqla.event.listen(DruidDatasource, 'after_insert', set_perm)
sqla.event.listen(DruidDatasource, 'after_update', set_perm)


class Log(Model):

    """ORM object used to log Superset actions to the database"""

    __tablename__ = 'logs'

    id = Column(Integer, primary_key=True)
    action = Column(String(512))
    user_id = Column(Integer, ForeignKey('ab_user.id'))
    dashboard_id = Column(Integer)
    slice_id = Column(Integer)
    json = Column(Text)
    user = relationship('User', backref='logs', foreign_keys=[user_id])
    dttm = Column(DateTime, default=datetime.utcnow)
    dt = Column(Date, default=date.today())
    duration_ms = Column(Integer)
    referrer = Column(String(1024))

    @classmethod
    def log_this(cls, f):
        """Decorator to log user actions"""
        @functools.wraps(f)
        def wrapper(*args, **kwargs):
            start_dttm = datetime.now()
            user_id = None
            if g.user:
                user_id = g.user.get_id()
            d = request.args.to_dict()
            post_data = request.form or {}
            d.update(post_data)
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
            value = f(*args, **kwargs)

            sesh = db.session()
            log = cls(
                action=f.__name__,
                json=params,
                dashboard_id=d.get('dashboard_id') or None,
                slice_id=slice_id,
                duration_ms=(
                    datetime.now() - start_dttm).total_seconds() * 1000,
                referrer=request.referrer[:1000] if request.referrer else None,
                user_id=user_id)
            sesh.add(log)
            sesh.commit()
            return value
        return wrapper


class FavStar(Model):
    __tablename__ = 'favstar'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('ab_user.id'))
    class_name = Column(String(50))
    obj_id = Column(Integer)
    dttm = Column(DateTime, default=datetime.utcnow)


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
    # Could be configured in the superset config.
    limit = Column(Integer)
    limit_used = Column(Boolean, default=False)
    limit_reached = Column(Boolean, default=False)
    select_as_cta = Column(Boolean)
    select_as_cta_used = Column(Boolean, default=False)

    progress = Column(Integer, default=0)  # 1..100
    # # of rows in the result set or rows modified.
    rows = Column(Integer)
    error_message = Column(Text)
    # key used to store the results in the results backend
    results_key = Column(String(64), index=True)

    # Using Numeric in place of DateTime for sub-second precision
    # stored as seconds since epoch, allowing for milliseconds
    start_time = Column(Numeric(precision=3))
    end_time = Column(Numeric(precision=3))
    changed_on = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)

    database = relationship(
        'Database',
        foreign_keys=[database_id],
        backref=backref('queries', cascade='all, delete-orphan')
    )
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
            'resultsKey': self.results_key,
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

    ROLES_BLACKLIST = set(config.get('ROBOT_PERMISSION_ROLES', []))

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
                '/superset/approve?datasource_type={self.datasource_type}&'
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
                '/superset/approve?datasource_type={self.datasource_type}&'
                'datasource_id={self.datasource_id}&'
                'created_by={self.created_by.username}&role_to_extend={r.name}'
                .format(**locals())
            )
            href = '<a href="{}">Extend {} Role</a>'.format(url, r.name)
            if r.name in self.ROLES_BLACKLIST:
                href = "{} Role".format(r.name)
            action_list = action_list + '<li>' + href + '</li>'
        return '<ul>' + action_list + '</ul>'
