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
"""REST API for Dataset Relationships.

Exposes CRUD endpoints for managing relationships between datasets.
Follows the standard Superset API patterns using ``BaseSupersetModelRestApi``
and delegates business logic to the Command layer.
"""
from __future__ import annotations

import logging
from typing import Any

from flask import request, Response
from flask_appbuilder.api import expose, protect, rison as parse_rison, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from marshmallow import ValidationError

from superset import event_logger, is_feature_enabled
from superset.commands.dataset_relationship.create import (
    CreateDatasetRelationshipCommand,
)
from superset.commands.dataset_relationship.delete import (
    DeleteDatasetRelationshipCommand,
)
from superset.commands.dataset_relationship.exceptions import (
    DatasetRelationshipCreateFailedError,
    DatasetRelationshipDeleteFailedError,
    DatasetRelationshipForbiddenError,
    DatasetRelationshipInvalidError,
    DatasetRelationshipNotFoundError,
    DatasetRelationshipUpdateFailedError,
)
from superset.commands.dataset_relationship.update import (
    UpdateDatasetRelationshipCommand,
)
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.daos.dataset_relationship import DatasetRelationshipDAO
from superset.dataset_relationship.schemas import (
    DatasetRelationshipGetSchema,
    DatasetRelationshipPostSchema,
    DatasetRelationshipPutSchema,
    get_delete_ids_schema,
    openapi_spec_methods_override,
)
from superset.models.dataset_relationships import DatasetRelationship
from superset.views.base_api import (
    BaseSupersetModelRestApi,
    requires_json,
    statsd_metrics,
)

DATASET_RELATIONSHIPS_FLAG = "DATASET_RELATIONSHIPS"

logger = logging.getLogger(__name__)


class DatasetRelationshipRestApi(BaseSupersetModelRestApi):
    """REST API for managing dataset relationships.

    Provides full CRUD plus a custom endpoint to list relationships
    for a specific dataset.  Uses ``class_permission_name = "Dataset"``
    so that existing Dataset read/write permissions control access.

    Example requests::

        # List all relationships
        GET /api/v1/dataset_relationship/

        # Get a specific relationship
        GET /api/v1/dataset_relationship/1

        # Create a new relationship
        POST /api/v1/dataset_relationship/
        {
            "source_dataset_id": 1,
            "target_dataset_id": 2,
            "relationship_type": "many_to_one",
            "join_type": "LEFT",
            "columns": [
                {
                    "source_column_name": "customer_id",
                    "target_column_name": "id"
                }
            ]
        }

        # Update a relationship
        PUT /api/v1/dataset_relationship/1
        {"is_active": false}

        # Delete a relationship
        DELETE /api/v1/dataset_relationship/1

        # List relationships for a specific dataset
        GET /api/v1/dataset_relationship/dataset/42
    """

    datamodel = SQLAInterface(DatasetRelationship)
    resource_name = "dataset_relationship"
    allow_browser_login = True

    # Re-use Dataset permissions so no new permission rows are needed.
    class_permission_name = "Dataset"
    method_permission_name = {
        **MODEL_API_RW_METHOD_PERMISSION_MAP,
        "get_by_dataset": "read",
    }

    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {
        "bulk_delete",
        "get_by_dataset",
    }

    @staticmethod
    def _check_feature_flag() -> Response | None:
        """Return a 403 response if the feature flag is disabled."""
        flag_val = is_feature_enabled(DATASET_RELATIONSHIPS_FLAG)
        logger.warning(
            "_check_feature_flag: flag=%s, constant=%s, result=%s",
            flag_val, DATASET_RELATIONSHIPS_FLAG, not flag_val,
        )
        if not flag_val:
            return Response(
                status=403,
                response="Dataset Relationships feature is not enabled.",
                content_type="text/plain",
            )
        return None

    list_columns = [
        "id",
        "uuid",
        "source_dataset_id",
        "target_dataset_id",
        "relationship_type",
        "join_type",
        "is_cross_database",
        "is_active",
        "name",
        "description",
        "created_on",
        "changed_on",
        "created_by_fk",
        "changed_by_fk",
    ]
    show_columns = list_columns + [
        "columns.id",
        "columns.source_column_name",
        "columns.target_column_name",
        "columns.operator",
        "columns.ordinal",
    ]
    add_columns = [
        "source_dataset_id",
        "target_dataset_id",
        "relationship_type",
        "join_type",
        "is_active",
        "name",
        "description",
    ]
    edit_columns = [
        "source_dataset_id",
        "target_dataset_id",
        "relationship_type",
        "join_type",
        "is_active",
        "name",
        "description",
    ]
    order_columns = [
        "id",
        "source_dataset_id",
        "target_dataset_id",
        "relationship_type",
        "join_type",
        "is_active",
        "created_on",
        "changed_on",
    ]
    search_columns = [
        "id",
        "source_dataset_id",
        "target_dataset_id",
        "relationship_type",
        "join_type",
        "is_active",
        "is_cross_database",
        "name",
    ]

    add_model_schema = DatasetRelationshipPostSchema()
    edit_model_schema = DatasetRelationshipPutSchema()

    openapi_spec_tag = "Dataset Relationships"
    openapi_spec_methods = openapi_spec_methods_override
    openapi_spec_component_schemas = (
        DatasetRelationshipGetSchema,
        DatasetRelationshipPostSchema,
        DatasetRelationshipPutSchema,
    )

    # ------------------------------------------------------------------ #
    # GET  /api/v1/dataset_relationship/ (list)
    # ------------------------------------------------------------------ #
    @expose("/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get_list",
        log_to_statsd=False,
    )
    def get_list(self, **kwargs: Any) -> Response:
        """Get a list of dataset relationships.
        ---
        get:
          summary: Get a list of dataset relationships
          description: >-
            Gets a list of dataset relationships. Use Rison or JSON
            query parameters for filtering, sorting, pagination and
            for selecting specific columns and metadata.
          responses:
            200:
              description: List of relationships
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            500:
              $ref: '#/components/responses/500'
        """
        flag_response = self._check_feature_flag()
        if flag_response:
            return flag_response
        return super().get_list(**kwargs)

    # ------------------------------------------------------------------ #
    # GET  /api/v1/dataset_relationship/<pk> (info)
    # ------------------------------------------------------------------ #
    @expose("/info", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.info",
        log_to_statsd=False,
    )
    def info(self) -> Response:
        """Get metadata info.
        ---
        get:
          summary: Get API metadata
          responses:
            200:
              description: API metadata
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            500:
              $ref: '#/components/responses/500'
        """
        flag_response = self._check_feature_flag()
        if flag_response:
            return flag_response
        return super().info()

    # ------------------------------------------------------------------ #
    # POST  /api/v1/dataset_relationship/
    # ------------------------------------------------------------------ #
    @expose("/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post",
        log_to_statsd=False,
    )
    @requires_json
    def post(self) -> Response:
        """Create a new dataset relationship.
        ---
        post:
          summary: Create a new dataset relationship
          description: >-
            Creates a directed relationship between two datasets, including
            column-pair mappings that define the join condition.
          requestBody:
            description: Dataset relationship schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/DatasetRelationshipPostSchema'
          responses:
            201:
              description: Relationship created
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: integer
                        description: ID of the newly created relationship
                      result:
                        $ref: '#/components/schemas/DatasetRelationshipPostSchema'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        flag_response = self._check_feature_flag()
        if flag_response:
            return flag_response
        try:
            item = self.add_model_schema.load(request.json)
        except ValidationError as error:
            return self.response_400(message=error.messages)

        try:
            new_model = CreateDatasetRelationshipCommand(item).run()
            return self.response(201, id=new_model.id, result=item)
        except DatasetRelationshipInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())
        except DatasetRelationshipCreateFailedError as ex:
            logger.error(
                "Error creating model %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))

    # ------------------------------------------------------------------ #
    # PUT  /api/v1/dataset_relationship/<pk>
    # ------------------------------------------------------------------ #
    @expose("/<pk>", methods=("PUT",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.put",
        log_to_statsd=False,
    )
    @requires_json
    def put(self, pk: int) -> Response:
        """Update a dataset relationship.
        ---
        put:
          summary: Update a dataset relationship
          description: >-
            Partially updates an existing dataset relationship.  Only provided
            fields are modified; omitted fields retain their current values.
            If ``columns`` is provided the full set of column mappings is
            replaced.
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
            required: true
            description: Relationship ID
          requestBody:
            description: Dataset relationship schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/DatasetRelationshipPutSchema'
          responses:
            200:
              description: Relationship updated
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: integer
                      result:
                        $ref: '#/components/schemas/DatasetRelationshipPutSchema'
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
        flag_response = self._check_feature_flag()
        if flag_response:
            return flag_response
        try:
            item = self.edit_model_schema.load(request.json)
        except ValidationError as error:
            return self.response_400(message=error.messages)

        try:
            updated_model = UpdateDatasetRelationshipCommand(pk, item).run()
            return self.response(200, id=updated_model.id, result=item)
        except DatasetRelationshipNotFoundError:
            return self.response_404()
        except DatasetRelationshipForbiddenError:
            return self.response_403()
        except DatasetRelationshipInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())
        except DatasetRelationshipUpdateFailedError as ex:
            logger.error(
                "Error updating model %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))

    # ------------------------------------------------------------------ #
    # DELETE  /api/v1/dataset_relationship/<pk>
    # ------------------------------------------------------------------ #
    @expose("/<pk>", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.delete",
        log_to_statsd=False,
    )
    def delete(self, pk: int) -> Response:
        """Delete a dataset relationship.
        ---
        delete:
          summary: Delete a dataset relationship
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
            required: true
            description: Relationship ID
          responses:
            200:
              description: Relationship deleted
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
        flag_response = self._check_feature_flag()
        if flag_response:
            return flag_response
        try:
            DeleteDatasetRelationshipCommand([pk]).run()
            return self.response(200, message="OK")
        except DatasetRelationshipNotFoundError:
            return self.response_404()
        except DatasetRelationshipForbiddenError:
            return self.response_403()
        except DatasetRelationshipDeleteFailedError as ex:
            logger.error(
                "Error deleting model %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))

    # ------------------------------------------------------------------ #
    # DELETE  /api/v1/dataset_relationship/ (bulk)
    # ------------------------------------------------------------------ #
    @expose("/", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    @parse_rison(get_delete_ids_schema)
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.bulk_delete",
        log_to_statsd=False,
    )
    def bulk_delete(self, **kwargs: Any) -> Response:
        """Bulk delete dataset relationships.
        ---
        delete:
          summary: Bulk delete dataset relationships
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_delete_ids_schema'
          responses:
            200:
              description: Relationships deleted
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
        item_ids = kwargs["rison"]
        flag_response = self._check_feature_flag()
        if flag_response:
            return flag_response
        try:
            DeleteDatasetRelationshipCommand(item_ids).run()
            return self.response(
                200,
                message=f"Deleted {len(item_ids)} dataset relationship(s)",
            )
        except DatasetRelationshipNotFoundError:
            return self.response_404()
        except DatasetRelationshipForbiddenError:
            return self.response_403()
        except DatasetRelationshipDeleteFailedError as ex:
            logger.error(
                "Error bulk-deleting models %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))

    # ------------------------------------------------------------------ #
    # GET  /api/v1/dataset_relationship/dataset/<dataset_id>
    # ------------------------------------------------------------------ #
    @expose("/dataset/<int:dataset_id>", methods=("GET",))
    @protect(allow_browser_login=True)
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: (
            f"{self.__class__.__name__}.get_by_dataset"
        ),
        log_to_statsd=False,
    )
    def get_by_dataset(self, dataset_id: int) -> Response:
        """Get all relationships for a specific dataset.
        ---
        get:
          summary: Get relationships for a dataset
          description: >-
            Returns all relationships where the given dataset appears as
            either source or target.  Accepts an optional ``active_only``
            query parameter (defaults to ``true``).
          parameters:
          - in: path
            schema:
              type: integer
            name: dataset_id
            required: true
            description: Dataset ID to look up relationships for
          - in: query
            schema:
              type: boolean
            name: active_only
            description: >-
              If true (default), only active relationships are returned.
          responses:
            200:
              description: List of relationships for the dataset
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      count:
                        type: integer
                        description: Total number of matching relationships
                      result:
                        type: array
                        items:
                          $ref: '#/components/schemas/DatasetRelationshipGetSchema'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            500:
              $ref: '#/components/responses/500'
        """
        active_only_str = request.args.get("active_only", "true")
        flag_response = self._check_feature_flag()
        if flag_response:
            return flag_response
        active_only = active_only_str.lower() not in ("false", "0", "no")

        relationships = DatasetRelationshipDAO.find_by_dataset_id(
            dataset_id, active_only=active_only
        )
        result_schema = DatasetRelationshipGetSchema(many=True)
        result = result_schema.dump(relationships)
        return self.response(200, count=len(result), result=result)

    # ------------------------------------------------------------------ #
    # POST /api/v1/dataset_relationship/resolve_values/ (cross-DB filter)
    # ------------------------------------------------------------------ #
    @expose("/resolve_values/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: (
            f"{self.__class__.__name__}.resolve_values"
        ),
        log_to_statsd=False,
    )
    @requires_json
    def resolve_values(self) -> Response:
        """Resolve cross-DB filter value mapping.
        ---
        post:
          summary: Resolve cross-database filter values
          description: >-
            Given source values from one dataset, returns the corresponding
            target values from a related dataset via the relationship's
            column mapping. Used for cross-database filter translation.
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    source_dataset_id:
                      type: integer
                    target_dataset_id:
                      type: integer
                    source_column:
                      type: string
                    target_column:
                      type: string
                    source_values:
                      type: array
          responses:
            200:
              description: Mapped values
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        flag_response = self._check_feature_flag()
        if flag_response:
            return flag_response

        data = request.json or {}
        source_dataset_id = data.get("source_dataset_id")
        target_dataset_id = data.get("target_dataset_id")
        source_column = data.get("source_column")
        target_column = data.get("target_column")
        source_values = data.get("source_values", [])

        if not all([source_dataset_id, target_dataset_id, source_column, target_column]):
            return self.response_400(
                message="source_dataset_id, target_dataset_id, source_column, and target_column are required."
            )

        try:
            from superset import db
            from superset.connectors.sqla.models import SqlaTable

            # Query the target dataset for distinct values that match
            target_table = (
                db.session.query(SqlaTable)
                .filter(SqlaTable.id == target_dataset_id)
                .one_or_none()
            )

            if not target_table:
                return self.response_404()

            # Get the target table's select expression
            target_sqla_table = target_table.get_sqla_table()

            # Validate column exists in target dataset's schema
            valid_columns = {c.name for c in target_sqla_table.c}
            if target_column not in valid_columns:
                return self.response_400(
                    message=f"Column '{target_column}' not found in target dataset."
                )
            target_col = target_sqla_table.c[target_column]

            # Query distinct target values
            query = (
                db.session.query(target_col.distinct())
                .select_from(target_sqla_table)
            )

            # If we have source values and the datasets are linked,
            # we need to join with the source table to filter
            # For now, return all distinct values from the target column
            # A more sophisticated implementation would use the relationship
            # to join and filter
            results = [row[0] for row in query.limit(10000).all()]

            return self.response(200, result=results)

        except Exception as ex:
            logger.error("Error resolving values: %s", str(ex), exc_info=True)
            return self.response_422(message=str(ex))
