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
from typing import Any, Dict, List, Optional

from flask_appbuilder.api import expose, protect, rison, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from sqlalchemy.exc import NoSuchTableError, OperationalError, SQLAlchemyError

from superset import event_logger
from superset.databases.decorators import check_datasource_access
from superset.databases.schemas import (
    database_schemas_query_schema,
    DatabaseSchemaResponseSchema,
    SchemasResponseSchema,
    SelectStarResponseSchema,
    TableMetadataResponseSchema,
)
from superset.extensions import security_manager
from superset.models.core import Database
from superset.typing import FlaskResponse
from superset.utils.core import error_msg_from_exception
from superset.views.base_api import BaseSupersetModelRestApi, statsd_metrics
from superset.views.database.filters import DatabaseFilter
from superset.views.database.validators import sqlalchemy_uri_validator

get_schemas_schema = {
    "type": "object",
    "properties": {
        "page_size": {"type": "integer"},
        "page": {"type": "integer"},
        "filter": {"type": "string"},
    },
}


def get_foreign_keys_metadata(
    database: Database, table_name: str, schema_name: Optional[str]
) -> List[Dict[str, Any]]:
    foreign_keys = database.get_foreign_keys(table_name, schema_name)
    for fk in foreign_keys:
        fk["column_names"] = fk.pop("constrained_columns")
        fk["type"] = "fk"
    return foreign_keys


def get_indexes_metadata(
    database: Database, table_name: str, schema_name: Optional[str]
) -> List[Dict[str, Any]]:
    indexes = database.get_indexes(table_name, schema_name)
    for idx in indexes:
        idx["type"] = "index"
    return indexes


def get_col_type(col: Dict[Any, Any]) -> str:
    try:
        dtype = f"{col['type']}"
    except Exception:  # pylint: disable=broad-except
        # sqla.types.JSON __str__ has a bug, so using __class__.
        dtype = col["type"].__class__.__name__
    return dtype


def get_table_metadata(
    database: Database, table_name: str, schema_name: Optional[str]
) -> Dict[str, Any]:
    """
    Get table metadata information, including type, pk, fks.
    This function raises SQLAlchemyError when a schema is not found.

    :param database: The database model
    :param table_name: Table name
    :param schema_name: schema name
    :return: Dict table metadata ready for API response
    """
    keys = []
    columns = database.get_columns(table_name, schema_name)
    primary_key = database.get_pk_constraint(table_name, schema_name)
    if primary_key and primary_key.get("constrained_columns"):
        primary_key["column_names"] = primary_key.pop("constrained_columns")
        primary_key["type"] = "pk"
        keys += [primary_key]
    foreign_keys = get_foreign_keys_metadata(database, table_name, schema_name)
    indexes = get_indexes_metadata(database, table_name, schema_name)
    keys += foreign_keys + indexes
    payload_columns: List[Dict[str, Any]] = []
    for col in columns:
        dtype = get_col_type(col)
        payload_columns.append(
            {
                "name": col["name"],
                "type": dtype.split("(")[0] if "(" in dtype else dtype,
                "longType": dtype,
                "keys": [k for k in keys if col["name"] in k["column_names"]],
            }
        )
    return {
        "name": table_name,
        "columns": payload_columns,
        "selectStar": database.select_star(
            table_name,
            schema=schema_name,
            show_cols=True,
            indent=True,
            cols=columns,
            latest_partition=True,
        ),
        "primaryKey": primary_key,
        "foreignKeys": foreign_keys,
        "indexes": keys,
    }


class DatabaseRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(Database)

    include_route_methods = {
        "all_schemas",
        "get_list",
        "table_metadata",
        "select_star",
        "schemas",
    }
    class_permission_name = "DatabaseView"
    method_permission_name = {
        "all_schemas": "list",
        "get_list": "list",
        "table_metadata": "list",
        "select_star": "list",
        "schemas": "list",
    }
    resource_name = "database"
    allow_browser_login = True
    base_filters = [["id", DatabaseFilter, lambda: []]]
    list_columns = [
        "id",
        "database_name",
        "expose_in_sqllab",
        "allow_ctas",
        "allow_cvas",
        "force_ctas_schema",
        "allow_run_async",
        "allow_dml",
        "allow_multi_schema_metadata_fetch",
        "allow_csv_upload",
        "allows_subquery",
        "allows_cost_estimate",
        "allows_virtual_table_explore",
        "explore_database_id",
        "backend",
        "function_names",
    ]
    list_select_columns = list_columns + ["extra", "sqlalchemy_uri", "password"]
    # Removes the local limit for the page size
    max_page_size = -1
    validators_columns = {"sqlalchemy_uri": sqlalchemy_uri_validator}

    apispec_parameter_schemas = {
        "database_schemas_query_schema": database_schemas_query_schema,
        "get_schemas_schema": get_schemas_schema,
    }
    openapi_spec_tag = "Database"
    openapi_spec_component_schemas = (
        DatabaseSchemaResponseSchema,
        TableMetadataResponseSchema,
        SelectStarResponseSchema,
        SchemasResponseSchema,
    )

    @expose("/<int:pk>/schemas/")
    @protect()
    @safe
    @rison(database_schemas_query_schema)
    @statsd_metrics
    def schemas(self, pk: int, **kwargs: Any) -> FlaskResponse:
        """ Get all schemas from a database
        ---
        get:
          description: Get all schemas from a database
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
            description: The database id
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/database_schemas_query_schema'
          responses:
            200:
              description: A List of all schemas from the database
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/SchemasResponseSchema"
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        database = self.datamodel.get(pk, self._base_filters)
        if not database:
            return self.response_404()
        try:
            schemas = database.get_all_schema_names(
                cache=database.schema_cache_enabled,
                cache_timeout=database.schema_cache_timeout,
                force=kwargs["rison"].get("force", False),
            )
            schemas = security_manager.get_schemas_accessible_by_user(database, schemas)
            return self.response(200, result=schemas)
        except OperationalError:
            return self.response(
                500, message="There was an error connecting to the database"
            )

    @expose("/<int:pk>/table/<table_name>/<schema_name>/", methods=["GET"])
    @protect()
    @check_datasource_access
    @safe
    @event_logger.log_this
    @statsd_metrics
    def table_metadata(
        self, database: Database, table_name: str, schema_name: str
    ) -> FlaskResponse:
        """ Table schema info
        ---
        get:
          description: Get database table metadata
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
            description: The database id
          - in: path
            schema:
              type: string
            name: table_name
            description: Table name
          - in: path
            schema:
              type: string
            name: schema_name
            description: Table schema
          responses:
            200:
              description: Table metadata information
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/TableMetadataResponseSchema"
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
        self.incr_stats("init", self.table_metadata.__name__)
        try:
            table_info = get_table_metadata(database, table_name, schema_name)
        except SQLAlchemyError as ex:
            self.incr_stats("error", self.table_metadata.__name__)
            return self.response_422(error_msg_from_exception(ex))
        self.incr_stats("success", self.table_metadata.__name__)
        return self.response(200, **table_info)

    @expose("/<int:pk>/select_star/<table_name>/", methods=["GET"])
    @expose("/<int:pk>/select_star/<table_name>/<schema_name>/", methods=["GET"])
    @protect()
    @check_datasource_access
    @safe
    @event_logger.log_this
    @statsd_metrics
    def select_star(
        self, database: Database, table_name: str, schema_name: Optional[str] = None
    ) -> FlaskResponse:
        """ Table schema info
        ---
        get:
          description: Get database select star for table
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
            description: The database id
          - in: path
            schema:
              type: string
            name: table_name
            description: Table name
          - in: path
            schema:
              type: string
            name: schema_name
            description: Table schema
          responses:
            200:
              description: SQL statement for a select star for table
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/SelectStarResponseSchema"
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
        self.incr_stats("init", self.select_star.__name__)
        try:
            result = database.select_star(
                table_name, schema_name, latest_partition=True, show_cols=True
            )
        except NoSuchTableError:
            self.incr_stats("error", self.select_star.__name__)
            return self.response(404, message="Table not found on the database")
        self.incr_stats("success", self.select_star.__name__)
        return self.response(200, result=result)

    @expose("/schemas/", methods=["GET"])
    @protect()
    @safe
    @statsd_metrics
    @rison(get_schemas_schema)
    def all_schemas(self, **kwargs: Any) -> FlaskResponse:
        """Get all schemas
        ---
        get:
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_schemas_schema'
          responses:
            200:
              description: Related column data
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/DatabaseSchemaResponseSchema"
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
        args = kwargs.get("rison", {})
        # handle pagination
        page, page_size = self._handle_page_args(args)
        filter_ = args.get("filter", "")

        _, databases = self.datamodel.query(page=page, page_size=page_size)
        result = []
        count = 0
        if databases:
            for database in databases:
                try:
                    schemas = database.get_all_schema_names(
                        cache=database.schema_cache_enabled,
                        cache_timeout=database.schema_cache_timeout,
                        force=False,
                    )
                except SQLAlchemyError:
                    self.incr_stats("error", self.schemas.__name__)
                    continue

                schemas = security_manager.get_schemas_accessible_by_user(
                    database, schemas
                )
                count += len(schemas)
                for schema in schemas:
                    if filter_:
                        if schema.startswith(filter_):
                            result.append({"text": schema, "value": schema})
                    else:
                        result.append({"text": schema, "value": schema})

        return self.response(200, count=count, result=result)
