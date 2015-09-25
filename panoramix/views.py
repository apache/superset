from datetime import datetime
import json
import logging

from flask import request, redirect, flash, Response
from flask.ext.appbuilder import ModelView, CompactCRUDMixin, BaseView, expose
from flask.ext.appbuilder.actions import action
from flask.ext.appbuilder.models.sqla.interface import SQLAInterface
from flask.ext.appbuilder.security.decorators import has_access
from pydruid.client import doublesum
from sqlalchemy import create_engine
from wtforms.validators import ValidationError

from panoramix import appbuilder, db, models, viz, utils, app

config = app.config


def validate_json(form, field):
    try:
        json.loads(field.data)
    except Exception as e:
        logging.exception(e)
        raise ValidationError("Json isn't valid")


class DeleteMixin(object):
    @action(
        "muldelete", "Delete", "Delete all Really?", "fa-trash", single=False)
    def muldelete(self, items):
        self.datamodel.delete_all(items)
        self.update_redirect()
        return redirect(self.get_redirect())


class PanoramixModelView(ModelView):
    page_size = 100


class TableColumnInlineView(CompactCRUDMixin, PanoramixModelView):
    datamodel = SQLAInterface(models.TableColumn)
    can_delete = False
    edit_columns = [
        'column_name', 'description', 'groupby', 'filterable', 'table',
        'count_distinct', 'sum', 'min', 'max']
    list_columns = [
        'column_name', 'type', 'groupby', 'filterable', 'count_distinct',
        'sum', 'min', 'max']
    page_size = 100
appbuilder.add_view_no_menu(TableColumnInlineView)


class ColumnInlineView(CompactCRUDMixin, PanoramixModelView):
    datamodel = SQLAInterface(models.Column)
    edit_columns = [
        'column_name', 'description', 'datasource', 'groupby',
        'count_distinct', 'sum', 'min', 'max']
    list_columns = [
        'column_name', 'type', 'groupby', 'filterable', 'count_distinct',
        'sum', 'min', 'max']
    can_delete = False
    page_size = 100

    def post_update(self, col):
        col.generate_metrics()

appbuilder.add_view_no_menu(ColumnInlineView)


class SqlMetricInlineView(CompactCRUDMixin, PanoramixModelView):
    datamodel = SQLAInterface(models.SqlMetric)
    list_columns = ['metric_name', 'verbose_name', 'metric_type']
    edit_columns = [
        'metric_name', 'description', 'verbose_name', 'metric_type',
        'expression', 'table']
    add_columns = edit_columns
    page_size = 100
appbuilder.add_view_no_menu(SqlMetricInlineView)


class MetricInlineView(CompactCRUDMixin, PanoramixModelView):
    datamodel = SQLAInterface(models.Metric)
    list_columns = ['metric_name', 'verbose_name', 'metric_type']
    edit_columns = [
        'metric_name', 'description', 'verbose_name', 'metric_type',
        'datasource', 'json']
    add_columns = [
        'metric_name', 'verbose_name', 'metric_type', 'datasource', 'json']
    page_size = 100
    validators_columns = {
        'json': [validate_json],
    }
appbuilder.add_view_no_menu(MetricInlineView)


class DatabaseView(PanoramixModelView, DeleteMixin):
    datamodel = SQLAInterface(models.Database)
    list_columns = ['database_name', 'created_by', 'created_on']
    add_columns = ['database_name', 'sqlalchemy_uri']
    edit_columns = add_columns
    add_template = "panoramix/models/database/add.html"
    edit_template = "panoramix/models/database/edit.html"
    description_columns = {
        'sqlalchemy_uri': (
            "Refer to the SqlAlchemy docs for more information on how "
            "to structure your URI here: "
            "http://docs.sqlalchemy.org/en/rel_1_0/core/engines.html")
    }

appbuilder.add_view(
    DatabaseView,
    "Databases",
    icon="fa-database",
    category="Sources",
    category_icon='fa-database',)


class TableView(PanoramixModelView, DeleteMixin):
    datamodel = SQLAInterface(models.Table)
    list_columns = ['table_link', 'database']
    add_columns = ['table_name', 'database', 'default_endpoint']
    edit_columns = [
        'table_name', 'database', 'main_dttm_col', 'default_endpoint']
    related_views = [TableColumnInlineView, SqlMetricInlineView]

    def post_add(self, table):
        table.fetch_metadata()

    def post_update(self, table):
        table.fetch_metadata()

appbuilder.add_view(
    TableView,
    "Tables",
    category="Sources",
    icon='fa-table',)


appbuilder.add_separator("Sources")


class ClusterModelView(PanoramixModelView, DeleteMixin):
    datamodel = SQLAInterface(models.Cluster)
    add_columns = [
        'cluster_name',
        'coordinator_host', 'coordinator_port', 'coordinator_endpoint',
        'broker_host', 'broker_port', 'broker_endpoint',
    ]
    edit_columns = add_columns
    list_columns = ['cluster_name', 'metadata_last_refreshed']

appbuilder.add_view(
    ClusterModelView,
    "Druid Clusters",
    icon="fa-cubes",
    category="Sources",
    category_icon='fa-database',)


class SliceModelView(PanoramixModelView, DeleteMixin):
    datamodel = SQLAInterface(models.Slice)
    can_add = False
    list_columns = [
        'slice_link', 'viz_type', 'datasource_type',
        'datasource', 'created_by']
    edit_columns = [
        'slice_name', 'viz_type', 'druid_datasource',
        'table', 'dashboards', 'params']

appbuilder.add_view(
    SliceModelView,
    "Slices",
    icon="fa-bar-chart",
    category="",
    category_icon='',)


class DashboardModelView(PanoramixModelView, DeleteMixin):
    datamodel = SQLAInterface(models.Dashboard)
    list_columns = ['dashboard_link', 'created_by']
    edit_columns = ['dashboard_title', 'slices', 'position_json']
    add_columns = edit_columns


appbuilder.add_view(
    DashboardModelView,
    "Dashboards",
    icon="fa-dashboard",
    category="",
    category_icon='',)


class DatasourceModelView(PanoramixModelView, DeleteMixin):
    datamodel = SQLAInterface(models.Datasource)
    list_columns = [
        'datasource_link', 'cluster', 'owner', 'is_featured', 'is_hidden']
    related_views = [ColumnInlineView, MetricInlineView]
    edit_columns = [
        'datasource_name', 'cluster', 'description', 'owner',
        'is_featured', 'is_hidden', 'default_endpoint']
    page_size = 100
    base_order = ('datasource_name', 'asc')

    def post_add(self, datasource):
        datasource.generate_metrics()

    def post_update(self, datasource):
        datasource.generate_metrics()


appbuilder.add_view(
    DatasourceModelView,
    "Druid Datasources",
    category="Sources",
    icon="fa-cube")


@app.route('/health')
def health():
    return "OK"


@app.route('/ping')
def ping():
    return "OK"


class Panoramix(BaseView):
    @has_access
    @expose("/datasource/<datasource_type>/<datasource_id>/")
    def datasource(self, datasource_type, datasource_id):
        action = request.args.get('action')
        if action == 'save':
            session = db.session()
            d = request.args.to_dict(flat=False)
            del d['action']
            as_list = ('metrics', 'groupby')
            for k in d:
                v = d.get(k)
                if k in as_list and not isinstance(v, list):
                    d[k] = [v] if v else []
                if k not in as_list and isinstance(v, list):
                    d[k] = v[0]

            table_id = druid_datasource_id = None
            datasource_type = request.args.get('datasource_type')
            if datasource_type in ('datasource', 'druid'):
                druid_datasource_id = request.args.get('datasource_id')
            elif datasource_type == 'table':
                table_id = request.args.get('datasource_id')

            slice_name = request.args.get('slice_name')

            obj = models.Slice(
                params=json.dumps(d, indent=4, sort_keys=True),
                viz_type=request.args.get('viz_type'),
                datasource_name=request.args.get('datasource_name'),
                druid_datasource_id=druid_datasource_id,
                table_id=table_id,
                datasource_type=datasource_type,
                slice_name=slice_name,
            )
            session.add(obj)
            session.commit()
            flash("Slice <{}> has been added to the pie".format(slice_name), "info")
            redirect(obj.slice_url)

        if datasource_type == "table":
            datasource = (
                db.session
                .query(models.Table)
                .filter_by(id=datasource_id)
                .first()
            )
        else:
            datasource = (
                db.session
                .query(models.Datasource)
                .filter_by(id=datasource_id)
                .first()
            )

        if not datasource:
            flash("The datasource seem to have been deleted", "alert")
        viz_type = request.args.get("viz_type")
        if not viz_type and datasource.default_endpoint:
            return redirect(datasource.default_endpoint)
        if not viz_type:
            viz_type = "table"
        obj = viz.viz_types[viz_type](
            datasource,
            form_data=request.args)
        if request.args.get("json") == "true":
            try:
                payload = obj.get_json()
                status=200
            except Exception as e:
                logging.exception(e)
                payload = str(e)
                status=500
            return Response(
                payload,
                status=status,
                mimetype="application/json")
        else:
            try:
                resp = self.render_template("panoramix/viz.html", viz=obj)
            except Exception as e:
                if config.get("DEBUG"):
                    raise(e)
                return Response(
                    str(e),
                    status=500,
                    mimetype="application/json")
            return resp

    @has_access
    @expose("/save_dash/<dashboard_id>/", methods=['GET', 'POST'])
    def save_dash(self, dashboard_id):
        data = json.loads(request.form.get('data'))
        slice_ids = [int(d['slice_id']) for d in data]
        print slice_ids
        session = db.session()
        Dash = models.Dashboard
        dash = session.query(Dash).filter_by(id=dashboard_id).first()
        dash.slices = [o for o in dash.slices if o.id in slice_ids]
        print dash.slices
        dash.position_json = json.dumps(data, indent=4)
        session.merge(dash)
        session.commit()
        session.close()
        return "SUCCESS"

    @has_access
    @expose("/testconn", methods=["POST"])
    def testconn(self):
        try:
            uri = request.form.get('uri')
            db = create_engine(uri)
            db.connect()
            return "SUCCESS"
        except Exception as e:
            return Response(
                str(e),
                status=500,
                mimetype="application/json")

    @has_access
    @expose("/dashboard/<id_>/")
    def dashboard(self, id_):
        session = db.session()
        dashboard = (
            session
            .query(models.Dashboard)
            .filter(models.Dashboard.id == id_)
            .first()
        )
        pos_dict = {}
        if dashboard.position_json:
            pos_dict = {
                int(o['slice_id']):o for o in json.loads(dashboard.position_json)}
        return self.render_template(
            "panoramix/dashboard.html", dashboard=dashboard,
            pos_dict=pos_dict)

    @has_access
    @expose("/refresh_datasources/")
    def refresh_datasources(self):
        session = db.session()
        for cluster in session.query(models.Cluster).all():
            cluster.refresh_datasources()
            cluster.metadata_last_refreshed = datetime.now()
            flash(
                "Refreshed metadata from cluster "
                "[" + cluster.cluster_name + "]",
                'info')
        session.commit()
        return redirect("/datasourcemodelview/list/")

    @expose("/autocomplete/<datasource>/<column>/")
    def autocomplete(self, datasource, column):
        client = utils.get_pydruid_client()
        top = client.topn(
            datasource=datasource,
            granularity='all',
            intervals='2013-10-04/2020-10-10',
            aggregations={"count": doublesum("count")},
            dimension=column,
            metric='count',
            threshold=1000,
        )
        values = sorted([d[column] for d in top[0]['result']])
        return json.dumps(values)

appbuilder.add_view_no_menu(Panoramix)
appbuilder.add_link(
    "Refresh Druid Metadata",
    href='/panoramix/refresh_datasources/',
    category='Sources',
    category_icon='fa-database',
    icon="fa-cog")
