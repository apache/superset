"""A set of constants and methods to manage permissions and security"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import logging
from flask_appbuilder.security.sqla import models as ab_models

from superset import conf, db, sm
from superset.models import core as models
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


def merge_perm(sm, permission_name, view_menu_name):
    # Implementation copied from sm.find_permission_view_menu.
    # TODO: use sm.find_permission_view_menu once issue
    #       https://github.com/airbnb/superset/issues/1944 is resolved.
    permission = sm.find_permission(permission_name)
    view_menu = sm.find_view_menu(view_menu_name)
    pv = None
    if permission and view_menu:
        pv = sm.get_session.query(sm.permissionview_model).filter_by(
            permission=permission, view_menu=view_menu).first()
    if not pv and permission_name and view_menu_name:
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
    dbobj.set_sqlalchemy_uri(conf.get("SQLALCHEMY_DATABASE_URI"))
    dbobj.expose_in_sqllab = True
    dbobj.allow_run_sync = True
    db.session.add(dbobj)
    db.session.commit()
    return dbobj


def is_admin_only(pvm):
    # not readonly operations on read only model views allowed only for admins
    if (pvm.view_menu.name in READ_ONLY_MODEL_VIEWS and
            pvm.permission.name not in READ_ONLY_PERMISSION):
        return True
    return (pvm.view_menu.name in ADMIN_ONLY_VIEW_MENUS or
            pvm.permission.name in ADMIN_ONLY_PERMISSIONS)


def is_alpha_only(pvm):
    if (pvm.view_menu.name in GAMMA_READ_ONLY_MODEL_VIEWS and
            pvm.permission.name not in READ_ONLY_PERMISSION):
        return True
    return pvm.permission.name in ALPHA_ONLY_PERMISSIONS


def is_admin_pvm(pvm):
    return not is_user_defined_permission(pvm)


def is_alpha_pvm(pvm):
    return not (is_user_defined_permission(pvm) or is_admin_only(pvm))


def is_gamma_pvm(pvm):
    return not (is_user_defined_permission(pvm) or is_admin_only(pvm) or
                is_alpha_only(pvm))


def is_sql_lab_pvm(pvm):
    return pvm.view_menu.name in {'SQL Lab'} or pvm.permission.name in {
        'can_sql_json', 'can_csv', 'can_search_queries'}


def is_granter_pvm(pvm):
    return pvm.permission.name in {'can_override_role_permissions',
                                   'can_approve'}


def set_role(role_name, pvms, pvm_check):
    logging.info("Syncing {} perms".format(role_name))
    role = sm.add_role(role_name)
    role_pvms = [p for p in pvms if pvm_check(p)]
    role.permissions = role_pvms
    sesh = sm.get_session()
    sesh.merge(role)
    sesh.commit()


def create_custom_permissions():
    # Global perms
    merge_perm(sm, 'all_datasource_access', 'all_datasource_access')
    merge_perm(sm, 'all_database_access', 'all_database_access')


def create_missing_datasource_perms(view_menu_set):
    logging.info("Creating missing datasource permissions.")
    datasources = ConnectorRegistry.get_all_datasources(
        db.session)
    for datasource in datasources:
        if datasource and datasource.perm not in view_menu_set:
            merge_perm(sm, 'datasource_access', datasource.get_perm())
            if datasource.schema_perm:
                merge_perm(sm, 'schema_access', datasource.schema_perm)


def create_missing_database_perms(view_menu_set):
    logging.info("Creating missing database permissions.")
    databases = db.session.query(models.Database).all()
    for database in databases:
        if database and database.perm not in view_menu_set:
            merge_perm(sm, 'database_access', database.perm)


def create_missing_metrics_perm(view_menu_set):
    """Create permissions for restricted metrics

    :param metrics: a list of metrics to be processed, if not specified,
        all metrics are processed
    :type metrics: models.SqlMetric or models.DruidMetric
    """
    logging.info("Creating missing metrics permissions")
    metrics = []
    for datasource_class in ConnectorRegistry.sources.values():
        metrics += list(db.session.query(datasource_class.metric_class).all())

    for metric in metrics:
        if (metric.is_restricted and metric.perm and
                metric.perm not in view_menu_set):
            merge_perm(sm, 'metric_access', metric.perm)


def sync_role_definitions():
    """Inits the Superset application with security roles and such"""
    logging.info("Syncing role definition")

    get_or_create_main_db()
    create_custom_permissions()

    pvms = db.session.query(ab_models.PermissionView).all()
    pvms = [p for p in pvms if p.permission and p.view_menu]

    # cleanup
    pvms_to_delete = [p for p in pvms if not (p.permission and p.view_menu)]

    for pvm_to_delete in pvms_to_delete:
        sm.get_session.delete(pvm_to_delete)

    # Creating default roles
    set_role('Admin', pvms, is_admin_pvm)
    set_role('Alpha', pvms, is_alpha_pvm)
    set_role('Gamma', pvms, is_gamma_pvm)
    set_role('granter', pvms, is_granter_pvm)
    set_role('sql_lab', pvms, is_sql_lab_pvm)

    if conf.get('PUBLIC_ROLE_LIKE_GAMMA', False):
        set_role('Public', pvms, is_gamma_pvm)

    view_menu_set = []
    for datasource_class in ConnectorRegistry.sources.values():
        view_menu_set += list(db.session.query(datasource_class).all())
    create_missing_datasource_perms(view_menu_set)
    create_missing_database_perms(view_menu_set)
    create_missing_metrics_perm(view_menu_set)

    # commit role and view menu updates
    sm.get_session.commit()
