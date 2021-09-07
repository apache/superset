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
# pylint: disable=R

import logging
from os import environ
from flask import request, g
from typing import Any
import simplejson as json

from flask_appbuilder import expose
from flask_appbuilder.api import rison
from flask_appbuilder.security.decorators import has_access_api
from superset import db, event_logger, security_manager
from superset.custom_auth import use_ip_auth
from superset.common.query_context import QueryContext
from superset.models.slice import Slice
from superset.typing import FlaskResponse
from superset.dashboards.commands.importers.v0 import import_dashboards
from superset.utils import core as utils, s3_utils, dashboard_import_export
from .base import api, BaseSupersetView, handle_api_exception, json_error_response, json_success
from superset.utils.date_parser import get_since_until
from superset.charts.commands.exceptions import (
    TimeRangeParseFailError,
    TimeRangeUnclearError,
)

import superset.models.core as models
from superset import app
get_time_range_schema = {"type": "string"}


class Api(BaseSupersetView):

    @event_logger.log_this
    @api
    @handle_api_exception
    @has_access_api
    @expose("/v1/query/", methods=["POST"])
    def query(self) -> FlaskResponse:
        """
        Takes a query_obj constructed in the client and returns payload data response
        for the given query_obj.

        raises SupersetSecurityException: If the user cannot access the resource
        """
        query_context = QueryContext(**json.loads(request.form["query_context"]))
        query_context.raise_for_access()
        result = query_context.get_payload()
        payload_json = result["queries"]
        return json.dumps(
            payload_json, default=utils.json_int_dttm_ser, ignore_nan=True
        )

    @event_logger.log_this
    @api
    @handle_api_exception
    @has_access_api
    @expose("/v1/form_data/", methods=["GET"])
    def query_form_data(self) -> FlaskResponse:
        """
        Get the formdata stored in the database for existing slice.
        params: slice_id: integer
        """
        form_data = {}
        slice_id = request.args.get("slice_id")
        if slice_id:
            slc = db.session.query(Slice).filter_by(id=slice_id).one_or_none()
            if slc:
                form_data = slc.form_data.copy()

        update_time_range(form_data)

        return json.dumps(form_data)

    @use_ip_auth
    @api
    @event_logger.log_this
    @handle_api_exception
    @expose("/v1/dashboard_import/", methods=["POST"])
    def import_dashboard(self):
        """
         It checks if there is any dashboard of that slug name in the common bucket of s3. If yes, it pulls that file.

        """
        slug = request.get_json()["slug"]
        isPublished = request.get_json()["isPublished"]
        g.user = security_manager.find_user(username="admin")
        if slug:
            #get file from common bucket
            file_name = slug+".json"
            #  TODO: temp changes
            #s3_utils.get_file_data(environ['COMMON_CONFIG_DATA_BUCKET'], app.config["DASHBOARD_OBJECT_PATH"] + slug + ".json", file_name)
            try:
              with open(file_name, 'r') as data_stream:
              #call import dashboard function
                dashboard_ids = import_dashboards(db.session, data_stream)
                if isPublished:
                  if dashboard_ids and len(dashboard_ids) > 0:
                    for dashboard_id in dashboard_ids:
                      Dashboard = models.Dashboard
                      dash = (db.session.query(Dashboard).filter(Dashboard.id == dashboard_id).one_or_none())
                      dash.published = True
                      db.session.commit()
                      
                return json_success(json.dumps({"dashboard_imported": True}))
            except Exception as e:
                logging.error("Error when importing dashboard from file %s", file_name)
                logging.error(e)
                return json_error_response(
                    "ERROR: cannot import from {0} file".format(file_name), status=500
                )
        return json_error_response(
              "ERROR: cannot find slug name", status=404
          )
    @api
    @handle_api_exception
    @has_access_api
    @rison(get_time_range_schema)
    @expose("/v1/time_range/", methods=["GET"])
    def time_range(self, **kwargs: Any) -> FlaskResponse:
        """Get actually time range from human readable string or datetime expression"""
        time_range = kwargs["rison"]
        try:
            since, until = get_since_until(time_range)
            result = {
                "since": since.isoformat() if since else "",
                "until": until.isoformat() if until else "",
                "timeRange": time_range,
            }
            return self.json_response({"result": result})
        except (ValueError, TimeRangeParseFailError, TimeRangeUnclearError) as error:
            error_msg = {"message": f"Unexpected time range: {error}"}
            return self.json_response(error_msg, 400)
