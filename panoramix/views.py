from datetime import datetime
import json
import logging
import re
import traceback

from flask import request, redirect, flash, Response, render_template
from flask.ext.appbuilder import ModelView, CompactCRUDMixin, BaseView, expose
from flask.ext.appbuilder.actions import action
from flask.ext.appbuilder.models.sqla.interface import SQLAInterface
from flask.ext.appbuilder.security.decorators import has_access
from pydruid.client import doublesum
from sqlalchemy import create_engine
import sqlalchemy as sqla
from wtforms.validators import ValidationError

from panoramix import appbuilder, db, models, viz, utils, app, sm, ascii_art

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
        'count_distinct', 'sum', 'min', 'max', 'expression', 'is_dttm']
    add_columns = edit_columns
    list_columns = [
        'column_name', 'type', 'groupby', 'filterable', 'count_distinct',
        'sum', 'min', 'max', 'is_dttm']
    page_size = 100
    description_columns = {
        'is_dttm': (
            "Whether to make this column available as a "
            "[Time Granularity] option, column has to be DATETIME or "
            "DATETIME-like"),
    }
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
    list_columns = ['database_name', 'created_by', 'changed_on_']
    add_columns = ['database_name', 'sqlalchemy_uri']
    search_exclude_columns = ('password',)
    edit_columns = add_columns
    add_template = "panoramix/models/database/add.html"
    edit_template = "panoramix/models/database/edit.html"
    base_order = ('changed_on','desc')
    description_columns = {
        'sqlalchemy_uri': (
            "Refer to the SqlAlchemy docs for more information on how "
            "to structure your URI here: "
            "http://docs.sqlalchemy.org/en/rel_1_0/core/engines.html")
    }
    def pre_add(self, db):
        conn = sqla.engine.url.make_url(db.sqlalchemy_uri)
        db.password = conn.password
        conn.password = "X" * 10 if conn.password else None
        db.sqlalchemy_uri = str(conn)  # hides the password

    def pre_update(self, db):
        self.pre_add(db)

appbuilder.add_view(
    DatabaseView,
    "Databases",
    icon="fa-database",
    category="Sources",
    category_icon='fa-database',)


class TableView(PanoramixModelView, DeleteMixin):
    datamodel = SQLAInterface(models.SqlaTable)
    list_columns = ['table_link', 'database', 'changed_by', 'changed_on_']
    add_columns = ['table_name', 'database', 'default_endpoint', 'offset']
    edit_columns = [
        'table_name', 'database', 'main_dttm_col', 'default_endpoint',
        'offset']
    related_views = [TableColumnInlineView, SqlMetricInlineView]
    base_order = ('changed_on','desc')
    description_columns = {
        'offset': "Timezone offset (in hours) for this datasource"
    }

    def post_add(self, table):
        try:
            table.fetch_metadata()
        except Exception as e:
            flash(
            "Table [{}] doesn't seem to exist, "
            "couldn't fetch metadata".format(table.table_name),
            "danger")
        utils.merge_perm(sm, 'datasource_access', table.perm)

    def post_update(self, table):
        self.post_add(table)

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
        'datasource', 'created_by', 'changed_on_']
    edit_columns = [
        'slice_name', 'viz_type', 'druid_datasource',
        'table', 'dashboards', 'params']
    base_order = ('changed_on','desc')


appbuilder.add_view(
    SliceModelView,
    "Slices",
    icon="fa-bar-chart",
    category="",
    category_icon='',)


class DashboardModelView(PanoramixModelView, DeleteMixin):
    datamodel = SQLAInterface(models.Dashboard)
    list_columns = ['dashboard_link', 'created_by', 'changed_by', 'changed_on_']
    edit_columns = [
        'dashboard_title', 'slug', 'slices', 'position_json', 'css']
    add_columns = edit_columns
    base_order = ('changed_on','desc')
    description_columns = {
        'position_json': (
            "This json object describes the positioning of the widgets in "
            "the dashboard. It is dynamically generated when adjusting "
            "the widgets size and positions by using drag & drop in "
            "the dashboard view"),
        'css': (
            "The css for individual dashboards can be altered here, or "
            "in the dashboard view where changes are immediatly "
            "visible"),
        'slug': "To get a readable URL for your dashboard",
    }
    def pre_add(self, obj):
        obj.slug = obj.slug.strip() or None
        if obj.slug:
            obj.slug = obj.slug.replace(" ", "-")
            obj.slug = re.sub(r'\W+', '', obj.slug)

    def pre_update(self, obj):
        self.pre_add(obj)


appbuilder.add_view(
    DashboardModelView,
    "Dashboards",
    icon="fa-dashboard",
    category="",
    category_icon='',)


class LogModelView(PanoramixModelView):
    datamodel = SQLAInterface(models.Log)
    list_columns = ('user', 'action', 'dttm')
    edit_columns = ('user', 'action', 'dttm', 'json')
    base_order = ('dttm','desc')

appbuilder.add_view(
    LogModelView,
    "Action Log",
    category="Security",
    icon="fa-list-ol")


class DatasourceModelView(PanoramixModelView, DeleteMixin):
    datamodel = SQLAInterface(models.Datasource)
    list_columns = [
        'datasource_link', 'cluster', 'owner', 'is_featured', 'is_hidden',
        'offset']
    related_views = [ColumnInlineView, MetricInlineView]
    edit_columns = [
        'datasource_name', 'cluster', 'description', 'owner',
        'is_featured', 'is_hidden', 'default_endpoint', 'offset']
    page_size = 100
    base_order = ('datasource_name', 'asc')
    description_columns = {
        'offset': "Timezone offset (in hours) for this datasource"
    }

    def post_add(self, datasource):
        datasource.generate_metrics()
        utils.merge_perm(sm, 'datasource_access', datasource.perm)

    def post_update(self, datasource):
        self.post_add(datasource)

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
    @expose("/explore/<datasource_type>/<datasource_id>/")
    @expose("/datasource/<datasource_type>/<datasource_id>/")  # Legacy url
    @utils.log_this
    def explore(self, datasource_type, datasource_id):
        if datasource_type == "table":
            datasource = (
                db.session
                .query(models.SqlaTable)
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

            all_datasource_access = self.appbuilder.sm.has_access(
                'all_datasource_access', 'all_datasource_access')
            datasource_access = self.appbuilder.sm.has_access(
                'datasource_access', datasource.perm)
            if not (all_datasource_access or datasource_access):
                flash(
                    "You don't seem to have access to this datasource",
                    "danger")
                return redirect('/slicemodelview/list/')
        action = request.args.get('action')
        if action in ('save', 'overwrite'):
            session = db.session()

            # TODO use form processing form wtforms
            d = request.args.to_dict(flat=False)
            del d['action']
            del d['previous_viz_type']
            as_list = ('metrics', 'groupby', 'columns')
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

            if action == "save":
                slc = models.Slice()
                msg = "Slice [{}] has been saved".format(slice_name)
            elif action == "overwrite":
                slc = (
                    session.query(models.Slice)
                    .filter_by(id=request.args.get("slice_id"))
                    .first()
                )
                msg = "Slice [{}] has been overwritten".format(slice_name)

            slc.params = json.dumps(d, indent=4, sort_keys=True)
            slc.datasource_name = request.args.get('datasource_name')
            slc.viz_type = request.args.get('viz_type')
            slc.druid_datasource_id = druid_datasource_id
            slc.table_id = table_id
            slc.datasource_type = datasource_type
            slc.slice_name = slice_name

            session.merge(slc)
            session.commit()
            flash(msg, "info")
            return redirect(slc.slice_url)


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
            status = 200
            if config.get("DEBUG"):
                payload = obj.get_json()
            else:
                try:
                    payload = obj.get_json()
                except Exception as e:
                    logging.exception(e)
                    payload = str(e)
                    status = 500
            return Response(
                payload,
                status=status,
                mimetype="application/json")
        else:
            if config.get("DEBUG"):
                resp = self.render_template("panoramix/viz.html", viz=obj)
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
        positions = data['positions']
        slice_ids = [int(d['slice_id']) for d in positions]
        session = db.session()
        Dash = models.Dashboard
        dash = session.query(Dash).filter_by(id=dashboard_id).first()
        dash.slices = [o for o in dash.slices if o.id in slice_ids]
        dash.position_json = json.dumps(data['positions'], indent=4)
        dash.css = data['css']
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
    @expose("/dashboard/<identifier>/")
    @utils.log_this
    def dashboard(self, identifier):
        session = db.session()
        qry = session.query(models.Dashboard)
        if identifier.isdigit():
            qry = qry.filter_by(id=int(identifier))
        else:
            qry = qry.filter_by(slug=identifier)

        dashboard = qry.first()
        pos_dict = {}
        if dashboard.position_json:
            pos_dict = {
                int(o['slice_id']):o
                for o in json.loads(dashboard.position_json)}
        return self.render_template(
            "panoramix/dashboard.html", dashboard=dashboard,
            pos_dict=pos_dict)

    @has_access
    @expose("/refresh_datasources/")
    def refresh_datasources(self):
        session = db.session()
        for cluster in session.query(models.Cluster).all():
            try:
                cluster.refresh_datasources()
            except Exception as e:
                flash(
                    "Error while processing cluster '{}'".format(cluster),
                    "alert")
                return redirect('/clustermodelview/list/')
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

    @app.errorhandler(500)
    def show_traceback(self):
        if config.get("SHOW_STACKTRACE"):
            error_msg = traceback.format_exc()
        else:
            error_msg = "FATAL ERROR\n"
            error_msg = (
                "Stacktrace is hidden. Change the SHOW_STACKTRACE "
                "configuration setting to enable it")
        return render_template(
            'panoramix/traceback.html',
            error_msg=error_msg,
            title=ascii_art.stacktrace,
            art=ascii_art.error), 500

appbuilder.add_view_no_menu(Panoramix)
appbuilder.add_link(
    "Refresh Druid Metadata",
    href='/panoramix/refresh_datasources/',
    category='Sources',
    category_icon='fa-database',
    icon="fa-cog")
