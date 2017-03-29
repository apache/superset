from datetime import datetime
import logging
import sqlparse

import pandas as pd

from sqlalchemy import (
    Column, Integer, String, ForeignKey, Text, Boolean,
    DateTime,
)
import sqlalchemy as sa
from sqlalchemy import asc, and_, desc, select
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.expression import ColumnClause, TextAsFrom
from sqlalchemy.orm import backref, relationship
from sqlalchemy.sql import table, literal_column, text, column

from flask import escape, Markup
from flask_appbuilder import Model
from flask_babel import lazy_gettext as _

from superset import db, utils, import_util
from superset.connectors.base import BaseDatasource, BaseColumn, BaseMetric
from superset.utils import DTTM_ALIAS, QueryStatus
from superset.models.helpers import QueryResult
from superset.models.core import Database
from superset.jinja_context import get_template_processor
from superset.models.helpers import set_perm


class TableColumn(Model, BaseColumn):

    """ORM object for table columns, each table can have multiple columns"""

    __tablename__ = 'table_columns'
    table_id = Column(Integer, ForeignKey('tables.id'))
    table = relationship(
        'SqlaTable',
        backref=backref('columns', cascade='all, delete-orphan'),
        foreign_keys=[table_id])
    is_dttm = Column(Boolean, default=False)
    expression = Column(Text, default='')
    python_date_format = Column(String(255))
    database_expression = Column(String(255))

    export_fields = (
        'table_id', 'column_name', 'verbose_name', 'is_dttm', 'is_active',
        'type', 'groupby', 'count_distinct', 'sum', 'avg', 'max', 'min',
        'filterable', 'expression', 'description', 'python_date_format',
        'database_expression'
    )

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
                self.type or '', dttm)
            return s or "'{}'".format(dttm.strftime(tf))


class SqlMetric(Model, BaseMetric):

    """ORM object for metrics, each table can have multiple metrics"""

    __tablename__ = 'sql_metrics'
    table_id = Column(Integer, ForeignKey('tables.id'))
    table = relationship(
        'SqlaTable',
        backref=backref('metrics', cascade='all, delete-orphan'),
        foreign_keys=[table_id])
    expression = Column(Text)

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


class SqlaTable(Model, BaseDatasource):

    """An ORM object for SqlAlchemy table references"""

    type = "table"
    query_language = 'sql'
    metric_class = SqlMetric
    column_class = TableColumn

    __tablename__ = 'tables'
    table_name = Column(String(250))
    main_dttm_col = Column(String(250))
    database_id = Column(Integer, ForeignKey('dbs.id'), nullable=False)
    fetch_values_predicate = Column(String(1000))
    user_id = Column(Integer, ForeignKey('ab_user.id'))
    owner = relationship(
        'User',
        backref='tables',
        foreign_keys=[user_id])
    database = relationship(
        'Database',
        backref=backref('tables', cascade='all, delete-orphan'),
        foreign_keys=[database_id])
    schema = Column(String(255))
    sql = Column(Text)

    baselink = "tablemodelview"
    export_fields = (
        'table_name', 'main_dttm_col', 'description', 'default_endpoint',
        'database_id', 'is_featured', 'offset', 'cache_timeout', 'schema',
        'sql', 'params')

    __table_args__ = (
        sa.UniqueConstraint(
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

    def values_for_column(self, column_name, limit=10000):
        """Runs query against sqla to retrieve some
        sample values for the given column.
        """
        cols = {col.column_name: col for col in self.columns}
        target_col = cols[column_name]

        tbl = self.get_sqla_table()
        qry = (
            select([target_col.sqla_col])
            .select_from(tbl)
            .distinct(column_name)
        )
        if limit:
            qry = qry.limit(limit)

        if self.fetch_values_predicate:
            tp = self.get_template_processor()
            qry = qry.where(tp.process_template(self.fetch_values_predicate))

        engine = self.database.get_sqla_engine()
        sql = "{}".format(
            qry.compile(
                engine, compile_kwargs={"literal_binds": True}, ),
        )

        df = pd.read_sql_query(sql=sql, con=engine)
        return [row[0] for row in df.to_records(index=False)]

    def get_template_processor(self, **kwargs):
        return get_template_processor(
            table=self, database=self.database, **kwargs)

    def get_query_str(self, **kwargs):
        engine = self.database.get_sqla_engine()
        qry = self.get_sqla_query(**kwargs)
        sql = str(
            qry.compile(
                engine,
                compile_kwargs={"literal_binds": True}
            )
        )
        logging.info(sql)
        sql = sqlparse.format(sql, reindent=True)
        sql = self.database.db_engine_spec.sql_preprocessor(sql)
        return sql

    def get_sqla_table(self):
        tbl = table(self.table_name)
        if self.schema:
            tbl.schema = self.schema
        return tbl

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
            columns=None):
        """Querying any sqla table from this common interface"""

        template_kwargs = {
            'from_dttm': from_dttm,
            'groupby': groupby,
            'metrics': metrics,
            'row_limit': row_limit,
            'to_dttm': to_dttm,
        }
        template_processor = self.get_template_processor(**template_kwargs)

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
        qry = sa.select(select_exprs)

        # Supporting arbitrary SQL statements in place of tables
        if self.sql:
            from_sql = template_processor.process_template(self.sql)
            tbl = TextAsFrom(sa.text(from_sql), []).alias('expr_qry')
        else:
            tbl = self.get_sqla_table()

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
            if col_obj:
                if op in ('in', 'not in'):
                    values = [types.strip("'").strip('"') for types in eq]
                    if col_obj.is_num:
                        values = [utils.js_string_to_num(s) for s in values]
                    cond = col_obj.sqla_col.in_(values)
                    if op == 'not in':
                        cond = ~cond
                    where_clause_and.append(cond)
                elif op == '==':
                    where_clause_and.append(col_obj.sqla_col == eq)
                elif op == '!=':
                    where_clause_and.append(col_obj.sqla_col != eq)
                elif op == '>':
                    where_clause_and.append(col_obj.sqla_col > eq)
                elif op == '<':
                    where_clause_and.append(col_obj.sqla_col < eq)
                elif op == '>=':
                    where_clause_and.append(col_obj.sqla_col >= eq)
                elif op == '<=':
                    where_clause_and.append(col_obj.sqla_col <= eq)
                elif op == 'LIKE':
                    where_clause_and.append(col_obj.sqla_col.like(eq))
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

        return qry.select_from(tbl)

    def query(self, query_obj):
        qry_start_dttm = datetime.now()
        engine = self.database.get_sqla_engine()
        qry = self.get_sqla_query(**query_obj)
        sql = self.get_query_str(**query_obj)
        status = QueryStatus.SUCCESS
        error_message = None
        df = None
        try:
            df = pd.read_sql_query(qry, con=engine)
        except Exception as e:
            status = QueryStatus.FAILED
            logging.exception(e)
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

sa.event.listen(SqlaTable, 'after_insert', set_perm)
sa.event.listen(SqlaTable, 'after_update', set_perm)
