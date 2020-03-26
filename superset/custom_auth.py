from flask import redirect, g, flash, request, make_response, jsonify
from flask_appbuilder.security.views import UserDBModelView, AuthDBView
from superset.security import SupersetSecurityManager
from flask_appbuilder.security.views import expose
from flask_appbuilder.security.manager import BaseSecurityManager
from flask_login import login_user, logout_user
from datetime import timedelta, datetime
from ais_service_discovery import call
from json import loads
from os import environ
import functools


def has_resource_access(privileges):
    for config in privileges['level']['tenant']['tenants']:
      if config['tenant'] == environ['TENANT']:
          for resource in config['resources']:
            if ('appId' in resource) and (resource['appId'] in ['customerAi', 'demandAi']):
              return True
    return False

def has_solution_write_access(privileges):
    for config in privileges['level']['tenant']['tenants']:
      if config['tenant'] == environ['TENANT']:
          for resource in config['resources']:
            if (resource['name'] == 'SOLUTION MANAGER') and (resource['action'] == 'write'):
              return True
    return False


class CustomAuthDBView(AuthDBView):


    def login_api(f):
      """
      Use this decorator to enable granular security permissions to your API methods.
      Permissions will be associated to a role, and roles are associated to users.

      By default the permission's name is the methods name.

      this will return a message and HTTP 401 is case of unauthorized access.
      """
      def wraps(self, *args, **kwargs):
        user='guest'
        try:
          if request.args.get('authToken') is not None:
            token = 'Bearer {}'.format(request.args.get('authToken'))
            auth_response = loads(call(
                'ais-{}'.format(environ['STAGE']),
                'authentication',
                'auth', {
                    'authorizationToken': token
                }))['context']
            if not auth_response['tenant'] == environ['TENANT']:
                raise Exception('Tenant mismatch in token')
            if auth_response['role'] in ['tenantManager', 'tenantAdmin']:
                user = 'admin'
            else:
                privileges = loads(auth_response['privileges'])
                if has_solution_write_access(privileges):
                    user = 'peakuser'
                elif not has_resource_access(privileges):
                    raise Exception('Insufficient Resource Permissions')
            user = self.appbuilder.sm.find_user(user)
            login_user(user, remember=False,
                        duration=timedelta(
                        auth_response['exp'] - int(
                            datetime.now().timestamp())))
            return f(self, *args, **kwargs)
          elif g.user is not None and g.user.is_authenticated:
              return f(self, *args, **kwargs)
          else:
              raise Exception('Login is valid only through "authToken"')
        except Exception as e:
            response = make_response(
                jsonify(
                    {
                        'message': 'Access Denied',
                        'severity': 'danger',
                        'error': e
                    }
                ),
                401
            )
            response.headers['Content-Type'] = "application/json"
            return response
      return functools.update_wrapper(wraps, f)

    @expose('/login/', methods=['GET', 'POST'])
    def login(self):
        redirect_url = self.appbuilder.get_url_for_index
        user = 'guest'
        try:
            if request.args.get('redirect') is not None:
                redirect_url = request.args.get('redirect')

            if request.args.get('authToken') is not None:
                token = 'Bearer {}'.format(request.args.get('authToken'))
                auth_response = loads(call(
                    'ais-{}'.format(environ['STAGE']),
                    'authentication',
                    'auth', {
                        'authorizationToken': token
                    }))['context']
                if not auth_response['tenant'] == environ['TENANT']:
                    raise Exception('Tenant mismatch in token')
                if auth_response['role'] in ['tenantManager', 'tenantAdmin']:
                    user = 'admin'
                else:
                    privileges = loads(auth_response['privileges'])
                    if has_solution_write_access(privileges):
                        user = 'peakuser'
                    elif not has_resource_access(privileges):
                        raise Exception('Insufficient Resource Permissions')
                user = self.appbuilder.sm.find_user(user)
                login_user(user, remember=False,
                           duration=timedelta(
                            auth_response['exp'] - int(
                                datetime.now().timestamp())))
                return redirect(redirect_url)
            elif g.user is not None and g.user.is_authenticated:
                return redirect(redirect_url)
            else:
                raise Exception('Login is valid only through "authToken"')
        except Exception as e:
            flash(e, 'warning')
            return super(CustomAuthDBView, self).login()


class CustomSecurityManager(SupersetSecurityManager):
    authdbview = CustomAuthDBView

    def __init__(self, appbuilder):
        super(CustomSecurityManager, self).__init__(appbuilder)
