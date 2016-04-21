"""This module contains the "Viz" objects

These objects represent the backend of all the visualizations that
Caravel can render.
"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import hashlib
import json
import logging
import uuid
from collections import OrderedDict, defaultdict
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from flask import request, Markup
from markdown import markdown
from pandas.io.json import dumps
from six import string_types
from werkzeug.datastructures import ImmutableMultiDict
from werkzeug.urls import Href

from caravel import app, utils, cache
from caravel.forms import FormFactory
from caravel.utils import flasher

config = app.config


class BaseViz(object):

    """All visualizations derive this base class"""

    viz_type = None
    verbose_name = "Base Viz"
    credits = ""
    is_timeseries = False
    fieldsets = ({
        'label': None,
        'fields': (
            'metrics', 'groupby',
        )
    },)
    form_overrides = {}

    def __init__(self, datasource, form_data, slice_=None):
        self.orig_form_data = form_data
        if not datasource:
            raise Exception("Viz is missing a datasource")
        self.datasource = datasource
        self.request = request
        self.viz_type = form_data.get("viz_type")
        self.slice = slice_

        # TODO refactor all form related logic out of here and into forms.py
        ff = FormFactory(self)
        form_class = ff.get_form()
        defaults = form_class().data.copy()
        previous_viz_type = form_data.get('previous_viz_type')
        if isinstance(form_data, ImmutableMultiDict):
            form = form_class(form_data)
        else:
            form = form_class(**form_data)
        data = form.data.copy()

        if not form.validate():
            for k, v in form.errors.items():
                if not data.get('json') and not data.get('async'):
                    flasher("{}: {}".format(k, " ".join(v)), 'danger')
        if previous_viz_type != self.viz_type:
            data = {
                k: form.data[k]
                for k in form_data.keys()
                if k in form.data}
        defaults.update(data)
        self.form_data = defaults
        self.query = ""

        self.form_data['previous_viz_type'] = self.viz_type
        self.token = self.form_data.get(
            'token', 'token_' + uuid.uuid4().hex[:8])

        self.metrics = self.form_data.get('metrics') or []
        self.groupby = self.form_data.get('groupby') or []
        self.reassignments()

    def get_form_override(self, fieldname, attr):
        if (
                fieldname in self.form_overrides and
                attr in self.form_overrides[fieldname]):
            s = self.form_overrides[fieldname][attr]
            if attr == 'label':
                s = '<label for="{fieldname}">{s}</label>'.format(**locals())
                s = Markup(s)
            return s

    @classmethod
    def flat_form_fields(cls):
        l = set()
        for d in cls.fieldsets:
            for obj in d['fields']:
                if obj and isinstance(obj, (tuple, list)):
                    l |= {a for a in obj if a}
                elif obj:
                    l.add(obj)
        return tuple(l)

    def reassignments(self):
        pass

    def get_url(self, **kwargs):
        """Returns the URL for the viz"""
        d = self.orig_form_data.copy()
        if 'json' in d:
            del d['json']
        if 'action' in d:
            del d['action']
        d.update(kwargs)
        # Remove unchecked checkboxes because HTML is weird like that
        for key in d.keys():
            if d[key] is False:
                del d[key]
        href = Href(
            '/caravel/explore/{self.datasource.type}/'
            '{self.datasource.id}/'.format(**locals()))
        return href(d)

    def get_df(self, query_obj=None):
        """Returns a pandas dataframe based on the query object"""
        if not query_obj:
            query_obj = self.query_obj()

        self.error_msg = ""
        self.results = None

        # The datasource here can be different backend but the interface is common
        self.results = self.datasource.query(**query_obj)
        self.query = self.results.query
        df = self.results.df
        if df is None or df.empty:
            raise Exception("No data, review your incantations!")
        else:
            if 'timestamp' in df.columns:
                df.timestamp = pd.to_datetime(df.timestamp, utc=False)
                if self.datasource.offset:
                    df.timestamp += timedelta(hours=self.datasource.offset)
        df = df.fillna(0)
        return df

    @property
    def form(self):
        return self.form_class(**self.form_data)

    @property
    def form_class(self):
        return FormFactory(self).get_form()

    def query_filters(self):
        """Processes the filters for the query"""
        form_data = self.form_data
        # Building filters
        filters = []
        for i in range(1, 10):
            col = form_data.get("flt_col_" + str(i))
            op = form_data.get("flt_op_" + str(i))
            eq = form_data.get("flt_eq_" + str(i))
            if col and op and eq:
                filters.append((col, op, eq))

        # Extra filters (coming from dashboard)
        extra_filters = form_data.get('extra_filters')
        if extra_filters:
            extra_filters = json.loads(extra_filters)
            for slice_filters in extra_filters.values():
                for col, vals in slice_filters.items():
                    if col and vals:
                        filters += [(col, 'in', ",".join(vals))]
        return filters

    def query_obj(self):
        """Building a query object"""
        form_data = self.form_data
        groupby = form_data.get("groupby") or []
        metrics = form_data.get("metrics") or ['count']
        granularity = \
            form_data.get("granularity") or form_data.get("granularity_sqla")
        limit = int(form_data.get("limit", 0))
        row_limit = int(
            form_data.get("row_limit", config.get("ROW_LIMIT")))
        since = form_data.get("since", "1 year ago")
        from_dttm = utils.parse_human_datetime(since)
        if from_dttm > datetime.now():
            from_dttm = datetime.now() - (from_dttm-datetime.now())
        until = form_data.get("until", "now")
        to_dttm = utils.parse_human_datetime(until)
        if from_dttm > to_dttm:
            flasher("The date range doesn't seem right.", "danger")
            from_dttm = to_dttm  # Making them identical to not raise

        # extras are used to query elements specific to a datasource type
        # for instance the extra where clause that applies only to Tables
        extras = {
            'where': form_data.get("where", ''),
            'having': form_data.get("having", ''),
            'time_grain_sqla': form_data.get("time_grain_sqla", ''),
            'druid_time_origin': form_data.get("druid_time_origin", ''),
        }
        d = {
            'granularity': granularity,
            'from_dttm': from_dttm,
            'to_dttm': to_dttm,
            'is_timeseries': self.is_timeseries,
            'groupby': groupby,
            'metrics': metrics,
            'row_limit': row_limit,
            'filter': self.query_filters(),
            'timeseries_limit': limit,
            'extras': extras,
        }
        return d

    @property
    def cache_timeout(self):
        if self.slice and self.slice.cache_timeout:
            return self.slice.cache_timeout
        if self.datasource.cache_timeout:
            return self.datasource.cache_timeout
        if hasattr(self.datasource, 'database') \
                and self.datasource.database.cache_timeout:
            return self.datasource.database.cache_timeout
        return config.get("CACHE_DEFAULT_TIMEOUT")

    def get_json(self):
        """Handles caching around the json payload retrieval"""
        cache_key = self.cache_key
        payload = None
        if self.form_data.get('force') != 'true':
            payload = cache.get(cache_key)
        if payload:
            is_cached = True
            logging.info("Serving from cache")
        else:
            is_cached = False
            cache_timeout = self.cache_timeout
            payload = {
                'cache_timeout': cache_timeout,
                'csv_endpoint': self.csv_endpoint,
                'data': self.get_data(),
                'form_data': self.form_data,
                'json_endpoint': self.json_endpoint,
                'query': self.query,
                'standalone_endpoint': self.standalone_endpoint,
            }
            payload['cached_dttm'] = datetime.now().isoformat().split('.')[0]
            logging.info("Caching for the next {} seconds".format(
                cache_timeout))
            cache.set(cache_key, payload, timeout=self.cache_timeout)
        payload['is_cached'] = is_cached
        return self.json_dumps(payload)

    def json_dumps(self, obj):
        """Used by get_json, can be overridden to use specific switches"""
        return dumps(obj)

    @property
    def data(self):
        content = {
            'csv_endpoint': self.csv_endpoint,
            'form_data': self.form_data,
            'json_endpoint': self.json_endpoint,
            'standalone_endpoint': self.standalone_endpoint,
            'token': self.token,
            'viz_name': self.viz_type,
        }
        return content

    def get_csv(self):
        df = self.get_df()
        include_index = not isinstance(df.index, pd.RangeIndex)
        return df.to_csv(index=include_index)

    def get_data(self):
        return []

    @property
    def json_endpoint(self):
        return self.get_url(json="true")

    @property
    def cache_key(self):
        url = self.get_url(json="true", force="false")
        return hashlib.md5(url.encode('utf-8')).hexdigest()

    @property
    def csv_endpoint(self):
        return self.get_url(csv="true")

    @property
    def standalone_endpoint(self):
        return self.get_url(standalone="true")

    @property
    def json_data(self):
        return dumps(self.data)


class TableViz(BaseViz):

    """A basic html table that is sortable and searchable"""

    viz_type = "table"
    verbose_name = "Table View"
    credits = 'a <a href="https://github.com/airbnb/caravel">Caravel</a> original'
    fieldsets = ({
        'label': "Chart Options",
        'fields': (
            'row_limit',
            ('include_search', None),
        )
    }, {
        'label': "GROUP BY",
        'fields': (
            'groupby',
            'metrics',
        )
    }, {
        'label': "NOT GROUPED BY",
        'fields': (
            'all_columns',
        )
    })
    is_timeseries = False

    def query_obj(self):
        d = super(TableViz, self).query_obj()
        fd = self.form_data
        if fd.get('all_columns') and (fd.get('groupby') or fd.get('metrics')):
            raise Exception(
                "Choose either fields to [Group By] and [Metrics] or "
                "[Columns], not both")
        if fd.get('all_columns'):
            d['columns'] = fd.get('all_columns')
            d['groupby'] = []
        return d

    def get_df(self, query_obj=None):
        df = super(TableViz, self).get_df(query_obj)
        if (
                self.form_data.get("granularity") == "all" and
                'timestamp' in df):
            del df['timestamp']
        return df

    def get_data(self):
        df = self.get_df()
        return dict(
            records=df.to_dict(orient="records"),
            columns=list(df.columns),
        )

    def json_dumps(self, obj):
        return json.dumps(obj, default=utils.json_iso_dttm_ser)


class PivotTableViz(BaseViz):

    """A pivot table view, define your rows, columns and metrics"""

    viz_type = "pivot_table"
    verbose_name = "Pivot Table"
    credits = 'a <a href="https://github.com/airbnb/caravel">Caravel</a> original'
    is_timeseries = False
    fieldsets = ({
        'label': None,
        'fields': (
            'groupby',
            'columns',
            'metrics',
            'pandas_aggfunc',
        )
    },)

    def query_obj(self):
        d = super(PivotTableViz, self).query_obj()
        groupby = self.form_data.get('groupby')
        columns = self.form_data.get('columns')
        metrics = self.form_data.get('metrics')
        if not columns:
            columns = []
        if not groupby:
            groupby = []
        if not groupby:
            raise Exception("Please choose at least one \"Group by\" field ")
        if not metrics:
            raise Exception("Please choose at least one metric")
        if (
                any(v in groupby for v in columns) or
                any(v in columns for v in groupby)):
            raise Exception("groupby and columns can't overlap")

        d['groupby'] = list(set(groupby) | set(columns))
        return d

    def get_df(self, query_obj=None):
        df = super(PivotTableViz, self).get_df(query_obj)
        if (
                self.form_data.get("granularity") == "all" and
                'timestamp' in df):
            del df['timestamp']
        df = df.pivot_table(
            index=self.form_data.get('groupby'),
            columns=self.form_data.get('columns'),
            values=self.form_data.get('metrics'),
            aggfunc=self.form_data.get('pandas_aggfunc'),
            margins=True,
        )
        return df

    def get_data(self):
        return self.get_df().to_html(
            na_rep='',
            classes=(
                "dataframe table table-striped table-bordered "
                "table-condensed table-hover").split(" "))


class MarkupViz(BaseViz):

    """Use html or markdown to create a free form widget"""

    viz_type = "markup"
    verbose_name = "Markup Widget"
    fieldsets = ({
        'label': None,
        'fields': ('markup_type', 'code')
    },)
    is_timeseries = False

    def rendered(self):
        markup_type = self.form_data.get("markup_type")
        code = self.form_data.get("code", '')
        if markup_type == "markdown":
            return markdown(code)
        elif markup_type == "html":
            return code

    def get_data(self):
        return dict(html=self.rendered())


class WordCloudViz(BaseViz):

    """Build a colorful word cloud

    Uses the nice library at:
    https://github.com/jasondavies/d3-cloud
    """

    viz_type = "word_cloud"
    verbose_name = "Word Cloud"
    is_timeseries = False
    fieldsets = ({
        'label': None,
        'fields': (
            'series', 'metric', 'limit',
            ('size_from', 'size_to'),
            'rotation',
        )
    },)

    def query_obj(self):
        d = super(WordCloudViz, self).query_obj()

        d['metrics'] = [self.form_data.get('metric')]
        d['groupby'] = [self.form_data.get('series')]
        return d

    def get_data(self):
        df = self.get_df()
        # Ordering the columns
        df = df[[self.form_data.get('series'), self.form_data.get('metric')]]
        # Labeling the columns for uniform json schema
        df.columns = ['text', 'size']
        return df.to_dict(orient="records")


class TreemapViz(BaseViz):

    """Tree map visualisation for hierarchical data."""

    viz_type = "treemap"
    verbose_name = "Treemap"
    credits = '<a href="https://d3js.org">d3.js</a>'
    is_timeseries = False

    def get_df(self, query_obj=None):
        df = super(TreemapViz, self).get_df(query_obj)
        df = df.set_index(self.form_data.get("groupby"))
        return df

    def _nest(self, metric, df):
        nlevels = df.index.nlevels
        if nlevels == 1:
            result = [{"name": n, "value": v}
                      for n, v in zip(df.index, df[metric])]
        else:
            result = [{"name": l, "children": self._nest(metric, df.loc[l])}
                      for l in df.index.levels[0]]
        return result

    def get_data(self):
        df = self.get_df()
        chart_data = [{"name": metric, "children": self._nest(metric, df)}
                      for metric in df.columns]
        return chart_data


class NVD3Viz(BaseViz):

    """Base class for all nvd3 vizs"""

    credits = '<a href="http://nvd3.org/">NVD3.org</a>'
    viz_type = None
    verbose_name = "Base NVD3 Viz"
    is_timeseries = False


class BoxPlotViz(NVD3Viz):

    """Box plot viz from ND3"""

    viz_type = "box_plot"
    verbose_name = "Box Plot"
    sort_series = False
    is_timeseries = True
    fieldsets = ({
        'label': None,
        'fields': (
            'metrics',
            'groupby', 'limit',
        ),
    }, {
        'label': 'Chart Options',
        'fields': (
            'whisker_options',
        )
    },)

    def get_df(self, query_obj=None):
        form_data = self.form_data
        df = super(BoxPlotViz, self).get_df(query_obj)

        df = df.fillna(0)

        # conform to NVD3 names
        def Q1(series):  # need to be named functions - can't use lambdas
            return np.percentile(series, 25)

        def Q3(series):
            return np.percentile(series, 75)

        whisker_type = form_data.get('whisker_options')
        if whisker_type == "Tukey":

            def whisker_high(series):
                upper_outer_lim = Q3(series) + 1.5 * (Q3(series) - Q1(series))
                series = series[series <= upper_outer_lim]
                return series[np.abs(series - upper_outer_lim).argmin()]

            def whisker_low(series):
                lower_outer_lim = Q1(series) - 1.5 * (Q3(series) - Q1(series))
                # find the closest value above the lower outer limit
                series = series[series >= lower_outer_lim]
                return series[np.abs(series - lower_outer_lim).argmin()]

        elif whisker_type == "Min/max (no outliers)":

            def whisker_high(series):
                return series.max()

            def whisker_low(series):
                return series.min()

        elif " percentiles" in whisker_type:
            low, high = whisker_type.replace(" percentiles", "").split("/")

            def whisker_high(series):
                return np.percentile(series, int(high))

            def whisker_low(series):
                return np.percentile(series, int(low))

        else:
            raise ValueError("Unknown whisker type: {}".format(whisker_type))

        def outliers(series):
            above = series[series > whisker_high(series)]
            below = series[series < whisker_low(series)]
            # pandas sometimes doesn't like getting lists back here
            return set(above.tolist() + below.tolist())

        aggregate = [Q1, np.median, Q3, whisker_high, whisker_low, outliers]
        df = df.groupby(form_data.get('groupby')).agg(aggregate)
        return df

    def to_series(self, df, classed='', title_suffix=''):
        label_sep = " - "
        chart_data = []
        for index_value, row in zip(df.index, df.to_dict(orient="records")):
            if isinstance(index_value, tuple):
                index_value = label_sep.join(index_value)
            boxes = defaultdict(dict)
            for (label, key), value in row.items():
                if key == "median":
                    key = "Q2"
                boxes[label][key] = value
            for label, box in boxes.items():
                if len(self.form_data.get("metrics")) > 1:
                    # need to render data labels with metrics
                    chart_label = label_sep.join([index_value, label])
                else:
                    chart_label = index_value
                chart_data.append({
                    "label": chart_label,
                    "values": box,
                })
        return chart_data

    def get_data(self):
        df = self.get_df()
        chart_data = self.to_series(df)
        return chart_data


class BubbleViz(NVD3Viz):

    """Based on the NVD3 bubble chart"""

    viz_type = "bubble"
    verbose_name = "Bubble Chart"
    is_timeseries = False
    fieldsets = ({
        'label': None,
        'fields': (
            'series', 'entity',
            'x', 'y',
            'size', 'limit',
        )
    }, {
        'label': 'Chart Options',
        'fields': (
            ('x_log_scale', 'y_log_scale'),
            ('show_legend', None),
            'max_bubble_size',
        )
    },)

    def query_obj(self):
        form_data = self.form_data
        d = super(BubbleViz, self).query_obj()
        d['groupby'] = list({
            form_data.get('series'),
            form_data.get('entity')
        })
        self.x_metric = form_data.get('x')
        self.y_metric = form_data.get('y')
        self.z_metric = form_data.get('size')
        self.entity = form_data.get('entity')
        self.series = form_data.get('series')

        d['metrics'] = [
            self.z_metric,
            self.x_metric,
            self.y_metric,
        ]
        if not all(d['metrics'] + [self.entity, self.series]):
            raise Exception("Pick a metric for x, y and size")
        return d

    def get_df(self, query_obj=None):
        df = super(BubbleViz, self).get_df(query_obj)
        df = df.fillna(0)
        df['x'] = df[[self.x_metric]]
        df['y'] = df[[self.y_metric]]
        df['size'] = df[[self.z_metric]]
        df['shape'] = 'circle'
        df['group'] = df[[self.series]]
        return df

    def get_data(self):
        df = self.get_df()
        series = defaultdict(list)
        for row in df.to_dict(orient='records'):
            series[row['group']].append(row)
        chart_data = []
        for k, v in series.items():
            chart_data.append({
                'key': k,
                'values': v})
        return chart_data


class BigNumberViz(BaseViz):

    """Put emphasis on a single metric with this big number viz"""

    viz_type = "big_number"
    verbose_name = "Big Number with Trendline"
    credits = 'a <a href="https://github.com/airbnb/caravel">Caravel</a> original'
    is_timeseries = True
    fieldsets = ({
        'label': None,
        'fields': (
            'metric',
            'compare_lag',
            'compare_suffix',
            'y_axis_format',
        )
    },)
    form_overrides = {
        'y_axis_format': {
            'label': 'Number format',
        }
    }

    def reassignments(self):
        metric = self.form_data.get('metric')
        if not metric:
            self.form_data['metric'] = self.orig_form_data.get('metrics')

    def query_obj(self):
        d = super(BigNumberViz, self).query_obj()
        metric = self.form_data.get('metric')
        if not metric:
            raise Exception("Pick a metric!")
        d['metrics'] = [self.form_data.get('metric')]
        self.form_data['metric'] = metric
        return d

    def get_data(self):
        form_data = self.form_data
        df = self.get_df()
        df.sort(columns=df.columns[0], inplace=True)
        compare_lag = form_data.get("compare_lag", "")
        compare_lag = int(compare_lag) if compare_lag and compare_lag.isdigit() else 0
        return {
            'data': df.values.tolist(),
            'compare_lag': compare_lag,
            'compare_suffix': form_data.get('compare_suffix', ''),
        }


class BigNumberTotalViz(BaseViz):

    """Put emphasis on a single metric with this big number viz"""

    viz_type = "big_number_total"
    verbose_name = "Big Number"
    credits = 'a <a href="https://github.com/airbnb/caravel">Caravel</a> original'
    is_timeseries = False
    fieldsets = ({
        'label': None,
        'fields': (
            'metric',
            'subheader',
            'y_axis_format',
        )
    },)
    form_overrides = {
        'y_axis_format': {
            'label': 'Number format',
        }
    }

    def reassignments(self):
        metric = self.form_data.get('metric')
        if not metric:
            self.form_data['metric'] = self.orig_form_data.get('metrics')

    def query_obj(self):
        d = super(BigNumberTotalViz, self).query_obj()
        metric = self.form_data.get('metric')
        if not metric:
            raise Exception("Pick a metric!")
        d['metrics'] = [self.form_data.get('metric')]
        self.form_data['metric'] = metric
        return d

    def get_data(self):
        form_data = self.form_data
        df = self.get_df()
        df = df.sort(columns=df.columns[0])
        return {
            'data': df.values.tolist(),
            'subheader': form_data.get('subheader', ''),
        }


class NVD3TimeSeriesViz(NVD3Viz):

    """A rich line chart component with tons of options"""

    viz_type = "line"
    verbose_name = "Time Series - Line Chart"
    sort_series = False
    is_timeseries = True
    fieldsets = ({
        'label': None,
        'fields': (
            'metrics',
            'groupby', 'limit',
        ),
    }, {
        'label': 'Chart Options',
        'fields': (
            ('show_brush', 'show_legend'),
            ('rich_tooltip', 'y_axis_zero'),
            ('y_log_scale', 'contribution'),
            ('x_axis_format', 'y_axis_format'),
            ('line_interpolation', 'x_axis_showminmax'),
        ),
    }, {
        'label': 'Advanced Analytics',
        'description': (
            "This section contains options "
            "that allow for advanced analytical post processing "
            "of query results"),
        'fields': (
            ('rolling_type', 'rolling_periods'),
            'time_compare',
            'num_period_compare',
            None,
            ('resample_how', 'resample_rule',), 'resample_fillmethod'
        ),
    },)

    def get_df(self, query_obj=None):
        form_data = self.form_data
        df = super(NVD3TimeSeriesViz, self).get_df(query_obj)

        df = df.fillna(0)
        if form_data.get("granularity") == "all":
            raise Exception("Pick a time granularity for your time series")

        df = df.pivot_table(
            index="timestamp",
            columns=form_data.get('groupby'),
            values=form_data.get('metrics'))

        fm = form_data.get("resample_fillmethod")
        if not fm:
            fm = None
        how = form_data.get("resample_how")
        rule = form_data.get("resample_rule")
        if how and rule:
            df = df.resample(rule, how=how, fill_method=fm)
            if not fm:
                df = df.fillna(0)

        if self.sort_series:
            dfs = df.sum()
            dfs.sort(ascending=False)
            df = df[dfs.index]

        if form_data.get("contribution"):
            dft = df.T
            df = (dft / dft.sum()).T

        num_period_compare = form_data.get("num_period_compare")
        if num_period_compare:
            num_period_compare = int(num_period_compare)
            df = (df / df.shift(num_period_compare)) - 1
            df = df[num_period_compare:]

        rolling_periods = form_data.get("rolling_periods")
        rolling_type = form_data.get("rolling_type")

        if rolling_type in ('mean', 'std', 'sum') and rolling_periods:
            if rolling_type == 'mean':
                df = pd.rolling_mean(df, int(rolling_periods), min_periods=0)
            elif rolling_type == 'std':
                df = pd.rolling_std(df, int(rolling_periods), min_periods=0)
            elif rolling_type == 'sum':
                df = pd.rolling_sum(df, int(rolling_periods), min_periods=0)
        elif rolling_type == 'cumsum':
            df = df.cumsum()
        return df

    def to_series(self, df, classed='', title_suffix=''):
        series = df.to_dict('series')

        chart_data = []
        for name in df.T.index.tolist():
            ys = series[name]
            if df[name].dtype.kind not in "biufc":
                continue
            df['timestamp'] = pd.to_datetime(df.index, utc=False)
            if isinstance(name, string_types):
                series_title = name
            else:
                name = ["{}".format(s) for s in name]
                if len(self.form_data.get('metrics')) > 1:
                    series_title = ", ".join(name)
                else:
                    series_title = ", ".join(name[1:])
            if title_suffix:
                series_title += title_suffix

            d = {
                "key": series_title,
                "classed": classed,
                "values": [{'x': ds, 'y': ys[ds]} for ds in df.timestamp],
            }
            chart_data.append(d)
        return chart_data

    def get_data(self):
        df = self.get_df()
        chart_data = self.to_series(df)

        time_compare = self.form_data.get('time_compare')
        if time_compare:
            query_object = self.query_obj()
            delta = utils.parse_human_timedelta(time_compare)
            query_object['inner_from_dttm'] = query_object['from_dttm']
            query_object['inner_to_dttm'] = query_object['to_dttm']
            query_object['from_dttm'] -= delta
            query_object['to_dttm'] -= delta

            df2 = self.get_df(query_object)
            df2.index += delta
            chart_data += self.to_series(
                df2, classed='caravel', title_suffix="---")
            chart_data = sorted(chart_data, key=lambda x: x['key'])
        return chart_data


class NVD3TimeSeriesBarViz(NVD3TimeSeriesViz):

    """A bar chart where the x axis is time"""

    viz_type = "bar"
    sort_series = True
    verbose_name = "Time Series - Bar Chart"
    fieldsets = [NVD3TimeSeriesViz.fieldsets[0]] + [{
        'label': 'Chart Options',
        'fields': (
            ('show_brush', 'show_legend'),
            ('rich_tooltip', 'y_axis_zero'),
            ('y_log_scale', 'contribution'),
            ('x_axis_format', 'y_axis_format'),
            ('line_interpolation', 'bar_stacked'),
            ('x_axis_showminmax', None),
        ), }] + [NVD3TimeSeriesViz.fieldsets[2]]


class NVD3CompareTimeSeriesViz(NVD3TimeSeriesViz):

    """A line chart component where you can compare the % change over time"""

    viz_type = 'compare'
    verbose_name = "Time Series - Percent Change"


class NVD3TimeSeriesStackedViz(NVD3TimeSeriesViz):

    """A rich stack area chart"""

    viz_type = "area"
    verbose_name = "Time Series - Stacked"
    sort_series = True
    fieldsets = [NVD3TimeSeriesViz.fieldsets[0]] + [{
        'label': 'Chart Options',
        'fields': (
            ('show_brush', 'show_legend'),
            ('rich_tooltip', 'y_axis_zero'),
            ('y_log_scale', 'contribution'),
            ('x_axis_format', 'y_axis_format'),
            ('x_axis_showminmax'),
            ('line_interpolation', 'stacked_style'),
        ), }] + [NVD3TimeSeriesViz.fieldsets[2]]


class DistributionPieViz(NVD3Viz):

    """Annoy visualization snobs with this controversial pie chart"""

    viz_type = "pie"
    verbose_name = "Distribution - NVD3 - Pie Chart"
    is_timeseries = False
    fieldsets = ({
        'label': None,
        'fields': (
            'metrics', 'groupby',
            'limit',
            ('donut', 'show_legend'),
        )
    },)

    def query_obj(self):
        d = super(DistributionPieViz, self).query_obj()
        d['is_timeseries'] = False
        return d

    def get_df(self, query_obj=None):
        df = super(DistributionPieViz, self).get_df(query_obj)
        df = df.pivot_table(
            index=self.groupby,
            values=[self.metrics[0]])
        df.sort(self.metrics[0], ascending=False, inplace=True)
        return df

    def get_data(self):
        df = self.get_df()
        df = df.reset_index()
        df.columns = ['x', 'y']
        return df.to_dict(orient="records")


class DistributionBarViz(DistributionPieViz):

    """A good old bar chart"""

    viz_type = "dist_bar"
    verbose_name = "Distribution - Bar Chart"
    is_timeseries = False
    fieldsets = ({
        'label': 'Chart Options',
        'fields': (
            'groupby',
            'columns',
            'metrics',
            'row_limit',
            ('show_legend', 'bar_stacked'),
            ('y_axis_format', None),
        )
    },)
    form_overrides = {
        'groupby': {
            'label': 'Series',
        },
        'columns': {
            'label': 'Breakdowns',
            'description': "Defines how each series is broken down",
        },
    }

    def query_obj(self):
        d = super(DistributionPieViz, self).query_obj()  # noqa
        fd = self.form_data
        d['is_timeseries'] = False
        gb = fd.get('groupby') or []
        cols = fd.get('columns') or []
        d['groupby'] = set(gb + cols)
        if len(d['groupby']) < len(gb) + len(cols):
            raise Exception("Can't have overlap between Series and Breakdowns")
        if not self.metrics:
            raise Exception("Pick at least one metric")
        if not self.groupby:
            raise Exception("Pick at least one field for [Series]")
        return d

    def get_df(self, query_obj=None):
        df = super(DistributionPieViz, self).get_df(query_obj)  # noqa
        fd = self.form_data

        row = df.groupby(self.groupby).sum()[self.metrics[0]].copy()
        row.sort(ascending=False)
        columns = fd.get('columns') or []
        pt = df.pivot_table(
            index=self.groupby,
            columns=columns,
            values=self.metrics)
        pt = pt.reindex(row.index)
        return pt

    def get_data(self):
        df = self.get_df()
        chart_data = []
        for name, ys in df.iteritems():
            if df[name].dtype.kind not in "biufc":
                continue
            if isinstance(name, string_types):
                series_title = name
            elif len(self.metrics) > 1:
                series_title = ", ".join(name)
            else:
                l = [str(s) for s in name[1:]]
                series_title = ", ".join(l)
            d = {
                "key": series_title,
                "values": [
                    {'x': i, 'y': v}
                    for i, v in ys.iteritems()]
            }
            chart_data.append(d)
        return chart_data


class SunburstViz(BaseViz):

    """A multi level sunburst chart"""

    viz_type = "sunburst"
    verbose_name = "Sunburst"
    is_timeseries = False
    credits = (
        'Kerry Rodden '
        '@<a href="https://bl.ocks.org/kerryrodden/7090426">bl.ocks.org</a>')
    fieldsets = ({
        'label': None,
        'fields': (
            'groupby',
            'metric', 'secondary_metric',
            'row_limit',
        )
    },)
    form_overrides = {
        'metric': {
            'label': 'Primary Metric',
            'description': (
                "The primary metric is used to "
                "define the arc segment sizes"),
        },
        'secondary_metric': {
            'label': 'Secondary Metric',
            'description': (
                "This secondary metric is used to "
                "define the color as a ratio against the primary metric. "
                "If the two metrics match, color is mapped level groups"),
        },
        'groupby': {
            'label': 'Hierarchy',
            'description': "This defines the level of the hierarchy",
        },
    }

    def get_df(self, query_obj=None):
        df = super(SunburstViz, self).get_df(query_obj)
        return df

    def get_data(self):
        df = self.get_df()

        # if m1 == m2 duplicate the metric column
        cols = self.form_data.get('groupby')
        metric = self.form_data.get('metric')
        secondary_metric = self.form_data.get('secondary_metric')
        if metric == secondary_metric:
            ndf = df[cols]
            ndf['m1'] = df[metric]
            ndf['m2'] = df[metric]
        else:
            cols += [
                self.form_data['metric'], self.form_data['secondary_metric']]
            ndf = df[cols]
        return json.loads(ndf.to_json(orient="values"))  # TODO fix this nonsense

    def query_obj(self):
        qry = super(SunburstViz, self).query_obj()
        qry['metrics'] = [
            self.form_data['metric'], self.form_data['secondary_metric']]
        return qry


class SankeyViz(BaseViz):

    """A Sankey diagram that requires a parent-child dataset"""

    viz_type = "sankey"
    verbose_name = "Sankey"
    is_timeseries = False
    credits = '<a href="https://www.npmjs.com/package/d3-sankey">d3-sankey on npm</a>'
    fieldsets = ({
        'label': None,
        'fields': (
            'groupby',
            'metric',
            'row_limit',
        )
    },)
    form_overrides = {
        'groupby': {
            'label': 'Source / Target',
            'description': "Choose a source and a target",
        },
    }

    def query_obj(self):
        qry = super(SankeyViz, self).query_obj()
        if len(qry['groupby']) != 2:
            raise Exception("Pick exactly 2 columns as [Source / Target]")
        qry['metrics'] = [
            self.form_data['metric']]
        return qry

    def get_data(self):
        df = self.get_df()
        df.columns = ['source', 'target', 'value']
        recs = df.to_dict(orient='records')

        hierarchy = defaultdict(set)
        for row in recs:
            hierarchy[row['source']].add(row['target'])

        def find_cycle(g):
            """Whether there's a cycle in a directed graph"""
            path = set()

            def visit(vertex):
                path.add(vertex)
                for neighbour in g.get(vertex, ()):
                    if neighbour in path or visit(neighbour):
                        return (vertex, neighbour)
                path.remove(vertex)

            for v in g:
                cycle = visit(v)
                if cycle:
                    return cycle

        cycle = find_cycle(hierarchy)
        if cycle:
            raise Exception(
                "There's a loop in your Sankey, please provide a tree. "
                "Here's a faulty link: {}".format(cycle))
        return recs


class DirectedForceViz(BaseViz):

    """An animated directed force layout graph visualization"""

    viz_type = "directed_force"
    verbose_name = "Directed Force Layout"
    credits = 'd3noob @<a href="http://bl.ocks.org/d3noob/5141278">bl.ocks.org</a>'
    is_timeseries = False
    fieldsets = ({
        'label': None,
        'fields': (
            'groupby',
            'metric',
            'row_limit',
        )
    }, {
        'label': 'Force Layout',
        'fields': (
            'link_length',
            'charge',
        )
    },)
    form_overrides = {
        'groupby': {
            'label': 'Source / Target',
            'description': "Choose a source and a target",
        },
    }

    def query_obj(self):
        qry = super(DirectedForceViz, self).query_obj()
        if len(self.form_data['groupby']) != 2:
            raise Exception("Pick exactly 2 columns to 'Group By'")
        qry['metrics'] = [self.form_data['metric']]
        return qry

    def get_data(self):
        df = self.get_df()
        df.columns = ['source', 'target', 'value']
        return df.to_dict(orient='records')


class WorldMapViz(BaseViz):

    """A country centric world map"""

    viz_type = "world_map"
    verbose_name = "World Map"
    is_timeseries = False
    credits = 'datamaps on <a href="https://www.npmjs.com/package/datamaps">npm</a>'
    fieldsets = ({
        'label': None,
        'fields': (
            'entity',
            'country_fieldtype',
            'metric',
        )
    }, {
        'label': 'Bubbles',
        'fields': (
            ('show_bubbles', None),
            'secondary_metric',
            'max_bubble_size',
        )
    })
    form_overrides = {
        'entity': {
            'label': 'Country Field',
            'description': "3 letter code of the country",
        },
        'metric': {
            'label': 'Metric for color',
            'description': ("Metric that defines the color of the country"),
        },
        'secondary_metric': {
            'label': 'Bubble size',
            'description': ("Metric that defines the size of the bubble"),
        },
    }

    def query_obj(self):
        qry = super(WorldMapViz, self).query_obj()
        qry['metrics'] = [
            self.form_data['metric'], self.form_data['secondary_metric']]
        qry['groupby'] = [self.form_data['entity']]
        return qry

    def get_data(self):
        from caravel.data import countries
        df = self.get_df()
        cols = [self.form_data.get('entity')]
        metric = self.form_data.get('metric')
        secondary_metric = self.form_data.get('secondary_metric')
        if metric == secondary_metric:
            ndf = df[cols]
            ndf['m1'] = df[metric]
            ndf['m2'] = df[metric]
        else:
            cols += [metric, secondary_metric]
            ndf = df[cols]
        df = ndf
        df.columns = ['country', 'm1', 'm2']
        d = df.to_dict(orient='records')
        for row in d:
            country = countries.get(
                self.form_data.get('country_fieldtype'), row['country'])
            if country:
                row['country'] = country['cca3']
                row['latitude'] = country['lat']
                row['longitude'] = country['lng']
                row['name'] = country['name']
            else:
                row['country'] = "XXX"
        return d


class FilterBoxViz(BaseViz):

    """A multi filter, multi-choice filter box to make dashboards interactive"""

    viz_type = "filter_box"
    verbose_name = "Filters"
    is_timeseries = False
    credits = 'a <a href="https://github.com/airbnb/caravel">Caravel</a> original'
    fieldsets = ({
        'label': None,
        'fields': (
            'groupby',
            'metric',
        )
    },)
    form_overrides = {
        'groupby': {
            'label': 'Filter fields',
            'description': "The fields you want to filter on",
        },
    }

    def query_obj(self):
        qry = super(FilterBoxViz, self).query_obj()
        groupby = self.form_data['groupby']
        if len(groupby) < 1:
            raise Exception("Pick at least one filter field")
        qry['metrics'] = [
            self.form_data['metric']]
        return qry

    def get_data(self):
        qry = self.query_obj()
        filters = [g for g in qry['groupby']]
        d = {}
        for flt in filters:
            qry['groupby'] = [flt]
            df = super(FilterBoxViz, self).get_df(qry)
            d[flt] = [{
                'id': row[0],
                'text': row[0],
                'filter': flt,
                'metric': row[1]}
                for row in df.itertuples(index=False)
            ]
        return d


class IFrameViz(BaseViz):

    """You can squeeze just about anything in this iFrame component"""

    viz_type = "iframe"
    verbose_name = "iFrame"
    credits = 'a <a href="https://github.com/airbnb/caravel">Caravel</a> original'
    is_timeseries = False
    fieldsets = ({
        'label': None,
        'fields': ('url',)
    },)


class ParallelCoordinatesViz(BaseViz):

    """Interactive parallel coordinate implementation

    Uses this amazing javascript library
    https://github.com/syntagmatic/parallel-coordinates
    """

    viz_type = "para"
    verbose_name = "Parallel Coordinates"
    credits = (
        '<a href="https://syntagmatic.github.io/parallel-coordinates/">'
        'Syntagmatic\'s library</a>')
    is_timeseries = False
    fieldsets = ({
        'label': None,
        'fields': (
            'series',
            'metrics',
            'secondary_metric',
            'limit',
            ('show_datatable', None),
        )
    },)

    def query_obj(self):
        d = super(ParallelCoordinatesViz, self).query_obj()
        fd = self.form_data
        d['metrics'] = fd.get('metrics')
        second = fd.get('secondary_metric')
        if second not in d['metrics']:
            d['metrics'] += [second]
        d['groupby'] = [fd.get('series')]
        return d

    def get_data(self):
        df = self.get_df()
        df = df[[self.form_data.get('series')] + self.form_data.get('metrics')]
        return df.to_dict(orient="records")


class HeatmapViz(BaseViz):

    """A nice heatmap visualization that support high density through canvas"""

    viz_type = "heatmap"
    verbose_name = "Heatmap"
    is_timeseries = False
    credits = (
        'inspired from mbostock @<a href="http://bl.ocks.org/mbostock/3074470">'
        'bl.ocks.org</a>')
    fieldsets = ({
        'label': None,
        'fields': (
            'all_columns_x',
            'all_columns_y',
            'metric',
        )
    }, {
        'label': 'Heatmap Options',
        'fields': (
            'linear_color_scheme',
            ('xscale_interval', 'yscale_interval'),
            'canvas_image_rendering',
            'normalize_across',
        )
    },)

    def query_obj(self):
        d = super(HeatmapViz, self).query_obj()
        fd = self.form_data
        d['metrics'] = [fd.get('metric')]
        d['groupby'] = [fd.get('all_columns_x'), fd.get('all_columns_y')]
        return d

    def get_data(self):
        df = self.get_df()
        fd = self.form_data
        x = fd.get('all_columns_x')
        y = fd.get('all_columns_y')
        v = fd.get('metric')
        if x == y:
            df.columns = ['x', 'y', 'v']
        else:
            df = df[[x, y, v]]
            df.columns = ['x', 'y', 'v']
        norm = fd.get('normalize_across')
        overall = False
        if norm == 'heatmap':
            overall = True
        else:
            gb = df.groupby(norm, group_keys=False)
            if len(gb) <= 1:
                overall = True
            else:
                df['perc'] = (
                    gb.apply(
                        lambda x: (x.v - x.v.min()) / (x.v.max() - x.v.min()))
                )
        if overall:
            v = df.v
            min_ = v.min()
            df['perc'] = (v - min_) / (v.max() - min_)
        return df.to_dict(orient="records")


viz_types_list = [
    TableViz,
    PivotTableViz,
    NVD3TimeSeriesViz,
    NVD3CompareTimeSeriesViz,
    NVD3TimeSeriesStackedViz,
    NVD3TimeSeriesBarViz,
    DistributionBarViz,
    DistributionPieViz,
    BubbleViz,
    MarkupViz,
    WordCloudViz,
    BigNumberViz,
    BigNumberTotalViz,
    SunburstViz,
    DirectedForceViz,
    SankeyViz,
    WorldMapViz,
    FilterBoxViz,
    IFrameViz,
    ParallelCoordinatesViz,
    HeatmapViz,
    BoxPlotViz,
    TreemapViz,
]

viz_types = OrderedDict([(v.viz_type, v) for v in viz_types_list
                         if v.viz_type not in config.get('VIZ_TYPE_BLACKLIST')])
