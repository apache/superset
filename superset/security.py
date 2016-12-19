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
    'dashboard_access'
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
    dashboard_access = sm.add_role("dashboard_access")
    dashboard_edit = sm.add_role("dashboard_edit")
    slice_access = sm.add_role("slice_access")
    slice_edit = sm.add_role("slice_edit")
    datasource_access = sm.add_role("datasource_access")
    datasource_edit = sm.add_role("datasource_edit")
    manage_edit = sm.add_role("manage_edit")
    user_role_edit = sm.add_role("user_role_edit")

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

    logging.info("Syncing dashboard_access perms")
    for p in perms:
        if (
                p.view_menu.name in {'Dashboards'} or
                p.permission.name in {
                    'can_explore', 'can_explore_json', 'can_slice', 'can_created_dashboards', 'can_fave_dashboards',
                    'all_datasource_access', 'all_database_access', 'can_profile'} or
                (p.permission.name in {'can_list', 'can_show', 'can_download'} and p.view_menu.name in {'DashboardModelView'}) or
                (p.permission.name in {'can_list', 'can_show', 'can_download'} and p.view_menu.name in {'DashboardModelViewAsync'}) or
                (p.permission.name in {'can_show', 'can_edit', 'can_download', 'can_userinfo','resetmypassword', 'userinfoedit'} and p.view_menu.name in {'UserDBModelView'}) 
        ):
            sm.add_permission_role(dashboard_access, p)
        else:
            sm.del_permission_role(dashboard_access, p)

    logging.info("Syncing dashboard_edit perms")
    for p in perms:
        if (
                p.view_menu.name in {'Dashboards'} or
                p.permission.name in {
                    'can_explore', 'can_explore_json', 'can_slice', 'can_created_dashboards', 'can_fave_dashboards',
                    'all_datasource_access', 'all_database_access', 'can_profile'} or
                (p.permission.name in {'can_list', 'can_show', 'can_add', 'can_delete', 'muldelete', 'can_edit', 'can_download', 'mulexport'} and p.view_menu.name in {'DashboardModelView'}) or
                (p.permission.name in {'can_list', 'can_show', 'can_add', 'can_delete', 'muldelete', 'can_edit', 'can_download', 'mulexport'} and p.view_menu.name in {'DashboardModelViewAsync'}) or
                (p.permission.name in {'can_show', 'can_edit', 'can_download', 'can_userinfo','resetmypassword', 'userinfoedit'} and p.view_menu.name in {'UserDBModelView'}) 
        ):
            sm.add_permission_role(dashboard_edit, p)
        else:
            sm.del_permission_role(dashboard_edit, p)

    logging.info("Syncing slice_access perms")
    for p in perms:
        if (
                p.view_menu.name in {'Slices'} or
                p.permission.name in {
                    'can_explore', 'can_explore_json', 'can_slice', 'can_created_slices', 'can_fave_slices',
                    'all_datasource_access', 'all_database_access', 'can_profile'} or
                (p.permission.name in {'can_list', 'can_show', 'can_download'} and p.view_menu.name in {'SliceModelView'}) or
                (p.permission.name in {'can_list', 'can_show', 'can_download'} and p.view_menu.name in {'SliceAsync'}) or
                (p.permission.name in {'can_show', 'can_edit', 'can_userinfo','resetmypassword', 'userinfoedit'} and p.view_menu.name in {'UserDBModelView'}) 
        ):
            sm.add_permission_role(slice_access, p)
        else:
            sm.del_permission_role(slice_access, p)

    logging.info("Syncing slice_edit perms")
    for p in perms:
        if (
                p.view_menu.name in {'Slices'} or
                p.permission.name in {
                    'can_explore', 'can_explore_json', 'can_slice', 'can_created_slices', 'can_fave_slices', 'can_add_slices',
                    'all_datasource_access', 'all_database_access', 'can_profile'} or
                (p.permission.name in {'can_list', 'can_show', 'can_add', 'can_delete', 'muldelete', 'can_edit', 'can_download'} and p.view_menu.name in {'SliceModelView'}) or
                (p.permission.name in {'can_list', 'can_show', 'can_add', 'can_delete', 'muldelete', 'can_edit', 'can_download'} and p.view_menu.name in {'SliceAsync'}) or
                (p.permission.name in {'can_list', 'can_show', 'can_add', 'can_delete', 'muldelete', 'can_edit', 'can_download'} and p.view_menu.name in {'SliceAddView'}) or
                (p.permission.name in {'can_show', 'can_edit', 'can_userinfo','resetmypassword', 'userinfoedit'} and p.view_menu.name in {'UserDBModelView'}) 
        ):
            sm.add_permission_role(slice_edit, p)
        else:
            sm.del_permission_role(slice_edit, p)

    logging.info("Syncing datasource_access perms")
    for p in perms:
        if (
                p.view_menu.name in {'Sources', 'Databases', 'Tables', 'Druid Clusters', 'Druid Datasources'} or
                p.permission.name in {
                    'can_explore', 'can_explore_json',  
                    'all_datasource_access', 'all_database_access', 'can_profile'} or
                (p.permission.name in {'can_list', 'can_show'} and p.view_menu.name in {'DatabaseView'}) or
                (p.permission.name in {'can_list', 'can_show'} and p.view_menu.name in {'DatabaseAsync'}) or
                (p.permission.name in {'can_list', 'can_show'} and p.view_menu.name in {'TableModelView'}) or
                (p.permission.name in {'can_list', 'can_show'} and p.view_menu.name in {'DatabaseTableAsync'}) or
                (p.permission.name in {'can_list', 'can_show'} and p.view_menu.name in {'DruidDatasourceModelView'}) or
                (p.permission.name in {'can_list', 'can_show'} and p.view_menu.name in {'DruidClusterModelView'}) or
                (p.permission.name in {'can_show', 'can_edit', 'can_userinfo','resetmypassword', 'userinfoedit'} and p.view_menu.name in {'UserDBModelView'}) 

        ):
            sm.add_permission_role(datasource_access, p)
        else:
            sm.del_permission_role(datasource_access, p)

    logging.info("Syncing datasource_edit perms")
    for p in perms:
        if (
                p.view_menu.name in {'Sources', 'Databases', 'Tables', 'Druid Clusters', 'Druid Datasources', 'Refresh Druid Metadata', 'TableColumnInlineView', 'SqlMetricInlineView'} or
                p.permission.name in {
                    'can_explore', 'can_explore_json',  'can_testconn', 'can_checkbox', 'can_refresh_datasources',
                    'all_datasource_access', 'all_database_access', 'can_profile'} or
                (p.permission.name in {'can_list', 'can_show', 'can_add', 'can_delete', 'muldelete', 'can_edit', 'can_download'} and p.view_menu.name in {'DatabaseView'}) or
                (p.permission.name in {'can_list', 'can_show', 'can_add', 'can_delete', 'muldelete', 'can_edit', 'can_download'} and p.view_menu.name in {'DatabaseAsync'}) or
                (p.permission.name in {'can_list', 'can_show', 'can_add', 'can_delete', 'muldelete', 'can_edit', 'can_download'} and p.view_menu.name in {'TableModelView'}) or
                (p.permission.name in {'can_list', 'can_show', 'can_add', 'can_delete', 'muldelete', 'can_edit', 'can_download'} and p.view_menu.name in {'DatabaseTablesAsync'}) or
                (p.permission.name in {'can_list', 'can_show', 'can_add', 'can_delete', 'muldelete', 'can_edit', 'can_download'} and p.view_menu.name in {'DruidDatasourceModelView'}) or
                (p.permission.name in {'can_list', 'can_show', 'can_add', 'can_delete', 'muldelete', 'can_edit', 'can_download'} and p.view_menu.name in {'DruidClusterModelView'}) or
                (p.permission.name in {'can_list', 'can_show', 'can_add', 'can_delete', 'can_edit', 'can_download'} and p.view_menu.name in {'TableColumnInlineView'}) or
                (p.permission.name in {'can_list', 'can_show', 'can_add', 'can_delete', 'can_edit', 'can_download'} and p.view_menu.name in {'SqlMetricInlineView'}) or
                (p.permission.name in {'can_list', 'can_show', 'can_add', 'can_delete', 'can_edit', 'can_download'} and p.view_menu.name in {'DruidColumnInlineView'}) or
                (p.permission.name in {'can_list', 'can_show', 'can_add', 'can_delete', 'can_edit', 'can_download'} and p.view_menu.name in {'DruidMetricInlineView'}) or
                (p.permission.name in {'can_show', 'can_edit', 'can_userinfo','resetmypassword', 'userinfoedit'} and p.view_menu.name in {'UserDBModelView'}) 

        ):
            sm.add_permission_role(datasource_edit, p)
        else:
            sm.del_permission_role(datasource_edit, p)

    logging.info("Syncing manage_edit perms")
    for p in perms:
        if (
                p.view_menu.name in {'Manage', 'Import Dashboards', 'Queries', 'CSS Templates'} or
                p.permission.name in {'can_profile'} or
                (p.permission.name in {'can_list', 'can_show', 'can_add', 'can_delete', 'can_edit', 'can_download'} and p.view_menu.name in {'QueryView'}) or
                (p.permission.name in {'can_list', 'can_show', 'can_add', 'can_delete', 'can_edit', 'can_download'} and p.view_menu.name in {'CssTemplateModelView'}) or
                (p.permission.name in {'can_list', 'can_show', 'can_add', 'can_delete', 'can_edit', 'can_download'} and p.view_menu.name in {'CssTemplateAsyncModelView'}) or
                (p.permission.name in {'can_add'} and p.view_menu.name in {'DashboardModelView'}) or
                (p.permission.name in {'can_add'} and p.view_menu.name in {'SliceAddView'}) or
                (p.permission.name in {'can_show', 'can_edit', 'can_userinfo','resetmypassword', 'userinfoedit'} and p.view_menu.name in {'UserDBModelView'}) 

        ):
            sm.add_permission_role(manage_edit, p)
        else:
            sm.del_permission_role(manage_edit, p)

    logging.info("Syncing user_role_edit perms")
    for p in perms:
        if (
                p.view_menu.name in {'Security', 'List Users', 'List Roles', "User's Statistics", 'Base Permissions', 'Views/Menus', 'Permission on Views/Menus', 'Access requests', 'Action Log'} or
                p.permission.name in {'can_recent_activity', 'can_profile'} or
                (p.permission.name in {'can_list', 'can_show', 'can_add', 'can_delete', 'muldelete', 'can_edit', 'can_download', 'can_userinfo', 'resetmypassword', 'resetpasswords', 'userinfoedit'} and p.view_menu.name in {'UserDBModelView'}) or
                (p.permission.name in {'can_list', 'can_show', 'can_add', 'can_delete', 'muldelete', 'can_edit', 'can_download', 'Copy Role', 'can_update_role', 'can_override_role_permissions'} and p.view_menu.name in {'RoleModelView'}) or
                (p.permission.name in {'can_chart'} and p.view_menu.name in {'UserStatsChartView'}) or
                (p.permission.name in {'can_list'} and p.view_menu.name in {'PermissionModelView'}) or
                (p.permission.name in {'can_list'} and p.view_menu.name in {'ViewMenuModelView'}) or
                (p.permission.name in {'can_list'} and p.view_menu.name in {'PermissionViewModelView'}) or
                (p.permission.name in {'can_list', 'can_show', 'can_add', 'can_delete', 'can_edit', 'can_download', 'muldelete'} and p.view_menu.name in {'AccessRequestsModelView'}) or
                (p.permission.name in {'can_list', 'can_show', 'can_add', 'can_delete', 'can_edit', 'can_download'} and p.view_menu.name in {'LogModelView'}) or
                (p.permission.name in {'can_this_form_post', 'can_this_form_get'} and p.view_menu.name in {'ResetMyPasswordView'}) or 
                (p.permission.name in {'can_this_form_post', 'can_this_form_get'} and p.view_menu.name in {'ResetPasswordView'}) or 
                (p.permission.name in {'can_this_form_post', 'can_this_form_get'} and p.view_menu.name in {'UserInfoEditView'})
        ):
            sm.add_permission_role(user_role_edit, p)
        else:
            sm.del_permission_role(user_role_edit, p)



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

    logging.info("Making sure all dashboard perms have been created")
    dashboards = [o for o in session.query(models.Dashboard).all()]
    for dashboard in dashboards:
        perm = dashboard.get_dashboard_title()
        sm.add_permission_view_menu('dashboard_access', perm)
    session.commit()

    logging.info("Making sure all metrics perms exist")
    models.init_metrics_perm()
