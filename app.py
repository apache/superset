from pydruid import client
from pydruid.utils.filters import Dimension
from dateutil.parser import parse
from datetime import datetime, timedelta
from flask import Flask, render_template, request, flash
from flask_bootstrap import Bootstrap
import json
from wtforms import Form, SelectMultipleField, SelectField, TextField
import pandas as pd
from pandas_highcharts.core import serialize

pd.set_option('display.max_colwidth', -1)

ROW_LIMIT = 10000
PORT = 8088
CHART_ARGS = {
    'figsize': (None, 700),
    'title': None,
}
query = client.PyDruid("http://10.181.47.80:8080", 'druid/v2')

app = Flask(__name__)
Bootstrap(app)


class BaseViz(object):
    template = "panoramix/datasource.html"
    def __init__(self):
        pass

    def form_class(self):
        pass


viz_types = {
    'table': 'Table',
    'line': 'Time Series - Line',
    'bar': 'Time Series - Bar',
    'bar_distro': 'Distribution - Bar',
}

def latest_metadata(datasource):
    max_time = query.time_boundary(datasource=datasource)[0]['result']['maxTime']
    max_time = parse(max_time)
    intervals = (max_time - timedelta(seconds=1)).isoformat() + '/'
    intervals += max_time.isoformat()
    return query.segment_metadata(
        datasource=datasource,
        intervals=intervals)[-1]['columns']

@app.route("/datasource/<datasource>/")
def datasource(datasource):

    metadata = latest_metadata(datasource)
    grain = ['all', 'none', 'minute', 'hour', 'day']
    since_l = {
        '1hour': timedelta(hours=1),
        '1day': timedelta(days=1),
        '7days': timedelta(days=7),
        '28days': timedelta(days=28),
        'all': timedelta(days=365*100)
    }
    limits = [0, 5, 10, 25, 50, 100, 500]
    limit = request.args.get("limit")
    try:
        limit = int(limit)
        if limit not in limits:
            limits.append(limit)
            limits = sorted(limits)
    except:
        pass
    class QueryForm(Form):
        viz_type = SelectField(
            'Viz', choices=[v for v in viz_types.items()])
        groupby = SelectMultipleField(
            'Group by', choices=[(m, m) for m in sorted(metadata.keys())])
        granularity = SelectField(
            'Granularity', choices=[(g, g) for g in grain])
        since = SelectField(
            'Since', choices=[(s, s) for s in since_l.keys()])
        limit = SelectField(
            'Limit', choices=[(s, s) for s in limits])
        flt_col_1 = SelectField(
            'Filter 1', choices=[(m, m) for m in sorted(metadata.keys())])
        flt_op_1 = SelectField(
            'Filter 1', choices=[(m, m) for m in ['==', 'in', '<', '>']])
        flt_eq_1 = TextField("Super")

    groupby = request.args.getlist("groupby") or []
    granularity = request.args.get("granularity")
    metric = "count"
    limit = int(request.args.get("limit", ROW_LIMIT)) or ROW_LIMIT
    since = request.args.get("since", "all")
    from_dttm = (datetime.now() - since_l[since]).isoformat()

    # Building filters
    i = 1
    filters = []
    while True:
        col = request.args.get("flt_col_" + str(i))
        op = request.args.get("flt_op_" + str(i))
        eq = request.args.get("flt_eq_" + str(i))
        print (col,op,eq)
        if col and op and eq:
            filters.append(Dimension(col)==eq)
            filters = Dimension(col)==eq
        else:
            break
        i += 1

    results=[]
    results = query.groupby(
        datasource=datasource,
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
    )

    viz_type = request.args.get("viz_type", "table")

    chart_js = None
    table = None
    df = query.export_pandas()
    template = 'panoramix/viz_highcharts.html'
    if df is None or df.empty:
        flash("No data", "error")
    elif viz_type == "table":
        template = 'panoramix/viz_table.html'
        df = df.sort(df.columns[0], ascending=False)
        if granularity == 'all':
            del df['timestamp']

        table = df.to_html(
            classes=["table", "table-striped", 'table-bordered'], index=False)
    elif viz_type == "line":
        df = df.pivot_table(
            index="timestamp",
            columns=[
                col for col in df.columns if col not in ["timestamp", metric]],
            values=[metric])
        chart_js = serialize(
            df, render_to="chart", kind="line", **CHART_ARGS)
    elif viz_type == "bar":
        df = df.pivot_table(
            index="timestamp",
            columns=[
                col for col in df.columns if col not in ["timestamp", metric]],
            values=[metric])
        chart_js = serialize(df, render_to="chart", kind="bar", **CHART_ARGS)
    elif viz_type == "bar_distro":
        df = df.pivot_table(
            index=[
                col for col in df.columns if col not in ["timestamp", metric]],
            values=[metric])
        df = df.sort(metric, ascending=False)
        chart_js = serialize(df, render_to="chart", kind="bar", **CHART_ARGS)

    return render_template(
        template,
        table=table,
        verbose_viz_type=viz_types[viz_type],
        viz_type=viz_type,
        datasource=datasource,
        chart_js=chart_js,
        latest_metadata=json.dumps(
            metadata,
            sort_keys=True,
            indent=2),
        results=json.dumps(
            results,
            sort_keys=True,
            indent=2),
        form=QueryForm(request.args, id="queryform"),
    )

if __name__ == '__main__':
    app.debug = True
    app.run(host='0.0.0.0', port=PORT)
