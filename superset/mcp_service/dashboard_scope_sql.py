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

"""Apply dashboard filter scope to raw SQL for ``execute_sql``.

Filtered table reads are replaced, in place, by sub-queries — the same AST
rewrite row-level security uses — so the filter lands
on the table read itself rather than on the statement's output, and aggregates
are computed over the filtered rows only. Reads from datasets whose dashboard
charts have no applicable active filters are left unchanged.

Predicates are built from the registered dataset for each table, with the
dataset's own column quoting, value coercion and time-filter rendering, so a
filter means the same thing here as it does on the dataset query path.

The rewrite is deliberately strict. It refuses unless every table read maps to
a registered physical dataset that physically has every filtered column: a
table without the column (a dimension table in a join, or one branch of a
UNION) would otherwise contribute rows the dashboard excludes. It also refuses
anything that can read rows without a table reference the parser can see:
opaque statements, functions it does not model, and table functions.
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from typing import Any, TYPE_CHECKING

from superset.mcp_service.dashboard_scope import (
    dashboard_constraints,
    DashboardConstraints,
    DashboardScope,
    MCPDashboardScopeError,
)

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.models.core import Database
    from superset.sql.parse import SQLScript, SQLStatement, Table

# Jinja markers. Templated SQL is rendered after this rewrite, so its final
# table references and predicates are unknown here; refuse rather than guess.
_TEMPLATE_MARKERS = re.compile(r"{{|{%|{#")

# Builtin scalar functions the SQL parser does not model but that cannot read
# tables: date/time, hashing and JSON-path helpers common in analytical SQL.
# Matched on unqualified calls only, so ``my_schema.now()`` is still refused.
READ_FREE_BUILTINS = frozenset(
    {
        # date and time
        "AGE",
        "CURDATE",
        "CURTIME",
        "FORMAT_DATETIME",
        "MAKE_DATE",
        "MAKE_TIMESTAMP",
        "NOW",
        "PARSE_DATETIME",
        "SYSDATE",
        "TOSTARTOFDAY",
        "TOSTARTOFMONTH",
        "TOSTARTOFQUARTER",
        "TOSTARTOFWEEK",
        "TOSTARTOFYEAR",
        "TOYYYYMM",
        "TOYYYYMMDD",
        "UNIX_TIMESTAMP",
        "UTC_DATE",
        "UTC_TIMESTAMP",
        # hashing and JSON paths
        "HASH",
        "JSONB_EXTRACT_PATH_TEXT",
        "JSON_EXTRACT_PATH_TEXT",
    }
)

_SQL_GUIDANCE = (
    "Query only registered datasets that have the filtered columns, or use "
    "query_dataset; the request must stay within the active dashboard filters."
)


def scope_execute_sql_request(
    request: Any, constraints: DashboardConstraints | DashboardScope
) -> Any:
    """Return ``request`` with its SQL constrained by the dashboard filters."""
    from jinja2.exceptions import TemplateError

    from superset import db, security_manager
    from superset.exceptions import (
        SupersetParseError,
        SupersetSecurityException,
        SupersetTemplateException,
    )
    from superset.models.core import Database

    sql: str = request.sql
    if request.template_params or _TEMPLATE_MARKERS.search(sql):
        raise MCPDashboardScopeError(
            "templated SQL cannot be checked against the dashboard filters "
            "before it is rendered.",
            "Send plain SQL without Jinja templates or template_params.",
        )

    database = db.session.query(Database).filter_by(id=request.database_id).first()
    if database is None:
        # execute_sql reports the missing database itself and runs nothing.
        return request

    # Authorize first, exactly as execute_sql does, so a refusal below never
    # describes tables or datasets the caller is not allowed to query.
    try:
        security_manager.raise_for_access(
            database=database,
            sql=sql,
            catalog=request.catalog,
            schema=request.schema_name,
            template_params={},
            force_dataset_match=True,
        )
    except SupersetSecurityException as ex:
        raise MCPDashboardScopeError(
            f"access to the query was denied: {ex.error.message}."
        ) from ex
    except (SupersetParseError, SupersetTemplateException, TemplateError) as ex:
        raise MCPDashboardScopeError(
            "the SQL could not be parsed, so the dashboard filters cannot be "
            "applied to it.",
            "Check the SQL syntax.",
        ) from ex

    scoped_sql = scope_sql(
        database,
        sql,
        catalog=request.catalog,
        schema=request.schema_name,
        constraints=constraints,
    )
    return request.model_copy(update={"sql": scoped_sql})


def scope_sql(
    database: Database,
    sql: str,
    *,
    catalog: str | None,
    schema: str | None,
    constraints: DashboardConstraints | DashboardScope,
) -> str:
    """Rewrite ``sql`` so every table read is filtered by ``constraints``."""
    from superset.sql.parse import RLSMethod

    _check_template_markers(sql)
    script, catalog, schema = _parse_script(database, sql, catalog, schema)
    method = database.db_engine_spec.get_rls_method()
    if method != RLSMethod.AS_SUBQUERY:
        # The predicate form only attaches to a table read directly under FROM
        # or JOIN, so a parenthesised read would run unfiltered.
        raise MCPDashboardScopeError(
            "this database cannot run the sub-query form the dashboard filters "
            "are applied with.",
            "Use query_dataset or the dashboard's charts instead.",
        )

    for parsed in script.statements:
        statement = _check_statement(parsed)
        tables = {
            table.qualify(catalog=catalog, schema=schema) for table in statement.tables
        }
        if not tables:
            # Reads no table (and no table-reading function, checked above),
            # so there are no rows to filter.
            continue
        predicates = {
            table: _table_predicates(database, statement, table, constraints)
            for table in tables
        }
        if not any(predicates.values()):
            # All reads back dashboard charts that have no active filters.
            continue
        try:
            applied = statement.apply_rls(catalog, schema, predicates, method)
        except Exception as ex:  # noqa: BLE001 - never run SQL the rewrite rejected
            raise MCPDashboardScopeError(
                "the dashboard filters could not be attached to the tables this "
                "SQL reads.",
                _SQL_GUIDANCE,
            ) from ex
        if not applied:
            # Every table had predicates, so nothing being applied means the
            # rewrite could not locate the reads; never run the original.
            raise MCPDashboardScopeError(
                "the dashboard filters could not be attached to the tables "
                "this SQL reads.",
                _SQL_GUIDANCE,
            )
    rewritten = script.format()
    _check_template_markers(rewritten)
    return rewritten


def _check_template_markers(sql: str) -> None:
    """Refuse template syntax that the SQL executor would render after scoping."""
    if _TEMPLATE_MARKERS.search(sql):
        raise MCPDashboardScopeError(
            "template syntax cannot be used in SQL or dashboard filter values.",
            "Use plain filter values and SQL without Jinja templates.",
        )


def _parse_script(
    database: Database, sql: str, catalog: str | None, schema: str | None
) -> tuple[SQLScript, str | None, str]:
    """Parse ``sql`` and resolve the catalog and schema it runs against."""
    from superset.exceptions import SupersetParseError
    from superset.sql.parse import SQLScript

    try:
        script = SQLScript(sql, database.db_engine_spec.engine)
        catalog = catalog or database.get_default_catalog()
        # Same effective schema the SQL executor resolves, so unqualified
        # references match the datasets they run against.
        schema = (
            schema
            or database.resolve_query_default_schema(sql, schema, catalog, {})
            or ""
        )
    except SupersetParseError as ex:
        raise MCPDashboardScopeError(
            "the SQL could not be parsed, so the dashboard filters cannot be "
            "applied to it.",
            "Check the SQL syntax.",
        ) from ex
    except Exception as ex:  # noqa: BLE001 - engine-specific resolution gates
        raise MCPDashboardScopeError(
            f"the query's default schema could not be resolved ({ex}).",
            _SQL_GUIDANCE,
        ) from ex

    if script.has_unparseable_statement:
        # An opaque statement (stored-procedure call, dialect command, SHOW
        # without a target, non-SQL engine) hides which tables it reads, so
        # "no tables found" would wrongly mean "nothing to filter".
        raise MCPDashboardScopeError(
            "the SQL contains a statement whose table reads cannot be "
            "determined, so the dashboard filters cannot be applied to it.",
            _SQL_GUIDANCE,
        )
    return script, catalog, schema


def _check_statement(statement: Any) -> SQLStatement:
    """Refuse statements whose reads cannot all be filtered.

    Functions the parser does not model (``query_to_xml``, ``dblink``,
    ``EXTERNAL_QUERY``, user-defined functions) and table functions or
    dynamically named tables can read tables named in strings, which table
    extraction cannot see and the rewrite cannot filter.
    """
    from superset.sql.parse import SQLStatement

    if not isinstance(statement, SQLStatement):
        raise MCPDashboardScopeError(
            "the dashboard filters can only be applied to SQL statements this "
            "database's SQL parser understands.",
            _SQL_GUIDANCE,
        )
    if statement.is_mutating():
        raise MCPDashboardScopeError(
            "statements that modify data cannot run while dashboard filters apply.",
            _SQL_GUIDANCE,
        )
    if unmodelled := {
        name
        for name in statement.get_unmodelled_functions()
        if name.upper() not in READ_FREE_BUILTINS
    }:
        raise MCPDashboardScopeError(
            "the SQL calls functions whose table reads cannot be checked "
            f"({', '.join(sorted(unmodelled))}).",
            "Rewrite the query with standard SQL functions, or use query_dataset.",
        )
    if statement.has_dynamic_table_source():
        raise MCPDashboardScopeError(
            "the SQL reads from a table function or a dynamically named table, "
            "whose rows the dashboard filters cannot be attached to.",
            _SQL_GUIDANCE,
        )
    return statement


def _table_predicates(
    database: Database,
    statement: SQLStatement,
    table: Table,
    constraints: DashboardConstraints | DashboardScope,
) -> list[Any]:
    datasets = _physical_datasets(database, table)
    if not datasets:
        raise MCPDashboardScopeError(
            f"table {table} is not a registered physical dataset, so the "
            "dashboard filters cannot be mapped to it.",
            _SQL_GUIDANCE,
        )

    if isinstance(constraints, DashboardScope):
        constraints = dashboard_constraints(
            constraints, dataset_ids={dataset.id for dataset in datasets}
        )
    expressions = []
    for clause in constraints.clauses:
        dataset, column = _physical_column(datasets, clause["col"], table)
        expressions.append(
            _parse(statement, database, _filter_clause(dataset, column, clause))
        )
    if constraints.time_range is not None:
        expressions.append(
            _parse(
                statement,
                database,
                _time_clause(datasets, table, constraints),
            )
        )
    return expressions


def _physical_datasets(database: Database, table: Table) -> list[SqlaTable]:
    """Registered physical datasets naming ``table``, matched as RLS matches."""
    from superset.sql.parse import folds_unquoted_object_names
    from superset.utils.rls import find_datasets

    return [
        dataset
        for dataset in find_datasets(
            table,
            database,
            database.get_default_catalog(),
            None,
            fold=folds_unquoted_object_names(database.db_engine_spec.engine),
        )
        if not dataset.sql
    ]


def _physical_column(
    datasets: Iterable[SqlaTable], name: str, table: Table
) -> tuple[SqlaTable, TableColumn]:
    for dataset in datasets:
        for column in dataset.columns:
            if column.column_name == name and not column.expression:
                return dataset, column
    raise MCPDashboardScopeError(
        f"table {table} has no column {name!r} that the dashboard filters, so "
        "rows from it could not be filtered.",
        _SQL_GUIDANCE,
    )


def _filter_clause(
    dataset: SqlaTable, column: TableColumn, clause: dict[str, Any]
) -> Any:
    """Build one filter the way ``get_sqla_query`` builds it for this column.

    Mirrors the dataset query path for the operators the scope supports:
    value coercion by the column's generic type, NULL-aware IN lists, and the
    engine's own comparison and NULL handlers.
    """
    import sqlalchemy as sa

    from superset.utils.core import FilterOperator, GenericDataType

    values = clause["val"] if isinstance(clause["val"], list) else [clause["val"]]
    for value in values:
        if isinstance(value, str):
            _check_template_markers(value)
    op = FilterOperator(clause["op"])
    db_engine_spec = dataset.db_engine_spec
    column_spec = db_engine_spec.get_column_spec(native_type=column.type)
    if column.advanced_data_type or (
        column_spec and column_spec.generic_type == GenericDataType.MULTI_VALUE
    ):
        raise MCPDashboardScopeError(
            f"column {column.column_name!r} has a type whose filters can only "
            "be applied through the dashboard's charts.",
            _SQL_GUIDANCE,
        )
    target_type = column_spec.generic_type if column_spec else GenericDataType.STRING
    sqla_col = dataset.convert_tbl_column_to_sqla_col(column)
    is_list = op in (FilterOperator.IN, FilterOperator.NOT_IN)
    value = dataset.filter_values_handler(
        values=clause["val"],
        operator=op,
        target_generic_type=target_type,
        target_native_type=column.type,
        is_list_target=is_list,
        db_engine_spec=db_engine_spec,
        db_extra=dataset.db_extra,
    )

    if is_list:
        return _in_list_clause(sqla_col, op, value, column.column_name)
    if op in (FilterOperator.IS_NULL, FilterOperator.IS_NOT_NULL):
        return db_engine_spec.handle_null_filter(sqla_col, op)
    if op in (FilterOperator.LIKE, FilterOperator.ILIKE):
        if target_type != GenericDataType.STRING:
            sqla_col = sa.cast(sqla_col, sa.String)
        return (
            sqla_col.like(value) if op == FilterOperator.LIKE else sqla_col.ilike(value)
        )
    if value is None and op not in (FilterOperator.EQUALS, FilterOperator.NOT_EQUALS):
        raise MCPDashboardScopeError(
            f"the dashboard filter on {column.column_name!r} compares against "
            "an empty value.",
            _SQL_GUIDANCE,
        )
    return db_engine_spec.handle_comparison_filter(sqla_col, op, value)


def _in_list_clause(sqla_col: Any, op: Any, value: Any, name: str) -> Any:
    """IN / NOT IN with the dataset path's NULL handling (``IN (x, NULL)``
    matches NULL rows)."""
    import sqlalchemy as sa

    from superset.utils.core import FilterOperator

    values = list(value) if isinstance(value, (list, tuple)) else [value]
    if not values:
        raise MCPDashboardScopeError(
            f"the dashboard filter on {name!r} has an empty value list.",
            _SQL_GUIDANCE,
        )
    non_null = [item for item in values if item is not None]
    if not non_null:
        condition = sqla_col.is_(None)
    elif len(non_null) < len(values):
        condition = sa.or_(sqla_col.is_(None), sqla_col.in_(non_null))
    else:
        condition = sqla_col.in_(non_null)
    return ~condition if op == FilterOperator.NOT_IN else condition


def _time_clause(
    datasets: list[SqlaTable], table: Table, constraints: DashboardConstraints
) -> Any:
    from superset.common.utils.time_range_utils import (
        get_since_until_from_time_range,
    )

    if constraints.time_range is None:
        raise MCPDashboardScopeError(
            "the dashboard time range is missing.",
            _SQL_GUIDANCE,
        )
    _check_template_markers(constraints.time_range)
    name = constraints.time_column
    for dataset in datasets:
        for column in dataset.columns:
            if column.column_name == name and column.is_dttm and not column.expression:
                since, until = get_since_until_from_time_range(
                    time_range=constraints.time_range
                )
                clause = dataset.get_time_filter(
                    time_col=column, start_dttm=since, end_dttm=until
                )
                if clause is None:
                    break
                return clause
    raise MCPDashboardScopeError(
        f"table {table} has no datetime column "
        f"{name!r} to apply the dashboard time range to."
        if name
        else f"table {table} has no resolved time-filter column to apply the dashboard "
        "time range to.",
        _SQL_GUIDANCE,
    )


def _parse(statement: SQLStatement, database: Database, clause: Any) -> Any:
    """Render a SQLAlchemy clause with inline literals and parse it for the AST.

    Literal rendering is the dialect's own, as for RLS predicates, so values
    are quoted by the database's rules rather than by string formatting.
    """
    from sqlalchemy.exc import SQLAlchemyError

    from superset.exceptions import SupersetParseError

    try:
        rendered = str(
            clause.compile(
                dialect=database.get_dialect(),
                compile_kwargs={"literal_binds": True},
            )
        )
        _check_template_markers(rendered)
        return statement.parse_predicate(rendered)
    except (SQLAlchemyError, SupersetParseError, NotImplementedError) as ex:
        raise MCPDashboardScopeError(
            "a dashboard filter value could not be rendered as SQL for this database.",
            _SQL_GUIDANCE,
        ) from ex
