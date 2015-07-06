from dateutil.parser import parse
from datetime import timedelta
from flask import Flask, request, Blueprint
from panoramix import settings, viz
from flask_bootstrap import Bootstrap
from wtforms import Form, SelectMultipleField, SelectField, TextField
import pandas as pd


pd.set_option('display.max_colwidth', -1)
since_l = {
    '1hour': timedelta(hours=1),
    '1day': timedelta(days=1),
    '7days': timedelta(days=7),
    '28days': timedelta(days=28),
    'all': timedelta(days=365*100)
}

client = settings.get_pydruid_client()


class DruidDataSource(object):

    def __init__(self, name):
        self.name = name
        self.cols = self.latest_metadata()
        self.col_names = sorted([col for col in self.cols.keys()])

    def latest_metadata(self):
        max_time = client.time_boundary(
            datasource=self.name)[0]['result']['maxTime']
        max_time = parse(max_time)
        intervals = (max_time - timedelta(seconds=1)).isoformat() + '/'
        intervals += max_time.isoformat()
        return client.segment_metadata(
            datasource=self.name,
            intervals=intervals)[-1]['columns']

def form_factory(datasource, form_args=None):
    grain = ['all', 'none', 'minute', 'hour', 'day']
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

    class QueryForm(Form):
        viz_type = SelectField(
            'Viz',
            choices=[(k, v.verbose_name) for k, v in viz.viz_types.items()])
        groupby = SelectMultipleField(
            'Group by', choices=[(m, m) for m in datasource.col_names])
        granularity = SelectField(
            'Granularity', choices=[(g, g) for g in grain])
        since = SelectField(
            'Since', choices=[(s, s) for s in since_l.keys()])
        limit = SelectField(
            'Limit', choices=[(s, s) for s in limits])
        flt_col_1 = SelectField(
            'Filter 1', choices=[(m, m) for m in datasource.col_names])
        flt_op_1 = SelectField(
            'Filter 1', choices=[(m, m) for m in ['==', '!=', 'in',]])
        flt_eq_1 = TextField("Super")
    return QueryForm


bp = Blueprint(
    'panoramix', __name__,
    template_folder='templates',
    static_folder='static')


@bp.route("/datasource/<name>/")
def datasource(name):
    viz_type = request.args.get("viz_type", "table")
    datasource = DruidDataSource(name)
    obj = viz.viz_types[viz_type](
        datasource,
        form_class=form_factory(datasource, request.args),
        form_data=request.args)
    return obj.render()


if __name__ == '__main__':
    app = Flask(__name__)
    app.secret_key = "monkeys"
    app.register_blueprint(bp, url_prefix='/panoramix')
    Bootstrap(app)

    app.debug = True
    app.run(host='0.0.0.0', port=settings.FLASK_APP_PORT)
