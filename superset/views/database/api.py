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

from flask_appbuilder.api import expose, protect, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import lazy_gettext as _
from sqlalchemy.exc import SQLAlchemyError

from superset import event_logger
from superset.models.core import Database
from superset.utils.core import error_msg_from_exception, parse_js_uri_path_item
from superset.views.base_api import BaseSupersetModelRestApi
from superset.views.database.filters import DatabaseFilter
from superset.views.database.mixins import DatabaseMixin
from superset.views.database.validators import sqlalchemy_uri_validator


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

    include_route_methods = {"get_list", "table_metadata"}
    class_permission_name = "DatabaseView"
    method_permission_name = {"get_list": "list", "table_metadata": "list"}
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
    @safe
    @event_logger.log_this
    def table_metadata(
        self, pk: int, table_name: str, schema_name: str
    ):  # pylint: disable=invalid-name
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
        table_name_parsed = parse_js_uri_path_item(table_name)
        schema_parsed = parse_js_uri_path_item(schema_name, eval_undefined=True)
        # schemas can be None but not tables
        if not table_name_parsed:
            return self.response_422(message=_(f"Could not parse table name or schema"))
        database: Database = self.datamodel.get(pk, self._base_filters)
        if not database:
            return self.response_404()

        try:
            table_info: Dict = get_table_metadata(
                database, table_name_parsed, schema_parsed
            )
        except SQLAlchemyError as e:
            return self.response_422(error_msg_from_exception(e))
        return self.response(200, **table_info)
