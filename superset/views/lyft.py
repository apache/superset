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
from __future__ import absolute_import, division, print_function, unicode_literals

from typing import cast, Optional

from flask import g, request, Response
from flask_appbuilder import expose

import superset.models.core as models
from superset import app, appbuilder, event_logger, security_manager
from superset.exceptions import SupersetException
from superset.views.core import Superset

from .base import json_error_response

config = app.config
stats_logger = config.get("STATS_LOGGER")
DAR = models.DatasourceAccessRequest


class UserDontExistException(SupersetException):
    pass


def json_success(json_msg, status=200):
    return Response(json_msg, status=status, mimetype="application/json")


class Lyft(Superset):
    @staticmethod
    def authorize():
        """Provides access if token, impersonates if specified"""
        if not security_manager.has_tom_key():
            raise SupersetException("Wrong key")

        email = request.headers.get("IMPERSONATE")
        if email:
            user = security_manager.find_user(email=email)
            if not user:
                raise UserDontExistException("Email to impersonate not found")
            g.user = user

    @event_logger.log_this
    @expose("/sql_json/", methods=["POST", "GET"])
    def sql_json(self):
        try:
            Lyft.authorize()
        except UserDontExistException as e:
            return json_error_response("{}".format(e), status=412)
        except SupersetException as e:
            return json_error_response("{}".format(e))

        request_json = request.get_json()
        if not request_json:
            request_json = {
                "database_id": int(request.form.get("database_id")),
                "schema": request.form.get("schema"),
                "sql": request.form.get("sql"),
                "templateParams": request.form.get("templateParams", "{}"),
                "queryLimit": int(
                    request.form.get("queryLimit", app.config.get("SQL_MAX_ROW"))
                ),
                "runAsync": request.form.get("runAsync") == "true",
                "select_as_cta": request.form.get("select_as_cta") == "true",
                "tmp_table_name": request.form.get("tmp_table_name"),
                "client_id": request.form.get("client_id") or None,
                "sql_editor_id": request.form.get("sql_editor_id"),
                "tab": request.form.get("tab"),
            }

        log_params = {
            "user_agent": cast(Optional[str], request.headers.get("USER_AGENT"))
        }
        return self.sql_json_exec(request_json, log_params)

    @event_logger.log_this
    @expose("/queries/<last_updated_ms>")
    def queries(self, last_updated_ms):
        last_updated_ms_int = int(float(last_updated_ms)) if last_updated_ms else 0
        try:
            self.authorize()
        except (UserDontExistException, SupersetException) as e:
            return json_error_response("{}".format(e))
        return self.queries_exec(last_updated_ms_int)

    @event_logger.log_this
    @expose("/results/<key>")
    def results(self, key):
        try:
            self.authorize()
        except (UserDontExistException, SupersetException) as e:
            return json_error_response("{}".format(e))
        return self.results_exec(key)


appbuilder.add_view_no_menu(Lyft)
