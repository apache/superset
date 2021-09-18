import json
from functools import wraps
from flask import request, Response
from werkzeug.exceptions import abort

from superset.utils.permissions_manager import PermissionsManager


def authenticate_permissions_request(is_sql_query):

    def wrap(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):

            if is_sql_query:
                sql = request.json['sql']
                permissions = PermissionsManager()
                res = permissions.check_for_sql(sql)
                if not res[0]:
                    return abort(401, res[1])

            return fn(*args, **kwargs)

        return wrapper

    return wrap
