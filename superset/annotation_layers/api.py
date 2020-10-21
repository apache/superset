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
from typing import Any

from flask import g, request, Response
from flask_appbuilder.api import expose, permission_name, protect, rison, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import ngettext
from marshmallow import ValidationError

from superset.annotation_layers.commands.bulk_delete import (
    BulkDeleteAnnotationLayerCommand,
)
from superset.annotation_layers.commands.create import CreateAnnotationLayerCommand
from superset.annotation_layers.commands.delete import DeleteAnnotationLayerCommand
from superset.annotation_layers.commands.exceptions import (
    AnnotationLayerBulkDeleteFailedError,
    AnnotationLayerBulkDeleteIntegrityError,
    AnnotationLayerCreateFailedError,
    AnnotationLayerDeleteFailedError,
    AnnotationLayerDeleteIntegrityError,
    AnnotationLayerInvalidError,
    AnnotationLayerNotFoundError,
    AnnotationLayerUpdateFailedError,
)
from superset.annotation_layers.commands.update import UpdateAnnotationLayerCommand
from superset.annotation_layers.filters import AnnotationLayerAllTextFilter
from superset.annotation_layers.schemas import (
    AnnotationLayerPostSchema,
    AnnotationLayerPutSchema,
    get_delete_ids_schema,
    openapi_spec_methods_override,
)
from superset.constants import RouteMethod
from superset.models.annotations import AnnotationLayer
from superset.views.base_api import BaseSupersetModelRestApi, statsd_metrics

logger = logging.getLogger(__name__)


class AnnotationLayerRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(AnnotationLayer)

    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {
        "bulk_delete",  # not using RouteMethod since locally defined
    }
    class_permission_name = "AnnotationLayerModelView"
    resource_name = "annotation_layer"
    allow_browser_login = True

    show_columns = [
        "name",
        "descr",
    ]
    list_columns = [
        "name",
        "descr",
        "created_by.first_name",
        "created_by.last_name",
        "changed_by.first_name",
        "changed_by.last_name",
        "changed_on_delta_humanized",
    ]
    add_columns = ["name", "descr"]
    edit_columns = add_columns
    add_model_schema = AnnotationLayerPostSchema()
    edit_model_schema = AnnotationLayerPutSchema()

    order_columns = [
        "name",
        "descr",
        "created_by.first_name",
        "changed_by.first_name",
        "changed_on_delta_humanized",
    ]

    search_filters = {"name": [AnnotationLayerAllTextFilter]}

    apispec_parameter_schemas = {
        "get_delete_ids_schema": get_delete_ids_schema,
    }
    openapi_spec_tag = "Annotation Layers"
    openapi_spec_methods = openapi_spec_methods_override

    @expose("/<int:pk>", methods=["DELETE"])
    @protect()
    @safe
    @statsd_metrics
    @permission_name("delete")
    def delete(self, pk: int) -> Response:
        """Delete an annotation layer
        ---
        delete:
          description: >-
            Delete an annotation layer
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
            description: The annotation layer pk for this annotation
          responses:
            200:
              description: Item deleted
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            DeleteAnnotationLayerCommand(g.user, pk).run()
            return self.response(200, message="OK")
        except AnnotationLayerNotFoundError as ex:
            return self.response_404()
        except AnnotationLayerDeleteIntegrityError as ex:
            return self.response_422(message=str(ex))
        except AnnotationLayerDeleteFailedError as ex:
            logger.error(
                "Error deleting annotation layer %s: %s",
                self.__class__.__name__,
                str(ex),
            )
            return self.response_422(message=str(ex))

    @expose("/", methods=["POST"])
    @protect()
    @safe
    @statsd_metrics
    @permission_name("post")
    def post(self) -> Response:
        """Creates a new Annotation Layer
        ---
        post:
          description: >-
            Create a new Annotation
          requestBody:
            description: Annotation Layer schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
          responses:
            201:
              description: Annotation added
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: number
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
            item = self.add_model_schema.load(request.json)
        # This validates custom Schema with custom validations
        except ValidationError as error:
            return self.response_400(message=error.messages)
        try:
            new_model = CreateAnnotationLayerCommand(g.user, item).run()
            return self.response(201, id=new_model.id, result=item)
        except AnnotationLayerNotFoundError as ex:
            return self.response_400(message=str(ex))
        except AnnotationLayerInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())
        except AnnotationLayerCreateFailedError as ex:
            logger.error(
                "Error creating annotation %s: %s", self.__class__.__name__, str(ex)
            )
            return self.response_422(message=str(ex))

    @expose("/<int:pk>", methods=["PUT"])
    @protect()
    @safe
    @statsd_metrics
    @permission_name("put")
    def put(self, pk: int) -> Response:
        """Updates an Annotation Layer
        ---
        put:
          description: >-
            Update an annotation layer
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
            description: The annotation layer pk for this annotation
          requestBody:
            description: Annotation schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.put'
          responses:
            200:
              description: Annotation changed
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: number
                      result:
                        $ref: '#/components/schemas/{{self.__class__.__name__}}.put'
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
            item = self.edit_model_schema.load(request.json)
            item["layer"] = pk
        # This validates custom Schema with custom validations
        except ValidationError as error:
            return self.response_400(message=error.messages)
        try:
            new_model = UpdateAnnotationLayerCommand(g.user, pk, item).run()
            return self.response(200, id=new_model.id, result=item)
        except (AnnotationLayerNotFoundError) as ex:
            return self.response_404()
        except AnnotationLayerInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())
        except AnnotationLayerUpdateFailedError as ex:
            logger.error(
                "Error updating annotation %s: %s", self.__class__.__name__, str(ex)
            )
            return self.response_422(message=str(ex))

    @expose("/", methods=["DELETE"])
    @protect()
    @safe
    @statsd_metrics
    @rison(get_delete_ids_schema)
    def bulk_delete(self, **kwargs: Any) -> Response:
        """Delete bulk Annotation layers
        ---
        delete:
          description: >-
            Deletes multiple annotation layers in a bulk operation.
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_delete_ids_schema'
          responses:
            200:
              description: CSS templates bulk delete
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        item_ids = kwargs["rison"]
        try:
            BulkDeleteAnnotationLayerCommand(g.user, item_ids).run()
            return self.response(
                200,
                message=ngettext(
                    "Deleted %(num)d annotation layer",
                    "Deleted %(num)d annotation layers",
                    num=len(item_ids),
                ),
            )
        except AnnotationLayerNotFoundError:
            return self.response_404()
        except AnnotationLayerBulkDeleteIntegrityError as ex:
            return self.response_422(message=str(ex))
        except AnnotationLayerBulkDeleteFailedError as ex:
            return self.response_422(message=str(ex))
