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

from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP
from superset.key_value.commands.create import CreateKeyValueCommand
from superset.key_value.commands.get import GetKeyValueCommand
from superset.key_value.commands.exceptions import (
    KeyValueCreateFailedError,
    KeyValueGetFailedError,
)
from superset.key_value.dao import KeyValueDAO
from superset.key_value.schemas import (
    KeyValuePostSchema,
    KeyValueGetSchema,
)
from superset.extensions import event_logger
from superset.models.core import KeyValuePair
from superset.views.base_api import BaseSupersetModelRestApi, statsd_metrics

logger = logging.getLogger(__name__)


class KeyValueRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(KeyValuePair)
    post_schema = KeyValuePostSchema()
    get_schema = KeyValueGetSchema()
    class_permission_name = "KeyValue"
    resource_name = "key_value_store"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP

    @expose("/", methods=["POST"])
    # @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post",
        log_to_statsd=False,
    )
    def post(self) -> Response:
        """Creates a new value
        ---
        post:
          description: >-
            Create a new value
          requestBody:
            description: Key value schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
          responses:
            201:
              description: Value added
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: UUID
                      result:
                        $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        if not request.is_json:
            return self.response_400(message="Request is not JSON")
        try:
            item = self.post_schema.load(request.json)
            new_model = CreateKeyValueCommand(g.user, item).run()
            return self.response(201, result=item)
        except KeyValueCreateFailedError as ex:
            logger.error(
                "Error creating value %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))

    @expose("/<string:key>/", methods=["GET"])
    #@protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}",
        log_to_statsd=False,
    )
    def get(self, key: str) -> Response:
        """Get charts and dashboards count associated to a dataset
        ---
        get:
          description:
            Get the value for a particular key
          parameters:
          - in: path
            name: pk
            schema:
              type: integer
          responses:
            200:
            200:
              description: Query result
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/DatasetRelatedObjectsResponse"
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            model = GetKeyValueCommand(g.user, key).run()
            if not model:
                return self.response_404()
            result = self.get_schema.dump(model)
            return self.response(200, result=result)
        except KeyValueGetFailedError as ex:
            logger.error(
                "Error accessing the value %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))
