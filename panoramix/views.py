from datetime import datetime
import json
import logging

from flask import request, redirect, flash, Response
from flask.ext.appbuilder.models.sqla.interface import SQLAInterface
from flask.ext.appbuilder import ModelView, CompactCRUDMixin, BaseView, expose
from flask.ext.appbuilder.security.decorators import has_access
from pydruid.client import doublesum
from wtforms.validators import ValidationError
from flask.ext.appbuilder.actions import action

from panoramix import appbuilder, db, models, viz, utils, app


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


class TableColumnInlineView(CompactCRUDMixin, ModelView):
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


class ColumnInlineView(CompactCRUDMixin, ModelView):
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


class SqlMetricInlineView(CompactCRUDMixin, ModelView):
    datamodel = SQLAInterface(models.SqlMetric)
    list_columns = ['metric_name', 'verbose_name', 'metric_type']
    edit_columns = [
        'metric_name', 'description', 'verbose_name', 'metric_type',
        'expression', 'table']
    add_columns = edit_columns
    page_size = 100
appbuilder.add_view_no_menu(SqlMetricInlineView)


class MetricInlineView(CompactCRUDMixin, ModelView):
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


class ClusterModelView(ModelView, DeleteMixin):
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
    icon="fa-server",
    category="Admin",
    category_icon='fa-cogs',)


class SliceModelView(ModelView, DeleteMixin):
    datamodel = SQLAInterface(models.Slice)
    list_columns = ['slice_link', 'viz_type', 'datasource', 'created_by']

appbuilder.add_view(
    SliceModelView,
    "Slices",
    icon="fa-bar-chart",
    category="",
    category_icon='',)


class DashboardModelView(ModelView, DeleteMixin):
    datamodel = SQLAInterface(models.Dashboard)
    list_columns = ['dashboard_link', 'created_by']
    edit_columns = ['dashboard_title', 'slices',]
    add_columns = edit_columns


appbuilder.add_view(
    DashboardModelView,
    "Dashboards",
    icon="fa-dashboard",
    category="",
    category_icon='',)


class DatabaseView(ModelView, DeleteMixin):
    datamodel = SQLAInterface(models.Database)
    list_columns = ['database_name']
    add_columns = ['database_name', 'sqlalchemy_uri']
    edit_columns = add_columns

appbuilder.add_view(
    DatabaseView,
    "Databases",
    icon="fa-database",
    category="Admin",
    category_icon='fa-cogs',)


class TableView(ModelView, DeleteMixin):
    datamodel = SQLAInterface(models.Table)
    list_columns = ['table_link', 'database']
    add_columns = ['table_name', 'database', 'default_endpoint']
    edit_columns = [
        'table_name', 'database', 'main_datetime_column', 'default_endpoint']
    related_views = [TableColumnInlineView, SqlMetricInlineView]

    def post_add(self, table):
        table.fetch_metadata()

    def post_update(self, table):
        table.fetch_metadata()

appbuilder.add_view(
    TableView,
    "Tables",
    icon='fa-table',)


class DatasourceModelView(ModelView, DeleteMixin):
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
    icon="fa-cube")


@app.route('/health')
def health():
    return "OK"


@app.route('/ping')
def ping():
    return "OK"


class Panoramix(BaseView):
    @has_access
    @expose("/table/<table_id>/")
    def table(self, table_id):
        table = (
            db.session
            .query(models.Table)
            .filter_by(id=table_id)
            .first()
        )
        if not table:
            flash("The table seem to have been deleted", "alert")
        viz_type = request.args.get("viz_type")
        if not viz_type and table.default_endpoint:
            return redirect(table.default_endpoint)
        if not viz_type:
            viz_type = "table"
        obj = viz.viz_types[viz_type](
            table,
            form_data=request.args, view=self)
        if request.args.get("json") == "true":
            try:
                payload = obj.get_json()
                status=200
            except Exception as e:
                payload = str(e)
                status=500
            return Response(
                payload,
                status=status,
                mimetype="application/json")
        else:
            return self.render_template("panoramix/viz.html", viz=obj)

    @has_access
    @expose("/datasource/<datasource_name>/")
    def datasource(self, datasource_name):
        viz_type = request.args.get("viz_type")

        datasource = (
            db.session
            .query(models.Datasource)
            .filter_by(datasource_name=datasource_name)
            .first()
        )
        if not viz_type and datasource.default_endpoint:
            return redirect(datasource.default_endpoint)
        if not viz_type:
            viz_type = "table"
        obj = viz.viz_types[viz_type](
            datasource,
            form_data=request.args, view=self)
        if request.args.get("json"):
            return Response(
                json.dumps(obj.get_query(), indent=4),
                status=200,
                mimetype="application/json")
        if not hasattr(obj, 'df') or obj.df is None or obj.df.empty:
            return obj.render_no_data()

        return obj.check_and_render()

    @has_access
    @expose("/save/")
    def save(self):
        session = db.session()
        obj = models.Slice(
            params=json.dumps(request.args.to_dict()),
            viz_type=request.args.get('viz_type'),
            datasource_name=request.args.get('datasource_name'),
            datasource_id=request.args.get('datasource_id'),
            datasource_type=request.args.get('datasource_type'),
            slice_name=request.args.get('slice_name', 'junk'),
        )
        session.add(obj)
        session.commit()
        session.close()

        return "super!"

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
        return self.render_template(
            "panoramix/dashboard.html", dashboard=dashboard)

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
    category='Admin',
    category_icon='fa-cogs',
    icon="fa-cog")
