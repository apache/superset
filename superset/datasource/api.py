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

from flask import current_app as app, make_response, request, Response
from flask_appbuilder.api import expose, protect, rison, safe
from flask_appbuilder.api.schemas import get_list_schema
from marshmallow import ValidationError

from superset import event_logger, is_feature_enabled, security_manager
from superset.commands.datasource.list import GetCombinedDatasourceListCommand
from superset.commands.exceptions import CommandException
from superset.common.chart_data import ChartDataResultFormat
from superset.common.tabular_query import (
    build_query_dict,
    execute_tabular_query,
    resolve_explorable,
    ResolvedExplorable,
    TabularQueryValidationError,
    validate_query_names,
)
from superset.connectors.sqla.models import BaseDatasource
from superset.daos.datasource import DatasourceDAO
from superset.daos.exceptions import DatasourceNotFound, DatasourceTypeNotSupportedError
from superset.datasource.schemas import DatasourceQuerySchema
from superset.exceptions import (
    QueryObjectValidationError,
    SupersetException,
    SupersetSecurityException,
)
from superset.extensions import cache_manager
from superset.semantic_layers.mapper import SUPPORTED_FILTER_OPERATORS
from superset.superset_typing import FlaskResponse
from superset.utils import json
from superset.utils.core import (
    apply_max_row_limit,
    DatasourceType,
    FilterOperator,
    parse_boolean_string,
    SqlExpressionType,
)
from superset.views.base_api import BaseSupersetApi, statsd_metrics

logger = logging.getLogger(__name__)

# Cache lifetime for search-filtered column values, in seconds.
SEARCH_CACHE_TIMEOUT = 60


class _HttpError(Exception):
    """Carries an HTTP status out of the shared resolve helper."""

    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.message = message


class DatasourceRestApi(BaseSupersetApi):
    allow_browser_login = True
    class_permission_name = "Datasource"
    method_permission_name = {
        "combined_list": "read",
        # Both new routes share can_query. Notably `datasource_info` is NOT
        # named `get`: PUBLIC_ROLE_PERMISSIONS already grants
        # ("can_get", "Datasource") for chart rendering, so a method named
        # `get` would expose datasource metadata to unauthenticated users
        # wherever PUBLIC_ROLE_LIKE = "Public".
        "query": "query",
        "datasource_info": "query",
    }
    resource_name = "datasource"
    openapi_spec_tag = "Datasources"
    openapi_spec_component_schemas = (DatasourceQuerySchema,)

    @expose(
        "/<datasource_type>/<int:datasource_id>/column/<column_name>/values/",
        methods=("GET",),
    )
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: (
            f"{self.__class__.__name__}.get_column_values"
        ),
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
          - in: query
            schema:
              type: string
            name: q
            description: >-
              Optional case-insensitive substring; only values containing it are
              returned. Lets the client search the full column rather than the
              truncated first page.
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
        # Element-level operators (Contains any / Contains all) request the
        # distinct array *elements* rather than distinct whole arrays.
        array_elements = parse_boolean_string(request.args.get("array_elements"))
        # Server-side search. Without it the client can only match against the
        # bounded first page, so a value beyond ``FILTER_SELECT_ROW_LIMIT`` is
        # unfindable on a high-cardinality column.
        search = (request.args.get("q") or "").strip() or None

        # Cache distinct column-value results so a dashboard with many filters
        # backed by the same (often heavy) virtual dataset doesn't re-execute
        # the wrapping query per filter (#39342).
        #
        # Key fields:
        # - ``rls`` — full RLS fingerprint via
        #   ``security_manager.get_rls_cache_key`` (the canonical helper used
        #   by viz.py and query_context_processor.py). This is the sole
        #   security-isolation field — two users with identical effective
        #   RLS share a cache entry (intentional: they would see identical
        #   filtered values anyway), while users with different RLS, guest
        #   sessions with different guest-token RLS, and anonymous sessions
        #   with no RLS each get their own partition. We deliberately do
        #   NOT include the raw user id; doing so would defeat the
        #   intended cross-user cache sharing without adding any real
        #   security boundary beyond what the RLS fingerprint already
        #   provides.
        # - ``changed_on`` — auto-busts cached entries when the dataset's
        #   underlying SQL is edited.
        # - ``uid`` / ``col`` / ``limit`` / ``denorm`` — basic query-shape
        #   isolation so different inputs never collide.
        force = parse_boolean_string(request.args.get("force"))
        cache_key = (
            "col_values:"
            + hashlib.sha256(
                json.dumps(
                    {
                        "uid": datasource.uid,
                        "col": column_name,
                        "limit": row_limit,
                        "denorm": denormalize_column,
                        "elements": array_elements,
                        "q": search,
                        "rls": security_manager.get_rls_cache_key(datasource),
                        "changed_on": str(getattr(datasource, "changed_on", "")),
                    },
                    sort_keys=True,
                ).encode()
            ).hexdigest()
        )

        if (
            not force
            and (cached := cache_manager.data_cache.get(cache_key)) is not None
        ):
            logger.debug(
                "column-values cache HIT: uid=%s col=%s", datasource.uid, column_name
            )
            response = self.response(200, result=cached, limit=row_limit)
            response.headers["X-Cache-Status"] = "HIT"
            return response

        try:
            payload = datasource.values_for_column(
                column_name=column_name,
                limit=row_limit,
                denormalize_column=denormalize_column,
                array_elements=array_elements,
                search=search,
            )
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

        # Warn before caching very large payloads (high-cardinality columns)
        # so operators can spot cache-memory pressure before Redis OOMs.
        # Threshold is operator-tunable; defaults to 100k rows.
        warn_threshold = app.config.get("FILTER_VALUES_CACHE_WARN_THRESHOLD", 100_000)
        if (payload_size := len(payload)) > warn_threshold:
            logger.warning(
                "column-values payload exceeds cache-warn threshold: "
                "uid=%s col=%s rows=%d threshold=%d",
                datasource.uid,
                column_name,
                payload_size,
                warn_threshold,
            )

        timeout = datasource.cache_timeout or app.config.get(
            "CACHE_DEFAULT_TIMEOUT", 300
        )
        if search:
            # Every distinct search term is its own key, so a few users typing
            # would otherwise pin one entry per keystroke for the full timeout.
            timeout = min(timeout, SEARCH_CACHE_TIMEOUT)
        cache_manager.data_cache.set(cache_key, payload, timeout=timeout)
        logger.debug(
            "column-values cache MISS: uid=%s col=%s", datasource.uid, column_name
        )
        response = self.response(200, result=payload, limit=row_limit)
        response.headers["X-Cache-Status"] = "MISS"
        return response

    @expose(
        "/<datasource_type>/<int:datasource_id>/validate_expression/",
        methods=("POST",),
    )
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: (
            f"{self.__class__.__name__}.validate_expression"
        ),
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

    def _resolve_for_query(
        self, datasource_type: str, datasource_id: int, payload: dict[str, Any]
    ) -> ResolvedExplorable:
        """Resolve + authorize, translating DAO/security errors to HTTP."""
        if DatasourceType(
            datasource_type
        ) == DatasourceType.SEMANTIC_VIEW and not is_feature_enabled("SEMANTIC_LAYERS"):
            raise _HttpError(404, "Semantic views are not enabled.")
        try:
            return resolve_explorable(
                datasource_type,
                datasource_id,
                time_column=payload.get("time_column"),
                has_time_range=bool(payload.get("time_range")),
            )
        except DatasourceTypeNotSupportedError as ex:
            raise _HttpError(400, ex.message) from ex
        except DatasourceNotFound as ex:
            raise _HttpError(404, ex.message) from ex
        except SupersetSecurityException as ex:
            raise _HttpError(403, ex.message) from ex
        except TabularQueryValidationError as ex:
            raise _HttpError(400, str(ex)) from ex

    @expose("/<datasource_type>/<int:datasource_id>/query", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.query",
        log_to_statsd=False,
    )
    def query(self, datasource_type: str, datasource_id: int) -> FlaskResponse:
        """Query a datasource using metric and dimension names.
        ---
        post:
          summary: Query a datasource by its semantic definitions
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
                  $ref: '#/components/schemas/DatasourceQuerySchema'
          responses:
            200:
              description: Query result
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: array
                        items:
                          type: object
                application/vnd.apache.arrow.stream:
                  schema:
                    type: string
                    format: binary
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
            payload = DatasourceQuerySchema().load(request.json or {})
        except ValidationError as ex:
            return self.response_400(message=ex.messages)

        try:
            resolved = self._resolve_for_query(datasource_type, datasource_id, payload)
        except _HttpError as ex:
            return self.response(ex.status, message=ex.message)
        except ValueError:
            return self.response(
                400, message=f"Invalid datasource type: {datasource_type}"
            )

        if errors := validate_query_names(
            resolved.valid_metrics,
            resolved.valid_dimensions,
            metrics=payload["metrics"],
            dimensions=payload["dimensions"],
            filters=payload["filters"],
            order_names=[term["column"] for term in payload["order"]],
            metrics_full_list_hint=(
                f"GET /api/v1/datasource/{datasource_type}/{datasource_id}"
            ),
        ):
            return self.response_400(message="; ".join(errors))

        return self._execute_and_respond(resolved, payload)

    def _execute_and_respond(
        self, resolved: ResolvedExplorable, payload: dict[str, Any]
    ) -> FlaskResponse:
        """Run the query and render it in the requested result format."""
        database = getattr(resolved.explorable, "database", None)
        if (
            payload["offset"]
            and database
            and not database.db_engine_spec.supports_offset
        ):
            # get_sqla_query drops row_offset for these engines, so the request
            # would return the first page again under a 200.
            return self.response_400(
                message=(
                    f"{database.db_engine_spec.engine} does not support offset "
                    "pagination."
                )
            )

        grain_column = resolved.resolve_grain_column(
            payload["time_column"], payload["dimensions"]
        )
        if payload["time_grain"]:
            if not grain_column:
                # Silently dropping the grain would return unbucketed rows that
                # look correct, so refuse instead.
                return self.response_400(
                    message=(
                        "time_grain requires a temporal column. Set time_column, "
                        "include a datetime dimension, or provide time_range."
                    )
                )
            supported = {
                grain["duration"] for grain in resolved.explorable.get_time_grains()
            }
            if payload["time_grain"] not in supported:
                # Unsupported grains reach get_timestamp_expr, which raises
                # NotImplementedError rather than a validation error.
                return self.response_400(
                    message=(
                        f"Unsupported time_grain: '{payload['time_grain']}'. "
                        f"Supported: {', '.join(sorted(g for g in supported if g))}."
                    )
                )

        try:
            query_dict = self._build_query_dict(resolved, payload, grain_column)
        except ValidationError as ex:
            return self.response_400(message=ex.messages)
        except ValueError as ex:
            return self.response_400(message=str(ex))

        return self._run(resolved, payload, query_dict)

    @staticmethod
    def _build_query_dict(
        resolved: ResolvedExplorable, payload: dict[str, Any], grain_column: str | None
    ) -> dict[str, Any]:
        return build_query_dict(
            time_column=resolved.time_column,
            metrics=payload["metrics"],
            dimensions=payload["dimensions"],
            filters=payload["filters"],
            time_range=payload["time_range"],
            time_grain=payload["time_grain"],
            grain_column=grain_column,
            rewrite_one_sided_time_range=(
                resolved.explorable.type == DatasourceType.SEMANTIC_VIEW.value
            ),
            limit=payload["limit"],
            offset=payload["offset"],
            order=[(term["column"], term["descending"]) for term in payload["order"]],
            # No wire field for this; follow the leading term's direction.
            order_desc=(
                payload["order"][0]["descending"] if payload["order"] else True
            ),
        )

    def _run(
        self,
        resolved: ResolvedExplorable,
        payload: dict[str, Any],
        query_dict: dict[str, Any],
    ) -> FlaskResponse:
        result_format = payload["result_format"]

        try:
            result = execute_tabular_query(
                int(resolved.explorable.id),
                str(resolved.explorable.type),
                query_dict,
                result_format=result_format,
                use_cache=payload["use_cache"],
                force=payload["force"],
                cache_timeout=payload["cache_timeout"],
            )
        except SupersetSecurityException as ex:
            return self.response(403, message=ex.message)
        except (ValueError, QueryObjectValidationError) as ex:
            return self.response_400(message=str(ex))
        except CommandException as ex:
            return self.response_400(message=ex.message or str(ex))

        queries = result.get("queries") or []
        if result_format == ChartDataResultFormat.ARROW:
            if len(queries) != 1:
                return self.response_400(
                    message="Arrow result format supports exactly one query."
                )
            return Response(
                queries[0]["data"],
                mimetype="application/vnd.apache.arrow.stream",
            )
        response = make_response(
            json.dumps(
                {"result": queries},
                default=json.json_int_dttm_ser,
                ignore_nan=True,
            ),
            200,
        )
        response.headers["Content-Type"] = "application/json; charset=utf-8"
        return response

    @expose("/<datasource_type>/<int:datasource_id>", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: (
            f"{self.__class__.__name__}.datasource_info"
        ),
        log_to_statsd=False,
    )
    def datasource_info(
        self, datasource_type: str, datasource_id: int
    ) -> FlaskResponse:
        """Get datasource metadata and query capabilities.
        ---
        get:
          summary: Get datasource metadata and capabilities
          parameters:
          - in: path
            schema:
              type: string
            name: datasource_type
          - in: path
            schema:
              type: integer
            name: datasource_id
          responses:
            200:
              description: Datasource metadata plus a capabilities block
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: object
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
            resolved = self._resolve_for_query(datasource_type, datasource_id, {})
        except _HttpError as ex:
            return self.response(ex.status, message=ex.message)
        except ValueError:
            return self.response(
                400, message=f"Invalid datasource type: {datasource_type}"
            )

        try:
            datasource = resolved.explorable
            is_semantic_view = (
                DatasourceType(datasource_type) == DatasourceType.SEMANTIC_VIEW
            )
            supported_operators = (
                SUPPORTED_FILTER_OPERATORS
                if is_semantic_view
                else {op.value for op in FilterOperator}
            )
            features = sorted(
                feature.value
                for feature in getattr(
                    getattr(datasource, "implementation", None), "features", set()
                )
            )
            result = dict(datasource.data)
            result["capabilities"] = {
                "is_rls_supported": datasource.is_rls_supported,
                "query_language": datasource.query_language,
                "supports_samples": getattr(datasource, "supports_samples", True),
                "supports_drill_to_detail": getattr(
                    datasource, "supports_drill_to_detail", True
                ),
                # Datasets accept ad-hoc metrics; semantic views reject them in the
                # mapper, since the provider owns metric definitions.
                "supports_adhoc_metrics": not is_semantic_view,
                "time_grains": datasource.get_time_grains(),
                "supported_operators": sorted(supported_operators),
                "features": features,
            }
            return self.response(200, result=result)
        except SupersetSecurityException as ex:
            return self.response(403, message=ex.message)
        except (ValueError, SupersetException) as ex:
            return self.response_400(message=str(ex))

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
