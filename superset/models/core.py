"""A collection of ORM sqlalchemy models for Superset"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from copy import copy, deepcopy
from datetime import date, datetime
import functools
import json
import logging
import textwrap

from flask import escape, g, Markup, request
from flask_appbuilder import Model
from flask_appbuilder.models.decorators import renders
from future.standard_library import install_aliases
import numpy
import pandas as pd
import sqlalchemy as sqla
from sqlalchemy import (
    Boolean, Column, create_engine, Date, DateTime, ForeignKey, Integer,
    MetaData, select, String, Table, Text,
)
from sqlalchemy.engine import url
from sqlalchemy.engine.url import make_url
from sqlalchemy.orm import relationship, subqueryload
from sqlalchemy.orm.session import make_transient
from sqlalchemy.pool import NullPool
from sqlalchemy.schema import UniqueConstraint
from sqlalchemy.sql import text
from sqlalchemy.sql.expression import TextAsFrom
from sqlalchemy_utils import EncryptedType

from superset import app, db, db_engine_specs, sm, utils
from superset.connectors.connector_registry import ConnectorRegistry
from superset.models.helpers import AuditMixinNullable, ImportMixin, set_perm
from superset.viz import viz_types
install_aliases()
from urllib import parse  # noqa

config = app.config
custom_password_store = config.get('SQLALCHEMY_CUSTOM_PASSWORD_STORE')
stats_logger = config.get('STATS_LOGGER')
metadata = Model.metadata  # pylint: disable=no-member

PASSWORD_MASK = 'X' * 10

def set_related_perm(mapper, connection, target):  # noqa
    src_class = target.cls_model
    id_ = target.datasource_id
    if id_:
        ds = db.session.query(src_class).filter_by(id=int(id_)).first()
        if ds:
            target.perm = ds.perm


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


slice_user = Table('slice_user', metadata,
                   Column('id', Integer, primary_key=True),
                   Column('user_id', Integer, ForeignKey('ab_user.id')),
                   Column('slice_id', Integer, ForeignKey('slices.id')))


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
    owners = relationship(sm.user_model, secondary=slice_user)

    export_fields = ('slice_name', 'datasource_type', 'datasource_name',
                     'viz_type', 'params', 'cache_timeout')

    def __repr__(self):
        return self.slice_name

    @property
    def cls_model(self):
        return ConnectorRegistry.sources[self.datasource_type]

    @property
    def datasource(self):
        return self.get_datasource

    def clone(self):
        return Slice(
            slice_name=self.slice_name,
            datasource_id=self.datasource_id,
            datasource_type=self.datasource_type,
            datasource_name=self.datasource_name,
            viz_type=self.viz_type,
            params=self.params,
            description=self.description,
            cache_timeout=self.cache_timeout)

    @datasource.getter
    @utils.memoized
    def get_datasource(self):
        return (
            db.session.query(self.cls_model)
            .filter_by(id=self.datasource_id)
            .first()
        )

    @renders('datasource_name')
    def datasource_link(self):
        # pylint: disable=no-member
        datasource = self.datasource
        return datasource.link if datasource else None

    @property
    def datasource_edit_url(self):
        # pylint: disable=no-member
        datasource = self.datasource
        return datasource.url if datasource else None

    @property
    @utils.memoized
    def viz(self):
        d = json.loads(self.params)
        viz_class = viz_types[self.viz_type]
        # pylint: disable=no-member
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
        form_data = {}
        try:
            form_data = json.loads(self.params)
        except Exception as e:
            logging.error("Malformed json in slice's params")
            logging.exception(e)
        form_data.update({
            'slice_id': self.id,
            'viz_type': self.viz_type,
            'datasource': str(self.datasource_id) + '__' + self.datasource_type,
        })
        if self.cache_timeout:
            form_data['cache_timeout'] = self.cache_timeout
        return form_data

    @property
    def slice_url(self):
        """Defines the url to access the slice"""
        form_data = {'slice_id': self.id}
        return (
            '/superset/explore/{obj.datasource_type}/'
            '{obj.datasource_id}/?form_data={params}'.format(
                obj=self, params=parse.quote(json.dumps(form_data))))

    @property
    def slice_id_url(self):
        return (
            '/superset/{slc.datasource_type}/{slc.datasource_id}/{slc.id}/'
        ).format(slc=self)

    @property
    def edit_url(self):
        return '/slicemodelview/edit/{}'.format(self.id)

    @property
    def slice_link(self):
        url = self.slice_url
        name = escape(self.slice_name)
        return Markup('<a href="{url}">{name}</a>'.format(**locals()))

    def get_viz(self, force=False):
        """Creates :py:class:viz.BaseViz object from the url_params_multidict.

        :return: object of the 'viz_type' type that is taken from the
            url_params_multidict or self.params.
        :rtype: :py:class:viz.BaseViz
        """
        slice_params = json.loads(self.params)
        slice_params['slice_id'] = self.id
        slice_params['json'] = 'false'
        slice_params['slice_name'] = self.slice_name
        slice_params['viz_type'] = self.viz_type if self.viz_type else 'table'

        return viz_types[slice_params.get('viz_type')](
            self.datasource,
            form_data=slice_params,
            force=force,
        )

    @classmethod
    def import_obj(cls, slc_to_import, slc_to_override, import_time=None):
        """Inserts or overrides slc in the database.

        remote_id and import_time fields in params_dict are set to track the
        slice origin and ensure correct overrides for multiple imports.
        Slice.perm is used to find the datasources and connect them.

        :param Slice slc_to_import: Slice object to import
        :param Slice slc_to_override: Slice to replace, id matches remote_id
        :returns: The resulting id for the imported slice
        :rtype: int
        """
        session = db.session
        make_transient(slc_to_import)
        slc_to_import.dashboards = []
        slc_to_import.alter_params(
            remote_id=slc_to_import.id, import_time=import_time)

        slc_to_import = slc_to_import.copy()
        params = slc_to_import.params_dict
        slc_to_import.datasource_id = ConnectorRegistry.get_datasource_by_name(
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
    'dashboard_slices', metadata,
    Column('id', Integer, primary_key=True),
    Column('dashboard_id', Integer, ForeignKey('dashboards.id')),
    Column('slice_id', Integer, ForeignKey('slices.id')),
)

dashboard_user = Table(
    'dashboard_user', metadata,
    Column('id', Integer, primary_key=True),
    Column('user_id', Integer, ForeignKey('ab_user.id')),
    Column('dashboard_id', Integer, ForeignKey('dashboards.id')),
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
    owners = relationship(sm.user_model, secondary=dashboard_user)

    export_fields = ('dashboard_title', 'position_json', 'json_metadata',
                     'description', 'css', 'slug')

    def __repr__(self):
        return self.dashboard_title

    @property
    def table_names(self):
        # pylint: disable=no-member
        return ', '.join(
            {'{}'.format(s.datasource.full_name) for s in self.slices})

    @property
    def url(self):
        if self.json_metadata:
            # add default_filters to the preselect_filters of dashboard
            json_metadata = json.loads(self.json_metadata)
            default_filters = json_metadata.get('default_filters')
            if default_filters:
                filters = parse.quote(default_filters.encode('utf8'))
                return '/superset/dashboard/{}/?preselect_filters={}'.format(
                    self.slug or self.id, filters)
        return '/superset/dashboard/{}/'.format(self.slug or self.id)

    @property
    def datasources(self):
        return {slc.datasource for slc in self.slices}

    @property
    def sqla_metadata(self):
        # pylint: disable=no-member
        metadata = MetaData(bind=self.get_sqla_engine())
        return metadata.reflect()

    def dashboard_link(self):
        title = escape(self.dashboard_title)
        return Markup(
            '<a href="{self.url}">{title}</a>'.format(**locals()))

    @property
    def data(self):
        positions = self.position_json
        if positions:
            positions = json.loads(positions)
        return {
            'id': self.id,
            'metadata': self.params_dict,
            'css': self.css,
            'dashboard_title': self.dashboard_title,
            'slug': self.slug,
            'slices': [slc.data for slc in self.slices],
            'position_json': positions,
        }

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
         Audit metadata isn't copied over.
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
        new_timed_refresh_immune_slices = []
        new_expanded_slices = {}
        i_params_dict = dashboard_to_import.params_dict
        remote_id_slice_map = {
            slc.params_dict['remote_id']: slc
            for slc in session.query(Slice).all()
            if 'remote_id' in slc.params_dict
        }
        for slc in slices:
            logging.info('Importing slice {} from the dashboard: {}'.format(
                slc.to_json(), dashboard_to_import.dashboard_title))
            remote_slc = remote_id_slice_map.get(slc.id)
            new_slc_id = Slice.import_obj(slc, remote_slc, import_time=import_time)
            old_to_new_slc_id_dict[slc.id] = new_slc_id
            # update json metadata that deals with slice ids
            new_slc_id_str = '{}'.format(new_slc_id)
            old_slc_id_str = '{}'.format(slc.id)
            if ('filter_immune_slices' in i_params_dict and
                    old_slc_id_str in i_params_dict['filter_immune_slices']):
                new_filter_immune_slices.append(new_slc_id_str)
            if ('timed_refresh_immune_slices' in i_params_dict and
                    old_slc_id_str in
                    i_params_dict['timed_refresh_immune_slices']):
                new_timed_refresh_immune_slices.append(new_slc_id_str)
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
        if new_timed_refresh_immune_slices:
            dashboard_to_import.alter_params(
                timed_refresh_immune_slices=new_timed_refresh_immune_slices)

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
                eager_datasource = ConnectorRegistry.get_eager_datasource(
                    db.session, dashboard_type, dashboard_id)
                eager_datasource.alter_params(
                    remote_id=eager_datasource.id,
                    database_name=eager_datasource.database.name,
                )
                make_transient(eager_datasource)
                eager_datasources.append(eager_datasource)

        return json.dumps({
            'dashboards': copied_dashboards,
            'datasources': eager_datasources,
        }, cls=utils.DashboardEncoder, indent=4)


class Database(Model, AuditMixinNullable, ImportMixin):

    """An ORM object that stores Database related information"""

    __tablename__ = 'dbs'
    type = 'table'
    __table_args__ = (UniqueConstraint('database_name'),)

    id = Column(Integer, primary_key=True)
    verbose_name = Column(String(250), unique=True)
    # short unique name, used in permissions
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

    impersonate_user = Column(Boolean, default=False)
    export_fields = ('database_name', 'sqlalchemy_uri', 'cache_timeout',
                     'expose_in_sqllab', 'allow_run_sync', 'allow_run_async',
                     'allow_ctas', 'extra')
    export_children = ['tables']

    def __repr__(self):
        return self.verbose_name if self.verbose_name else self.database_name

    @property
    def name(self):
        return self.verbose_name if self.verbose_name else self.database_name

    @property
    def data(self):
        return {
            'name': self.database_name,
            'backend': self.backend,
        }

    @property
    def unique_name(self):
        return self.database_name

    @property
    def backend(self):
        url = make_url(self.sqlalchemy_uri_decrypted)
        return url.get_backend_name()

    @classmethod
    def get_password_masked_url_from_uri(cls, uri):
        url = make_url(uri)
        return cls.get_password_masked_url(url)

    @classmethod
    def get_password_masked_url(cls, url):
        url_copy = deepcopy(url)
        if url_copy.password is not None and url_copy.password != PASSWORD_MASK:
            url_copy.password = PASSWORD_MASK
        return url_copy

    def set_sqlalchemy_uri(self, uri):
        conn = sqla.engine.url.make_url(uri.strip())
        if conn.password != PASSWORD_MASK and not custom_password_store:
            # do not over-write the password with the password mask
            self.password = conn.password
        conn.password = PASSWORD_MASK if conn.password else None
        self.sqlalchemy_uri = str(conn)  # hides the password

    def get_effective_user(self, url, user_name=None):
        """
        Get the effective user, especially during impersonation.
        :param url: SQL Alchemy URL object
        :param user_name: Default username
        :return: The effective username
        """
        effective_username = None
        if self.impersonate_user:
            effective_username = url.username
            if user_name:
                effective_username = user_name
            elif (
                hasattr(g, 'user') and hasattr(g.user, 'username') and
                g.user.username is not None
            ):
                effective_username = g.user.username
        return effective_username

    @utils.memoized(
        watch=('impersonate_user', 'sqlalchemy_uri_decrypted', 'extra'))
    def get_sqla_engine(self, schema=None, nullpool=True, user_name=None):
        extra = self.get_extra()
        url = make_url(self.sqlalchemy_uri_decrypted)
        url = self.db_engine_spec.adjust_database_uri(url, schema)
        effective_username = self.get_effective_user(url, user_name)
        # If using MySQL or Presto for example, will set url.username
        # If using Hive, will not do anything yet since that relies on a
        # configuration parameter instead.
        self.db_engine_spec.modify_url_for_impersonation(
            url,
            self.impersonate_user,
            effective_username)

        masked_url = self.get_password_masked_url(url)
        logging.info('Database.get_sqla_engine(). Masked URL: {0}'.format(masked_url))

        params = extra.get('engine_params', {})
        if nullpool:
            params['poolclass'] = NullPool

        # If using Hive, this will set hive.server2.proxy.user=$effective_username
        configuration = {}
        configuration.update(
            self.db_engine_spec.get_configuration_for_impersonation(
                str(url),
                self.impersonate_user,
                effective_username))
        if configuration:
            params['connect_args'] = {'configuration': configuration}

        return create_engine(url, **params)

    def get_reserved_words(self):
        return self.get_dialect().preparer.reserved_words

    def get_quoter(self):
        return self.get_dialect().identifier_preparer.quote

    def get_df(self, sql, schema):
        sql = sql.strip().strip(';')
        eng = self.get_sqla_engine(schema=schema)
        df = pd.read_sql(sql, eng)

        def needs_conversion(df_series):
            if df_series.empty:
                return False
            if isinstance(df_series[0], (list, dict)):
                return True
            return False

        for k, v in df.dtypes.iteritems():
            if v.type == numpy.object_ and needs_conversion(df[k]):
                df[k] = df[k].apply(utils.json_dumps_w_dates)
        return df

    def compile_sqla_query(self, qry, schema=None):
        eng = self.get_sqla_engine(schema=schema)
        compiled = qry.compile(eng, compile_kwargs={'literal_binds': True})
        return '{}'.format(compiled)

    def select_star(
            self, table_name, schema=None, limit=100, show_cols=False,
            indent=True, latest_partition=True):
        """Generates a ``select *`` statement in the proper dialect"""
        return self.db_engine_spec.select_star(
            self, table_name, schema=schema, limit=limit, show_cols=show_cols,
            indent=indent, latest_partition=latest_partition)

    def wrap_sql_limit(self, sql, limit=1000):
        qry = (
            select('*')
            .select_from(
                TextAsFrom(text(sql), ['*'])
                .alias('inner_qry'),
            ).limit(limit)
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
            return tables_dict.get('', [])
        return sorted(
            self.db_engine_spec.get_table_names(schema, self.inspector))

    def all_view_names(self, schema=None, force=False):
        if not schema:
            views_dict = self.db_engine_spec.fetch_result_sets(
                self, 'view', force=force)
            return views_dict.get('', [])
        views = []
        try:
            views = self.inspector.get_view_names(schema)
        except Exception:
            pass
        return views

    def all_schema_names(self):
        return sorted(self.db_engine_spec.get_schema_names(self.inspector))

    @property
    def db_engine_spec(self):
        return db_engine_specs.engines.get(
            self.backend, db_engine_specs.BaseEngineSpec)

    @classmethod
    def get_db_engine_spec_for_backend(cls, backend):
        return db_engine_specs.engines.get(backend, db_engine_specs.BaseEngineSpec)

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
        if custom_password_store:
            conn.password = custom_password_store(conn)
        else:
            conn.password = self.password
        return str(conn)

    @property
    def sql_url(self):
        return '/superset/sql/{}/'.format(self.id)

    def get_perm(self):
        return (
            '[{obj.database_name}].(id:{obj.id})').format(obj=self)

    def has_table(self, table):
        engine = self.get_sqla_engine()
        return engine.has_table(
            table.table_name, table.schema or None)

    @utils.memoized
    def get_dialect(self):
        sqla_url = url.make_url(self.sqlalchemy_uri_decrypted)
        return sqla_url.get_dialect()()


sqla.event.listen(Database, 'after_insert', set_perm)
sqla.event.listen(Database, 'after_update', set_perm)


class Log(Model):

    """ORM object used to log Superset actions to the database"""

    __tablename__ = 'logs'

    id = Column(Integer, primary_key=True)
    action = Column(String(512))
    user_id = Column(Integer, ForeignKey('ab_user.id'))
    dashboard_id = Column(Integer)
    slice_id = Column(Integer)
    json = Column(Text)
    user = relationship(sm.user_model, backref='logs', foreign_keys=[user_id])
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
            d = request.form.to_dict() or {}
            # request parameters can overwrite post body
            request_params = request.args.to_dict()
            d.update(request_params)
            d.update(kwargs)
            slice_id = d.get('slice_id')

            try:
                slice_id = int(
                    slice_id or json.loads(d.get('form_data')).get('slice_id'))
            except (ValueError, TypeError):
                slice_id = 0

            params = ''
            try:
                params = json.dumps(d)
            except Exception:
                pass
            stats_logger.incr(f.__name__)
            value = f(*args, **kwargs)
            sesh = db.session()
            log = cls(
                action=f.__name__,
                json=params,
                dashboard_id=d.get('dashboard_id'),
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


class DatasourceAccessRequest(Model, AuditMixinNullable):
    """ORM model for the access requests for datasources and dbs."""
    __tablename__ = 'access_request'
    id = Column(Integer, primary_key=True)

    datasource_id = Column(Integer)
    datasource_type = Column(String(200))

    ROLES_BLACKLIST = set(config.get('ROBOT_PERMISSION_ROLES', []))

    @property
    def cls_model(self):
        return ConnectorRegistry.sources[self.datasource_type]

    @property
    def username(self):
        return self.creator()

    @property
    def datasource(self):
        return self.get_datasource

    @datasource.getter
    @utils.memoized
    def get_datasource(self):
        # pylint: disable=no-member
        ds = db.session.query(self.cls_model).filter_by(
            id=self.datasource_id).first()
        return ds

    @property
    def datasource_link(self):
        return self.datasource.link  # pylint: disable=no-member

    @property
    def roles_with_datasource(self):
        action_list = ''
        perm = self.datasource.perm  # pylint: disable=no-member
        pv = sm.find_permission_view_menu('datasource_access', perm)
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
        for r in self.created_by.roles:  # pylint: disable=no-member
            url = (
                '/superset/approve?datasource_type={self.datasource_type}&'
                'datasource_id={self.datasource_id}&'
                'created_by={self.created_by.username}&role_to_extend={r.name}'
                .format(**locals())
            )
            href = '<a href="{}">Extend {} Role</a>'.format(url, r.name)
            if r.name in self.ROLES_BLACKLIST:
                href = '{} Role'.format(r.name)
            action_list = action_list + '<li>' + href + '</li>'
        return '<ul>' + action_list + '</ul>'
