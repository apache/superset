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
"""
Discovering what exists in a database.

Nothing here interpolates a name into SQL. Schema and table listings come from
the engine's own inspector via ``Database``; columns are read for a
:class:`~superset.sql.parse.Table` value object, never a formatted string. A name
the caller supplies is only ever *compared* against what the inspector returned,
so a name that does not resolve is rejected rather than passed through.

Every listing is narrowed by the security manager before it is returned:

* databases — ``DatabaseFilter`` (the filter the database REST API uses), plus
  ``expose_in_sqllab``
* schemas — ``security_manager.get_schemas_accessible_by_user``
* tables and views — ``security_manager.get_datasources_accessible_by_user``,
  reached through ``TablesDatabaseCommand``
* columns — ``security_manager.raise_for_access(database=..., table=...)``
"""

from __future__ import annotations

import logging
from typing import Any, ClassVar

from superset.ai.tools.base import AITool, ToolError, ToolOutput

logger = logging.getLogger(__name__)

#: Tables listed for one schema before the list is cut. A wide warehouse has
#: thousands; the model needs enough to recognise a naming scheme, and can
#: narrow with ``table`` once it has.
MAX_TABLES = 200

#: Columns described for one table. Wide fact tables exist, but a model that
#: needs more than this is better served by asking about specific columns.
MAX_COLUMNS = 300


class ListDatabasesTool(AITool):
    """Enumerate the database connections the user may query."""

    name: ClassVar[str] = "list_databases"
    description: ClassVar[str] = (
        "List the Superset database connections you can query, with the id each "
        "one needs for get_schema and execute_sql. Start here when you do not "
        "already know which database holds the data."
    )
    input_schema: ClassVar[dict[str, Any]] = {
        "type": "object",
        "properties": {},
    }

    def run(self, **_ignored: Any) -> ToolOutput:
        from superset.daos.database import DatabaseDAO
        from superset.mcp_service.utils.sanitization import sanitize_for_llm_context

        # find_all applies DatabaseFilter, so this is already scoped to the
        # user's grants; expose_in_sqllab then honours the operator's decision
        # about which connections may be queried ad hoc at all.
        databases = [
            database for database in DatabaseDAO.find_all() if database.expose_in_sqllab
        ]
        databases.sort(key=lambda item: (item.database_name or "").lower())

        rows: list[dict[str, Any]] = []
        for database in databases:
            rows.append(
                {
                    "id": database.id,
                    # The connection name is operator-authored free text, so it
                    # is wrapped as untrusted before it reaches the model.
                    "name": sanitize_for_llm_context(database.database_name),
                    "backend": database.backend,
                    "allows_writes": bool(database.allow_dml),
                }
            )

        return ToolOutput.of(
            {"databases": rows, "count": len(rows)},
            display={
                "kind": "database_list",
                "count": len(rows),
                # Names only, so the UI can say which connections were offered
                # without the summary carrying anything about how to reach them.
                "databases": [
                    {"id": database.id, "name": database.database_name}
                    for database in databases
                ],
            },
        )


def _database_or_refuse(database_id: Any) -> Any:
    """Resolve a queryable database for the current user, or refuse."""
    from superset.daos.database import DatabaseDAO

    if not isinstance(database_id, int) or isinstance(database_id, bool):
        raise ToolError("'database_id' must be an integer. Use list_databases first.")

    database = DatabaseDAO.find_by_id(database_id)
    if database is None or not database.expose_in_sqllab:
        raise ToolError(
            f"No database with id {database_id} is available to you. "
            f"Call list_databases to see the ones you can query."
        )
    return database


def _accessible_schemas(database: Any, catalog: str | None) -> list[str]:
    """Schema names the user may see, narrowed by the security manager."""
    from superset import security_manager

    try:
        names = database.get_all_schema_names(catalog=catalog)
    except Exception:  # pylint: disable=broad-except
        # A connection problem is not something the model can fix by rewording,
        # so the driver's message is kept out of its context.
        logger.exception("Could not list schemas for database %s", database.id)
        raise ToolError(
            f"Could not read the schema list from database {database.database_name!r}."
        ) from None

    return sorted(
        security_manager.get_schemas_accessible_by_user(
            database=database,
            catalog=catalog,
            schemas=set(names),
        )
    )


def _accessible_tables(
    database: Any,
    catalog: str | None,
    schema: str,
) -> list[dict[str, str]]:
    """
    Tables, views and materialized views in ``schema`` the user may see.

    Delegates to ``TablesDatabaseCommand`` rather than calling the inspector
    directly, because that command already routes every candidate name through
    ``security_manager.get_datasources_accessible_by_user``. Each entry carries
    its kind so the model knows whether it is querying a table or a view.
    """
    from superset.commands.database.tables import TablesDatabaseCommand

    try:
        payload = TablesDatabaseCommand(database.id, catalog, schema, False).run()
    except Exception:  # pylint: disable=broad-except
        logger.exception(
            "Could not list tables for database %s schema %s", database.id, schema
        )
        raise ToolError(
            f"Could not read the table list for schema {schema!r}."
        ) from None

    entries = [
        {
            "name": str(option["value"]),
            "kind": str(option.get("type") or "table"),
        }
        for option in payload.get("result", [])
        if isinstance(option, dict) and option.get("value")
    ]
    return sorted(entries, key=lambda item: item["name"])


def _describe_columns(
    database: Any,
    catalog: str | None,
    schema: str,
    table: str,
) -> Any:
    """
    Read one table's columns, after checking the user may read that table.

    The name is passed as a :class:`~superset.sql.parse.Table` value object, so
    the engine's inspector does the quoting. No string is built here.
    """
    from superset import security_manager
    from superset.exceptions import SupersetSecurityException
    from superset.sql.parse import Table

    target = Table(table=table, schema=schema, catalog=catalog)

    try:
        security_manager.raise_for_access(database=database, table=target)
    except SupersetSecurityException as ex:
        raise ToolError(str(ex.error.message)) from None

    try:
        return database.get_columns(target)
    except Exception:  # pylint: disable=broad-except
        logger.exception("Could not describe %s in database %s", table, database.id)
        raise ToolError(
            f"Could not read the columns of {table!r}. Check the name against "
            f"the table list for this schema."
        ) from None


class GetSchemaTool(AITool):
    """Walk a database's schemas, tables and columns."""

    name: ClassVar[str] = "get_schema"
    description: ClassVar[str] = (
        "Discover what a database contains. Called with only database_id it "
        "lists the schemas you may read; add schema_name to list that schema's "
        "tables; add table_name as well to describe one table's columns and "
        "types. Use this to get exact table and column names before writing SQL "
        "— do not guess them."
    )
    input_schema: ClassVar[dict[str, Any]] = {
        "type": "object",
        "properties": {
            "database_id": {
                "type": "integer",
                "description": "Database to inspect, from list_databases.",
            },
            "schema_name": {
                "type": "string",
                "description": "Schema to list tables for. Omit to list schemas.",
            },
            "table_name": {
                "type": "string",
                "description": ("Table to describe columns for. Requires schema_name."),
            },
            "catalog": {
                "type": "string",
                "description": "Catalog to inspect, for engines that have them.",
            },
        },
        "required": ["database_id"],
    }

    def run(
        self,
        database_id: Any = None,
        schema_name: Any = None,
        table_name: Any = None,
        catalog: Any = None,
        **_ignored: Any,
    ) -> ToolOutput:
        from superset.mcp_service.utils.query_utils import validate_names
        from superset.mcp_service.utils.sanitization import sanitize_for_llm_context

        database = _database_or_refuse(database_id)
        catalog_name = str(catalog) if catalog else database.get_default_catalog()

        if not schema_name:
            if table_name:
                raise ToolError("'table_name' also needs 'schema_name'.")
            schemas = _accessible_schemas(database, catalog_name)
            return ToolOutput.of(
                {
                    "database_id": database.id,
                    "catalog": catalog_name,
                    "schemas": schemas,
                    "count": len(schemas),
                },
                display={
                    "kind": "schema_list",
                    "database_id": database.id,
                    "catalog": catalog_name,
                    "count": len(schemas),
                    "schemas": schemas,
                },
            )

        schema = str(schema_name)
        # The schema is resolved against what the inspector reported rather than
        # trusted, so an unrecognised name cannot reach the engine at all. The
        # "did you mean" suggestion lets the model correct itself in one turn.
        allowed_schemas = _accessible_schemas(database, catalog_name)
        if schema not in allowed_schemas:
            hints = validate_names([schema], set(allowed_schemas), "schema")
            raise ToolError(
                hints[0]
                if hints
                else f"Schema {schema!r} is not available in this database."
            )

        tables = _accessible_tables(database, catalog_name, schema)
        table_names = {entry["name"] for entry in tables}

        if not table_name:
            payload: dict[str, Any] = {
                "database_id": database.id,
                "catalog": catalog_name,
                "schema": schema,
                "tables": tables[:MAX_TABLES],
                "count": len(tables),
            }
            if len(tables) > MAX_TABLES:
                payload["truncated"] = True
                payload["note"] = (
                    f"Showing {MAX_TABLES} of {len(tables)} tables. Pass "
                    f"table_name to describe a specific one."
                )
            return ToolOutput.of(
                payload,
                display={
                    "kind": "table_list",
                    "database_id": database.id,
                    "catalog": catalog_name,
                    "schema": schema,
                    "count": len(tables),
                    "truncated": bool(payload.get("truncated", False)),
                    "tables": [entry["name"] for entry in tables[:MAX_TABLES]],
                },
            )

        table = str(table_name)
        if table not in table_names:
            hints = validate_names([table], table_names, "table")
            raise ToolError(
                hints[0]
                if hints
                else (
                    f"Table {table!r} is not available in schema {schema!r}. "
                    f"Call get_schema with just schema_name to list the tables "
                    f"you can read."
                )
            )

        columns = _describe_columns(database, catalog_name, schema, table)
        described = [
            {
                "name": str(column.get("column_name") or column.get("name") or ""),
                "type": str(column.get("type") or ""),
                "nullable": bool(column.get("nullable", True)),
                # Column comments are authored in the warehouse, i.e. outside
                # Superset's trust boundary, so they are wrapped as untrusted.
                "comment": sanitize_for_llm_context(column.get("comment") or None),
            }
            for column in columns[:MAX_COLUMNS]
        ]
        result: dict[str, Any] = {
            "database_id": database.id,
            "catalog": catalog_name,
            "schema": schema,
            "table": table,
            "columns": described,
            "column_count": len(columns),
        }
        if len(columns) > MAX_COLUMNS:
            result["truncated"] = True
            result["note"] = f"Showing {MAX_COLUMNS} of {len(columns)} columns."
        return ToolOutput.of(
            result,
            display={
                "kind": "table_columns",
                "database_id": database.id,
                "catalog": catalog_name,
                "schema": schema,
                "table": table,
                "column_count": len(columns),
                "truncated": bool(result.get("truncated", False)),
                # Names and types only; a column comment can be long and is
                # already in the model-facing copy.
                "columns": [
                    {"name": column["name"], "type": column["type"]}
                    for column in described
                ],
            },
        )
