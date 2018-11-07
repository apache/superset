# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
# pylint: disable=C,R,W
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from flask import g, request, Response
from flask_appbuilder import expose

from superset import app, appbuilder, security_manager
from superset.exceptions import SupersetException
import superset.models.core as models
from superset.views.core import Superset
from .base import json_error_response

config = app.config
stats_logger = config.get('STATS_LOGGER')
log_this = models.Log.log_this
DAR = models.DatasourceAccessRequest


class UserDontExistException(SupersetException):
    pass


def json_success(json_msg, status=200):
    return Response(json_msg, status=status, mimetype='application/json')


class Lyft(Superset):
    @staticmethod
    def authorize():
        """Provides access if token, impersonates if specified"""
        if not security_manager.has_tom_key():
            raise SupersetException('Wrong key')

        email = request.headers.get('IMPERSONATE')
        if email:
            user = security_manager.find_user(email=email)
            if not user:
                raise UserDontExistException('Email to impersonate not found')
            g.user = user

    @expose('/sql_json/', methods=['POST', 'GET'])
    @log_this
    def sql_json(self):
        try:
            Lyft.authorize()
        except UserDontExistException as e:
            return json_error_response('{}'.format(e), status=412)
        except SupersetException as e:
            return json_error_response('{}'.format(e))
        return self.sql_json_call(request)

    @expose('/queries/<last_updated_ms>')
    @log_this
    def queries(self, last_updated_ms):
        try:
            self.authorize()
        except (UserDontExistException, SupersetException) as e:
            return json_error_response('{}'.format(e))
        return self.queries_call(last_updated_ms)

    @expose('/results/<key>')
    @log_this
    def results(self, key):
        try:
            self.authorize()
        except (UserDontExistException, SupersetException) as e:
            return json_error_response('{}'.format(e))
        return self.results_call(key)


appbuilder.add_view_no_menu(Lyft)
