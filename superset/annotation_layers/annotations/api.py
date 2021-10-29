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
from typing import Any, Dict

from flask import g, request, Response
from flask_appbuilder.api import expose, permission_name, protect, rison, safe
from flask_appbuilder.api.schemas import get_item_schema, get_list_schema
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import ngettext
from marshmallow import ValidationError

from superset.annotation_layers.annotations.commands.bulk_delete import (
    BulkDeleteAnnotationCommand,
)
from superset.annotation_layers.annotations.commands.create import (
    CreateAnnotationCommand,
)
from superset.annotation_layers.annotations.commands.delete import (
    DeleteAnnotationCommand,
)
from superset.annotation_layers.annotations.commands.exceptions import (
    AnnotationBulkDeleteFailedError,
    AnnotationCreateFailedError,
    AnnotationDeleteFailedError,
    AnnotationInvalidError,
    AnnotationNotFoundError,
    AnnotationUpdateFailedError,
)
from superset.annotation_layers.annotations.commands.update import (
    UpdateAnnotationCommand,
)
from superset.annotation_layers.annotations.filters import AnnotationAllTextFilter
from superset.annotation_layers.annotations.schemas import (
    AnnotationPostSchema,
    AnnotationPutSchema,
    get_delete_ids_schema,
    openapi_spec_methods_override,
)
from superset.annotation_layers.commands.exceptions import AnnotationLayerNotFoundError
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.models.annotations import Annotation
from superset.views.base_api import BaseSupersetModelRestApi, statsd_metrics

logger = logging.getLogger(__name__)


class AnnotationRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(Annotation)

    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {
        "bulk_delete",  # not using RouteMethod since locally defined
    }
    class_permission_name = "Annotation"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP

    resource_name = "annotation_layer"
    allow_browser_login = True

    show_columns = [
        "id",
        "short_descr",
        "long_descr",
        "start_dttm",
        "end_dttm",
        "json_metadata",
        "layer.id",
        "layer.name",
    ]
    list_columns = [
        "id",
        "changed_by.first_name",
        "changed_by.id",
        "changed_on_delta_humanized",
        "created_by.first_name",
        "created_by.id",
        "end_dttm",
        "long_descr",
        "short_descr",
        "start_dttm",
    ]
    add_columns = [
        "short_descr",
        "long_descr",
        "start_dttm",
        "end_dttm",
        "json_metadata",
    ]
    add_model_schema = AnnotationPostSchema()
    edit_model_schema = AnnotationPutSchema()
    edit_columns = add_columns
    order_columns = [
        "changed_by.first_name",
        "changed_on_delta_humanized",
        "created_by.first_name",
        "end_dttm",
        "long_descr",
        "short_descr",
        "start_dttm",
    ]

    search_filters = {"short_descr": [AnnotationAllTextFilter]}

    apispec_parameter_schemas = {
        "get_delete_ids_schema": get_delete_ids_schema,
    }
    openapi_spec_tag = "Annotation Layers"
    openapi_spec_methods = openapi_spec_methods_override

    @staticmethod
    def _apply_layered_relation_to_rison(  # pylint: disable=invalid-name
        layer_id: int, rison_parameters: Dict[str, Any]
    ) -> None:
        if "filters" not in rison_parameters:
            rison_parameters["filters"] = []
        rison_parameters["filters"].append(
            {"col": "layer", "opr": "rel_o_m", "value": layer_id}
        )

    @expose("/<int:pk>/annotation/", methods=["GET"])
    @protect()
    @safe
    @permission_name("get")
    @rison(get_list_schema)
    def get_list(  # pylint: disable=arguments-differ
        self, pk: int, **kwargs: Any
    ) -> Response:
        """Get a list of annotations
        ---
        get:
          description: >-
            Get a list of annotations
          parameters:
          - in: path
            schema:
              type: integer
            description: The annotation layer id for this annotation
            name: pk
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_list_schema'
          responses:
            200:
              description: Items from Annotations
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      ids:
                        description: >-
                          A list of annotation ids
                        type: array
                        items:
                          type: string
                      count:
                        description: >-
                          The total record count on the backend
                        type: number
                      result:
                        description: >-
                          The result from the get list query
                        type: array
                        items:
                          $ref: '#/components/schemas/{{self.__class__.__name__}}.get_list'  # pylint: disable=line-too-long
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        self._apply_layered_relation_to_rison(pk, kwargs["rison"])
        return self.get_list_headless(**kwargs)

    @expose("/<int:pk>/annotation/<int:annotation_id>", methods=["GET"])
    @protect()
    @safe
    @permission_name("get")
    @rison(get_item_schema)
    def get(  # pylint: disable=arguments-differ
        self, pk: int, annotation_id: int, **kwargs: Any
    ) -> Response:
        """Get item from Model
        ---
        get:
          description: >-
            Get an item model
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
            description: The annotation layer pk for this annotation
          - in: path
            schema:
              type: integer
            name: annotation_id
            description: The annotation pk
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_item_schema'
          responses:
            200:
              description: Item from Model
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        description: The item id
                        type: string
                      result:
                        $ref: '#/components/schemas/{{self.__class__.__name__}}.get'
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
        self._apply_layered_relation_to_rison(pk, kwargs["rison"])
        return self.get_headless(annotation_id, **kwargs)

    @expose("/<int:pk>/annotation/", methods=["POST"])
    @protect()
    @safe
    @statsd_metrics
    @permission_name("post")
    def post(self, pk: int) -> Response:  # pylint: disable=arguments-differ
        """Creates a new Annotation
        ---
        post:
          description: >-
            Create a new Annotation
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
            item["layer"] = pk
        # This validates custom Schema with custom validations
        except ValidationError as error:
            return self.response_400(message=error.messages)
        try:
            new_model = CreateAnnotationCommand(g.user, item).run()
            return self.response(201, id=new_model.id, result=item)
        except AnnotationLayerNotFoundError as ex:
            return self.response_400(message=str(ex))
        except AnnotationInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())
        except AnnotationCreateFailedError as ex:
            logger.error(
                "Error creating annotation %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))

    @expose("/<int:pk>/annotation/<int:annotation_id>", methods=["PUT"])
    @protect()
    @safe
    @statsd_metrics
    @permission_name("put")
    def put(  # pylint: disable=arguments-differ
        self, pk: int, annotation_id: int
    ) -> Response:
        """Updates an Annotation
        ---
        put:
          description: >-
            Update an annotation
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
            description: The annotation layer pk for this annotation
          - in: path
            schema:
              type: integer
            name: annotation_id
            description: The annotation pk for this annotation
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
            new_model = UpdateAnnotationCommand(g.user, annotation_id, item).run()
            return self.response(200, id=new_model.id, result=item)
        except (AnnotationNotFoundError, AnnotationLayerNotFoundError):
            return self.response_404()
        except AnnotationInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())
        except AnnotationUpdateFailedError as ex:
            logger.error(
                "Error updating annotation %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))

    @expose("/<int:pk>/annotation/<int:annotation_id>", methods=["DELETE"])
    @protect()
    @safe
    @statsd_metrics
    @permission_name("delete")
    def delete(  # pylint: disable=arguments-differ
        self, pk: int, annotation_id: int
    ) -> Response:
        """Deletes an Annotation
        ---
        delete:
          description: >-
            Delete an annotation
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
            description: The annotation layer pk for this annotation
          - in: path
            schema:
              type: integer
            name: annotation_id
            description: The annotation pk for this annotation
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
            DeleteAnnotationCommand(g.user, annotation_id).run()
            return self.response(200, message="OK")
        except AnnotationNotFoundError:
            return self.response_404()
        except AnnotationDeleteFailedError as ex:
            logger.error(
                "Error deleting annotation %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))

    @expose("/<int:pk>/annotation/", methods=["DELETE"])
    @protect()
    @safe
    @statsd_metrics
    @rison(get_delete_ids_schema)
    def bulk_delete(self, **kwargs: Any) -> Response:
        """Delete bulk Annotation layers
        ---
        delete:
          description: >-
            Deletes multiple annotation in a bulk operation.
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
            description: The annotation layer pk for this annotation
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_delete_ids_schema'
          responses:
            200:
              description: Annotations bulk delete
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
            BulkDeleteAnnotationCommand(g.user, item_ids).run()
            return self.response(
                200,
                message=ngettext(
                    "Deleted %(num)d annotation",
                    "Deleted %(num)d annotations",
                    num=len(item_ids),
                ),
            )
        except AnnotationNotFoundError:
            return self.response_404()
        except AnnotationBulkDeleteFailedError as ex:
            return self.response_422(message=str(ex))
