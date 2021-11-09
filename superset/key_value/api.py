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

from flask import g, request, Response
from flask_appbuilder.api import expose, permission_name, protect, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface

from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.extensions import event_logger
from superset.key_value.commands.create import CreateKeyValueCommand
from superset.key_value.commands.delete import DeleteKeyValueCommand
from superset.key_value.commands.exceptions import (
    KeyValueCreateFailedError,
    KeyValueDeleteFailedError,
    KeyValueGetFailedError,
    KeyValueUpdateFailedError,
)
from superset.key_value.commands.get import GetKeyValueCommand
from superset.key_value.commands.update import UpdateKeyValueCommand
from superset.key_value.dao import KeyValueDAO
from superset.key_value.schemas import KeyValueSchema
from superset.models.key_value import KeyValue
from superset.views.base_api import BaseSupersetModelRestApi, statsd_metrics

logger = logging.getLogger(__name__)


class KeyValueRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(KeyValue)
    schema = KeyValueSchema()
    class_permission_name = "KeyValue"
    resource_name = "key_value_store"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP
    include_route_methods = {
        RouteMethod.POST,
        RouteMethod.PUT,
        RouteMethod.GET,
        RouteMethod.DELETE,
    }
    allow_browser_login = True
    openapi_spec_tag = "Key Value Store"

    @expose("/", methods=["POST"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post",
        log_to_statsd=False,
    )
    def post(self) -> Response:
        """Stores a new value.
        ---
        post:
          description: >-
            Stores a new value.
          requestBody:
            description: Key value schema
            required: true
            content:
              application/json:
                schema:
                    type: object
                    properties:
                      value:
                        type: string
                        description: Any type of JSON supported value.
                        required: true
                      duration_ms:
                        type: number
                        description: The duration of the value on the key store. If no duration is specified the value won't expire.
                        required: false
                        default: null
                      reset_duration_on_retrieval:
                        type: boolean
                        description: If the duration should be reset when the value is retrieved. This is useful if you wish to expire unused values but keep the ones that are actively retrieved.
                        required: false
                        default: true
          responses:
            201:
              description: The value was stored successfully. It returns the key to retrieve the value.
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
        if not request.is_json:
            return self.response_400(message="Request is not JSON")
        try:
            item = self.schema.load(request.json)
            key = CreateKeyValueCommand(g.user, item).run()
            return self.response(201, key=key)
        except KeyValueCreateFailedError as ex:
            logger.error(
                "Error creating value %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))

    @expose("/<string:key>/", methods=["PUT"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}",
        log_to_statsd=False,
    )
    def put(self, key: str) -> Response:
        """Updates an existing value.
        ---
        put:
          description: >-
            Updates an existing value.
          parameters:
          - in: key
            schema:
              type: string
            name: key
          requestBody:
            description: Key value schema
            required: true
            content:
              application/json:
                schema:
                    type: object
                    properties:
                      value:
                        type: string
                        description: Any type of JSON supported value.
                        required: true
                      duration_ms:
                        type: number
                        description: The duration of the value on the key store. If no duration is specified the value won't expire.
                        required: false
                        default: null
                      reset_duration_on_retrieval:
                        type: boolean
                        description: If the duration should be reset when the value is retrieved. This is useful if you wish to expire unused values but keep the ones that are actively retrieved.
                        required: false
                        default: true
          responses:
            201:
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
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
        if not request.is_json:
            return self.response_400(message="Request is not JSON")
        try:
            item = self.schema.load(request.json)
            model = UpdateKeyValueCommand(g.user, key, item).run()
            if not model:
                return self.response_404()
            return self.response(200, message="Value updated successfully.",)
        except KeyValueGetFailedError as ex:
            logger.error(
                "Error updating the value %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))

    @expose("/<string:key>/", methods=["GET"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}",
        log_to_statsd=False,
    )
    def get(self, key: str) -> Response:
        """Retrives a value.
        ---
        get:
          description: >-
            Retrives a value.
          parameters:
          - in: key
            schema:
              type: string
            name: key
          responses:
            201:
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      value:
                        type: string
                        description: Any type of JSON supported value.
                      duration_ms:
                        type: number
                        description: The duration of the value on the key store. If no duration is specified the value won't expire.
                      reset_duration_on_retrieval:
                        type: boolean
                        description: If the duration should be reset when the value is retrieved. This is useful if you wish to expire unused values but keep the ones that are actively retrieved.
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
        try:
            model = GetKeyValueCommand(g.user, key).run()
            if not model:
                return self.response_404()
            result = self.schema.dump(model)
            return self.response(
                200,
                duration_ms=result.get("duration_ms"),
                reset_duration_on_retrieval=result.get("reset_duration_on_retrieval"),
                value=result.get("value"),
            )
        except KeyValueGetFailedError as ex:
            logger.error(
                "Error accessing the value %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))

    @expose("/<string:key>/", methods=["DELETE"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}",
        log_to_statsd=False,
    )
    def delete(self, key: str) -> Response:
        """Deletes a value.
        ---
        delete:
          description: >-
            Deletes a value.
          parameters:
          - in: key
            schema:
              type: string
            name: key
          responses:
            201:
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
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
        try:
            model = DeleteKeyValueCommand(g.user, key).run()
            if not model:
                return self.response_404()
            return self.response(200, message="Deleted successfully")
        except KeyValueDeleteFailedError as ex:
            logger.error(
                "Error deleting the value %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))
