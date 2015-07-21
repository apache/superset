from pydruid.utils.filters import Dimension, Filter
from datetime import datetime
from flask import render_template, flash, request
import pandas as pd
from pandas_highcharts.core import serialize
from pydruid.utils import aggregators as agg
from collections import OrderedDict
from app import utils
from wtforms import Form, SelectMultipleField, SelectField, TextField
import config


CHART_ARGS = {
    'figsize': (None, 700),
    'title': None,
    'render_to': 'chart',
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

        self.df = self.bake_query()
        self.view = view
        if self.df is not None:
            self.df.timestamp = pd.to_datetime(self.df.timestamp)
            self.df_prep()
            self.form_prep()

    def form_class(self):
        return form_factory(self.datasource, request.args)

    def query_filters(self):
        args = self.form_data
        # Building filters
        filters = None
        for i in range(1, 10):
            col = args.get("flt_col_" + str(i))
            op = args.get("flt_op_" + str(i))
            eq = args.get("flt_eq_" + str(i))
            if col and op and eq:
                cond = None
                if op == '==':
                    cond = Dimension(col)==eq
                elif op == '!=':
                    cond = ~(Dimension(col)==eq)
                elif op in ('in', 'not in'):
                    fields = []
                    splitted = eq.split(',')
                    if len(splitted) > 1:
                        for s in eq.split(','):
                            s = s.strip()
                            fields.append(Filter.build_filter(Dimension(col)==s))
                        cond = Filter(type="or", fields=fields)
                    else:
                        cond = Dimension(col)==eq
                    if op == 'not in':
                        cond = ~cond
                if filters:
                    filters = Filter(type="and", fields=[
                        Filter.build_filter(cond),
                        Filter.build_filter(filters)
                    ])
                else:
                    filters = cond
        return filters

    def query_obj(self):
        ds = self.datasource
        args = self.form_data
        groupby = args.getlist("groupby") or []
        granularity = args.get("granularity", "1 day")
        granularity = utils.parse_human_timedelta(granularity).total_seconds() * 1000
        aggregations = {
            m.metric_name: m.json_obj
            for m in ds.metrics if m.metric_name in self.metrics
        }
        limit = int(
            args.get("limit", config.ROW_LIMIT)) or config.ROW_LIMIT
        since = args.get("since", "1 year ago")
        from_dttm = utils.parse_human_datetime(since)
        if from_dttm > datetime.now():
            from_dttm = datetime.now() - (from_dttm-datetime.now())
        from_dttm = from_dttm.isoformat()
        until = args.get("until", "now")
        to_dttm = utils.parse_human_datetime(until).isoformat()
        if from_dttm >= to_dttm:
            flash("The date range doesn't seem right.", "danger")
            from_dttm = to_dttm  # Making them identicial to not raise
        d = {
            'datasource': ds.datasource_name,
            'granularity': {"type": "duration", "duration": granularity},
            'intervals': from_dttm + '/' + to_dttm,
            'dimensions': groupby,
            'aggregations': aggregations,
            'limit_spec': {
                "type": "default",
                "limit": limit,
                "columns": [{
                    "dimension": self.metrics[0],
                    "direction": "descending",
                }],
            },
        }
        filters = self.query_filters()
        if filters:
            d['filter'] = filters
        return d

    def bake_query(self):
        client = utils.get_pydruid_client()
        client.groupby(**self.query_obj())
        return client.export_pandas()

    def get_query(self):
        client = utils.get_pydruid_client()
        client.groupby(**self.query_obj())
        return client.query_dict

    def df_prep(self, ):
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
    chart_kind = "spline"
    chart_type = 'stock'

    def render(self):
        metrics = self.metrics
        df = self.df
        df = df.pivot_table(
            index="timestamp",
            columns=self.groupby,
            values=metrics)

        rolling_periods = request.args.get("rolling_periods")
        rolling_type = request.args.get("rolling_type")
        if rolling_periods and rolling_type:
            if rolling_type == 'mean':
                df = pd.rolling_mean(df, int(rolling_periods))

        chart_js = serialize(
            df, kind=self.chart_kind,
            viz=self,
            compare=self.compare,
            chart_type=self.chart_type, stacked=self.stacked, **CHART_ARGS)
        return super(TimeSeriesViz, self).render(chart_js=chart_js)

    def form_class(self):
        return form_factory(self.datasource, request.args,
            extra_fields_dict={
                'compare': TextField('Period Compare',),
                'rolling_type': SelectField(
                    'Rolling',
                    choices=[(s, s) for s in ['mean', 'sum', 'std']]),
                'rolling_periods': TextField('Periods',),
            })

    def bake_query(self):
        """
        Doing a 2 phase query where we limit the number of series.
        """
        client = utils.get_pydruid_client()
        qry = self.query_obj()
        qry['granularity'] = "all"
        client.groupby(**qry)
        df = client.export_pandas()
        if not df is None:
            dims =  qry['dimensions']
            filters = []
            for index, row in df.iterrows():
                fields = []
                for dim in dims:
                    f = Filter.build_filter(Dimension(dim) == row[dim])
                    fields.append(f)
                if len(fields) > 1:
                    filters.append(Filter.build_filter(Filter(type="and", fields=fields)))
                elif fields:
                    filters.append(fields[0])

            qry = self.query_obj()
            if filters:
                ff = Filter(type="or", fields=filters)
                qry['filter'] = ff
            del qry['limit_spec']
            client.groupby(**qry)
        return client.export_pandas()

class TimeSeriesCompareViz(TimeSeriesViz):
    verbose_name = "Time Series - Percent Change"
    compare = 'percent'

class TimeSeriesAreaViz(TimeSeriesViz):
    verbose_name = "Time Series - Stacked Area Chart"
    stacked=True
    chart_kind = "area"


class TimeSeriesBarViz(TimeSeriesViz):
    verbose_name = "Time Series - Bar Chart"
    chart_kind = "bar"


class TimeSeriesStackedBarViz(TimeSeriesViz):
    verbose_name = "Time Series - Stacked Bar Chart"
    chart_kind = "bar"
    stacked = True


class DistributionBarViz(HighchartsViz):
    verbose_name = "Distribution - Bar Chart"
    chart_kind = "bar"

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
        chart_js = serialize(
            df, kind=self.chart_kind, **CHART_ARGS)
        return super(DistributionBarViz, self).render(chart_js=chart_js)


class DistributionPieViz(HighchartsViz):
    verbose_name = "Distribution - Pie Chart"
    chart_kind = "pie"

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
        chart_js = serialize(
            df, kind=self.chart_kind, **CHART_ARGS)
        return super(DistributionPieViz, self).render(chart_js=chart_js)

viz_types = OrderedDict([
    ['table', TableViz],
    ['line', TimeSeriesViz],
    ['compare', TimeSeriesCompareViz],
    ['area', TimeSeriesAreaViz],
    ['bar', TimeSeriesBarViz],
    ['stacked_ts_bar', TimeSeriesStackedBarViz],
    ['dist_bar', DistributionBarViz],
    ['pie', DistributionPieViz],
])
