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
from datetime import datetime, timedelta

import functools
import sqlalchemy as sqla

from flask import (
    g, request, redirect, flash, Response, render_template, Markup)
from flask_appbuilder import ModelView, CompactCRUDMixin, BaseView, expose
from flask_appbuilder.actions import action
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import has_access, has_access_api
from flask_appbuilder.widgets import ListWidget
from flask_babel import gettext as __
from flask_babel import lazy_gettext as _
from flask_appbuilder.models.sqla.filters import BaseFilter

from sqlalchemy import create_engine
from werkzeug.routing import BaseConverter
from werkzeug.datastructures import ImmutableMultiDict
from wtforms.validators import ValidationError

import caravel
from caravel import (
    appbuilder, cache, db, models, viz, utils, app,
    sm, ascii_art, sql_lab
)
from caravel.source_registry import SourceRegistry
from caravel.models import DatasourceAccessRequest as DAR

config = app.config
log_this = models.Log.log_this
can_access = utils.can_access
QueryStatus = models.QueryStatus


class BaseCaravelView(BaseView):
    def can_access(self, permission_name, view_name):
        return utils.can_access(appbuilder.sm, permission_name, view_name)

    def all_datasource_access(self):
        return self.can_access(
            "all_datasource_access", "all_datasource_access")

    def database_access(self, database):
        return (self.all_datasource_access() or
                self.can_access("database_access", database.perm))

    def datasource_access(self, datasource):
        return (self.database_access(datasource.database) or
                self.can_access("datasource_access", datasource.perm))


class ListWidgetWithCheckboxes(ListWidget):
    """An alternative to list view that renders Boolean fields as checkboxes

    Works in conjunction with the `checkbox` view."""
    template = 'caravel/fab_overrides/list_with_checkboxes.html'


ALL_DATASOURCE_ACCESS_ERR = __(
    "This endpoint requires the `all_datasource_access` permission")
DATASOURCE_MISSING_ERR = __("The datasource seems to have been deleted")
ACCESS_REQUEST_MISSING_ERR = __(
    "The access requests seem to have been deleted")
USER_MISSING_ERR = __("The user seems to have been deleted")


def get_database_access_error_msg(database_name):
    return __("This view requires the database %(name)s or "
              "`all_datasource_access` permission", name=database_name)


def get_datasource_access_error_msg(datasource_name):
    return __("This endpoint requires the datasource %(name)s, database or "
              "`all_datasource_access` permission", name=datasource_name)


def get_error_msg():
    if config.get("SHOW_STACKTRACE"):
        error_msg = traceback.format_exc()
    else:
        error_msg = "FATAL ERROR \n"
        error_msg += (
            "Stacktrace is hidden. Change the SHOW_STACKTRACE "
            "configuration setting to enable it")
    return error_msg


def json_error_response(msg, status=None):
    data = {'error': msg}
    status = status if status else 500
    return Response(
        json.dumps(data), status=status, mimetype="application/json")


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


class TableSlice(CaravelFilter):
    def apply(self, query, func):  # noqa
        if any([r.name in ('Admin', 'Alpha') for r in get_user_roles()]):
            return query
        perms = self.get_perms()
        tables = []
        for perm in perms:
            match = re.search(r'\(id:(\d+)\)', perm)
            tables.append(match.group(1))
        qry = query.filter(self.model.id.in_(tables))
        return qry


class FilterSlice(CaravelFilter):
    def apply(self, query, func):  # noqa
        if any([r.name in ('Admin', 'Alpha') for r in get_user_roles()]):
            return query
        qry = query.filter(self.model.perm.in_(self.get_perms()))
        return qry


class FilterDashboard(CaravelFilter):
    """List dashboards for which users have access to at least one slice"""
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


class FilterDashboardSlices(CaravelFilter):
    def apply(self, query, value):  # noqa
        if any([r.name in ('Admin', 'Alpha') for r in get_user_roles()]):
            return query
        qry = query.filter(self.model.perm.in_(self.get_perms()))
        return qry


class FilterDashboardOwners(CaravelFilter):
    def apply(self, query, value):  # noqa
        if any([r.name in ('Admin', 'Alpha') for r in get_user_roles()]):
            return query
        qry = query.filter_by(id=g.user.id)
        return qry


class FilterDruidDatasource(CaravelFilter):
    def apply(self, query, func):  # noqa
        if any([r.name in ('Admin', 'Alpha') for r in get_user_roles()]):
            return query
        perms = self.get_perms()
        druid_datasources = []
        for perm in perms:
            match = re.search(r'\(id:(\d+)\)', perm)
            if match:
                druid_datasources.append(match.group(1))
        qry = query.filter(self.model.id.in_(druid_datasources))
        return qry


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
    list_widget = ListWidgetWithCheckboxes
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
        'expression', 'table', 'd3format', 'is_restricted']
    description_columns = {
        'expression': utils.markdown(
            "a valid SQL expression as supported by the underlying backend. "
            "Example: `count(DISTINCT userid)`", True),
        'is_restricted': _("Whether the access to this metric is restricted "
                           "to certain roles. Only roles with the permission "
                           "'metric access on XXX (the name of this metric)' "
                           "are allowed to access this metric"),
        'd3format': utils.markdown(
            "d3 formatting string as defined [here]"
            "(https://github.com/d3/d3-format/blob/master/README.md#format). "
            "For instance, this default formatting applies in the Table "
            "visualization and allow for different metric to use different "
            "formats", True
        ),
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
        'datasource', 'd3format', 'is_restricted']
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
    list_columns = ['database_name', 'creator', 'changed_on_']
    add_columns = [
        'database_name', 'sqlalchemy_uri', 'cache_timeout', 'extra',
        'expose_in_sqllab', 'allow_run_sync', 'allow_run_async',
        'allow_ctas', 'allow_dml', 'force_ctas_schema']
    search_exclude_columns = ('password',)
    edit_columns = add_columns
    show_columns = [
        'tables',
        'cache_timeout',
        'extra',
        'database_name',
        'sqlalchemy_uri',
        'created_by',
        'created_on',
        'changed_by',
        'changed_on'
    ]
    add_template = "caravel/models/database/add.html"
    edit_template = "caravel/models/database/edit.html"
    base_order = ('changed_on', 'desc')
    description_columns = {
        'sqlalchemy_uri': (
            "Refer to the SqlAlchemy docs for more information on how "
            "to structure your URI here: "
            "http://docs.sqlalchemy.org/en/rel_1_0/core/engines.html"),
        'expose_in_sqllab': _("Expose this DB in SQL Lab"),
        'allow_run_sync': _(
            "Allow users to run synchronous queries, this is the default "
            "and should work well for queries that can be executed "
            "within a web request scope (<~1 minute)"),
        'allow_run_async': _(
            "Allow users to run queries, against an async backend. "
            "This assumes that you have a Celery worker setup as well "
            "as a results backend."),
        'allow_ctas': _("Allow CREATE TABLE AS option in SQL Lab"),
        'allow_dml': _(
            "Allow users to run non-SELECT statements "
            "(UPDATE, DELETE, CREATE, ...) "
            "in SQL Lab"),
        'force_ctas_schema': _(
            "When allowing CREATE TABLE AS option in SQL Lab, "
            "this option forces the table to be created in this schema"),
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
        'expose_in_sqllab': _("Expose in SQL Lab"),
        'allow_ctas': _("Allow CREATE TABLE AS"),
        'allow_dml': _("Allow DML"),
        'force_ctas_schema': _("CTAS Schema"),
        'database_name': _("Database"),
        'creator': _("Creator"),
        'changed_on_': _("Last Changed"),
        'sqlalchemy_uri': _("SQLAlchemy URI"),
        'cache_timeout': _("Cache Timeout"),
        'extra': _("Extra"),
    }

    def pre_add(self, db):
        db.set_sqlalchemy_uri(db.sqlalchemy_uri)
        utils.merge_perm(sm, 'database_access', db.perm)

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


class DatabaseAsync(DatabaseView):
    list_columns = [
        'id', 'database_name',
        'expose_in_sqllab', 'allow_ctas', 'force_ctas_schema',
        'allow_run_async', 'allow_run_sync', 'allow_dml',
    ]

appbuilder.add_view_no_menu(DatabaseAsync)


class DatabaseTablesAsync(DatabaseView):
    list_columns = ['id', 'all_table_names', 'all_schema_names']

appbuilder.add_view_no_menu(DatabaseTablesAsync)


class TableModelView(CaravelModelView, DeleteMixin):  # noqa
    datamodel = SQLAInterface(models.SqlaTable)
    list_columns = [
        'link', 'database', 'is_featured',
        'changed_by_', 'changed_on_']
    order_columns = [
        'link', 'database', 'is_featured', 'changed_on_']
    add_columns = ['table_name', 'database', 'schema']
    edit_columns = [
        'table_name', 'sql', 'is_featured', 'database', 'schema',
        'description', 'owner',
        'main_dttm_col', 'default_endpoint', 'offset', 'cache_timeout']
    related_views = [TableColumnInlineView, SqlMetricInlineView]
    base_order = ('changed_on', 'desc')
    description_columns = {
        'offset': _("Timezone offset (in hours) for this datasource"),
        'table_name': _(
            "Name of the table that exists in the source database"),
        'schema': _(
            "Schema, as used only in some databases like Postgres, Redshift "
            "and DB2"),
        'description': Markup(
            "Supports <a href='https://daringfireball.net/projects/markdown/'>"
            "markdown</a>"),
        'sql': _(
            "This fields acts a Caravel view, meaning that Caravel will "
            "run a query against this string as a subquery."
        ),
    }
    base_filters = [['id', TableSlice, lambda: []]]
    label_columns = {
        'link': _("Table"),
        'changed_by_': _("Changed By"),
        'database': _("Database"),
        'changed_on_': _("Last Changed"),
        'is_featured': _("Is Featured"),
        'schema': _("Schema"),
        'default_endpoint': _("Default Endpoint"),
        'offset': _("Offset"),
        'cache_timeout': _("Cache Timeout"),
    }

    def pre_add(self, table):
        # Fail before adding if the table can't be found
        try:
            table.get_sqla_table_object()
        except Exception as e:
            logging.exception(e)
            raise Exception(
                "Table [{}] could not be found, "
                "please double check your "
                "database connection, schema, and "
                "table name".format(table.table_name))

    def post_add(self, table):
        table.fetch_metadata()
        utils.merge_perm(sm, 'datasource_access', table.perm)
        flash(_(
            "The table was created. As part of this two phase configuration "
            "process, you should now click the edit button by "
            "the new table to configure it."),
            "info")

    def post_update(self, table):
        self.post_add(table)

appbuilder.add_view(
    TableModelView,
    "Tables",
    label=__("Tables"),
    category="Sources",
    category_label=__("Sources"),
    icon='fa-table',)


class AccessRequestsModelView(CaravelModelView, DeleteMixin):
    datamodel = SQLAInterface(DAR)
    list_columns = [
        'username', 'user_roles', 'datasource_link',
        'roles_with_datasource', 'created_on']
    order_columns = ['username', 'datasource_link']
    base_order = ('changed_on', 'desc')
    label_columns = {
        'username': _("User"),
        'user_roles': _("User Roles"),
        'database': _("Database URL"),
        'datasource_link': _("Datasource"),
        'roles_with_datasource': _("Roles to grant"),
        'created_on': _("Created On"),
    }

appbuilder.add_view(
    AccessRequestsModelView,
    "Access requests",
    label=__("Access requests"),
    category="Security",
    category_label=__("Security"),
    icon='fa-table',)


appbuilder.add_separator("Sources")


class DruidClusterModelView(CaravelModelView, DeleteMixin):  # noqa
    datamodel = SQLAInterface(models.DruidCluster)
    add_columns = [
        'cluster_name',
        'coordinator_host', 'coordinator_port', 'coordinator_endpoint',
        'broker_host', 'broker_port', 'broker_endpoint', 'cache_timeout',
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

    def pre_add(self, db):
        utils.merge_perm(sm, 'database_access', db.perm)

    def pre_update(self, db):
        self.pre_add(db)


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
    can_add = False
    label_columns = {
        'datasource_link': 'Datasource',
    }
    list_columns = [
        'slice_link', 'viz_type', 'datasource_link', 'creator', 'modified']
    edit_columns = [
        'slice_name', 'description', 'viz_type', 'owners', 'dashboards',
        'params', 'cache_timeout']
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

    @expose('/add', methods=['GET', 'POST'])
    @has_access
    def add(self):
        widget = self._add()
        if not widget:
            return redirect(self.get_redirect())

        sources = SourceRegistry.sources
        for source in sources:
            ds = db.session.query(SourceRegistry.sources[source]).first()
            if ds is not None:
                url = "/{}/list/".format(ds.baselink)
                msg = _("Click on a {} link to create a Slice".format(source))
                break

        redirect_url = "/r/msg/?url={}&msg={}".format(url, msg)
        return redirect(redirect_url)

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
        'slice_link': _('Slice'),
    }

appbuilder.add_view_no_menu(SliceAsync)


class SliceAddView(SliceModelView):  # noqa
    list_columns = [
        'slice_link', 'viz_type',
        'owners', 'modified', 'data', 'changed_on']
    label_columns = {
        'icons': ' ',
        'slice_link': _('Slice'),
        'viz_type': _('Visualization Type'),
    }

appbuilder.add_view_no_menu(SliceAddView)


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
    add_form_query_rel_fields = {
        'slices': [['slices', FilterDashboardSlices, None]],
        'owners': [['owners', FilterDashboardOwners, None]],
    }
    edit_form_query_rel_fields = {
        'slices': [['slices', FilterDashboardSlices, None]],
        'owners': [['owners', FilterDashboardOwners, None]],
    }
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
        if g.user not in obj.owners:
            obj.owners.append(g.user)
        utils.validate_json(obj.json_metadata)
        utils.validate_json(obj.position_json)

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
    list_widget = ListWidgetWithCheckboxes
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
    base_filters = [['id', FilterDruidDatasource, lambda: []]]
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
    @log_this
    @has_access
    @expose("/request_access/")
    def request_access(self):
        datasources = set()
        dashboard_id = request.args.get('dashboard_id')
        if dashboard_id:
            dash = (
                db.session.query(models.Dashboard)
                .filter_by(id=int(dashboard_id))
                .one()
            )
            datasources |= dash.datasources
        datasource_id = request.args.get('datasource_id')
        datasource_type = request.args.get('datasource_type')
        if datasource_id:
            ds_class = SourceRegistry.sources.get(datasource_type)
            datasource = (
                db.session.query(ds_class)
                .filter_by(id=int(datasource_id))
                .one()
            )
            datasources.add(datasource)
        if request.args.get('action') == 'go':
            for datasource in datasources:
                access_request = DAR(
                    datasource_id=datasource.id,
                    datasource_type=datasource.type)
                db.session.add(access_request)
                db.session.commit()
            flash(__("Access was requested"), "info")
            return redirect('/')

        return self.render_template(
            'caravel/request_access.html',
            datasources=datasources,
            datasource_names=", ".join([o.name for o in datasources]),
        )

    @log_this
    @has_access
    @expose("/approve")
    def approve(self):
        datasource_type = request.args.get('datasource_type')
        datasource_id = request.args.get('datasource_id')
        created_by_username = request.args.get('created_by')
        role_to_grant = request.args.get('role_to_grant')
        role_to_extend = request.args.get('role_to_extend')

        session = db.session
        datasource_class = SourceRegistry.sources[datasource_type]
        datasource = session.query(datasource_class).filter_by(
            id=datasource_id).first()

        if not datasource:
            flash(DATASOURCE_MISSING_ERR, "alert")
            return json_error_response(DATASOURCE_MISSING_ERR)

        requested_by = sm.find_user(username=created_by_username)
        if not requested_by:
            flash(USER_MISSING_ERR, "alert")
            return json_error_response(USER_MISSING_ERR)

        requests = (
            session.query(DAR)
            .filter(
                DAR.datasource_id == datasource_id,
                DAR.datasource_type == datasource_type,
                DAR.created_by_fk == requested_by.id)
            .all()
        )

        if not requests:
            flash(ACCESS_REQUEST_MISSING_ERR, "alert")
            return json_error_response(ACCESS_REQUEST_MISSING_ERR)

        # check if you can approve
        if self.all_datasource_access() or g.user.id == datasource.owner_id:
            # can by done by admin only
            if role_to_grant:
                role = sm.find_role(role_to_grant)
                requested_by.roles.append(role)
                flash(__(
                    "%(user)s was granted the role %(role)s that gives access "
                    "to the %(datasource)s",
                    user=requested_by.username,
                    role=role_to_grant,
                    datasource=datasource.full_name), "info")

            if role_to_extend:
                perm_view = sm.find_permission_view_menu(
                    'datasource_access', datasource.perm)
                sm.add_permission_role(sm.find_role(role_to_extend), perm_view)
                flash(__("Role %(r)s was extended to provide the access to"
                         " the datasource %(ds)s",
                         r=role_to_extend, ds=datasource.full_name), "info")

        else:
            flash(__("You have no permission to approve this request"),
                  "danger")
            return redirect('/accessrequestsmodelview/list/')
        for r in requests:
            session.delete(r)
        session.commit()
        return redirect('/accessrequestsmodelview/list/')

    def get_viz(
            self,
            slice_id=None,
            args=None,
            datasource_type=None,
            datasource_id=None):
        if slice_id:
            slc = db.session.query(models.Slice).filter_by(id=slice_id).one()
            return slc.get_viz()
        else:
            viz_type = args.get('viz_type', 'table')
            datasource = SourceRegistry.get_datasource(
                datasource_type, datasource_id, db.session)
            viz_obj = viz.viz_types[viz_type](datasource, request.args)
            return viz_obj

    @has_access
    @expose("/slice/<slice_id>/")
    def slice(self, slice_id):
        viz_obj = self.get_viz(slice_id)
        return redirect(viz_obj.get_url(**request.args))

    @has_access_api
    @expose("/explore_json/<datasource_type>/<datasource_id>/")
    def explore_json(self, datasource_type, datasource_id):
        viz_obj = self.get_viz(
            datasource_type=datasource_type,
            datasource_id=datasource_id,
            args=request.args)
        if not self.datasource_access(viz_obj.datasource):
            return Response(
                json.dumps(
                    {'error': _("You don't have access to this datasource")}),
                status=404,
                mimetype="application/json")
        return Response(
            viz_obj.get_json(),
            status=200,
            mimetype="application/json")

    @log_this
    @has_access
    @expose("/explore/<datasource_type>/<datasource_id>/")
    def explore(self, datasource_type, datasource_id):
        viz_type = request.args.get("viz_type")
        slice_id = request.args.get('slice_id')
        slc = db.session.query(models.Slice).filter_by(id=slice_id).first()

        error_redirect = '/slicemodelview/list/'
        datasource_class = SourceRegistry.sources[datasource_type]
        datasources = db.session.query(datasource_class).all()
        datasources = sorted(datasources, key=lambda ds: ds.full_name)

        viz_obj = self.get_viz(
            datasource_type=datasource_type,
            datasource_id=datasource_id,
            args=request.args)

        if not viz_obj.datasource:
            flash(DATASOURCE_MISSING_ERR, "alert")
            return redirect(error_redirect)

        if not self.datasource_access(viz_obj.datasource):
            flash(
                __(get_datasource_access_error_msg(viz_obj.datasource.name)),
                "danger")
            return redirect(
                'caravel/request_access/?'
                'datasource_type={datasource_type}&'
                'datasource_id={datasource_id}&'
                ''.format(**locals()))

        if not viz_type and viz_obj.datasource.default_endpoint:
            return redirect(viz_obj.datasource.default_endpoint)

        # slc perms
        slice_add_perm = self.can_access('can_add', 'SliceModelView')
        slice_edit_perm = check_ownership(slc, raise_if_false=False)
        slice_download_perm = self.can_access('can_download', 'SliceModelView')

        # handle save or overwrite
        action = request.args.get('action')
        if action in ('saveas', 'overwrite'):
            return self.save_or_overwrite_slice(
                request.args, slc, slice_add_perm, slice_edit_perm)

        # handle different endpoints
        if request.args.get("csv") == "true":
            payload = viz_obj.get_csv()
            return Response(
                payload,
                status=200,
                headers=generate_download_headers("csv"),
                mimetype="application/csv")
        elif request.args.get("standalone") == "true":
            return self.render_template("caravel/standalone.html", viz=viz_obj)
        else:
            return self.render_template(
                "caravel/explore.html",
                viz=viz_obj, slice=slc, datasources=datasources,
                can_add=slice_add_perm, can_edit=slice_edit_perm,
                can_download=slice_download_perm,
                userid=g.user.get_id() if g.user else ''
            )

    @has_access
    @expose("/exploreV2/<datasource_type>/<datasource_id>/<slice_id>/")
    @expose("/exploreV2/<datasource_type>/<datasource_id>/")
    @log_this
    def exploreV2(self, datasource_type, datasource_id, slice_id=None):
        error_redirect = '/slicemodelview/list/'
        datasource_class = SourceRegistry.sources[datasource_type]
        datasources = db.session.query(datasource_class).all()
        datasources = sorted(datasources, key=lambda ds: ds.full_name)
        datasource = [ds for ds in datasources if int(datasource_id) == ds.id]
        datasource = datasource[0] if datasource else None

        if not datasource:
            flash(DATASOURCE_MISSING_ERR, "alert")
            return redirect(error_redirect)

        if not self.datasource_access(datasource):
            flash(
                __(get_datasource_access_error_msg(datasource.name)), "danger")
            return redirect('caravel/request_access_form/{}/{}/{}'.format(
                datasource_type, datasource_id, datasource.name))

        request_args_multi_dict = request.args  # MultiDict

        slice_id = slice_id or request_args_multi_dict.get("slice_id")
        slc = None
        # build viz_obj and get it's params
        if slice_id:
            slc = db.session.query(models.Slice).filter_by(id=slice_id).first()
            try:
                viz_obj = slc.get_viz(
                    url_params_multidict=request_args_multi_dict)
            except Exception as e:
                logging.exception(e)
                flash(utils.error_msg_from_exception(e), "danger")
                return redirect(error_redirect)
        else:
            viz_type = request_args_multi_dict.get("viz_type")
            if not viz_type and datasource.default_endpoint:
                return redirect(datasource.default_endpoint)
            # default to table if no default endpoint and no viz_type
            viz_type = viz_type or "table"
            # validate viz params
            try:
                viz_obj = viz.viz_types[viz_type](
                    datasource, request_args_multi_dict)
            except Exception as e:
                logging.exception(e)
                flash(utils.error_msg_from_exception(e), "danger")
                return redirect(error_redirect)
        slice_params_multi_dict = ImmutableMultiDict(viz_obj.orig_form_data)

        # slc perms
        slice_add_perm = self.can_access('can_add', 'SliceModelView')
        slice_edit_perm = check_ownership(slc, raise_if_false=False)
        slice_download_perm = self.can_access('can_download', 'SliceModelView')

        # handle save or overwrite
        action = slice_params_multi_dict.get('action')
        if action in ('saveas', 'overwrite'):
            return self.save_or_overwrite_slice(
                slice_params_multi_dict, slc, slice_add_perm, slice_edit_perm)

        # handle different endpoints
        if slice_params_multi_dict.get("json") == "true":
            if config.get("DEBUG"):
                # Allows for nice debugger stack traces in debug mode
                return Response(
                    viz_obj.get_json(),
                    status=200,
                    mimetype="application/json")
            try:
                return Response(
                    viz_obj.get_json(),
                    status=200,
                    mimetype="application/json")
            except Exception as e:
                logging.exception(e)
                return json_error_response(utils.error_msg_from_exception(e))

        elif slice_params_multi_dict.get("csv") == "true":
            payload = viz_obj.get_csv()
            return Response(
                payload,
                status=200,
                headers=generate_download_headers("csv"),
                mimetype="application/csv")
        else:
            bootstrap_data = {
                "can_add": slice_add_perm,
                "can_download": slice_download_perm,
                "can_edit": slice_edit_perm,
                # TODO: separate endpoint for fetching datasources
                "datasources": [(d.id, d.full_name) for d in datasources],
                "datasource_id": datasource_id,
                "datasource_type": datasource_type,
                "user_id": g.user.get_id() if g.user else None,
                "viz": json.loads(viz_obj.get_json())
            }
            if slice_params_multi_dict.get("standalone") == "true":
                template = "caravel/standalone.html"
            else:
                template = "caravel/explorev2.html"
            return self.render_template(
                    template,
                    bootstrap_data=json.dumps(bootstrap_data))

    def save_or_overwrite_slice(
            self, args, slc, slice_add_perm, slice_edit_perm):
        """Save or overwrite a slice"""
        slice_name = args.get('slice_name')
        action = args.get('action')

        # TODO use form processing form wtforms
        d = args.to_dict(flat=False)
        del d['action']
        del d['previous_viz_type']

        as_list = ('metrics', 'groupby', 'columns', 'all_columns',
                   'mapbox_label', 'order_by_cols')
        for k in d:
            v = d.get(k)
            if k in as_list and not isinstance(v, list):
                d[k] = [v] if v else []
            if k not in as_list and isinstance(v, list):
                d[k] = v[0]

        datasource_type = args.get('datasource_type')
        datasource_id = args.get('datasource_id')

        if action in ('saveas'):
            d.pop('slice_id')  # don't save old slice_id
            slc = models.Slice(owners=[g.user] if g.user else [])

        slc.params = json.dumps(d, indent=4, sort_keys=True)
        slc.datasource_name = args.get('datasource_name')
        slc.viz_type = args.get('viz_type')
        slc.datasource_type = datasource_type
        slc.datasource_id = datasource_id
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
        payload = {str(time.mktime(dt.timetuple())):
                   ccount for dt, ccount in qry if dt}
        return Response(json.dumps(payload), mimetype="application/json")

    @api
    @has_access_api
    @expose("/tables/<db_id>/<schema>")
    def tables(self, db_id, schema):
        """endpoint to power the calendar heatmap on the welcome page"""
        schema = None if schema in ('null', 'undefined') else schema
        database = (
            db.session
            .query(models.Database)
            .filter_by(id=db_id)
            .one()
        )
        payload = {
            'tables': database.all_table_names(schema),
            'views': database.all_view_names(schema),
        }
        return Response(
            json.dumps(payload), mimetype="application/json")

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
        if 'filter_immune_slice_fields' not in md:
            md['filter_immune_slice_fields'] = {}
        md['expanded_slices'] = data['expanded_slices']
        dash.json_metadata = json.dumps(md, indent=4)
        dash.css = data['css']
        session.merge(dash)
        session.commit()
        session.close()
        return "SUCCESS"

    @api
    @has_access_api
    @expose("/add_slices/<dashboard_id>/", methods=['POST'])
    def add_slices(self, dashboard_id):
        """Add and save slices to a dashboard"""
        data = json.loads(request.form.get('data'))
        session = db.session()
        Slice = models.Slice  # noqa
        dash = (
            session.query(models.Dashboard).filter_by(id=dashboard_id).first())
        check_ownership(dash, raise_if_false=True)
        new_slices = session.query(Slice).filter(
            Slice.id.in_(data['slice_ids']))
        dash.slices += new_slices
        session.merge(dash)
        session.commit()
        session.close()
        return "SLICES ADDED"

    @api
    @has_access_api
    @expose("/testconn", methods=["POST", "GET"])
    def testconn(self):
        """Tests a sqla connection"""
        try:
            uri = request.json.get('uri')
            db_name = request.json.get('name')
            if db_name:
                database = (
                    db.session
                    .query(models.Database)
                    .filter_by(database_name=db_name)
                    .first()
                )
                if database and uri == database.safe_sqlalchemy_uri():
                    # the password-masked uri was passed
                    # use the URI associated with this database
                    uri = database.sqlalchemy_uri_decrypted
            connect_args = (
                request.json
                .get('extras', {})
                .get('engine_params', {})
                .get('connect_args', {}))
            engine = create_engine(uri, connect_args=connect_args)
            engine.connect()
            return json.dumps(engine.table_names(), indent=4)
        except Exception as e:
            return Response((
                "Connection failed!\n\n"
                "The error message returned was:\n{}").format(e),
                status=500,
                mimetype="application/json")

    @api
    @has_access_api
    @expose("/warm_up_cache/", methods=['GET'])
    def warm_up_cache(self):
        """Warms up the cache for the slice or table."""
        slices = None
        session = db.session()
        slice_id = request.args.get('slice_id')
        table_name = request.args.get('table_name')
        db_name = request.args.get('db_name')

        if not slice_id and not (table_name and db_name):
            return json_error_response(__(
                "Malformed request. slice_id or table_name and db_name "
                "arguments are expected"), status=400)
        if slice_id:
            slices = session.query(models.Slice).filter_by(id=slice_id).all()
            if not slices:
                return json_error_response(__(
                    "Slice %(id)s not found", id=slice_id), status=404)
        elif table_name and db_name:
            table = (
                session.query(models.SqlaTable)
                .join(models.Database)
                .filter(
                    models.Database.database_name == db_name or
                    models.SqlaTable.table_name == table_name)
            ).first()
            if not table:
                json_error_response(__(
                    "Table %(t)s wasn't found in the database %(d)s",
                    t=table_name, s=db_name), status=404)
            slices = session.query(models.Slice).filter_by(
                datasource_id=table.id,
                datasource_type=table.type).all()

        for slice in slices:
            try:
                obj = slice.get_viz()
                obj.get_json(force=True)
            except Exception as e:
                return json_error_response(utils.error_msg_from_exception(e))
        return Response(
            json.dumps(
                [{"slice_id": session.id, "slice_name": session.slice_name}
                 for session in slices]),
            status=200,
            mimetype="application/json")

    @expose("/favstar/<class_name>/<obj_id>/<action>/")
    def favstar(self, class_name, obj_id, action):
        session = db.session()
        FavStar = models.FavStar  # noqa
        count = 0
        favs = session.query(FavStar).filter_by(
            class_name=class_name, obj_id=obj_id,
            user_id=g.user.get_id()).all()
        if action == 'select':
            if not favs:
                session.add(
                    FavStar(
                        class_name=class_name,
                        obj_id=obj_id,
                        user_id=g.user.get_id(),
                        dttm=datetime.now()
                    )
                )
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
        dash = qry.one()
        datasources = {slc.datasource for slc in dash.slices}
        for datasource in datasources:
            if not self.datasource_access(datasource):
                flash(
                    __(get_datasource_access_error_msg(datasource.name)),
                    "danger")
                return redirect(
                    'caravel/request_access/?'
                    'dashboard_id={dash.id}&'
                    ''.format(**locals()))

        # Hack to log the dashboard_id properly, even when getting a slug
        @log_this
        def dashboard(**kwargs):  # noqa
            pass
        dashboard(dashboard_id=dash.id)
        dash_edit_perm = check_ownership(dash, raise_if_false=False)
        dash_save_perm = \
            dash_edit_perm and self.can_access('can_save_dash', 'Caravel')
        return self.render_template(
            "caravel/dashboard.html", dashboard=dash,
            user_id=g.user.get_id(),
            templates=templates,
            dash_save_perm=dash_save_perm,
            dash_edit_perm=dash_edit_perm)

    @has_access
    @expose("/sync_druid/", methods=['POST'])
    @log_this
    def sync_druid_source(self):
        """Syncs the druid datasource in main db with the provided config.

        The endpoint takes 3 arguments:
            user - user name to perform the operation as
            cluster - name of the druid cluster
            config - configuration stored in json that contains:
                name: druid datasource name
                dimensions: list of the dimensions, they become druid columns
                    with the type STRING
                metrics_spec: list of metrics (dictionary). Metric consists of
                    2 attributes: type and name. Type can be count,
                    etc. `count` type is stored internally as longSum
            other fields will be ignored.

            Example: {
                "name": "test_click",
                "metrics_spec": [{"type": "count", "name": "count"}],
                "dimensions": ["affiliate_id", "campaign", "first_seen"]
            }
        """
        payload = request.get_json(force=True)
        druid_config = payload['config']
        user_name = payload['user']
        cluster_name = payload['cluster']

        user = sm.find_user(username=user_name)
        if not user:
            err_msg = __("Can't find User '%(name)s', please ask your admin "
                         "to create one.", name=user_name)
            logging.error(err_msg)
            return json_error_response(err_msg)
        cluster = db.session.query(models.DruidCluster).filter_by(
            cluster_name=cluster_name).first()
        if not cluster:
            err_msg = __("Can't find DruidCluster with cluster_name = "
                         "'%(name)s'", name=cluster_name)
            logging.error(err_msg)
            return json_error_response(err_msg)
        try:
            models.DruidDatasource.sync_to_db_from_config(
                druid_config, user, cluster)
        except Exception as e:
            logging.exception(utils.error_msg_from_exception(e))
            return json_error_response(utils.error_msg_from_exception(e))
        return Response(status=201)

    @has_access
    @expose("/sqllab_viz/")
    @log_this
    def sqllab_viz(self):
        data = json.loads(request.args.get('data'))
        table_name = data.get('datasourceName')
        viz_type = data.get('chartType')
        table = (
            db.session.query(models.SqlaTable)
            .filter_by(table_name=table_name)
            .first()
        )
        if not table:
            table = models.SqlaTable(table_name=table_name)
        table.database_id = data.get('dbId')
        table.sql = data.get('sql')
        db.session.add(table)
        cols = []
        dims = []
        metrics = []
        for column_name, config in data.get('columns').items():
            is_dim = config.get('is_dim', False)
            col = models.TableColumn(
                column_name=column_name,
                filterable=is_dim,
                groupby=is_dim,
                is_dttm=config.get('is_date', False),
            )
            cols.append(col)
            if is_dim:
                dims.append(col)
            agg = config.get('agg')
            if agg:
                metrics.append(models.SqlMetric(
                    metric_name="{agg}__{column_name}".format(**locals()),
                    expression="{agg}({column_name})".format(**locals()),
                ))
        if not metrics:
            metrics.append(models.SqlMetric(
                metric_name="count".format(**locals()),
                expression="count(*)".format(**locals()),
            ))
        table.columns = cols
        table.metrics = metrics
        db.session.commit()
        params = {
            'viz_type': viz_type,
            'groupby': dims[0].column_name if dims else '',
            'metrics': metrics[0].metric_name if metrics else '',
            'metric': metrics[0].metric_name if metrics else '',
        }
        params = "&".join([k + '=' + v for k, v in params.items()])
        url = '/caravel/explore/table/{table.id}/?{params}'.format(**locals())
        return redirect(url)

    @has_access
    @expose("/sql/<database_id>/")
    @log_this
    def sql(self, database_id):
        if not self.all_datasource_access():
            flash(ALL_DATASOURCE_ACCESS_ERR, "danger")
            return redirect("/tablemodelview/list/")

        mydb = db.session.query(
            models.Database).filter_by(id=database_id).first()
        if not self.database_access(mydb.perm):
            flash(get_database_access_error_msg(mydb.database_name), "danger")
            return redirect("/tablemodelview/list/")
        engine = mydb.get_sqla_engine()
        tables = engine.table_names()

        table_name = request.args.get('table_name')
        return self.render_template(
            "caravel/sql.html",
            tables=tables,
            table_name=table_name,
            db=mydb)

    @has_access
    @expose("/table/<database_id>/<table_name>/<schema>/")
    @log_this
    def table(self, database_id, table_name, schema):
        schema = None if schema in ('null', 'undefined') else schema
        mydb = db.session.query(models.Database).filter_by(id=database_id).one()
        cols = []
        indexes = []
        t = mydb.get_columns(table_name, schema)
        try:
            t = mydb.get_columns(table_name, schema)
            indexes = mydb.get_indexes(table_name, schema)
        except Exception as e:
            return Response(
                json.dumps({'error': utils.error_msg_from_exception(e)}),
                mimetype="application/json")
        for col in t:
            dtype = ""
            try:
                dtype = '{}'.format(col['type'])
            except:
                pass
            cols.append({
                'name': col['name'],
                'type': dtype.split('(')[0] if '(' in dtype else dtype,
                'longType': dtype,
            })
        tbl = {
            'name': table_name,
            'columns': cols,
            'indexes': indexes,
        }
        return Response(json.dumps(tbl), mimetype="application/json")

    @has_access
    @expose("/select_star/<database_id>/<table_name>/")
    @log_this
    def select_star(self, database_id, table_name):
        mydb = db.session.query(
            models.Database).filter_by(id=database_id).first()
        t = mydb.get_table(table_name)

        # Prevent exposing column fields to users that cannot access DB.
        if not self.datasource_access(t.perm):
            flash(get_datasource_access_error_msg(t.name), 'danger')
            return redirect("/tablemodelview/list/")

        fields = ", ".join(
            [c.name for c in t.columns] or "*")
        s = "SELECT\n{}\nFROM {}".format(fields, table_name)
        return self.render_template(
            "caravel/ajah.html",
            content=s
        )

    @expose("/theme/")
    def theme(self):
        return self.render_template('caravel/theme.html')

    @has_access_api
    @expose("/cached_key/<key>/")
    @log_this
    def cached_key(self, key):
        """Returns a key from the cache"""
        resp = cache.get(key)
        if resp:
            return resp
        return "nope"

    @has_access_api
    @expose("/sql_json/", methods=['POST', 'GET'])
    @log_this
    def sql_json(self):
        """Runs arbitrary sql and returns and json"""
        async = request.form.get('runAsync') == 'true'
        sql = request.form.get('sql')
        database_id = request.form.get('database_id')

        session = db.session()
        mydb = session.query(models.Database).filter_by(id=database_id).first()

        if not mydb:
            json_error_response(
                'Database with id {} is missing.'.format(database_id))

        if not self.database_access(mydb):
            json_error_response(
                get_database_access_error_msg(mydb.database_name))
        session.commit()

        query = models.Query(
            database_id=int(database_id),
            limit=int(app.config.get('SQL_MAX_ROW', None)),
            sql=sql,
            schema=request.form.get('schema'),
            select_as_cta=request.form.get('select_as_cta') == 'true',
            start_time=utils.now_as_float(),
            tab_name=request.form.get('tab'),
            status=QueryStatus.PENDING if async else QueryStatus.RUNNING,
            sql_editor_id=request.form.get('sql_editor_id'),
            tmp_table_name=request.form.get('tmp_table_name'),
            user_id=int(g.user.get_id()),
            client_id=request.form.get('client_id'),
        )
        session.add(query)
        session.commit()
        query_id = query.id

        # Async request.
        if async:
            # Ignore the celery future object and the request may time out.
            sql_lab.get_sql_results.delay(query_id, return_results=False)
            return Response(
                json.dumps({'query': query.to_dict()},
                           default=utils.json_int_dttm_ser,
                           allow_nan=False),
                status=202,  # Accepted
                mimetype="application/json")

        # Sync request.
        try:
            SQLLAB_TIMEOUT = config.get("SQLLAB_TIMEOUT")
            with utils.timeout(
                    seconds=SQLLAB_TIMEOUT,
                    error_message=(
                        "The query exceeded the {SQLLAB_TIMEOUT} seconds "
                        "timeout. You may want to run your query as a "
                        "`CREATE TABLE AS` to prevent timeouts."
                    ).format(**locals())):
                data = sql_lab.get_sql_results(query_id, return_results=True)
        except Exception as e:
            logging.exception(e)
            return Response(
                json.dumps({'error': "{}".format(e)}),
                status=500,
                mimetype="application/json")
        data['query'] = query.to_dict()
        return Response(
            json.dumps(data, default=utils.json_iso_dttm_ser),
            status=200,
            mimetype="application/json")

    @has_access
    @expose("/csv/<client_id>")
    @log_this
    def csv(self, client_id):
        """Download the query results as csv."""
        query = (
            db.session.query(models.Query)
            .filter_by(client_id=client_id)
            .one()
        )

        if not self.database_access(query.database):
            flash(get_database_access_error_msg(query.database.database_name))
            return redirect('/')

        sql = query.select_sql or query.sql
        df = query.database.get_df(sql, query.schema)
        # TODO(bkyryliuk): add compression=gzip for big files.
        csv = df.to_csv(index=False)
        response = Response(csv, mimetype='text/csv')
        response.headers['Content-Disposition'] = (
            'attachment; filename={}.csv'.format(query.name))
        return response

    @has_access
    @expose("/fetch_datasource_metadata")
    @log_this
    def fetch_datasource_metadata(self):
        session = db.session
        datasource_type = request.args.get('datasource_type')
        datasource_class = SourceRegistry.sources[datasource_type]
        datasource = (
            session.query(datasource_class)
            .filter_by(id=request.args.get('datasource_id'))
            .first()
        )

        # Check if datasource exists
        if not datasource:
            return json_error_response(DATASOURCE_MISSING_ERR)
        # Check permission for datasource
        if not self.datasource_access(datasource):
            return json_error_response(DATASOURCE_ACCESS_ERR)

        order_by_choices = []
        for s in sorted(datasource.num_cols):
            order_by_choices.append(s + ' [asc]')
            order_by_choices.append(s + ' [desc]')
        column_opts = {
            "groupby_cols": datasource.groupby_column_names,
            "metrics": datasource.metrics_combo,
            "filter_cols": datasource.filterable_column_names,
            "columns": datasource.column_names,
            "ordering_cols": order_by_choices
        }
        form_data = dict(
            column_opts.items() + datasource.time_column_grains.items()
        )

        return Response(
            json.dumps(form_data), mimetype="application/json")

    @has_access
    @expose("/queries/<last_updated_ms>")
    @log_this
    def queries(self, last_updated_ms):
        """Get the updated queries."""
        if not g.user.get_id():
            return Response(
                json.dumps({'error': "Please login to access the queries."}),
                status=403,
                mimetype="application/json")

        # Unix time, milliseconds.
        last_updated_ms_int = int(float(last_updated_ms)) if last_updated_ms else 0

        # UTC date time, same that is stored in the DB.
        last_updated_dt = utils.EPOCH + timedelta(seconds=last_updated_ms_int / 1000)

        sql_queries = (
            db.session.query(models.Query)
            .filter(
                models.Query.user_id == g.user.get_id(),
                models.Query.changed_on >= last_updated_dt,
            )
            .all()
        )
        dict_queries = {q.client_id: q.to_dict() for q in sql_queries}
        return Response(
            json.dumps(dict_queries, default=utils.json_int_dttm_ser),
            status=200,
            mimetype="application/json")

    @has_access
    @expose("/search_queries")
    @log_this
    def search_queries(self):
        """Search for queries."""
        query = db.session.query(models.Query)
        userId = request.args.get('userId')
        databaseId = request.args.get('databaseId')
        searchText = request.args.get('searchText')
        status = request.args.get('status')

        if userId != 'null':
            # Filter on db Id
            query = query.filter(models.Query.user_id == userId)

        if databaseId != 'null':
            # Filter on db Id
            query = query.filter(models.Query.database_id == databaseId)

        if status != 'null':
            # Filter on status
            query = query.filter(models.Query.status == status)

        if searchText != 'null':
            # Filter on search text
            query = query.filter(models.Query.sql.like('%{}%'.format(searchText)))

        sql_queries = query.limit(config.get("QUERY_SEARCH_LIMIT")).all()

        dict_queries = {q.client_id: q.to_dict() for q in sql_queries}
        return Response(
            json.dumps(dict_queries, default=utils.json_int_dttm_ser),
            status=200,
            mimetype="application/json")

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
                        cluster_name, utils.error_msg_from_exception(e)),
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

    @has_access
    @expose("/sqllab")
    def sqlanvil(self):
        """SQL Editor"""
        return self.render_template('caravel/sqllab.html')

appbuilder.add_view_no_menu(Caravel)

if config['DRUID_IS_ACTIVE']:
    appbuilder.add_link(
        "Refresh Druid Metadata",
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

appbuilder.add_link(
    'SQL Editor',
    href='/caravel/sqllab',
    category_icon="fa-flask",
    icon="fa-flask",
    category='SQL Lab')
appbuilder.add_link(
    'Query Search',
    href='/caravel/sqllab#search',
    icon="fa-search",
    category_icon="fa-flask",
    category='SQL Lab')


@app.after_request
def apply_caching(response):
    """Applies the configuration's http headers to all responses"""
    for k, v in config.get('HTTP_HEADERS').items():
        response.headers[k] = v
    return response


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
