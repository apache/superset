from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from flask import Response, request, g
from flask_appbuilder import expose

from superset import app, appbuilder, security_manager
import superset.models.core as models
from superset.views.core import Superset
from .base import json_error_response

config = app.config
stats_logger = config.get('STATS_LOGGER')
log_this = models.Log.log_this
DAR = models.DatasourceAccessRequest


def json_success(json_msg, status=200):
    return Response(json_msg, status=status, mimetype='application/json')


class Lyft(Superset):

    def authorize(self):
        """Provides access if token, impersonates if specified"""
        if not security_manager.has_tom_key():
            raise Exception("Wrong key")

        email = request.headers.get('IMPERSONATE')
        if email:
            user = security_manager.find_user(email=email)
            if not user:
                raise Exception("Email to impersonate not found")
            g.user = user

    @expose('/sql_json/', methods=['POST', 'GET'])
    @log_this
    def sql_json(self):
        try:
            self.authorize()
        except Exception as e:
            return json_error_response('{}'.format(e))
        return self.sql_json_call(request)


appbuilder.add_view_no_menu(Lyft)
