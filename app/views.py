from datetime import datetime
import logging
import json

from flask import request, redirect, flash, Response
from flask.ext.appbuilder.models.sqla.interface import SQLAInterface
from flask.ext.appbuilder import ModelView, CompactCRUDMixin, BaseView, expose
from app import appbuilder, db, models, viz, utils, app, get_session
from flask.ext.appbuilder.security.decorators import has_access, permission_name
import config
from pydruid.client import doublesum
from wtforms.validators import ValidationError
from flask.ext.appbuilder.actions import action


def validate_json(form, field):
    try:
        json.loads(field.data)
    except Exception as e:
        raise ValidationError("Json isn't valid")

class DeleteMixin(object):
    @action("muldelete", "Delete", "Delete all Really?", "fa-trash", single=False)
    def muldelete(self, items):
        self.datamodel.delete_all(items)
        self.update_redirect()
        return redirect(self.get_redirect())


class TableColumnInlineView(CompactCRUDMixin, ModelView):
    datamodel = SQLAInterface(models.TableColumn)
    can_delete = False
    edit_columns = [
        'column_name', 'description', 'table', 'groupby', 'filterable',
        'count_distinct', 'sum', 'min', 'max']
    list_columns = [
        'column_name', 'type', 'groupby', 'count_distinct',
        'sum', 'min', 'max']
    page_size = 100
    list_columns = [
        'column_name', 'type', 'groupby', 'count_distinct',
        'sum', 'min', 'max']
appbuilder.add_view_no_menu(TableColumnInlineView)


class ColumnInlineView(CompactCRUDMixin, ModelView):
    datamodel = SQLAInterface(models.Column)
    edit_columns = [
        'column_name', 'description', 'datasource', 'groupby',
        'count_distinct', 'sum', 'min', 'max']
    list_columns = [
        'column_name', 'type', 'groupby', 'count_distinct',
        'sum', 'min', 'max']
    can_delete = False
    page_size = 100

    def post_update(self, col):
        col.generate_metrics()

    def post_update(self, col):
        col.generate_metrics()

appbuilder.add_view_no_menu(ColumnInlineView)


class MetricInlineView(CompactCRUDMixin, ModelView):
    datamodel = SQLAInterface(models.Metric)
    list_columns = ['metric_name', 'verbose_name', 'metric_type' ]
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
    add_columns = ['table_name', 'database']
    edit_columns = add_columns
    related_views = [TableColumnInlineView]

    def post_insert(self, table):
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

    def post_insert(self, datasource):
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
    @permission_name('tables')
    @expose("/table/<table_id>/")
    def table(self, table_id):

        table = (
            db.session
            .query(models.Table)
            .filter_by(id=table_id)
            .first()
        )
        viz_type = request.args.get("viz_type")
        if not viz_type and table.default_endpoint:
            return redirect(table.default_endpoint)
        if not viz_type:
            viz_type = "table"
        obj = viz.viz_types[viz_type](
            table,
            form_data=request.args, view=self)
        if request.args.get("json"):
            return Response(
                json.dumps(obj.get_query(), indent=4),
                status=200,
                mimetype="application/json")
        if obj.df is None or obj.df.empty:
            return obj.render_no_data()
        return obj.render()

    @has_access
    @permission_name('datasources')
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
        if obj.df is None or obj.df.empty:
            return obj.render_no_data()
        return obj.render()

    @has_access
    @permission_name('refresh_datasources')
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

#models.Metric.__table__.drop(db.engine)
db.create_all()
