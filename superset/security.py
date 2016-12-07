from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from itertools import product
import logging
from flask_appbuilder.security.sqla import models as ab_models

from superset import conf, db, models, sm


READ_ONLY_MODELVIEWS = {
    'DatabaseAsync',
    'DatabaseView',
    'DruidClusterModelView',
}

GAMMA_READ_ONLY_MODELVIEWS = {
    'ColumnInlineView',
    'SqlMetricInlineView',
    'TableColumnInlineView',
    'TableModelView',
    'DatasourceModelView',
    'DruidColumnInlineView',
    'MetricInlineView',
    'DruidDatasourceModelView',
    'DruidMetricInlineView',
} | READ_ONLY_MODELVIEWS

ADMIN_ONLY_VIEW_MENUES = {
    'AccessRequestsModelView',
    'Manage',
    'SQL Lab',
    'Queries',
    'Refresh Druid Metadata',
    'ResetPasswordView',
    'RoleModelView',
    'Security',
    'UserDBModelView',
} | READ_ONLY_MODELVIEWS

ADMIN_ONLY_PERMISSIONS = {
    'all_database_access',
    'datasource_access',
    'schema_access',
    'database_access',
    'can_sql_json',
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
    'datasource_access',
    'schema_access',
    'database_access',
    'muldelete',
    'all_datasource_access',
])
READ_ONLY_PRODUCT = set(
    product(READ_ONLY_PERMISSION, READ_ONLY_MODELVIEWS))

GAMMA_READ_ONLY_PRODUCT = set(
    product(READ_ONLY_PERMISSION, GAMMA_READ_ONLY_MODELVIEWS))


OBJECT_SPEC_PERMISSIONS = set([
    'database_access',
    'schema_access',
    'datasource_access',
    'metric_access',
])


def merge_perm(sm, permission_name, view_menu_name):
    pv = sm.find_permission_view_menu(permission_name, view_menu_name)
    if not pv:
        sm.add_permission_view_menu(permission_name, view_menu_name)


def is_user_defined_permission(perm):
    return perm.permission.name in OBJECT_SPEC_PERMISSIONS


def get_or_create_main_db():
    logging.info("Creating database reference")
    dbobj = (
        db.session.query(models.Database)
            .filter_by(database_name='main')
            .first()
    )
    if not dbobj:
        dbobj = models.Database(database_name="main")
    logging.info(conf.get("SQLALCHEMY_DATABASE_URI"))
    dbobj.set_sqlalchemy_uri(conf.get("SQLALCHEMY_DATABASE_URI"))
    dbobj.expose_in_sqllab = True
    dbobj.allow_run_sync = True
    db.session.add(dbobj)
    db.session.commit()
    return dbobj


def is_admin_pvm(pvm):
    return not is_user_defined_permission(pvm)


def is_alpha_pvm(pvm):
    if is_user_defined_permission(pvm):
        return False
    if ((pvm.view_menu.name not in ADMIN_ONLY_VIEW_MENUES and
                 pvm.permission.name not in ADMIN_ONLY_PERMISSIONS) or
                (p.permission.name, p.view_menu.name) in READ_ONLY_PRODUCT):
        return True
    return False


def is_gamma_pvm(pvm):
    if ((pvm.view_menu.name not in ADMIN_ONLY_VIEW_MENUES and
                 pvm.view_menu.name not in GAMMA_READ_ONLY_MODELVIEWS and
                 pvm.permission.name not in ADMIN_ONLY_PERMISSIONS and
                 pvm.permission.name not in ALPHA_ONLY_PERMISSIONS) or
                (pvm.permission.name, pvm.view_menu.name) in
                GAMMA_READ_ONLY_PRODUCT):
        return True
    return False


def is_sql_lab_pvm(pvm):
    return pvm.view_menu.name in {'SQL Lab'} or pvm.permission.name in {
        'can_sql_json', 'can_csv', 'can_search_queries'}):


def is_granter_pvm(pvm):
    return pvm.permission.name in {'can_override_role_permissions',
                                   'can_aprove'}


def set_role(role_name, pvms, pvm_check):
    logging.info("Syncing {} perms".format(role_name))
    role = sm.add_role(role_name)
    role_pvms = [p for p in pvms if pvm_check(p)]
    role.permissions = role_pvms

def create_custom_permissions():
    # Global perms
    merge_perm(sm, 'all_datasource_access', 'all_datasource_access')
    merge_perm(sm, 'all_database_access', 'all_database_access')

def create_missing_datasource_perms(view_menu_set):
    logging.info("Creating missing datasource permissions.")
    datasources = db.session.query(models.SqlaTable).all()
    datasources.extend(db.session.query(models.DruidDatasource).all())
    for datasource in datasources:
        if datasource.perm in view_menu_set:
            continue
        merge_perm(sm, 'datasource_access', datasource.get_perm())
        if datasource.schema:
            merge_perm(sm, 'schema_access', datasource.schema_perm)

def create_missing_database_perms(view_menu_set):
    logging.info("Creating missing database permissions.")
    databases = db.session.query(models.Database).all()
    for database in databases:
        if database.perm in view_menu_set:
            continue
        merge_perm(sm, 'database_access', database.perm)
    db.session.commit()

def sync_role_definitions():
    """Inits the Superset application with security roles and such"""
    logging.info("Syncing role definition")

    get_or_create_main_db()
    create_custom_permissions()

    pvms = db.session.query(ab_models.PermissionView).all()
    pvms = [p for p in pvms if p.permission and p.view_menu]

    # cleanup
    pvms_to_delete = [p for p in pvms if not (p.permission and p.view_menu)]
    sm.get_session.delete(pvms_to_delete)

    # Creating default roles
    set_role('Admin', pvms, is_admin_pvm)
    set_role('Alpha', pvms, is_alpha_pvm)
    set_role('Gamma', pvms, is_gamma_pvm)
    set_role('granter', pvms, is_granter_pvm)
    set_role('sql_lab', pvms, is_sql_lab_pvm)

    # commit role updates
    sm.get_session.commit()

    PUBLIC_ROLE_LIKE_GAMMA = conf.get('PUBLIC_ROLE_LIKE_GAMMA', False)
    if PUBLIC_ROLE_LIKE_GAMMA:
        set_role(PUBLIC_ROLE_LIKE_GAMMA, pvms, is_gamma_pvm)

    view_menu_set = db.session.query(models.SqlaTable).all()
    create_missing_datasource_perms(view_menu_set)
    create_missing_database_perms(view_menu_set)

    models.init_metrics_perm()
