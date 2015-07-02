from pydruid import client
from pydruid.utils.filters import Dimension
from dateutil.parser import parse
from datetime import datetime, timedelta
from flask import Flask, render_template, request
from flask_bootstrap import Bootstrap
import json
from wtforms import Form, SelectMultipleField, SelectField, TextField
import pandas as pd
pd.set_option('display.max_colwidth', -1)

ROW_LIMIT = 10000
PORT = 8088
query = client.PyDruid("http://10.181.47.80:8080", 'druid/v2')

app = Flask(__name__)
Bootstrap(app)

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
    print filters

    results=[]
    results = query.groupby(
        datasource=datasource,
        granularity=granularity or 'all',
        intervals=from_dttm + '/' + datetime.now().isoformat(),
        dimensions=groupby,
        aggregations={"count": client.doublesum("count")},
        filter=filters,
        limit_spec={
            "type": "default",
            "limit": limit,
            "columns": [{
                "dimension" : "count",
                "direction" : "descending",
            },],
        },
    )

    df = query.export_pandas()
    if df is not None and not df.empty:
        df = df.sort(df.columns[0], ascending=False)
        if granularity == 'all':
            del df['timestamp']

        table = df.to_html(
            classes=["table", "table-striped", 'table-bordered'], index=False)
    else:
        table = None

    return render_template(
        'panoramix/datasource.html',
        table=table,
        datasource=datasource,
        latest_metadata=json.dumps(
            metadata,
            sort_keys=True,
            indent=2),
        results=json.dumps(
            results,
            sort_keys=True,
            indent=2),
        form=QueryForm(request.args),
    )

if __name__ == '__main__':
    app.debug = True
    app.run(host='0.0.0.0', port=PORT)
