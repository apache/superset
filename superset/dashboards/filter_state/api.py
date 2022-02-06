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
from typing import Type

from flask import Response
from flask_appbuilder.api import expose, protect, safe

from superset.dashboards.filter_state.commands.create import CreateFilterStateCommand
from superset.dashboards.filter_state.commands.delete import DeleteFilterStateCommand
from superset.dashboards.filter_state.commands.get import GetFilterStateCommand
from superset.dashboards.filter_state.commands.update import UpdateFilterStateCommand
from superset.extensions import event_logger
from superset.key_value.api import KeyValueRestApi

logger = logging.getLogger(__name__)


class DashboardFilterStateRestApi(KeyValueRestApi):
    class_permission_name = "FilterStateRestApi"
    resource_name = "dashboard"
    openapi_spec_tag = "Filter State"

    def get_create_command(self) -> Type[CreateFilterStateCommand]:
        return CreateFilterStateCommand

    def get_update_command(self) -> Type[UpdateFilterStateCommand]:
        return UpdateFilterStateCommand

    def get_get_command(self) -> Type[GetFilterStateCommand]:
        return GetFilterStateCommand

    def get_delete_command(self) -> Type[DeleteFilterStateCommand]:
        return DeleteFilterStateCommand

    @expose("/<int:pk>/filter_state", methods=["POST"])
    @protect()
    @safe
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post",
        log_to_statsd=False,
    )
    def post(self, pk: int) -> Response:
        """Stores a new value.
        ---
        post:
          description: >-
            Stores a new value.
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/KeyValuePostSchema'
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

    @expose("/<int:pk>/filter_state/<string:key>/", methods=["PUT"])
    @protect()
    @safe
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.put",
        log_to_statsd=False,
    )
    def put(self, pk: int, key: str) -> Response:
        """Updates an existing value.
        ---
        put:
          description: >-
            Updates an existing value.
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          - in: path
            schema:
              type: string
            name: key
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/KeyValuePutSchema'
          responses:
            200:
              description: The value was stored successfully.
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
        return super().put(pk, key)

    @expose("/<int:pk>/filter_state/<string:key>/", methods=["GET"])
    @protect()
    @safe
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get",
        log_to_statsd=False,
    )
    def get(self, pk: int, key: str) -> Response:
        """Retrives a value.
        ---
        get:
          description: >-
            Retrives a value.
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

    @expose("/<int:pk>/filter_state/<string:key>/", methods=["DELETE"])
    @protect()
    @safe
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.delete",
        log_to_statsd=False,
    )
    def delete(self, pk: int, key: str) -> Response:
        """Deletes a value.
        ---
        delete:
          description: >-
            Deletes a value.
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
