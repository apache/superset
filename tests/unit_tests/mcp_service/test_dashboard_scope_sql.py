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

"""execute_sql under a dashboard scope: filtered at the table read, or refused.

The rewritten SQL is executed against a real SQLite database, so these tests
check the numbers a scoped query returns, not just the SQL text.
"""

from pathlib import Path
from typing import Any
from unittest.mock import Mock, patch

import pytest
import sqlalchemy as sa
from fastmcp import Client
from fastmcp.exceptions import ToolError
from sqlalchemy.orm.session import Session
from sqlalchemy.pool import StaticPool

from superset.mcp_service.app import mcp
from superset.mcp_service.dashboard_scope import (
    DashboardConstraints,
    DashboardScope,
    MCPDashboardScopeError,
    REFUSAL_PREFIX,
)
from superset.mcp_service.dashboard_scope_sql import (
    scope_execute_sql_request,
    scope_sql,
)
from superset.mcp_service.sql_lab.schemas import ExecuteSqlRequest
from tests.unit_tests.mcp_service.test_dashboard_scope import (
    dashboard,
    encode,
    scope_header,
    scope_payload,
    temporal_form_data,
)

CLIENT_A = {"col": "client", "op": "IN", "val": ["A"]}
ONLY_A = DashboardConstraints((CLIENT_A,), None, None)

ORDERS = [
    ("A", 10, "2024-01-15 00:00:00"),
    ("A", 20, "2024-03-15 00:00:00"),
    ("B", 100, "2024-01-20 00:00:00"),
    ("B", 200, "2024-03-20 00:00:00"),
    (None, 1000, "2024-01-25 00:00:00"),
]
REFUNDS = [("A", 1), ("B", 50)]


@pytest.fixture
def session_engine() -> sa.engine.Engine:
    """Let the tool worker thread use the ``session`` built by this test."""
    return sa.create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )


@pytest.fixture
def warehouse(tmp_path: Path) -> sa.engine.Engine:
    engine = sa.create_engine(f"sqlite:///{tmp_path / 'warehouse.db'}")
    with engine.begin() as conn:
        conn.execute(
            sa.text("CREATE TABLE orders (client TEXT, amount INTEGER, ds DATETIME)")
        )
        conn.execute(sa.text("CREATE TABLE refunds (client TEXT, amount INTEGER)"))
        conn.execute(sa.text("CREATE TABLE regions (region TEXT)"))
        conn.execute(sa.text("CREATE TABLE unregistered (client TEXT)"))
        for client, amount, ds in ORDERS:
            conn.execute(
                sa.text("INSERT INTO orders VALUES (:c, :a, :d)"),
                {"c": client, "a": amount, "d": ds},
            )
        for client, amount in REFUNDS:
            conn.execute(
                sa.text("INSERT INTO refunds VALUES (:c, :a)"),
                {"c": client, "a": amount},
            )
        conn.execute(sa.text("INSERT INTO regions VALUES ('EU')"))
    return engine


@pytest.fixture
def database(session: Session, warehouse: sa.engine.Engine) -> Any:
    """Register the warehouse tables as datasets, the way RLS resolves them."""
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.models.core import Database

    SqlaTable.metadata.create_all(session.get_bind())
    database = Database(
        database_name="scope_warehouse", sqlalchemy_uri=str(warehouse.url)
    )

    def dataset(name: str, columns: list[TableColumn], **kwargs: Any) -> SqlaTable:
        return SqlaTable(
            table_name=name, schema="main", database=database, columns=columns, **kwargs
        )

    session.add_all(
        [
            database,
            dataset(
                "orders",
                [
                    TableColumn(column_name="client", type="TEXT"),
                    TableColumn(column_name="amount", type="INTEGER"),
                    TableColumn(column_name="ds", type="DATETIME", is_dttm=True),
                    TableColumn(
                        column_name="client_upper",
                        type="TEXT",
                        expression="UPPER(client)",
                    ),
                ],
                main_dttm_col="ds",
            ),
            dataset(
                "refunds",
                [
                    TableColumn(column_name="client", type="TEXT"),
                    TableColumn(column_name="amount", type="INTEGER"),
                ],
            ),
            dataset("regions", [TableColumn(column_name="region", type="TEXT")]),
        ]
    )
    session.flush()
    return database


def run(engine: sa.engine.Engine, sql: str) -> list[tuple[Any, ...]]:
    with engine.connect() as conn:
        return [tuple(row) for row in conn.execute(sa.text(sql))]


def scoped(database: Any, sql: str, constraints: DashboardConstraints = ONLY_A) -> str:
    return scope_sql(
        database, sql, catalog=None, schema="main", constraints=constraints
    )


def test_aggregate_is_computed_over_filtered_rows(
    database: Any, warehouse: sa.engine.Engine
) -> None:
    sql = "SELECT SUM(amount) FROM orders"
    assert run(warehouse, sql) == [(1330,)]
    assert run(warehouse, scoped(database, sql)) == [(30,)]


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT SUM(amount) FROM (SELECT * FROM orders) AS t",
        "WITH o AS (SELECT * FROM orders) SELECT SUM(amount) FROM o",
        "SELECT SUM(amount) FROM orders WHERE amount > 0 OR client = 'B'",
        "SELECT SUM(amount) FROM main.orders AS o",
    ],
)
def test_filter_reaches_every_read_shape(
    database: Any, warehouse: sa.engine.Engine, sql: str
) -> None:
    assert run(warehouse, scoped(database, sql)) == [(30,)]


def test_every_table_in_a_union_is_filtered(
    database: Any, warehouse: sa.engine.Engine
) -> None:
    sql = (
        "SELECT SUM(amount) FROM ("
        "SELECT amount FROM orders UNION ALL SELECT -amount FROM refunds) AS t"
    )
    assert run(warehouse, scoped(database, sql)) == [(29,)]


def test_model_where_clause_cannot_undo_the_filter(
    database: Any, warehouse: sa.engine.Engine
) -> None:
    sql = "SELECT SUM(amount) FROM orders WHERE client = 'B' OR 1 = 1"
    assert run(warehouse, scoped(database, sql)) == [(30,)]


def test_values_are_rendered_as_literals(
    database: Any, warehouse: sa.engine.Engine
) -> None:
    hostile = DashboardConstraints(
        ({"col": "client", "op": "IN", "val": ["A') OR ('1'='1"]},), None, None
    )
    assert run(warehouse, scoped(database, "SELECT COUNT(*) FROM orders", hostile)) == [
        (0,)
    ]


@pytest.mark.parametrize(
    "value",
    [
        '{{ "\\x27" }}) OR (1=1) OR (\'\' = {{ "\\x27" }}',
        "{% set value = 'A' %}A",
        "{# filter #}A",
    ],
)
@pytest.mark.parametrize("operator", ["IN", "==", "LIKE"])
def test_template_syntax_in_filter_values_is_refused(
    database: Any, value: str, operator: str
) -> None:
    """Filter literals must not become templates in the SQL executor."""
    constraints = DashboardConstraints(
        (
            {
                "col": "client",
                "op": operator,
                "val": [value] if operator == "IN" else value,
            },
        ),
        None,
        None,
    )
    request = ExecuteSqlRequest(
        database_id=database.id, sql="SELECT SUM(amount) FROM orders"
    )
    with (
        patch("superset.security_manager.raise_for_access"),
        pytest.raises(MCPDashboardScopeError, match="template syntax") as excinfo,
    ):
        scope_execute_sql_request(request, constraints)
    assert str(excinfo.value).startswith(REFUSAL_PREFIX)


def test_template_syntax_in_rendered_predicates_is_refused(database: Any) -> None:
    """Column quoting does not hide template syntax from subsequent rendering."""
    with (
        patch(
            "superset.mcp_service.dashboard_scope_sql._filter_clause",
            return_value=sa.literal_column('"{{ column }}" = 1'),
        ),
        pytest.raises(MCPDashboardScopeError, match="template syntax"),
    ):
        scoped(database, "SELECT SUM(amount) FROM orders")


def test_template_syntax_in_final_sql_is_refused(database: Any) -> None:
    """Check the final formatted statement as well as each predicate."""
    from superset.sql.parse import SQLScript

    with (
        patch.object(SQLScript, "format", return_value="SELECT '{{ value }}'"),
        pytest.raises(MCPDashboardScopeError, match="template syntax"),
    ):
        scoped(database, "SELECT SUM(amount) FROM orders")


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT SUM(amount) FROM orders",
        "SELECT SUM(o.amount) FROM orders o JOIN refunds r ON o.client = r.client",
    ],
)
def test_sql_respects_filters_scoped_away_from_a_dataset(
    database: Any, warehouse: sa.engine.Engine, sql: str
) -> None:
    """Only refunds is filtered; orders retains all clients in its table read."""
    from superset import db
    from superset.connectors.sqla.models import SqlaTable

    datasets = {d.table_name: d.id for d in db.session.query(SqlaTable).all()}
    scope = DashboardScope(7, {11: {"filters": [CLIENT_A]}})
    with dashboard(
        [11, 12], chart_datasets={11: datasets["refunds"], 12: datasets["orders"]}
    ):
        rewritten = scope_sql(
            database, sql, catalog=None, schema="main", constraints=scope
        )
    expected = [(1330,)] if "JOIN" not in sql else [(30,)]
    assert run(warehouse, rewritten) == expected


def test_sql_constraints_are_resolved_per_table(
    database: Any, warehouse: sa.engine.Engine
) -> None:
    """Each dataset gets its own chart filters, not another dataset's values."""
    from superset import db
    from superset.connectors.sqla.models import SqlaTable

    datasets = {d.table_name: d.id for d in db.session.query(SqlaTable).all()}
    scope = DashboardScope(
        7,
        {
            11: {"filters": [CLIENT_A]},
            12: {"filters": [{"col": "client", "op": "IN", "val": ["B"]}]},
        },
    )
    sql = (
        "SELECT SUM(amount) FROM (SELECT amount FROM orders "
        "UNION ALL SELECT amount FROM refunds) t"
    )
    with dashboard(
        [11, 12], chart_datasets={11: datasets["orders"], 12: datasets["refunds"]}
    ):
        rewritten = scope_sql(
            database, sql, catalog=None, schema="main", constraints=scope
        )
    assert run(warehouse, rewritten) == [(80,)]


def test_missing_time_range_is_explicitly_refused(database: Any) -> None:
    """A missing range fails closed even with Python assertions disabled."""
    from superset.mcp_service.dashboard_scope_sql import _time_clause
    from superset.sql.parse import Table

    with pytest.raises(MCPDashboardScopeError, match="time range is missing"):
        _time_clause([], Table("orders"), ONLY_A)


def test_null_aware_in_list_matches_the_dataset_path(
    database: Any, warehouse: sa.engine.Engine
) -> None:
    with_null = DashboardConstraints(
        ({"col": "client", "op": "IN", "val": ["A", None]},), None, None
    )
    assert run(
        warehouse, scoped(database, "SELECT SUM(amount) FROM orders", with_null)
    ) == [(1030,)]


def test_time_range_is_applied_to_the_resolved_datetime_column(
    database: Any, warehouse: sa.engine.Engine
) -> None:
    january = DashboardConstraints(
        (CLIENT_A,), "2024-01-01T00:00:00 : 2024-02-01T00:00:00", "ds"
    )
    assert run(
        warehouse, scoped(database, "SELECT SUM(amount) FROM orders", january)
    ) == [(10,)]


def test_sql_time_window_uses_chart_temporal_column(
    database: Any, warehouse: sa.engine.Engine
) -> None:
    """execute_sql filters the chart's ds, not its dataset's created_at default."""
    from superset import db
    from superset.connectors.sqla.models import SqlaTable, TableColumn

    dataset = db.session.query(SqlaTable).filter_by(table_name="orders").one()
    dataset.columns.append(
        TableColumn(column_name="created_at", type="DATETIME", is_dttm=True)
    )
    dataset.main_dttm_col = "created_at"
    db.session.flush()
    with warehouse.begin() as conn:
        conn.execute(sa.text("ALTER TABLE orders ADD COLUMN created_at DATETIME"))
        conn.execute(sa.text("UPDATE orders SET created_at = '2024-03-01 00:00:00'"))
    scope = DashboardScope(
        7,
        {
            chart_id: {
                "filters": [CLIENT_A],
                "time_range": "2024-01-01T00:00:00 : 2024-02-01T00:00:00",
            }
            for chart_id in (11, 12)
        },
    )
    request = ExecuteSqlRequest(
        database_id=database.id,
        schema_name="main",
        sql="SELECT SUM(amount) FROM orders",
    )
    with (
        dashboard([11, 12], chart_datasets={11: dataset.id, 12: dataset.id}),
        patch("superset.security_manager.raise_for_access"),
    ):
        rewritten = scope_execute_sql_request(request, scope)
    assert run(warehouse, rewritten.sql) == [(10,)]
    assert "created_at" not in rewritten.sql


@pytest.mark.parametrize(
    "chart_form_data",
    [
        {11: temporal_form_data("ds"), 12: temporal_form_data("created_at")},
        {11: temporal_form_data(), 12: temporal_form_data()},
        {11: temporal_form_data("ds"), 12: temporal_form_data()},
        {11: temporal_form_data("ds", "created_at"), 12: temporal_form_data("ds")},
    ],
)
def test_sql_time_window_refuses_ambiguous_chart_targets(
    database: Any, chart_form_data: dict[int, dict[str, Any]]
) -> None:
    """SQL uses the same missing/conflicting-target refusal as dataset tools."""
    from superset import db
    from superset.connectors.sqla.models import SqlaTable

    dataset = db.session.query(SqlaTable).filter_by(table_name="orders").one()
    scope = DashboardScope(
        7, {11: {"time_range": "Last week"}, 12: {"time_range": "Last week"}}
    )
    request = ExecuteSqlRequest(
        database_id=database.id,
        schema_name="main",
        sql="SELECT SUM(amount) FROM orders",
    )
    with (
        dashboard(
            [11, 12],
            chart_datasets={11: dataset.id, 12: dataset.id},
            chart_form_data=chart_form_data,
        ),
        patch("superset.security_manager.raise_for_access"),
        pytest.raises(MCPDashboardScopeError, match="time.*column") as excinfo,
    ):
        scope_execute_sql_request(request, scope)
    assert "No query was run." in str(excinfo.value)


def test_sql_without_dashboard_time_window_needs_no_chart_temporal_target(
    database: Any, warehouse: sa.engine.Engine
) -> None:
    """Row-only scope remains applicable to charts without temporal filters."""
    from superset import db
    from superset.connectors.sqla.models import SqlaTable

    dataset = db.session.query(SqlaTable).filter_by(table_name="orders").one()
    scope = DashboardScope(7, {11: {"filters": [CLIENT_A]}})
    with dashboard(
        [11],
        chart_datasets={11: dataset.id},
        chart_form_data={11: temporal_form_data()},
    ):
        rewritten = scope_sql(
            database,
            "SELECT SUM(amount) FROM orders",
            catalog=None,
            schema="main",
            constraints=scope,
        )
    assert run(warehouse, rewritten) == [(30,)]


def test_statement_without_tables_is_left_alone(
    database: Any, warehouse: sa.engine.Engine
) -> None:
    assert run(warehouse, scoped(database, "SELECT 1")) == [(1,)]


@pytest.mark.parametrize(
    ("sql", "message"),
    [
        (
            "SELECT r.region, SUM(o.amount) FROM orders o CROSS JOIN regions r "
            "GROUP BY 1",
            "has no column 'client'",
        ),
        ("SELECT COUNT(*) FROM unregistered", "not a registered physical dataset"),
        ("INSERT INTO orders VALUES ('A', 1, NULL)", "modify data"),
        ("SELECT FROM WHERE", "could not be parsed"),
        # Opaque statements report no tables; they must not read as "nothing
        # to filter".
        ("CALL refresh_orders()", "cannot be determined"),
        ("EXECUTE IMMEDIATE 'SELECT SUM(amount) FROM orders'", "cannot be determined"),
        # Functions that read tables named in strings are invisible to table
        # extraction, alone or next to a real read.
        ("SELECT query_to_xml('SELECT * FROM orders', true, false, '')", "functions"),
        (
            "SELECT SUM(amount), table_to_xml('orders', true, false, '') FROM orders",
            "functions",
        ),
        ("SELECT * FROM json_each('[1, 2]')", "cannot be checked"),
    ],
)
def test_unmappable_sql_is_refused(database: Any, sql: str, message: str) -> None:
    with pytest.raises(MCPDashboardScopeError, match=message) as excinfo:
        scoped(database, sql)
    assert str(excinfo.value).startswith(REFUSAL_PREFIX)


def test_modelled_functions_do_not_trigger_refusal(
    database: Any, warehouse: sa.engine.Engine
) -> None:
    sql = (
        "SELECT UPPER(client), SUM(amount), COALESCE(MAX(amount), 0) "
        "FROM orders GROUP BY 1"
    )
    assert run(warehouse, scoped(database, sql)) == [("A", 30, 20)]


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT * FROM TABLE('orders')",
        "SELECT * FROM IDENTIFIER('orders')",
    ],
)
def test_dynamically_named_tables_are_refused(sql: str) -> None:
    from superset.mcp_service.dashboard_scope_sql import _check_statement
    from superset.sql.parse import SQLScript

    (statement,) = SQLScript(sql, "snowflake").statements
    with pytest.raises(MCPDashboardScopeError, match="dynamically named table"):
        _check_statement(statement)


@pytest.mark.parametrize(
    ("sql", "engine"),
    [
        (
            "SELECT client, SUM(amount) FROM orders "
            "WHERE ds > NOW() - INTERVAL 30 DAY GROUP BY client",
            "mysql",
        ),
        ("SELECT AGE(ds), SUM(amount) FROM orders GROUP BY 1", "postgresql"),
        ("SELECT toYYYYMM(ds), SUM(amount) FROM orders GROUP BY 1", "clickhouse"),
    ],
)
def test_read_free_builtins_are_allowed(sql: str, engine: str) -> None:
    from superset.mcp_service.dashboard_scope_sql import _check_statement
    from superset.sql.parse import SQLScript

    (statement,) = SQLScript(sql, engine).statements
    assert _check_statement(statement) is statement


def test_qualified_calls_never_match_a_builtin_name() -> None:
    from superset.mcp_service.dashboard_scope_sql import _check_statement
    from superset.sql.parse import SQLScript

    (statement,) = SQLScript("SELECT my_schema.now() FROM orders", "mysql").statements
    with pytest.raises(MCPDashboardScopeError, match="my_schema.now"):
        _check_statement(statement)


def test_predicate_form_engines_are_refused(database: Any) -> None:
    """The predicate form misses parenthesised reads such as ``FROM (orders)``."""
    from superset.sql.parse import RLSMethod

    with (
        patch.object(
            database.db_engine_spec,
            "get_rls_method",
            return_value=RLSMethod.AS_PREDICATE,
        ),
        pytest.raises(MCPDashboardScopeError, match="sub-query form"),
    ):
        scoped(database, "SELECT SUM(amount) FROM (orders)")


def test_rewrite_errors_refuse_instead_of_running_the_original(database: Any) -> None:
    from superset.sql.parse import SQLStatement

    with (
        patch.object(SQLStatement, "apply_rls", side_effect=RuntimeError("boom")),
        pytest.raises(MCPDashboardScopeError, match="could not be attached"),
    ):
        scoped(database, "SELECT SUM(amount) FROM orders")


def test_calculated_columns_cannot_carry_the_filter(database: Any) -> None:
    upper = DashboardConstraints(
        ({"col": "client_upper", "op": "==", "val": "A"},), None, None
    )
    with pytest.raises(MCPDashboardScopeError, match="has no column 'client_upper'"):
        scoped(database, "SELECT COUNT(*) FROM orders", upper)


def test_time_range_without_a_datetime_column_is_refused(database: Any) -> None:
    window = DashboardConstraints((CLIENT_A,), "Last week", "ds")
    with pytest.raises(MCPDashboardScopeError, match="no datetime column"):
        scoped(database, "SELECT COUNT(*) FROM refunds", window)


def test_unresolved_sql_time_column_never_uses_dataset_default(database: Any) -> None:
    with pytest.raises(MCPDashboardScopeError, match="no resolved time-filter column"):
        scoped(
            database,
            "SELECT COUNT(*) FROM orders",
            DashboardConstraints((), "Last week", None),
        )


@pytest.mark.parametrize(
    "request_kwargs",
    [
        {"sql": "SELECT * FROM {{ table }}"},
        {"sql": "SELECT 1 {# note #}"},
        {"sql": "SELECT 1", "template_params": {"x": 1}},
    ],
)
def test_templated_sql_is_refused(
    database: Any, request_kwargs: dict[str, Any]
) -> None:
    request = ExecuteSqlRequest(database_id=database.id, **request_kwargs)
    with pytest.raises(MCPDashboardScopeError, match="templated SQL"):
        scope_execute_sql_request(request, ONLY_A)


def test_access_is_checked_before_describing_tables(database: Any) -> None:
    from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
    from superset.exceptions import SupersetSecurityException

    denied = SupersetSecurityException(
        SupersetError(
            message="You need access to the following tables: orders",
            error_type=SupersetErrorType.TABLE_SECURITY_ACCESS_ERROR,
            level=ErrorLevel.ERROR,
        )
    )
    request = ExecuteSqlRequest(database_id=database.id, sql="SELECT 1 FROM orders")
    with (
        patch("superset.security_manager.raise_for_access", side_effect=denied),
        patch("superset.mcp_service.dashboard_scope_sql.scope_sql") as rewrite,
        pytest.raises(MCPDashboardScopeError, match="access to the query was denied"),
    ):
        scope_execute_sql_request(request, ONLY_A)
    rewrite.assert_not_called()


def test_missing_database_is_left_to_the_tool() -> None:
    request = ExecuteSqlRequest(database_id=999_999, sql="SELECT 1")
    assert scope_execute_sql_request(request, ONLY_A) is request


@pytest.mark.asyncio
async def test_execute_sql_runs_only_the_scoped_statement(
    database: Any, warehouse: sa.engine.Engine
) -> None:
    """End to end: the hook rewrites the SQL before execute_sql authorizes and
    runs it, so the executed statement returns the filtered total."""
    from superset.models.core import Database

    executed: list[str] = []

    def capture(self: Any, sql: str, options: Any) -> Any:
        executed.append(sql)
        raise RuntimeError("stop before execution")

    payload = scope_payload({"11": {"filters": [CLIENT_A]}})
    with (
        scope_header(encode(payload)),
        dashboard([11]),
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=Mock(id=1, username="admin"),
        ),
        patch("superset.security_manager.raise_for_access"),
        patch.object(Database, "execute", autospec=True, side_effect=capture),
    ):
        async with Client(mcp) as client:
            with pytest.raises(ToolError):
                await client.call_tool(
                    "execute_sql",
                    {
                        "request": {
                            "database_id": database.id,
                            "sql": "SELECT SUM(amount) FROM orders",
                            "schema_name": "main",
                        }
                    },
                )
    (sql,) = executed
    assert run(warehouse, sql) == [(30,)]
