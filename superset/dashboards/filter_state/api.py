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

from flask import Response
from flask_appbuilder.api import expose, protect, safe

from superset.commands.dashboard.filter_state.create import CreateFilterStateCommand
from superset.commands.dashboard.filter_state.delete import DeleteFilterStateCommand
from superset.commands.dashboard.filter_state.get import GetFilterStateCommand
from superset.commands.dashboard.filter_state.update import UpdateFilterStateCommand
from superset.extensions import event_logger
from superset.temporary_cache.api import TemporaryCacheRestApi

logger = logging.getLogger(__name__)


class DashboardFilterStateRestApi(TemporaryCacheRestApi):
    class_permission_name = "DashboardFilterStateRestApi"
    resource_name = "dashboard"
    openapi_spec_tag = "Dashboard Filter State"

    def get_create_command(self) -> type[CreateFilterStateCommand]:
        return CreateFilterStateCommand

    def get_update_command(self) -> type[UpdateFilterStateCommand]:
        return UpdateFilterStateCommand

    def get_get_command(self) -> type[GetFilterStateCommand]:
        return GetFilterStateCommand

    def get_delete_command(self) -> type[DeleteFilterStateCommand]:
        return DeleteFilterStateCommand

    @expose("/<int:pk>/filter_state", methods=("POST",))
    @protect()
    @safe
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post",
        log_to_statsd=False,
    )
    def post(self, pk: int) -> Response:
        """Create a dashboard's filter state.
        ---
        post:
          summary: Create a dashboard's filter state
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          - in: query
            schema:
              type: integer
            name: tab_id
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/TemporaryCachePostSchema'
                examples:
                  time_grain_filter:
                    summary: "Time Grain Filter"
                    description: "**This body should be stringified and put into the
                    value field.**"
                    value:
                      id: NATIVE_FILTER_ID
                      extraFormData:
                        time_grain_sqla: "P1W/1970-01-03T00:00:00Z"
                      filterState:
                        label: "Week ending Saturday"
                        value:
                          - "P1W/1970-01-03T00:00:00Z"
                  timecolumn_filter:
                    summary: "Time Column Filter"
                    description: "**This body should be stringified and put into the
                    value field.**"
                    value:
                      id: NATIVE_FILTER_ID
                      extraFormData:
                        granularity_sqla: "order_date"
                      filterState:
                        value:
                          - "order_date"
                  time_range_filter:
                    summary: "Time Range Filter"
                    description: "**This body should be stringified and put into the
                    value field.**"
                    value:
                      id: NATIVE_FILTER_ID
                      extraFormData:
                        time_range: >-
                          DATEADD(DATETIME('2025-01-16T00:00:00'), -7, day)
                          : 2025-01-16T00:00:00
                      filterState:
                        value: >-
                          DATEADD(DATETIME('2025-01-16T00:00:00'), -7, day)
                          : 2025-01-16T00:00:00
                  numerical_range_filter:
                    summary: "Numerical Range Filter"
                    description: "**This body should be stringified and put into the
                    value field.**"
                    value:
                      id: NATIVE_FILTER_ID
                      extraFormData:
                        filters:
                          - col: "tz_offset"
                            op: ">="
                            val:
                              - 1000
                          - col: "tz_offset"
                            op: "<="
                            val:
                              - 2000
                      filterState:
                        value:
                          - 1000
                          - 2000
                        label: "1000 <= x <= 2000"
                  value_filter:
                    summary: "Value Filter"
                    description: "**This body should be stringified and put into the
                    value field.**"
                    value:
                      id: NATIVE_FILTER_ID
                      extraFormData:
                        filters:
                          - col: "real_name"
                            op: "IN"
                            val:
                              - "John Doe"
                      filterState:
                        value:
                          - "John Doe"
          responses:
            201:
              description: The value was stored successfully.
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      key:
                        type: string
                        description: The key to retrieve the value.
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        return super().post(pk)

    @expose("/<int:pk>/filter_state/<string:key>", methods=("PUT",))
    @protect()
    @safe
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.put",
        log_to_statsd=False,
    )
    def put(self, pk: int, key: str) -> Response:
        """Update a dashboard's filter state value.
        ---
        put:
          summary: Update a dashboard's filter state value
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          - in: path
            schema:
              type: string
            name: key
          - in: query
            schema:
              type: integer
            name: tab_id
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/TemporaryCachePutSchema'
          responses:
            200:
              description: The value was stored successfully.
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      key:
                        type: string
                        description: The key to retrieve the value.
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        return super().put(pk, key)

    @expose("/<int:pk>/filter_state/<string:key>", methods=("GET",))
    @protect()
    @safe
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get",
        log_to_statsd=False,
    )
    def get(self, pk: int, key: str) -> Response:
        """Get a dashboard's filter state value.
        ---
        get:
          summary: Get a dashboard's filter state value
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          - in: path
            schema:
              type: string
            name: key
          responses:
            200:
              description: Returns the stored value.
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      value:
                        type: string
                        description: The stored value
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        return super().get(pk, key)

    @expose("/<int:pk>/filter_state/<string:key>", methods=("DELETE",))
    @protect()
    @safe
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.delete",
        log_to_statsd=False,
    )
    def delete(self, pk: int, key: str) -> Response:
        """Delete a dashboard's filter state value.
        ---
        delete:
          summary: Delete a dashboard's filter state value
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          - in: path
            schema:
              type: string
            name: key
            description: The value key.
          responses:
            200:
              description: Deleted the stored value.
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
                        description: The result of the operation
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        return super().delete(pk, key)
