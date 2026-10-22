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
Tests db_engine_specs.clickhouse against a real ClickHouse instance, spun
up on demand via testcontainers. Run via .github/workflows/testcontainers.yml.

Superset's recommended ClickHouse connector is `clickhouse-connect`
(`ClickHouseConnectEngineSpec`, engine "clickhousedb"), which talks HTTP,
not `ClickHouseContainer`'s own documented `clickhouse_driver` (a different,
native-TCP-protocol package Superset doesn't use at all). The container
exposes both the native TCP port (9000) and the HTTP port (8123); this test
connects over the HTTP port to match Superset's actual driver.

Unlike every other dialect in this suite, ClickHouse tables have no real
primary key/constraint concept -- CREATE TABLE requires an explicit engine
(e.g. MergeTree), or clickhouse-connect's DDL compiler raises a CompileError
rather than defaulting to one.

`superset.db_engine_specs.clickhouse` runs module-level setup code (default
type-formatting overrides) that dereferences `current_app.config` whenever
clickhouse-connect is installed, so importing it outside a Flask app context
raises RuntimeError the first time it's imported in a process.
`tests/unit_tests/db_engine_specs/test_clickhouse.py` gets an app context
for free from that suite's autouse fixture; this suite has no such fixture,
so this test pushes one explicitly around just that one-time import, reusing
the real app instance `tests/conftest.py` already builds for the rest of the
test run rather than constructing a second one.
"""

from collections.abc import Iterator
from unittest.mock import MagicMock

import pytest
from sqlalchemy import (
    Column,
    create_engine,
    insert,
    inspect,
    Integer,
    MetaData,
    String,
    Table as SATable,
    text,
)
from sqlalchemy.engine import Engine

from superset.errors import SupersetError
from superset.sql.parse import Table
from superset.utils.core import GenericDataType

pytestmark = pytest.mark.testcontainers

from ._driver import require_driver  # noqa: E402

require_driver("testcontainers.community.clickhouse")
require_driver("clickhouse_connect")

from clickhouse_connect.cc_sqlalchemy.ddl.tableengine import MergeTree  # noqa: E402
from testcontainers.community.clickhouse import ClickHouseContainer  # noqa: E402

from ._pagination import (  # noqa: E402
    assert_paginated_query_returns_correct_rows_in_order,
)

HTTP_PORT = 8123


@pytest.fixture(scope="module")
def engine() -> Iterator[Engine]:
    with ClickHouseContainer("clickhouse/clickhouse-server:latest") as container:
        host = container.get_container_host_ip()
        port = container.get_exposed_port(HTTP_PORT)
        yield create_engine(
            f"clickhousedb://{container.username}:{container.password}"
            f"@{host}:{port}/{container.dbname}"
        )


def test_paginated_query_returns_correct_rows_in_order(engine: Engine) -> None:
    """
    A plain SQLAlchemy Core LIMIT/OFFSET query, compiled and executed against
    a real instance. Mocked tests cannot catch a dialect compiling this
    incorrectly (see apache/superset#42899, where Trino emitted OFFSET
    before LIMIT) -- only real execution can.
    """
    assert_paginated_query_returns_correct_rows_in_order(
        engine, extra_table_args=(MergeTree(order_by="id"),)
    )


def test_get_columns_maps_native_types(engine: Engine) -> None:
    """
    ClickHouseConnectEngineSpec.get_columns wraps a real SQLAlchemy
    Inspector; this exercises that against actual server-reported column
    metadata rather than a mocked Inspector.
    """
    from tests.integration_tests.test_app import app

    with app.app_context():
        from superset.db_engine_specs.clickhouse import ClickHouseConnectEngineSpec

    metadata = MetaData()
    SATable(
        "pilot_types",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("amount", Integer),
        MergeTree(order_by="id"),
    )
    metadata.create_all(engine)

    inspector = inspect(engine)
    columns = ClickHouseConnectEngineSpec.get_columns(inspector, Table("pilot_types"))

    by_name = {col["column_name"]: col for col in columns}
    assert set(by_name) == {"id", "amount"}
    for col in by_name.values():
        spec = ClickHouseConnectEngineSpec.get_column_spec(str(col["type"]))
        assert spec is not None
        assert spec.generic_type == GenericDataType.NUMERIC
        assert isinstance(spec.sqla_type, Integer)


def test_group_by_all_groups_correctly(engine: Engine) -> None:
    """
    ClickHouse's `GROUP BY ALL` shorthand (group by every non-aggregated
    SELECT column) executed for real over clickhouse-connect's HTTP driver,
    the one Superset actually ships (apache/superset#40482 reported it
    failing in SQL Lab, with no error text or repro steps attached).
    Superset's own AST-based query mutation (sqlglot parse + LIMIT
    injection) already round-trips this syntax cleanly -- this covers the
    one layer that can't: the real driver/server actually executing it.
    """
    metadata = MetaData()
    t = SATable(
        "pilot_group_by_all",
        metadata,
        Column("id", Integer, primary_key=True, autoincrement=False),
        Column("category", String(16)),
        Column("amount", Integer),
        MergeTree(order_by="id"),
    )
    metadata.create_all(engine)
    with engine.begin() as conn:
        conn.execute(
            insert(t),
            [
                {"id": 1, "category": "a", "amount": 10},
                {"id": 2, "category": "a", "amount": 5},
                {"id": 3, "category": "b", "amount": 7},
            ],
        )

        rows = conn.execute(
            text(
                "SELECT category, sum(amount) AS total "
                "FROM pilot_group_by_all GROUP BY ALL ORDER BY category"
            )
        ).fetchall()

    assert [tuple(row) for row in rows] == [("a", 15), ("b", 7)]


def _execute_failing_statement(
    engine: Engine, sql: str
) -> tuple[Exception, str, list[SupersetError]]:
    """
    Run ``sql``, expected to fail, the way SQL Lab does: through
    ``ClickHouseConnectEngineSpec.execute_with_cursor`` on a raw DB-API cursor.

    Returns the exception the engine spec raised, the string SQL Lab stores on
    ``Query.error_message`` (``extract_error_message``) and the structured errors
    SQL Lab returns to the UI (``extract_errors``).
    """
    from tests.integration_tests.test_app import app

    with app.app_context():
        from superset.db_engine_specs.clickhouse import ClickHouseConnectEngineSpec

        database = MagicMock()
        database.is_oauth2_enabled.return_value = False
        database.db_engine_spec = ClickHouseConnectEngineSpec
        query = MagicMock(id=1, database=database)

        connection = engine.raw_connection()
        try:
            with pytest.raises(Exception) as excinfo:  # noqa: PT011
                ClickHouseConnectEngineSpec.execute_with_cursor(
                    connection.cursor(), sql, query
                )
        finally:
            connection.close()
        exception = excinfo.value
        return (
            exception,
            ClickHouseConnectEngineSpec.extract_error_message(exception),
            ClickHouseConnectEngineSpec.extract_errors(exception),
        )


@pytest.mark.parametrize(
    ("sql", "expected_fragments"),
    [
        (
            "SELECT * FROM pilot_missing_table",
            ["Code: 60", "(UNKNOWN_TABLE)", "pilot_missing_table"],
        ),
        (
            "SELECT pilot_missing_column FROM system.one",
            ["Code: 47", "(UNKNOWN_IDENTIFIER)", "pilot_missing_column"],
        ),
        (
            "SELEC 1",
            ["Code: 62", "Syntax error", "(SYNTAX_ERROR)"],
        ),
        (
            "SELECT toInt32('not a number')",
            ["Code: 6", "Cannot parse string", "(CANNOT_PARSE_TEXT)"],
        ),
    ],
    ids=["unknown_table", "unknown_column", "syntax_error", "failing_cast"],
)
def test_failed_query_error_carries_server_error_text(
    engine: Engine, sql: str, expected_fragments: list[str]
) -> None:
    """
    A statement the server rejects must surface ClickHouse's own error (code,
    exception name and the offending identifier) through the engine spec, in
    both the legacy ``extract_error_message`` string SQL Lab stores on
    ``Query.error_message`` and the structured ``extract_errors`` result, rather
    than a generic message. Mocked tests only assume the driver's error shape.
    """
    _, legacy_message, errors = _execute_failing_statement(engine, sql)

    assert legacy_message.startswith("clickhousedb error: ")
    assert len(errors) == 1
    for fragment in expected_fragments:
        assert fragment in legacy_message
        assert fragment in errors[0].message
    assert "The ClickHouse server returned an error" not in legacy_message


def test_error_raised_mid_result_stream_carries_server_error_text(
    engine: Engine,
) -> None:
    """
    A runtime error raised by the server after it has already started producing
    result blocks (millions of rows in, with small blocks so earlier blocks are
    sent first) must still report ClickHouse's own error text.

    ``clickhouse-connect`` reads the whole response inside ``cursor.execute``, so
    this surfaces from the execute step; a failure during the later
    ``fetch_data`` step cannot be provoked against a real server, which is why the
    fetch step is covered with a stand-in cursor in
    ``tests/unit_tests/sql_lab_clickhouse_errors_test.py``.
    """
    _, legacy_message, errors = _execute_failing_statement(
        engine,
        "SELECT number, throwIf(number = 3000000, 'pilot late failure') "
        "FROM numbers(5000000) SETTINGS max_block_size = 1000",
    )

    assert "Code: 395" in legacy_message
    assert "pilot late failure" in legacy_message
    assert "(FUNCTION_THROW_IF_VALUE_IS_NON_ZERO)" in legacy_message
    (error,) = errors
    assert "pilot late failure" in error.message


def test_failed_query_error_is_generic_when_show_clickhouse_errors_is_false(
    engine: Engine,
) -> None:
    """
    Characterization, not desired behavior: with ``show_clickhouse_errors=false``
    in the connection URI, ``clickhouse-connect`` withholds the server's error
    text and raises only "The ClickHouse server returned an error". The engine
    spec has nothing more to show, so the generic text is exactly what
    ``extract_error_message`` and ``extract_errors`` report.
    """
    hidden_errors_engine = create_engine(
        engine.url.update_query_dict({"show_clickhouse_errors": "false"})
    )
    try:
        exception, legacy_message, errors = _execute_failing_statement(
            hidden_errors_engine, "SELECT * FROM pilot_missing_table"
        )
    finally:
        hidden_errors_engine.dispose()

    assert str(exception) == "The ClickHouse server returned an error"
    assert legacy_message == (
        "clickhousedb error: The ClickHouse server returned an error"
    )
    (error,) = errors
    assert error.message == "The ClickHouse server returned an error"
    assert "pilot_missing_table" not in error.message
