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


def sync_role_definitions():
    """Inits the Superset application with security roles and such"""
    logging.info("Syncing role definition")

    # Creating default roles
    alpha = sm.add_role("Alpha")
    admin = sm.add_role("Admin")
    gamma = sm.add_role("Gamma")
    public = sm.add_role("Public")
    sql_lab = sm.add_role("sql_lab")
    granter = sm.add_role("granter")

    get_or_create_main_db()

    # Global perms
    merge_perm(sm, 'all_datasource_access', 'all_datasource_access')
    merge_perm(sm, 'all_database_access', 'all_database_access')

    perms = db.session.query(ab_models.PermissionView).all()
    perms = [p for p in perms if p.permission and p.view_menu]

    logging.info("Syncing admin perms")
    for p in perms:
        # admin has all_database_access and all_datasource_access
        if is_user_defined_permission(p):
            sm.del_permission_role(admin, p)
        else:
            sm.add_permission_role(admin, p)

    logging.info("Syncing alpha perms")
    for p in perms:
        # alpha has all_database_access and all_datasource_access
        if is_user_defined_permission(p):
            sm.del_permission_role(alpha, p)
        elif (
                (
                    p.view_menu.name not in ADMIN_ONLY_VIEW_MENUES and
                    p.permission.name not in ADMIN_ONLY_PERMISSIONS
                ) or
                (p.permission.name, p.view_menu.name) in READ_ONLY_PRODUCT
        ):
            sm.add_permission_role(alpha, p)
        else:
            sm.del_permission_role(alpha, p)

    logging.info("Syncing gamma perms and public if specified")
    PUBLIC_ROLE_LIKE_GAMMA = conf.get('PUBLIC_ROLE_LIKE_GAMMA', False)
    for p in perms:
        if (
                (
                    p.view_menu.name not in ADMIN_ONLY_VIEW_MENUES and
                    p.view_menu.name not in GAMMA_READ_ONLY_MODELVIEWS and
                    p.permission.name not in ADMIN_ONLY_PERMISSIONS and
                    p.permission.name not in ALPHA_ONLY_PERMISSIONS
                ) or
                (p.permission.name, p.view_menu.name) in
                GAMMA_READ_ONLY_PRODUCT
        ):
            sm.add_permission_role(gamma, p)
            if PUBLIC_ROLE_LIKE_GAMMA:
                sm.add_permission_role(public, p)
        else:
            sm.del_permission_role(gamma, p)
            sm.del_permission_role(public, p)

    logging.info("Syncing sql_lab perms")
    for p in perms:
        if (
                p.view_menu.name in {'SQL Lab'} or
                p.permission.name in {
                    'can_sql_json', 'can_csv', 'can_search_queries'}
        ):
            sm.add_permission_role(sql_lab, p)
        else:
            sm.del_permission_role(sql_lab, p)

    logging.info("Syncing granter perms")
    for p in perms:
        if (
                p.permission.name in {
                    'can_override_role_permissions', 'can_aprove'}
        ):
            sm.add_permission_role(granter, p)
        else:
            sm.del_permission_role(granter, p)

    logging.info("Making sure all data source perms have been created")
    session = db.session()
    datasources = [
        o for o in session.query(models.SqlaTable).all()]
    datasources += [
        o for o in session.query(models.DruidDatasource).all()]
    for datasource in datasources:
        perm = datasource.get_perm()
        merge_perm(sm, 'datasource_access', perm)
        if datasource.schema:
            merge_perm(sm, 'schema_access', datasource.schema_perm)
        if perm != datasource.perm:
            datasource.perm = perm

    logging.info("Making sure all database perms have been created")
    databases = [o for o in session.query(models.Database).all()]
    for database in databases:
        perm = database.get_perm()
        if perm != database.perm:
            database.perm = perm
        merge_perm(sm, 'database_access', perm)
    session.commit()

    logging.info("Making sure all metrics perms exist")
    models.init_metrics_perm()
