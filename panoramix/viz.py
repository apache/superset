from collections import OrderedDict, defaultdict
from datetime import datetime
import json
import uuid

from flask import flash
from markdown import markdown
from pandas.io.json import dumps
from werkzeug.datastructures import MultiDict
from werkzeug.urls import Href
import numpy as np
import pandas as pd

from panoramix import app, utils
from panoramix.forms import form_factory

config = app.config

CHART_ARGS = {
    'title': None,
}


class BaseViz(object):
    verbose_name = "Base Viz"
    template = None
    form_fields = [
        'viz_type', 'metrics', 'groupby', 'granularity',
        ('since', 'until')]
    js_files = []
    css_files = []

    def __init__(self, datasource, form_data):
        self.datasource = datasource
        if isinstance(form_data, MultiDict):
            self.args = form_data.to_dict(flat=False)
        else:
            self.args = form_data
        self.form_data = form_data
        self.token = self.args.get('token', 'token_' + uuid.uuid4().hex[:8])

        as_list = ('metrics', 'groupby')
        for k, v in self.args.items():
            if k in as_list and not isinstance(v, list):
                self.args[k] = [v]
            elif k not in as_list and isinstance(v, list) and v:
                self.args[k] = v[0]

        self.metrics = self.args.get('metrics') or ['count']
        self.groupby = self.args.get('groupby') or []

    def get_url(self, **kwargs):
        d = self.args.copy()
        if 'action' in d:
            del d['action']
        d.update(kwargs)
        href = Href(
            '/panoramix/datasource/{self.datasource.type}/'
            '{self.datasource.id}/'.format(**locals()))
        return href(d)

    def get_df(self):
        self.error_msg = ""
        self.results = None

        self.results = self.bake_query()
        df = self.results.df
        if df is None or df.empty:
            raise Exception("No data, review your incantations!")
        else:
            if 'timestamp' in df.columns:
                df.timestamp = pd.to_datetime(df.timestamp)
        return df

    @property
    def form(self):
        return self.form_class(self.form_data)

    @property
    def form_class(self):
        return form_factory(self)

    def query_filters(self):
        args = self.args
        # Building filters
        filters = []
        for i in range(1, 10):
            col = args.get("flt_col_" + str(i))
            op = args.get("flt_op_" + str(i))
            eq = args.get("flt_eq_" + str(i))
            if col and op and eq:
                filters.append((col, op, eq))
        return filters

    def bake_query(self):
        return self.datasource.query(**self.query_obj())

    def query_obj(self):
        """
        Building a query object
        """
        args = self.args
        groupby = args.get("groupby") or []
        metrics = args.get("metrics") or ['count']
        granularity = args.get("granularity", "1 day")
        if granularity != "all":
            granularity = utils.parse_human_timedelta(
                granularity).total_seconds() * 1000
        limit = int(args.get("limit", 0))
        row_limit = int(
            args.get("row_limit", config.get("ROW_LIMIT")))
        since = args.get("since", "1 year ago")
        from_dttm = utils.parse_human_datetime(since)
        if from_dttm > datetime.now():
            from_dttm = datetime.now() - (from_dttm-datetime.now())
        until = args.get("until", "now")
        to_dttm = utils.parse_human_datetime(until)
        if from_dttm >= to_dttm:
            flash("The date range doesn't seem right.", "danger")
            from_dttm = to_dttm  # Making them identical to not raise

        # extras are used to query elements specific to a datasource type
        # for instance the extra where clause that applies only to Tables
        extras = {
            'where': args.get("where", '')
        }
        d = {
            'granularity': granularity,
            'from_dttm': from_dttm,
            'to_dttm': to_dttm,
            'is_timeseries': True,
            'groupby': groupby,
            'metrics': metrics,
            'row_limit': row_limit,
            'filter': self.query_filters(),
            'timeseries_limit': limit,
            'extras': extras,
        }
        return d


class TableViz(BaseViz):
    verbose_name = "Table View"
    template = 'panoramix/viz_table.html'
    form_fields = BaseViz.form_fields + ['row_limit']
    css_files = ['dataTables.bootstrap.css']
    js_files = ['jquery.dataTables.min.js', 'dataTables.bootstrap.js']

    def query_obj(self):
        d = super(TableViz, self).query_obj()
        d['is_timeseries'] = False
        d['timeseries_limit'] = None
        return d

    def get_df(self):
        df = super(TableViz, self).get_df()
        if (
                self.form_data.get("granularity") == "all" and
                'timestamp' in df):
            del df['timestamp']
        for m in self.metrics:
            df[m + '__perc'] = np.rint((df[m] / np.max(df[m])) * 100)
        return df


class MarkupViz(BaseViz):
    verbose_name = "Markup Widget"
    template = 'panoramix/viz_markup.html'
    form_fields = ['viz_type', 'markup_type', 'code']

    def rendered(self):
        markup_type = self.form_data.get("markup_type")
        code = self.form_data.get("code", '')
        if markup_type == "markdown":
            return markdown(code)
        elif markup_type == "html":
            return code


class WordCloudViz(BaseViz):
    """
    Integration with the nice library at:
    https://github.com/jasondavies/d3-cloud
    """
    verbose_name = "Word Cloud"
    template = 'panoramix/viz_word_cloud.html'
    form_fields = [
        'viz_type',
        ('since', 'until'),
        'groupby', 'metric', 'limit',
        ('size_from', 'size_to'),
        'rotation',
    ]
    js_files = ['d3.layout.cloud.js']

    def query_obj(self):
        d = super(WordCloudViz, self).query_obj()
        d['granularity'] = 'all'
        metric = self.args.get('metric')
        if not metric:
            raise Exception("Pick a metric!")
        d['metrics'] = [self.args.get('metric')]
        d['groupby'] = [d['groupby'][0]]
        return d

    def get_json(self):
        df = self.get_df()
        df.columns = ['text', 'size']
        return df.to_json(orient="records")


class NVD3Viz(BaseViz):
    verbose_name = "Base NVD3 Viz"
    template = 'panoramix/viz_nvd3.html'
    chart_kind = 'line'
    js_files = ['nv.d3.min.js']
    css_files = ['nv.d3.css']


class BubbleViz(NVD3Viz):
    verbose_name = "Bubble Chart"
    chart_type = 'bubble'
    form_fields = [
        'viz_type',
        ('since', 'until'),
        ('series', 'entity'),
        ('x', 'y'),
        ('size', 'limit'),
        ('x_log_scale', 'y_log_scale'),
        ('show_legend', None),
    ]

    def query_obj(self):
        args = self.form_data
        d = super(BubbleViz, self).query_obj()
        d['granularity'] = 'all'
        d['groupby'] = list({
            args.get('series'),
            args.get('entity')
        })
        self.x_metric = args.get('x')
        self.y_metric = args.get('y')
        self.z_metric = args.get('size')
        self.entity = args.get('entity')
        self.series = args.get('series')
        d['metrics'] = [
            self.z_metric,
            self.x_metric,
            self.y_metric,
        ]
        if not all(d['metrics'] + [self.entity, self.series]):
            raise Exception("Pick a metric for x, y and size")
        return d

    def get_df(self):
        df = super(BubbleViz, self).get_df()
        df = df.fillna(0)
        df['x'] = df[[self.x_metric]]
        df['y'] = df[[self.y_metric]]
        df['size'] = df[[self.z_metric]]
        df['shape'] = 'circle'
        df['group'] = df[[self.series]]
        return df

    def get_json(self):
        df = self.get_df()
        series = defaultdict(list)
        for row in df.to_dict(orient='records'):
            series[row['group']].append(row)
        data = []
        for k, v in series.items():
            data.append({
                'key': k,
                "color": utils.color(k),
                'values': v })
        return json.dumps(data)

class BigNumberViz(BaseViz):
    verbose_name = "Big Number"
    template = 'panoramix/viz_bignumber.html'
    js_files = ['d3.min.js']
    form_fields = [
        'viz_type',
        'granularity',
        ('since', 'until'),
        'metric',
        'compare_lag',
        'compare_suffix',
        #('rolling_type', 'rolling_periods'),
    ]

    def query_obj(self):
        d = super(BigNumberViz, self).query_obj()
        metric = self.args.get('metric')
        if not metric:
            raise Exception("Pick a metric!")
        d['metrics'] = [self.args.get('metric')]
        return d

    def get_json(self):
        args = self.args
        df = self.get_df()
        df = df.sort(columns=df.columns[0])
        df['timestamp'] = df[[0]].astype(np.int64) // 10**9
        compare_lag = args.get("compare_lag", "")
        compare_lag = int(compare_lag) if compare_lag.isdigit() else 0
        d = {
            'data': df.values.tolist(),
            'compare_lag': compare_lag,
            'compare_suffix': args.get('compare_suffix', ''),
        }
        return json.dumps(d)


class NVD3TimeSeriesViz(NVD3Viz):
    verbose_name = "Time Series - Line Chart"
    chart_type = "nvd3_line"
    sort_series = False
    form_fields = [
        'viz_type',
        'granularity', ('since', 'until'),
        'metrics',
        'groupby', 'limit',
        ('rolling_type', 'rolling_periods'),
        ('num_period_compare', None),
        ('show_brush', 'show_legend'),
        ('rich_tooltip', 'y_axis_zero'),
        ('y_log_scale', 'contribution')
    ]

    def get_df(self):
        args = self.args
        df = super(NVD3TimeSeriesViz, self).get_df()
        df = df.fillna(0)
        metrics = self.metrics
        df = df.pivot_table(
            index="timestamp",
            columns=self.groupby,
            values=metrics,)

        if self.sort_series:
            dfs = df.sum()
            dfs.sort(ascending=False)
            df = df[dfs.index]

        if self.args.get("contribution") == "y":
            dft = df.T
            df = (dft / dft.sum()).T

        num_period_compare = self.form_data.get("num_period_compare")
        if num_period_compare:
            num_period_compare = int(num_period_compare)
            df = df / df.shift(num_period_compare)
            df = df[num_period_compare:]

        rolling_periods = args.get("rolling_periods")
        rolling_type = args.get("rolling_type")
        if rolling_periods and rolling_type:
            if rolling_type == 'mean':
                df = pd.rolling_mean(df, int(rolling_periods))
            elif rolling_type == 'std':
                df = pd.rolling_std(df, int(rolling_periods))
            elif rolling_type == 'sum':
                df = pd.rolling_sum(df, int(rolling_periods))
        return df

    def get_json(self):
        df = self.get_df()
        series = df.to_dict('series')
        datas = []
        for name in df.T.index.tolist():
            ys = series[name]
            if df[name].dtype.kind not in "biufc":
                continue
            df['timestamp'] = pd.to_datetime(df.index, utc=False)
            if isinstance(name, basestring):
                series_title = name
            elif len(self.metrics) > 1:
                series_title = ", ".join(name)
            else:
                series_title = ", ".join(name[1:])
            d = {
                "key": series_title,
                "color": utils.color(series_title),
                "values": [
                    {'x': ds, 'y': ys[i]}
                    for i, ds in enumerate(df.timestamp)]
            }
            datas.append(d)
        return dumps(datas)


class NVD3TimeSeriesBarViz(NVD3TimeSeriesViz):
    verbose_name = "Time Series - Bar Chart"
    chart_type = "nvd3_bar"
    form_fields = [
        'viz_type',
        'granularity', ('since', 'until'),
        'metrics',
        'groupby', 'limit',
        ('rolling_type', 'rolling_periods'),
        'show_legend',
    ]


class NVD3CompareTimeSeriesViz(NVD3TimeSeriesViz):
    verbose_name = "Time Series - Percent Change"
    chart_type = "compare"
    form_fields = [
        'viz_type',
        'granularity', ('since', 'until'),
        'metrics',
        'groupby', 'limit',
        ('rolling_type', 'rolling_periods'),
        'show_legend',
    ]


class NVD3TimeSeriesStackedViz(NVD3TimeSeriesViz):
    verbose_name = "Time Series - Stacked"
    chart_type = "stacked"
    sort_series = True
    form_fields = [
        'viz_type',
        'granularity', ('since', 'until'),
        'metrics',
        'groupby', 'limit',
        ('rolling_type', 'rolling_periods'),
        ('rich_tooltip', 'show_legend'),
    ]


class DistributionPieViz(NVD3Viz):
    verbose_name = "Distribution - NVD3 - Pie Chart"
    chart_type = "pie"
    form_fields = [
        'viz_type', 'metrics', 'groupby',
        ('since', 'until'),
        'limit',
        ('donut', 'show_legend'),
    ]

    def query_obj(self):
        d = super(DistributionPieViz, self).query_obj()
        d['granularity'] = "all"
        d['is_timeseries'] = False
        return d

    def get_df(self):
        df = super(DistributionPieViz, self).get_df()
        df = df.pivot_table(
            index=self.groupby,
            values=[self.metrics[0]])
        df = df.sort(self.metrics[0], ascending=False)
        return df

    def get_json(self):
        df = self.get_df()
        df = df.reset_index()
        df.columns = ['x', 'y']
        df['color'] = map(utils.color, df.x)
        return df.to_json(orient="records")


class DistributionBarViz(DistributionPieViz):
    verbose_name = "Distribution - Bar Chart"
    chart_type = "column"

    def get_df(self):
        df = super(DistributionPieViz, self).get_df()
        df = df.pivot_table(
            index=self.groupby,
            values=self.metrics)
        df = df.sort(self.metrics[0], ascending=False)
        return df

    def get_json(self):
        df = self.get_df()
        series = df.to_dict('series')
        datas = []
        for name, ys in series.items():
            if df[name].dtype.kind not in "biufc":
                continue
            df['timestamp'] = pd.to_datetime(df.index, utc=False)
            if isinstance(name, basestring):
                series_title = name
            elif len(self.metrics) > 1:
                series_title = ", ".join(name)
            else:
                series_title = ", ".join(name[1:])
            d = {
                "key": series_title,
                "color": utils.color(series_title),
                "values": [
                    {'x': ds, 'y': ys[i]}
                    for i, ds in enumerate(df.timestamp)]
            }
            datas.append(d)
        return dumps(datas)


viz_types = OrderedDict([
    ['table', TableViz],
    ['line', NVD3TimeSeriesViz],
    ['compare', NVD3CompareTimeSeriesViz],
    ['area', NVD3TimeSeriesStackedViz],
    ['bar', NVD3TimeSeriesBarViz],
    ['dist_bar', DistributionBarViz],
    ['pie', DistributionPieViz],
    ['bubble', BubbleViz],
    ['markup', MarkupViz],
    ['word_cloud', WordCloudViz],
    ['big_number', BigNumberViz],
])
