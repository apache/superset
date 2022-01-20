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

from superset.charts.form_data.commands.create import CreateFormDataCommand
from superset.charts.form_data.commands.delete import DeleteFormDataCommand
from superset.charts.form_data.commands.get import GetFormDataCommand
from superset.charts.form_data.commands.update import UpdateFormDataCommand
from superset.extensions import event_logger
from superset.key_value.api import KeyValueRestApi

logger = logging.getLogger(__name__)


class ChartFormDataRestApi(KeyValueRestApi):
    class_permission_name = "ChartFormDataRestApi"
    resource_name = "chart"
    openapi_spec_tag = "Chart Form Data"

    def get_create_command(self) -> Type[CreateFormDataCommand]:
        return CreateFormDataCommand

    def get_update_command(self) -> Type[UpdateFormDataCommand]:
        return UpdateFormDataCommand

    def get_get_command(self) -> Type[GetFormDataCommand]:
        return GetFormDataCommand

    def get_delete_command(self) -> Type[DeleteFormDataCommand]:
        return DeleteFormDataCommand

    @expose("/<int:pk>/form_data", methods=["POST"])
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
          - in: query
            schema:
              type: integer
            name: dataset_id
            required: true
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

    @expose("/<int:pk>/form_data/<string:key>", methods=["PUT"])
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
          - in: query
            schema:
              type: integer
            name: dataset_id
            required: true
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

    @expose("/<int(signed=True):pk>/form_data/<string:key>", methods=["GET"])
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
          - in: query
            schema:
              type: integer
            name: dataset_id
            required: true
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

    @expose("/<int:pk>/form_data/<string:key>", methods=["DELETE"])
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
          - in: query
            schema:
              type: integer
            name: dataset_id
            required: true
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
