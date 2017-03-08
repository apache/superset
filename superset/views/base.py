import logging
import json

from flask import g, redirect
from flask_babel import gettext as __

from flask_appbuilder import BaseView
from flask_appbuilder import ModelView
from flask_appbuilder.widgets import ListWidget
from flask_appbuilder.actions import action
from flask_appbuilder.models.sqla.filters import BaseFilter
from flask_appbuilder.security.sqla import models as ab_models

from superset import appbuilder, conf, db, utils, sm, sql_parse
from superset.connectors.connector_registry import ConnectorRegistry


def get_datasource_exist_error_mgs(full_name):
    return __("Datasource %(name)s already exists", name=full_name)


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
            "all_datasource_access", "all_datasource_access", user=user)

    def database_access(self, database, user=None):
        return (
            self.can_access(
                "all_database_access", "all_database_access", user=user) or
            self.can_access("database_access", database.perm, user=user)
        )

    def schema_access(self, datasource, user=None):
        return (
            self.database_access(datasource.database, user=user) or
            self.all_datasource_access(user=user) or
            self.can_access("schema_access", datasource.schema_perm, user=user)
        )

    def datasource_access(self, datasource, user=None):
        return (
            self.schema_access(datasource, user=user) or
            self.can_access("datasource_access", datasource.perm, user=user)
        )

    def datasource_access_by_name(
            self, database, datasource_name, schema=None):
        if self.database_access(database) or self.all_datasource_access():
            return True

        schema_perm = utils.get_schema_perm(database, schema)
        if schema and utils.can_access(
                sm, 'schema_access', schema_perm, g.user):
            return True

        datasources = ConnectorRegistry.query_datasources_by_name(
            db.session, database, datasource_name, schema=schema)
        for datasource in datasources:
            if self.can_access("datasource_access", datasource.perm):
                return True
        return False

    def datasource_access_by_fullname(
            self, database, full_table_name, schema):
        table_name_pieces = full_table_name.split(".")
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

    def accessible_by_user(self, database, datasource_names, schema=None):
        if self.database_access(database) or self.all_datasource_access():
            return datasource_names

        schema_perm = utils.get_schema_perm(database, schema)
        if schema and utils.can_access(
                sm, 'schema_access', schema_perm, g.user):
            return datasource_names

        role_ids = set([role.id for role in g.user.roles])
        # TODO: cache user_perms or user_datasources
        user_pvms = (
            db.session.query(ab_models.PermissionView)
            .join(ab_models.Permission)
            .filter(ab_models.Permission.name == 'datasource_access')
            .filter(ab_models.PermissionView.role.any(
                ab_models.Role.id.in_(role_ids)))
            .all()
        )
        user_perms = set([pvm.view_menu.name for pvm in user_pvms])
        user_datasources = ConnectorRegistry.query_datasources_by_permissions(
            db.session, database, user_perms)
        full_names = set([d.full_name for d in user_datasources])
        return [d for d in datasource_names if d in full_names]


class SupersetModelView(ModelView):
    page_size = 500


class ListWidgetWithCheckboxes(ListWidget):
    """An alternative to list view that renders Boolean fields as checkboxes

    Works in conjunction with the `checkbox` view."""
    template = 'superset/fab_overrides/list_with_checkboxes.html'


def validate_json(form, field):  # noqa
    try:
        json.loads(field.data)
    except Exception as e:
        logging.exception(e)
        raise Exception("json isn't valid")


class DeleteMixin(object):
    @action(
        "muldelete", "Delete", "Delete all Really?", "fa-trash", single=False)
    def muldelete(self, items):
        self.datamodel.delete_all(items)
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
