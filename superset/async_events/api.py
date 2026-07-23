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
import logging

from flask import request, Response
from flask_appbuilder import expose
from flask_appbuilder.api import safe
from flask_appbuilder.security.decorators import permission_name, protect

from superset.async_events.async_query_manager import (
    AsyncQueryJobException,
    AsyncQueryTokenException,
)
from superset.extensions import async_query_manager, event_logger
from superset.utils.core import get_user_id
from superset.views.base_api import BaseSupersetApi, statsd_metrics

logger = logging.getLogger(__name__)


class AsyncEventsRestApi(BaseSupersetApi):
    resource_name = "async_event"
    allow_browser_login = True

    @expose("/", methods=("GET",))
    @event_logger.log_this
    @protect()
    @safe
    @statsd_metrics
    @permission_name("list")
    def events(self) -> Response:
        """
        Read off of the Redis async events stream, using the user's JWT token and
        optional query params for last event received.
        ---
        get:
          summary: Read off of the Redis events stream
          description: >-
            Reads off of the Redis events stream, using the user's JWT token and
            optional query params for last event received.
          parameters:
          - in: query
            name: last_id
            description: Last ID received by the client
            schema:
                type: string
          responses:
            200:
              description: Async event results
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                        result:
                            type: array
                            items:
                              type: object
                              properties:
                                id:
                                  type: string
                                channel_id:
                                  type: string
                                job_id:
                                  type: string
                                user_id:
                                  type: integer
                                status:
                                  type: string
                                errors:
                                  type: array
                                  items:
                                    type: object
                                result_url:
                                  type: string
            401:
              $ref: '#/components/responses/401'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            async_channel_id = async_query_manager.parse_channel_id_from_request(
                request
            )
            last_event_id = request.args.get("last_id")
            events = async_query_manager.read_events(async_channel_id, last_event_id)

        except AsyncQueryTokenException:
            return self.response_401()

        return self.response(200, result=events)

    @expose("/<job_id>/cancel", methods=("POST",))
    @event_logger.log_this
    @protect()
    @safe
    @statsd_metrics
    @permission_name("list")
    def cancel(self, job_id: str) -> Response:
        """Cancel a running async query job.
        ---
        post:
          summary: Cancel a running async query job
          description: >-
            Revokes the Celery task backing an in-flight async query. The
            caller is authorized against the job's original owner (channel and
            user), both resolved server-side from the request, so a client
            cannot cancel a job it did not submit.
          parameters:
          - in: path
            name: job_id
            required: true
            description: The job ID returned when the async query was submitted
            schema:
              type: string
          responses:
            200:
              description: Job cancelled
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: object
                        properties:
                          job_id:
                            type: string
                          status:
                            type: string
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            async_channel_id = async_query_manager.parse_channel_id_from_request(
                request
            )
        except AsyncQueryTokenException:
            return self.response_401()

        try:
            async_query_manager.cancel_job(job_id, async_channel_id, get_user_id())
        except AsyncQueryTokenException:
            return self.response_403()
        except AsyncQueryJobException:
            return self.response_404()

        return self.response(
            200,
            result={"job_id": job_id, "status": async_query_manager.STATUS_CANCELLED},
        )
