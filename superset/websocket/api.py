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
"""REST API issuing connection tickets for the realtime websocket transport."""

from __future__ import annotations

from flask import current_app, Response
from flask_appbuilder.api import expose, protect, safe
from flask_appbuilder.security.decorators import permission_name

from superset.extensions import event_logger
from superset.views.base_api import BaseSupersetApi, statsd_metrics
from superset.websocket.channel import get_realtime_principal, mint_channel_token
from superset.websocket.permissions import REALTIME_NOTIFICATION_RESOURCE


class RealtimeRestApi(BaseSupersetApi):
    """Issues short-lived tickets the browser presents to the websocket server."""

    resource_name = "realtime"
    class_permission_name = REALTIME_NOTIFICATION_RESOURCE
    allow_browser_login = True
    openapi_spec_tag = "Realtime"

    @expose("/token/", methods=("GET",))
    @event_logger.log_this
    @protect()
    @safe
    @statsd_metrics
    @permission_name("read")
    def token(self) -> Response:
        """Get a websocket connection ticket for the current principal.
        ---
        get:
          summary: Get a websocket connection ticket
          description: >-
            Returns a short-lived JWT the client sends as the first frame of a
            websocket connection, and again on the open socket to refresh it
            before it expires.
          responses:
            200:
              description: A connection ticket and its lifetime in seconds
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      token:
                        type: string
                      expires_in:
                        type: integer
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
        """
        principal = get_realtime_principal()
        if principal is None:
            return self.response_401()
        return self.response(
            200,
            token=mint_channel_token(principal),
            expires_in=current_app.config["WEBSOCKET_JWT_EXPIRATION_SECONDS"],
        )
