from collections import OrderedDict
from datetime import datetime
import logging
from past.builtins import basestring
try:
    from urllib.parse import urlparse
except ImportError:
    from urlparse import urlparse

import pandas as pd
from pandas.api.types import (
    is_string_dtype, is_numeric_dtype, is_datetime64_any_dtype)

from sqlalchemy import (
    Column, Integer, String, ForeignKey, Text
)
import sqlalchemy as sa
from sqlalchemy.orm import backref, relationship
from sqlalchemy_utils import ChoiceType, JSONType

from flask import escape, Markup
from flask_appbuilder import Model
from flask_babel import lazy_gettext as _

from superset import db, utils, sm
from superset.connectors.base.models import (
    BaseDatasource, BaseColumn, BaseMetric)
from superset.models.helpers import QueryResult, set_perm
from superset.utils import QueryStatus


class PandasDatabase(object):
    """Non-ORM object for a Pandas Source"""
    database_name = ''

    cache_timeout = None

    def __init__(self, database_name, cache_timeout):
        self.database_name = database_name
        self.cache_timeout = cache_timeout

    def __str__(self):
        return self.database_name


class PandasColumn(Model, BaseColumn):
    """
    ORM object for Pandas columns.

    Each Pandas Datasource can have multiple columns"""

    __tablename__ = 'pandascolumns'

    id = Column(Integer, primary_key=True)
    pandasdatasource_id = Column(Integer, ForeignKey('pandasdatasources.id'))
    datasource = relationship(
        'PandasDatasource',
        backref=backref('columns', cascade='all, delete-orphan'),
        foreign_keys=[pandasdatasource_id])

    @property
    def is_num(self):
        return self.type and is_numeric_dtype(self.type)

    @property
    def is_time(self):
        return self.type and is_datetime64_any_dtype(self.type)

    @property
    def is_dttm(self):
        return self.is_time

    @property
    def is_string(self):
        return self.type and is_string_dtype(self.type)

    num_types = (
        'DOUBLE', 'FLOAT', 'INT', 'BIGINT',
        'LONG', 'REAL', 'NUMERIC', 'DECIMAL'
    )
    date_types = ('DATE', 'TIME', 'DATETIME')
    str_types = ('VARCHAR', 'STRING', 'CHAR')

    @property
    def expression(self):
        return ''

    @property
    def data(self):
        attrs = (
            'column_name', 'verbose_name', 'description', 'expression',
            'filterable', 'groupby')
        return {s: getattr(self, s) for s in attrs}


class PandasMetric(Model, BaseMetric):
    """
    ORM object for Pandas metrics.

    Each Pandas Datasource can have multiple metrics
    """

    __tablename__ = 'pandasmetrics'

    id = Column(Integer, primary_key=True)
    pandasdatasource_id = Column(Integer, ForeignKey('pandasdatasources.id'))
    datasource = relationship(
        'PandasDatasource',
        backref=backref('metrics', cascade='all, delete-orphan'),
        foreign_keys=[pandasdatasource_id])
    source = Column(Text)
    expression = Column(Text)

    @property
    def perm(self):
        if self.datasource:
            return ('{parent_name}.[{obj.metric_name}]'
                    '(id:{obj.id})').format(
                obj=self,
                parent_name=self.datasource.full_name)
        return None


class PandasDatasource(Model, BaseDatasource):
    """A datasource based on a Pandas DataFrame"""

    FORMATS = [
        ('csv', 'CSV'),
        ('html', 'HTML')
    ]

    # See http://pandas.pydata.org/pandas-docs/stable/timeseries.html#offset-aliases # NOQA
    GRAINS = OrderedDict([
        ('5 seconds', '5S'),
        ('30 seconds', '30S'),
        ('1 minute', 'T'),
        ('5 minutes', '5T'),
        ('1 hour', 'H'),
        ('6 hour', '6H'),
        ('day', 'D'),
        ('one day', 'D'),
        ('1 day', 'D'),
        ('7 days', '7D'),
        ('week', 'W-MON'),
        ('week_starting_sunday', 'W-SUN'),
        ('week_ending_saturday', 'W-SUN'),
        ('month', 'M'),
        ('quarter', 'Q'),
        ('year', 'A'),
    ])

    __tablename__ = 'pandasdatasources'
    type = 'pandas'
    baselink = None  # url portion pointing to ModelView endpoint
    column_class = PandasColumn
    metric_class = PandasMetric

    name = Column(String(100), nullable=False)
    source_url = Column(String(1000), nullable=False)
    format = Column(String(20), nullable=False)
    additional_parameters = Column(JSONType)

    user_id = Column(Integer, ForeignKey('ab_user.id'))
    owner = relationship(
        sm.user_model,
        backref='pandasdatasources',
        foreign_keys=[user_id])

    fetch_values_predicate = Column(String(1000))
    main_dttm_col = Column(String(250))

    # Used to do code highlighting when displaying the query in the UI
    query_language = None

    # A Pandas Dataframe containing the data retrieved from the source url
    df = None

    def __repr__(self):
        return self.name

    @property
    def datasource_name(self):
        return self.name

    @property
    def full_name(self):
        return self.name

    @property
    def database(self):
        uri = urlparse(self.source_url)
        return PandasDatabase(database_name=uri.netloc,
                              cache_timeout=None)

    @property
    def connection(self):
        return self.source_url

    @property
    def schema(self):
        uri = urlparse(self.source_url)
        return uri.path

    @property
    def schema_perm(self):
        """Returns endpoint permission if present, host one otherwise."""
        return utils.get_schema_perm(self.database, self.schema)

    @property
    def description_markeddown(self):
        return utils.markdown(self.description)

    @property
    def link(self):
        name = escape(self.name)
        return Markup(
            '<a href="{self.explore_url}">{name}</a>'.format(**locals()))

    def get_perm(self):
        return (
            "pandas.{obj.name}"
            "(id:{obj.id})").format(obj=self)

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
    def data(self):
        d = super(PandasDatasource, self).data
        d['granularity_sqla'] = utils.choicify(self.dttm_cols)
        d['time_grain_sqla'] = [(g, g) for g in self.GRAINS.keys()]
        logging.info(d)
        print(d)
        return d

    @property
    def pandas_read_method(self):
        return getattr(pd, 'read_{obj.format}'.format(obj=self))

    @property
    def pandas_read_parameters(self):
        return self.additional_parameters or {}

    def get_empty_dataframe(self):
        """Create an empty dataframe with the correct columns and dtypes"""
        columns = []
        for col in self.columns:
            type = ('datetime64[ns]'
                    if is_datetime64_any_dtype(col.type)
                    else col.type)
            columns.append((col.column_name, type))
        return pd.DataFrame({k: pd.Series(dtype=t) for k, t in columns})

    def get_dataframe(self):
        if self.df is None:
            self.df = self.pandas_read_method(self.source_url,
                                              **self.pandas_read_parameters)
            # read_html returns a list of DataFrames
            if (isinstance(self.df, list) and
                    isinstance(self.df[0], pd.DataFrame)):
                self.df = self.df[0]
        for col in self.columns:
            name = col.column_name
            type = col.type
            if type != self.df[name].dtype.name:
                try:
                    self.df[name] = self.df[name].values.astype(type)
                except ValueError as e:
                    message = ('Failed to convert column {name} '
                               'from {old_type} to {new_type}').format(
                        name=name,
                        old_type=self.df[name].dtype.name,
                        new_type=type)
                    e.args = (message,) + e.args
                    raise
        return self.df

    def get_filter_query(self, filter):
        """
        Build a query string to filter a dataframe.

        Filter is a list of dicts of op, col and value.

        Returns a string that can be passed to DataFrame.query() to
        restrict the DataFrame to only the matching rows.
        """
        cols = {col.column_name: col for col in self.columns}
        query = ''
        for flt in filter:
            if not all([flt.get(s) for s in ['col', 'op', 'val']]):
                continue
            col = flt['col']
            col_obj = cols.get(col)
            op = flt['op']
            eq = flt['val']
            if query:
                query += ' and '
            if op == 'LIKE':
                query += "{col}.str.match('{eq}')".format(col=col, eq=eq)
            else:
                # Rely on Pandas partial string indexing for datetime fields,
                # see https://pandas.pydata.org/pandas-docs/stable/timeseries.html#partial-string-indexing  # NOQA
                try:
                    if ((col_obj.is_string or col_obj.is_dttm)
                            and not isinstance(eq, list)):
                        eq = "'{}'".format(eq)
                except AttributeError:
                    # col_obj is None, probably because the col is a metric,
                    # in which case it is numeric anyway
                    pass
                query += "({col} {op} {eq})".format(col=col, op=op, eq=eq)
        return query

    def process_dataframe(
            self,
            df,
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
            form_data=None):
        """Querying any dataframe table from this common interface"""
        if orderby:
            orderby, ascending = map(list, zip(*orderby))
        else:
            orderby = []
            ascending = []
        filter = filter or []
        query_str = 'df'

        # Build a dict of the metrics to include, including those that
        # are required for post-aggregation filtering
        filtered_metrics = [flt['col']
                            for flt in extras.get('having_druid', [])
                            if flt['col'] not in metrics]
        metrics_dict = {m.metric_name: m for m in self.metrics}
        metrics_exprs = OrderedDict()
        for m in metrics + filtered_metrics:
            try:
                metric = metrics_dict[m]
            except KeyError:
                raise Exception(_("Metric '{}' is not valid".format(m)))
            metrics_exprs[m] = metric

        # Standard tests (copied from SqlaTable)
        if not granularity and is_timeseries:
            raise Exception(_(
                "Datetime column not provided as part table configuration "
                "and is required by this type of chart"))

        # Filter the DataFrame by the time column, and resample if necessary
        timestamp_cols = []
        timestamp_exprs = []
        if granularity and granularity != 'all':

            if from_dttm:
                filter.append({'col': granularity,
                               'op': '>=',
                               'val': from_dttm})
            if to_dttm:
                filter.append({'col': granularity,
                               'op': '<=',
                               'val': to_dttm})

            if is_timeseries:
                time_grain = self.GRAINS[extras.get('time_grain_sqla')]
                timestamp_cols = ['__timestamp']
                timestamp_exprs = [pd.Grouper(key=granularity,
                                              freq=time_grain)]

                if timeseries_limit_metric and timeseries_limit:
                    metric = metrics_dict[timeseries_limit_metric]
                    assert isinstance(metric.source, basestring)
                    aggregates = {metric.source: metric.expression}
                    df = (df[df.set_index(groupby).index.isin(
                              df.groupby(groupby)
                                .aggregate(aggregates)
                                .sort_values(metric.source, ascending=False)
                                .iloc[:timeseries_limit].index)])

                    query_str += ('[df.set_index({groupby}).index.isin('
                                  'df.groupby({groupby})'
                                  '.aggregate({aggregates})'
                                  ".sort_values('{metric.source}', ascending=False)"
                                  '.iloc[:{timeseries_limit}].index)]').format(
                        groupby=groupby,
                        timeseries_limit_metric=timeseries_limit_metric,
                        timeseries_limit=timeseries_limit,
                        aggregates=aggregates,
                        metric=metric)

        # Additional filtering of rows prior to aggregation
        if filter:
            filter_str = self.get_filter_query(filter)
            df = df.query(filter_str)
            query_str += '.query("{filter_str}")'.format(filter_str=filter_str)

        # We have one of:
        # - columns only: return a simple table of results with no aggregation
        # - metrics only: return a single row with one column per metric
        #                 aggregated for the whole dataframe
        # - groupby and metrics: return a table of distinct groupby columns
        #                 and aggregations
        # - groupby only: return a table of distinct rows
        if columns:
            # A simple table of results with no aggregation or grouping
            if orderby:
                df = df.sort_values(orderby, ascending=ascending)
                query_str += ('.sort_values({orderby}, '
                              'ascending={ascending})').format(
                    orderby=orderby,
                    ascending=ascending)
            df = df[columns]
            query_str += '[{columns}]'.format(columns=columns)

        elif metrics_exprs:
            # Aggregate the dataframe

            # Single-column aggregates can be calculated using aggregate,
            # multi-column ones need to use apply.
            # aggregates is a dict keyed by a column name, or a tuple
            # of column names, where the value is a list of expressions
            # that can be used by DataFrame.aggregate() on those columns
            aggregates = OrderedDict()
            for metric in metrics_exprs.values():
                assert isinstance(metric.source, basestring)
                if metric.source in aggregates:
                    aggregates[metric.source].append(metric.expression)
                else:
                    aggregates[metric.source] = [metric.expression]

            if groupby or timestamp_exprs:
                df = (df.groupby(groupby + timestamp_exprs)
                        .aggregate(aggregates)
                        .reset_index())
                query_str += ('.groupby({groupby})'
                              '.aggregate({aggregates})'
                              '.reset_index()').format(
                    groupby=groupby,
                    aggregates=aggregates)

            else:
                df = df.aggregate(aggregates)
                query_str += '.aggregate({aggregates})'.format(
                    aggregates=aggregates)
                # Note that Superset expects a DataFrame with single Row and
                # the metrics as columns, rather than with the metrics
                # as the index
                df = df.T.reset_index(drop=True)
                query_str += '.T.reset_index(drop=True)'

            df.columns = groupby + timestamp_cols + metrics + filtered_metrics

            # Filtering of rows post-aggregation based on metrics
            if extras.get('having_druid'):
                filter_str = self.get_filter_query(extras.get('having_druid'))
                df = df.query(filter_str)
                query_str += '.query("{filter_str}")'.format(
                    filter_str=filter_str)

            # Order by the first metric descending by default,
            # or within the existing orderby, if we have a groupby
            if groupby:
                orderby.append((metrics + filtered_metrics)[0])
                ascending.append(False)

            # Use the groupby and __timestamp by as a tie breaker
            orderby = orderby + groupby + timestamp_cols
            ascending = ascending + ([True] * len(groupby + timestamp_cols))

            # Sort the values
            if orderby:
                df = df.sort_values(orderby, ascending=ascending)
                query_str += ('.sort_values({orderby}, '
                              'ascending={ascending})').format(
                    orderby=orderby,
                    ascending=ascending)

            # Remove metrics only added for post-aggregation filtering
            df = df.drop(filtered_metrics, axis=1)
            query_str += '.drop({filtered_metrics}, axis=1)'.format(
                filtered_metrics=filtered_metrics)

        elif groupby:
            # Group by without any metrics is equivalent to SELECT DISTINCT,
            # order by the size descending by default, or within the
            # existing orderby
            orderby.append(0)
            ascending.append(False)
            # Use the group by as a tie breaker
            orderby = orderby + groupby
            ascending = ascending + ([True] * len(groupby))
            df = (df.groupby(groupby)
                    .size()
                    .reset_index()
                    .sort_values(orderby, ascending=ascending)
                    .drop(0, axis=1))
            query_str += ('.groupby({groupby}).size().reset_index()'
                          '.sort_values({orderby}, ascending={ascending})'
                          '.drop(0, axis=1)').format(
                groupby=groupby,
                orderby=orderby,
                ascending=ascending)

        if row_limit:
            df = df.iloc[:row_limit]
            query_str += '.iloc[:{row_limit}]'.format(row_limit=row_limit)

        # Coerce datetimes to str so that Pandas can set the correct precision
        for col in df.columns:
            if is_datetime64_any_dtype(df[col].dtype):
                df[col] = df[col].astype(str)

        return df, query_str

    def get_query_str(self, query_obj):
        """Returns a query as a string

        This is used to be displayed to the user so that she/he can
        understand what is taking place behind the scene"""
        import json
        from functools import singledispatch

        @singledispatch
        def to_serializable(val):
            """Used by default."""
            return str(val)

        @to_serializable.register(datetime)
        def ts_datetime(val):
            """Used if *val* is an instance of datetime."""
            return val.isoformat() + "Z"

        logging.info(json.dumps(query_obj, indent=4, default=to_serializable))
        df = self.get_empty_dataframe()
        df, query_str = self.process_dataframe(df, **query_obj)
        return query_str

    def query(self, query_obj):
        """Executes the query and returns a dataframe

        query_obj is a dictionary representing Superset's query interface.
        Should return a ``superset.models.helpers.QueryResult``
        """
        import json
        from functools import singledispatch

        @singledispatch
        def to_serializable(val):
            """Used by default."""
            return str(val)

        @to_serializable.register(datetime)
        def ts_datetime(val):
            """Used if *val* is an instance of datetime."""
            return val.isoformat() + "Z"

        logging.info(json.dumps(query_obj, indent=4, default=to_serializable))
        print(json.dumps(query_obj, indent=4, default=to_serializable))
        qry_start_dttm = datetime.now()
        status = QueryStatus.SUCCESS
        error_message = None
        df = None
        query_str = ''
        try:
            df = self.get_dataframe()
            df, query_str = self.process_dataframe(df, **query_obj)
            logging.info(query_str)
            logging.info(df.shape)
            logging.info(df)
        except Exception as e:
            status = QueryStatus.FAILED
            logging.exception(e)
            error_message = str(e)

        return QueryResult(
            status=status,
            df=df,
            duration=datetime.now() - qry_start_dttm,
            query=query_str,
            error_message=error_message)

    def values_for_column(self, column_name, limit=10000):
        """Given a column, returns an iterable of distinct values

        This is used to populate the dropdown showing a list of
        values in filters in the explore view"""
        values = self.get_dataframe()[column_name].unique()
        if limit:
            values = values[:limit]
        return values.tolist()

    def get_metadata(self):
        """Build the metadata for the table and merge it in"""
        df = self.get_dataframe()

        C = PandasColumn  # noqa shortcut to class
        M = PandasMetric  # noqa
        metrics = []
        any_date_col = None
        for col in df.columns:
            dbcol = (
                db.session
                .query(C)
                .filter(C.datasource == self)
                .filter(C.column_name == col)
                .first()
            )
            db.session.flush()
            if not dbcol:
                dbcol = C(column_name=col, type=df.dtypes[col].name)
                dbcol.groupby = dbcol.is_string
                dbcol.filterable = dbcol.is_string
                dbcol.sum = dbcol.is_num
                dbcol.avg = dbcol.is_num

            db.session.merge(self)
            self.columns.append(dbcol)

            if not any_date_col and dbcol.is_time:
                any_date_col = col

            if dbcol.sum:
                metrics.append(M(
                    metric_name='sum__' + dbcol.column_name,
                    verbose_name='sum__' + dbcol.column_name,
                    metric_type='sum',
                    source=dbcol.column_name,
                    expression='sum'
                ))
            if dbcol.avg:
                metrics.append(M(
                    metric_name='avg__' + dbcol.column_name,
                    verbose_name='avg__' + dbcol.column_name,
                    metric_type='avg',
                    source=dbcol.column_name,
                    expression='mean'
                ))
            if dbcol.max:
                metrics.append(M(
                    metric_name='max__' + dbcol.column_name,
                    verbose_name='max__' + dbcol.column_name,
                    metric_type='max',
                    source=dbcol.column_name,
                    expression='max'
                ))
            if dbcol.min:
                metrics.append(M(
                    metric_name='min__' + dbcol.column_name,
                    verbose_name='min__' + dbcol.column_name,
                    metric_type='min',
                    source=dbcol.column_name,
                    expression='min'
                ))
            if dbcol.count_distinct:
                metrics.append(M(
                    metric_name='count_distinct__' + dbcol.column_name,
                    verbose_name='count_distinct__' + dbcol.column_name,
                    metric_type='count_distinct',
                    source=dbcol.column_name,
                    expression='nunique'
                ))
            dbcol.type = df.dtypes[col].name
            db.session.merge(self)
            db.session.commit()

        metrics.append(M(
            metric_name='count',
            verbose_name='count',
            metric_type='count',
            source=None,
            expression="count"
        ))
        for metric in metrics:
            m = (
                db.session.query(M)
                .filter(M.metric_name == metric.metric_name)
                .filter(M.datasource == self)
                .first()
            )
            metric.pandasdatasource_id = self.id
            if not m:
                db.session.add(metric)
                db.session.commit()
        if not self.main_dttm_col:
            self.main_dttm_col = any_date_col


sa.event.listen(PandasDatasource, 'after_insert', set_perm)
sa.event.listen(PandasDatasource, 'after_update', set_perm)
