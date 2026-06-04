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
import hashlib
import logging
from typing import Any

from flask import current_app as app, request
from flask_appbuilder.api import expose, protect, rison, safe
from flask_appbuilder.api.schemas import get_list_schema

from superset import event_logger, is_feature_enabled, security_manager
from superset.commands.datasource.list import GetCombinedDatasourceListCommand
from superset.connectors.sqla.models import BaseDatasource
from superset.daos.datasource import DatasourceDAO
from superset.daos.exceptions import DatasourceNotFound, DatasourceTypeNotSupportedError
from superset.exceptions import SupersetSecurityException
from superset.extensions import cache_manager
from superset.superset_typing import FlaskResponse
from superset.utils import json
from superset.utils.core import apply_max_row_limit, DatasourceType, SqlExpressionType
from superset.views.base_api import BaseSupersetApi, statsd_metrics

logger = logging.getLogger(__name__)


class DatasourceRestApi(BaseSupersetApi):
    allow_browser_login = True
    class_permission_name = "Datasource"
    resource_name = "datasource"
    openapi_spec_tag = "Datasources"

    @expose(
        "/<datasource_type>/<int:datasource_id>/column/<column_name>/values/",
        methods=("GET",),
    )
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        f".get_column_values",
        log_to_statsd=False,
    )
    def get_column_values(
        self, datasource_type: str, datasource_id: int, column_name: str
    ) -> FlaskResponse:
        """Get possible values for a datasource column.
        ---
        get:
          summary: Get possible values for a datasource column
          parameters:
          - in: path
            schema:
              type: string
            name: datasource_type
            description: The type of datasource
          - in: path
            schema:
              type: integer
            name: datasource_id
            description: The id of the datasource
          - in: path
            schema:
              type: string
            name: column_name
            description: The name of the column to get values for
          responses:
            200:
              description: A List of distinct values for the column
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: array
                        items:
                          oneOf:
                            - type: string
                            - type: integer
                            - type: number
                            - type: boolean
                            - type: object
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            datasource = DatasourceDAO.get_datasource(
                DatasourceType(datasource_type), datasource_id
            )
            datasource.raise_for_access()
        except ValueError:
            return self.response(
                400, message=f"Invalid datasource type: {datasource_type}"
            )
        except DatasourceTypeNotSupportedError as ex:
            return self.response(400, message=ex.message)
        except DatasourceNotFound as ex:
            return self.response(404, message=ex.message)
        except SupersetSecurityException as ex:
            return self.response(403, message=ex.message)

        row_limit = apply_max_row_limit(app.config["FILTER_SELECT_ROW_LIMIT"])
        denormalize_column = not datasource.normalize_columns
        try:
            payload = datasource.values_for_column(
                column_name=column_name,
                limit=row_limit,
                denormalize_column=denormalize_column,
            )
            return self.response(200, result=payload)
        except KeyError:
            return self.response(
                400, message=f"Column name {column_name} does not exist"
            )
        except NotImplementedError:
            return self.response(
                400,
                message=(
                    "Unable to get column values for "
                    f"datasource type: {datasource_type}"
                ),
            )

    @expose(
        "/<datasource_type>/<int:datasource_id>/validate_expression/",
        methods=("POST",),
    )
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        f".validate_expression",
        log_to_statsd=False,
    )
    def validate_expression(
        self, datasource_type: str, datasource_id: int
    ) -> FlaskResponse:
        """Validate a SQL expression against a datasource.
        ---
        post:
          summary: Validate a SQL expression against a datasource
          parameters:
          - in: path
            schema:
              type: string
            name: datasource_type
            description: The type of datasource
          - in: path
            schema:
              type: integer
            name: datasource_id
            description: The id of the datasource
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    expression:
                      type: string
                      description: The SQL expression to validate
                    expression_type:
                      type: string
                      enum: [column, metric, where, having]
                      description: The type of SQL expression
                      default: where
                    clause:
                      type: string
                      enum: [WHERE, HAVING]
                      description: SQL clause type for filter expressions
                  required:
                    - expression
          responses:
            200:
              description: Validation result
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: array
                        description: Empty array for success, errors for failure
                        items:
                          type: object
                          properties:
                            message:
                              type: string
                            line_number:
                              type: integer
                            start_column:
                              type: integer
                            end_column:
                              type: integer
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            # Get datasource
            datasource = self._get_datasource_for_validation(
                datasource_type, datasource_id
            )

            # Parse and validate request
            expression, expression_type_enum = self._parse_validation_request()

            # Perform validation
            result = datasource.validate_expression(
                expression=expression,
                expression_type=expression_type_enum,
            )

            # Convert our format to match frontend expectations
            if result["valid"]:
                return self.response(200, result=[])
            else:
                return self.response(200, result=result["errors"])

        except ValueError as ex:
            return self.response(400, message=str(ex))
        except DatasourceTypeNotSupportedError as ex:
            return self.response(400, message=ex.message)
        except DatasourceNotFound as ex:
            return self.response(404, message=ex.message)
        except SupersetSecurityException as ex:
            return self.response(403, message=ex.message)
        except NotImplementedError:
            return self.response(
                400,
                message=(
                    "Unable to validate expression for "
                    f"datasource type: {datasource_type}"
                ),
            )
        except Exception as ex:
            return self.response(500, message=f"Error validating expression: {str(ex)}")

    def _get_datasource_for_validation(
        self, datasource_type: str, datasource_id: int
    ) -> BaseDatasource:
        """Get datasource for validation endpoint. Raises exceptions on error."""
        try:
            datasource = DatasourceDAO.get_datasource(
                DatasourceType(datasource_type), datasource_id
            )
            datasource.raise_for_access()
            return datasource
        except ValueError:
            raise ValueError(f"Invalid datasource type: {datasource_type}") from None
        # Let other exceptions propagate as-is

    def _parse_validation_request(self) -> tuple[str, SqlExpressionType]:
        """Parse and validate request data. Raises ValueError on error."""
        request_data = request.json or {}
        expression = request_data.get("expression")
        expression_type = request_data.get("expression_type", "where")

        if not expression:
            raise ValueError("Expression is required")

        # Convert string expression_type to SqlExpressionType enum
        expression_type_enum = self._convert_expression_type_for_validation(
            expression_type
        )

        return expression, expression_type_enum

    def _convert_expression_type_for_validation(
        self, expression_type: str
    ) -> SqlExpressionType:
        """Convert expression type to enum. Raises ValueError on error."""
        try:
            return SqlExpressionType(expression_type)
        except ValueError:
            raise ValueError(
                f"Invalid expression type: {expression_type}. "
                f"Valid types are: column, metric, where, having"
            ) from None

    @expose(
        "/<datasource_type>/<int:datasource_id>/compatible",
        methods=("POST",),
    )
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.compatible",
        log_to_statsd=False,
    )
    def compatible(self, datasource_type: str, datasource_id: int) -> FlaskResponse:
        """Return metrics and dimensions compatible with the current selection.
        ---
        post:
          summary: Get compatible metrics and dimensions
          parameters:
          - in: path
            schema:
              type: string
            name: datasource_type
          - in: path
            schema:
              type: integer
            name: datasource_id
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    selected_metrics:
                      type: array
                      items:
                        type: string
                    selected_dimensions:
                      type: array
                      items:
                        type: string
          responses:
            200:
              description: Compatible metrics and dimensions
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: object
                        properties:
                          compatible_metrics:
                            type: array
                            items:
                              type: string
                          compatible_dimensions:
                            type: array
                            items:
                              type: string
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        try:
            datasource = DatasourceDAO.get_datasource(
                DatasourceType(datasource_type), datasource_id
            )
            datasource.raise_for_access()
        except ValueError:
            return self.response(
                400, message=f"Invalid datasource type: {datasource_type}"
            )
        except DatasourceTypeNotSupportedError as ex:
            return self.response(400, message=ex.message)
        except DatasourceNotFound as ex:
            return self.response(404, message=ex.message)
        except SupersetSecurityException as ex:
            return self.response(403, message=ex.message)

        body = request.get_json(silent=True) or {}
        selected_metrics = body.get("selected_metrics", [])
        selected_dimensions = body.get("selected_dimensions", [])

        # Build a stable cache key from the datasource identity and the
        # (sorted) selection so that order differences don't cause cache misses.
        cache_key = (
            "compatible:"
            + hashlib.sha256(
                json.dumps(
                    {
                        "uid": datasource.uid,
                        "m": sorted(selected_metrics),
                        "d": sorted(selected_dimensions),
                    },
                    sort_keys=True,
                ).encode()
            ).hexdigest()
        )

        if (cached := cache_manager.data_cache.get(cache_key)) is not None:
            return self.response(200, result=cached)

        result = {
            "compatible_metrics": datasource.get_compatible_metrics(
                selected_metrics, selected_dimensions
            ),
            "compatible_dimensions": datasource.get_compatible_dimensions(
                selected_metrics, selected_dimensions
            ),
        }

        timeout = datasource.cache_timeout or app.config.get(
            "CACHE_DEFAULT_TIMEOUT", 300
        )
        cache_manager.data_cache.set(cache_key, result, timeout=timeout)

        return self.response(200, result=result)

    @expose("/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @rison(get_list_schema)
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.combined_list",
        log_to_statsd=False,
    )
    def combined_list(self, **kwargs: Any) -> FlaskResponse:
        """List datasets and semantic views combined.
        ---
        get:
          summary: List datasets and semantic views combined
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_list_schema'
          responses:
            200:
              description: Combined list of datasets and semantic views
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            500:
              $ref: '#/components/responses/500'
        """
        can_read_datasets = security_manager.can_access("can_read", "Dataset")
        can_read_sv = is_feature_enabled(
            "SEMANTIC_LAYERS"
        ) and security_manager.can_access("can_read", "SemanticView")

        if not can_read_datasets and not can_read_sv:
            return self.response(403, message="Access denied")

        try:
            result = GetCombinedDatasourceListCommand(
                args=kwargs.get("rison", {}),
                can_read_datasets=can_read_datasets,
                can_read_semantic_views=can_read_sv,
            ).run()
        except ValueError as ex:
            return self.response(400, message=str(ex))

        return self.response(200, **result)
