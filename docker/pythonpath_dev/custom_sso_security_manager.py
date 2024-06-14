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
            return str(self.appbuilder.sm.find_user(username=username).id)
        else :
            return super(CustomOAuthView,self).login(provider)


class CustomSsoSecurityManager(SupersetSecurityManager):
    authoauthview = CustomOAuthView
    def __init__(self, appbuilder):
        super(CustomSsoSecurityManager, self).__init__(appbuilder)
