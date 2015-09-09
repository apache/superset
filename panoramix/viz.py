from datetime import datetime
from flask import flash, request
import pandas as pd
from collections import OrderedDict
import config
import logging
import numpy as np

from panoramix import utils
from panoramix.highchart import Highchart, HighchartBubble
from panoramix.forms import form_factory

CHART_ARGS = {
    'height': 700,
    'title': None,
    'target_div': 'chart',
}


class BaseViz(object):
    verbose_name = "Base Viz"
    template = "panoramix/datasource.html"
    hidden_fields = []
    form_fields = [
        'viz_type', 'metrics', 'groupby', 'granularity',
        ('since', 'until')]

    def __init__(self, datasource, form_data, view):
        self.datasource = datasource
        self.form_class = self.form_class()
        self.view = view
        self.form_data = form_data
        self.metrics = form_data.getlist('metrics') or ['count']
        self.groupby = form_data.getlist('groupby') or []

        self.error_msg = ""
        self.results = None
        try:
            self.results = self.bake_query()
            self.df = self.results.df
            if self.df is not None:
                if 'timestamp' in self.df.columns:
                    self.df.timestamp = pd.to_datetime(self.df.timestamp)
        except Exception as e:
            logging.exception(e)
            self.error_msg = str(e)

    def form_class(self):
        return form_factory(self)

    def query_filters(self):
        args = self.form_data
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
        args = self.form_data
        groupby = args.getlist("groupby") or []
        metrics = args.getlist("metrics") or ['count']
        granularity = args.get("granularity", "1 day")
        if granularity != "all":
            granularity = utils.parse_human_timedelta(
                granularity).total_seconds() * 1000
        limit = int(args.get("limit", 0))
        row_limit = int(
            args.get("row_limit", config.ROW_LIMIT))
        since = args.get("since", "1 year ago")
        from_dttm = utils.parse_human_datetime(since)
        if from_dttm > datetime.now():
            from_dttm = datetime.now() - (from_dttm-datetime.now())
        until = args.get("until", "now")
        to_dttm = utils.parse_human_datetime(until)
        if from_dttm >= to_dttm:
            flash("The date range doesn't seem right.", "danger")
            from_dttm = to_dttm  # Making them identicial to not raise

        # extras are used to query elements specific to a datasource type
        # for instance the extra where clause that applies only to Tables
        extras = {
            'where': args.get("where")
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

    def render_no_data(self):
        self.template = "panoramix/no_data.html"
        return BaseViz.render(self)

    def check_and_render(self, *args, **kwards):
        if self.error_msg:
            return BaseViz.render(self, error_msg=self.error_msg)
        else:
            return self.render(*args, **kwards)

    def render(self, *args, **kwargs):
        form = self.form_class(self.form_data)
        return self.view.render_template(
            self.template, form=form, viz=self, datasource=self.datasource,
            results=self.results,
            *args, **kwargs)


class TableViz(BaseViz):
    verbose_name = "Table View"
    template = 'panoramix/viz_table.html'
    form_fields = BaseViz.form_fields + ['row_limit']

    def query_obj(self):
        d = super(TableViz, self).query_obj()
        d['is_timeseries'] = False
        d['timeseries_limit'] = None
        return d

    def render(self):
        df = self.df
        if df is None or df.empty:
            return super(TableViz, self).render(error_msg="No data.")
        else:
            if (
                    self.form_data.get("granularity") == "all" and
                    'timestamp' in df):
                del df['timestamp']
            for m in self.metrics:
                df[m + '__perc'] = np.rint((df[m] / np.max(df[m])) * 100)
        return super(TableViz, self).render(df=df)


class HighchartsViz(BaseViz):
    verbose_name = "Base Highcharts Viz"
    template = 'panoramix/viz_highcharts.html'
    chart_kind = 'line'
    stacked = False
    chart_type = 'not_stock'
    compare = False


class BubbleViz(HighchartsViz):
    verbose_name = "Bubble Chart"
    chart_type = 'bubble'
    hidden_fields = ['granularity', 'metrics', 'groupby']
    form_fields = [
        'viz_type', 'since', 'until',
        'series', 'entity', 'x', 'y', 'size', 'limit']

    def query_obj(self):
        d = super(BubbleViz, self).query_obj()
        d['granularity'] = 'all'
        d['groupby'] = list({
            request.args.get('series'),
            request.args.get('entity')
            })
        self.x_metric = request.args.get('x')
        self.y_metric = request.args.get('y')
        self.z_metric = request.args.get('size')
        self.entity = request.args.get('entity')
        self.series = request.args.get('series')
        d['metrics'] = [
            self.z_metric,
            self.x_metric,
            self.y_metric,
        ]
        if not all(d['metrics'] + [self.entity, self.series]):
            raise Exception("Pick a metric for x, y and size")
        return d

    def render(self):
        df = self.df.fillna(0)
        df['x'] = df[[self.x_metric]]
        df['y'] = df[[self.y_metric]]
        df['z'] = df[[self.z_metric]]
        df['name'] = df[[self.entity]]
        df['group'] = df[[self.series]]
        chart = HighchartBubble(df)
        return super(BubbleViz, self).render(chart_js=chart.javascript_cmd)


class TimeSeriesViz(HighchartsViz):
    verbose_name = "Time Series - Line Chart"
    chart_type = "spline"
    stockchart = True
    sort_legend_y = True
    form_fields = [
        'viz_type',
        'granularity', ('since', 'until'),
        'metrics',
        'groupby', 'limit',
        ('rolling_type', 'rolling_periods'),
    ]

    def render(self):
        if request.args.get("granularity") == "all":
            self.error_msg = (
                "You have to select a time granularity for this view")
            return super(TimeSeriesViz, self).render(error_msg=self.error_msg)

        metrics = self.metrics
        df = self.df
        df = df.pivot_table(
            index="timestamp",
            columns=self.groupby,
            values=metrics,)

        rolling_periods = request.args.get("rolling_periods")
        rolling_type = request.args.get("rolling_type")
        if rolling_periods and rolling_type:
            if rolling_type == 'mean':
                df = pd.rolling_mean(df, int(rolling_periods))
            elif rolling_type == 'std':
                df = pd.rolling_std(df, int(rolling_periods))
            elif rolling_type == 'sum':
                df = pd.rolling_sum(df, int(rolling_periods))

        chart = Highchart(
            df,
            compare=self.compare,
            chart_type=self.chart_type,
            stacked=self.stacked,
            stockchart=self.stockchart,
            sort_legend_y=self.sort_legend_y,
            **CHART_ARGS)
        return super(TimeSeriesViz, self).render(chart_js=chart.javascript_cmd)

    def bake_query(self):
        """
        Doing a 2 phase query where we limit the number of series.
        """
        return self.datasource.query(**self.query_obj())


class TimeSeriesCompareViz(TimeSeriesViz):
    verbose_name = "Time Series - Percent Change"
    compare = 'percent'


class TimeSeriesCompareValueViz(TimeSeriesViz):
    verbose_name = "Time Series - Value Change"
    compare = 'value'


class TimeSeriesAreaViz(TimeSeriesViz):
    verbose_name = "Time Series - Stacked Area Chart"
    stacked = True
    chart_type = "area"


class TimeSeriesBarViz(TimeSeriesViz):
    verbose_name = "Time Series - Bar Chart"
    chart_type = "column"


class TimeSeriesStackedBarViz(TimeSeriesViz):
    verbose_name = "Time Series - Stacked Bar Chart"
    chart_type = "column"
    stacked = True


class DistributionBarViz(HighchartsViz):
    verbose_name = "Distribution - Bar Chart"
    chart_type = "column"
    form_fields = BaseViz.form_fields + ['limit']

    def query_obj(self):
        d = super(DistributionBarViz, self).query_obj()
        d['granularity'] = "all"
        d['is_timeseries'] = False
        return d

    def render(self):
        df = self.df
        df = df.pivot_table(
            index=self.groupby,
            values=self.metrics)
        df = df.sort(self.metrics[0], ascending=False)
        chart = Highchart(
            df, chart_type=self.chart_type, **CHART_ARGS)
        return super(DistributionBarViz, self).render(
            chart_js=chart.javascript_cmd)


class DistributionPieViz(HighchartsViz):
    verbose_name = "Distribution - Pie Chart"
    chart_type = "pie"
    form_fields = BaseViz.form_fields + ['limit']

    def query_obj(self):
        d = super(DistributionPieViz, self).query_obj()
        d['granularity'] = "all"
        d['is_timeseries'] = False
        return d

    def render(self):
        df = self.df
        df = df.pivot_table(
            index=self.groupby,
            values=[self.metrics[0]])
        df = df.sort(self.metrics[0], ascending=False)
        chart = Highchart(
            df, chart_type=self.chart_type, **CHART_ARGS)
        return super(DistributionPieViz, self).render(
            chart_js=chart.javascript_cmd)

viz_types = OrderedDict([
    ['table', TableViz],
    ['line', TimeSeriesViz],
    ['compare', TimeSeriesCompareViz],
    ['compare_value', TimeSeriesCompareValueViz],
    ['area', TimeSeriesAreaViz],
    ['bar', TimeSeriesBarViz],
    ['stacked_ts_bar', TimeSeriesStackedBarViz],
    ['dist_bar', DistributionBarViz],
    ['pie', DistributionPieViz],
    ['bubble', BubbleViz],
])
