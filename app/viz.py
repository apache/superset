from datetime import datetime
from flask import flash, request
import pandas as pd
from collections import OrderedDict
from app import utils
from app.highchart import Highchart
from wtforms import Form, SelectMultipleField, SelectField, TextField
import config
from pydruid.utils.filters import Dimension, Filter


CHART_ARGS = {
    'height': 700,
    'title': None,
    'target_div': 'chart',
}


class OmgWtForm(Form):
    field_order = (
        'viz_type', 'granularity', 'since', 'group_by', 'limit')
    def fields(self):
        fields = []
        for field in self.field_order:
            if hasattr(self, field):
                obj = getattr(self, field)
                if isinstance(obj, Field):
                    fields.append(getattr(self, field))
        return fields


def form_factory(datasource, form_args=None, extra_fields_dict=None):
    extra_fields_dict = extra_fields_dict or {}
    limits = [0, 5, 10, 25, 50, 100, 500]

    if form_args:
        limit = form_args.get("limit")
        try:
            limit = int(limit)
            if limit not in limits:
                limits.append(limit)
                limits = sorted(limits)
        except:
            pass

    class QueryForm(OmgWtForm):
        viz_type = SelectField(
            'Viz',
            choices=[(k, v.verbose_name) for k, v in viz_types.items()])
        metrics = SelectMultipleField('Metrics', choices=datasource.metrics_combo)
        groupby = SelectMultipleField(
            'Group by', choices=[
                (s, s) for s in datasource.groupby_column_names])
        granularity = TextField('Time Granularity', default="one day")
        since = TextField('Since', default="one day ago")
        until = TextField('Until', default="now")
        limit = SelectField(
            'Limit', choices=[(s, s) for s in limits])
    for i in range(10):
        setattr(QueryForm, 'flt_col_' + str(i), SelectField(
            'Filter 1', choices=[(s, s) for s in datasource.filterable_column_names]))
        setattr(QueryForm, 'flt_op_' + str(i), SelectField(
            'Filter 1', choices=[(m, m) for m in ['in', 'not in']]))
        setattr(QueryForm, 'flt_eq_' + str(i), TextField("Super"))
    for k, v in extra_fields_dict.items():
        setattr(QueryForm, k, v)
    return QueryForm


class BaseViz(object):
    verbose_name = "Base Viz"
    template = "panoramix/datasource.html"
    def __init__(self, datasource, form_data, view):
        self.datasource = datasource
        self.form_class = self.form_class()
        self.form_data = form_data
        self.metrics = form_data.getlist('metrics') or ['count']
        self.groupby = form_data.getlist('groupby') or []

        self.results = self.bake_query()
        self.df = self.results.df
        self.view = view
        if self.df is not None:
            if 'timestamp' in self.df.columns:
                self.df.timestamp = pd.to_datetime(self.df.timestamp)
            self.df_prep()
            self.form_prep()

    def form_class(self):
        return form_factory(self.datasource, request.args)

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
        ds = self.datasource
        args = self.form_data
        groupby = args.getlist("groupby") or []
        metrics = args.getlist("metrics") or ['count']
        granularity = args.get("granularity", "1 day")
        granularity = utils.parse_human_timedelta(
            granularity).total_seconds() * 1000
        limit = int(
            args.get("limit", config.ROW_LIMIT)) or config.ROW_LIMIT
        since = args.get("since", "1 year ago")
        from_dttm = utils.parse_human_datetime(since)
        if from_dttm > datetime.now():
            from_dttm = datetime.now() - (from_dttm-datetime.now())
        until = args.get("until", "now")
        to_dttm = utils.parse_human_datetime(until)
        if from_dttm >= to_dttm:
            flash("The date range doesn't seem right.", "danger")
            from_dttm = to_dttm  # Making them identicial to not raise
        d = {
            'granularity': granularity,
            'from_dttm': from_dttm,
            'to_dttm': to_dttm,
            'groupby': groupby,
            'metrics': metrics,
            'filter': self.query_filters(),
            'timeseries_limit': limit,
        }
        return d

    def df_prep(self):
        pass

    def form_prep(self):
        pass

    def render_no_data(self):
        self.template = "panoramix/no_data.html"
        return BaseViz.render(self)

    def render(self, *args, **kwargs):
        form = self.form_class(self.form_data)
        return self.view.render_template(
            self.template, form=form, viz=self, datasource=self.datasource,
            results=self.results,
            *args, **kwargs)


class TableViz(BaseViz):
    verbose_name = "Table View"
    template = 'panoramix/viz_table.html'
    def render(self):
        if self.df is None or self.df.empty:
            flash("No data.", "error")
            table = None
        else:
            if self.form_data.get("granularity") == "all":
                del self.df['timestamp']
            table = self.df.to_html(
                classes=[
                    'table', 'table-striped', 'table-bordered',
                    'table-condensed'],
                index=False)
        return super(TableViz, self).render(table=table)


class HighchartsViz(BaseViz):
    verbose_name = "Base Highcharts Viz"
    template = 'panoramix/viz_highcharts.html'
    chart_kind = 'line'
    stacked = False
    chart_type = 'not_stock'
    compare = False


class TimeSeriesViz(HighchartsViz):
    verbose_name = "Time Series - Line Chart"
    chart_type = "spline"
    stockchart = True
    sort_legend_y = True

    def render(self):
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

    def form_class(self):
        return form_factory(self.datasource, request.args,
            extra_fields_dict={
                #'compare': TextField('Period Compare',),
                'rolling_type': SelectField(
                    'Rolling',
                    choices=[(s, s) for s in ['mean', 'sum', 'std']]),
                'rolling_periods': TextField('Periods',),
            })

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
    stacked=True
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

    def query_obj(self):
        d = super(DistributionBarViz, self).query_obj()
        d['granularity'] = "all"
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

    def query_obj(self):
        d = super(DistributionPieViz, self).query_obj()
        d['granularity'] = "all"
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
])
