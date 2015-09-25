from datetime import timedelta
from dateutil.parser import parse
from flask import flash
from flask.ext.appbuilder import Model
from flask.ext.appbuilder.models.mixins import AuditMixin
from pandas import read_sql_query
from pydruid import client
from pydruid.utils.filters import Dimension, Filter
from sqlalchemy import (
    Column, Integer, String, ForeignKey, Text, Boolean, DateTime)
from sqlalchemy import Table as sqlaTable
from sqlalchemy import create_engine, MetaData, desc, select, and_, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import table, literal_column, text
from flask import request

from copy import deepcopy, copy
from collections import namedtuple
from datetime import datetime
import json
import sqlparse
import requests
import textwrap

from panoramix import app, db, get_session, utils
from panoramix.viz import viz_types
from sqlalchemy.ext.declarative import declared_attr

config = app.config

QueryResult = namedtuple('namedtuple', ['df', 'query', 'duration'])


class AuditMixinNullable(AuditMixin):
    @declared_attr
    def created_by_fk(cls):
        return Column(Integer, ForeignKey('ab_user.id'),
                      default=cls.get_user_id, nullable=True)
    @declared_attr
    def changed_by_fk(cls):
        return Column(Integer, ForeignKey('ab_user.id'),
            default=cls.get_user_id, onupdate=cls.get_user_id, nullable=True)


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

    table = relationship(
        'Table', foreign_keys=[table_id], backref='slices')
    druid_datasource = relationship(
        'Datasource', foreign_keys=[druid_datasource_id], backref='slices')

    def __repr__(self):
        return self.slice_name

    @property
    def datasource(self):
        return self.table or self.druid_datasource

    @property
    @utils.memoized
    def viz(self):
        d = json.loads(self.params)
        viz = viz_types[self.viz_type](
            self.datasource,
            form_data=d)
        return viz

    @property
    def datasource_id(self):
        datasource = self.datasource
        return datasource.id if datasource else None

    @property
    def slice_url(self):
        try:
            d = json.loads(self.params)
        except Exception as e:
            d = {}
        from werkzeug.urls import Href
        href = Href(
            "/panoramix/datasource/{self.datasource_type}/"
            "{self.datasource_id}/".format(self=self))
        return href(d)

    @property
    def edit_url(self):
        return "/slicemodelview/edit/{}".format(self.id)

    @property
    def slice_link(self):
        url = self.slice_url
        return '<a href="{url}">{self.slice_name}</a>'.format(**locals())

    @property
    def js_files(self):
        from panoramix.viz import viz_types
        return viz_types[self.viz_type].js_files

    @property
    def css_files(self):
        from panoramix.viz import viz_types
        return viz_types[self.viz_type].css_files

    def get_viz(self):
        pass


dashboard_slices = Table('dashboard_slices', Model.metadata,
    Column('id', Integer, primary_key=True),
    Column('dashboard_id', Integer, ForeignKey('dashboards.id')),
    Column('slice_id', Integer, ForeignKey('slices.id')),
)


class Dashboard(Model, AuditMixinNullable):
    """A dash to slash"""
    __tablename__ = 'dashboards'
    id = Column(Integer, primary_key=True)
    dashboard_title = Column(String(500))
    position_json = Column(Text)
    slices = relationship(
        'Slice', secondary=dashboard_slices, backref='dashboards')

    def __repr__(self):
        return self.dashboard_title

    @property
    def url(self):
        return "/panoramix/dashboard/{}/".format(self.id)

    def dashboard_link(self):
        return '<a href="{self.url}">{self.dashboard_title}</a>'.format(self=self)

    @property
    def js_files(self):
        l = []
        for o in self.slices:
            l += [f for f in o.js_files if f not in l]
        return l

    @property
    def css_files(self):
        l = []
        for o in self.slices:
            l += o.css_files
        return list(set(l))


class Queryable(object):
    @property
    def column_names(self):
        return sorted([c.column_name for c in self.columns])

    @property
    def groupby_column_names(self):
        return sorted([c.column_name for c in self.columns if c.groupby])

    @property
    def filterable_column_names(self):
        return sorted([c.column_name for c in self.columns if c.filterable])


class Database(Model, AuditMixinNullable):
    __tablename__ = 'dbs'
    id = Column(Integer, primary_key=True)
    database_name = Column(String(250), unique=True)
    sqlalchemy_uri = Column(String(1024))

    def __repr__(self):
        return self.database_name

    def get_sqla_engine(self):
        return create_engine(self.sqlalchemy_uri)

    def get_table(self, table_name):
        meta = MetaData()
        return sqlaTable(
            table_name, meta,
            autoload=True,
            autoload_with=self.get_sqla_engine())


class Table(Model, Queryable, AuditMixinNullable):
    type = "table"

    __tablename__ = 'tables'
    id = Column(Integer, primary_key=True)
    table_name = Column(String(250), unique=True)
    main_dttm_col = Column(String(250))
    default_endpoint = Column(Text)
    database_id = Column(Integer, ForeignKey('dbs.id'), nullable=False)
    database = relationship(
        'Database', backref='tables', foreign_keys=[database_id])

    baselink = "tableview"

    def __repr__(self):
        return self.table_name

    @property
    def name(self):
        return self.table_name

    @property
    def table_link(self):
        url = "/panoramix/datasource/{self.type}/{self.id}/".format(self=self)
        return '<a href="{url}">{self.table_name}</a>'.format(**locals())

    @property
    def metrics_combo(self):
        return sorted(
            [
                (m.metric_name, m.verbose_name)
                for m in self.metrics],
            key=lambda x: x[1])

    def query_bkp(
            self, groupby, metrics,
            granularity,
            from_dttm, to_dttm,
            limit_spec=None,
            filter=None,
            is_timeseries=True,
            timeseries_limit=15,
            row_limit=None,
            extras=None):
        """
        Unused, legacy way of querying by building a SQL string without
        using the sqlalchemy expression API (new approach which supports
        all dialects)
        """
        from pandas import read_sql_query
        qry_start_dttm = datetime.now()
        metrics_exprs = [
            "{} AS {}".format(m.expression, m.metric_name)
            for m in self.metrics if m.metric_name in metrics]
        from_dttm_iso = from_dttm.isoformat()
        to_dttm_iso = to_dttm.isoformat()

        if metrics:
            main_metric_expr = [
                m.expression for m in self.metrics
                if m.metric_name == metrics[0]][0]
        else:
            main_metric_expr = "COUNT(*)"

        select_exprs = []
        groupby_exprs = []

        if groupby:
            select_exprs = copy(groupby)
            groupby_exprs = [s for s in groupby]
            inner_groupby_exprs = [s for s in groupby]
        select_exprs += metrics_exprs
        if granularity != "all":
            select_exprs += ['ds as timestamp']
            groupby_exprs += ['ds']

        select_exprs = ",\n".join(select_exprs)
        groupby_exprs = ",\n".join(groupby_exprs)

        where_clause = [
            "ds >= '{from_dttm_iso}'",
            "ds < '{to_dttm_iso}'"
        ]
        for col, op, eq in filter:
            if op in ('in', 'not in'):
                l = ["'{}'".format(s) for s in eq.split(",")]
                l = ", ".join(l)
                op = op.upper()
                where_clause.append(
                    "{col} {op} ({l})".format(**locals())
                )
        where_clause = " AND\n".join(where_clause).format(**locals())
        on_clause = " AND ".join(["{g} = __{g}".format(g=g) for g in groupby])
        limiting_join = ""
        if timeseries_limit and groupby:
            inner_select = ", ".join([
                "{g} as __{g}".format(g=g) for g in inner_groupby_exprs])
            inner_groupby_exprs = ", ".join(inner_groupby_exprs)
            limiting_join = (
                "JOIN ( \n"
                "    SELECT {inner_select} \n"
                "    FROM {self.table_name} \n"
                "    WHERE \n"
                "        {where_clause}\n"
                "    GROUP BY {inner_groupby_exprs}\n"
                "    ORDER BY {main_metric_expr} DESC\n"
                "    LIMIT {timeseries_limit}\n"
                ") z ON {on_clause}\n"
            ).format(**locals())

        sql = (
            "SELECT\n"
            "    {select_exprs}\n"
            "FROM {self.table_name}\n"
            "{limiting_join}"
            "WHERE\n"
            "    {where_clause}\n"
            "GROUP BY\n"
            "    {groupby_exprs}\n"
        ).format(**locals())
        df = read_sql_query(
            sql=sql,
            con=self.database.get_sqla_engine()
        )
        textwrap.dedent(sql)

        return QueryResult(
            df=df, duration=datetime.now() - qry_start_dttm, query=sql)

    def query(
            self, groupby, metrics,
            granularity,
            from_dttm, to_dttm,
            limit_spec=None,
            filter=None,
            is_timeseries=True,
            timeseries_limit=15, row_limit=None,
            extras=None):

        qry_start_dttm = datetime.now()
        if not self.main_dttm_col:
            raise Exception(
                "Datetime column not provided as part table configuration")
        timestamp = literal_column(
            self.main_dttm_col).label('timestamp')
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
            select_exprs = [literal_column(s) for s in groupby]
            groupby_exprs = [literal_column(s) for s in groupby]
            inner_groupby_exprs = [
                literal_column(s).label('__' + s) for s in groupby]
        if granularity != "all":
            select_exprs += [timestamp]
            groupby_exprs += [timestamp]

        select_exprs += metrics_exprs
        qry = select(select_exprs)
        from_clause = table(self.table_name)
        qry = qry.group_by(*groupby_exprs)

        where_clause_and = [
            timestamp >= from_dttm.isoformat(),
            timestamp < to_dttm.isoformat(),
        ]
        for col, op, eq in filter:
            if op in ('in', 'not in'):
                values = eq.split(",")
                cond = literal_column(col).in_(values)
                if op == 'not in':
                    cond = ~cond
                where_clause_and.append(cond)
        if extras and 'where' in extras:
            where_clause_and += [text(extras['where'])]
        qry = qry.where(and_(*where_clause_and))
        qry = qry.order_by(desc(main_metric_expr))
        qry = qry.limit(row_limit)

        if timeseries_limit and groupby:
            subq = select(inner_groupby_exprs)
            subq = subq.select_from(table(self.table_name))
            subq = subq.where(and_(*where_clause_and))
            subq = subq.group_by(*inner_groupby_exprs)
            subq = subq.order_by(desc(main_metric_expr))
            subq = subq.limit(timeseries_limit)
            on_clause = []
            for gb in groupby:
                on_clause.append(
                    literal_column(gb) == literal_column("__" + gb))

            from_clause = from_clause.join(subq.alias(), and_(*on_clause))

        qry = qry.select_from(from_clause)

        engine = self.database.get_sqla_engine()
        sql = str(qry.compile(engine, compile_kwargs={"literal_binds": True}))
        df = read_sql_query(
            sql=sql,
            con=engine
        )
        sql = sqlparse.format(sql, reindent=True)
        return QueryResult(
            df=df, duration=datetime.now() - qry_start_dttm, query=sql)

    def fetch_metadata(self):
        table = self.database.get_table(self.table_name)
        try:
            table = self.database.get_table(self.table_name)
        except Exception as e:
            flash(str(e))
            flash(
                "Table doesn't seem to exist in the specified database, "
                "couldn't fetch column information", "danger")
            return

        TC = TableColumn
        M = SqlMetric
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

                if (
                        str(datatype).startswith('VARCHAR') or
                        str(datatype).startswith('STRING')):
                    dbcol.groupby = True
                    dbcol.filterable = True
                elif str(datatype).upper() in ('DOUBLE', 'FLOAT', 'INT', 'BIGINT'):
                    dbcol.sum = True
            db.session.merge(self)
            self.columns.append(dbcol)

            if not any_date_col and 'date' in datatype.lower():
                any_date_col = col.name

            if dbcol.sum:
                metrics.append(M(
                    metric_name='sum__' + dbcol.column_name,
                    verbose_name='sum__' + dbcol.column_name,
                    metric_type='sum',
                    expression="SUM({})".format(dbcol.column_name)
                ))
            if dbcol.max:
                metrics.append(M(
                    metric_name='max__' + dbcol.column_name,
                    verbose_name='max__' + dbcol.column_name,
                    metric_type='max',
                    expression="MAX({})".format(dbcol.column_name)
                ))
            if dbcol.min:
                metrics.append(M(
                    metric_name='min__' + dbcol.column_name,
                    verbose_name='min__' + dbcol.column_name,
                    metric_type='min',
                    expression="MIN({})".format(dbcol.column_name)
                ))
            if dbcol.count_distinct:
                metrics.append(M(
                    metric_name='count_distinct__' + dbcol.column_name,
                    verbose_name='count_distinct__' + dbcol.column_name,
                    metric_type='count_distinct',
                    expression="COUNT(DISTINCT {})".format(dbcol.column_name)
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
    __tablename__ = 'sql_metrics'
    id = Column(Integer, primary_key=True)
    metric_name = Column(String(512))
    verbose_name = Column(String(1024))
    metric_type = Column(String(32))
    table_id = Column(Integer, ForeignKey('tables.id'))
    table = relationship(
        'Table', backref='metrics', foreign_keys=[table_id])
    expression = Column(Text)
    description = Column(Text)


class TableColumn(Model, AuditMixinNullable):
    __tablename__ = 'table_columns'
    id = Column(Integer, primary_key=True)
    table_id = Column(Integer, ForeignKey('tables.id'))
    table = relationship('Table', backref='columns', foreign_keys=[table_id])
    column_name = Column(String(256))
    is_dttm = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)
    type = Column(String(32), default='')
    groupby = Column(Boolean, default=False)
    count_distinct = Column(Boolean, default=False)
    sum = Column(Boolean, default=False)
    max = Column(Boolean, default=False)
    min = Column(Boolean, default=False)
    filterable = Column(Boolean, default=False)
    description = Column(Text, default='')

    def __repr__(self):
        return self.column_name

    @property
    def isnum(self):
        return self.type in ('LONG', 'DOUBLE', 'FLOAT')


class Cluster(Model, AuditMixinNullable):
    __tablename__ = 'clusters'
    id = Column(Integer, primary_key=True)
    cluster_name = Column(String(250), unique=True)
    coordinator_host = Column(String(256))
    coordinator_port = Column(Integer)
    coordinator_endpoint = Column(String(256))
    broker_host = Column(String(256))
    broker_port = Column(Integer)
    broker_endpoint = Column(String(256))
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
            "http://{self.coordinator_host}:{self.coordinator_port}/"
            "{self.coordinator_endpoint}/datasources"
        ).format(self=self)

        datasources = json.loads(requests.get(endpoint).text)
        for datasource in datasources:
            Datasource.sync_to_db(datasource, self)


class Datasource(Model, AuditMixin, Queryable):
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
        'Cluster', backref='datasources', foreign_keys=[cluster_name])

    @property
    def metrics_combo(self):
        return sorted(
            [(m.metric_name, m.verbose_name) for m in self.metrics],
            key=lambda x: x[1])

    @property
    def name(self):
        return self.datasource_name

    def __repr__(self):
        return self.datasource_name

    @property
    def datasource_link(self):
        url = (
            "/panoramix/datasource/"
            "{self.type}/{self.id}/").format(self=self)
        return '<a href="{url}">{self.datasource_name}</a>'.format(**locals())

    def get_metric_obj(self, metric_name):
        return [
            m.json_obj for m in self.metrics
            if m.metric_name == metric_name
        ][0]

    def latest_metadata(self):
        client = self.cluster.get_pydruid_client()
        results = client.time_boundary(datasource=self.datasource_name)
        if not results:
            return
        max_time = results[0]['result']['minTime']
        max_time = parse(max_time)
        intervals = (max_time - timedelta(seconds=1)).isoformat() + '/'
        intervals += (max_time + timedelta(seconds=1)).isoformat()
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
        session = get_session()
        datasource = session.query(cls).filter_by(datasource_name=name).first()
        if not datasource:
            datasource = cls(datasource_name=name)
            session.add(datasource)
        datasource.cluster = cluster

        cols = datasource.latest_metadata()
        if not cols:
            return
        for col in cols:
            col_obj = (
                session
                .query(Column)
                .filter_by(datasource_name=name, column_name=col)
                .first()
            )
            datatype = cols[col]['type']
            if not col_obj:
                col_obj = Column(datasource_name=name, column_name=col)
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
            limit_spec=None,
            filter=None,
            is_timeseries=True,
            timeseries_limit=None,
            row_limit=None,
            extras=None):
        qry_start_dttm = datetime.now()

        # add tzinfo to native datetime with config
        from_dttm = from_dttm.replace(tzinfo=config.get("DRUID_TZ"))
        to_dttm = to_dttm.replace(tzinfo=config.get("DRUID_TZ"))

        query_str = ""
        aggregations = {
            m.metric_name: m.json_obj
            for m in self.metrics if m.metric_name in metrics
        }
        if not isinstance(granularity, basestring):
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
                for index, row in df.iterrows():
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
        return QueryResult(
            df=df,
            query=query_str,
            duration=datetime.now() - qry_start_dttm)


class Metric(Model):
    __tablename__ = 'metrics'
    id = Column(Integer, primary_key=True)
    metric_name = Column(String(512))
    verbose_name = Column(String(1024))
    metric_type = Column(String(32))
    datasource_name = Column(
        String(250),
        ForeignKey('datasources.datasource_name'))
    datasource = relationship('Datasource', backref='metrics')
    json = Column(Text)
    description = Column(Text)

    @property
    def json_obj(self):
        try:
            obj = json.loads(self.json)
        except:
            obj = {}
        return obj


class Column(Model, AuditMixinNullable):
    __tablename__ = 'columns'
    id = Column(Integer, primary_key=True)
    datasource_name = Column(
        String(250),
        ForeignKey('datasources.datasource_name'))
    datasource = relationship('Datasource', backref='columns')
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
        M = Metric
        metrics = []
        metrics.append(Metric(
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
            metrics.append(Metric(
                metric_name=name,
                metric_type='sum',
                verbose_name='SUM({})'.format(self.column_name),
                json=json.dumps({
                    'type': mt, 'name': name, 'fieldName': self.column_name})
            ))
        if self.min and self.isnum:
            mt = corrected_type.lower() + 'Min'
            name = 'min__' + self.column_name
            metrics.append(Metric(
                metric_name=name,
                metric_type='min',
                verbose_name='MIN({})'.format(self.column_name),
                json=json.dumps({
                    'type': mt, 'name': name, 'fieldName': self.column_name})
            ))
        if self.max and self.isnum:
            mt = corrected_type.lower() + 'Max'
            name = 'max__' + self.column_name
            metrics.append(Metric(
                metric_name=name,
                metric_type='max',
                verbose_name='MAX({})'.format(self.column_name),
                json=json.dumps({
                    'type': mt, 'name': name, 'fieldName': self.column_name})
            ))
        if self.count_distinct:
            mt = 'count_distinct'
            name = 'count_distinct__' + self.column_name
            metrics.append(Metric(
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
                .filter(Cluster.cluster_name == self.datasource.cluster_name)
                .first()
            )
            metric.datasource_name = self.datasource_name
            if not m:
                session.add(metric)
                session.commit()
