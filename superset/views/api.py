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
from __future__ import annotations

import logging
from typing import Any, TYPE_CHECKING

import requests
from flask import g, request
from flask_appbuilder import expose
from flask_appbuilder.api import rison
from flask_appbuilder.security.decorators import has_access_api
from flask_babel import lazy_gettext as _

from superset import db, event_logger
from superset.commands.chart.exceptions import (
    TimeRangeAmbiguousError,
    TimeRangeParseFailError,
)
from superset.legacy import update_time_range
from superset.models.slice import Slice
from superset.superset_typing import FlaskResponse
from superset.utils import json
from superset.utils.date_parser import get_since_until
from superset.views.base import api, BaseSupersetView
from superset.views.error_handling import handle_api_exception

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from superset.common.query_context_factory import QueryContextFactory

get_time_range_schema = {
    "type": ["string", "array"],
    "items": {
        "type": "object",
        "properties": {
            "timeRange": {"type": "string"},
            "shift": {"type": "string"},
        },
    },
}


class Api(BaseSupersetView):
    query_context_factory = None

    @event_logger.log_this
    @api
    @handle_api_exception
    @has_access_api
    @expose("/v1/query/", methods=("POST",))
    def query(self) -> FlaskResponse:
        """
        Take a query_obj constructed in the client and returns payload data response
        for the given query_obj.

        raises SupersetSecurityException: If the user cannot access the resource
        """
        query_context = self.get_query_context_factory().create(
            **json.loads(request.form["query_context"])
        )
        query_context.raise_for_access()
        result = query_context.get_payload()
        payload_json = result["queries"]
        return json.dumps(payload_json, default=json.json_int_dttm_ser, ignore_nan=True)

    @event_logger.log_this
    @api
    @handle_api_exception
    @has_access_api
    @expose("/v1/form_data/", methods=("GET",))
    def query_form_data(self) -> FlaskResponse:
        """
        Get the form_data stored in the database for existing slice.
        params: slice_id: integer
        """
        form_data = {}
        if slice_id := request.args.get("slice_id"):
            slc = db.session.query(Slice).filter_by(id=slice_id).one_or_none()
            if slc:
                form_data = slc.form_data.copy()

        update_time_range(form_data)

        return self.json_response(form_data)

    @api
    @handle_api_exception
    @has_access_api
    @rison(get_time_range_schema)
    @expose("/v1/time_range/", methods=("GET",))
    def time_range(self, **kwargs: Any) -> FlaskResponse:
        """Get actually time range from human-readable string or datetime expression."""
        time_ranges = kwargs["rison"]
        try:
            if isinstance(time_ranges, str):
                time_ranges = [{"timeRange": time_ranges}]

            rv = []
            for time_range in time_ranges:
                since, until = get_since_until(
                    time_range=time_range["timeRange"],
                    time_shift=time_range.get("shift"),
                )
                rv.append(
                    {
                        "since": since.isoformat() if since else "",
                        "until": until.isoformat() if until else "",
                        "timeRange": time_range["timeRange"],
                        "shift": time_range.get("shift"),
                    }
                )
            return self.json_response({"result": rv})
        except (ValueError, TimeRangeParseFailError, TimeRangeAmbiguousError) as error:
            error_msg = {"message": _("Unexpected time range: %(error)s", error=error)}
            return self.json_response(error_msg, 400)

    @event_logger.log_this
    @api
    @handle_api_exception
    @expose("/v1/proxy/", methods=("POST",))
    def proxy_external_api(self) -> FlaskResponse:
        """
        Proxy external API calls to bypass CSP restrictions.
        This endpoint allows Button components to make external API calls
        through Superset's backend, avoiding browser CSP limitations.
        
        Requires authenticated user (any logged-in user can use this).
        """
        # Check if user is authenticated
        if not hasattr(g, "user") or not g.user:
            return self.json_response(
                {"error": "Authentication required"}, 401
            )
        
        try:
            data = request.get_json() or {}
            url = data.get("url")
            method = data.get("method", "GET").upper()
            headers = data.get("headers", {})
            payload = data.get("payload")

            if not url:
                return self.json_response(
                    {"error": "URL is required"}, 400
                )

            # Validate URL format
            if not url.startswith(("http://", "https://")):
                return self.json_response(
                    {"error": "Invalid URL format. Must start with http:// or https://"}, 400
                )

            # Make the external API request
            request_kwargs = {
                "method": method,
                "headers": headers,
                "timeout": 30,
            }

            if payload and method in ("POST", "PUT", "PATCH"):
                if isinstance(payload, dict):
                    request_kwargs["json"] = payload
                else:
                    request_kwargs["data"] = payload

            response = requests.request(url=url, **request_kwargs)

            # Return the response
            try:
                response_data = response.json()
            except ValueError:
                response_data = response.text

            # Always return 200 from proxy, but include the actual status in the response body
            # This allows the frontend to handle different status codes appropriately
            return self.json_response({
                "status": response.status_code,
                "data": response_data,
                "headers": dict(response.headers),
                "ok": 200 <= response.status_code < 300,
            })

        except requests.exceptions.RequestException as e:
            logger.error("Proxy request failed: %s", str(e))
            return self.json_response(
                {"error": f"Request failed: {str(e)}"}, 500
            )
        except Exception as e:
            logger.error("Unexpected error in proxy: %s", str(e))
            return self.json_response(
                {"error": f"Unexpected error: {str(e)}"}, 500
            )

    def get_query_context_factory(self) -> QueryContextFactory:
        if self.query_context_factory is None:
            # pylint: disable=import-outside-toplevel
            from superset.common.query_context_factory import QueryContextFactory

            self.query_context_factory = QueryContextFactory()
        return self.query_context_factory
