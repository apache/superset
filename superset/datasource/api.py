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

from flask import current_app as app, request
from flask_appbuilder.api import expose, protect, rison, safe
from flask_appbuilder.api.schemas import get_list_schema
from sqlalchemy import and_, func, literal, or_, select, union_all

from superset import db, event_logger, is_feature_enabled, security_manager
from superset.connectors.sqla import models as sqla_models
from superset.connectors.sqla.models import BaseDatasource, SqlaTable
from superset.daos.datasource import DatasourceDAO
from superset.daos.exceptions import DatasourceNotFound, DatasourceTypeNotSupportedError
from superset.exceptions import SupersetSecurityException
from superset.semantic_layers.models import SemanticView
from superset.superset_typing import FlaskResponse
from superset.utils.core import apply_max_row_limit, DatasourceType, SqlExpressionType
from superset.utils.filters import get_dataset_access_filters
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

    @expose("/", methods=("GET",))
    @safe
    @statsd_metrics
    @rison(get_list_schema)
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        ".combined_list",
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
        if not security_manager.can_access("can_read", "Dataset"):
            return self.response(403, message="Access denied")

        args = kwargs.get("rison", {})
        page = args.get("page", 0)
        page_size = args.get("page_size", 25)
        order_column = args.get("order_column", "changed_on")
        order_direction = args.get("order_direction", "desc")
        filters = args.get("filters", [])

        # Extract source_type, name search, sql (type), and type_filter
        source_type = "all"
        name_filter = None
        sql_filter = None  # None = no filter, True = physical, False = virtual
        type_filter = None  # None = no filter, "semantic_view" / True / False
        for f in filters:
            if f.get("col") == "source_type":
                source_type = f.get("value", "all")
            elif f.get("col") == "table_name" and f.get("opr") == "ct":
                name_filter = f.get("value")
            elif f.get("col") == "sql":
                val = f.get("value")
                if val == "semantic_view":
                    type_filter = "semantic_view"
                else:
                    sql_filter = val

        # If semantic layers feature flag is off, only show datasets
        if not is_feature_enabled("SEMANTIC_LAYERS"):
            source_type = "database"

        # Map sort columns
        sort_col_map = {
            "changed_on_delta_humanized": "changed_on",
            "table_name": "table_name",
        }
        sort_col_name = sort_col_map.get(order_column, "changed_on")

        # Build dataset subquery
        ds_q = select(
            SqlaTable.id.label("item_id"),
            literal("database").label("source_type"),
            SqlaTable.changed_on,
            SqlaTable.table_name,
        ).select_from(SqlaTable.__table__)

        # Apply security filters for datasets
        if not security_manager.can_access_all_datasources():
            ds_q = ds_q.join(
                sqla_models.Database,
                sqla_models.Database.id == SqlaTable.database_id,
            )
            ds_q = ds_q.where(get_dataset_access_filters(SqlaTable))

        # Apply name filter to datasets
        if name_filter:
            ds_q = ds_q.where(SqlaTable.table_name.ilike(f"%{name_filter}%"))

        # Apply sql (type) filter to datasets
        if sql_filter is not None:
            if sql_filter:
                # Physical: sql is null or empty
                ds_q = ds_q.where(
                    or_(SqlaTable.sql.is_(None), SqlaTable.sql == "")
                )
            else:
                # Virtual: sql is not null and not empty
                ds_q = ds_q.where(
                    and_(SqlaTable.sql.isnot(None), SqlaTable.sql != "")
                )
            # Selecting Physical/Virtual implicitly means "database only"
            if source_type == "all":
                source_type = "database"

        # Handle type_filter = "semantic_view"
        if type_filter == "semantic_view":
            source_type = "semantic_layer"

        # Build semantic view subquery
        sv_q = select(
            SemanticView.id.label("item_id"),
            literal("semantic_layer").label("source_type"),
            SemanticView.changed_on,
            SemanticView.name.label("table_name"),
        ).select_from(SemanticView.__table__)

        # Apply name filter to semantic views
        if name_filter:
            sv_q = sv_q.where(SemanticView.name.ilike(f"%{name_filter}%"))

        # Build combined query based on source_type
        if source_type == "database":
            combined = ds_q.subquery()
        elif source_type == "semantic_layer":
            combined = sv_q.subquery()
        else:
            combined = union_all(ds_q, sv_q).subquery()

        # Count total
        count_q = select(func.count()).select_from(combined)
        total_count = db.session.execute(count_q).scalar() or 0

        # Sort and paginate
        sort_col = combined.c[sort_col_name]
        if order_direction == "desc":
            sort_col = sort_col.desc()
        else:
            sort_col = sort_col.asc()

        paginated_q = (
            select(
                combined.c.item_id,
                combined.c.source_type,
            )
            .order_by(sort_col)
            .offset(page * page_size)
            .limit(page_size)
        )
        rows = db.session.execute(paginated_q).fetchall()

        # Collect IDs by type
        dataset_ids = [r.item_id for r in rows if r.source_type == "database"]
        sv_ids = [r.item_id for r in rows if r.source_type == "semantic_layer"]

        # Fetch full ORM objects
        datasets_map: dict[int, SqlaTable] = {}
        if dataset_ids:
            ds_objs = (
                db.session.query(SqlaTable)
                .filter(SqlaTable.id.in_(dataset_ids))
                .all()
            )
            datasets_map = {obj.id: obj for obj in ds_objs}

        sv_map: dict[int, SemanticView] = {}
        if sv_ids:
            sv_objs = (
                db.session.query(SemanticView)
                .filter(SemanticView.id.in_(sv_ids))
                .all()
            )
            sv_map = {obj.id: obj for obj in sv_objs}

        # Serialize in UNION order
        result = []
        for row in rows:
            if row.source_type == "database":
                obj = datasets_map.get(row.item_id)
                if obj:
                    result.append(self._serialize_dataset(obj))
            else:
                obj = sv_map.get(row.item_id)
                if obj:
                    result.append(self._serialize_semantic_view(obj))

        return self.response(200, count=total_count, result=result)

    @staticmethod
    def _serialize_dataset(obj: SqlaTable) -> dict[str, Any]:
        changed_by = obj.changed_by
        return {
            "id": obj.id,
            "uuid": str(obj.uuid),
            "table_name": obj.table_name,
            "kind": obj.kind,
            "source_type": "database",
            "description": obj.description,
            "explore_url": obj.explore_url,
            "database": {
                "id": obj.database_id,
                "database_name": obj.database.database_name,
            }
            if obj.database
            else None,
            "schema": obj.schema,
            "sql": obj.sql,
            "extra": obj.extra,
            "owners": [
                {
                    "id": o.id,
                    "first_name": o.first_name,
                    "last_name": o.last_name,
                }
                for o in obj.owners
            ],
            "changed_by_name": obj.changed_by_name,
            "changed_by": {
                "first_name": changed_by.first_name,
                "last_name": changed_by.last_name,
            }
            if changed_by
            else None,
            "changed_on_delta_humanized": obj.changed_on_delta_humanized(),
            "changed_on_utc": obj.changed_on_utc(),
        }

    @staticmethod
    def _serialize_semantic_view(obj: SemanticView) -> dict[str, Any]:
        changed_by = obj.changed_by
        return {
            "id": obj.id,
            "uuid": str(obj.uuid),
            "table_name": obj.name,
            "kind": "semantic_view",
            "source_type": "semantic_layer",
            "description": obj.description,
            "cache_timeout": obj.cache_timeout,
            "explore_url": obj.explore_url,
            "database": None,
            "schema": None,
            "sql": None,
            "extra": None,
            "owners": [],
            "changed_by_name": obj.changed_by_name,
            "changed_by": {
                "first_name": changed_by.first_name,
                "last_name": changed_by.last_name,
            }
            if changed_by
            else None,
            "changed_on_delta_humanized": obj.changed_on_delta_humanized(),
            "changed_on_utc": obj.changed_on_utc(),
        }
