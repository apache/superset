from dateutil.parser import parse
from datetime import timedelta
from flask import Flask, request, Blueprint, url_for, Markup
from flask.ext.sqlalchemy import SQLAlchemy
from flask.ext.admin import Admin, BaseView, expose, AdminIndexView
from panoramix import settings, viz, models
from flask_bootstrap import Bootstrap
from wtforms import Form, SelectMultipleField, SelectField, TextField
from wtforms.fields import Field
import pandas as pd
from flask_admin.contrib import sqla


pd.set_option('display.max_colwidth', -1)

client = settings.get_pydruid_client()


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


class DruidDataSource(object):

    def __init__(self, name):
        self.name = name
        self.cols = self.latest_metadata()
        self.col_names = sorted([
            col for col in self.cols.keys()
            if not col.startswith("_") and col not in self.metrics])

    def latest_metadata(self):
        results = client.time_boundary(datasource=self.name)
        max_time = results[0]['result']['maxTime']
        max_time = parse(max_time)
        intervals = (max_time - timedelta(seconds=1)).isoformat() + '/'
        intervals += (max_time + timedelta(seconds=1)).isoformat()
        segment_metadata = client.segment_metadata(
            datasource=self.name,
            intervals=intervals)
        return segment_metadata[-1]['columns']

    @property
    def metrics(self):
        return [
            k for k, v in self.cols.items()
            if v['type'] != 'STRING' and not k.startswith('_')]

    def sync_to_db(self):
        DS = Datasource
        datasource = DS.query.filter_by(datasource_name=self.name).first()
        if not datasource:
            db.session.add(DS(datasource_name=self.name))
        for col in self.cols:
            col_obj = Column.query.filter_by(datasource_name=self.name, column_name=col).first()
            datatype = self.cols[col]['type']
            if not col_obj:
                col_obj = Column(datasource_name=self.name, column_name=col)
                db.session.add(col_obj)
                if datatype == "STRING":
                    col_obj.groupby = True
            if col_obj:
                col_obj.type = self.cols[col]['type']

        db.session.commit()


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

    class QueryForm(OmgWtForm):
        viz_type = SelectField(
            'Viz',
            choices=[(k, v.verbose_name) for k, v in viz.viz_types.items()])
        metric = SelectField(
            'Metric', choices=[(m, m) for m in datasource.metrics])
        groupby = SelectMultipleField(
            'Group by', choices=[(m, m) for m in datasource.col_names])
        granularity = SelectField(
            'Granularity', choices=[(g, g) for g in grain])
        since = SelectField(
            'Since', choices=[(s, s) for s in settings.since_l.keys()],
            default="all")
        limit = SelectField(
            'Limit', choices=[(s, s) for s in limits])
    for i in range(10):
        setattr(QueryForm, 'flt_col_' + str(i), SelectField(
            'Filter 1', choices=[(m, m) for m in datasource.col_names]))
        setattr(QueryForm, 'flt_op_' + str(i), SelectField(
            'Filter 1', choices=[(m, m) for m in ['==', '!=', 'in',]]))
        setattr(QueryForm, 'flt_eq_' + str(i), TextField("Super"))
    return QueryForm

"""
bp = Blueprint(
    'panoramix', __name__,
    template_folder='templates',
    static_folder='static')
"""



app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = settings.SQLALCHEMY_DATABASE_URI
db = SQLAlchemy(app)
app.secret_key = "monkeys"
#app.register_blueprint(bp, url_prefix='/panoramix')
Bootstrap(app)
admin = Admin(
    app, name = "Panoramix",
    template_mode='bootstrap3')



class Datasource(db.Model):
    __tablename__ = 'datasources'
    id = db.Column(db.Integer, primary_key=True)
    datasource_name = db.Column(db.String(256), unique=True)
    is_featured = db.Column(db.Boolean, default=False)
    is_hidden = db.Column(db.Boolean, default=False)
    description = db.Column(db.Text)
    created_dttm = db.Column(db.DateTime, default=db.func.now())


class Column(db.Model):
    __tablename__ = 'columns'
    id = db.Column(db.Integer, primary_key=True)
    datasource_name = db.Column(
        db.String(256),
        db.ForeignKey('datasources.datasource_name'))
    column_name = db.Column(db.String(256))
    is_active = db.Column(db.Boolean, default=True)
    type = db.Column(db.String(32))
    groupby = db.Column(db.Boolean, default=False)
    count_distinct = db.Column(db.Boolean, default=False)
    sum = db.Column(db.Boolean, default=False)
    max = db.Column(db.Boolean, default=False)
    min = db.Column(db.Boolean, default=False)
    datasource = db.relationship('Datasource',
        backref=db.backref('columns', lazy='dynamic'))

    def __repr__(self):
        return self.column_name


class JsUdf(db.Model):
    __tablename__ = 'udfs'
    id = db.Column(db.Integer, primary_key=True)
    datasource_name = db.Column(
        db.String(256),
        db.ForeignKey('datasources.datasource_name'))
    udf_name = db.Column(db.String(256))
    column_list = db.Column(db.String(1024))
    code = db.Column(db.Text)
    datasource = db.relationship('Datasource',
        backref=db.backref('udfs', lazy='dynamic'))


def datasource_link(v, c, m, p):
    url = '/admin/datasourceview/datasource/{}/'.format(m.datasource_name)
    return Markup('<a href="{url}">{m.datasource_name}</a>'.format(**locals()))


class DatasourceAdmin(sqla.ModelView):
    inline_models = (Column, JsUdf,)
    column_formatters = dict(datasource_name=datasource_link)


class DatasourceView(BaseView):
    @expose('/')
    def index(self):
        return ""
    @expose("/datasource/<datasource_name>/")
    def datasource(self, datasource_name):
        viz_type = request.args.get("viz_type", "table")
        datasource = DruidDataSource(datasource_name)
        obj = viz.viz_types[viz_type](
            datasource,
            form_class=form_factory(datasource, request.args),
            form_data=request.args,
            admin_view=self)
        if obj.df is None or obj.df.empty:
            return obj.render_no_data()
        return obj.render()


    @expose("/datasources/")
    def datasources():
        import requests
        import json
        endpoint = (
            "http://{COORDINATOR_HOST}:{COORDINATOR_PORT}/"
            "{COORDINATOR_BASE_ENDPOINT}/datasources"
        ).format(**settings.__dict__)
        datasources = json.loads(requests.get(endpoint).text)
        for datasource in datasources:
            ds = DruidDataSource(datasource)
            ds.sync_to_db()

        return json.dumps(datasources, indent=4)


    @expose("/datasource_metadata/<name>/")
    def datasource_metadata(name):
        import requests
        import json
        endpoint = (
            "http://{COORDINATOR_HOST}:{COORDINATOR_PORT}/"
            "{COORDINATOR_BASE_ENDPOINT}/datasource"
        ).format(**settings.__dict__)

        return str(datasources)

admin.add_view(DatasourceView(name="Datasource"))

if __name__ == '__main__':

    db.create_all()
    admin.add_view(DatasourceAdmin(Datasource, db.session, name="Datasources"))
    app.debug = True
    app.run(host='0.0.0.0', port=settings.FLASK_APP_PORT)
