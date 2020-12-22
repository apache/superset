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
from typing import Any

import simplejson as json
from flask import request
from flask_appbuilder import expose
from flask_appbuilder.api import rison
from flask_appbuilder.security.decorators import has_access_api

from superset import db, event_logger
from superset.common.query_context import QueryContext
from superset.legacy import update_time_range
from superset.models.slice import Slice
from superset.typing import FlaskResponse
from superset.utils import core as utils
from superset.utils.core import get_since_until
from superset.views.base import api, BaseSupersetView, handle_api_exception

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
        except ValueError as error:
            error_msg = {"message": f"Unexpected time range: {error}"}
            return self.json_response(error_msg, 400)
