from flask import redirect, g, flash, request
from flask_appbuilder.security.views import UserDBModelView, AuthDBView
from superset.security import SupersetSecurityManager
from flask_appbuilder.security.views import expose
from flask_appbuilder.security.manager import BaseSecurityManager
from flask_login import login_user, logout_user
from ais_service_discovery import call
from json import loads
from os import environ


class CustomAuthDBView(AuthDBView):

    @expose('/login/', methods=['GET'])
    def login(self):
        redirect_url = self.appbuilder.get_url_for_index
        user_role = 'gamma'
        try:
            if request.args.get('redirect') is not None:
                redirect_url = request.args.get('redirect')

            if request.args.get('authToken') is not None:
                token = 'Bearer {}'.format(request.args.get('authToken'))
                auth_response = loads(call(
                    'ais-{}'.format(environ('STAGE')),
                    'authentication',
                    'auth', {
                        'authorizationToken': token
                    }))['context']
                if not auth_response['tenant'] == environ['TENANT']:
                    raise Exception('Tenant mismatch in token')
                if auth_response['role'] in ['tenantManager', 'tenantAdmin']:
                    user_role = 'admin'
                user = self.appbuilder.sm.find_user(user_role)
                login_user(user, remember=False)
                return redirect(redirect_url)
            elif g.user is not None and g.user.is_authenticated:
                return redirect(redirect_url)
        except Exception as e:
            flash(e, 'warning')
            return super(CustomAuthDBView, self).login()


class CustomSecurityManager(SupersetSecurityManager):
    authdbview = CustomAuthDBView

    def __init__(self, appbuilder):
        super(CustomSecurityManager, self).__init__(appbuilder)
