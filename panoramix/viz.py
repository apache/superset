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
    is_timeseries = False
    fieldsets = (
    {
        'label': None,
        'fields': (
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
                elif obj:
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
        extra_filters = form_data.get('extra_filters', [])
        if extra_filters:
            extra_filters = json.loads(extra_filters)
            for slice_id, slice_filters in extra_filters.items():
                if slice_filters:
                    for col, vals in slice_filters:
                        if col and vals:
                            filters += [(col, 'in', ",".join(vals))]

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
        if from_dttm > to_dttm:
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
            'query': self.query,
            'form_data': self.form_data,
            'json_endpoint': self.json_endpoint,
            'csv_endpoint': self.csv_endpoint,
            'standalone_endpoint': self.standalone_endpoint,
        }
        return json.dumps(payload)

    def get_csv(self):
        df = self.get_df()
        return df.to_csv(index=False)

    def get_json_data(self):
        return json.dumps([])

    @property
    def json_endpoint(self):
        return self.get_url(json="true")

    @property
    def csv_endpoint(self):
        return self.get_url(csv="true")

    @property
    def standalone_endpoint(self):
        return self.get_url(standalone="true")

    @property
    def data(self):
        content = {
            'viz_name': self.viz_type,
            'json_endpoint': self.json_endpoint,
            'csv_endpoint': self.csv_endpoint,
            'standalone_endpoint': self.standalone_endpoint,
            'token': self.token,
            'form_data': self.form_data,
        }
        return content

    @property
    def json_data(self):
        return dumps(self.data)

class TableViz(BaseViz):
    viz_type = "table"
    verbose_name = "Table View"
    fieldsets = (
    {
        'label': None,
        'fields': (
            'granularity',
            ('since', 'until'),
            'row_limit',
            ('include_search', None),
        )
    },
    {
        'label': "GROUP BY",
        'fields': (
            'groupby',
            'metrics',
        )
    },
    {
        'label': "NOT GROUPED BY",
        'fields': (
            'all_columns',
        )
    },)
    css_files = [
        'lib/dataTables/dataTables.bootstrap.css',
        'widgets/viz_table.css',
    ]
    is_timeseries = False
    js_files = [
        'lib/dataTables/jquery.dataTables.min.js',
        'lib/dataTables/dataTables.bootstrap.js',
        'widgets/viz_table.js',
    ]

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

    def get_df(self):
        df = super(TableViz, self).get_df()
        if (
                self.form_data.get("granularity") == "all" and
                'timestamp' in df):
            del df['timestamp']
        return df

    def get_json_data(self):
        df = self.get_df()
        return json.dumps(
            dict(
                records=df.to_dict(orient="records"),
                columns=list(df.columns),
            ),
            default=utils.json_iso_dttm_ser,
        )


class PivotTableViz(BaseViz):
    viz_type = "pivot_table"
    verbose_name = "Pivot Table"
    css_files = [
        'lib/dataTables/dataTables.bootstrap.css',
        'widgets/viz_pivot_table.css']
    is_timeseries = False
    js_files = [
        'lib/dataTables/jquery.dataTables.min.js',
        'lib/dataTables/dataTables.bootstrap.js',
        'widgets/viz_pivot_table.js']
    fieldsets = (
    {
        'label': None,
        'fields': (
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

    def get_json_data(self):
        return dumps(self.get_df().to_html(
            na_rep='',
            classes=(
                "dataframe table table-striped table-bordered "
                "table-condensed table-hover")))


class MarkupViz(BaseViz):
    viz_type = "markup"
    verbose_name = "Markup Widget"
    js_files = ['widgets/viz_markup.js']
    fieldsets = (
    {
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

    def get_json_data(self):
        return dumps(dict(html=self.rendered()))


class WordCloudViz(BaseViz):
    """
    Integration with the nice library at:
    https://github.com/jasondavies/d3-cloud
    """
    viz_type = "word_cloud"
    verbose_name = "Word Cloud"
    is_timeseries = False
    fieldsets = (
    {
        'label': None,
        'fields': (
            'granularity',
            ('since', 'until'),
            'series', 'metric', 'limit',
            ('size_from', 'size_to'),
            'rotation',
        )
    },)
    js_files = [
        'lib/d3.layout.cloud.js',
        'widgets/viz_wordcloud.js',
    ]

    def query_obj(self):
        d = super(WordCloudViz, self).query_obj()

        d['metrics'] = [self.form_data.get('metric')]
        d['groupby'] = [self.form_data.get('series')]
        return d

    def get_json_data(self):
        df = self.get_df()
        # Ordering the columns
        df = df[[self.form_data.get('series'), self.form_data.get('metric')]]
        # Labeling the columns for uniform json schema
        df.columns = ['text', 'size']
        return df.to_json(orient="records")


class NVD3Viz(BaseViz):
    viz_type = None
    verbose_name = "Base NVD3 Viz"
    is_timeseries = False
    js_files = [
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
            'granularity',
            ('since', 'until'),
            'series', 'entity',
            'x', 'y',
            'size', 'limit',
        )
    },
    {
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
                'values': v })
        return dumps(chart_data)

class BigNumberViz(BaseViz):
    viz_type = "big_number"
    verbose_name = "Big Number"
    is_timeseries = True
    js_files = [
        'widgets/viz_bignumber.js',
    ]
    css_files = [
        'widgets/viz_bignumber.css',
    ]
    fieldsets = (
    {
        'label': None,
        'fields': (
            'granularity',
            ('since', 'until'),
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

    def get_json_data(self):
        form_data = self.form_data
        df = self.get_df()
        df = df.sort(columns=df.columns[0])
        compare_lag = form_data.get("compare_lag", "")
        compare_lag = int(compare_lag) if compare_lag and compare_lag.isdigit() else 0
        d = {
            'data': df.values.tolist(),
            'compare_lag': compare_lag,
            'compare_suffix': form_data.get('compare_suffix', ''),
        }
        return dumps(d)


class NVD3TimeSeriesViz(NVD3Viz):
    viz_type = "line"
    verbose_name = "Time Series - Line Chart"
    sort_series = False
    is_timeseries = True
    fieldsets = (
        {
            'label': None,
            'fields': (
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
        return dumps(chart_data)


class NVD3TimeSeriesBarViz(NVD3TimeSeriesViz):
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
    viz_type = 'compare'
    verbose_name = "Time Series - Percent Change"


class NVD3TimeSeriesStackedViz(NVD3TimeSeriesViz):
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
    viz_type = "pie"
    verbose_name = "Distribution - NVD3 - Pie Chart"
    is_timeseries = False
    fieldsets = (
    {
        'label': None,
        'fields': (
            'granularity',
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
        return dumps(df.to_dict(orient="records"))


class DistributionBarViz(DistributionPieViz):
    viz_type = "dist_bar"
    verbose_name = "Distribution - Bar Chart"
    is_timeseries = False
    fieldsets = (
    {
        'label': None,
        'fields': (
            'granularity',
            ('since', 'until'),
            'metrics', 'groupby',
            'limit',
            ('show_legend', 'bar_stacked'),
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
                "values": [
                    {'x': ds, 'y': ys[i]}
                    for i, ds in enumerate(df.timestamp)]
            }
            chart_data.append(d)
        return dumps(chart_data)


class SunburstViz(BaseViz):
    viz_type = "sunburst"
    verbose_name = "Sunburst"
    is_timeseries = False
    js_files = [
        'widgets/viz_sunburst.js']
    css_files = ['widgets/viz_sunburst.css']
    fieldsets = (
    {
        'label': None,
        'fields': (
            'granularity',
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


class SankeyViz(BaseViz):
    viz_type = "sankey"
    verbose_name = "Sankey"
    is_timeseries = False
    js_files = [
        'lib/d3-sankey.js',
        'widgets/viz_sankey.js']
    css_files = ['widgets/viz_sankey.css']
    fieldsets = (
    {
        'label': None,
        'fields': (
            'granularity',
            ('since', 'until'),
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

    def get_json_data(self):
        df = self.get_df()
        df.columns = ['source', 'target', 'value']
        d = df.to_dict(orient='records')
        return dumps(d)


class DirectedForceViz(BaseViz):
    viz_type = "directed_force"
    verbose_name = "Directed Force Layout"
    is_timeseries = False
    js_files = [
        'widgets/viz_directed_force.js']
    css_files = ['widgets/viz_directed_force.css']
    fieldsets = (
    {
        'label': None,
        'fields': (
            'granularity',
            ('since', 'until'),
            'groupby',
            'metric',
            'row_limit',
        )
    },
    {
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

    def get_json_data(self):
        df = self.get_df()
        df.columns = ['source', 'target', 'value']
        d = df.to_dict(orient='records')
        return dumps(d)


class WorldMapViz(BaseViz):
    viz_type = "world_map"
    verbose_name = "World Map"
    is_timeseries = False
    js_files = [
        'lib/topojson.min.js',
        'lib/datamaps.all.js',
        'widgets/viz_world_map.js']
    css_files = ['widgets/viz_world_map.css']
    fieldsets = (
    {
        'label': None,
        'fields': (
            'granularity',
            ('since', 'until'),
            'entity',
            'country_fieldtype',
            'metric',
        )
    },
    {
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

    def get_json_data(self):
        from panoramix.data import countries
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
        return dumps(d)


class FilterBoxViz(BaseViz):
    viz_type = "filter_box"
    verbose_name = "Filters"
    is_timeseries = False
    js_files = [
        'widgets/viz_filter_box.js']
    css_files = [
        'widgets/viz_filter_box.css']
    fieldsets = (
    {
        'label': None,
        'fields': (
            'granularity',
            ('since', 'until'),
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

    def get_df(self):
        qry = self.query_obj()

        filters = [g for g in qry['groupby']]
        d = {}
        for flt in filters:
            qry['groupby'] = [flt]
            df = super(FilterBoxViz, self).get_df(qry)
            d[flt] = [
                {'id': row[0],
                'text': row[0],
                'filter': flt,
                'metric': row[1]}
                for row in df.itertuples(index=False)]
        return d

    def get_json_data(self):
        d = self.get_df()
        return dumps(d)


class IFrameViz(BaseViz):
    viz_type = "iframe"
    verbose_name = "iFrame"
    is_timeseries = False
    js_files = ['widgets/viz_iframe.js']
    fieldsets = (
    {
        'label': None,
        'fields': ('url',)
    },)


class ParallelCoordinatesViz(BaseViz):
    viz_type = "para"
    verbose_name = "Parallel Coordinates"
    is_timeseries = False
    js_files = [
        'lib/para/d3.parcoords.js',
        'lib/para/divgrid.js',
        'widgets/viz_para.js']
    css_files = ['lib/para/d3.parcoords.css']
    fieldsets = (
    {
        'label': None,
        'fields': (
            'granularity',
            ('since', 'until'),
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

    def get_json_data(self):
        df = self.get_df()
        df = df[[self.form_data.get('series')] + self.form_data.get('metrics')]
        return df.to_json(orient="records")

class HeatmapViz(BaseViz):
    viz_type = "heatmap"
    verbose_name = "Heatmap"
    is_timeseries = False
    js_files = ['lib/d3.tip.js', 'widgets/viz_heatmap.js']
    css_files = ['lib/d3.tip.css', 'widgets/viz_heatmap.css']
    fieldsets = (
    {
        'label': None,
        'fields': (
            'granularity',
            ('since', 'until'),
            'all_columns_x',
            'all_columns_y',
            'metric',
        )
    },
    {
        'label': 'Heatmap Options',
        'fields': (
            'linear_color_scheme',
            ('xscale_interval', 'yscale_interval'),
        )
    },)
    def query_obj(self):
        d = super(HeatmapViz, self).query_obj()
        fd = self.form_data
        d['metrics'] = [fd.get('metric')]
        d['groupby'] = [fd.get('all_columns_x'), fd.get('all_columns_y')]
        return d

    def get_json_data(self):
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
        return df.to_json(orient="records")


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
    DirectedForceViz,
    SankeyViz,
    WorldMapViz,
    FilterBoxViz,
    IFrameViz,
    ParallelCoordinatesViz,
    HeatmapViz,
]

viz_types = OrderedDict([(v.viz_type, v) for v in viz_types_list])
