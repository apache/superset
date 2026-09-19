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
Running and checking SQL.

Both tools are reads. ``execute_sql`` decides that with Superset's own parser
rather than a keyword match, because a prefix match is defeated by a leading
comment, a CTE wrapping a mutation, and a second statement smuggled after a
legitimate ``SELECT`` — all of which the parser already handles for the rest of
Superset.

Authorization is layered deliberately:

1. ``DatabaseDAO.find_by_id`` applies ``DatabaseFilter``, so a database the user
   has no grant on is indistinguishable from one that does not exist.
2. ``expose_in_sqllab`` is honoured, so an operator who withheld a connection
   from ad-hoc querying has also withheld it here.
3. The database's ``allow_dml`` setting is checked.
4. Every statement must be non-mutating.
5. ``security_manager.raise_for_access`` with ``force_dataset_match=True`` — the
   same strictness SQL Lab applies — so the tables referenced must resolve to
   datasets the user may read.
"""

from __future__ import annotations

import logging
import time
from decimal import Decimal
from typing import Any, Callable, ClassVar

from superset.ai.tools.base import AITool, ToolError, ToolOutput

logger = logging.getLogger(__name__)

#: Rows returned when the caller does not ask for a specific limit. Small on
#: purpose: an agent inspecting data needs a shape, not a dump, and the model
#: pays for every row in context.
DEFAULT_ROW_LIMIT = 100

#: Rows kept in the UI summary. The summary is persisted on the message and sent
#: to the browser, so it carries a sample rather than the result set.
DISPLAY_SAMPLE_ROWS = 20

#: Characters of executed SQL shown in the UI summary.
DISPLAY_SQL_CHARS = 4000


def _raise_for_sqllab_access() -> None:
    """Require the same execution permission as SQL Lab's query endpoint."""
    from superset import security_manager

    if not security_manager.can_access("can_execute_sql_query", "SQLLab"):
        raise ToolError("You do not have permission to execute SQL in SQL Lab.")


def _database_or_refuse(database_id: Any) -> Any:
    """
    Resolve a database the current user is allowed to query, or refuse.

    Uses the DAO so that ``DatabaseFilter`` — the same filter the database REST
    API applies — decides visibility. A database the user cannot see is reported
    as "not found" rather than "forbidden", so the tool cannot be used to probe
    for the existence of connections.
    """
    from superset.daos.database import DatabaseDAO

    if not isinstance(database_id, int) or isinstance(database_id, bool):
        raise ToolError("'database_id' must be an integer. Use list_databases first.")

    database = DatabaseDAO.find_by_id(database_id)
    if database is None:
        raise ToolError(
            f"No database with id {database_id} is available to you. "
            f"Call list_databases to see the ones you can query."
        )
    if not database.expose_in_sqllab:
        raise ToolError(
            f"Database {database.database_name!r} is not available for ad-hoc "
            f"queries. Call list_databases to see the ones that are."
        )
    return database


def _parse_or_refuse(sql: str, database: Any) -> Any:
    """
    Parse ``sql`` for the database's engine, or refuse.

    Fails closed: SQL that will not parse cannot be shown to be read-only, so it
    is refused rather than executed. The parser error is logged rather than
    returned, because its message quotes the offending query back and that text
    is not ours to echo.
    """
    from superset.sql.parse import SQLScript

    if not isinstance(sql, str) or not sql.strip():
        raise ToolError("'sql' must be a non-empty string.")

    try:
        return SQLScript(sql, database.db_engine_spec.engine)
    except Exception:  # pylint: disable=broad-except
        logger.info("Refusing unparseable SQL for database %s", database.id)
        raise ToolError(
            "That SQL could not be parsed. Send a single, syntactically valid "
            "read-only statement."
        ) from None


def _assert_read_only(script: Any, database: Any) -> None:
    """
    Refuse anything that is not a read.

    The ``allow_dml`` check comes first because it is the more specific refusal:
    telling the model the *deployment* forbids writes on this connection is more
    useful than a generic "read-only tool" message. The blanket mutation check
    then applies even where ``allow_dml`` is enabled, since this tool is a read
    regardless of what the connection would otherwise permit.
    """
    has_mutation = script.has_mutation()

    if has_mutation and not database.allow_dml:
        raise ToolError(
            f"Writes are disabled on database "
            f"{database.database_name!r} (allow_dml is off). Rewrite this as a "
            f"SELECT."
        )
    if has_mutation:
        raise ToolError(
            "This tool only runs read-only SQL. Rewrite this as a SELECT — "
            "statements that modify data or schema are refused."
        )
    # A statement the parser could not fully model has no enumerable table
    # references, so neither the mutation check above nor the per-table
    # authorization below can vouch for it. Refused rather than guessed at.
    if script.has_unparseable_statement:
        raise ToolError(
            "That SQL contains a statement this tool cannot verify as "
            "read-only. Send a plain SELECT."
        )


def _raise_for_sql_access(
    database: Any,
    sql: str,
    catalog: str | None,
    schema: str | None,
) -> None:
    """
    Check the user may read every table the query touches.

    ``force_dataset_match=True`` matches what SQL Lab's own pre-execute
    validator uses: each referenced table must resolve to a registered dataset
    the user has access to, rather than falling through to a broader
    catalog- or schema-level grant.
    """
    from superset import security_manager
    from superset.exceptions import SupersetSecurityException

    try:
        security_manager.raise_for_access(
            database=database,
            sql=sql,
            catalog=catalog,
            schema=schema,
            force_dataset_match=True,
        )
    except SupersetSecurityException as ex:
        # The exception message names the tables that were denied, which is
        # exactly what lets the model pick a different source.
        raise ToolError(str(ex.error.message)) from None


def _row_limit(requested: Any) -> int:
    """
    Clamp the caller's limit to the configured ceiling.

    The model may not raise the cap by asking for more; ``limit`` narrows only.
    """
    # A misconfigured or absent ceiling falls back to the default rather than
    # becoming unbounded: sending a query with no limit is the one outcome this
    # function exists to prevent.
    ceiling = DEFAULT_ROW_LIMIT
    try:
        from flask import current_app

        configured = current_app.config.get("AI_AGENT_MAX_RESULT_ROWS")
        if configured is not None:
            ceiling = int(configured)
    except Exception:  # pylint: disable=broad-except
        ceiling = DEFAULT_ROW_LIMIT
    if ceiling < 1:
        ceiling = DEFAULT_ROW_LIMIT

    if requested is None:
        return min(DEFAULT_ROW_LIMIT, ceiling)
    if not isinstance(requested, int) or isinstance(requested, bool) or requested < 1:
        raise ToolError("'limit' must be a positive integer.")
    return min(requested, ceiling)


def _columns_and_records(
    data: Any,
) -> tuple[list[dict[str, str]], list[dict[str, Any]]]:
    """
    Normalise a statement's result rows.

    ``Database.execute`` returns a ``DataFrame`` when a row limit was supplied
    and a plain list of mappings when one was not, so both shapes are handled
    rather than relying on the caller always producing the first. Assuming the
    frame is how this tool previously raised ``AttributeError`` on a result it
    had asked for perfectly legitimately.
    """
    if hasattr(data, "columns") and hasattr(data, "to_dict"):
        columns = [
            {"name": str(name), "type": str(data[name].dtype)} for name in data.columns
        ]
        return columns, list(data.to_dict(orient="records"))

    records = [dict(row) for row in (data or [])]
    names: list[str] = []
    for record in records:
        for key in record:
            if key not in names:
                names.append(key)
    # Without a frame there are no dtypes to report; the values themselves still
    # carry their types through ``_json_safe``.
    return [{"name": str(name), "type": "unknown"} for name in names], records


def _json_safe(value: Any) -> Any:
    """
    Coerce one warehouse value into something JSON can carry.

    ``Decimal`` becomes a float and binary becomes text (or hex when it is not
    text at all); everything else exotic — dates, intervals, UUIDs, driver
    types — becomes its string form. Lossy by design: the model reads these, it
    does not compute on them.
    """
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (bytes, memoryview)):
        raw = bytes(value)
        try:
            return raw.decode("utf-8")
        except UnicodeDecodeError:
            return raw.hex()
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    return str(value)


def _execute_via_database(
    database: Any,
    sql: str,
    catalog: str | None,
    schema: str | None,
    limit: int,
) -> Any:
    """
    The single point at which a warehouse is touched.

    Isolated as a module-level function so a test can substitute it and exercise
    every guard above without a live connection. ``Database.execute`` is the
    same entry point SQL Lab and the MCP service use, so this inherits Jinja
    rendering, ``SQL_QUERY_MUTATOR``, disallowed-function and disallowed-table
    checks, row-level security, and the executor's own ``allow_dml`` gate.
    """
    from superset_core.queries.types import QueryOptions

    return database.execute(
        sql,
        QueryOptions(catalog=catalog, schema=schema, limit=limit),
    )


def _result_to_payload(result: Any, limit: int) -> dict[str, Any]:
    """
    Flatten a ``QueryResult`` into rows the model can read.

    Only the last data-bearing statement is returned. A read-only script with
    several ``SELECT``s is unusual, and returning every result set multiplies
    the context cost for a case the model can trivially split into two calls.
    """
    from superset_core.queries.types import QueryStatus

    if result.status != QueryStatus.SUCCESS:
        raise ToolError(
            f"The query did not complete: {result.error_message or result.status}"
        )

    statement = next(
        (item for item in reversed(result.statements) if item.data is not None),
        None,
    )
    if statement is None:
        return {
            "rows": [],
            "row_count": 0,
            "columns": [],
            "note": "No rows returned.",
            "executed_sql": None,
        }

    columns, records = _columns_and_records(statement.data)
    rows = [
        {str(key): _json_safe(value) for key, value in record.items()}
        for record in records[:limit]
    ]

    payload: dict[str, Any] = {
        "rows": rows,
        "row_count": len(rows),
        "columns": columns,
        # The SQL the warehouse actually ran, after the limit and any row-level
        # security rewrite. This is what the user needs to see to trust the
        # answer, and what they would paste into SQL Lab to check it.
        "executed_sql": getattr(statement, "executed_sql", None),
    }
    if len(records) > limit:
        payload["truncated"] = True
        payload["note"] = (
            f"Showing {limit} of {len(records)} rows. Add a tighter WHERE clause "
            f"or aggregate to see the rest."
        )
    return payload


def _sql_display(
    database: Any,
    payload: dict[str, Any],
    duration_ms: int,
) -> dict[str, Any]:
    """
    Build the UI summary for one query.

    Deliberately not the model-facing payload: the row sample is smaller, and
    only the connection's name and id appear — never its URI or credentials.
    """
    executed = payload.get("executed_sql") or ""
    return {
        "kind": "sql_result",
        "database_id": database.id,
        "database_name": database.database_name,
        "executed_sql": str(executed)[:DISPLAY_SQL_CHARS],
        "executed_sql_truncated": len(str(executed)) > DISPLAY_SQL_CHARS,
        "columns": [column["name"] for column in payload.get("columns", [])],
        "rows": payload.get("rows", [])[:DISPLAY_SAMPLE_ROWS],
        "row_count": payload.get("row_count", 0),
        "sample_only": len(payload.get("rows", [])) > DISPLAY_SAMPLE_ROWS,
        "truncated": bool(payload.get("truncated", False)),
        "duration_ms": duration_ms,
    }


class ExecuteSqlTool(AITool):
    """Run a read-only query and return its rows."""

    name: ClassVar[str] = "execute_sql"
    description: ClassVar[str] = (
        "Run a read-only SQL query against a Superset database connection and "
        "return the rows. Only SELECT-style statements are accepted; anything "
        "that writes data or changes schema is refused. Results are capped, so "
        "aggregate or filter in SQL rather than asking for everything. Call "
        "list_databases for a database_id and get_schema for table and column "
        "names before writing the query."
    )
    input_schema: ClassVar[dict[str, Any]] = {
        "type": "object",
        "properties": {
            "database_id": {
                "type": "integer",
                "description": "Database connection to query, from list_databases.",
            },
            "sql": {
                "type": "string",
                "description": "A single read-only SQL statement.",
            },
            "schema": {
                "type": "string",
                "description": (
                    "Schema unqualified table names resolve to. Optional; the "
                    "database's default is used when omitted."
                ),
            },
            "catalog": {
                "type": "string",
                "description": "Catalog to query, for engines that have them.",
            },
            "limit": {
                "type": "integer",
                "description": (
                    "Maximum rows to return. Narrows the default only; it "
                    "cannot raise the configured ceiling."
                ),
            },
        },
        "required": ["database_id", "sql"],
    }

    def __init__(
        self,
        executor: Callable[[Any, str, str | None, str | None, int], Any] | None = None,
    ) -> None:
        # Injectable so the guards are testable without a warehouse.
        self._executor = executor or _execute_via_database

    def run(  # pylint: disable=too-many-arguments
        self,
        database_id: Any = None,
        sql: Any = None,
        schema: Any = None,
        catalog: Any = None,
        limit: Any = None,
        **_ignored: Any,
    ) -> ToolOutput:
        _raise_for_sqllab_access()
        database = _database_or_refuse(database_id)
        script = _parse_or_refuse(sql, database)
        _assert_read_only(script, database)

        schema_name = str(schema) if schema else None
        catalog_name = str(catalog) if catalog else None
        _raise_for_sql_access(database, sql, catalog_name, schema_name)

        row_limit = _row_limit(limit)
        started = time.monotonic()
        result = self._executor(database, sql, catalog_name, schema_name, row_limit)
        duration_ms = int((time.monotonic() - started) * 1000)

        payload = _result_to_payload(result, row_limit)
        return ToolOutput.of(
            payload,
            display=_sql_display(database, payload, duration_ms),
        )


class ValidateSqlTool(AITool):
    """Check SQL without running it."""

    name: ClassVar[str] = "validate_sql"
    description: ClassVar[str] = (
        "Check whether a SQL statement parses, whether it is read-only, and "
        "which tables it references — without running it. Use this to check a "
        "query you are unsure about before spending a round trip on "
        "execute_sql, or to discover which tables an existing query reads."
    )
    input_schema: ClassVar[dict[str, Any]] = {
        "type": "object",
        "properties": {
            "database_id": {
                "type": "integer",
                "description": (
                    "Database whose SQL dialect the statement is parsed as."
                ),
            },
            "sql": {"type": "string", "description": "The SQL to check."},
        },
        "required": ["database_id", "sql"],
    }

    def run(
        self,
        database_id: Any = None,
        sql: Any = None,
        **_ignored: Any,
    ) -> ToolOutput:
        database = _database_or_refuse(database_id)

        # Unlike execute_sql, a parse failure here is the answer rather than a
        # refusal — reporting it is the whole point of the tool. The message is
        # the parser's own, which names the line and column.
        from superset.exceptions import SupersetParseError
        from superset.sql.parse import SQLScript

        def invalid(error: str) -> ToolOutput:
            payload = {"valid": False, "read_only": False, "error": error}
            return ToolOutput.of(
                payload,
                display={
                    "kind": "sql_validation",
                    "database_id": database.id,
                    "valid": False,
                    "read_only": False,
                    "error": error,
                },
            )

        try:
            script = SQLScript(sql, database.db_engine_spec.engine)
        except SupersetParseError as ex:
            return invalid(str(ex.error.message))
        except Exception:  # pylint: disable=broad-except
            logger.info("validate_sql could not parse input for db %s", database.id)
            return invalid("The statement could not be parsed.")

        mutating = script.has_mutation()
        tables = sorted(
            {
                str(table)
                for statement in script.statements
                for table in statement.tables
            }
        )
        payload: dict[str, Any] = {
            "valid": True,
            "read_only": not mutating and not script.has_unparseable_statement,
            "statement_count": len(script.statements),
            "tables": tables,
        }
        if mutating:
            payload["error"] = (
                "This statement modifies data or schema, so execute_sql will "
                "refuse it. Rewrite it as a SELECT."
            )
        elif script.has_unparseable_statement:
            payload["error"] = (
                "This statement cannot be verified as read-only, so execute_sql "
                "will refuse it. Send a plain SELECT."
            )
        return ToolOutput.of(
            payload,
            display={
                "kind": "sql_validation",
                "database_id": database.id,
                "valid": True,
                "read_only": payload["read_only"],
                "statement_count": payload["statement_count"],
                "tables": tables,
                "error": payload.get("error"),
            },
        )
