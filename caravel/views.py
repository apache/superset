"""Flask web views for Caravel"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import json
import logging
import re
import time
import traceback
from datetime import datetime

import pandas as pd
import sqlalchemy as sqla
from flask import (
    g, request, redirect, flash, Response, render_template, Markup)
from flask.ext.appbuilder import ModelView, CompactCRUDMixin, BaseView, expose
from flask.ext.appbuilder.actions import action
from flask.ext.appbuilder.models.sqla.interface import SQLAInterface
from flask.ext.appbuilder.security.decorators import has_access
from pydruid.client import doublesum
from sqlalchemy import create_engine
from sqlalchemy import select, text
from sqlalchemy.sql.expression import TextAsFrom
from werkzeug.routing import BaseConverter
from wtforms.validators import ValidationError

from caravel import appbuilder, db, models, viz, utils, app, sm, ascii_art

config = app.config
log_this = models.Log.log_this


def validate_json(form, field):  # noqa
    try:
        json.loads(field.data)
    except Exception as e:
        logging.exception(e)
        raise ValidationError("json isn't valid")


def generate_download_headers(extension):
    filename = datetime.now().strftime("%Y%m%d_%H%M%S")
    content_disp = "attachment; filename={}.{}".format(filename, extension)
    headers = {
        "Content-Disposition": content_disp,
    }
    return headers


class DeleteMixin(object):
    @action(
        "muldelete", "Delete", "Delete all Really?", "fa-trash", single=False)
    def muldelete(self, items):
        self.datamodel.delete_all(items)
        self.update_redirect()
        return redirect(self.get_redirect())


class CaravelModelView(ModelView):
    page_size = 500


class TableColumnInlineView(CompactCRUDMixin, CaravelModelView):  # noqa
    datamodel = SQLAInterface(models.TableColumn)
    can_delete = False
    edit_columns = [
        'column_name', 'description', 'groupby', 'filterable', 'table',
        'count_distinct', 'sum', 'min', 'max', 'expression', 'is_dttm']
    add_columns = edit_columns
    list_columns = [
        'column_name', 'type', 'groupby', 'filterable', 'count_distinct',
        'sum', 'min', 'max', 'is_dttm']
    page_size = 500
    description_columns = {
        'is_dttm': (
            "Whether to make this column available as a "
            "[Time Granularity] option, column has to be DATETIME or "
            "DATETIME-like"),
        'expression': utils.markdown(
            "a valid SQL expression as supported by the underlying backend. "
            "Example: `substr(name, 1, 1)`", True),
    }
appbuilder.add_view_no_menu(TableColumnInlineView)



class DruidColumnInlineView(CompactCRUDMixin, CaravelModelView):  # noqa
    datamodel = SQLAInterface(models.DruidColumn)
    edit_columns = [
        'column_name', 'description', 'datasource', 'groupby',
        'count_distinct', 'sum', 'min', 'max']
    list_columns = [
        'column_name', 'type', 'groupby', 'filterable', 'count_distinct',
        'sum', 'min', 'max']
    can_delete = False
    page_size = 500

    def post_update(self, col):
        col.generate_metrics()

appbuilder.add_view_no_menu(DruidColumnInlineView)


class SqlMetricInlineView(CompactCRUDMixin, CaravelModelView):  # noqa
    datamodel = SQLAInterface(models.SqlMetric)
    list_columns = ['metric_name', 'verbose_name', 'metric_type']
    edit_columns = [
        'metric_name', 'description', 'verbose_name', 'metric_type',
        'expression', 'table']
    description_columns = {
        'expression': utils.markdown(
            "a valid SQL expression as supported by the underlying backend. "
            "Example: `count(DISTINCT userid)`", True),
    }
    add_columns = edit_columns
    page_size = 500
appbuilder.add_view_no_menu(SqlMetricInlineView)


class DruidMetricInlineView(CompactCRUDMixin, CaravelModelView):  # noqa
    datamodel = SQLAInterface(models.DruidMetric)
    list_columns = ['metric_name', 'verbose_name', 'metric_type']
    edit_columns = [
        'metric_name', 'description', 'verbose_name', 'metric_type',
        'datasource', 'json']
    add_columns = [
        'metric_name', 'verbose_name', 'metric_type', 'datasource', 'json']
    page_size = 500
    validators_columns = {
        'json': [validate_json],
    }
appbuilder.add_view_no_menu(DruidMetricInlineView)


class DatabaseView(CaravelModelView, DeleteMixin):  # noqa
    datamodel = SQLAInterface(models.Database)
    list_columns = ['database_name', 'sql_link', 'created_by_', 'changed_on']
    order_columns = utils.list_minus(list_columns, ['created_by_'])
    add_columns = [
        'database_name', 'sqlalchemy_uri', 'cache_timeout', 'extra']
    show_columns = add_columns
    search_exclude_columns = ('password',)
    edit_columns = add_columns
    add_template = "caravel/models/database/add.html"
    edit_template = "caravel/models/database/edit.html"
    base_order = ('changed_on', 'desc')
    description_columns = {
        'sqlalchemy_uri': (
            "Refer to the SqlAlchemy docs for more information on how "
            "to structure your URI here: "
            "http://docs.sqlalchemy.org/en/rel_1_0/core/engines.html"),
        'extra': utils.markdown(
            "JSON string containing extra configuration elements. "
            "The ``engine_params`` object gets unpacked into the "
            "[sqlalchemy.create_engine]"
            "(http://docs.sqlalchemy.org/en/latest/core/engines.html#"
            "sqlalchemy.create_engine) call, while the ``metadata_params`` "
            "gets unpacked into the [sqlalchemy.MetaData]"
            "(http://docs.sqlalchemy.org/en/rel_1_0/core/metadata.html"
            "#sqlalchemy.schema.MetaData) call. ", True),
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


class TableModelView(CaravelModelView, DeleteMixin):  # noqa
    datamodel = SQLAInterface(models.SqlaTable)
    list_columns = [
        'table_link', 'database', 'sql_link', 'is_featured',
        'changed_by_', 'changed_on']
    add_columns = [
        'table_name', 'database', 'schema',
        'default_endpoint', 'offset', 'cache_timeout']
    edit_columns = [
        'table_name', 'is_featured', 'database', 'schema', 'description', 'owner',
        'main_dttm_col', 'default_endpoint', 'offset', 'cache_timeout']
    related_views = [TableColumnInlineView, SqlMetricInlineView]
    base_order = ('changed_on', 'desc')
    description_columns = {
        'offset': "Timezone offset (in hours) for this datasource",
        'schema': (
            "Schema, as used only in some databases like Postgres, Redshift "
            "and DB2"),
        'description': Markup(
            "Supports <a href='https://daringfireball.net/projects/markdown/'>"
            "markdown</a>"),
    }

    def post_add(self, table):
        try:
            table.fetch_metadata()
        except Exception as e:
            logging.exception(e)
            flash(
                "Table [{}] doesn't seem to exist, "
                "couldn't fetch metadata".format(table.table_name),
                "danger")
        utils.merge_perm(sm, 'datasource_access', table.perm)

    def post_update(self, table):
        self.post_add(table)

appbuilder.add_view(
    TableModelView,
    "Tables",
    category="Sources",
    icon='fa-table',)


appbuilder.add_separator("Sources")


class DruidClusterModelView(CaravelModelView, DeleteMixin):  # noqa
    datamodel = SQLAInterface(models.DruidCluster)
    add_columns = [
        'cluster_name',
        'coordinator_host', 'coordinator_port', 'coordinator_endpoint',
        'broker_host', 'broker_port', 'broker_endpoint',
    ]
    edit_columns = add_columns
    list_columns = ['cluster_name', 'metadata_last_refreshed']


if config['DRUID_IS_ACTIVE']:
    appbuilder.add_view(
        DruidClusterModelView,
        "Druid Clusters",
        icon="fa-cubes",
        category="Sources",
        category_icon='fa-database',)


class SliceModelView(CaravelModelView, DeleteMixin):  # noqa
    datamodel = SQLAInterface(models.Slice)
    add_template = "caravel/add_slice.html"
    can_add = False
    label_columns = {
        'created_by_': 'Creator',
        'datasource_link': 'Datasource',
    }
    list_columns = [
        'slice_link', 'viz_type',
        'datasource_link', 'created_by_', 'modified']
    order_columns = utils.list_minus(list_columns, ['created_by_', 'modified'])
    edit_columns = [
        'slice_name', 'description', 'viz_type', 'druid_datasource',
        'table', 'dashboards', 'params', 'cache_timeout']
    base_order = ('changed_on', 'desc')
    description_columns = {
        'description': Markup(
            "The content here can be displayed as widget headers in the "
            "dashboard view. Supports "
            "<a href='https://daringfireball.net/projects/markdown/'>"
            "markdown</a>"),
    }

appbuilder.add_view(
    SliceModelView,
    "Slices",
    icon="fa-bar-chart",
    category="",
    category_icon='',)


class SliceAsync(SliceModelView):  # noqa
    list_columns = [
        'slice_link', 'viz_type',
        'created_by_', 'modified', 'icons']
    label_columns = {
        'icons': ' ',
        'created_by_': 'Creator',
        'viz_type': 'Type',
        'slice_link': 'Slice',
    }

appbuilder.add_view_no_menu(SliceAsync)


class DashboardModelView(CaravelModelView, DeleteMixin):  # noqa
    datamodel = SQLAInterface(models.Dashboard)
    label_columns = {
        'created_by_': 'Creator',
    }
    list_columns = ['dashboard_link', 'created_by_', 'modified']
    order_columns = utils.list_minus(list_columns, ['created_by_', 'modified'])
    edit_columns = [
        'dashboard_title', 'slug', 'slices', 'position_json', 'css',
        'json_metadata']
    add_columns = edit_columns
    base_order = ('changed_on', 'desc')
    description_columns = {
        'position_json': (
            "This json object describes the positioning of the widgets in "
            "the dashboard. It is dynamically generated when adjusting "
            "the widgets size and positions by using drag & drop in "
            "the dashboard view"),
        'css': (
            "The css for individual dashboards can be altered here, or "
            "in the dashboard view where changes are immediately "
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


class DashboardModelViewAsync(DashboardModelView):  # noqa
    list_columns = ['dashboard_link', 'created_by_', 'modified']
    label_columns = {
        'created_by_': 'Creator',
        'dashboard_link': 'Dashboard',
    }

appbuilder.add_view_no_menu(DashboardModelViewAsync)


class LogModelView(CaravelModelView):
    datamodel = SQLAInterface(models.Log)
    list_columns = ('user', 'action', 'dttm')
    edit_columns = ('user', 'action', 'dttm', 'json')
    base_order = ('dttm', 'desc')

appbuilder.add_view(
    LogModelView,
    "Action Log",
    category="Security",
    icon="fa-list-ol")


class DruidDatasourceModelView(CaravelModelView, DeleteMixin):  # noqa
    datamodel = SQLAInterface(models.DruidDatasource)
    list_columns = [
        'datasource_link', 'cluster', 'owner',
        'created_by_', 'created_on',
        'changed_by_', 'changed_on',
        'offset']
    order_columns = utils.list_minus(
        list_columns, ['created_by_', 'changed_by_'])
    related_views = [DruidColumnInlineView, DruidMetricInlineView]
    edit_columns = [
        'datasource_name', 'cluster', 'description', 'owner',
        'is_featured', 'is_hidden', 'default_endpoint', 'offset',
        'cache_timeout']
    page_size = 500
    base_order = ('datasource_name', 'asc')
    description_columns = {
        'offset': "Timezone offset (in hours) for this datasource",
        'description': Markup(
            "Supports <a href='"
            "https://daringfireball.net/projects/markdown/'>markdown</a>"),
    }

    def post_add(self, datasource):
        datasource.generate_metrics()
        utils.merge_perm(sm, 'datasource_access', datasource.perm)

    def post_update(self, datasource):
        self.post_add(datasource)

if config['DRUID_IS_ACTIVE']:
    appbuilder.add_view(
        DruidDatasourceModelView,
        "Druid Datasources",
        category="Sources",
        icon="fa-cube")


@app.route('/health')
def health():
    return "OK"


@app.route('/ping')
def ping():
    return "OK"


class R(BaseView):

    """used for short urls"""

    @log_this
    @expose("/<url_id>")
    def index(self, url_id):
        url = db.session.query(models.Url).filter_by(id=url_id).first()
        if url:
            print(url.url)
            return redirect('/' + url.url)
        else:
            flash("URL to nowhere...", "danger")
            return redirect('/')

    @log_this
    @expose("/shortner/", methods=['POST', 'GET'])
    def shortner(self):
        url = request.form.get('data')
        obj = models.Url(url=url)
        db.session.add(obj)
        db.session.commit()
        return("{request.headers[Host]}/r/{obj.id}".format(
            request=request, obj=obj))

    @expose("/msg/")
    def msg(self):
        """Redirects to specified url while flash a message"""
        flash(request.args.get("msg"), "info")
        return redirect(request.args.get("url"))

appbuilder.add_view_no_menu(R)


class Caravel(BaseView):

    """The base views for Caravel!"""

    @has_access
    @expose("/explore/<datasource_type>/<datasource_id>/")
    @expose("/datasource/<datasource_type>/<datasource_id>/")  # Legacy url
    @log_this
    def explore(self, datasource_type, datasource_id):
        error_redirect = '/slicemodelview/list/'
        datasource_class = models.SqlaTable \
            if datasource_type == "table" else models.DruidDatasource
        datasources = (
            db.session
            .query(datasource_class)
            .all()
        )
        datasources = sorted(datasources, key=lambda ds: ds.full_name)
        datasource = [ds for ds in datasources if int(datasource_id) == ds.id]
        datasource = datasource[0] if datasource else None
        slice_id = request.args.get("slice_id")
        slc = None
        if slice_id:
            slc = (
                db.session.query(models.Slice)
                .filter_by(id=slice_id)
                .first()
            )
        if not datasource:
            flash("The datasource seems to have been deleted", "alert")
            return redirect(error_redirect)

        all_datasource_access = self.appbuilder.sm.has_access(
            'all_datasource_access', 'all_datasource_access')
        datasource_access = self.appbuilder.sm.has_access(
            'datasource_access', datasource.perm)
        if not (all_datasource_access or datasource_access):
            flash("You don't seem to have access to this datasource", "danger")
            return redirect(error_redirect)

        action = request.args.get('action')
        if action in ('save', 'overwrite'):
            return self.save(request.args, slc)

        viz_type = request.args.get("viz_type")
        if not viz_type and datasource.default_endpoint:
            return redirect(datasource.default_endpoint)
        if not viz_type:
            viz_type = "table"
        try:
            obj = viz.viz_types[viz_type](
                datasource,
                form_data=request.args,
                slice_=slc)
        except Exception as e:
            flash(str(e), "danger")
            return redirect(error_redirect)
        if request.args.get("json") == "true":
            status = 200
            try:
                payload = obj.get_json()
            except Exception as e:
                logging.exception(e)
                if config.get("DEBUG"):
                    raise e
                payload = str(e)
                status = 500
            resp = Response(
                payload,
                status=status,
                headers=generate_download_headers("json"),
                mimetype="application/json")
            return resp
        elif request.args.get("csv") == "true":
            status = 200
            payload = obj.get_csv()
            return Response(
                payload,
                status=status,
                headers=generate_download_headers("csv"),
                mimetype="application/csv")
        else:
            if request.args.get("standalone") == "true":
                template = "caravel/standalone.html"
            else:
                template = "caravel/explore.html"

            resp = self.render_template(
                template, viz=obj, slice=slc, datasources=datasources)
            try:
                pass
            except Exception as e:
                if config.get("DEBUG"):
                    raise(e)
                return Response(
                    str(e),
                    status=500,
                    mimetype="application/json")
            return resp

    def save(self, args, slc):
        """Saves (inserts or overwrite a slice) """
        session = db.session()
        slice_name = args.get('slice_name')
        action = args.get('action')

        # TODO use form processing form wtforms
        d = args.to_dict(flat=False)
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
        datasource_type = args.get('datasource_type')
        if datasource_type in ('datasource', 'druid'):
            druid_datasource_id = args.get('datasource_id')
        elif datasource_type == 'table':
            table_id = args.get('datasource_id')

        if action == "save":
            slc = models.Slice()
            msg = "Slice [{}] has been saved".format(slice_name)
        elif action == "overwrite":
            msg = "Slice [{}] has been overwritten".format(slice_name)

        slc.params = json.dumps(d, indent=4, sort_keys=True)
        slc.datasource_name = args.get('datasource_name')
        slc.viz_type = args.get('viz_type')
        slc.druid_datasource_id = druid_datasource_id
        slc.table_id = table_id
        slc.datasource_type = datasource_type
        slc.slice_name = slice_name

        if action == "save":
            session.add(slc)
        elif action == "overwrite":
            session.merge(slc)
        session.commit()
        flash(msg, "info")
        return redirect(slc.slice_url)

    @has_access
    @expose("/checkbox/<model_view>/<id_>/<attr>/<value>", methods=['GET'])
    def checkbox(self, model_view, id_, attr, value):
        """endpoint for checking/unchecking any boolean in a sqla model"""
        model = None
        if model_view == 'TableColumnInlineView':
            model = models.TableColumn
        elif model_view == 'DruidColumnInlineView':
            model = models.DruidColumn

        obj = db.session.query(model).filter_by(id=id_).first()
        if obj:
            setattr(obj, attr, value == 'true')
            db.session.commit()
        return Response("OK", mimetype="application/json")

    @has_access
    @expose("/activity_per_day")
    def activity_per_day(self):
        """endpoint to power the calendar heatmap on the welcome page"""
        Log = models.Log  # noqa
        qry = (
            db.session
            .query(
                Log.dt,
                sqla.func.count())
            .group_by(Log.dt)
            .all()
        )
        payload = {str(time.mktime(dt.timetuple())): ccount for dt, ccount in qry if dt}
        return Response(json.dumps(payload), mimetype="application/json")

    @has_access
    @expose("/save_dash/<dashboard_id>/", methods=['GET', 'POST'])
    def save_dash(self, dashboard_id):
        """Save a dashboard's metadata"""
        data = json.loads(request.form.get('data'))
        positions = data['positions']
        slice_ids = [int(d['slice_id']) for d in positions]
        session = db.session()
        Dash = models.Dashboard  # noqa
        dash = session.query(Dash).filter_by(id=dashboard_id).first()
        dash.slices = [o for o in dash.slices if o.id in slice_ids]
        dash.position_json = json.dumps(data['positions'], indent=4)
        md = dash.metadata_dejson
        if 'filter_immune_slices' not in md:
            md['filter_immune_slices'] = []
        md['expanded_slices'] = data['expanded_slices']
        dash.json_metadata = json.dumps(md, indent=4)
        dash.css = data['css']
        session.merge(dash)
        session.commit()
        session.close()
        return "SUCCESS"

    @has_access
    @expose("/testconn", methods=["POST", "GET"])
    def testconn(self):
        """Tests a sqla connection"""
        try:
            uri = request.json.get('uri')
            connect_args = request.json.get('extras', {}).get('engine_params', {}).get('connect_args', {})
            engine = create_engine(uri, connect_args=connect_args)
            engine.connect()
            return json.dumps(engine.table_names(), indent=4)
        except Exception:
            return Response(
                traceback.format_exc(),
                status=500,
                mimetype="application/json")

    @expose("/favstar/<class_name>/<obj_id>/<action>/")
    def favstar(self, class_name, obj_id, action):
        session = db.session()
        FavStar = models.FavStar  # noqa
        count = 0
        favs = session.query(FavStar).filter_by(
            class_name=class_name, obj_id=obj_id, user_id=g.user.id).all()
        if action == 'select':
            if not favs:
                session.add(
                    FavStar(
                        class_name=class_name, obj_id=obj_id, user_id=g.user.id,
                        dttm=datetime.now()))
            count = 1
        elif action == 'unselect':
            for fav in favs:
                session.delete(fav)
        else:
            count = len(favs)
        session.commit()
        return Response(
            json.dumps({'count': count}),
            mimetype="application/json")

    @has_access
    @expose("/dashboard/<dashboard_id>/")
    def dashboard(self, dashboard_id):
        """Server side rendering for a dashboard"""
        session = db.session()
        qry = session.query(models.Dashboard)
        if dashboard_id.isdigit():
            qry = qry.filter_by(id=int(dashboard_id))
        else:
            qry = qry.filter_by(slug=dashboard_id)

        templates = session.query(models.CssTemplate).all()
        dash = qry.first()

        # Hack to log the dashboard_id properly, even when getting a slug
        @log_this
        def dashboard(**kwargs):  # noqa
            pass
        dashboard(dashboard_id=dash.id)

        pos_dict = {}
        if dash.position_json:
            pos_dict = {
                int(o['slice_id']): o
                for o in json.loads(dash.position_json)}
        return self.render_template(
            "caravel/dashboard.html", dashboard=dash,
            templates=templates,
            pos_dict=pos_dict)

    @has_access
    @expose("/sql/<database_id>/")
    @log_this
    def sql(self, database_id):
        if (
                not self.appbuilder.sm.has_access(
                    'all_datasource_access', 'all_datasource_access')):
            flash(
                "This view requires the `all_datasource_access` "
                "permission", "danger")
            return redirect("/tablemodelview/list/")
        mydb = db.session.query(
            models.Database).filter_by(id=database_id).first()
        engine = mydb.get_sqla_engine()
        tables = engine.table_names()

        table_name = request.args.get('table_name')
        return self.render_template(
            "caravel/sql.html",
            tables=tables,
            table_name=table_name,
            db=mydb)

    @has_access
    @expose("/table/<database_id>/<table_name>/")
    @log_this
    def table(self, database_id, table_name):
        mydb = db.session.query(
            models.Database).filter_by(id=database_id).first()
        cols = mydb.get_columns(table_name)
        df = pd.DataFrame([(c['name'], c['type']) for c in cols])
        df.columns = ['col', 'type']
        tbl_cls = (
            "dataframe table table-striped table-bordered "
            "table-condensed sql_results").split(' ')
        return self.render_template(
            "caravel/ajah.html",
            content=df.to_html(
                index=False,
                na_rep='',
                classes=tbl_cls))

    @has_access
    @expose("/select_star/<database_id>/<table_name>/")
    @log_this
    def select_star(self, database_id, table_name):
        mydb = db.session.query(
            models.Database).filter_by(id=database_id).first()
        t = mydb.get_table(table_name)
        fields = ", ".join(
            [c.name for c in t.columns] or "*")
        s = "SELECT\n{}\nFROM {}".format(fields, table_name)
        return self.render_template(
            "caravel/ajah.html",
            content=s
        )

    @has_access
    @expose("/runsql/", methods=['POST', 'GET'])
    @log_this
    def runsql(self):
        """Runs arbitrary sql and returns and html table"""
        session = db.session()
        limit = 1000
        data = json.loads(request.form.get('data'))
        sql = data.get('sql')
        database_id = data.get('database_id')
        mydb = session.query(models.Database).filter_by(id=database_id).first()

        if (
                not self.appbuilder.sm.has_access(
                    'all_datasource_access', 'all_datasource_access')):
            raise Exception(
                "This view requires the `all_datasource_access` permission")
        content = ""
        if mydb:
            eng = mydb.get_sqla_engine()
            if limit:
                sql = sql.strip().strip(';')
                qry = (
                    select('*')
                    .select_from(TextAsFrom(text(sql), ['*']).alias('inner_qry'))
                    .limit(limit)
                )
                sql = str(qry.compile(eng, compile_kwargs={"literal_binds": True}))
            try:
                df = pd.read_sql_query(sql=sql, con=eng)
                content = df.to_html(
                    index=False,
                    na_rep='',
                    classes=(
                        "dataframe table table-striped table-bordered "
                        "table-condensed sql_results").split(' '))
            except Exception as e:
                content = (
                    '<div class="alert alert-danger">'
                    "{}</div>"
                ).format(e.message)
        session.commit()
        return content

    @has_access
    @expose("/refresh_datasources/")
    def refresh_datasources(self):
        """endpoint that refreshes druid datasources metadata"""
        session = db.session()
        for cluster in session.query(models.DruidCluster).all():
            try:
                cluster.refresh_datasources()
            except Exception as e:
                flash(
                    "Error while processing cluster '{}'\n{}".format(
                        cluster, str(e)),
                    "danger")
                logging.exception(e)
                return redirect('/druidclustermodelview/list/')
            cluster.metadata_last_refreshed = datetime.now()
            flash(
                "Refreshed metadata from cluster "
                "[" + cluster.cluster_name + "]",
                'info')
        session.commit()
        return redirect("/druiddatasourcemodelview/list/")

    @expose("/autocomplete/<datasource>/<column>/")
    def autocomplete(self, datasource, column):
        """used for filter autocomplete"""
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
            'caravel/traceback.html',
            error_msg=error_msg,
            title=ascii_art.stacktrace,
            art=ascii_art.error), 500

    @has_access
    @expose("/welcome")
    def welcome(self):
        """Personalized welcome page"""
        return self.render_template('caravel/welcome.html', utils=utils)


appbuilder.add_view_no_menu(Caravel)

if config['DRUID_IS_ACTIVE']:
    appbuilder.add_link(
        "Refresh Druid Metadata",
        href='/caravel/refresh_datasources/',
        category='Sources',
        category_icon='fa-database',
        icon="fa-cog")


class CssTemplateModelView(CaravelModelView, DeleteMixin):
    datamodel = SQLAInterface(models.CssTemplate)
    list_columns = ['template_name']
    edit_columns = ['template_name', 'css']
    add_columns = edit_columns

appbuilder.add_separator("Sources")
appbuilder.add_view(
    CssTemplateModelView,
    "CSS Templates",
    icon="fa-css3",
    category="Sources",
    category_icon='')


# ---------------------------------------------------------------------
# Redirecting URL from previous names
class RegexConverter(BaseConverter):
    def __init__(self, url_map, *items):
        super(RegexConverter, self).__init__(url_map)
        self.regex = items[0]
app.url_map.converters['regex'] = RegexConverter


@app.route('/<regex("panoramix\/.*"):url>')
def panoramix(url):  # noqa
    return redirect(request.full_path.replace('panoramix', 'caravel'))


@app.route('/<regex("dashed\/.*"):url>')
def dashed(url):  # noqa
    return redirect(request.full_path.replace('dashed', 'caravel'))
# ---------------------------------------------------------------------
