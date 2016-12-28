from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from datetime import datetime, timedelta
import json
import logging
import pickle
import re
import sys
import time
import traceback
import zlib

import functools
import sqlalchemy as sqla

from flask import (
    g, request, redirect, flash, Response, render_template, Markup)
from flask_appbuilder import ModelView, CompactCRUDMixin, BaseView, expose
from flask_appbuilder.actions import action
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import has_access, has_access_api
from flask_appbuilder.widgets import ListWidget
from flask_appbuilder.models.sqla.filters import BaseFilter
from flask_appbuilder.security.sqla import models as ab_models

from flask_babel import gettext as __
from flask_babel import lazy_gettext as _

from sqlalchemy import create_engine
from werkzeug.routing import BaseConverter
from wtforms.validators import ValidationError

import superset
from superset import (
    appbuilder, cache, db, models, viz, utils, app,
    sm, sql_lab, sql_parse, results_backend, security,
)
from superset.source_registry import SourceRegistry
from superset.models import DatasourceAccessRequest as DAR

config = app.config
log_this = models.Log.log_this
can_access = utils.can_access
QueryStatus = models.QueryStatus


class BaseSupersetView(BaseView):
    def can_access(self, permission_name, view_name):
        return utils.can_access(appbuilder.sm, permission_name, view_name)

    def all_datasource_access(self):
        return self.can_access(
            "all_datasource_access", "all_datasource_access")

    def database_access(self, database):
        return (
            self.can_access("all_database_access", "all_database_access") or
            self.can_access("database_access", database.perm)
        )

    def schema_access(self, datasource):
        return (
            self.database_access(datasource.database) or
            self.all_datasource_access() or
            self.can_access("schema_access", datasource.schema_perm)
        )

    def datasource_access(self, datasource):
        return (
            self.schema_access(datasource) or
            self.can_access("datasource_access", datasource.perm)
        )

    def datasource_access_by_name(
            self, database, datasource_name, schema=None):
        if (self.database_access(database) or
                self.all_datasource_access()):
            return True

        schema_perm = utils.get_schema_perm(database, schema)
        if schema and utils.can_access(sm, 'schema_access', schema_perm):
            return True

        datasources = SourceRegistry.query_datasources_by_name(
            db.session, database, datasource_name, schema=schema)
        for datasource in datasources:
            if self.can_access("datasource_access", datasource.perm):
                return True
        return False


class ListWidgetWithCheckboxes(ListWidget):
    """An alternative to list view that renders Boolean fields as checkboxes

    Works in conjunction with the `checkbox` view."""
    template = 'superset/fab_overrides/list_with_checkboxes.html'


ALL_DATASOURCE_ACCESS_ERR = __(
    "This endpoint requires the `all_datasource_access` permission")
DATASOURCE_MISSING_ERR = __("The datasource seems to have been deleted")
ACCESS_REQUEST_MISSING_ERR = __(
    "The access requests seem to have been deleted")
USER_MISSING_ERR = __("The user seems to have been deleted")
DATASOURCE_ACCESS_ERR = __("You don't have access to this datasource")


def get_database_access_error_msg(database_name):
    return __("This view requires the database %(name)s or "
              "`all_datasource_access` permission", name=database_name)


def get_datasource_access_error_msg(datasource_name):
    return __("This endpoint requires the datasource %(name)s, database or "
              "`all_datasource_access` permission", name=datasource_name)


def get_datasource_exist_error_mgs(full_name):
    return __("Datasource %(name)s already exists", name=full_name)


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

    security_exception = utils.SupersetSecurityException(
              "You don't have the rights to alter [{}]".format(obj))

    if g.user.is_anonymous():
        if raise_if_false:
            raise security_exception
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
        raise security_exception
    else:
        return False


def get_user_roles():
    if g.user.is_anonymous():
        public_role = config.get('AUTH_ROLE_PUBLIC')
        return [appbuilder.sm.find_role(public_role)] if public_role else []
    return g.user.roles


class SupersetFilter(BaseFilter):

    """Add utility function to make BaseFilter easy and fast

    These utility function exist in the SecurityManager, but would do
    a database round trip at every check. Here we cache the role objects
    to be able to make multiple checks but query the db only once
    """

    def get_user_roles(self):
        return get_user_roles()

    def get_all_permissions(self):
        """Returns a set of tuples with the perm name and view menu name"""
        perms = set()
        for role in get_user_roles():
            for perm_view in role.permissions:
                t = (perm_view.permission.name, perm_view.view_menu.name)
                perms.add(t)
        return perms

    def has_role(self, role_name_or_list):
        """Whether the user has this role name"""
        if not isinstance(role_name_or_list, list):
            role_name_or_list = [role_name_or_list]
        return any(
            [r.name in role_name_or_list for r in self.get_user_roles()])

    def has_perm(self, permission_name, view_menu_name):
        """Whether the user has this perm"""
        return (permission_name, view_menu_name) in self.get_all_permissions()

    def get_view_menus(self, permission_name):
        """Returns the details of view_menus for a perm name"""
        vm = set()
        for perm_name, vm_name in self.get_all_permissions():
            if perm_name == permission_name:
                vm.add(vm_name)
        return vm

    def has_all_datasource_access(self):
        return (
            self.has_role(['Admin', 'Alpha']) or
            self.has_perm('all_datasource_access', 'all_datasource_access'))


class DatasourceFilter(SupersetFilter):
    def apply(self, query, func):  # noqa
        if self.has_all_datasource_access():
            return query
        perms = self.get_view_menus('datasource_access')
        # TODO(bogdan): add `schema_access` support here
        return query.filter(self.model.perm.in_(perms))


class SliceFilter(SupersetFilter):
    def apply(self, query, func):  # noqa
        if self.has_all_datasource_access():
            return query
        perms = self.get_view_menus('datasource_access')
        # TODO(bogdan): add `schema_access` support here
        return query.filter(self.model.perm.in_(perms))


class DashboardFilter(SupersetFilter):

    """List dashboards for which users have access to at least one slice"""

    def apply(self, query, func):  # noqa
        if self.has_all_datasource_access():
            return query
        Slice = models.Slice  # noqa
        Dash = models.Dashboard  # noqa
        # TODO(bogdan): add `schema_access` support here
        datasource_perms = self.get_view_menus('datasource_access')
        slice_ids_qry = (
            db.session
            .query(Slice.id)
            .filter(Slice.perm.in_(datasource_perms))
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


class SupersetModelView(ModelView):
    page_size = 500


class TableColumnInlineView(CompactCRUDMixin, SupersetModelView):  # noqa
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
            "Superset uses default expression based on DB URI if this "
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


class DruidColumnInlineView(CompactCRUDMixin, SupersetModelView):  # noqa
    datamodel = SQLAInterface(models.DruidColumn)
    edit_columns = [
        'column_name', 'description', 'dimension_spec_json', 'datasource',
        'groupby', 'count_distinct', 'sum', 'min', 'max']
    add_columns = edit_columns
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
    description_columns = {
        'dimension_spec_json': utils.markdown(
            "this field can be used to specify  "
            "a `dimensionSpec` as documented [here]"
            "(http://druid.io/docs/latest/querying/dimensionspecs.html). "
            "Make sure to input valid JSON and that the "
            "`outputName` matches the `column_name` defined "
            "above.",
            True),
    }

    def post_update(self, col):
        col.generate_metrics()
        utils.validate_json(col.dimension_spec_json)

    def post_add(self, col):
        self.post_update(col)

appbuilder.add_view_no_menu(DruidColumnInlineView)


class SqlMetricInlineView(CompactCRUDMixin, SupersetModelView):  # noqa
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
        if metric.is_restricted:
            security.merge_perm(sm, 'metric_access', metric.get_perm())

    def post_update(self, metric):
        if metric.is_restricted:
            security.merge_perm(sm, 'metric_access', metric.get_perm())

appbuilder.add_view_no_menu(SqlMetricInlineView)


class DruidMetricInlineView(CompactCRUDMixin, SupersetModelView):  # noqa
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
        utils.init_metrics_perm(superset, [metric])

    def post_update(self, metric):
        utils.init_metrics_perm(superset, [metric])


appbuilder.add_view_no_menu(DruidMetricInlineView)


class DatabaseView(SupersetModelView, DeleteMixin):  # noqa
    datamodel = SQLAInterface(models.Database)
    list_columns = [
        'database_name', 'backend', 'allow_run_sync', 'allow_run_async',
        'allow_dml', 'creator', 'changed_on_']
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
        'perm',
        'created_by',
        'created_on',
        'changed_by',
        'changed_on',
    ]
    add_template = "superset/models/database/add.html"
    edit_template = "superset/models/database/edit.html"
    base_order = ('changed_on', 'desc')
    description_columns = {
        'sqlalchemy_uri': utils.markdown(
            "Refer to the "
            "[SqlAlchemy docs]"
            "(http://docs.sqlalchemy.org/en/rel_1_0/core/engines.html#"
            "database-urls) "
            "for more information on how to structure your URI.", True),
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
        security.merge_perm(sm, 'database_access', db.perm)
        for schema in db.all_schema_names():
            security.merge_perm(
                sm, 'schema_access', utils.get_schema_perm(db, schema))

    def pre_update(self, db):
        self.pre_add(db)


appbuilder.add_link(
    'Import Dashboards',
    label=__("Import Dashboards"),
    href='/superset/import_dashboards',
    icon="fa-cloud-upload",
    category='Manage',
    category_label=__("Manage"),
    category_icon='fa-wrench',)


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


class TableModelView(SupersetModelView, DeleteMixin):  # noqa
    datamodel = SQLAInterface(models.SqlaTable)
    list_columns = [
        'link', 'database', 'is_featured',
        'changed_by_', 'changed_on_']
    order_columns = [
        'link', 'database', 'is_featured', 'changed_on_']
    add_columns = ['table_name', 'database', 'schema']
    edit_columns = [
        'table_name', 'sql', 'is_featured', 'filter_select_enabled',
        'database', 'schema',
        'description', 'owner',
        'main_dttm_col', 'default_endpoint', 'offset', 'cache_timeout']
    show_columns = edit_columns + ['perm']
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
            "This fields acts a Superset view, meaning that Superset will "
            "run a query against this string as a subquery."
        ),
    }
    base_filters = [['id', DatasourceFilter, lambda: []]]
    label_columns = {
        'link': _("Table"),
        'changed_by_': _("Changed By"),
        'database': _("Database"),
        'changed_on_': _("Last Changed"),
        'is_featured': _("Is Featured"),
        'filter_select_enabled': _("Enable Filter Select"),
        'schema': _("Schema"),
        'default_endpoint': _("Default Endpoint"),
        'offset': _("Offset"),
        'cache_timeout': _("Cache Timeout"),
    }

    def pre_add(self, table):
        number_of_existing_tables = db.session.query(
            sqla.func.count('*')).filter(
            models.SqlaTable.table_name == table.table_name,
            models.SqlaTable.schema == table.schema,
            models.SqlaTable.database_id == table.database.id
        ).scalar()
        # table object is already added to the session
        if number_of_existing_tables > 1:
            raise Exception(get_datasource_exist_error_mgs(table.full_name))

        # Fail before adding if the table can't be found
        try:
            table.get_sqla_table_object()
        except Exception as e:
            logging.exception(e)
            raise Exception(
                "Table [{}] could not be found, "
                "please double check your "
                "database connection, schema, and "
                "table name".format(table.name))

    def post_add(self, table):
        table.fetch_metadata()
        security.merge_perm(sm, 'datasource_access', table.get_perm())
        if table.schema:
            security.merge_perm(sm, 'schema_access', table.schema_perm)

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

appbuilder.add_separator("Sources")


class AccessRequestsModelView(SupersetModelView, DeleteMixin):
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


class DruidClusterModelView(SupersetModelView, DeleteMixin):  # noqa
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

    def pre_add(self, cluster):
        security.merge_perm(sm, 'database_access', cluster.perm)

    def pre_update(self, cluster):
        self.pre_add(cluster)


if config['DRUID_IS_ACTIVE']:
    appbuilder.add_view(
        DruidClusterModelView,
        name="Druid Clusters",
        label=__("Druid Clusters"),
        icon="fa-cubes",
        category="Sources",
        category_label=__("Sources"),
        category_icon='fa-database',)


class SliceModelView(SupersetModelView, DeleteMixin):  # noqa
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
    base_filters = [['id', SliceFilter, lambda: []]]
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
        'id', 'slice_name', 'slice_link', 'viz_type',
        'owners', 'modified', 'changed_on']

appbuilder.add_view_no_menu(SliceAddView)


class DashboardModelView(SupersetModelView, DeleteMixin):  # noqa
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
    base_filters = [['slice', DashboardFilter, lambda: []]]
    add_form_query_rel_fields = {
        'slices': [['slices', SliceFilter, None]],
    }
    edit_form_query_rel_fields = add_form_query_rel_fields
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

    @action("mulexport", "Export", "Export dashboards?", "fa-database")
    def mulexport(self, items):
        ids = ''.join('&id={}'.format(d.id) for d in items)
        return redirect(
            '/dashboardmodelview/export_dashboards_form?{}'.format(ids[1:]))

    @expose("/export_dashboards_form")
    def download_dashboards(self):
        if request.args.get('action') == 'go':
            ids = request.args.getlist('id')
            return Response(
                models.Dashboard.export_dashboards(ids),
                headers=generate_download_headers("pickle"),
                mimetype="application/text")
        return self.render_template(
            'superset/export_dashboards.html',
            dashboards_url='/dashboardmodelview/list'
        )


appbuilder.add_view(
    DashboardModelView,
    "Dashboards",
    label=__("Dashboards"),
    icon="fa-dashboard",
    category='',
    category_icon='',)


class DashboardModelViewAsync(DashboardModelView):  # noqa
    list_columns = ['dashboard_link', 'creator', 'modified', 'dashboard_title']
    label_columns = {
        'dashboard_link': 'Dashboard',
    }

appbuilder.add_view_no_menu(DashboardModelViewAsync)


class LogModelView(SupersetModelView):
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


class QueryView(SupersetModelView):
    datamodel = SQLAInterface(models.Query)
    list_columns = ['user', 'database', 'status', 'start_time', 'end_time']

appbuilder.add_view(
    QueryView,
    "Queries",
    label=__("Queries"),
    category="Manage",
    category_label=__("Manage"),
    icon="fa-search")


class DruidDatasourceModelView(SupersetModelView, DeleteMixin):  # noqa
    datamodel = SQLAInterface(models.DruidDatasource)
    list_widget = ListWidgetWithCheckboxes
    list_columns = [
        'datasource_link', 'cluster', 'changed_by_', 'changed_on_', 'offset']
    order_columns = [
        'datasource_link', 'changed_on_', 'offset']
    related_views = [DruidColumnInlineView, DruidMetricInlineView]
    edit_columns = [
        'datasource_name', 'cluster', 'description', 'owner',
        'is_featured', 'is_hidden', 'filter_select_enabled',
        'default_endpoint', 'offset', 'cache_timeout']
    add_columns = edit_columns
    show_columns = add_columns + ['perm']
    page_size = 500
    base_order = ('datasource_name', 'asc')
    description_columns = {
        'offset': _("Timezone offset (in hours) for this datasource"),
        'description': Markup(
            "Supports <a href='"
            "https://daringfireball.net/projects/markdown/'>markdown</a>"),
    }
    base_filters = [['id', DatasourceFilter, lambda: []]]
    label_columns = {
        'datasource_link': _("Data Source"),
        'cluster': _("Cluster"),
        'description': _("Description"),
        'owner': _("Owner"),
        'is_featured': _("Is Featured"),
        'is_hidden': _("Is Hidden"),
        'filter_select_enabled': _("Enable Filter Select"),
        'default_endpoint': _("Default Endpoint"),
        'offset': _("Time Offset"),
        'cache_timeout': _("Cache Timeout"),
    }

    def pre_add(self, datasource):
        number_of_existing_datasources = db.session.query(
            sqla.func.count('*')).filter(
            models.DruidDatasource.datasource_name ==
                datasource.datasource_name,
            models.DruidDatasource.cluster_name == datasource.cluster.id
        ).scalar()

        # table object is already added to the session
        if number_of_existing_datasources > 1:
            raise Exception(get_datasource_exist_error_mgs(
                datasource.full_name))

    def post_add(self, datasource):
        datasource.generate_metrics()
        security.merge_perm(sm, 'datasource_access', datasource.get_perm())
        if datasource.schema:
            security.merge_perm(sm, 'schema_access', datasource.schema_perm)

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


class R(BaseSupersetView):

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
        return("http://{request.headers[Host]}/r/{obj.id}".format(
            request=request, obj=obj))

    @expose("/msg/")
    def msg(self):
        """Redirects to specified url while flash a message"""
        flash(Markup(request.args.get("msg")), "info")
        return redirect(request.args.get("url"))

appbuilder.add_view_no_menu(R)


class Superset(BaseSupersetView):
    """The base views for Superset!"""
    @api
    @has_access_api
    @expose("/update_role/", methods=['POST'])
    def update_role(self):
        """Assigns a list of found users to the given role."""
        data = request.get_json(force=True)
        gamma_role = sm.find_role('Gamma')

        username_set = set()
        user_data_dict = {}
        for user_data in data['users']:
            username = user_data['username']
            if not username:
                continue
            user_data_dict[username] = user_data
            username_set.add(username)

        existing_users = db.session.query(sm.user_model).filter(
            sm.user_model.username.in_(username_set)).all()
        missing_users = username_set.difference(
            set([u.username for u in existing_users]))
        logging.info('Missing users: {}'.format(missing_users))

        created_users = []
        for username in missing_users:
            user_data = user_data_dict[username]
            user = sm.find_user(email=user_data['email'])
            if not user:
                logging.info("Adding user: {}.".format(user_data))
                sm.add_user(
                    username=user_data['username'],
                    first_name=user_data['first_name'],
                    last_name=user_data['last_name'],
                    email=user_data['email'],
                    role=gamma_role,
                )
                sm.get_session.commit()
                user = sm.find_user(username=user_data['username'])
            existing_users.append(user)
            created_users.append(user.username)

        role_name = data['role_name']
        role = sm.find_role(role_name)
        role.user = existing_users
        sm.get_session.commit()
        return Response(json.dumps({
            'role': role_name,
            '# missing users': len(missing_users),
            '# granted': len(existing_users),
            'created_users': created_users,
        }), status=201)

    @has_access_api
    @expose("/override_role_permissions/", methods=['POST'])
    def override_role_permissions(self):
        """Updates the role with the give datasource permissions.

          Permissions not in the request will be revoked. This endpoint should
          be available to admins only. Expects JSON in the format:
           {
            'role_name': '{role_name}',
            'database': [{
                'datasource_type': '{table|druid}',
                'name': '{database_name}',
                'schema': [{
                    'name': '{schema_name}',
                    'datasources': ['{datasource name}, {datasource name}']
                }]
            }]
        }
        """
        data = request.get_json(force=True)
        role_name = data['role_name']
        databases = data['database']

        db_ds_names = set()
        for dbs in databases:
            for schema in dbs['schema']:
                for ds_name in schema['datasources']:
                    fullname = utils.get_datasource_full_name(
                        dbs['name'], ds_name, schema=schema['name'])
                    db_ds_names.add(fullname)

        existing_datasources = SourceRegistry.get_all_datasources(db.session)
        datasources = [
            d for d in existing_datasources if d.full_name in db_ds_names]
        role = sm.find_role(role_name)
        # remove all permissions
        role.permissions = []
        # grant permissions to the list of datasources
        granted_perms = []
        for datasource in datasources:
            view_menu_perm = sm.find_permission_view_menu(
                    view_menu_name=datasource.perm,
                    permission_name='datasource_access')
            # prevent creating empty permissions
            if view_menu_perm and view_menu_perm.view_menu:
                role.permissions.append(view_menu_perm)
                granted_perms.append(view_menu_perm.view_menu.name)
        db.session.commit()
        return Response(json.dumps({
            'granted': granted_perms,
            'requested': list(db_ds_names)
        }), status=201)

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
            'superset/request_access.html',
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
        datasource = SourceRegistry.get_datasource(
            datasource_type, datasource_id, session)

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
            viz_obj = viz.viz_types[viz_type](
                datasource, request.args if request.args else args)
            return viz_obj

    @has_access
    @expose("/slice/<slice_id>/")
    def slice(self, slice_id):
        viz_obj = self.get_viz(slice_id)
        return redirect(viz_obj.get_url(**request.args))

    @log_this
    @has_access_api
    @expose("/explore_json/<datasource_type>/<datasource_id>/")
    def explore_json(self, datasource_type, datasource_id):
        try:
            viz_obj = self.get_viz(
                datasource_type=datasource_type,
                datasource_id=datasource_id,
                args=request.args)
        except Exception as e:
            logging.exception(e)
            return json_error_response(utils.error_msg_from_exception(e))

        if not self.datasource_access(viz_obj.datasource):
            return Response(
                json.dumps(
                    {'error': DATASOURCE_ACCESS_ERR}),
                status=404,
                mimetype="application/json")

        payload = ""
        try:
            payload = viz_obj.get_json()
        except Exception as e:
            logging.exception(e)
            return json_error_response(utils.error_msg_from_exception(e))

        return Response(
            payload,
            status=200,
            mimetype="application/json")

    @expose("/import_dashboards", methods=['GET', 'POST'])
    @log_this
    def import_dashboards(self):
        """Overrides the dashboards using pickled instances from the file."""
        f = request.files.get('file')
        if request.method == 'POST' and f:
            current_tt = int(time.time())
            data = pickle.load(f)
            for table in data['datasources']:
                models.SqlaTable.import_obj(table, import_time=current_tt)
            for dashboard in data['dashboards']:
                models.Dashboard.import_obj(
                    dashboard, import_time=current_tt)
            db.session.commit()
            return redirect('/dashboardmodelview/list/')
        return self.render_template('superset/import_dashboards.html')

    @log_this
    @has_access
    @expose("/explore/<datasource_type>/<datasource_id>/")
    def explore(self, datasource_type, datasource_id):
        viz_type = request.args.get("viz_type")
        slice_id = request.args.get('slice_id')
        slc = None
        user_id = g.user.get_id() if g.user else None

        if slice_id:
            slc = db.session.query(models.Slice).filter_by(id=slice_id).first()

        error_redirect = '/slicemodelview/list/'
        datasource_class = SourceRegistry.sources[datasource_type]
        datasources = db.session.query(datasource_class).all()
        datasources = sorted(datasources, key=lambda ds: ds.full_name)

        try:
            viz_obj = self.get_viz(
                datasource_type=datasource_type,
                datasource_id=datasource_id,
                args=request.args)
        except Exception as e:
            flash('{}'.format(e), "alert")
            return redirect(error_redirect)

        if not viz_obj.datasource:
            flash(DATASOURCE_MISSING_ERR, "alert")
            return redirect(error_redirect)

        if not self.datasource_access(viz_obj.datasource):
            flash(
                __(get_datasource_access_error_msg(viz_obj.datasource.name)),
                "danger")
            return redirect(
                'superset/request_access/?'
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

        # find out if user is in explore v2 beta group
        # and set flag `is_in_explore_v2_beta`
        is_in_explore_v2_beta = sm.find_role('explore-v2-beta') in get_user_roles()

        # handle different endpoints
        if request.args.get("csv") == "true":
            payload = viz_obj.get_csv()
            return Response(
                payload,
                status=200,
                headers=generate_download_headers("csv"),
                mimetype="application/csv")
        elif request.args.get("standalone") == "true":
            return self.render_template("superset/standalone.html", viz=viz_obj, standalone_mode=True)
        elif request.args.get("V2") == "true" or is_in_explore_v2_beta:
            # bootstrap data for explore V2
            bootstrap_data = {
                "can_add": slice_add_perm,
                "can_download": slice_download_perm,
                "can_edit": slice_edit_perm,
                # TODO: separate endpoint for fetching datasources
                "datasources": [(d.id, d.full_name) for d in datasources],
                "datasource_id": datasource_id,
                "datasource_name": viz_obj.datasource.name,
                "datasource_type": datasource_type,
                "user_id": user_id,
                "viz": json.loads(viz_obj.json_data),
                "filter_select": viz_obj.datasource.filter_select_enabled
            }
            table_name = viz_obj.datasource.table_name \
                if datasource_type == 'table' \
                else viz_obj.datasource.datasource_name
            return self.render_template(
                "superset/explorev2.html",
                bootstrap_data=json.dumps(bootstrap_data),
                slice=slc,
                table_name=table_name)
        else:
            return self.render_template(
                "superset/explore.html",
                viz=viz_obj, slice=slc, datasources=datasources,
                can_add=slice_add_perm, can_edit=slice_edit_perm,
                can_download=slice_download_perm,
                userid=g.user.get_id() if g.user else ''
            )

    @api
    @has_access_api
    @expose("/filter/<datasource_type>/<datasource_id>/<column>/")
    def filter(self, datasource_type, datasource_id, column):
        """
        Endpoint to retrieve values for specified column.

        :param datasource_type: Type of datasource e.g. table
        :param datasource_id: Datasource id
        :param column: Column name to retrieve values for
        :return:
        """
        # TODO: Cache endpoint by user, datasource and column
        error_redirect = '/slicemodelview/list/'
        datasource_class = models.SqlaTable \
            if datasource_type == "table" else models.DruidDatasource

        datasource = db.session.query(
            datasource_class).filter_by(id=datasource_id).first()

        if not datasource:
            flash(DATASOURCE_MISSING_ERR, "alert")
            return json_error_response(DATASOURCE_MISSING_ERR)
        if not self.datasource_access(datasource):
            flash(get_datasource_access_error_msg(datasource.name), "danger")
            return json_error_response(DATASOURCE_ACCESS_ERR)

        viz_type = request.args.get("viz_type")
        if not viz_type and datasource.default_endpoint:
            return redirect(datasource.default_endpoint)
        if not viz_type:
            viz_type = "table"
        try:
            obj = viz.viz_types[viz_type](
                datasource,
                form_data=request.args,
                slice_=None)
        except Exception as e:
            flash(str(e), "danger")
            return redirect(error_redirect)
        status = 200
        payload = obj.get_values_for_column(column)
        return Response(
            payload,
            status=status,
            mimetype="application/json")

    def save_or_overwrite_slice(
            self, args, slc, slice_add_perm, slice_edit_perm):
        """Save or overwrite a slice"""
        slice_name = args.get('slice_name')
        action = args.get('action')

        # TODO use form processing form wtforms
        d = args.to_dict(flat=False)
        del d['action']
        if 'previous_viz_type' in d:
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
            if request.args.get('V2') == 'true':
                return dash.url
            return redirect(dash.url)
        else:
            if request.args.get('V2') == 'true':
                return slc.slice_url
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
    @expose("/all_tables/<db_id>")
    def all_tables(self, db_id):
        """Endpoint that returns all tables and views from the database"""
        database = (
            db.session
            .query(models.Database)
            .filter_by(id=db_id)
            .one()
        )
        all_tables = []
        all_views = []
        schemas = database.all_schema_names()
        for schema in schemas:
            all_tables.extend(database.all_table_names(schema=schema))
            all_views.extend(database.all_view_names(schema=schema))
        if not schemas:
            all_tables.extend(database.all_table_names())
            all_views.extend(database.all_view_names())

        return Response(
            json.dumps({"tables": all_tables, "views": all_views}),
            mimetype="application/json")

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
        tables = [t for t in database.all_table_names(schema) if
                  self.datasource_access_by_name(database, t, schema=schema)]
        views = [v for v in database.all_table_names(schema) if
                 self.datasource_access_by_name(database, v, schema=schema)]
        payload = {'tables': tables, 'views': views}
        return Response(
            json.dumps(payload), mimetype="application/json")

    @api
    @has_access_api
    @expose("/copy_dash/<dashboard_id>/", methods=['GET', 'POST'])
    def copy_dash(self, dashboard_id):
        """Copy dashboard"""
        session = db.session()
        data = json.loads(request.form.get('data'))
        dash = models.Dashboard()
        original_dash = (session
                         .query(models.Dashboard)
                         .filter_by(id=dashboard_id).first())

        dash.owners = [g.user] if g.user else []
        dash.dashboard_title = data['dashboard_title']
        dash.slices = original_dash.slices
        dash.params = original_dash.params

        self._set_dash_metadata(dash, data)
        session.add(dash)
        session.commit()
        dash_json = dash.json_data
        session.close()
        return Response(
            dash_json, mimetype="application/json")

    @api
    @has_access_api
    @expose("/save_dash/<dashboard_id>/", methods=['GET', 'POST'])
    def save_dash(self, dashboard_id):
        """Save a dashboard's metadata"""
        session = db.session()
        dash = (session
                .query(models.Dashboard)
                .filter_by(id=dashboard_id).first())
        check_ownership(dash, raise_if_false=True)
        data = json.loads(request.form.get('data'))
        self._set_dash_metadata(dash, data)
        session.merge(dash)
        session.commit()
        session.close()
        return "SUCCESS"

    @staticmethod
    def _set_dash_metadata(dashboard, data):
        positions = data['positions']
        slice_ids = [int(d['slice_id']) for d in positions]
        dashboard.slices = [o for o in dashboard.slices if o.id in slice_ids]
        positions = sorted(data['positions'], key=lambda x: int(x['slice_id']))
        dashboard.position_json = json.dumps(positions, indent=4, sort_keys=True)
        md = dashboard.params_dict
        dashboard.css = data['css']

        if 'filter_immune_slices' not in md:
            md['filter_immune_slices'] = []
        if 'filter_immune_slice_fields' not in md:
            md['filter_immune_slice_fields'] = {}
        md['expanded_slices'] = data['expanded_slices']
        dashboard.json_metadata = json.dumps(md, indent=4)

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
    @expose("/recent_activity/<user_id>/", methods=['GET'])
    def recent_activity(self, user_id):
        """Recent activity (actions) for a given user"""
        M = models  # noqa
        qry = (
            db.session.query(M.Log, M.Dashboard, M.Slice)
            .outerjoin(
                M.Dashboard,
                M.Dashboard.id == M.Log.dashboard_id
            )
            .outerjoin(
                M.Slice,
                M.Slice.id == M.Log.slice_id
            )
            .filter(
                sqla.and_(
                    ~M.Log.action.in_(('queries', 'shortner', 'sql_json')),
                    M.Log.user_id == user_id,
                )
            )
            .order_by(M.Log.dttm.desc())
            .limit(1000)
        )
        payload = []
        for log in qry.all():
            item_url = None
            item_title = None
            if log.Dashboard:
                item_url = log.Dashboard.url
                item_title = log.Dashboard.dashboard_title
            elif log.Slice:
                item_url = log.Slice.slice_url
                item_title = log.Slice.slice_name

            payload.append({
                'action': log.Log.action,
                'item_url': item_url,
                'item_title': item_title,
                'time': log.Log.dttm,
            })
        return Response(
            json.dumps(payload, default=utils.json_int_dttm_ser),
            mimetype="application/json")

    @api
    @has_access_api
    @expose("/fave_dashboards/<user_id>/", methods=['GET'])
    def fave_dashboards(self, user_id):
        qry = (
            db.session.query(
                models.Dashboard,
                models.FavStar.dttm,
            )
            .join(
                models.FavStar,
                sqla.and_(
                    models.FavStar.user_id == int(user_id),
                    models.FavStar.class_name == 'Dashboard',
                    models.Dashboard.id == models.FavStar.obj_id,
                )
            )
            .order_by(
                models.FavStar.dttm.desc()
            )
        )
        payload = []
        for o in qry.all():
            d = {
                'id': o.Dashboard.id,
                'dashboard': o.Dashboard.dashboard_link(),
                'title': o.Dashboard.dashboard_title,
                'url': o.Dashboard.url,
                'dttm': o.dttm,
            }
            if o.Dashboard.created_by:
                user = o.Dashboard.created_by
                d['creator'] = str(user)
                d['creator_url'] = '/superset/profile/{}/'.format(
                    user.username)
            payload.append(d)
        return Response(
            json.dumps(payload, default=utils.json_int_dttm_ser),
            mimetype="application/json")

    @api
    @has_access_api
    @expose("/created_dashboards/<user_id>/", methods=['GET'])
    def created_dashboards(self, user_id):
        Dash = models.Dashboard  # noqa
        qry = (
            db.session.query(
                Dash,
            )
            .filter(
                sqla.or_(
                    Dash.created_by_fk == user_id,
                    Dash.changed_by_fk == user_id,
                )
            )
            .order_by(
                Dash.changed_on.desc()
            )
        )
        payload = [{
            'id': o.id,
            'dashboard': o.dashboard_link(),
            'title': o.dashboard_title,
            'url': o.url,
            'dttm': o.changed_on,
        } for o in qry.all()]
        return Response(
            json.dumps(payload, default=utils.json_int_dttm_ser),
            mimetype="application/json")

    @api
    @has_access_api
    @expose("/created_slices/<user_id>/", methods=['GET'])
    def created_slices(self, user_id):
        """List of slices created by this user"""
        Slice = models.Slice  # noqa
        qry = (
            db.session.query(Slice)
            .filter(
                sqla.or_(
                    Slice.created_by_fk == user_id,
                    Slice.changed_by_fk == user_id,
                )
            )
            .order_by(Slice.changed_on.desc())
        )
        payload = [{
            'id': o.id,
            'title': o.slice_name,
            'url': o.slice_url,
            'dttm': o.changed_on,
        } for o in qry.all()]
        return Response(
            json.dumps(payload, default=utils.json_int_dttm_ser),
            mimetype="application/json")

    @api
    @has_access_api
    @expose("/fave_slices/<user_id>/", methods=['GET'])
    def fave_slices(self, user_id):
        """Favorite slices for a user"""
        qry = (
            db.session.query(
                models.Slice,
                models.FavStar.dttm,
            )
            .join(
                models.FavStar,
                sqla.and_(
                    models.FavStar.user_id == int(user_id),
                    models.FavStar.class_name == 'slice',
                    models.Slice.id == models.FavStar.obj_id,
                )
            )
            .order_by(
                models.FavStar.dttm.desc()
            )
        )
        payload = []
        for o in qry.all():
            d = {
                'id': o.Slice.id,
                'title': o.Slice.slice_name,
                'url': o.Slice.slice_url,
                'dttm': o.dttm,
            }
            if o.Slice.created_by:
                user = o.Slice.created_by
                d['creator'] = str(user)
                d['creator_url'] = '/superset/profile/{}/'.format(
                    user.username)
            payload.append(d)
        return Response(
            json.dumps(payload, default=utils.json_int_dttm_ser),
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
                return json_error_response(__(
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
        """Toggle favorite stars on Slices and Dashboard"""
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

        dash = qry.one()
        datasources = {slc.datasource for slc in dash.slices}
        for datasource in datasources:
            if not self.datasource_access(datasource):
                flash(
                    __(get_datasource_access_error_msg(datasource.name)),
                    "danger")
                return redirect(
                    'superset/request_access/?'
                    'dashboard_id={dash.id}&'
                    ''.format(**locals()))

        # Hack to log the dashboard_id properly, even when getting a slug
        @log_this
        def dashboard(**kwargs):  # noqa
            pass
        dashboard(dashboard_id=dash.id)
        dash_edit_perm = check_ownership(dash, raise_if_false=False)
        dash_save_perm = \
            dash_edit_perm and self.can_access('can_save_dash', 'Superset')
        standalone = request.args.get("standalone") == "true"
        context = dict(
            user_id=g.user.get_id(),
            dash_save_perm=dash_save_perm,
            dash_edit_perm=dash_edit_perm,
            standalone_mode=standalone,
        )
        return self.render_template(
            "superset/dashboard.html",
            dashboard=dash,
            context=json.dumps(context),
            standalone_mode=standalone,
        )

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
                if agg == 'count_distinct':
                    metrics.append(models.SqlMetric(
                        metric_name="{agg}__{column_name}".format(**locals()),
                        expression="COUNT(DISTINCT {column_name})"
                        .format(**locals()),
                    ))
                else:
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
            'since': '100 years ago',
            'limit': '0',
        }
        params = "&".join([k + '=' + v for k, v in params.items()])
        url = '/superset/explore/table/{table.id}/?{params}'.format(**locals())
        return redirect(url)

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
            primary_key = mydb.get_pk_constraint(table_name, schema)
            foreign_keys = mydb.get_foreign_keys(table_name, schema)
        except Exception as e:
            return Response(
                json.dumps({'error': utils.error_msg_from_exception(e)}),
                mimetype="application/json")
        keys = []
        if primary_key and primary_key.get('constrained_columns'):
            primary_key['column_names'] = primary_key.pop('constrained_columns')
            primary_key['type'] = 'pk'
            keys += [primary_key]
        for fk in foreign_keys:
            fk['column_names'] = fk.pop('constrained_columns')
            fk['type'] = 'fk'
        keys += foreign_keys
        for idx in indexes:
            idx['type'] = 'index'
        keys += indexes

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
                'keys': [
                    k for k in keys
                    if col['name'] in k.get('column_names')
                ],
            })
        tbl = {
            'name': table_name,
            'columns': cols,
            'selectStar': mydb.select_star(
                table_name, schema=schema, show_cols=True, indent=True),
            'primaryKey': primary_key,
            'foreignKeys': foreign_keys,
            'indexes': keys,
        }
        return Response(json.dumps(tbl), mimetype="application/json")

    @has_access
    @expose("/extra_table_metadata/<database_id>/<table_name>/<schema>/")
    @log_this
    def extra_table_metadata(self, database_id, table_name, schema):
        schema = None if schema in ('null', 'undefined') else schema
        mydb = db.session.query(models.Database).filter_by(id=database_id).one()
        payload = mydb.db_engine_spec.extra_table_metadata(
            mydb, table_name, schema)
        return Response(json.dumps(payload), mimetype="application/json")

    @has_access
    @expose("/select_star/<database_id>/<table_name>/")
    @log_this
    def select_star(self, database_id, table_name):
        mydb = db.session.query(
            models.Database).filter_by(id=database_id).first()
        quote = mydb.get_quoter()
        t = mydb.get_table(table_name)

        # Prevent exposing column fields to users that cannot access DB.
        if not self.datasource_access(t.perm):
            flash(get_datasource_access_error_msg(t.name), 'danger')
            return redirect("/tablemodelview/list/")

        fields = ", ".join(
            [quote(c.name) for c in t.columns] or "*")
        s = "SELECT\n{}\nFROM {}".format(fields, table_name)
        return self.render_template(
            "superset/ajah.html",
            content=s
        )

    @expose("/theme/")
    def theme(self):
        return self.render_template('superset/theme.html')

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
    @expose("/results/<key>/")
    @log_this
    def results(self, key):
        """Serves a key off of the results backend"""
        if not results_backend:
            return json_error_response("Results backend isn't configured")

        blob = results_backend.get(key)
        if blob:
            json_payload = zlib.decompress(blob)
            obj = json.loads(json_payload)
            db_id = obj['query']['dbId']
            session = db.session()
            mydb = session.query(models.Database).filter_by(id=db_id).one()

            if not self.database_access(mydb):
                return json_error_response(
                    get_database_access_error_msg(mydb.database_name))

            return Response(
                json_payload,
                status=200,
                mimetype="application/json")
        else:
            return Response(
                json.dumps({
                    'error': (
                        "Data could not be retrived. You may want to "
                        "re-run the query."
                    )
                }),
                status=410,
                mimetype="application/json")

    @has_access_api
    @expose("/sql_json/", methods=['POST', 'GET'])
    @log_this
    def sql_json(self):
        """Runs arbitrary sql and returns and json"""
        def table_accessible(database, full_table_name, schema_name=None):
            table_name_pieces = full_table_name.split(".")
            if len(table_name_pieces) == 2:
                table_schema = table_name_pieces[0]
                table_name = table_name_pieces[1]
            else:
                table_schema = schema_name
                table_name = table_name_pieces[0]
            return self.datasource_access_by_name(
                database, table_name, schema=table_schema)

        async = request.form.get('runAsync') == 'true'
        sql = request.form.get('sql')
        database_id = request.form.get('database_id')

        session = db.session()
        mydb = session.query(models.Database).filter_by(id=database_id).one()

        if not mydb:
            json_error_response(
                'Database with id {} is missing.'.format(database_id))

        superset_query = sql_parse.SupersetQuery(sql)
        schema = request.form.get('schema')
        schema = schema if schema else None

        rejected_tables = [
            t for t in superset_query.tables if not
            table_accessible(mydb, t, schema_name=schema)]
        if rejected_tables:
            return json_error_response(
                get_datasource_access_error_msg('{}'.format(rejected_tables)))
        session.commit()

        select_as_cta = request.form.get('select_as_cta') == 'true'
        tmp_table_name = request.form.get('tmp_table_name')
        if select_as_cta and mydb.force_ctas_schema:
            tmp_table_name = '{}.{}'.format(
                mydb.force_ctas_schema,
                tmp_table_name
            )

        query = models.Query(
            database_id=int(database_id),
            limit=int(app.config.get('SQL_MAX_ROW', None)),
            sql=sql,
            schema=schema,
            select_as_cta=request.form.get('select_as_cta') == 'true',
            start_time=utils.now_as_float(),
            tab_name=request.form.get('tab'),
            status=QueryStatus.PENDING if async else QueryStatus.RUNNING,
            sql_editor_id=request.form.get('sql_editor_id'),
            tmp_table_name=tmp_table_name,
            user_id=int(g.user.get_id()),
            client_id=request.form.get('client_id'),
        )
        session.add(query)
        session.commit()
        query_id = query.id

        # Async request.
        if async:
            # Ignore the celery future object and the request may time out.
            sql_lab.get_sql_results.delay(
                query_id, return_results=False,
                store_results=not query.select_as_cta)
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
        return Response(
            data,
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
        csv = df.to_csv(index=False, encoding='utf-8')
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

        datasources = db.session.query(datasource_class).all()
        datasources = sorted(datasources, key=lambda ds: ds.full_name)

        # Check if datasource exists
        if not datasource:
            return json_error_response(DATASOURCE_MISSING_ERR)
        # Check permission for datasource
        if not self.datasource_access(datasource):
            return json_error_response(DATASOURCE_ACCESS_ERR)

        gb_cols = [(col, col) for col in datasource.groupby_column_names]
        all_cols = [(c, c) for c in datasource.column_names]
        order_by_choices = []
        for s in sorted(datasource.column_names):
            order_by_choices.append((json.dumps([s, True]), s + ' [asc]'))
            order_by_choices.append((json.dumps([s, False]), s + ' [desc]'))

        field_options = {
            'datasource': [(d.id, d.full_name) for d in datasources],
            'metrics': datasource.metrics_combo,
            'order_by_cols': order_by_choices,
            'metric':  datasource.metrics_combo,
            'secondary_metric': datasource.metrics_combo,
            'groupby': gb_cols,
            'columns': gb_cols,
            'all_columns': all_cols,
            'all_columns_x': all_cols,
            'all_columns_y': all_cols,
            'timeseries_limit_metric': [('', '')] + datasource.metrics_combo,
            'series': gb_cols,
            'entity': gb_cols,
            'x': datasource.metrics_combo,
            'y': datasource.metrics_combo,
            'size': datasource.metrics_combo,
            'mapbox_label': all_cols,
            'point_radius': [(c, c) for c in (["Auto"] + datasource.column_names)],
            'filterable_cols': datasource.filterable_column_names,
        }

        if (datasource_type == 'table'):
            grains = datasource.database.grains()
            grain_choices = []
            if grains:
                grain_choices = [(grain.name, grain.name) for grain in grains]
            field_options['granularity_sqla'] = \
                [(c, c) for c in datasource.dttm_cols]
            field_options['time_grain_sqla'] = grain_choices

        return Response(
            json.dumps({'field_options': field_options}),
            mimetype="application/json"
        )

    @has_access
    @expose("/queries/<last_updated_ms>")
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
        search_user_id = request.args.get('user_id')
        database_id = request.args.get('database_id')
        search_text = request.args.get('search_text')
        status = request.args.get('status')
        # From and To time stamp should be Epoch timestamp in seconds
        from_time = request.args.get('from')
        to_time = request.args.get('to')

        if search_user_id:
            # Filter on db Id
            query = query.filter(models.Query.user_id == search_user_id)

        if database_id:
            # Filter on db Id
            query = query.filter(models.Query.database_id == database_id)

        if status:
            # Filter on status
            query = query.filter(models.Query.status == status)

        if search_text:
            # Filter on search text
            query = query \
                .filter(models.Query.sql.like('%{}%'.format(search_text)))

        if from_time:
            query = query.filter(models.Query.start_time > int(from_time))

        if to_time:
            query = query.filter(models.Query.start_time < int(to_time))

        query_limit = config.get('QUERY_SEARCH_LIMIT', 1000)
        sql_queries = (
            query.order_by(models.Query.start_time.asc())
            .limit(query_limit)
            .all()
        )

        dict_queries = [q.to_dict() for q in sql_queries]

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
        return render_template(
            'superset/traceback.html',
            error_msg=get_error_msg(),
        ), 500

    @expose("/welcome")
    def welcome(self):
        """Personalized welcome page"""
        if not g.user or not g.user.get_id():
            return redirect(appbuilder.get_url_for_login)
        return self.render_template('superset/welcome.html', utils=utils)

    @has_access
    @expose("/profile/<username>/")
    def profile(self, username):
        """User profile page"""
        user = (
            db.session.query(ab_models.User)
            .filter_by(username=username)
            .one()
        )
        roles = {}
        from collections import defaultdict
        permissions = defaultdict(set)
        for role in user.roles:
            perms = set()
            for perm in role.permissions:
                perms.add(
                    (perm.permission.name, perm.view_menu.name)
                )
                if perm.permission.name in ('datasource_access', 'database_access'):
                    permissions[perm.permission.name].add(perm.view_menu.name)
            roles[role.name] = [
                [perm.permission.name, perm.view_menu.name]
                for perm in role.permissions
            ]
        payload = {
            'user': {
                'username': user.username,
                'firstName': user.first_name,
                'lastName': user.last_name,
                'userId': user.id,
                'isActive': user.is_active(),
                'createdOn': user.created_on.isoformat(),
                'email': user.email,
                'roles': roles,
                'permissions': permissions,
            }
        }
        return self.render_template(
            'superset/profile.html',
            title=user.username + "'s profile",
            navbar_container=True,
            bootstrap_data=json.dumps(payload, default=utils.json_iso_dttm_ser)
        )

    @has_access
    @expose("/sqllab")
    def sqllab(self):
        """SQL Editor"""
        d = {
            'defaultDbId': config.get('SQLLAB_DEFAULT_DBID'),
        }
        return self.render_template(
            'superset/sqllab.html',
            bootstrap_data=json.dumps(d, default=utils.json_iso_dttm_ser)
        )
appbuilder.add_view_no_menu(Superset)

if config['DRUID_IS_ACTIVE']:
    appbuilder.add_link(
        "Refresh Druid Metadata",
        label=__("Refresh Druid Metadata"),
        href='/superset/refresh_datasources/',
        category='Sources',
        category_label=__("Sources"),
        category_icon='fa-database',
        icon="fa-cog")


class CssTemplateModelView(SupersetModelView, DeleteMixin):
    datamodel = SQLAInterface(models.CssTemplate)
    list_columns = ['template_name']
    edit_columns = ['template_name', 'css']
    add_columns = edit_columns


class CssTemplateAsyncModelView(CssTemplateModelView):
    list_columns = ['template_name', 'css']

appbuilder.add_separator("Sources")
appbuilder.add_view(
    CssTemplateModelView,
    "CSS Templates",
    label=__("CSS Templates"),
    icon="fa-css3",
    category="Manage",
    category_label=__("Manage"),
    category_icon='')

appbuilder.add_view_no_menu(CssTemplateAsyncModelView)

appbuilder.add_link(
    'SQL Editor',
    href='/superset/sqllab',
    category_icon="fa-flask",
    icon="fa-flask",
    category='SQL Lab')
appbuilder.add_link(
    'Query Search',
    href='/superset/sqllab#search',
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
    return redirect(request.full_path.replace('panoramix', 'superset'))


@app.route('/<regex("caravel\/.*"):url>')
def caravel(url):  # noqa
    return redirect(request.full_path.replace('caravel', 'superset'))


# ---------------------------------------------------------------------
