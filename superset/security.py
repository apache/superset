from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from itertools import product
import logging
from flask_appbuilder.security.sqla import models as ab_models

from superset import db, models, app, sm

config = app.config

READ_ONLY_MODELVIEWS = {
    'DatabaseAsync',
    'DatabaseView',
    'DruidClusterModelView',
}
ADMIN_ONLY_VIEW_MENUES = {
    'AccessRequestsModelView',
    'Manage',
    'SQL Lab',
    'Refresh Druid Metadata',
    'ResetPasswordView',
    'RoleModelView',
    'Security',
    'UserDBModelView',
} | READ_ONLY_MODELVIEWS

ADMIN_ONLY_PERMISSIONS = {
    'all_datasource_access',
    'all_database_access',
    'datasource_access',
    'database_access',
    'can_sql_json',
    'can_sync_druid_source',
    'can_override_role_permissions',
    'can_approve',
}
READ_ONLY_PERMISSION = {
    'can_show',
    'can_list',
}

ALPHA_ONLY_PERMISSIONS = set([
    'can_add',
    'can_download',
    'can_delete',
    'can_edit',
    'can_save',
    'datasource_access',
    'database_access',
    'muldelete',
])
READ_ONLY_PRODUCT = set(
    product(READ_ONLY_PERMISSION, READ_ONLY_MODELVIEWS))


def merge_perm(sm, permission_name, view_menu_name):
    pv = sm.find_permission_view_menu(permission_name, view_menu_name)
    if not pv:
        sm.add_permission_view_menu(permission_name, view_menu_name)


def init_metrics_perm(metrics=None):
    """Create permissions for restricted metrics

    :param metrics: a list of metrics to be processed, if not specified,
        all metrics are processed
    :type metrics: models.SqlMetric or models.DruidMetric
    """
    if not metrics:
        metrics = []
        for model in [models.SqlMetric, models.DruidMetric]:
            metrics += list(db.session.query(model).all())

    for metric in metrics:
        if metric.is_restricted and metric.perm:
            merge_perm(sm, 'metric_access', metric.perm)


def get_or_create_main_db():
    logging.info("Creating database reference")
    dbobj = (
        db.session.query(models.Database)
        .filter_by(database_name='main')
        .first()
    )
    if not dbobj:
        dbobj = models.Database(database_name="main")
    logging.info(config.get("SQLALCHEMY_DATABASE_URI"))
    dbobj.set_sqlalchemy_uri(config.get("SQLALCHEMY_DATABASE_URI"))
    dbobj.expose_in_sqllab = True
    dbobj.allow_run_sync = True
    db.session.add(dbobj)
    db.session.commit()
    return dbobj


def sync_role_definitions():
    """Inits the Superset application with security roles and such"""

    # Creating default roles
    alpha = sm.add_role("Alpha")
    admin = sm.add_role("Admin")
    gamma = sm.add_role("Gamma")
    public = sm.add_role("Public")
    sql_lab = sm.add_role("sql_lab")

    get_or_create_main_db()

    # Global perms
    merge_perm(sm, 'all_datasource_access', 'all_datasource_access')
    merge_perm(sm, 'all_database_access', 'all_database_access')

    perms = db.session.query(ab_models.PermissionView).all()
    perms = [p for p in perms if p.permission and p.view_menu]

    # set admin perms
    for p in perms:
        sm.add_permission_role(admin, p)

    # set alpha perms
    for p in perms:
        if (
                (
                    p.view_menu.name not in ADMIN_ONLY_VIEW_MENUES and
                    p.permission.name not in ADMIN_ONLY_PERMISSIONS
                ) or
                (p.permission.name, p.view_menu.name) in READ_ONLY_PRODUCT
        ):
            sm.add_permission_role(alpha, p)
        else:
            sm.del_permission_role(alpha, p)

    # set gamma permissions and public to be alike if specified
    PUBLIC_ROLE_LIKE_GAMMA = config.get('PUBLIC_ROLE_LIKE_GAMMA', False)
    for p in perms:
        if (
                (
                    p.view_menu.name not in ADMIN_ONLY_VIEW_MENUES and
                    p.permission.name not in ADMIN_ONLY_PERMISSIONS and
                    p.permission.name not in ALPHA_ONLY_PERMISSIONS
                ) or
                (p.permission.name, p.view_menu.name) in READ_ONLY_PRODUCT
        ):
            sm.add_permission_role(gamma, p)
            if PUBLIC_ROLE_LIKE_GAMMA:
                sm.add_permission_role(public, p)
        else:
            sm.del_permission_role(gamma, p)
            sm.del_permission_role(public, p)

    # Managing the sql_lab role
    for p in perms:
        if (
                p.view_menu.name in {'SQL Lab'} or
                p.permission.name in {
                    'can_sql_json', 'can_csv', 'can_search_queries'}
        ):
            sm.add_permission_role(sql_lab, p)
        else:
            sm.del_permission_role(sql_lab, p)

    # Making sure all data source perms have been created
    session = db.session()
    table_perms = [
        table.perm for table in session.query(models.SqlaTable).all()]
    table_perms += [
        table.perm for table in session.query(models.DruidDatasource).all()]
    for table_perm in table_perms:
        merge_perm(sm, 'datasource_access', table_perm)

    # Making sure all database perms have been created
    db_perms = [o.perm for o in session.query(models.Database).all()]
    for db_perm in db_perms:
        merge_perm(sm, 'database_access', db_perm)
    init_metrics_perm()
