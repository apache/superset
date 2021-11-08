import functools
from flask import g, request
from flask_jwt_extended import verify_jwt_in_request
from flask_appbuilder.security.decorators import has_access
import simplejson as json
from superset import security_manager
from superset.peak import authorizer

def has_superset_api_access(f):
    """
    Use this decorator for REST APIs in order to authenticate via superset generated
    access_token. It will enable granular security permissions to your methods.
    Permissions will be associated to a role, and roles are associated to users.

    By default the permission's name is the methods name.
    """
    def wraps(self, *args, **kwargs):
        try:
            if request.headers.get('Authorization') is not None:
                verify_jwt_in_request()
                return f(self, *args, **kwargs)
            elif g.user is not None and g.user.is_authenticated:
                has_access(f)
                return f(self, *args, **kwargs)
            else:
                raise Exception('Login is valid only through "authToken"')
        except Exception as e:
            raise e
    return functools.update_wrapper(wraps, f)

def check_access_and_create_session(f):
    """
    Use this decorator to enable granular security permissions to your methods
    and for login user using sessions. Permissions will be associated to a role,
    and roles are associated to users.

    By default the permission's name is the methods name.
    """
    def wraps(self, *args, **kwargs):
        try:
            form_data = request.args.get('form_data')
            if form_data is None:
                form_data = "{}"
            auth_token = json.loads(form_data).get("token")
            authorization_header = request.headers.get('Authorization')

            if (authorization_header is not None or auth_token is not None):
                token = authorization_header
                if token is None:
                    token = "Bearer " + auth_token
                authorizer.authorize(token, security_manager)
                return f(self, *args, **kwargs)
            elif g.user is not None and g.user.is_authenticated:
                has_access(f)
                return f(self, *args, **kwargs)
            else:
                raise Exception('Login is valid only through "authToken"')
        except Exception as e:
            raise e
    return functools.update_wrapper(wraps, f)
