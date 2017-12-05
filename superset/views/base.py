from datetime import datetime
import functools
import json
import logging
import traceback

from flask import abort, flash, g, get_flashed_messages, redirect, Response
from flask_appbuilder import BaseView, ModelView
from flask_appbuilder.actions import action
from flask_appbuilder.models.sqla.filters import BaseFilter
from flask_appbuilder.widgets import ListWidget
from flask_babel import get_locale
from flask_babel import gettext as __
from flask_babel import lazy_gettext as _
import yaml

from superset import appbuilder, conf, db, sm, sql_parse, utils
from superset.connectors.connector_registry import ConnectorRegistry
from superset.connectors.sqla.models import SqlaTable
from superset.translations.utils import get_language_pack

FRONTEND_CONF_KEYS = ('SUPERSET_WEBSERVER_TIMEOUT',)


def get_error_msg():
    if conf.get('SHOW_STACKTRACE'):
        error_msg = traceback.format_exc()
    else:
        error_msg = 'FATAL ERROR \n'
        error_msg += (
            'Stacktrace is hidden. Change the SHOW_STACKTRACE '
            'configuration setting to enable it')
    return error_msg


def json_error_response(msg=None, status=500, stacktrace=None, payload=None):
    if not payload:
        payload = {'error': str(msg)}
        if stacktrace:
            payload['stacktrace'] = stacktrace
    return Response(
        json.dumps(payload, default=utils.json_iso_dttm_ser),
        status=status, mimetype='application/json')


def generate_download_headers(extension, filename=None):
    filename = filename if filename else datetime.now().strftime('%Y%m%d_%H%M%S')
    content_disp = 'attachment; filename={}.{}'.format(filename, extension)
    headers = {
        'Content-Disposition': content_disp,
    }
    return headers


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
            return json_error_response(get_error_msg())

    return functools.update_wrapper(wraps, f)


def get_datasource_exist_error_mgs(full_name):
    return __('Datasource %(name)s already exists', name=full_name)


def get_user_roles():
    if g.user.is_anonymous():
        public_role = conf.get('AUTH_ROLE_PUBLIC')
        return [appbuilder.sm.find_role(public_role)] if public_role else []
    return g.user.roles


class BaseSupersetView(BaseView):
    def can_access(self, permission_name, view_name, user=None):
        if not user:
            user = g.user
        return utils.can_access(
            appbuilder.sm, permission_name, view_name, user)

    def all_datasource_access(self, user=None):
        return self.can_access(
            'all_datasource_access', 'all_datasource_access', user=user)

    def database_access(self, database, user=None):
        return (
            self.can_access(
                'all_database_access', 'all_database_access', user=user) or
            self.can_access('database_access', database.perm, user=user)
        )

    def schema_access(self, datasource, user=None):
        return (
            self.database_access(datasource.database, user=user) or
            self.all_datasource_access(user=user) or
            self.can_access('schema_access', datasource.schema_perm, user=user)
        )

    def datasource_access(self, datasource, user=None):
        return (
            self.schema_access(datasource, user=user) or
            self.can_access('datasource_access', datasource.perm, user=user)
        )

    def datasource_access_by_name(
            self, database, datasource_name, schema=None):
        if self.database_access(database) or self.all_datasource_access():
            return True

        schema_perm = utils.get_schema_perm(database, schema)
        if schema and self.can_access('schema_access', schema_perm):
            return True

        datasources = ConnectorRegistry.query_datasources_by_name(
            db.session, database, datasource_name, schema=schema)
        for datasource in datasources:
            if self.can_access('datasource_access', datasource.perm):
                return True
        return False

    def datasource_access_by_fullname(
            self, database, full_table_name, schema):
        table_name_pieces = full_table_name.split('.')
        if len(table_name_pieces) == 2:
            table_schema = table_name_pieces[0]
            table_name = table_name_pieces[1]
        else:
            table_schema = schema
            table_name = table_name_pieces[0]
        return self.datasource_access_by_name(
            database, table_name, schema=table_schema)

    def rejected_datasources(self, sql, database, schema):
        superset_query = sql_parse.SupersetQuery(sql)
        return [
            t for t in superset_query.tables if not
            self.datasource_access_by_fullname(database, t, schema)]

    def user_datasource_perms(self):
        datasource_perms = set()
        for r in g.user.roles:
            for perm in r.permissions:
                if (
                        perm.permission and
                        'datasource_access' == perm.permission.name):
                    datasource_perms.add(perm.view_menu.name)
        return datasource_perms

    def schemas_accessible_by_user(self, database, schemas):
        if self.database_access(database) or self.all_datasource_access():
            return schemas

        subset = set()
        for schema in schemas:
            schema_perm = utils.get_schema_perm(database, schema)
            if self.can_access('schema_access', schema_perm):
                subset.add(schema)

        perms = self.user_datasource_perms()
        if perms:
            tables = (
                db.session.query(SqlaTable)
                .filter(
                    SqlaTable.perm.in_(perms),
                    SqlaTable.database_id == database.id,
                )
                .all()
            )
            for t in tables:
                if t.schema:
                    subset.add(t.schema)
        return sorted(list(subset))

    def accessible_by_user(self, database, datasource_names, schema=None):
        if self.database_access(database) or self.all_datasource_access():
            return datasource_names

        if schema:
            schema_perm = utils.get_schema_perm(database, schema)
            if self.can_access('schema_access', schema_perm):
                return datasource_names

        user_perms = self.user_datasource_perms()
        user_datasources = ConnectorRegistry.query_datasources_by_permissions(
            db.session, database, user_perms)
        if schema:
            names = {
                d.table_name
                for d in user_datasources if d.schema == schema}
            return [d for d in datasource_names if d in names]
        else:
            full_names = {d.full_name for d in user_datasources}
            return [d for d in datasource_names if d in full_names]

    def common_bootsrap_payload(self):
        """Common data always sent to the client"""
        messages = get_flashed_messages(with_categories=True)
        locale = str(get_locale())
        return {
            'flash_messages': messages,
            'conf': {k: conf.get(k) for k in FRONTEND_CONF_KEYS},
            'locale': locale,
            'language_pack': get_language_pack(locale),
        }


class SupersetModelView(ModelView):
    page_size = 100


class ListWidgetWithCheckboxes(ListWidget):
    """An alternative to list view that renders Boolean fields as checkboxes

    Works in conjunction with the `checkbox` view."""
    template = 'superset/fab_overrides/list_with_checkboxes.html'


def validate_json(form, field):  # noqa
    try:
        json.loads(field.data)
    except Exception as e:
        logging.exception(e)
        raise Exception(_("json isn't valid"))


class YamlExportMixin(object):
    @action('yaml_export', __('Export to YAML'), __('Export to YAML?'), 'fa-download')
    def yaml_export(self, items):
        if not isinstance(items, list):
            items = [items]

        data = [t.export_to_dict() for t in items]
        return Response(
            yaml.safe_dump(data),
            headers=generate_download_headers('yaml'),
            mimetype='application/text')


class DeleteMixin(object):
    def _delete(self, pk):
        """
            Delete function logic, override to implement diferent logic
            deletes the record with primary_key = pk

            :param pk:
                record primary key to delete
        """
        item = self.datamodel.get(pk, self._base_filters)
        if not item:
            abort(404)
        try:
            self.pre_delete(item)
        except Exception as e:
            flash(str(e), 'danger')
        else:
            view_menu = sm.find_view_menu(item.get_perm())
            pvs = sm.get_session.query(sm.permissionview_model).filter_by(
                view_menu=view_menu).all()

            schema_view_menu = None
            if hasattr(item, 'schema_perm'):
                schema_view_menu = sm.find_view_menu(item.schema_perm)

                pvs.extend(sm.get_session.query(
                    sm.permissionview_model).filter_by(
                    view_menu=schema_view_menu).all())

            if self.datamodel.delete(item):
                self.post_delete(item)

                for pv in pvs:
                    sm.get_session.delete(pv)

                if view_menu:
                    sm.get_session.delete(view_menu)

                if schema_view_menu:
                    sm.get_session.delete(schema_view_menu)

                sm.get_session.commit()

            flash(*self.datamodel.message)
            self.update_redirect()

    @action(
        'muldelete',
        __('Delete'),
        __('Delete all Really?'),
        'fa-trash',
        single=False,
    )
    def muldelete(self, items):
        if not items:
            abort(404)
        for item in items:
            try:
                self.pre_delete(item)
            except Exception as e:
                flash(str(e), 'danger')
            else:
                self._delete(item.id)
        self.update_redirect()
        return redirect(self.get_redirect())


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
        for role in self.get_user_roles():
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


class CsvResponse(Response):
    """
    Override Response to take into account csv encoding from config.py
    """
    charset = conf.get('CSV_EXPORT').get('encoding', 'utf-8')
