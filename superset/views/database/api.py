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
from typing import Any, Callable, Dict, List, Optional

from flask import g
from flask_appbuilder.api import expose, protect, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from sqlalchemy.exc import NoSuchTableError, SQLAlchemyError

from superset import app, event_logger, security_manager
from superset.models.core import Database
from superset.utils.core import (
    DatasourceName,
    error_msg_from_exception,
    parse_js_uri_path_item,
)
from superset.views.base_api import BaseSupersetModelRestApi
from superset.views.database.decorators import check_datasource_access
from superset.views.database.filters import DatabaseFilter
from superset.views.database.mixins import DatabaseMixin
from superset.views.database.validators import sqlalchemy_uri_validator


def get_datasource_label(ds_name: DatasourceName, schema_name: Optional[str]) -> str:
    return ds_name.table if schema_name else f"{ds_name.schema}.{ds_name.table}"


def get_all_names_in_database(  # pylint: disable=too-many-arguments
    get_all_in_schema_func: Callable,
    get_all_in_database_func: Callable,
    database: Database,
    schema_name: Optional[str],
    substr: Optional[str],
    force_refresh: bool,
) -> List[DatasourceName]:
    if schema_name:
        tables_views = (
            get_all_in_schema_func(
                schema=schema_name,
                force=force_refresh,
                cache=database.table_cache_enabled,
                cache_timeout=database.table_cache_timeout,
            )
            or []
        )
    else:
        tables_views = get_all_in_database_func(
            cache=True, force=False, cache_timeout=24 * 60 * 60
        )
    if substr:
        tables_views = [
            ds for ds in tables_views if substr in get_datasource_label(ds, schema_name)
        ]
    return security_manager.get_datasources_accessible_by_user(
        database, tables_views, schema_name
    )


def get_all_table_names_in_database(
    database: Database,
    schema_name: Optional[str],
    substr: Optional[str],
    force_refresh: bool,
) -> List[DatasourceName]:
    return get_all_names_in_database(
        database.get_all_table_names_in_schema,
        database.get_all_table_names_in_database,
        database,
        schema_name,
        substr,
        force_refresh,
    )


def get_all_view_names_in_database(
    database: Database,
    schema_name: Optional[str],
    substr: Optional[str],
    force_refresh: bool,
) -> List[DatasourceName]:
    return get_all_names_in_database(
        database.get_all_view_names_in_schema,
        database.get_all_view_names_in_database,
        database,
        schema_name,
        substr,
        force_refresh,
    )


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


def get_col_type(col: Dict) -> str:
    try:
        dtype = f"{col['type']}"
    except Exception:  # pylint: disable=broad-except
        # sqla.types.JSON __str__ has a bug, so using __class__.
        dtype = col["type"].__class__.__name__
    return dtype


def get_table_metadata(
    database: Database, table_name: str, schema_name: Optional[str]
) -> Dict:
    """
        Get table metadata information, including type, pk, fks.
        This function raises SQLAlchemyError when a schema is not found.


    :param database: The database model
    :param table_name: Table name
    :param schema_name: schema name
    :return: Dict table metadata ready for API response
    """
    keys: List = []
    columns = database.get_columns(table_name, schema_name)
    primary_key = database.get_pk_constraint(table_name, schema_name)
    if primary_key and primary_key.get("constrained_columns"):
        primary_key["column_names"] = primary_key.pop("constrained_columns")
        primary_key["type"] = "pk"
        keys += [primary_key]
    foreign_keys = get_foreign_keys_metadata(database, table_name, schema_name)
    indexes = get_indexes_metadata(database, table_name, schema_name)
    keys += foreign_keys + indexes
    payload_columns: List[Dict] = []
    for col in columns:
        dtype = get_col_type(col)
        payload_columns.append(
            {
                "name": col["name"],
                "type": dtype.split("(")[0] if "(" in dtype else dtype,
                "longType": dtype,
                "keys": [k for k in keys if col["name"] in k.get("column_names")],
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


class DatabaseRestApi(DatabaseMixin, BaseSupersetModelRestApi):
    datamodel = SQLAInterface(Database)

    include_route_methods = {"get_list", "table_metadata", "tables", "select_star"}
    class_permission_name = "DatabaseView"
    method_permission_name = {
        "get_list": "list",
        "table_metadata": "list",
        "tables": "list",
        "select_star": "list",
    }
    resource_name = "database"
    allow_browser_login = True
    base_filters = [["id", DatabaseFilter, lambda: []]]
    list_columns = [
        "id",
        "database_name",
        "expose_in_sqllab",
        "allow_ctas",
        "force_ctas_schema",
        "allow_run_async",
        "allow_dml",
        "allow_multi_schema_metadata_fetch",
        "allow_csv_upload",
        "allows_subquery",
        "allows_cost_estimate",
        "backend",
        "function_names",
    ]
    show_columns = list_columns

    # Removes the local limit for the page size
    max_page_size = -1
    validators_columns = {"sqlalchemy_uri": sqlalchemy_uri_validator}

    @expose(
        "/<int:pk>/table/<string:table_name>/<string:schema_name>/", methods=["GET"]
    )
    @protect()
    @check_datasource_access
    @safe
    @event_logger.log_this
    def table_metadata(self, database: Database, table_name: str, schema_name: str):
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
            name: schema
            description: Table schema
          responses:
            200:
              description: Table schema info
              content:
                text/plain:
                  schema:
                    type: object
                    properties:
                      columns:
                        type: array
                        description: Table columns info
                        items:
                          type: object
                          properties:
                            keys:
                              type: array
                              items:
                                type: string
                            longType:
                              type: string
                            name:
                              type: string
                            type:
                              type: string
                      foreignKeys:
                        type: array
                        description: Table list of foreign keys
                        items:
                          type: object
                          properties:
                            column_names:
                              type: array
                              items:
                                type: string
                            name:
                              type: string
                            options:
                              type: object
                            referred_columns:
                              type: array
                              items:
                                type: string
                            referred_schema:
                              type: string
                            referred_table:
                              type: string
                            type:
                              type: string
                      indexes:
                        type: array
                        description: Table list of indexes
                        items:
                          type: object
                          properties:
                            column_names:
                              type: array
                              items:
                                type: string
                            name:
                              type: string
                            options:
                              type: object
                            referred_columns:
                              type: array
                              items:
                                type: string
                            referred_schema:
                              type: string
                            referred_table:
                              type: string
                            type:
                              type: string
                      primaryKey:
                        type: object
                        properties:
                          column_names:
                            type: array
                            items:
                              type: string
                          name:
                            type: string
                          type:
                            type: string
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
            table_info: Dict = get_table_metadata(database, table_name, schema_name)
        except SQLAlchemyError as e:
            self.incr_stats("error", self.table_metadata.__name__)
            return self.response_422(error_msg_from_exception(e))
        self.incr_stats("success", self.table_metadata.__name__)
        return self.response(200, **table_info)

    @expose("/<int:pk>/tables/<string:schema_name>/<string:substr>/", methods=["GET"])
    @expose(
        "/<int:pk>/tables/<string:schema_name>/<string:substr>/<force_refresh>/",
        methods=["GET"],
    )
    @protect()
    @safe
    @event_logger.log_this
    def tables(
        self, pk: int, schema_name: str, substr: str, force_refresh="false"
    ):  # pylint: disable=invalid-name,too-many-locals
        """ Table schema info
        ---
        get:
          description: >-
            Get a list of tables from a database/schema
          parameters:
          - in: path
            name: pk
            description: The database id
            schema:
              type: integer
          - in: path
            description: Table schema
            name: schema
            schema:
              type: string
          - in: path
            description: Sub string
            name: substr
            schema:
              type: string
          - in: path
            description: force cache refresh
            name: force_refresh
            schema:
              type: bool
          responses:
            200:
              description: Table schema info
              content:
                text/plain:
                  schema:
                    type: object
                    properties:
                      options:
                        type: array
                        items:
                          type: object
                          properties:
                            label:
                              type: string
                            schema:
                              type: string
                            title:
                              type: string
                            type:
                              type: string
                            value:
                              type: string
                      tableLength:
                        type: number
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
        self.incr_stats("init", self.tables.__name__)
        force_refresh = force_refresh.lower() == "true"
        schema_parsed = parse_js_uri_path_item(schema_name, eval_undefined=True)
        substr_parsed = parse_js_uri_path_item(substr, eval_undefined=True)
        # Guarantees filtering on databases
        database: Database = self.datamodel.get(pk, self._base_filters)
        if not database:
            self.incr_stats("error", self.tables.__name__)
            return self.response_404()

        tables = get_all_table_names_in_database(
            database, schema_parsed, substr_parsed, force_refresh
        )
        views = get_all_view_names_in_database(
            database, schema_parsed, substr_parsed, force_refresh
        )

        if not schema_parsed and database.default_schemas:
            user_schema = g.user.email.split("@")[0]
            valid_schemas = set(database.default_schemas + [user_schema])

            tables = [tn for tn in tables if tn.schema in valid_schemas]
            views = [vn for vn in views if vn.schema in valid_schemas]

        max_items = app.config["MAX_TABLE_NAMES"] or len(tables)
        total_items = len(tables) + len(views)
        max_tables = len(tables)
        max_views = len(views)
        if total_items and substr_parsed:
            max_tables = max_items * len(tables) // total_items
            max_views = max_items * len(views) // total_items

        table_options = [
            {
                "value": tn.table,
                "schema": tn.schema,
                "label": get_datasource_label(tn, schema_parsed),
                "title": get_datasource_label(tn, schema_parsed),
                "type": "table",
            }
            for tn in tables[:max_tables]
        ]
        table_options.extend(
            [
                {
                    "value": vn.table,
                    "schema": vn.schema,
                    "label": get_datasource_label(vn, schema_parsed),
                    "title": get_datasource_label(vn, schema_parsed),
                    "type": "view",
                }
                for vn in views[:max_views]
            ]
        )
        table_options.sort(key=lambda value: value["label"])
        self.incr_stats("success", self.tables.__name__)
        return self.response(
            200, tableLength=len(tables) + len(views), options=table_options
        )

    @expose("/<int:pk>/select_star/<string:table_name>/", methods=["GET"])
    @expose(
        "/<int:pk>/select_star/<string:table_name>/<string:schema_name>/",
        methods=["GET"],
    )
    @protect()
    @check_datasource_access
    @safe
    @event_logger.log_this
    def select_star(self, database: Database, table_name: str, schema_name: str = None):
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
              description: select star for table
              content:
                text/plain:
                  schema:
                    type: object
                    properties:
                      result:
                        type: string
                        description: SQL select star
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
