from pydruid import client
from pydruid.utils.filters import Dimension, Filter
from datetime import datetime
from flask import render_template, flash
import pandas as pd
from pandas_highcharts.core import serialize


CHART_ARGS = {
    'figsize': (None, 700),
    'title': None,
    'render_to': 'chart',
}

# temp hack
metric = "count"


class BaseViz(object):
    verbose_name = "Base Viz"
    template = "panoramix/datasource.html"
    def __init__(self, datasource, form_class, form_data):
        self.datasource = datasource
        self.form_class = form_class
        self.form_data = form_data
        self.df = self.bake_query()
        if self.df is not None:
            self.df.timestamp = pd.to_datetime(self.df.timestamp)
            self.df_prep()
            self.form_prep()

    def bake_query(self):
        ds = self.datasource
        args = self.form_data
        groupby = args.getlist("groupby") or []
        granularity = args.get("granularity")
        metric = "count"
        limit = int(args.get("limit", ROW_LIMIT)) or ROW_LIMIT
        since = args.get("since", "all")
        from_dttm = (datetime.now() - since_l[since]).isoformat()

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
                    cond = Filter(type="or", fields=fields)


                if filters:
                    filters = cond and filters
                else:
                    filters = cond
            else:
                break
            i += 1

        kw = {}
        if filters:
            kw['filter'] = filters
        query.groupby(
            datasource=ds.name,
            granularity=granularity or 'all',
            intervals=from_dttm + '/' + datetime.now().isoformat(),
            dimensions=groupby,
            aggregations={"count": client.doublesum(metric)},
            #filter=filters,
            limit_spec={
                "type": "default",
                "limit": limit,
                "columns": [{
                    "dimension" : metric,
                    "direction" : "descending",
                },],
            },
            **kw
        )
        return query.export_pandas()


    def df_prep(self, ):
        pass

    def form_prep(self):
        pass

    def render(self, *args, **kwargs):
        form = self.form_class(self.form_data)
        return render_template(
            self.template, form=form)


class TableViz(BaseViz):
    verbose_name = "Table View"
    template = 'panoramix/viz_table.html'
    def render(self):
        form = self.form_class(self.form_data)
        if self.df is None or self.df.empty:
            flash("No data.", "error")
            table = None
        else:
            if self.form_data.get("granularity") == "all":
                del self.df['timestamp']
            table = self.df.to_html(
                classes=["table", "table-striped", 'table-bordered'],
                index=False)
        return render_template(
            self.template, form=form, table=table)


class HighchartsViz(BaseViz):
    verbose_name = "Base Highcharts Viz"
    template = 'panoramix/viz_highcharts.html'
    chart_kind = 'line'
    def render(self, *args, **kwargs):
        form = self.form_class(self.form_data)
        if self.df is None or self.df.empty:
            flash("No data.", "error")
        else:
            table = self.df.to_html(
                classes=["table", "table-striped", 'table-bordered'],
                index=False)
        return render_template(
            self.template, form=form, table=table,
            *args, **kwargs)


class TimeSeriesViz(HighchartsViz):
    verbose_name = "Time Series - Line Chart"
    chart_kind = "line"
    def render(self):
        df = self.df
        df = df.pivot_table(
            index="timestamp",
            columns=[
                col for col in df.columns if col not in ["timestamp", metric]],
            values=[metric])
        chart_js = serialize(
            df, kind=self.chart_kind, **CHART_ARGS)
        return super(TimeSeriesViz, self).render(chart_js=chart_js)


class TimeSeriesAreaViz(TimeSeriesViz):
    verbose_name = "Time Series - Area Chart"
    chart_kind = "area"


class DistributionBarViz(HighchartsViz):
    verbose_name = "Distribution - Bar Chart"
    chart_kind = "bar"
    def render(self):
        df = self.df
        df = df.pivot_table(
            index=[
                col for col in df.columns if col not in ['timestamp', metric]],
            values=[metric])
        df = df.sort(metric, ascending=False)
        chart_js = serialize(
            df, kind=self.chart_kind, **CHART_ARGS)
        return super(DistributionBarViz, self).render(chart_js=chart_js)

viz_types = {
    'table': TableViz,
    'line': TimeSeriesViz,
    'area': TimeSeriesAreaViz,
    'dist_bar': DistributionBarViz,
}
