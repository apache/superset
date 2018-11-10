from collections import OrderedDict
from datetime import datetime
import logging
from past.builtins import basestring
try:
    from urllib.parse import urlparse
except ImportError:
    from urlparse import urlparse

import pandas as pd
import requests
import humanize
from io import BytesIO
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

from superset import dataframe_cache, db, security_manager, utils
from superset.connectors.base.models import (
    BaseDatasource, BaseColumn, BaseMetric)
from superset.models.helpers import QueryResult, set_perm
from superset.utils import QueryStatus

FORMATS = [
    ('csv', 'csv'),
    ('html', 'html'),
    ('json', 'json'),
    ('excel', 'Microsoft Excel'),
    ('stata', 'Stata'),
]

try:
    import tables  # NOQA
    FORMATS.append(('hdf', 'HDF5'))
except ImportError:
    pass

try:
    import feather  # NOQA
    FORMATS.append(('feather', 'Feather'))
except ImportError:
    pass


class PandasDatabase(object):
    """Non-ORM object for a Pandas Source"""

    def __init__(self, database_name, cache_timeout=None):
        self.database_name = database_name
        self.cache_timeout = cache_timeout
        self.data = {};

    def __str__(self):
        return self.database_name


class PandasColumn(Model, BaseColumn):
    """
    ORM object for Pandas columns.

    Each Pandas Datasource can have multiple columns"""

    __tablename__ = 'pandas_columns'

    id = Column(Integer, primary_key=True)
    pandas_datasource_id = Column(Integer, ForeignKey('pandas_datasources.id'))
    datasource = relationship(
        'PandasDatasource',
        backref=backref('columns', cascade='all, delete-orphan'),
        foreign_keys=[pandas_datasource_id])
    expression = Column(Text)

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

    @property
    def data(self):
        attrs = (
            'column_name', 'verbose_name', 'description', 'expression',
            'filterable', 'groupby', 'is_dttm')
        return {s: getattr(self, s) for s in attrs}

    def get_perm(self):
        if self.datasource:
            return ('{parent_name}.[{obj.expression}]'
                    '(id:{obj.id})').format(
                obj=self,
                parent_name=self.datasource.full_name)
        return None


class PandasMetric(Model, BaseMetric):
    """
    ORM object for Pandas metrics.

    Each Pandas Datasource can have multiple metrics
    """

    __tablename__ = 'pandas_metrics'

    id = Column(Integer, primary_key=True)
    pandas_datasource_id = Column(Integer, ForeignKey('pandas_datasources.id'))
    datasource = relationship(
        'PandasDatasource',
        backref=backref('metrics', cascade='all, delete-orphan'),
        foreign_keys=[pandas_datasource_id])
    source = Column(Text)
    expression = Column(Text)

    def get_perm(self):
        if self.datasource:
            return ('{parent_name}.[{obj.metric_name}]'
                    '(id:{obj.id})').format(
                obj=self,
                parent_name=self.datasource.full_name)
        return None


class PandasDatasource(Model, BaseDatasource):
    """A datasource based on a Pandas DataFrame"""

    # See http://pandas.pydata.org/pandas-docs/stable/timeseries.html#offset-aliases # NOQA
    GRAINS = OrderedDict([
        ('5 seconds', '5S'),
        ('30 seconds', '30S'),
        ('1 minute', 'T'),
        ('5 minutes', '5T'),
        ('1 hour', 'H'),
        ('6 hour', '6H'),
        ('day', 'D'),
        ('one_day', 'D'),
        ('1 day', 'D'),
        ('7 days', '7D'),
        ('week', 'W-MON'),
        ('week_starting_sunday', 'W-SUN'),
        ('week_ending_saturday', 'W-SUN'),
        ('month', 'M'),
        ('quarter', 'Q'),
        ('year', 'A'),
    ])

    __tablename__ = 'pandas_datasources'
    type = 'pandas'
    baselink = 'pandasdatasourcemodelview'  # url portion pointing to ModelView
    column_class = PandasColumn
    metric_class = PandasMetric

    name = Column(String(100), nullable=False)
    source_url = Column(String(1000), nullable=False)
    source_auth = Column(JSONType)
    source_parameters = Column(JSONType)
    format = Column(ChoiceType(FORMATS), nullable=False)
    additional_parameters = Column(JSONType)

    user_id = Column(Integer, ForeignKey('ab_user.id'))
    owner = relationship(
        security_manager.user_model,
        backref='pandas_datasources',
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
        try:
            database_name = urlparse(self.source_url).netloc
        except AttributeError:
            database_name = 'memory'
        return PandasDatabase(database_name=database_name,
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
        return security_manager.get_schema_perm(self.database, self.schema)

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
            'pandas.{obj.name}'
            '(id:{obj.id})').format(obj=self)

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
    def data(self):
        d = super(PandasDatasource, self).data
        # Note that the front end uses `granularity_sqla` and
        # `time_grain_sqla` as the parameters for selecting the
        # column and time grain separately.
        d['granularity_sqla'] = utils.choicify(self.dttm_cols)
        d['time_grain_sqla'] = [(g, g) for g in self.GRAINS.keys()]
        logging.info(d)
        return d

    @property
    def pandas_read_method(self):
        try:
            # The format is a Choice object
            format = self.format.code
        except AttributeError:
            format = self.format
        return getattr(pd, 'read_{format}'.format(format=format))

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

    @property
    def cache_key(self):
        source = {'source_url': self.source_url,
                  'source_auth': self.source_auth}
        source.update(self.source_parameters or {})
        source.update(self.pandas_read_parameters)
        s = str([(k, source[k]) for k in sorted(source.keys())])
        return hashlib.md5(s.encode('utf-8')).hexdigest()

    def get_dataframe(self):
        """
        Read the source_url and return a Pandas DataFrame.

        Use the PandasColumns to coerce columns into the correct dtype,
        and add any calculated columns to the DataFrame.
        """
        if self.df is None:
            if dataframe_cache:
                cache_key = self.cache_key
                self.df = dataframe_cache.get(cache_key)
            if not isinstance(self.df, pd.DataFrame):
                if (isinstance(self.source_url, basestring) and
                        self.source_url[:4] == 'http'):
                    # Use requests to retrieve remote data so we can handle authentication
                    auth = self.source_auth
                    url = self.source_url
                    if isinstance(auth, (tuple, list)):
                        response = requests.get(url, params=self.source_parameters,
                                                auth=tuple(auth))
                    elif auth:
                        response = requests.get(url, params=self.source_parameters,
                                                headers={'Authorization': auth})
                    else:
                        response = requests.get(url, params=self.source_parameters)
                    response.raise_for_status()
                    data = BytesIO(response.content)
                else:
                    # Local file, so just use Pandas directly
                    data = self.source_url
                # Read the dataframe from the response
                self.df = self.pandas_read_method(data, **self.pandas_read_parameters)

                # read_html returns a list of DataFrames
                if (isinstance(self.df, list) and
                        isinstance(self.df[0], pd.DataFrame)):
                    self.df = self.df[0]

                # Our column names are always strings
                self.df.columns = [str(col) for col in self.df.columns]

                if dataframe_cache:
                    timeout = self.cache_timeout or self.database.cache_timeout
                    dataframe_cache.set(cache_key, self.df, timeout)

        calculated_columns = []
        for col in self.columns:
            name = col.column_name
            type = col.type
            # Prepare calculated columns
            if col.expression:
                calculated_columns.append('{name} = {expr}'.format(
                    name=name, expr=col.expression))
            elif type != self.df[name].dtype.name:
                # Convert column to correct dtype
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
        # Add the calcuated columns, using a multi-line string to add them all at once
        # See https://pandas.pydata.org/pandas-docs/stable/enhancingperf.html#enhancingperf-eval  # NOQA: E501
        if calculated_columns:
            self.df.eval('\n'.join(calculated_columns),
                         truediv=True,
                         inplace=True)
        return self.df

    def get_filter_query(self, filter):
        """
        Build a query string to filter a dataframe.

        Filter is a list of dicts of op, col and value.

        Returns a string that can be passed to DataFrame.query() to
        restrict the DataFrame to only the matching rows.
        """
        cols = {col.column_name: col for col in self.columns}
        print("cols {}".format(cols))
        query = ''
        for flt in filter:
            if not all([flt.get(s) for s in ['col', 'op', 'val']]):
                continue
            col = flt['col']
            print("col {}".format(col))
            col = col.replace(' ', '_')
            print("after col {}".format(col))
            col_obj = cols.get(col)
            print("col_obj {}".format(col_obj))
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
                    if ((col_obj.is_string or col_obj.is_dttm) and
                            not isinstance(eq, list)):
                        eq = "'{}'".format(eq)
                except AttributeError:
                    # col_obj is None, probably because the col is a metric,
                    # in which case it is numeric anyway
                    pass
                query += '({col} {op} \"{eq}\")'.format(col=col, op=op, eq=eq)
        return query

    def get_agg_function(self, expr):
        """
        Return a function that can be passed to DataFrame.apply().

        Complex expressions that work on multiple columns must be a function
        that accepts a Group as the parameter.

        The function can be defined on the Connector, or on the DataFrame,
        in the local scope
        """
        if expr in ['sum', 'mean', 'std', 'sem', 'count', 'min', 'max']:
            return expr
        if hasattr(self, expr):
            return getattr(self, expr)
        if hasattr(self.get_dataframe(), expr):
            return getattr(self.get_dataframe(), expr)
        return locals()[expr]

    def process_dataframe(
            self,
            df,
            groupby,
            metrics,
            granularity,
            from_dttm, 
            to_dttm,
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
            form_data=None,
            is_prequery=False,
            prequeries=None,
            order_desc=True):
        """Querying any dataframe table from this common interface"""
        if orderby:
            orderby, ascending = map(list, zip(*orderby))
        else:
            orderby = []
            ascending = []
        metric_order_asc = not order_desc
        filter = filter or []
        query_str = 'df'

        # Build a dict of the metrics to include, including those that
        # are required for post-aggregation filtering
        # Note that the front end uses `having_druid` as the parameter
        # for post-aggregation filters, and we are reusing that
        # interface component.
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
                'Datetime column not provided as part table configuration '
                'and is required by this type of chart'))

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
                # Note that the front end uses `time_grain_sqla` as
                # the parameter for setting the time grain when the
                # granularity is being used to select the timetamp column
                time_grain = self.GRAINS[extras.get('time_grain_sqla')]
                timestamp_cols = ['__timestamp']
                timestamp_exprs = [pd.Grouper(key=granularity,
                                              freq=time_grain)]

                if timeseries_limit_metric and timeseries_limit:
                    metric = metrics_dict[timeseries_limit_metric]
                    assert isinstance(metric.source, basestring)
                    aggregates = {metric.source: metric.expression}
                    df = (df[df.set_index(groupby)
                               .index.isin(
                                   df.groupby(groupby, sort=False)
                                   .aggregate(aggregates)
                                   .sort_values(metric.source,
                                                ascending=metric_order_asc)
                                   .iloc[:timeseries_limit].index)])

                    query_str += ('[df.set_index({groupby}).index.isin('
                                  'df.groupby({groupby}, sort=False)'
                                  '.aggregate({aggregates})'
                                  ".sort_values('{metric.source}', "
                                  'ascending={metric_order_asc})'
                                  '.iloc[:{timeseries_limit}].index)]').format(
                        groupby=groupby,
                        timeseries_limit_metric=timeseries_limit_metric,
                        timeseries_limit=timeseries_limit,
                        aggregates=aggregates,
                        metric=metric,
                        metric_order_asc=metric_order_asc)

        # Additional filtering of rows prior to aggregation
        if filter:
            filter_str = self.get_filter_query(filter)
            print("Query {}".format(filter_str))
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
            # aggregates is a dict keyed by a column name, where the value is
            # a list of expressions that can be used by DataFrame.aggregate()
            # apply_functions is a dict keyed by the metric name, where the
            # value is a function that can be passed to DataFrame.apply()
            aggregates = OrderedDict()
            agg_names = []
            apply_functions = []
            apply_names = []
            for metric_name, metric in metrics_exprs.items():
                sources = []
                if metric.source:
                    sources = [s.strip() for s in metric.source.split(',') if s]
                if len(sources) == 1:
                    # Single column source, so use aggregate
                    func = self.get_agg_function(metric.expression)
                    if metric.source in aggregates:
                        aggregates[metric.source].append(func)
                    else:
                        aggregates[metric.source] = [func]
                    agg_names.append(metric_name)
                else:
                    # Multiple columns so the expression must be a function
                    # that accepts a Group as the parameter
                    apply_functions.append((sources,
                                            metric.expression,
                                            self.get_agg_function(metric.expression)))
                    apply_names.append(metric_name)

            # Build a list of like-indexed DataFrames containing the results
            # of DataFrame.aggregate() and individual DataFrame.apply() calls
            dfs = []
            query_strs = []

            if groupby or timestamp_exprs:
                df = df.groupby(groupby + timestamp_exprs, sort=False)
                query_str += '.groupby({}, sort=False)'.format(groupby + timestamp_exprs)

            for sources, expr, func in apply_functions:
                apply_df = df
                apply_str = query_str

                if sources:
                    apply_df = df[sources]
                    apply_str = query_str + '[{}]'.format(sources)

                if groupby or timestamp_exprs:
                    apply_df = df.apply(func)
                    apply_str += '.apply({})'.format(expr)
                else:
                    # If we call DataFrame.apply() without a groupby then the func is
                    # called on each column individually. Therefore, if we have a
                    # summary with multi-column aggregates we need to pass the whole
                    # DataFrame to the function.
                    apply_df = pd.Series(func(apply_df)).to_frame()
                    apply_str = 'pd.Series({expr}({df})).to_frame()'.format(
                        expr=expr,
                        df=apply_str)

                    # Superset expects a DataFrame with single Row and
                    # the metrics as columns, rather than with the metrics as the
                    # index, so if we have a summary then we need to pivot it.
                    apply_df = apply_df.unstack().to_frame().T
                    apply_str += '.unstack().to_frame().T'

                dfs.append(apply_df)
                query_strs.append(apply_str)

            if aggregates:
                if groupby or timestamp_exprs:
                    dfs.append(df.aggregate(aggregates))
                    query_strs.append(query_str +
                                      '.aggregate({})'.format(aggregates))
                else:
                    # For a summary table we need to preserve the metric order
                    # so we can set the correct column names, so process aggregates
                    # for each dataframe column in turn
                    for col, col_agg in aggregates.items():
                        agg_df = df.aggregate({col: col_agg})
                        agg_str = query_str + '.aggregate({}: {})'.format(col, col_agg)

                        # Superset expects a DataFrame with single Row and
                        # the metrics as columns, rather than with the metrics as the
                        # index, so if we have a summary then we need to pivot it.
                        agg_df = agg_df.unstack().to_frame().T
                        agg_str += '.unstack().to_frame().T'

                        dfs.append(agg_df)
                        query_strs.append(agg_str)

            # If there is more than one DataFrame in the list then
            # concatenate them along the index
            if len(dfs) > 1:
                df = pd.concat(dfs, axis=1)
                query_str = 'pd.concat([{}], axis=1)'.format(', '.join(query_strs))
            else:
                df = dfs[0]
                query_str = query_strs[0]

            if groupby or timestamp_exprs:
                df = df.reset_index()
                query_str += '.reset_index()'

            # Set the correct columns names and then reorder the columns
            # to match the requested order
            df.columns = groupby + timestamp_cols + apply_names + agg_names
            df = df[groupby + timestamp_cols + metrics + filtered_metrics]

            # Filtering of rows post-aggregation based on metrics
            # Note that the front end uses `having_druid` as the parameter
            # for post-aggregation filters, and we are reusing that
            # interface component.
            if extras.get('having_druid'):
                filter_str = self.get_filter_query(extras.get('having_druid'))
                df = df.query(filter_str)
                query_str += '.query("{filter_str}")'.format(
                    filter_str=filter_str)

            # Order by the first metric descending by default,
            # or within the existing orderby
            orderby.append((metrics + filtered_metrics)[0])
            ascending.append(metric_order_asc)

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
            if filtered_metrics:
                df = df.drop(filtered_metrics, axis=1)
                query_str += '.drop({filtered_metrics}, axis=1)'.format(
                    filtered_metrics=filtered_metrics)

        elif groupby:
            # Group by without any metrics is equivalent to SELECT DISTINCT,
            # order by the size descending by default, or within the
            # existing orderby
            orderby.append(0)
            ascending.append(not order_desc)
            # Use the group by as a tie breaker
            orderby = orderby + groupby
            ascending = ascending + ([True] * len(groupby))
            df = (df.groupby(groupby, sort=False)
                    .size()
                    .reset_index()
                    .sort_values(orderby, ascending=ascending)
                    .drop(0, axis=1))
            query_str += ('.groupby({groupby}, sort=False).size()'
                          '.reset_index()'
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
        logging.debug('query_obj: %s', query_obj)
        df = self.get_empty_dataframe()
        df, query_str = self.process_dataframe(df, **query_obj)
        logging.debug('query_str: %s', query_str)
        return query_str

    def query(self, query_obj):
        """Executes the query and returns a dataframe

        query_obj is a dictionary representing Superset's query interface.
        Should return a ``superset.models.helpers.QueryResult``
        """
        logging.debug('query_obj: %s', query_obj)
        qry_start_dttm = datetime.now()
        status = QueryStatus.SUCCESS
        error_message = None
        df = None
        query_str = ''
        try:
            df = self.get_dataframe()
            df, query_str = self.process_dataframe(df, **query_obj)
            logging.debug('query_str: %s', query_str)
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

        any_date_col = None
        dbcols = (
            db.session.query(PandasColumn)
            .filter(PandasColumn.datasource == self)
            .filter(or_(PandasColumn.column_name == col
                        for col in df.columns)))
        dbcols = {dbcol.column_name: dbcol for dbcol in dbcols}
        for col in df.columns:
            dbcol = dbcols.get(col, None)

            if not dbcol:
                dtype = df.dtypes[col].name
                # Pandas defaults columns where all values are None to a dtype of
                # float with all values as NaN, but if we can't correctly infer
                # the dtype we are better to assume object so we don't
                # create large numbers of unwanted Metrics
                if self.df[col].isnull().all():
                    dtype = 'object'
                dbcol = PandasColumn(column_name=str(col), type=dtype)
                # Only treat `object` as string if we have some data
                if self.df[col].notnull().any():
                    dbcol.groupby = dbcol.is_string
                    dbcol.filterable = dbcol.is_string
                dbcol.sum = dbcol.is_num
                dbcol.avg = dbcol.is_num
                dbcol.min = dbcol.is_num or dbcol.is_dttm
                dbcol.max = dbcol.is_num or dbcol.is_dttm
            self.columns.append(dbcol)

            if not any_date_col and dbcol.is_time:
                any_date_col = col

        # Datasource-level metrics
        # Note that column-specific metrics are created by reconcile_column_metrics
        # when the column is created.
        metrics = [
            PandasMetric(
                metric_name='count',
                verbose_name='count',
                metric_type='count',
                source=None,
                expression='count')]
        dbmetrics = (
            db.session.query(PandasMetric)
            .filter(PandasMetric.datasource == self)
            .filter(or_(PandasMetric.metric_name == metric.metric_name
                        for metric in metrics)))
        dbmetrics = {metric.metric_name: metric for metric in dbmetrics}
        for metric in metrics:
            if not dbmetrics.get(metric.metric_name, None):
                metric.pandas_datasource_id = self.id
                db.session.add(metric)

        if not self.main_dttm_col:
            self.main_dttm_col = any_date_col

        db.session.merge(self)
        db.session.commit()


def reconcile_column_metrics(mapper, connection, target):
    """
    Create or delete PandasMetrics to match the metric attributes
    specified on a PandasColumn
    """
    mtable = PandasMetric.__table__
    for metric_type in ('sum', 'avg', 'max', 'min', 'count_distinct'):
        # Set up the metric attributes
        metric_name = metric_type + '__' + target.column_name
        verbose_name = metric_name
        source = target.column_name
        if metric_type == 'avg':
            expression = 'mean',
        elif metric_type == 'count_distinct':
            expression = 'nunique'
        else:
            expression = metric_type

        if getattr(target, metric_type):
            # Create the metric if it doesn't already exist
            result = connection.execute(
                mtable
                .select()
                .where(
                    and_(
                        mtable.c.pandas_datasource_id == target.pandas_datasource_id,
                        mtable.c.metric_name == metric_name)))
            if not result.rowcount:
                connection.execute(
                    mtable.insert(),
                    pandas_datasource_id=target.pandas_datasource_id,
                    metric_name=metric_name,
                    verbose_name=verbose_name,
                    source=source,
                    expression=expression)
        else:
            # Delete the metric if it exists and hasn't been customized
            connection.execute(
                mtable
                .delete()
                .where(
                    and_(
                        mtable.c.pandas_datasource_id == target.pandas_datasource_id,
                        mtable.c.metric_name == metric_name,
                        mtable.c.verbose_name == verbose_name,
                        mtable.c.source == source,
                        mtable.c.expression == expression)))


def reconcile_metric_column(mapper, connection, target):
    """
    Clear the metric attribute on a PandasColumn if the
    corresponding PandasMetric is deleted
    """
    ctable = PandasColumn.__table__
    try:
        metric_type, column_name = target.metric_name.split('__', 1)
        if metric_type in ctable.c:
            connection.execute(
                ctable
                .update()
                .values(**{metric_type: False})
                .where(
                    and_(
                        ctable.c.pandas_datasource_id == target.pandas_datasource_id,
                        ctable.c.column_name == column_name)))
    except ValueError:
        # Metric name doesn't contain __
        pass


sa.event.listen(PandasColumn, 'after_insert', reconcile_column_metrics)
sa.event.listen(PandasColumn, 'after_update', reconcile_column_metrics)
sa.event.listen(PandasMetric, 'before_delete', reconcile_metric_column)
sa.event.listen(PandasDatasource, 'after_insert', set_perm)
sa.event.listen(PandasDatasource, 'after_update', set_perm)
