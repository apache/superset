# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
# pylint: disable=C,R,W
from collections import namedtuple, OrderedDict
from datetime import datetime
import logging

from flask import escape, Markup
from flask_appbuilder import Model
from flask_babel import lazy_gettext as _
import pandas as pd
import sqlalchemy as sa
from sqlalchemy import (
    and_, asc, Boolean, Column, DateTime, desc, ForeignKey, Integer, or_,
    select, String, Table, Text,
)
from sqlalchemy.exc import CompileError
from sqlalchemy.orm import backref, relationship
from sqlalchemy.schema import UniqueConstraint
from sqlalchemy.sql import column, literal_column, table, text
from sqlalchemy.sql.expression import TextAsFrom
import sqlparse

from superset import app, db, security_manager
from superset.connectors.base.models import BaseColumn, BaseDatasource, BaseMetric
from superset.jinja_context import get_template_processor
from superset.models.annotations import Annotation
from superset.models.core import Database
from superset.models.helpers import QueryResult
from superset.utils import core as utils, import_datasource

config = app.config
metadata = Model.metadata  # pylint: disable=no-member

SqlaQuery = namedtuple('SqlaQuery', ['sqla_query', 'labels_expected'])
QueryStringExtended = namedtuple('QueryStringExtended', ['sql', 'labels_expected'])


class AnnotationDatasource(BaseDatasource):
    """ Dummy object so we can query annotations using 'Viz' objects just like
        regular datasources.
    """

    cache_timeout = 0

    def query(self, query_obj):
        df = None
        error_message = None
        qry = db.session.query(Annotation)
        qry = qry.filter(Annotation.layer_id == query_obj['filter'][0]['val'])
        if query_obj['from_dttm']:
            qry = qry.filter(Annotation.start_dttm >= query_obj['from_dttm'])
        if query_obj['to_dttm']:
            qry = qry.filter(Annotation.end_dttm <= query_obj['to_dttm'])
        status = utils.QueryStatus.SUCCESS
        try:
            df = pd.read_sql_query(qry.statement, db.engine)
        except Exception as e:
            status = utils.QueryStatus.FAILED
            logging.exception(e)
            error_message = (
                utils.error_msg_from_exception(e))
        return QueryResult(
            status=status,
            df=df,
            duration=0,
            query='',
            error_message=error_message)

    def get_query_str(self, query_obj):
        raise NotImplementedError()

    def values_for_column(self, column_name, limit=10000):
        raise NotImplementedError()


class TableColumn(Model, BaseColumn):

    """ORM object for table columns, each table can have multiple columns"""

    __tablename__ = 'table_columns'
    __table_args__ = (UniqueConstraint('table_id', 'column_name'),)
    table_id = Column(Integer, ForeignKey('tables.id'))
    table = relationship(
        'SqlaTable',
        backref=backref('columns', cascade='all, delete-orphan'),
        foreign_keys=[table_id])
    is_dttm = Column(Boolean, default=False)
    expression = Column(Text)
    python_date_format = Column(String(255))
    database_expression = Column(String(255))

    export_fields = (
        'table_id', 'column_name', 'verbose_name', 'is_dttm', 'is_active',
        'type', 'groupby',
        'filterable', 'expression', 'description', 'python_date_format',
        'database_expression',
    )

    update_from_object_fields = [
        s for s in export_fields if s not in ('table_id',)]
    export_parent = 'table'

    def get_sqla_col(self, label=None):
        label = label or self.column_name
        if not self.expression:
            db_engine_spec = self.table.database.db_engine_spec
            type_ = db_engine_spec.get_sqla_column_type(self.type)
            col = column(self.column_name, type_=type_)
        else:
            col = literal_column(self.expression)
        col = self.table.make_sqla_column_compatible(col, label)
        return col

    @property
    def datasource(self):
        return self.table

    def get_time_filter(self, start_dttm, end_dttm):
        is_epoch_in_utc = config.get('IS_EPOCH_S_TRULY_UTC', False)
        col = self.get_sqla_col(label='__time')
        l = []  # noqa: E741
        if start_dttm:
            l.append(col >= text(self.dttm_sql_literal(start_dttm, is_epoch_in_utc)))
        if end_dttm:
            l.append(col <= text(self.dttm_sql_literal(end_dttm, is_epoch_in_utc)))
        return and_(*l)

    def get_timestamp_expression(self, time_grain):
        """Getting the time component of the query"""
        label = utils.DTTM_ALIAS

        db = self.table.database
        pdf = self.python_date_format
        is_epoch = pdf in ('epoch_s', 'epoch_ms')
        if not self.expression and not time_grain and not is_epoch:
            sqla_col = column(self.column_name, type_=DateTime)
            return self.table.make_sqla_column_compatible(sqla_col, label)
        grain = None
        if time_grain:
            grain = db.grains_dict().get(time_grain)
            if not grain:
                raise NotImplementedError(
                    f'No grain spec for {time_grain} for database {db.database_name}')
        col = db.db_engine_spec.get_timestamp_column(self.expression, self.column_name)
        expr = db.db_engine_spec.get_time_expr(col, pdf, time_grain, grain)
        sqla_col = literal_column(expr, type_=DateTime)
        return self.table.make_sqla_column_compatible(sqla_col, label)

    @classmethod
    def import_obj(cls, i_column):
        def lookup_obj(lookup_column):
            return db.session.query(TableColumn).filter(
                TableColumn.table_id == lookup_column.table_id,
                TableColumn.column_name == lookup_column.column_name).first()
        return import_datasource.import_simple_obj(db.session, i_column, lookup_obj)

    def dttm_sql_literal(self, dttm, is_epoch_in_utc):
        """Convert datetime object to a SQL expression string

        If database_expression is empty, the internal dttm
        will be parsed as the string with the pattern that
        the user inputted (python_date_format)
        If database_expression is not empty, the internal dttm
        will be parsed as the sql sentence for the database to convert
        """
        tf = self.python_date_format
        if self.database_expression:
            return self.database_expression.format(dttm.strftime('%Y-%m-%d %H:%M:%S'))
        elif tf:
            if is_epoch_in_utc:
                seconds_since_epoch = dttm.timestamp()
            else:
                seconds_since_epoch = (dttm - datetime(1970, 1, 1)).total_seconds()
            seconds_since_epoch = int(seconds_since_epoch)
            if tf == 'epoch_s':
                return str(seconds_since_epoch)
            elif tf == 'epoch_ms':
                return str(seconds_since_epoch * 1000)
            return "'{}'".format(dttm.strftime(tf))
        else:
            s = self.table.database.db_engine_spec.convert_dttm(
                self.type or '', dttm)
            return s or "'{}'".format(dttm.strftime('%Y-%m-%d %H:%M:%S.%f'))


class SqlMetric(Model, BaseMetric):

    """ORM object for metrics, each table can have multiple metrics"""

    __tablename__ = 'sql_metrics'
    __table_args__ = (UniqueConstraint('table_id', 'metric_name'),)
    table_id = Column(Integer, ForeignKey('tables.id'))
    table = relationship(
        'SqlaTable',
        backref=backref('metrics', cascade='all, delete-orphan'),
        foreign_keys=[table_id])
    expression = Column(Text, nullable=False)

    export_fields = (
        'metric_name', 'verbose_name', 'metric_type', 'table_id', 'expression',
        'description', 'is_restricted', 'd3format', 'warning_text')
    update_from_object_fields = list([
        s for s in export_fields if s not in ('table_id', )])
    export_parent = 'table'

    def get_sqla_col(self, label=None):
        label = label or self.metric_name
        sqla_col = literal_column(self.expression)
        return self.table.make_sqla_column_compatible(sqla_col, label)

    @property
    def perm(self):
        return (
            '{parent_name}.[{obj.metric_name}](id:{obj.id})'
        ).format(obj=self,
                 parent_name=self.table.full_name) if self.table else None

    def get_perm(self):
        return self.perm

    @classmethod
    def import_obj(cls, i_metric):
        def lookup_obj(lookup_metric):
            return db.session.query(SqlMetric).filter(
                SqlMetric.table_id == lookup_metric.table_id,
                SqlMetric.metric_name == lookup_metric.metric_name).first()
        return import_datasource.import_simple_obj(db.session, i_metric, lookup_obj)


sqlatable_user = Table(
    'sqlatable_user', metadata,
    Column('id', Integer, primary_key=True),
    Column('user_id', Integer, ForeignKey('ab_user.id')),
    Column('table_id', Integer, ForeignKey('tables.id')),
)


class SqlaTable(Model, BaseDatasource):

    """An ORM object for SqlAlchemy table references"""

    type = 'table'
    query_language = 'sql'
    metric_class = SqlMetric
    column_class = TableColumn
    owner_class = security_manager.user_model

    __tablename__ = 'tables'
    __table_args__ = (UniqueConstraint('database_id', 'table_name'),)

    table_name = Column(String(250))
    main_dttm_col = Column(String(250))
    database_id = Column(Integer, ForeignKey('dbs.id'), nullable=False)
    fetch_values_predicate = Column(String(1000))
    owners = relationship(owner_class, secondary=sqlatable_user, backref='tables')
    database = relationship(
        'Database',
        backref=backref('tables', cascade='all, delete-orphan'),
        foreign_keys=[database_id])
    schema = Column(String(255))
    sql = Column(Text)
    is_sqllab_view = Column(Boolean, default=False)
    template_params = Column(Text)

    baselink = 'tablemodelview'

    export_fields = (
        'table_name', 'main_dttm_col', 'description', 'default_endpoint',
        'database_id', 'offset', 'cache_timeout', 'schema',
        'sql', 'params', 'template_params', 'filter_select_enabled',
        'fetch_values_predicate',
    )
    update_from_object_fields = [
        f for f in export_fields if f not in ('table_name', 'database_id')]
    export_parent = 'database'
    export_children = ['metrics', 'columns']

    sqla_aggregations = {
        'COUNT_DISTINCT': lambda column_name: sa.func.COUNT(sa.distinct(column_name)),
        'COUNT': sa.func.COUNT,
        'SUM': sa.func.SUM,
        'AVG': sa.func.AVG,
        'MIN': sa.func.MIN,
        'MAX': sa.func.MAX,
    }

    def make_sqla_column_compatible(self, sqla_col, label=None):
        """Takes a sql alchemy column object and adds label info if supported by engine.
        :param sqla_col: sql alchemy column instance
        :param label: alias/label that column is expected to have
        :return: either a sql alchemy column or label instance if supported by engine
        """
        label_expected = label or sqla_col.name
        db_engine_spec = self.database.db_engine_spec
        if db_engine_spec.supports_column_aliases:
            label = db_engine_spec.make_label_compatible(label_expected)
            sqla_col = sqla_col.label(label)
        sqla_col._df_label_expected = label_expected
        return sqla_col

    def __repr__(self):
        return self.name

    @property
    def connection(self):
        return str(self.database)

    @property
    def description_markeddown(self):
        return utils.markdown(self.description)

    @property
    def datasource_name(self):
        return self.table_name

    @property
    def database_name(self):
        return self.database.name

    @property
    def link(self):
        name = escape(self.name)
        anchor = f'<a target="_blank" href="{self.explore_url}">{name}</a>'
        return Markup(anchor)

    @property
    def schema_perm(self):
        """Returns schema permission if present, database one otherwise."""
        return security_manager.get_schema_perm(self.database, self.schema)

    def get_perm(self):
        return (
            '[{obj.database}].[{obj.table_name}]'
            '(id:{obj.id})').format(obj=self)

    @property
    def name(self):
        if not self.schema:
            return self.table_name
        return '{}.{}'.format(self.schema, self.table_name)

    @property
    def full_name(self):
        return utils.get_datasource_full_name(
            self.database, self.table_name, schema=self.schema)

    @property
    def dttm_cols(self):
        l = [c.column_name for c in self.columns if c.is_dttm]  # noqa: E741
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
                'dataframe table table-striped table-bordered '
                'table-condensed'))

    @property
    def sql_url(self):
        return self.database.sql_url + '?table_name=' + str(self.table_name)

    def external_metadata(self):
        cols = self.database.get_columns(self.table_name, schema=self.schema)
        for col in cols:
            try:
                col['type'] = str(col['type'])
            except CompileError:
                col['type'] = 'UNKNOWN'
        return cols

    @property
    def time_column_grains(self):
        return {
            'time_columns': self.dttm_cols,
            'time_grains': [grain.name for grain in self.database.grains()],
        }

    @property
    def select_star(self):
        # show_cols and latest_partition set to false to avoid
        # the expensive cost of inspecting the DB
        return self.database.select_star(
            self.name, show_cols=False, latest_partition=False)

    def get_col(self, col_name):
        columns = self.columns
        for col in columns:
            if col_name == col.column_name:
                return col

    @property
    def data(self):
        d = super(SqlaTable, self).data
        if self.type == 'table':
            grains = self.database.grains() or []
            if grains:
                grains = [(g.duration, g.name) for g in grains]
            d['granularity_sqla'] = utils.choicify(self.dttm_cols)
            d['time_grain_sqla'] = grains
            d['main_dttm_col'] = self.main_dttm_col
            d['fetch_values_predicate'] = self.fetch_values_predicate
            d['template_params'] = self.template_params
        return d

    def values_for_column(self, column_name, limit=10000):
        """Runs query against sqla to retrieve some
        sample values for the given column.
        """
        cols = {col.column_name: col for col in self.columns}
        target_col = cols[column_name]
        tp = self.get_template_processor()

        qry = (
            select([target_col.get_sqla_col()])
            .select_from(self.get_from_clause(tp))
            .distinct()
        )
        if limit:
            qry = qry.limit(limit)

        if self.fetch_values_predicate:
            tp = self.get_template_processor()
            qry = qry.where(tp.process_template(self.fetch_values_predicate))

        engine = self.database.get_sqla_engine()
        sql = '{}'.format(
            qry.compile(engine, compile_kwargs={'literal_binds': True}),
        )
        sql = self.mutate_query_from_config(sql)

        df = pd.read_sql_query(sql=sql, con=engine)
        return [row[0] for row in df.to_records(index=False)]

    def mutate_query_from_config(self, sql):
        """Apply config's SQL_QUERY_MUTATOR

        Typically adds comments to the query with context"""
        SQL_QUERY_MUTATOR = config.get('SQL_QUERY_MUTATOR')
        if SQL_QUERY_MUTATOR:
            username = utils.get_username()
            sql = SQL_QUERY_MUTATOR(sql, username, security_manager, self.database)
        return sql

    def get_template_processor(self, **kwargs):
        return get_template_processor(
            table=self, database=self.database, **kwargs)

    def get_query_str_extended(self, query_obj):
        sqlaq = self.get_sqla_query(**query_obj)
        sql = self.database.compile_sqla_query(sqlaq.sqla_query)
        logging.info(sql)
        sql = sqlparse.format(sql, reindent=True)
        if query_obj['is_prequery']:
            query_obj['prequeries'].append(sql)
        sql = self.mutate_query_from_config(sql)
        return QueryStringExtended(labels_expected=sqlaq.labels_expected, sql=sql)

    def get_query_str(self, query_obj):
        return self.get_query_str_extended(query_obj).sql

    def get_sqla_table(self):
        tbl = table(self.table_name)
        if self.schema:
            tbl.schema = self.schema
        return tbl

    def get_from_clause(self, template_processor=None):
        # Supporting arbitrary SQL statements in place of tables
        if self.sql:
            from_sql = self.sql
            if template_processor:
                from_sql = template_processor.process_template(from_sql)
            from_sql = sqlparse.format(from_sql, strip_comments=True)
            return TextAsFrom(sa.text(from_sql), []).alias('expr_qry')
        return self.get_sqla_table()

    def adhoc_metric_to_sqla(self, metric, cols):
        """
        Turn an adhoc metric into a sqlalchemy column.

        :param dict metric: Adhoc metric definition
        :param dict cols: Columns for the current table
        :returns: The metric defined as a sqlalchemy column
        :rtype: sqlalchemy.sql.column
        """
        expression_type = metric.get('expressionType')
        label = utils.get_metric_name(metric)

        if expression_type == utils.ADHOC_METRIC_EXPRESSION_TYPES['SIMPLE']:
            column_name = metric.get('column').get('column_name')
            table_column = cols.get(column_name)
            if table_column:
                sqla_column = table_column.get_sqla_col()
            else:
                sqla_column = column(column_name)
            sqla_metric = self.sqla_aggregations[metric.get('aggregate')](sqla_column)
        elif expression_type == utils.ADHOC_METRIC_EXPRESSION_TYPES['SQL']:
            sqla_metric = literal_column(metric.get('sqlExpression'))
        else:
            return None

        return self.make_sqla_column_compatible(sqla_metric, label)

    def get_sqla_query(  # sqla
            self,
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
            columns=None,
            order_desc=True,
            prequeries=None,
            is_prequery=False,
    ):
        """Querying any sqla table from this common interface"""
        template_kwargs = {
            'from_dttm': from_dttm,
            'groupby': groupby,
            'metrics': metrics,
            'row_limit': row_limit,
            'to_dttm': to_dttm,
            'filter': filter,
            'columns': {col.column_name: col for col in self.columns},
        }
        template_kwargs.update(self.template_params_dict)
        template_processor = self.get_template_processor(**template_kwargs)
        db_engine_spec = self.database.db_engine_spec

        orderby = orderby or []

        # For backward compatibility
        if granularity not in self.dttm_cols:
            granularity = self.main_dttm_col

        # Database spec supports join-free timeslot grouping
        time_groupby_inline = db_engine_spec.time_groupby_inline

        cols = {col.column_name: col for col in self.columns}
        metrics_dict = {m.metric_name: m for m in self.metrics}

        if not granularity and is_timeseries:
            raise Exception(_(
                'Datetime column not provided as part table configuration '
                'and is required by this type of chart'))
        if not groupby and not metrics and not columns:
            raise Exception(_('Empty query?'))
        metrics_exprs = []
        for m in metrics:
            if utils.is_adhoc_metric(m):
                metrics_exprs.append(self.adhoc_metric_to_sqla(m, cols))
            elif m in metrics_dict:
                metrics_exprs.append(metrics_dict.get(m).get_sqla_col())
            else:
                raise Exception(_("Metric '{}' is not valid".format(m)))
        if metrics_exprs:
            main_metric_expr = metrics_exprs[0]
        else:
            main_metric_expr, label = literal_column('COUNT(*)'), 'ccount'
            main_metric_expr = self.make_sqla_column_compatible(main_metric_expr, label)

        select_exprs = []
        groupby_exprs_sans_timestamp = OrderedDict()

        if groupby:
            select_exprs = []
            for s in groupby:
                if s in cols:
                    outer = cols[s].get_sqla_col()
                else:
                    outer = literal_column(f'({s})')
                    outer = self.make_sqla_column_compatible(outer, s)

                groupby_exprs_sans_timestamp[outer.name] = outer
                select_exprs.append(outer)
        elif columns:
            for s in columns:
                select_exprs.append(
                    cols[s].get_sqla_col() if s in cols else
                    self.make_sqla_column_compatible(literal_column(s)))
            metrics_exprs = []

        groupby_exprs_with_timestamp = OrderedDict(groupby_exprs_sans_timestamp.items())
        if granularity:
            dttm_col = cols[granularity]
            time_grain = extras.get('time_grain_sqla')
            time_filters = []

            if is_timeseries:
                timestamp = dttm_col.get_timestamp_expression(time_grain)
                select_exprs += [timestamp]
                groupby_exprs_with_timestamp[timestamp.name] = timestamp

            # Use main dttm column to support index with secondary dttm columns
            if db_engine_spec.time_secondary_columns and \
                    self.main_dttm_col in self.dttm_cols and \
                    self.main_dttm_col != dttm_col.column_name:
                time_filters.append(cols[self.main_dttm_col].
                                    get_time_filter(from_dttm, to_dttm))
            time_filters.append(dttm_col.get_time_filter(from_dttm, to_dttm))

        select_exprs += metrics_exprs

        labels_expected = [c._df_label_expected for c in select_exprs]

        select_exprs = db_engine_spec.make_select_compatible(
            groupby_exprs_with_timestamp.values(),
            select_exprs)
        qry = sa.select(select_exprs)

        tbl = self.get_from_clause(template_processor)

        if not columns:
            qry = qry.group_by(*groupby_exprs_with_timestamp.values())

        where_clause_and = []
        having_clause_and = []
        for flt in filter:
            if not all([flt.get(s) for s in ['col', 'op']]):
                continue
            col = flt['col']
            op = flt['op']
            col_obj = cols.get(col)
            if col_obj:
                is_list_target = op in ('in', 'not in')
                eq = self.filter_values_handler(
                    flt.get('val'),
                    target_column_is_numeric=col_obj.is_num,
                    is_list_target=is_list_target)
                if op in ('in', 'not in'):
                    cond = col_obj.get_sqla_col().in_(eq)
                    if '<NULL>' in eq:
                        cond = or_(cond, col_obj.get_sqla_col() == None)  # noqa
                    if op == 'not in':
                        cond = ~cond
                    where_clause_and.append(cond)
                else:
                    if col_obj.is_num:
                        eq = utils.string_to_num(flt['val'])
                    if op == '==':
                        where_clause_and.append(col_obj.get_sqla_col() == eq)
                    elif op == '!=':
                        where_clause_and.append(col_obj.get_sqla_col() != eq)
                    elif op == '>':
                        where_clause_and.append(col_obj.get_sqla_col() > eq)
                    elif op == '<':
                        where_clause_and.append(col_obj.get_sqla_col() < eq)
                    elif op == '>=':
                        where_clause_and.append(col_obj.get_sqla_col() >= eq)
                    elif op == '<=':
                        where_clause_and.append(col_obj.get_sqla_col() <= eq)
                    elif op == 'LIKE':
                        where_clause_and.append(col_obj.get_sqla_col().like(eq))
                    elif op == 'IS NULL':
                        where_clause_and.append(col_obj.get_sqla_col() == None)  # noqa
                    elif op == 'IS NOT NULL':
                        where_clause_and.append(
                            col_obj.get_sqla_col() != None)  # noqa
        if extras:
            where = extras.get('where')
            if where:
                where = template_processor.process_template(where)
                where_clause_and += [sa.text('({})'.format(where))]
            having = extras.get('having')
            if having:
                having = template_processor.process_template(having)
                having_clause_and += [sa.text('({})'.format(having))]
        if granularity:
            qry = qry.where(and_(*(time_filters + where_clause_and)))
        else:
            qry = qry.where(and_(*where_clause_and))
        qry = qry.having(and_(*having_clause_and))

        if not orderby and not columns:
            orderby = [(main_metric_expr, not order_desc)]

        for col, ascending in orderby:
            direction = asc if ascending else desc
            if utils.is_adhoc_metric(col):
                col = self.adhoc_metric_to_sqla(col, cols)
            qry = qry.order_by(direction(col))

        if row_limit:
            qry = qry.limit(row_limit)

        if is_timeseries and \
                timeseries_limit and groupby and not time_groupby_inline:
            if self.database.db_engine_spec.inner_joins:
                # some sql dialects require for order by expressions
                # to also be in the select clause -- others, e.g. vertica,
                # require a unique inner alias
                inner_main_metric_expr = self.make_sqla_column_compatible(
                    main_metric_expr, 'mme_inner__')
                inner_groupby_exprs = []
                inner_select_exprs = []
                for gby_name, gby_obj in groupby_exprs_sans_timestamp.items():
                    inner = self.make_sqla_column_compatible(gby_obj, gby_name + '__')
                    inner_groupby_exprs.append(inner)
                    inner_select_exprs.append(inner)

                inner_select_exprs += [inner_main_metric_expr]
                subq = select(inner_select_exprs).select_from(tbl)
                inner_time_filter = dttm_col.get_time_filter(
                    inner_from_dttm or from_dttm,
                    inner_to_dttm or to_dttm,
                )
                subq = subq.where(and_(*(where_clause_and + [inner_time_filter])))
                subq = subq.group_by(*inner_groupby_exprs)

                ob = inner_main_metric_expr
                if timeseries_limit_metric:
                    ob = self._get_timeseries_orderby(
                        timeseries_limit_metric,
                        metrics_dict,
                        cols,
                    )
                direction = desc if order_desc else asc
                subq = subq.order_by(direction(ob))
                subq = subq.limit(timeseries_limit)

                on_clause = []
                for gby_name, gby_obj in groupby_exprs_sans_timestamp.items():
                    # in this case the column name, not the alias, needs to be
                    # conditionally mutated, as it refers to the column alias in
                    # the inner query
                    col_name = db_engine_spec.make_label_compatible(gby_name + '__')
                    on_clause.append(gby_obj == column(col_name))

                tbl = tbl.join(subq.alias(), and_(*on_clause))
            else:
                if timeseries_limit_metric:
                    orderby = [(
                        self._get_timeseries_orderby(
                            timeseries_limit_metric,
                            metrics_dict,
                            cols,
                        ),
                        False,
                    )]

                # run subquery to get top groups
                subquery_obj = {
                    'prequeries': prequeries,
                    'is_prequery': True,
                    'is_timeseries': False,
                    'row_limit': timeseries_limit,
                    'groupby': groupby,
                    'metrics': metrics,
                    'granularity': granularity,
                    'from_dttm': inner_from_dttm or from_dttm,
                    'to_dttm': inner_to_dttm or to_dttm,
                    'filter': filter,
                    'orderby': orderby,
                    'extras': extras,
                    'columns': columns,
                    'order_desc': True,
                }
                result = self.query(subquery_obj)
                dimensions = [
                    c for c in result.df.columns
                    if c not in metrics and c in groupby_exprs_sans_timestamp
                ]
                top_groups = self._get_top_groups(result.df,
                                                  dimensions,
                                                  groupby_exprs_sans_timestamp)
                qry = qry.where(top_groups)

        return SqlaQuery(sqla_query=qry.select_from(tbl),
                         labels_expected=labels_expected)

    def _get_timeseries_orderby(self, timeseries_limit_metric, metrics_dict, cols):
        if utils.is_adhoc_metric(timeseries_limit_metric):
            ob = self.adhoc_metric_to_sqla(timeseries_limit_metric, cols)
        elif timeseries_limit_metric in metrics_dict:
            timeseries_limit_metric = metrics_dict.get(
                timeseries_limit_metric,
            )
            ob = timeseries_limit_metric.get_sqla_col()
        else:
            raise Exception(_("Metric '{}' is not valid".format(timeseries_limit_metric)))

        return ob

    def _get_top_groups(self, df, dimensions, groupby_exprs):
        groups = []
        for unused, row in df.iterrows():
            group = []
            for dimension in dimensions:
                group.append(groupby_exprs[dimension] == row[dimension])
            groups.append(and_(*group))

        return or_(*groups)

    def query(self, query_obj):
        qry_start_dttm = datetime.now()
        query_str_ext = self.get_query_str_extended(query_obj)
        sql = query_str_ext.sql
        status = utils.QueryStatus.SUCCESS
        error_message = None

        def mutator(df):
            labels_expected = query_str_ext.labels_expected
            if df is not None and not df.empty:
                if len(df.columns) != len(labels_expected):
                    raise Exception(f'For {sql}, df.columns: {df.columns}'
                                    f' differs from {labels_expected}')
                else:
                    df.columns = labels_expected
            return df

        try:
            df = self.database.get_df(sql, self.schema, mutator)
        except Exception as e:
            df = None
            status = utils.QueryStatus.FAILED
            logging.exception(f'Query {sql} on schema {self.schema} failed')
            db_engine_spec = self.database.db_engine_spec
            error_message = db_engine_spec.extract_error_message(e)

        # if this is a main query with prequeries, combine them together
        if not query_obj['is_prequery']:
            query_obj['prequeries'].append(sql)
            sql = ';\n\n'.join(query_obj['prequeries'])
        sql += ';'

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
        except Exception as e:
            logging.exception(e)
            raise Exception(_(
                "Table [{}] doesn't seem to exist in the specified database, "
                "couldn't fetch column information").format(self.table_name))

        M = SqlMetric  # noqa
        metrics = []
        any_date_col = None
        db_engine_spec = self.database.db_engine_spec
        db_dialect = self.database.get_dialect()
        dbcols = (
            db.session.query(TableColumn)
            .filter(TableColumn.table == self)
            .filter(or_(TableColumn.column_name == col.name
                        for col in table.columns)))
        dbcols = {dbcol.column_name: dbcol for dbcol in dbcols}

        for col in table.columns:
            try:
                datatype = col.type.compile(dialect=db_dialect).upper()
            except Exception as e:
                datatype = 'UNKNOWN'
                logging.error(
                    'Unrecognized data type in {}.{}'.format(table, col.name))
                logging.exception(e)
            dbcol = dbcols.get(col.name, None)
            if not dbcol:
                dbcol = TableColumn(column_name=col.name, type=datatype)
                dbcol.sum = dbcol.is_num
                dbcol.avg = dbcol.is_num
                dbcol.is_dttm = dbcol.is_time
                db_engine_spec.alter_new_orm_column(dbcol)
            else:
                dbcol.type = datatype
            dbcol.groupby = True
            dbcol.filterable = True
            self.columns.append(dbcol)
            if not any_date_col and dbcol.is_time:
                any_date_col = col.name

        metrics.append(M(
            metric_name='count',
            verbose_name='COUNT(*)',
            metric_type='count',
            expression='COUNT(*)',
        ))
        if not self.main_dttm_col:
            self.main_dttm_col = any_date_col
        self.add_missing_metrics(metrics)
        db.session.merge(self)
        db.session.commit()

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
        return import_datasource.import_datasource(
            db.session, i_datasource, lookup_database, lookup_sqlatable,
            import_time)

    @classmethod
    def query_datasources_by_name(
            cls, session, database, datasource_name, schema=None):
        query = (
            session.query(cls)
            .filter_by(database_id=database.id)
            .filter_by(table_name=datasource_name)
        )
        if schema:
            query = query.filter_by(schema=schema)
        return query.all()

    @staticmethod
    def default_query(qry):
        return qry.filter_by(is_sqllab_view=False)


sa.event.listen(SqlaTable, 'after_insert', security_manager.set_perm)
sa.event.listen(SqlaTable, 'after_update', security_manager.set_perm)
