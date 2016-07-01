"""Flask web views for Caravel"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import json
import logging
import re
import sys
import time
import traceback
from datetime import datetime

import functools
import pandas as pd
import sqlalchemy as sqla

from flask import (
    g, request, redirect, flash, Response, render_template, Markup)
from flask_appbuilder import ModelView, CompactCRUDMixin, BaseView, expose
from flask_appbuilder.actions import action
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import has_access, has_access_api
from flask_babel import gettext as __
from flask_babel import lazy_gettext as _
from flask_appbuilder.models.sqla.filters import BaseFilter

from sqlalchemy import create_engine, select, text
from sqlalchemy.sql.expression import TextAsFrom
from werkzeug.routing import BaseConverter
from wtforms.validators import ValidationError

import caravel
from caravel import appbuilder, db, models, viz, utils, app, sm, ascii_art

config = app.config
log_this = models.Log.log_this
can_access = utils.can_access


class BaseCaravelView(BaseView):
    def can_access(self, permission_name, view_name):
        return utils.can_access(appbuilder.sm, permission_name, view_name)


def get_error_msg():
    if config.get("SHOW_STACKTRACE"):
        error_msg = traceback.format_exc()
    else:
        error_msg = "FATAL ERROR \n"
        error_msg += (
            "Stacktrace is hidden. Change the SHOW_STACKTRACE "
            "configuration setting to enable it")
    return error_msg


def api(f):
    """
    A decorator to label an endpoint as an API. Catches uncaught exceptions and
    return the response in the JSON format
    """
    def wraps(self, *args, **kwargs):
        try:
            return f(self, *args, **kwargs)
        except Exception as e:
            logging.exception(e)
            resp = Response(
                json.dumps({
                    'message': get_error_msg()
                }),
                status=500,
                mimetype="application/json")
            return resp

    return functools.update_wrapper(wraps, f)


def check_ownership(obj, raise_if_false=True):
    """Meant to be used in `pre_update` hooks on models to enforce ownership

    Admin have all access, and other users need to be referenced on either
    the created_by field that comes with the ``AuditMixin``, or in a field
    named ``owners`` which is expected to be a one-to-many with the User
    model. It is meant to be used in the ModelView's pre_update hook in
    which raising will abort the update.
    """
    if not obj:
        return False
    roles = (r.name for r in get_user_roles())
    if 'Admin' in roles:
        return True
    session = db.create_scoped_session()
    orig_obj = session.query(obj.__class__).filter_by(id=obj.id).first()
    owner_names = (user.username for user in orig_obj.owners)
    if (
            hasattr(orig_obj, 'created_by') and
            orig_obj.created_by and
            orig_obj.created_by.username == g.user.username):
        return True
    if (
            hasattr(orig_obj, 'owners') and
            g.user and
            hasattr(g.user, 'username') and
            g.user.username in owner_names):
        return True
    if raise_if_false:
        raise utils.CaravelSecurityException(
            "You don't have the rights to alter [{}]".format(obj))
    else:
        return False


def get_user_roles():
    if g.user.is_anonymous():
        return [appbuilder.sm.find_role('Public')]
    return g.user.roles


class CaravelFilter(BaseFilter):
    def get_perms(self):
        perms = []
        for role in get_user_roles():
            for perm_view in role.permissions:
                if perm_view.permission.name == 'datasource_access':
                    perms.append(perm_view.view_menu.name)
        return perms


class FilterSlice(CaravelFilter):
    def apply(self, query, func):  # noqa
        if any([r.name in ('Admin', 'Alpha') for r in get_user_roles()]):
            return query
        qry = query.filter(self.model.perm.in_(self.get_perms()))
        return qry


class FilterDashboard(CaravelFilter):
    def apply(self, query, func):  # noqa
        if any([r.name in ('Admin', 'Alpha') for r in get_user_roles()]):
            return query
        Slice = models.Slice  # noqa
        Dash = models.Dashboard  # noqa
        slice_ids_qry = (
            db.session
            .query(Slice.id)
            .filter(Slice.perm.in_(self.get_perms()))
        )
        query = query.filter(
            Dash.id.in_(
                db.session.query(Dash.id)
                .distinct()
                .join(Dash.slices)
                .filter(Slice.id.in_(slice_ids_qry))
            )
        )
        return query


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
        'column_name', 'verbose_name', 'description', 'groupby', 'filterable',
        'table', 'count_distinct', 'sum', 'min', 'max', 'expression',
        'is_dttm', 'python_date_format', 'database_expression']
    add_columns = edit_columns
    list_columns = [
        'column_name', 'type', 'groupby', 'filterable', 'count_distinct',
        'sum', 'min', 'max', 'is_dttm']
    page_size = 500
    description_columns = {
        'is_dttm': (_(
            "Whether to make this column available as a "
            "[Time Granularity] option, column has to be DATETIME or "
            "DATETIME-like")),
        'expression': utils.markdown(
            "a valid SQL expression as supported by the underlying backend. "
            "Example: `substr(name, 1, 1)`", True),
        'python_date_format': utils.markdown(Markup(
            "The pattern of timestamp format, use "
            "<a href='https://docs.python.org/2/library/"
            "datetime.html#strftime-strptime-behavior'>"
            "python datetime string pattern</a> "
            "expression. If time is stored in epoch "
            "format, put `epoch_s` or `epoch_ms`. Leave `Database Expression` "
            "below empty if timestamp is stored in "
            "String or Integer(epoch) type"), True),
        'database_expression': utils.markdown(
            "The database expression to cast internal datetime "
            "constants to database date/timestamp type according to the DBAPI. "
            "The expression should follow the pattern of "
            "%Y-%m-%d %H:%M:%S, based on different DBAPI. "
            "The string should be a python string formatter \n"
            "`Ex: TO_DATE('{}', 'YYYY-MM-DD HH24:MI:SS')` for Oracle"
            "Caravel uses default expression based on DB URI if this "
            "field is blank.", True),
    }
    label_columns = {
        'column_name': _("Column"),
        'verbose_name': _("Verbose Name"),
        'description': _("Description"),
        'groupby': _("Groupable"),
        'filterable': _("Filterable"),
        'table': _("Table"),
        'count_distinct': _("Count Distinct"),
        'sum': _("Sum"),
        'min': _("Min"),
        'max': _("Max"),
        'expression': _("Expression"),
        'is_dttm': _("Is temporal"),
        'python_date_format': _("Datetime Format"),
        'database_expression': _("Database Expression")
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
    label_columns = {
        'column_name': _("Column"),
        'type': _("Type"),
        'datasource': _("Datasource"),
        'groupby': _("Groupable"),
        'filterable': _("Filterable"),
        'count_distinct': _("Count Distinct"),
        'sum': _("Sum"),
        'min': _("Min"),
        'max': _("Max"),
    }

    def post_update(self, col):
        col.generate_metrics()

appbuilder.add_view_no_menu(DruidColumnInlineView)


class SqlMetricInlineView(CompactCRUDMixin, CaravelModelView):  # noqa
    datamodel = SQLAInterface(models.SqlMetric)
    list_columns = ['metric_name', 'verbose_name', 'metric_type']
    edit_columns = [
        'metric_name', 'description', 'verbose_name', 'metric_type',
        'expression', 'table', 'is_restricted']
    description_columns = {
        'expression': utils.markdown(
            "a valid SQL expression as supported by the underlying backend. "
            "Example: `count(DISTINCT userid)`", True),
        'is_restricted': _("Whether the access to this metric is restricted "
                           "to certain roles. Only roles with the permission "
                           "'metric access on XXX (the name of this metric)' "
                           "are allowed to access this metric"),
    }
    add_columns = edit_columns
    page_size = 500
    label_columns = {
        'metric_name': _("Metric"),
        'description': _("Description"),
        'verbose_name': _("Verbose Name"),
        'metric_type': _("Type"),
        'expression': _("SQL Expression"),
        'table': _("Table"),
    }

    def post_add(self, metric):
        utils.init_metrics_perm(caravel, [metric])

    def post_update(self, metric):
        utils.init_metrics_perm(caravel, [metric])

appbuilder.add_view_no_menu(SqlMetricInlineView)


class DruidMetricInlineView(CompactCRUDMixin, CaravelModelView):  # noqa
    datamodel = SQLAInterface(models.DruidMetric)
    list_columns = ['metric_name', 'verbose_name', 'metric_type']
    edit_columns = [
        'metric_name', 'description', 'verbose_name', 'metric_type', 'json',
        'datasource', 'is_restricted']
    add_columns = edit_columns
    page_size = 500
    validators_columns = {
        'json': [validate_json],
    }
    description_columns = {
        'metric_type': utils.markdown(
            "use `postagg` as the metric type if you are defining a "
            "[Druid Post Aggregation]"
            "(http://druid.io/docs/latest/querying/post-aggregations.html)",
            True),
        'is_restricted': _("Whether the access to this metric is restricted "
                           "to certain roles. Only roles with the permission "
                           "'metric access on XXX (the name of this metric)' "
                           "are allowed to access this metric"),
    }
    label_columns = {
        'metric_name': _("Metric"),
        'description': _("Description"),
        'verbose_name': _("Verbose Name"),
        'metric_type': _("Type"),
        'json': _("JSON"),
        'datasource': _("Druid Datasource"),
    }

    def post_add(self, metric):
        utils.init_metrics_perm(caravel, [metric])

    def post_update(self, metric):
        utils.init_metrics_perm(caravel, [metric])


appbuilder.add_view_no_menu(DruidMetricInlineView)


class DatabaseView(CaravelModelView, DeleteMixin):  # noqa
    datamodel = SQLAInterface(models.Database)
    list_columns = ['database_name', 'sql_link', 'creator', 'changed_on_']
    add_columns = [
        'database_name', 'sqlalchemy_uri', 'cache_timeout', 'extra']
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
    label_columns = {
        'database_name': _("Database"),
        'sql_link': _("SQL link"),
        'creator': _("Creator"),
        'changed_on_': _("Last Changed"),
        'sqlalchemy_uri': _("SQLAlchemy URI"),
        'cache_timeout': _("Cache Timeout"),
        'extra': _("Extra"),
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
    label=__("Databases"),
    icon="fa-database",
    category="Sources",
    category_label=__("Sources"),
    category_icon='fa-database',)


class TableModelView(CaravelModelView, DeleteMixin):  # noqa
    datamodel = SQLAInterface(models.SqlaTable)
    list_columns = [
        'table_link', 'database', 'sql_link', 'is_featured',
        'changed_by_', 'changed_on_']
    order_columns = [
        'table_link', 'database', 'sql_link', 'is_featured', 'changed_on_']
    add_columns = [
        'table_name', 'database', 'schema',
        'default_endpoint', 'offset', 'cache_timeout']
    edit_columns = [
        'table_name', 'is_featured', 'database', 'schema',
        'description', 'owner',
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
    label_columns = {
        'table_link': _("Table"),
        'changed_by_': _("Changed By"),
        'database': _("Database"),
        'changed_on_': _("Last Changed"),
        'sql_link': _("SQL Editor"),
        'is_featured': _("Is Featured"),
        'schema': _("Schema"),
        'default_endpoint': _("Default Endpoint"),
        'offset': _("Offset"),
        'cache_timeout': _("Cache Timeout"),
    }

    def post_add(self, table):
        table_name = table.table_name
        try:
            table.fetch_metadata()
        except Exception as e:
            logging.exception(e)
            flash(
                "Table [{}] doesn't seem to exist, "
                "couldn't fetch metadata".format(table_name),
                "danger")
        utils.merge_perm(sm, 'datasource_access', table.perm)

    def post_update(self, table):
        self.post_add(table)

appbuilder.add_view(
    TableModelView,
    "Tables",
    label=__("Tables"),
    category="Sources",
    category_label=__("Sources"),
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
    label_columns = {
        'cluster_name': _("Cluster"),
        'coordinator_host': _("Coordinator Host"),
        'coordinator_port': _("Coordinator Port"),
        'coordinator_endpoint': _("Coordinator Endpoint"),
        'broker_host': _("Broker Host"),
        'broker_port': _("Broker Port"),
        'broker_endpoint': _("Broker Endpoint"),
    }


if config['DRUID_IS_ACTIVE']:
    appbuilder.add_view(
        DruidClusterModelView,
        name="Druid Clusters",
        label=__("Druid Clusters"),
        icon="fa-cubes",
        category="Sources",
        category_label=__("Sources"),
        category_icon='fa-database',)


class SliceModelView(CaravelModelView, DeleteMixin):  # noqa
    datamodel = SQLAInterface(models.Slice)
    add_template = "caravel/add_slice.html"
    can_add = False
    label_columns = {
        'datasource_link': 'Datasource',
    }
    list_columns = [
        'slice_link', 'viz_type', 'datasource_link', 'creator', 'modified']
    edit_columns = [
        'slice_name', 'description', 'viz_type', 'druid_datasource',
        'table', 'owners', 'dashboards', 'params', 'cache_timeout']
    base_order = ('changed_on', 'desc')
    description_columns = {
        'description': Markup(
            "The content here can be displayed as widget headers in the "
            "dashboard view. Supports "
            "<a href='https://daringfireball.net/projects/markdown/'>"
            "markdown</a>"),
        'params': _(
            "These parameters are generated dynamically when clicking "
            "the save or overwrite button in the explore view. This JSON "
            "object is exposed here for reference and for power users who may "
            "want to alter specific parameters."),
        'cache_timeout': _(
            "Duration (in seconds) of the caching timeout for this slice."
        ),
    }
    base_filters = [['id', FilterSlice, lambda: []]]
    label_columns = {
        'cache_timeout': _("Cache Timeout"),
        'creator': _("Creator"),
        'dashboards': _("Dashboards"),
        'datasource_link': _("Datasource"),
        'description': _("Description"),
        'modified': _("Last Modified"),
        'owners': _("Owners"),
        'params': _("Parameters"),
        'slice_link': _("Slice"),
        'slice_name': _("Name"),
        'table': _("Table"),
        'viz_type': _("Visualization Type"),
    }

    def pre_update(self, obj):
        check_ownership(obj)

    def pre_delete(self, obj):
        check_ownership(obj)

appbuilder.add_view(
    SliceModelView,
    "Slices",
    label=__("Slices"),
    icon="fa-bar-chart",
    category="",
    category_icon='',)


class SliceAsync(SliceModelView):  # noqa
    list_columns = [
        'slice_link', 'viz_type',
        'creator', 'modified', 'icons']
    label_columns = {
        'icons': ' ',
        'viz_type': _('Type'),
        'slice_link': _('Slice'),
        'viz_type': _('Visualization Type'),
    }

appbuilder.add_view_no_menu(SliceAsync)


class DashboardModelView(CaravelModelView, DeleteMixin):  # noqa
    datamodel = SQLAInterface(models.Dashboard)
    list_columns = ['dashboard_link', 'creator', 'modified']
    edit_columns = [
        'dashboard_title', 'slug', 'slices', 'owners', 'position_json', 'css',
        'json_metadata']
    show_columns = edit_columns + ['table_names']
    add_columns = edit_columns
    base_order = ('changed_on', 'desc')
    description_columns = {
        'position_json': _(
            "This json object describes the positioning of the widgets in "
            "the dashboard. It is dynamically generated when adjusting "
            "the widgets size and positions by using drag & drop in "
            "the dashboard view"),
        'css': _(
            "The css for individual dashboards can be altered here, or "
            "in the dashboard view where changes are immediately "
            "visible"),
        'slug': _("To get a readable URL for your dashboard"),
        'json_metadata': _(
            "This JSON object is generated dynamically when clicking "
            "the save or overwrite button in the dashboard view. It "
            "is exposed here for reference and for power users who may "
            "want to alter specific parameters."),
        'owners': _("Owners is a list of users who can alter the dashboard."),
    }
    base_filters = [['slice', FilterDashboard, lambda: []]]
    label_columns = {
        'dashboard_link': _("Dashboard"),
        'dashboard_title': _("Title"),
        'slug': _("Slug"),
        'slices': _("Slices"),
        'owners': _("Owners"),
        'creator': _("Creator"),
        'modified': _("Modified"),
        'position_json': _("Position JSON"),
        'css': _("CSS"),
        'json_metadata': _("JSON Metadata"),
        'table_names': _("Underlying Tables"),
    }

    def pre_add(self, obj):
        obj.slug = obj.slug.strip() or None
        if obj.slug:
            obj.slug = obj.slug.replace(" ", "-")
            obj.slug = re.sub(r'\W+', '', obj.slug)

    def pre_update(self, obj):
        check_ownership(obj)
        self.pre_add(obj)

    def pre_delete(self, obj):
        check_ownership(obj)


appbuilder.add_view(
    DashboardModelView,
    "Dashboards",
    label=__("Dashboards"),
    icon="fa-dashboard",
    category="",
    category_icon='',)


class DashboardModelViewAsync(DashboardModelView):  # noqa
    list_columns = ['dashboard_link', 'creator', 'modified', 'dashboard_title']
    label_columns = {
        'dashboard_link': 'Dashboard',
    }

appbuilder.add_view_no_menu(DashboardModelViewAsync)


class LogModelView(CaravelModelView):
    datamodel = SQLAInterface(models.Log)
    list_columns = ('user', 'action', 'dttm')
    edit_columns = ('user', 'action', 'dttm', 'json')
    base_order = ('dttm', 'desc')
    label_columns = {
        'user': _("User"),
        'action': _("Action"),
        'dttm': _("dttm"),
        'json': _("JSON"),
    }

appbuilder.add_view(
    LogModelView,
    "Action Log",
    label=__("Action Log"),
    category="Security",
    category_label=__("Security"),
    icon="fa-list-ol")


class DruidDatasourceModelView(CaravelModelView, DeleteMixin):  # noqa
    datamodel = SQLAInterface(models.DruidDatasource)
    list_columns = [
        'datasource_link', 'cluster', 'changed_by_', 'changed_on_', 'offset']
    order_columns = [
        'datasource_link', 'changed_on_', 'offset']
    related_views = [DruidColumnInlineView, DruidMetricInlineView]
    edit_columns = [
        'datasource_name', 'cluster', 'description', 'owner',
        'is_featured', 'is_hidden', 'default_endpoint', 'offset',
        'cache_timeout']
    add_columns = edit_columns
    page_size = 500
    base_order = ('datasource_name', 'asc')
    description_columns = {
        'offset': _("Timezone offset (in hours) for this datasource"),
        'description': Markup(
            "Supports <a href='"
            "https://daringfireball.net/projects/markdown/'>markdown</a>"),
    }
    label_columns = {
        'datasource_link': _("Data Source"),
        'cluster': _("Cluster"),
        'description': _("Description"),
        'owner': _("Owner"),
        'is_featured': _("Is Featured"),
        'is_hidden': _("Is Hidden"),
        'default_endpoint': _("Default Endpoint"),
        'offset': _("Time Offset"),
        'cache_timeout': _("Cache Timeout"),
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
        label=__("Druid Datasources"),
        category="Sources",
        category_label=__("Sources"),
        icon="fa-cube")


@app.route('/health')
def health():
    return "OK"


@app.route('/ping')
def ping():
    return "OK"


class R(BaseCaravelView):

    """used for short urls"""

    @log_this
    @expose("/<url_id>")
    def index(self, url_id):
        url = db.session.query(models.Url).filter_by(id=url_id).first()
        if url:
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
        flash(Markup(request.args.get("msg")), "info")
        return redirect(request.args.get("url"))

appbuilder.add_view_no_menu(R)


class Caravel(BaseCaravelView):

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
            flash(__("The datasource seems to have been deleted"), "alert")
            return redirect(error_redirect)

        slice_add_perm = self.can_access('can_add', 'SliceModelView')
        slice_edit_perm = check_ownership(slc, raise_if_false=False)
        slice_download_perm = self.can_access('can_download', 'SliceModelView')

        all_datasource_access = self.can_access(
            'all_datasource_access', 'all_datasource_access')
        datasource_access = self.can_access(
            'datasource_access', datasource.perm)
        if not (all_datasource_access or datasource_access):
            flash(__("You don't seem to have access to this datasource"), "danger")
            return redirect(error_redirect)

        action = request.args.get('action')
        if action in ('saveas', 'overwrite'):
            return self.save_or_overwrite_slice(
                request.args, slc, slice_add_perm, slice_edit_perm)

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
            if config.get("DEBUG"):
                # Allows for nice debugger stack traces in debug mode
                payload = obj.get_json()
            else:
                try:
                    payload = obj.get_json()
                except Exception as e:
                    logging.exception(e)
                    payload = str(e)
                    status = 500
            resp = Response(
                payload,
                status=status,
                mimetype="application/json")
            return resp
        elif request.args.get("csv") == "true":
            payload = obj.get_csv()
            return Response(
                payload,
                status=200,
                headers=generate_download_headers("csv"),
                mimetype="application/csv")
        else:
            if request.args.get("standalone") == "true":
                template = "caravel/standalone.html"
            else:
                template = "caravel/explore.html"
            resp = self.render_template(
                template, viz=obj, slice=slc, datasources=datasources,
                can_add=slice_add_perm, can_edit=slice_edit_perm,
                can_download=slice_download_perm,
                userid=g.user.get_id() if g.user else '')
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

    def save_or_overwrite_slice(
            self, args, slc, slice_add_perm, slice_edit_perm):
        """Save or overwrite a slice"""
        slice_name = args.get('slice_name')
        action = args.get('action')

        # TODO use form processing form wtforms
        d = args.to_dict(flat=False)
        del d['action']
        del d['previous_viz_type']

        as_list = ('metrics', 'groupby', 'columns', 'all_columns', 'mapbox_label')
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

        if action in ('saveas'):
            slc = models.Slice(owners=[g.user] if g.user else [])

        slc.params = json.dumps(d, indent=4, sort_keys=True)
        slc.datasource_name = args.get('datasource_name')
        slc.viz_type = args.get('viz_type')
        slc.druid_datasource_id = druid_datasource_id
        slc.table_id = table_id
        slc.datasource_type = datasource_type
        slc.slice_name = slice_name

        if action in ('saveas') and slice_add_perm:
            self.save_slice(slc)
        elif action == 'overwrite' and slice_edit_perm:
            self.overwrite_slice(slc)

        # Adding slice to a dashboard if requested
        dash = None
        if request.args.get('add_to_dash') == 'existing':
            dash = (
                db.session.query(models.Dashboard)
                .filter_by(id=int(request.args.get('save_to_dashboard_id')))
                .one()
            )
            flash(
                "Slice [{}] was added to dashboard [{}]".format(
                    slc.slice_name,
                    dash.dashboard_title),
                "info")
        elif request.args.get('add_to_dash') == 'new':
            dash = models.Dashboard(
                dashboard_title=request.args.get('new_dashboard_name'),
                owners=[g.user] if g.user else [])
            flash(
                "Dashboard [{}] just got created and slice [{}] was added "
                "to it".format(
                    dash.dashboard_title,
                    slc.slice_name),
                "info")

        if dash and slc not in dash.slices:
            dash.slices.append(slc)
            db.session.commit()

        if request.args.get('goto_dash') == 'true':
            return redirect(dash.url)
        else:
            return redirect(slc.slice_url)

    def save_slice(self, slc):
        session = db.session()
        msg = "Slice [{}] has been saved".format(slc.slice_name)
        session.add(slc)
        session.commit()
        flash(msg, "info")

    def overwrite_slice(self, slc):
        can_update = check_ownership(slc, raise_if_false=False)
        if not can_update:
            flash("You cannot overwrite [{}]".format(slc), "danger")
        else:
            session = db.session()
            session.merge(slc)
            session.commit()
            msg = "Slice [{}] has been overwritten".format(slc.slice_name)
            flash(msg, "info")

    @api
    @has_access_api
    @expose("/checkbox/<model_view>/<id_>/<attr>/<value>", methods=['GET'])
    def checkbox(self, model_view, id_, attr, value):
        """endpoint for checking/unchecking any boolean in a sqla model"""
        views = sys.modules[__name__]
        model_view_cls = getattr(views, model_view)
        model = model_view_cls.datamodel.obj

        obj = db.session.query(model).filter_by(id=id_).first()
        if obj:
            setattr(obj, attr, value == 'true')
            db.session.commit()
        return Response("OK", mimetype="application/json")

    @api
    @has_access_api
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

    @api
    @has_access_api
    @expose("/save_dash/<dashboard_id>/", methods=['GET', 'POST'])
    def save_dash(self, dashboard_id):
        """Save a dashboard's metadata"""
        data = json.loads(request.form.get('data'))
        positions = data['positions']
        slice_ids = [int(d['slice_id']) for d in positions]
        session = db.session()
        Dash = models.Dashboard  # noqa
        dash = session.query(Dash).filter_by(id=dashboard_id).first()
        check_ownership(dash, raise_if_false=True)
        dash.slices = [o for o in dash.slices if o.id in slice_ids]
        positions = sorted(data['positions'], key=lambda x: int(x['slice_id']))
        dash.position_json = json.dumps(positions, indent=4, sort_keys=True)
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

    @api
    @has_access_api
    @expose("/testconn", methods=["POST", "GET"])
    def testconn(self):
        """Tests a sqla connection"""
        try:
            uri = request.json.get('uri')
            connect_args = (
                request.json
                .get('extras', {})
                .get('engine_params', {})
                .get('connect_args', {}))
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
            class_name=class_name, obj_id=obj_id, user_id=g.user.get_id()).all()
        if action == 'select':
            if not favs:
                session.add(
                    FavStar(
                        class_name=class_name, obj_id=obj_id, user_id=g.user.get_id(),
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
    @expose("/slice/<slice_id>/")
    def slice(self, slice_id):
        """Redirects a request for a slice id to its corresponding URL"""
        session = db.session()
        qry = session.query(models.Slice).filter_by(id=int(slice_id))
        slc = qry.first()
        if slc:
            return redirect(slc.slice_url)
        else:
            flash("The specified slice could not be found", "danger")
            return redirect('/slicemodelview/list/')

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

        return self.render_template(
            "caravel/dashboard.html", dashboard=dash,
            templates=templates,
            dash_save_perm=self.can_access('can_save_dash', 'Caravel'),
            dash_edit_perm=check_ownership(dash, raise_if_false=False))

    @has_access
    @expose("/sql/<database_id>/")
    @log_this
    def sql(self, database_id):
        if (
                not self.can_access(
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
                not self.can_access(
                    'all_datasource_access', 'all_datasource_access')):
            raise utils.CaravelSecurityException(_(
                "This view requires the `all_datasource_access` permission"))
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
            cluster_name = cluster.cluster_name
            try:
                cluster.refresh_datasources()
            except Exception as e:
                flash(
                    "Error while processing cluster '{}'\n{}".format(
                        cluster_name, str(e)),
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

    @app.errorhandler(500)
    def show_traceback(self):
        error_msg = get_error_msg()
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
        _("Refresh Druid Metadata"),
        href='/caravel/refresh_datasources/',
        category='Sources',
        category_label=__("Sources"),
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
    label=__("CSS Templates"),
    icon="fa-css3",
    category="Sources",
    category_label=__("Sources"),
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
