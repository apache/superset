from collections import OrderedDict, defaultdict
from datetime import datetime, timedelta
import json
import uuid

from flask import flash, request, Markup
from markdown import markdown
from pandas.io.json import dumps
from werkzeug.datastructures import ImmutableMultiDict
from werkzeug.urls import Href
import numpy as np
import pandas as pd

from panoramix import app, utils
from panoramix.forms import FormFactory

from six import string_types

config = app.config


class BaseViz(object):
    viz_type = None
    verbose_name = "Base Viz"
    template = None
    is_timeseries = False
    fieldsets = (
    {
        'label': None,
        'fields': (
            'viz_type',
            'granularity',
            ('since', 'until'),
            'metrics', 'groupby',
        )
    },)
    js_files = []
    css_files = []
    form_overrides = {}

    def __init__(self, datasource, form_data):
        self.orig_form_data = form_data
        self.datasource = datasource
        self.request = request
        self.viz_type = form_data.get("viz_type")

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
                    flash("{}: {}".format(k, " ".join(v)), 'danger')
        if previous_viz_type != self.viz_type:
            data = {
                k: form.data[k]
                for k in form_data.keys()
                if k in form.data}
        defaults.update(data)
        self.form_data = defaults

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

    def fieldsetizer(self):
        """
        Makes form_fields support either a list approach or a fieldsets
        approach
        """
        return self.fieldsets

    @classmethod
    def flat_form_fields(cls):
        l = set()
        for d in cls.fieldsets:
            for obj in d['fields']:
                if isinstance(obj, (tuple, list)):
                    l |= {a for a in obj}
                else:
                    l.add(obj)
        return l

    def reassignments(self):
        pass

    def get_url(self, **kwargs):
        d = self.orig_form_data.copy()
        if 'action' in d:
            del d['action']
        d.update(kwargs)
        # Remove unchecked checkboxes because HTML is weird like that
        for key in d.keys():
            if d[key] == False:
                del d[key]
        href = Href(
            '/panoramix/explore/{self.datasource.type}/'
            '{self.datasource.id}/'.format(**locals()))
        return href(d)

    def get_df(self, query_obj=None):
        if not query_obj:
            query_obj = self.query_obj()

        self.error_msg = ""
        self.results = None

        self.results = self.datasource.query(**query_obj)
        df = self.results.df
        if df is None or df.empty:
            raise Exception("No data, review your incantations!")
        else:
            if 'timestamp' in df.columns:
                df.timestamp = pd.to_datetime(df.timestamp, utc=False)
                if self.datasource.offset:
                    df.timestamp += timedelta(hours=self.datasource.offset)
        return df

    @property
    def form(self):
        return self.form_class(**self.form_data)

    @property
    def form_class(self):
        return FormFactory(self).get_form()

    def query_filters(self):
        form_data = self.form_data
        # Building filters
        filters = []
        for i in range(1, 10):
            col = form_data.get("flt_col_" + str(i))
            op = form_data.get("flt_op_" + str(i))
            eq = form_data.get("flt_eq_" + str(i))
            if col and op and eq:
                filters.append((col, op, eq))
        return filters

    def query_obj(self):
        """
        Building a query object
        """
        form_data = self.form_data
        groupby = form_data.get("groupby") or []
        metrics = form_data.get("metrics") or ['count']
        granularity = form_data.get("granularity")
        limit = int(form_data.get("limit", 0))
        row_limit = int(
            form_data.get("row_limit", config.get("ROW_LIMIT")))
        since = form_data.get("since", "1 year ago")
        from_dttm = utils.parse_human_datetime(since)
        if from_dttm > datetime.now():
            from_dttm = datetime.now() - (from_dttm-datetime.now())
        until = form_data.get("until", "now")
        to_dttm = utils.parse_human_datetime(until)
        if from_dttm >= to_dttm:
            flash("The date range doesn't seem right.", "danger")
            from_dttm = to_dttm  # Making them identical to not raise

        # extras are used to query elements specific to a datasource type
        # for instance the extra where clause that applies only to Tables
        extras = {
            'where': form_data.get("where", ''),
            'having': form_data.get("having", ''),
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

    def get_json(self):
        payload = {
            'data': json.loads(self.get_json_data()),
            'form_data': self.form_data,
        }
        return json.dumps(payload)

    def get_json_data(self):
        return json.dumps([])

    def get_data_attribute(self):
        content = {
            'viz_name': self.viz_type,
            'json_endpoint': self.get_url(json="true"),
            'token': self.token,
        }
        return json.dumps(content)

class TableViz(BaseViz):
    viz_type = "table"
    verbose_name = "Table View"
    template = 'panoramix/viz_table.html'
    fieldsets = (
    {
        'label': None,
        'fields': (
            'viz_type',
            'granularity',
            ('since', 'until'),
            'metrics', 'groupby',
            'row_limit'
        )
    },)
    css_files = ['lib/dataTables/dataTables.bootstrap.css']
    is_timeseries = False
    js_files = [
        'lib/dataTables/jquery.dataTables.min.js',
        'lib/dataTables/dataTables.bootstrap.js']

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


class PivotTableViz(BaseViz):
    viz_type = "pivot_table"
    verbose_name = "Pivot Table"
    template = 'panoramix/viz_pivot_table.html'
    css_files = ['lib/dataTables/dataTables.bootstrap.css']
    is_timeseries = False
    js_files = [
        'lib/dataTables/jquery.dataTables.min.js',
        'lib/dataTables/dataTables.bootstrap.js']
    fieldsets = (
    {
        'label': None,
        'fields': (
            'viz_type',
            'granularity',
            ('since', 'until'),
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
        d['is_timeseries'] = False
        d['timeseries_limit'] = None
        return d

    def get_df(self):
        df = super(PivotTableViz, self).get_df()
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


class MarkupViz(BaseViz):
    viz_type = "markup"
    verbose_name = "Markup Widget"
    template = 'panoramix/viz_markup.html'
    fieldsets = (
    {
        'label': None,
        'fields': ('viz_type', 'markup_type', 'code')
    },)
    is_timeseries = False

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
    viz_type = "word_cloud"
    verbose_name = "Word Cloud"
    template = 'panoramix/viz_word_cloud.html'
    is_timeseries = False
    fieldsets = (
    {
        'label': None,
        'fields': (
            'viz_type',
            ('since', 'until'),
            'groupby', 'metric', 'limit',
            ('size_from', 'size_to'),
            'rotation',
        )
    },)
    js_files = [
        'lib/d3.min.js',
        'lib/d3.layout.cloud.js',
        'widgets/viz_wordcloud.js',
    ]

    def query_obj(self):
        d = super(WordCloudViz, self).query_obj()
        metric = self.form_data.get('metric')
        if not metric:
            raise Exception("Pick a metric!")
        d['metrics'] = [self.form_data.get('metric')]
        d['groupby'] = [d['groupby'][0]]
        return d

    def get_json_data(self):
        df = self.get_df()
        df.columns = ['text', 'size']
        return df.to_json(orient="records")


class NVD3Viz(BaseViz):
    viz_type = None
    verbose_name = "Base NVD3 Viz"
    template = 'panoramix/viz_nvd3.html'
    is_timeseries = False
    js_files = [
        'lib/d3.min.js',
        'lib/nvd3/nv.d3.min.js',
        'widgets/viz_nvd3.js',
    ]
    css_files = [
        'lib/nvd3/nv.d3.css',
        'widgets/viz_nvd3.css',
    ]


class BubbleViz(NVD3Viz):
    viz_type = "bubble"
    verbose_name = "Bubble Chart"
    is_timeseries = False
    fieldsets = (
    {
        'label': None,
        'fields': (
            'viz_type',
            ('since', 'until'),
            ('series', 'entity'),
            ('x', 'y'),
            ('size', 'limit'),
            ('x_log_scale', 'y_log_scale'),
            ('show_legend', None),
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

    def get_df(self):
        df = super(BubbleViz, self).get_df()
        df = df.fillna(0)
        df['x'] = df[[self.x_metric]]
        df['y'] = df[[self.y_metric]]
        df['size'] = df[[self.z_metric]]
        df['shape'] = 'circle'
        df['group'] = df[[self.series]]
        return df

    def get_json_data(self):
        df = self.get_df()
        series = defaultdict(list)
        for row in df.to_dict(orient='records'):
            series[row['group']].append(row)
        chart_data = []
        for k, v in series.items():
            chart_data.append({
                'key': k,
                "color": utils.color(k),
                'values': v })
        return dumps({
            'chart_data': chart_data,
            'query': self.results.query,
            'duration': self.results.duration,
        })

class BigNumberViz(BaseViz):
    viz_type = "big_number"
    verbose_name = "Big Number"
    template = 'panoramix/viz_bignumber.html'
    is_timeseries = True
    js_files = [
        'lib/d3.min.js',
        'widgets/viz_bignumber.js',
    ]
    css_files = [
        'widgets/viz_bignumber.css',
    ]
    fieldsets = (
    {
        'label': None,
        'fields': (
            'viz_type',
            'granularity',
            ('since', 'until'),
            'metric',
            'compare_lag',
            'compare_suffix',
        )
    },)

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

    def get_json_data(self):
        form_data = self.form_data
        df = self.get_df()
        df = df.sort(columns=df.columns[0])
        df['timestamp'] = df[[0]].astype(np.int64) // 10**9
        compare_lag = form_data.get("compare_lag", "")
        compare_lag = int(compare_lag) if compare_lag and compare_lag.isdigit() else 0
        d = {
            'data': df.values.tolist(),
            'compare_lag': compare_lag,
            'compare_suffix': form_data.get('compare_suffix', ''),
        }
        return json.dumps(d)


class NVD3TimeSeriesViz(NVD3Viz):
    viz_type = "line"
    verbose_name = "Time Series - Line Chart"
    sort_series = False
    is_timeseries = True
    fieldsets = (
        {
            'label': None,
            'fields': (
                'viz_type',
                'granularity', ('since', 'until'),
                'metrics',
                'groupby', 'limit',
            ),
        }, {
            'label': 'Chart Options',
            'fields': (
                ('show_brush', 'show_legend'),
                ('rich_tooltip', 'y_axis_zero'),
                ('y_log_scale', 'contribution'),
                ('y_axis_format', 'x_axis_showminmax'),
                ('line_interpolation', None),
            ),
        }, {
            'label': 'Advanced Analytics',
            'description': (
                "This section contains options "
                "that allow for advanced analytical post processing "
                "of query reults"),
            'fields': (
                ('rolling_type', 'rolling_periods'),
                'time_compare',
                'num_period_compare',
            ),
        },
    )

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
            df = df / df.shift(num_period_compare)
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
            color = utils.color(series_title)
            if title_suffix:
                series_title += title_suffix

            d = {
                "key": series_title,
                "color": color,
                "classed": classed,
                "values": [
                    {'x': ds, 'y': ys[ds]}
                    for i, ds in enumerate(df.timestamp)]
            }
            chart_data.append(d)
        return chart_data

    def get_json_data(self):
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
                df2, classed='dashed', title_suffix="---")
            chart_data = sorted(chart_data, key=lambda x: x['key'])

        data = {
            'chart_data': chart_data,
            'query': self.results.query,
            'duration': self.results.duration,
        }
        return dumps(data)


class NVD3TimeSeriesBarViz(NVD3TimeSeriesViz):
    viz_type = "bar"
    verbose_name = "Time Series - Bar Chart"
    fieldsets = (
    {
        'label': None,
        'fields': (
            'viz_type',
            'granularity', ('since', 'until'),
            'metrics',
            'groupby', 'limit',
            ('rolling_type', 'rolling_periods'),
            'show_legend',
        )
    },)


class NVD3CompareTimeSeriesViz(NVD3TimeSeriesViz):
    viz_type = 'compare'
    verbose_name = "Time Series - Percent Change"
    fieldsets = (
    {
        'label': None,
        'fields': (
            'viz_type',
            'granularity', ('since', 'until'),
            'metrics',
            'groupby', 'limit',
            ('rolling_type', 'rolling_periods'),
            'show_legend',
        )
    },)


class NVD3TimeSeriesStackedViz(NVD3TimeSeriesViz):
    viz_type = "area"
    verbose_name = "Time Series - Stacked"
    sort_series = True
    fieldsets = (
    {
        'label': None,
        'fields': (
            'viz_type',
            'granularity', ('since', 'until'),
            'metrics',
            'groupby', 'limit',
            ('rolling_type', 'rolling_periods'),
            ('rich_tooltip', 'show_legend'),
        )
    },)


class DistributionPieViz(NVD3Viz):
    viz_type = "pie"
    verbose_name = "Distribution - NVD3 - Pie Chart"
    is_timeseries = False
    fieldsets = (
    {
        'label': None,
        'fields': (
            'viz_type',
            ('since', 'until'),
            'metrics', 'groupby',
            'limit',
            ('donut', 'show_legend'),
        )
    },)

    def query_obj(self):
        d = super(DistributionPieViz, self).query_obj()
        d['is_timeseries'] = False
        return d

    def get_df(self):
        df = super(DistributionPieViz, self).get_df()
        df = df.pivot_table(
            index=self.groupby,
            values=[self.metrics[0]])
        df = df.sort(self.metrics[0], ascending=False)
        return df

    def get_json_data(self):
        df = self.get_df()
        df = df.reset_index()
        df.columns = ['x', 'y']
        df['color'] = map(utils.color, df.x)
        return dumps({
            'chart_data': df.to_dict(orient="records"),
            'query': self.results.query,
            'duration': self.results.duration,
        })


class DistributionBarViz(DistributionPieViz):
    viz_type = "dist_bar"
    verbose_name = "Distribution - Bar Chart"
    is_timeseries = False
    fieldsets = (
    {
        'label': None,
        'fields': (
            'viz_type', 'metrics', 'groupby',
            ('since', 'until'),
            'limit',
            ('show_legend', None),
        )
    },)

    def get_df(self):
        df = super(DistributionPieViz, self).get_df()
        df = df.pivot_table(
            index=self.groupby,
            values=self.metrics)
        df = df.sort(self.metrics[0], ascending=False)
        return df

    def get_json_data(self):
        df = self.get_df()
        series = df.to_dict('series')
        chart_data = []
        for name, ys in series.items():
            if df[name].dtype.kind not in "biufc":
                continue
            df['timestamp'] = pd.to_datetime(df.index, utc=False)
            if isinstance(name, string_types):
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
            chart_data.append(d)
        return dumps({
            'chart_data': chart_data,
            'query': self.results.query,
            'duration': self.results.duration,
        })


class SunburstViz(BaseViz):
    viz_type = "sunburst"
    verbose_name = "Sunburst"
    is_timeseries = False
    template = 'panoramix/viz_sunburst.html'
    js_files = [
        'lib/d3.min.js',
        'widgets/viz_sunburst.js']
    css_files = ['widgets/viz_sunburst.css']
    fieldsets = (
    {
        'label': None,
        'fields': (
            'viz_type',
            ('since', 'until'),
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
                "define the color as a ratio against the primary metric"),
        },
        'groupby': {
            'label': 'Hierarchy',
            'description': "This defines the level of the hierarchy",
        },
    }

    def get_df(self):
        df = super(SunburstViz, self).get_df()
        return df

    def get_json_data(self):
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
        return ndf.to_json(orient="values")

    def query_obj(self):
        qry = super(SunburstViz, self).query_obj()
        qry['metrics'] = [
            self.form_data['metric'], self.form_data['secondary_metric']]
        return qry

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
    SunburstViz,
]
# This dict is used to
viz_types = OrderedDict([(v.viz_type, v) for v in viz_types_list])
