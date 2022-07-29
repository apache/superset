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
# pylint: disable=too-many-lines
import logging

from flask import request, Response
from flask_appbuilder.api import expose, protect, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from marshmallow import ValidationError

from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.extensions import event_logger
from superset.models.tags import ObjectTypes, Tag
from superset.tags.commands.create import CreateTagCommand
from superset.tags.commands.exceptions import (
    TagCreateFailedError,
    TagInvalidError,
)
from superset.tags.schemas import (
    TagGetResponseSchema,
    TagPostSchema,
    openapi_spec_methods_override,
)
from superset.views.base_api import (
    BaseSupersetModelRestApi,
    statsd_metrics,
)

logger = logging.getLogger(__name__)


class TagRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(Tag)

    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET

    resource_name = "tag"
    allow_browser_login = True

    class_permission_name = "Tag"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP

    list_columns = [
        "id",
        "name",
        "type",
    ]

    list_select_columns = list_columns

    add_model_schema = TagPostSchema()
    tag_get_response_schema = TagGetResponseSchema()

    openapi_spec_tag = "Tags"
    """ Override the name set for this collection of endpoints """
    openapi_spec_component_schemas = (
        TagGetResponseSchema,
    )
    apispec_parameter_schemas = {}
    openapi_spec_methods = openapi_spec_methods_override
    """ Overrides GET methods OpenApi descriptions """

    def __repr__(self) -> str:
        """Deterministic string representation of the API instance for etag_cache."""
        return "Superset.tags.api.TagRestApi@v{}{}".format(
            self.appbuilder.app.config["VERSION_STRING"],
            self.appbuilder.app.config["VERSION_SHA"],
        )

    @expose("/<int:object_type>/<int:object_id>/", methods=["POST"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post",
        log_to_statsd=False,
    )
    def post(self, object_type: ObjectTypes, object_id: int) -> Response:
        """Adds new tags to an object.
        ---
        post:
          description: >-
            Add new tags to an object..
          requestBody:
            description: Tag schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
          parameters:
          - in: path
            schema:
              type: integer
            name: object_type
          - in: path
            schema:
              type: integer
            name: object_id
          responses:
            201:
              description: Tag added
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: number
                      result:
                        $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
            302:
              description: Redirects to the current digest
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            item = self.add_model_schema.load(request.json)
        # This validates custom Schema with custom validations
        except ValidationError as error:
            return self.response_400(message=error.messages)
        try:
            new_model = CreateTagCommand(object_type, object_id, item).run()
            return self.response(201, id=new_model.id, result=item)
        except TagInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())
        except TagCreateFailedError as ex:
            logger.error(
                "Error creating model %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))
