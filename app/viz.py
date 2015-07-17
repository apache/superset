from pydruid.utils.filters import Dimension, Filter
from datetime import datetime
from flask import render_template, flash
import pandas as pd
from pandas_highcharts.core import serialize
from pydruid.utils import aggregators as agg
from collections import OrderedDict
from app import utils
import config


CHART_ARGS = {
    'figsize': (None, 700),
    'title': None,
    'render_to': 'chart',
}


class BaseViz(object):
    verbose_name = "Base Viz"
    template = "panoramix/datasource.html"
    def __init__(self, datasource, form_class, form_data, view):
        self.datasource = datasource
        self.form_class = form_class
        self.form_data = form_data
        self.metric = form_data.get('metric', 'count')
        self.df = self.bake_query()
        self.view = view
        if self.df is not None:
            self.df.timestamp = pd.to_datetime(self.df.timestamp)
            self.df_prep()
            self.form_prep()

    def query_filters(self):
        args = self.form_data
        # Building filters
        i = 1
        filters = None
        while True:
            col = args.get("flt_col_" + str(i))
            op = args.get("flt_op_" + str(i))
            eq = args.get("flt_eq_" + str(i))
            if col and op and eq:
                cond = None
                if op == '==':
                    cond = Dimension(col)==eq
                elif op == '!=':
                    cond = ~(Dimension(col)==eq)
                elif op == 'in':
                    fields = []
                    for s in eq.split(','):
                        s = s.strip()
                        fields.append(Filter.build_filter(Dimension(col)==s))
                    cond = Filter(type="and", fields=fields)

                if filters:
                    filters = cond and filters
                else:
                    filters = cond
            else:
                break
            i += 1
        return filters

    def query_obj(self):
        ds = self.datasource
        args = self.form_data
        groupby = args.getlist("groupby") or []
        granularity = args.get("granularity")
        aggregations = {
            m.metric_name: m.json_obj
            for m in ds.metrics if m.metric_name == self.metric
        }
        limit = int(
            args.get("limit", config.ROW_LIMIT)) or config.ROW_LIMIT
        since = args.get("since", "all")
        from_dttm = (datetime.now() - utils.since_l[since]).isoformat()
        d = {
            'datasource': ds.datasource_name,
            'granularity': granularity or 'all',
            'intervals': from_dttm + '/' + datetime.now().isoformat(),
            'dimensions': groupby,
            'aggregations': aggregations,
            'limit_spec': {
                "type": "default",
                "limit": limit,
                "columns": [{
                    "dimension": self.metric,
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


class TimeSeriesViz(HighchartsViz):
    verbose_name = "Time Series - Line Chart"
    chart_kind = "line"

    def render(self):
        metric = self.metric
        df = self.df
        df = df.pivot_table(
            index="timestamp",
            columns=[
                col for col in df.columns if col not in ["timestamp", metric]],
            values=[metric])

        chart_js = serialize(
            df, kind=self.chart_kind, stacked=self.stacked, **CHART_ARGS)
        return super(TimeSeriesViz, self).render(chart_js=chart_js)

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
        metric = self.metric
        df = self.df
        df = df.pivot_table(
            index=[
                col for col in df.columns if col not in ['timestamp', metric]],
            values=[metric])
        df = df.sort(metric, ascending=False)
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
        metric = self.metric
        df = self.df
        df = df.pivot_table(
            index=[
                col for col in df.columns if col not in ['timestamp', metric]],
            values=[metric])
        df = df.sort(metric, ascending=False)
        chart_js = serialize(
            df, kind=self.chart_kind, **CHART_ARGS)
        return super(DistributionPieViz, self).render(chart_js=chart_js)

viz_types = OrderedDict([
    ['table', TableViz],
    ['line', TimeSeriesViz],
    ['area', TimeSeriesAreaViz],
    ['bar', TimeSeriesBarViz],
    ['dist_bar', DistributionBarViz],
    ['pie', DistributionPieViz],
    ['stacked_ts_bar', TimeSeriesStackedBarViz],
])
