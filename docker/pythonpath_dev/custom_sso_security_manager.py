# CustomSecurityManager.py

from flask import redirect, g, flash, request
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
            return str(user.id)
        else :
            return super(CustomOAuthView,self).login(provider)

my_role_pvms = [

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
    ("can_get_embedded", "Dashboard"),
    ("can_read", "Tag"),
    ("can_explore_json", "Superset"),
    ("can_time_range", "Api"),
    ("can_recent_activity", "Log"),        
]

class CustomSsoSecurityManager(SupersetSecurityManager):
    authoauthview = CustomOAuthView
    def __init__(self, appbuilder):
        super(CustomSsoSecurityManager, self).__init__(appbuilder)

        my_role = self.add_role("Guest")
        for (action, model) in my_role_pvms:
            pvm = self.find_permission_view_menu(action, model)
            self.add_permission_role(my_role, pvm)
