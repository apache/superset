# pylint: disable=C,R,W
"""A set of constants and methods to manage permissions and security"""
import logging

from flask import g
from flask_appbuilder.security.sqla import models as ab_models
from flask_appbuilder.security.sqla.manager import SecurityManager
from sqlalchemy import or_

from superset import sql_parse
from superset.connectors.connector_registry import ConnectorRegistry

READ_ONLY_MODEL_VIEWS = {
    'DatabaseAsync',
    'DatabaseView',
    'DruidClusterModelView',
}

GAMMA_READ_ONLY_MODEL_VIEWS = {
    'SqlMetricInlineView',
    'TableColumnInlineView',
    'TableModelView',
    'DruidColumnInlineView',
    'DruidDatasourceModelView',
    'DruidMetricInlineView',
} | READ_ONLY_MODEL_VIEWS

ADMIN_ONLY_VIEW_MENUS = {
    'AccessRequestsModelView',
    'Manage',
    'SQL Lab',
    'Queries',
    'Refresh Druid Metadata',
    'ResetPasswordView',
    'RoleModelView',
    'Security',
    'UserDBModelView',
    'UserLDAPModelView',
    'UserOAuthModelView',
    'UserOIDModelView',
    'UserRemoteUserModelView',
}

ALPHA_ONLY_VIEW_MENUS = {
    'Upload a CSV',
}

ADMIN_ONLY_PERMISSIONS = {
    'all_database_access',
    'can_sql_json',  # TODO: move can_sql_json to sql_lab role
    'can_override_role_permissions',
    'can_sync_druid_source',
    'can_override_role_permissions',
    'can_approve',
    'can_update_role',
}

READ_ONLY_PERMISSION = {
    'can_show',
    'can_list',
}

ALPHA_ONLY_PERMISSIONS = set([
    'muldelete',
    'all_datasource_access',
])

OBJECT_SPEC_PERMISSIONS = set([
    'database_access',
    'schema_access',
    'datasource_access',
    'metric_access',
])


class SupersetSecurityManager(SecurityManager):

    def get_schema_perm(self, database, schema):
        if schema:
            return '[{}].[{}]'.format(database, schema)

    def can_access(self, permission_name, view_name, user=None):
        """Protecting from has_access failing from missing perms/view"""
        if not user:
            user = g.user
        if user.is_anonymous:
            return self.is_item_public(permission_name, view_name)
        return self._has_view_access(user, permission_name, view_name)

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

    def get_datasource_access_error_msg(self, datasource):
        return """This endpoint requires the datasource {}, database or
            `all_datasource_access` permission""".format(datasource.name)

    def get_datasource_access_link(self, datasource):
        from superset import conf
        return conf.get('PERMISSION_INSTRUCTIONS_LINK')

    def get_table_access_error_msg(self, table_name):
        return """You need access to the following tables: {}, all database access or
              `all_datasource_access` permission""".format(table_name)

    def get_table_access_link(self, tables):
        from superset import conf
        return conf.get('PERMISSION_INSTRUCTIONS_LINK')

    def datasource_access_by_name(
            self, database, datasource_name, schema=None):
        from superset import db

        if self.database_access(database) or self.all_datasource_access():
            return True

        schema_perm = self.get_schema_perm(database, schema)
        if schema and self.can_access('schema_access', schema_perm):
            return True

        datasources = ConnectorRegistry.query_datasources_by_name(
            db.session, database, datasource_name, schema=schema)
        for datasource in datasources:
            if self.can_access('datasource_access', datasource.perm):
                return True
        return False

    def get_schema_and_table(self, table_in_query, schema):
        table_name_pieces = table_in_query.split('.')
        if len(table_name_pieces) == 2:
            table_schema = table_name_pieces[0]
            table_name = table_name_pieces[1]
        else:
            table_schema = schema
            table_name = table_name_pieces[0]
        return (table_schema, table_name)

    def datasource_access_by_fullname(
            self, database, table_in_query, schema):
        table_schema, table_name = self.get_schema_and_table(table_in_query, schema)
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

    def schemas_accessible_by_user(self, database, schemas, hierarchical=True):
        from superset import db
        from superset.connectors.sqla.models import SqlaTable
        if (hierarchical and
                (self.database_access(database) or
                 self.all_datasource_access())):
            return schemas

        subset = set()
        for schema in schemas:
            schema_perm = self.get_schema_perm(database, schema)
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
        from superset import db
        if self.database_access(database) or self.all_datasource_access():
            return datasource_names

        if schema:
            schema_perm = self.get_schema_perm(database, schema)
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

    def merge_perm(self, permission_name, view_menu_name):
        # Implementation copied from sm.find_permission_view_menu.
        # TODO: use sm.find_permission_view_menu once issue
        #       https://github.com/airbnb/superset/issues/1944 is resolved.
        permission = self.find_permission(permission_name)
        view_menu = self.find_view_menu(view_menu_name)
        pv = None
        if permission and view_menu:
            pv = self.get_session.query(self.permissionview_model).filter_by(
                permission=permission, view_menu=view_menu).first()
        if not pv and permission_name and view_menu_name:
            self.add_permission_view_menu(permission_name, view_menu_name)

    def is_user_defined_permission(self, perm):
        return perm.permission.name in OBJECT_SPEC_PERMISSIONS

    def create_custom_permissions(self):
        # Global perms
        self.merge_perm('all_datasource_access', 'all_datasource_access')
        self.merge_perm('all_database_access', 'all_database_access')

    def create_missing_perms(self):
        """Creates missing perms for datasources, schemas and metrics"""
        from superset import db
        from superset.models import core as models

        logging.info(
            'Fetching a set of all perms to lookup which ones are missing')
        all_pvs = set()
        for pv in self.get_session.query(self.permissionview_model).all():
            if pv.permission and pv.view_menu:
                all_pvs.add((pv.permission.name, pv.view_menu.name))

        def merge_pv(view_menu, perm):
            """Create permission view menu only if it doesn't exist"""
            if view_menu and perm and (view_menu, perm) not in all_pvs:
                self.merge_perm(view_menu, perm)

        logging.info('Creating missing datasource permissions.')
        datasources = ConnectorRegistry.get_all_datasources(db.session)
        for datasource in datasources:
            merge_pv('datasource_access', datasource.get_perm())
            merge_pv('schema_access', datasource.schema_perm)

        logging.info('Creating missing database permissions.')
        databases = db.session.query(models.Database).all()
        for database in databases:
            merge_pv('database_access', database.perm)

        logging.info('Creating missing metrics permissions')
        metrics = []
        for datasource_class in ConnectorRegistry.sources.values():
            metrics += list(db.session.query(datasource_class.metric_class).all())

        for metric in metrics:
            if metric.is_restricted:
                merge_pv('metric_access', metric.perm)

    def clean_perms(self):
        """FAB leaves faulty permissions that need to be cleaned up"""
        logging.info('Cleaning faulty perms')
        sesh = self.get_session
        pvms = (
            sesh.query(ab_models.PermissionView)
            .filter(or_(
                ab_models.PermissionView.permission == None,  # NOQA
                ab_models.PermissionView.view_menu == None,  # NOQA
            ))
        )
        deleted_count = pvms.delete()
        sesh.commit()
        if deleted_count:
            logging.info('Deleted {} faulty permissions'.format(deleted_count))

    def sync_role_definitions(self):
        """Inits the Superset application with security roles and such"""
        from superset import conf
        logging.info('Syncing role definition')

        self.create_custom_permissions()

        # Creating default roles
        self.set_role('Admin', self.is_admin_pvm)
        self.set_role('Alpha', self.is_alpha_pvm)
        self.set_role('Gamma', self.is_gamma_pvm)
        self.set_role('granter', self.is_granter_pvm)
        self.set_role('sql_lab', self.is_sql_lab_pvm)

        if conf.get('PUBLIC_ROLE_LIKE_GAMMA', False):
            self.set_role('Public', self.is_gamma_pvm)

        self.create_missing_perms()

        # commit role and view menu updates
        self.get_session.commit()
        self.clean_perms()

    def set_role(self, role_name, pvm_check):
        logging.info('Syncing {} perms'.format(role_name))
        sesh = self.get_session
        pvms = sesh.query(ab_models.PermissionView).all()
        pvms = [p for p in pvms if p.permission and p.view_menu]
        role = self.add_role(role_name)
        role_pvms = [p for p in pvms if pvm_check(p)]
        role.permissions = role_pvms
        sesh.merge(role)
        sesh.commit()

    def is_admin_only(self, pvm):
        # not readonly operations on read only model views allowed only for admins
        if (pvm.view_menu.name in READ_ONLY_MODEL_VIEWS and
                pvm.permission.name not in READ_ONLY_PERMISSION):
            return True
        return (
            pvm.view_menu.name in ADMIN_ONLY_VIEW_MENUS or
            pvm.permission.name in ADMIN_ONLY_PERMISSIONS
        )

    def is_alpha_only(self, pvm):
        if (pvm.view_menu.name in GAMMA_READ_ONLY_MODEL_VIEWS and
                pvm.permission.name not in READ_ONLY_PERMISSION):
            return True
        return (
            pvm.view_menu.name in ALPHA_ONLY_VIEW_MENUS or
            pvm.permission.name in ALPHA_ONLY_PERMISSIONS
        )

    def is_admin_pvm(self, pvm):
        return not self.is_user_defined_permission(pvm)

    def is_alpha_pvm(self, pvm):
        return not (self.is_user_defined_permission(pvm) or self.is_admin_only(pvm))

    def is_gamma_pvm(self, pvm):
        return not (self.is_user_defined_permission(pvm) or self.is_admin_only(pvm) or
                    self.is_alpha_only(pvm))

    def is_sql_lab_pvm(self, pvm):
        return (
            pvm.view_menu.name in {
                'SQL Lab', 'SQL Editor', 'Query Search', 'Saved Queries',
            } or
            pvm.permission.name in {
                'can_sql_json', 'can_csv', 'can_search_queries', 'can_sqllab_viz',
                'can_sqllab',
            } or
            (pvm.view_menu.name == 'UserDBModelView' and
             pvm.permission.name == 'can_list'))

    def is_granter_pvm(self, pvm):
        return pvm.permission.name in {
            'can_override_role_permissions', 'can_approve',
        }

    def set_perm(self, mapper, connection, target):  # noqa
        if target.perm != target.get_perm():
            link_table = target.__table__
            connection.execute(
                link_table.update()
                .where(link_table.c.id == target.id)
                .values(perm=target.get_perm()),
            )

        # add to view menu if not already exists
        permission_name = 'datasource_access'
        view_menu_name = target.get_perm()
        permission = self.find_permission(permission_name)
        view_menu = self.find_view_menu(view_menu_name)
        pv = None

        if not permission:
            permission_table = self.permission_model.__table__  # noqa: E501 pylint: disable=no-member
            connection.execute(
                permission_table.insert()
                .values(name=permission_name),
            )
            permission = self.find_permission(permission_name)
        if not view_menu:
            view_menu_table = self.viewmenu_model.__table__  # pylint: disable=no-member
            connection.execute(
                view_menu_table.insert()
                .values(name=view_menu_name),
            )
            view_menu = self.find_view_menu(view_menu_name)

        if permission and view_menu:
            pv = self.get_session.query(self.permissionview_model).filter_by(
                permission=permission, view_menu=view_menu).first()
        if not pv and permission and view_menu:
            permission_view_table = self.permissionview_model.__table__  # noqa: E501 pylint: disable=no-member
            connection.execute(
                permission_view_table.insert()
                .values(
                    permission_id=permission.id,
                    view_menu_id=view_menu.id,
                ),
            )
