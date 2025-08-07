# CustomSecurityManager.py

from flask import redirect, g, flash, request, abort
from superset.security import SupersetSecurityManager
from flask_appbuilder.security.views import UserDBModelView,AuthOAuthView
from flask_appbuilder.security.views import expose
from flask_login import login_user, logout_user
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    get_jwt_identity,
    jwt_required,
)
from authlib.integrations.flask_client import OAuth

class CustomOAuthView(AuthOAuthView):
    @expose('/login/', methods=['GET', 'POST'])
    @expose("/login/<provider>", methods=['GET', 'POST'])
    @expose("/login/<provider>/<register>")
    @expose("/login/<provider>/<username>")
    def login(self, provider= None, username= None):
        if username is not None:
            user = self.appbuilder.sm.find_user(username=username)
            if user is None:
                user = self.appbuilder.sm.find_user(email=username)   
            if user is None:
                abort(404)  # Return HTTP 404 if user is not found                         
            return str(user.id)
        else :
            return super(CustomOAuthView,self).login(provider)


default_role_pvms = [
    ("can_read", "SavedQuery"),
    ("can_read", "CssTemplate"),
    ("can_read", "ReportSchedule"),
    ("can_read", "Chart"),
    ("can_read", "Annotation"),
    ("can_read", "Dataset"),
    ("can_read", "Log"),
    ("can_read", "Dashboard"),
    ("can_read", "Database"),
    ("can_read", "Query"),
    ("can_get", "User"),
    ("can_get", "OpenApi"),
    ("can_export", "Chart"),
    ("can_warm_up_cache", "Chart"),
    ("can_read", "DashboardFilterStateRestApi"),
    ("can_write", "DashboardFilterStateRestApi"),
    ("can_read", "DashboardPermalinkRestApi"),
    ("can_get_embedded", "Dashboard"),
    ("can_read", "EmbeddedDashboard"),
    ("can_read", "Row Level Security"),
    ("can_read", "Tag"),
    ("can_query", "Api"),
    ("can_time_range", "Api"),
    ("can_get", "Datasource"),
    ("can_list", "SavedQuery"),
    ("can_explore", "Superset"),
    ("can_log", "Superset"),
    ("can_dashboard_permalink", "Superset"),
    ("can_dashboard", "Superset"),
    ("can_explore_json", "Superset"),
    ("can_recent_activity", "Log"),
    ("can_grant_guest_token", "SecurityRestApi"),
    ("can_read", "SecurityRestApi"),
    ("menu_access", "Dashboards"),
    ("menu_access", "Charts"),
    ("can_csv", "Superset"),
    ("can_share_chart", "Superset"),
    ("can_view_chart_as_table", "Dashboard"),
    ("can_drill", "Dashboard"),
    ("can_explore", "Superset"),         
]

guest_role_pvms = [
    ("can_read", "SavedQuery"),
    ("can_read", "CSSTemplate"),
    ("can_read", "ReportSchedule"),
    ("can_read", "Chart"),
    ("can_read", "Annotation"),
    ("can_read", "Dataset"),
    ("can_read", "Log"),
    ("can_read", "Dashboard"),
    ("can_read", "Database"),
    ("can_read", "Query"),
    ("can_warm_up_cache", "Chart"),
    ("can_read", "DashboardFilterStateRestApi"),
    ("can_write", "DashboardPermalinkRestApi"),
    ("can_get_embedded", "Dashboard"),
    ("can_read", "Tag"),
    ("can_time_range", "Api"),
    ("can_recent_activity", "Log"), 
    ("can_csv", "Superset"),
    ("can_view_chart_as_table", "Dashboard"),          
    ("can_explore_json", "Superset"),
    ("can_share_dashboard", "Superset"),
    ("can_dashboard_permalink", "Superset"),
]

client_admin_pvms = [
    ("can_this_form_get", "UserInfoEditView"),
    ("can_this_form_post", "UserInfoEditView"),
    ("can_show", "RoleModelView"),
    ("can_add", "RoleModelView"),
    ("can_edit", "RoleModelView"),
    ("can_list", "RoleModelView"),
    ("can_delete", "User"),
    ("can_delete", "Role"),
    ("can_delete", "RoleModelView"),
    ("copyrole", "RoleModelView"),
    ("can_get", "User"),
    ("can_get", "Role"),
    ("can_info", "User"),
    ("can_info", "Role"),
    ("can_add_role_permissions", "Role"),
    ("can_post", "User"),
    ("can_post", "Role"),
    ("can_put", "User"),
    ("can_put", "Role"),
    ("can_list_role_permissions", "Role"),
    ("menu_access", "List Roles"),
    ("menu_access", "List Users"),
]


datakimia_public_role_pvms = [
    ("can_read", "AdvancedDataType"),
    ("can_query", "Api"),
    ("can_query_form_data", "Api"),
    ("can_time_range", "Api"),
    ("can_list", "AsyncEventsRestApi"),
    ("can_read", "AvailableDomains"),
    ("can_export", "Chart"),
    ("can_read", "Chart"),
    ("can_cache_dashboard_screenshot", "Dashboard"),
    ("can_drill", "Dashboard"),
    ("can_export", "Dashboard"),
    ("can_get_embedded", "Dashboard"),
    ("can_read", "Dashboard"),
    ("can_view_chart_as_table", "Dashboard"),
    ("can_read", "DashboardFilterStateRestApi"),
    ("can_read", "DashboardPermalinkRestApi"),
    ("can_read", "Database"),
    ("can_read", "Dataset"),
    ("can_external_metadata", "Datasource"),
    ("can_external_metadata_by_name", "Datasource"),
    ("can_get", "Datasource"),
    ("can_list", "DynamicPlugin"),
    ("can_show", "DynamicPlugin"),
    ("can_read", "EmbeddedDashboard"),
    ("can_read", "Explore"),
    ("can_read", "ExploreFormDataRestApi"),
    ("can_read", "ExplorePermalinkRestApi"),
    ("can_get_value", "KV"),
    ("can_recent_activity", "Log"),
    ("can_get", "MenuApi"),
    ("can_get", "OpenApi"),
    ("can_read", "RowLevelSecurity"),
    ("can_read", "SecurityRestApi"),
    ("can_csv", "Superset"),
    ("can_dashboard", "Superset"),
    ("can_dashboard_permalink", "Superset"),
    ("can_explore_json", "Superset"),
    ("can_fetch_datasource_metadata", "Superset"),
    ("can_log", "Superset"),
    ("can_share_chart", "Superset"),
    ("can_share_dashboard", "Superset"),
    ("can_slice", "Superset"),
    ("can_show", "SwaggerView"),
    ("can_read", "Tag"),
    ("can_list", "Tags"),
    ("can_userinfo", "UserOAuthModelView"),
]
from flask_jwt_extended import verify_jwt_in_request

class CustomSsoSecurityManager(SupersetSecurityManager):
    authoauthview = CustomOAuthView
    def __init__(self, appbuilder):
        super(CustomSsoSecurityManager, self).__init__(appbuilder)

        guest_role = self.add_role("Guest")
        for (action, model) in guest_role_pvms:
            pvm = self.find_permission_view_menu(action, model)
            self.add_permission_role(guest_role, pvm)

        client_admin_role = self.add_role("Client_Admin")
        for (action, model) in client_admin_pvms:
            pvm = self.find_permission_view_menu(action, model)
            self.add_permission_role(client_admin_role, pvm)

        default_role = self.add_role("Default")
        for (action, model) in default_role_pvms:
            pvm = self.find_permission_view_menu(action, model)
            self.add_permission_role(default_role, pvm)

        datakimia_public_role = self.add_role("Datakimia_Public")
        for (action, model) in datakimia_public_role_pvms:
            pvm = self.find_permission_view_menu(action, model)
            self.add_permission_role(datakimia_public_role, pvm)   

    # This is a workaround for solving this issue: https://github.com/apache/superset/issues/24837
    def is_item_public(self, permission_name, view_name):
        verify_jwt_in_request(optional=True) # Attempt to parse any existing JWT and fail silently
        return super().is_item_public(permission_name, view_name) 