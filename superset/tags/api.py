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

from flask import request, Response
from flask_appbuilder.api import expose, protect, rison, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from marshmallow import ValidationError

from superset.commands.tag.create import (
    CreateCustomTagCommand,
    CreateCustomTagWithRelationshipsCommand,
)
from superset.commands.tag.delete import DeleteTaggedObjectCommand, DeleteTagsCommand
from superset.commands.tag.exceptions import (
    TagDeleteFailedError,
    TaggedObjectDeleteFailedError,
    TaggedObjectNotFoundError,
    TagInvalidError,
    TagNotFoundError,
    TagUpdateFailedError,
)
from superset.commands.tag.update import UpdateTagCommand
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.daos.tag import TagDAO
from superset.exceptions import MissingUserContextException
from superset.extensions import event_logger
from superset.tags.models import ObjectType, Tag
from superset.tags.schemas import (
    delete_tags_schema,
    openapi_spec_methods_override,
    TaggedObjectEntityResponseSchema,
    TagGetResponseSchema,
    TagPostBulkSchema,
    TagPostSchema,
    TagPutSchema,
)
from superset.views.base_api import (
    BaseSupersetModelRestApi,
    RelatedFieldFilter,
    statsd_metrics,
)
from superset.views.filters import BaseFilterRelatedUsers, FilterRelatedOwners

logger = logging.getLogger(__name__)


class TagRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(Tag)
    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {
        RouteMethod.RELATED,
        "bulk_delete",
        "get_objects",
        "get_all_objects",
        "add_objects",
        "delete_object",
        "add_favorite",
        "remove_favorite",
        "favorite_status",
        "bulk_create",
    }

    resource_name = "tag"
    allow_browser_login = True

    class_permission_name = "Tag"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP

    list_columns = [
        "id",
        "name",
        "type",
        "description",
        "changed_by.first_name",
        "changed_by.last_name",
        "changed_on_delta_humanized",
        "created_on_delta_humanized",
        "created_by.first_name",
        "created_by.last_name",
    ]

    list_select_columns = list_columns

    show_columns = [
        "id",
        "name",
        "type",
        "description",
        "changed_by.first_name",
        "changed_by.last_name",
        "changed_on_delta_humanized",
        "created_on_delta_humanized",
        "created_by.first_name",
        "created_by.last_name",
        "created_by",
    ]

    base_related_field_filters = {
        "created_by": [["id", BaseFilterRelatedUsers, lambda: []]],
    }

    related_field_filters = {
        "created_by": RelatedFieldFilter("first_name", FilterRelatedOwners),
    }
    allowed_rel_fields = {"created_by", "changed_by"}

    add_model_schema = TagPostSchema()
    edit_model_schema = TagPutSchema()
    tag_get_response_schema = TagGetResponseSchema()
    object_entity_response_schema = TaggedObjectEntityResponseSchema()

    openapi_spec_tag = "Tags"
    """ Override the name set for this collection of endpoints """
    openapi_spec_component_schemas = (
        TagGetResponseSchema,
        TaggedObjectEntityResponseSchema,
    )
    apispec_parameter_schemas = {
        "delete_tags_schema": delete_tags_schema,
    }
    openapi_spec_methods = openapi_spec_methods_override
    """ Overrides GET methods OpenApi descriptions """

    def __repr__(self) -> str:
        """Deterministic string representation of the API instance for etag_cache."""
        return (
            "Superset.tags.api.TagRestApi@v"
            f'{self.appbuilder.app.config["VERSION_STRING"]}'
            f'{self.appbuilder.app.config["VERSION_SHA"]}'
        )

    @expose("/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post",
        log_to_statsd=False,
    )
    def post(self) -> Response:
        """Creates a new Tags and tag items
        ---
        post:
          description: >-
            Create a new Tag
          requestBody:
            description: Tag schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
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
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            item = self.add_model_schema.load(request.json)
        except ValidationError as error:
            return self.response_400(message=error.messages)
        try:
            CreateCustomTagWithRelationshipsCommand(item).run()
            return self.response(201)
        except TagInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())

    @expose("/bulk_create", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.bulk_create",
        log_to_statsd=False,
    )
    def bulk_create(self) -> Response:
        """Bulk create tags and tagged objects
        ---
        post:
          summary: Get all objects associated with a tag
          parameters:
          - in: path
            schema:
              type: integer
            name: tag_id
          requestBody:
            description: Tag schema
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    tags:
                      description: list of tag names to add to object
                      type: array
                      items:
                        type: string
                    objects_to_tag:
                      description: list of object names to add to object
                      type: array
                      items:
                        type: array
          responses:
            200:
              description: Tag added to favorites
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: object
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
            item = TagPostBulkSchema().load(request.json)
        except ValidationError as error:
            return self.response_400(message=error.messages)
        try:
            all_tagged_objects: set[tuple[str, int]] = set()
            all_skipped_tagged_objects: set[tuple[str, int]] = set()
            for tag in item.get("tags"):
                tagged_item: dict[str, Any] = self.add_model_schema.load(
                    {
                        "name": tag.get("name"),
                        "objects_to_tag": tag.get("objects_to_tag"),
                    }
                )
                (
                    objects_tagged,
                    objects_skipped,
                ) = CreateCustomTagWithRelationshipsCommand(
                    tagged_item, bulk_create=True
                ).run()
                all_tagged_objects = all_tagged_objects | objects_tagged
                all_skipped_tagged_objects = (
                    all_skipped_tagged_objects | objects_skipped
                )
            return self.response(
                200,
                result={
                    "objects_tagged": list(
                        all_tagged_objects - all_skipped_tagged_objects
                    ),
                    "objects_skipped": list(all_skipped_tagged_objects),
                },
            )
        except TagNotFoundError:
            return self.response_404()
        except TagInvalidError as ex:
            return self.response_422(message=ex.message)

    @expose("/<pk>", methods=("PUT",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.put",
        log_to_statsd=False,
    )
    def put(self, pk: int) -> Response:
        """Changes a Tag
        ---
        put:
          description: >-
            Changes a Tag.
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          requestBody:
            description: Chart schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.put'
          responses:
            200:
              description: Tag changed
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
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            item = self.edit_model_schema.load(request.json)
        # This validates custom Schema with custom validations
        except ValidationError as error:
            return self.response_400(message=error.messages)
        item = request.json
        try:
            changed_model = UpdateTagCommand(pk, item).run()
            response = self.response(200, id=changed_model.id, result=item)
        except TagUpdateFailedError as ex:
            response = self.response_422(message=str(ex))

        return response

    @expose("/<int:object_type>/<int:object_id>/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.add_objects",
        log_to_statsd=False,
    )
    def add_objects(self, object_type: ObjectType, object_id: int) -> Response:
        """Add tags to an object. Create new tags if they do not already exist.
        ---
        post:
          summary: Add tags to an object
          description: >-
            Adds tags to an object. Creates new tags if they do not already exist.
          requestBody:
            description: Tag schema
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    tags:
                      description: list of tag names to add to object
                      type: array
                      items:
                        type: string
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
            tags = request.json["properties"]["tags"]
            # This validates custom Schema with custom validations
            CreateCustomTagCommand(object_type, object_id, tags).run()
            return self.response(201)
        except KeyError:
            return self.response(
                400,
                message="Missing required field 'tags' in 'properties'",
            )
        except TagInvalidError:
            return self.response(422, message="Invalid tag")

    @expose("/<int:object_type>/<int:object_id>/<tag>/", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.delete_object",
        log_to_statsd=True,
    )
    def delete_object(
        self, object_type: ObjectType, object_id: int, tag: str
    ) -> Response:
        """Delete a tagged object.
        ---
        delete:
          summary: Delete a tagged object
          parameters:
          - in: path
            schema:
              type: string
            name: tag
          - in: path
            schema:
              type: integer
            name: object_type
          - in: path
            schema:
              type: integer
            name: object_id
          responses:
            200:
              description: Chart delete
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            DeleteTaggedObjectCommand(object_type, object_id, tag).run()
            return self.response(200, message="OK")
        except TagInvalidError:
            return self.response_422()
        except TagNotFoundError:
            return self.response_404()
        except TaggedObjectNotFoundError:
            return self.response_404()
        except TaggedObjectDeleteFailedError as ex:
            logger.error(
                "Error deleting tagged object %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))

    @expose("/", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    @rison(delete_tags_schema)
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.bulk_delete",
        log_to_statsd=False,
    )
    def bulk_delete(self, **kwargs: Any) -> Response:
        """Bulk delete tags. This will remove all tagged objects with this tag.
        ---
        delete:
          summary: Bulk delete tags
          description: >-
            Bulk deletes tags. This will remove all tagged objects with this tag.
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/delete_tags_schema'

          responses:
            200:
              description: Deletes multiple Tags
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        tags = kwargs["rison"]
        try:
            DeleteTagsCommand(tags).run()
            return self.response(200, message=f"Deleted {len(tags)} tags")
        except TagNotFoundError:
            return self.response_404()
        except TagInvalidError as ex:
            return self.response(422, message=f"Invalid tag parameters: {tags}. {ex}")
        except TagDeleteFailedError as ex:
            return self.response_422(message=str(ex))

    @expose("/get_objects/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get_objects",
        log_to_statsd=False,
    )
    def get_objects(self) -> Response:
        """Get all objects associated with a tag.
        ---
        get:
          summary: Get all objects associated with a tag
          parameters:
          - in: path
            schema:
              type: integer
            name: tag_id
          responses:
            200:
              description: List of tagged objects associated with a Tag
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: array
                        items:
                          $ref: '#/components/schemas/TaggedObjectEntityResponseSchema'
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
        tag_ids = [
            tag_id for tag_id in request.args.get("tagIds", "").split(",") if tag_id
        ]
        tags = [tag for tag in request.args.get("tags", "").split(",") if tag]
        # filter types
        types = [type_ for type_ in request.args.get("types", "").split(",") if type_]

        try:
            if tag_ids:
                # priotize using ids for lookups vs. names mainly using this
                # for backward compatibility
                tagged_objects = TagDAO.get_tagged_objects_by_tag_id(tag_ids, types)
            else:
                tagged_objects = TagDAO.get_tagged_objects_for_tags(tags, types)

            result = [
                self.object_entity_response_schema.dump(tagged_object)
                for tagged_object in tagged_objects
            ]
            return self.response(200, result=result)
        except TagInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())

    @expose("/favorite_status/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @rison({"type": "array", "items": {"type": "integer"}})
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        f".favorite_status",
        log_to_statsd=False,
    )
    def favorite_status(self, **kwargs: Any) -> Response:
        """Favorite Stars for Tags
        ---
        get:
          description: >-
            Get favorited tags for current user
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_fav_star_ids_schema'
          responses:
            200:
              description:
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/GetFavStarIdsSchema"
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
            requested_ids = kwargs["rison"]
            tags = TagDAO.find_by_ids(requested_ids)
            users_favorited_tags = TagDAO.favorited_ids(tags)
            res = [
                {"id": request_id, "value": request_id in users_favorited_tags}
                for request_id in requested_ids
            ]
            return self.response(200, result=res)
        except TagNotFoundError:
            return self.response_404()
        except MissingUserContextException as ex:
            return self.response_422(message=str(ex))

    @expose("/<pk>/favorites/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        f".add_favorite",
        log_to_statsd=False,
    )
    def add_favorite(self, pk: int) -> Response:
        """Marks the tag as favorite
        ---
        post:
          description: >-
            Marks the tag as favorite for the current user
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          responses:
            200:
              description: Tag added to favorites
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: object
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
            TagDAO.favorite_tag_by_id_for_current_user(pk)
            return self.response(200, result="OK")
        except TagNotFoundError:
            return self.response_404()
        except MissingUserContextException as ex:
            return self.response_422(message=str(ex))

    @expose("/<pk>/favorites/", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        f".remove_favorite",
        log_to_statsd=False,
    )
    def remove_favorite(self, pk: int) -> Response:
        """Remove the tag from the user favorite list
        ---
        delete:
          description: >-
            Remove the tag from the user favorite list
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          responses:
            200:
              description: Tag removed from favorites
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: object
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
            TagDAO.remove_user_favorite_tag(pk)
            return self.response(200, result="OK")
        except TagNotFoundError:
            return self.response_404()
        except MissingUserContextException as ex:
            return self.response_422(message=str(ex))
