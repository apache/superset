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

from __future__ import annotations

import logging
from typing import Any, TYPE_CHECKING

from sqlalchemy.engine.url import make_url, URL

from superset.commands.database.exceptions import DatabaseInvalidError
from superset.sql.parse import Table

if TYPE_CHECKING:
    from superset.databases.schemas import (
        TableMetadataColumnsResponse,
        TableMetadataForeignKeysIndexesResponse,
        TableMetadataResponse,
    )

logger = logging.getLogger(__name__)


def get_foreign_keys_metadata(
    database: Any,
    table: Table,
) -> list[TableMetadataForeignKeysIndexesResponse]:
    foreign_keys = database.get_foreign_keys(table)
    for fk in foreign_keys:
        fk["column_names"] = fk.pop("constrained_columns")
        fk["type"] = "fk"
    return foreign_keys


def get_indexes_metadata(
    database: Any,
    table: Table,
) -> list[TableMetadataForeignKeysIndexesResponse]:
    indexes = database.get_indexes(table)
    for idx in indexes:
        idx["type"] = "index"
    return indexes


def get_col_type(col: dict[Any, Any]) -> str:
    try:
        dtype = f"{col['type']}"
    except Exception:  # pylint: disable=broad-except
        # sqla.types.JSON __str__ has a bug, so using __class__.
        dtype = col["type"].__class__.__name__
    return dtype


def get_table_metadata(database: Any, table: Table) -> TableMetadataResponse:
    """
    Get table metadata information, including type, pk, fks.
    This function raises SQLAlchemyError when a schema is not found.

    :param database: The database model
    :param table: Table instance
    :return: Dict table metadata ready for API response
    """
    keys = []
    columns = database.get_columns(table)
    primary_key = database.get_pk_constraint(table)
    if primary_key and primary_key.get("constrained_columns"):
        primary_key["column_names"] = primary_key.pop("constrained_columns")
        primary_key["type"] = "pk"
        keys += [primary_key]
    foreign_keys = get_foreign_keys_metadata(database, table)
    indexes = get_indexes_metadata(database, table)
    keys += foreign_keys + indexes
    payload_columns: list[TableMetadataColumnsResponse] = []
    table_comment = database.get_table_comment(table)
    for col in columns:
        dtype = get_col_type(col)
        payload_columns.append(
            {
                "name": col["column_name"],
                "type": dtype.split("(")[0] if "(" in dtype else dtype,
                "longType": dtype,
                "keys": [k for k in keys if col["column_name"] in k["column_names"]],
                "comment": col.get("comment"),
            }
        )
    return {
        "name": table.table,
        "columns": payload_columns,
        "selectStar": database.select_star(
            table,
            indent=True,
            cols=columns,
            latest_partition=True,
        ),
        "primaryKey": primary_key,
        "foreignKeys": foreign_keys,
        "indexes": keys,
        "comment": table_comment,
    }


def make_url_safe(raw_url: str | URL) -> URL:
    """
    Wrapper for SQLAlchemy's make_url(), which tends to raise too detailed of
    errors, which inevitably find their way into server logs. ArgumentErrors
    tend to contain usernames and passwords, which makes them non-log-friendly
    :param raw_url:
    :return:
    """

    if isinstance(raw_url, str):
        url = raw_url.strip()
        try:
            return make_url(url)  # noqa
        except Exception as ex:
            raise DatabaseInvalidError() from ex

    else:
        return raw_url


def get_database_metadata(
    database: Any,
    catalog: str | None = None,
    include_indexes: bool = True,
    tables: list[str] | None = None,
    top_k: int = 10,
    top_k_limit: int = 100000,
) -> List[Schema]:
    """
    Get database metadata information, including schemas, tables, columns, indexes, fks.
    :param database: The database model
    :return: Database metadata ready for API response
    """
    logger.info(f"Getting metadata for database {database.database_name}")

    # Build the list of selected schemas from the list of tables by extracting the schema name
    schemas = set()
    if tables:
        for table in tables:
            schema = table.split(".")[0]
            schemas.add(schema)

    db_schemas = database.get_all_schema_names(catalog=catalog, cache=False)
    logger.info(f"Found schemas: {db_schemas}")
    schemas_info = []

    for schema in db_schemas:
        if tables and (len(tables) > 0) and (schema not in schemas):
            logger.info(f"Skipping schema {schema} not in schemas")
            continue
        schema_info = get_schema_metadata(
            database,
            schema,
            tables=tables,
            include_indexes=include_indexes,
            top_k=top_k,
            top_k_limit=top_k_limit,
        )
        schemas_info.append(schema_info)

    return schemas_info


def get_schema_metadata(
    database: Any,
    schema: str,
    catalog: str | None = None,
    tables: list[str] | None = None,
    include_indexes: bool = True,
    top_k: int = 10,
    top_k_limit: int = 100000,
) -> Schema:
    """
    Get schema metadata information, including tables, columns, indexes, fks.
    :param database: The database model
    :param schema: The schema name
    :return: Schema metadata ready for API response
    """
    db_tables = database.get_all_table_names_in_schema(catalog=catalog, schema=schema)
    relations = []

    for table, schema, catalog in db_tables:
        if tables and len(tables) > 0 and f"{schema}.{table}" not in tables:
            logger.info(f"Skipping table {table} not in tables")
            continue
        t = Table(catalog=catalog, schema=schema, table=table)
        table_metadata = get_table_relation_metadata(
            database,
            t,
            include_indexes=include_indexes,
            top_k=top_k,
            top_k_limit=top_k_limit,
        )
        relations.append(table_metadata)

    views = database.get_all_view_names_in_schema(catalog=catalog, schema=schema)
    for view, schema, catalog in views:
        v = Table(catalog=catalog, schema=schema, table=view)
        view_metadata = get_view_relation_metadata(database, v)
        relations.append(view_metadata)

    return Schema(
        schema_name=schema,
        relations=relations,
    )


def get_table_relation_metadata(
    database: Any,
    table: Table,
    include_indexes: bool = True,
    top_k: int = 10,
    top_k_limit: int = 100000,
) -> Relation:
    """
    Get table metadata information, including type, pk, fks.
    This function raises SQLAlchemyError when a schema is not found.

    :param database: The database model
    :param table: Table instance
    :return: Dict table metadata ready for API response
    """
    columns = database.get_columns(table)
    primary_key = database.get_pk_constraint(table)
    if primary_key and primary_key.get("constrained_columns"):
        primary_key["column_names"] = primary_key.pop("constrained_columns")
        primary_key["type"] = "pk"

    foreign_keys = get_foreign_keys_relation_data(database, table)

    if include_indexes:
        indexes = get_indexes_relation_data(database, table)
    else:
        indexes = []

    payload_columns: list[Column] = []
    table_comment = database.get_table_comment(table)

    for col in columns:
        dtype = get_col_type(col)
        dtype = dtype.split("(")[0] if "(" in dtype else dtype

        top_k_values = None
        if dtype in ["CHAR", "VARCHAR", "TEXT", "STRING", "NVARCHAR"]:
            top_k_values = get_column_top_k_values(
                database,
                table,
                col["column_name"],
                table.schema,
                top_k=top_k,
                top_k_limit=top_k_limit,
            )

        column_metadata = {
            "column_name": col["column_name"],
            "data_type": dtype,
            "is_nullable": col["nullable"],
            "column_description": col.get("comment"),
        }
        if top_k_values:
            column_metadata["most_common_values"] = top_k_values

        payload_columns.append(column_metadata)

    result = {
        "rel_name": table.table,
        "rel_kind": "table",
        "rel_description": table_comment,
        "foreign_keys": foreign_keys,
        "columns": payload_columns,
    }
    if include_indexes:
        result["indexes"] = indexes

    return result


def get_column_top_k_values(
    database: Any,
    table: Table,
    column_name: str,
    schema: str,
    top_k: int = 10,
    top_k_limit: int = 100000,
) -> List:
    # db_type = database.db_engine_spec.engine
    # logging.info(f"Getting top k values for {column_name} in {table.__str__()} {schema} {db_type}")

    query = f"""
    SELECT \"{column_name}\" AS value, COUNT(*) AS frequency
    FROM (SELECT \"{column_name}\" FROM \"{table.table}\" LIMIT {top_k_limit}) AS subquery
    WHERE \"{column_name}\" IS NOT NULL
    GROUP BY \"{column_name}\"
    ORDER BY frequency DESC
    LIMIT {top_k};
    """

    db_engine_spec = database.db_engine_spec

    with database.get_raw_connection(catalog="", schema=schema) as conn:
        cursor = conn.cursor()
        mutated_query = database.mutate_sql_based_on_config(query)
        try:
            cursor.execute(mutated_query)
            db_engine_spec.execute(cursor, mutated_query, database)
            result = db_engine_spec.fetch_data(cursor)
        except Exception as e:
            logging.error(
                f"Unable to retrieve top_k values on {schema}/{table}, column {column_name}: {e}"
            )
            return []

    return [value for (value, _) in result]


def get_view_relation_metadata(
    database: Any,
    schema: str,
) -> List[Relation]:
    relation = get_table_relation_metadata(database, schema)
    relation["rel_kind"] = "view"

    return relation


def get_foreign_keys_relation_data(
    database: Any,
    table: Table,
) -> List[FKey]:
    foreign_keys = database.get_foreign_keys(table)
    ret = []
    for fk in foreign_keys:
        result = {}
        result["column_name"] = fk.pop("constrained_columns")[0]
        result["referenced_column"] = fk.pop("referred_columns")[0]
        result["constraint_name"] = fk.pop("name")
        ret.append(result)
    return ret


def get_indexes_relation_data(
    database: Any,
    table: Table,
) -> List[Index]:
    indexes = database.get_indexes(table)
    ret = []
    for idx in indexes:
        result = {}
        result["column_names"] = idx.pop("column_names")
        result["is_unique"] = idx.pop("unique")
        result["index_name"] = idx.pop("name")
        result["index_definition"] = None
        ret.append(result)
    return ret


from typing import List, Optional

from pydantic import BaseModel, Field


class FKey(BaseModel):
    """
    Contains information about a foreign key contraints.
    """

    constraint_name: str = Field(description="Name of the the foreign key constraint.")
    column_name: str = Field(
        description="Name of the column to which the foreign key constraint is applied."
    )
    referenced_column: str = Field(
        description="Foreign column referenced by the constraint, expressed as 'foreign_schema_name.foreign_table_name.foreign_column_name'."
    )


class Index(BaseModel):
    """
    Contains information about an index.
    """

    index_name: str = Field(description="Name of the index.")
    is_unique: bool = Field(description="Whether the index is a unique constraint.")
    column_names: List[str] = Field(
        description="Name of the column(s) constituting the index."
    )
    index_definition: Optional[str] = Field(description="CREATE INDEX statement.")


class Column(BaseModel):
    """
    Contains information about a column.
    """

    column_name: str = Field(description="Name of the column.")
    data_type: str = Field(description="Column data type.")
    is_nullable: bool = Field(
        description="Whether the column has or not a NOT NULL constraint."
    )
    column_description: Optional[str] = Field(
        default=None, description="SQL comment associated with the column."
    )
    most_common_values: Optional[List] = Field(
        default=None, description="Most common values in the last many records."
    )


class Relation(BaseModel):
    """
    Contains information about a relation, which is a table, a view or a materialized view. This includes columns, indexes and foreign keys.
    """

    rel_name: str = Field(description="Name of the relation.")
    rel_kind: str = Field(description="Type of relation, such as 'table' or 'view'.")
    rel_description: Optional[str] = Field(
        default=None, description="SQL comment associated with the relation."
    )
    indexes: Optional[List[Index]] = Field(
        default=None, description="Indexes associated with columns of the relation."
    )
    foreign_keys: Optional[List[FKey]] = Field(
        default=None,
        description="Foreign keys associated with columns of the relation.",
    )
    columns: List[Column] = Field(
        default=[], description="Columns belonging to the relation."
    )


class Schema(BaseModel):
    """
    Contains information about a schema, including its relations.
    """

    schema_name: str = Field(description="Name of the schema.")
    schema_description: Optional[str] = Field(
        default=None, description="SQL comment associated with the schema."
    )
    relations: List[Relation] = Field(
        default=[], description="Relations belonging to the schema."
    )
