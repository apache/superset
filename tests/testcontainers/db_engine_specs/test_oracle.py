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
Tests db_engine_specs.oracle against a real Oracle instance (gvenzl/oracle-free),
spun up on demand via testcontainers. Run via
.github/workflows/testcontainers.yml.

gvenzl/oracle-free ships with its datafiles pre-baked into the image, so
once the (large-ish, ~1GB) image is pulled, container startup is fast --
under 15s measured locally. Almost all the wall-clock cost here is the
image pull itself, same as any other dialect's container.
"""

import threading
import time
from collections.abc import Iterator
from contextlib import closing
from typing import Any
from unittest import mock
from uuid import uuid4

import pytest
from sqlalchemy import (
    Column,
    create_engine,
    inspect,
    Integer,
    MetaData,
    Table as SATable,
)
from sqlalchemy.engine import Engine

from superset.db_engine_specs.oracle import OracleEngineSpec
from superset.errors import ErrorLevel, SupersetErrorType
from superset.exceptions import SupersetTimeoutException
from superset.models.core import Database
from superset.models.sql_lab import Query
from superset.sql.parse import Table

pytestmark = pytest.mark.testcontainers

from ._driver import require_driver  # noqa: E402

require_driver("testcontainers.community.oracle")

import oracledb  # noqa: E402
from testcontainers.community.oracle import OracleDbContainer  # noqa: E402

from ._pagination import (  # noqa: E402
    assert_paginated_query_returns_correct_rows_in_order,
)


@pytest.fixture(scope="module")
def engine() -> Iterator[Engine]:
    with OracleDbContainer() as container:
        yield create_engine(container.get_connection_url())


@pytest.mark.parametrize("statement", ["SELECT 1 FROM dual", "SELECT dummy FROM dual"])
def test_estimate_statement_cost_returns_estimates_and_cleans_up(
    engine: Engine,
    statement: str,
) -> None:
    """Read real optimizer estimates without deleting an unrelated plan."""
    retained_id = uuid4().hex[:30]
    with (
        closing(engine.raw_connection()) as connection,
        closing(connection.cursor()) as cursor,
    ):
        cursor.execute(
            # The statement ID contains only UUID hex digits.
            f"EXPLAIN PLAN SET STATEMENT_ID = '{retained_id}' FOR SELECT 1 FROM dual"  # noqa: S608
        )
        cursor.execute("SELECT COUNT(*) FROM plan_table")
        row = cursor.fetchone()
        assert row is not None
        initial_count = row[0]

        for _ in range(2):
            result = OracleEngineSpec.estimate_statement_cost(
                Database(), statement, cursor
            )
            assert result["Estimated rows"] == 1
            assert result["Optimizer cost"] is not None
            assert result["Optimizer cost"] >= 0
            if statement == "SELECT dummy FROM dual":
                assert result["Estimated bytes accessed"] > 0
            formatted = OracleEngineSpec.query_cost_formatter([result])[0]
            assert formatted["Estimated rows"] == "1"
            assert "None" not in formatted.values()
            for key, value in result.items():
                if value is None:
                    assert formatted[key] == ""

            cursor.execute("SELECT COUNT(*) FROM plan_table")
            row = cursor.fetchone()
            assert row is not None
            assert row[0] == initial_count
            cursor.execute(
                "SELECT COUNT(*) FROM plan_table WHERE statement_id = :statement_id",
                {"statement_id": retained_id},
            )
            row = cursor.fetchone()
            assert row is not None
            assert row[0] > 0


def test_estimate_query_cost_preserves_columns_for_multiple_statements(
    engine: Engine,
) -> None:
    """A missing first-statement estimate must not hide later estimates."""
    from tests.integration_tests.test_app import app

    with app.app_context():
        database = Database(
            sqlalchemy_uri=engine.url.render_as_string(hide_password=False)
        )
        cost = OracleEngineSpec.query_cost_formatter(
            OracleEngineSpec.estimate_query_cost(
                database,
                catalog=None,
                schema="",
                sql="SELECT 1 FROM dual; SELECT dummy FROM dual",
            )
        )
    assert len(cost) == 2
    assert set(cost[0]) == set(cost[1])
    assert cost[0]["Estimated bytes accessed"] == ""
    assert int(cost[1]["Estimated bytes accessed"]) > 0


@pytest.mark.parametrize("timeout_exception", [False, True])
def test_estimate_statement_cost_injected_failure_rolls_back_plan_rows(
    engine: Engine,
    timeout_exception: bool,
) -> None:
    """Pool return rolls back plan rows after an injected fetch failure.

    This verifies rollback, not interruption of a blocked Oracle call.
    """
    error: Exception = (
        SupersetTimeoutException(
            error_type=SupersetErrorType.BACKEND_TIMEOUT_ERROR,
            message="estimation timed out",
            level=ErrorLevel.ERROR,
        )
        if timeout_exception
        else RuntimeError("plan retrieval failed")
    )
    with (
        closing(engine.raw_connection()) as connection,
        closing(connection.cursor()) as cursor,
    ):
        dbapi_connection = connection.driver_connection
        cursor.execute("SELECT COUNT(*) FROM plan_table")
        row = cursor.fetchone()
        assert row is not None
        initial_count = row[0]

        with (
            mock.patch.object(cursor, "fetchone", side_effect=error),
            pytest.raises(type(error)) as exc,
        ):
            OracleEngineSpec.estimate_statement_cost(
                Database(), "SELECT dummy FROM dual", cursor
            )
        assert exc.value is error

        cursor.execute("SELECT COUNT(*) FROM plan_table")
        row = cursor.fetchone()
        assert row is not None
        assert row[0] > initial_count

    with (
        closing(engine.raw_connection()) as connection,
        closing(connection.cursor()) as cursor,
    ):
        # Reuse the physical session so session-local rows cannot disappear
        # merely because the check runs on a different connection.
        assert connection.driver_connection is dbapi_connection
        cursor.execute("SELECT COUNT(*) FROM plan_table")
        row = cursor.fetchone()
        assert row is not None
        assert row[0] == initial_count


def test_estimate_statement_cost_rejects_invalid_sql(engine: Engine) -> None:
    """Oracle itself rejects malformed SQL and leaves no new plan rows."""
    with (
        closing(engine.raw_connection()) as connection,
        closing(connection.cursor()) as cursor,
    ):
        cursor.execute("SELECT COUNT(*) FROM plan_table")
        row = cursor.fetchone()
        assert row is not None
        initial_count = row[0]
        with pytest.raises(oracledb.DatabaseError, match="ORA-00936"):
            OracleEngineSpec.estimate_statement_cost(
                Database(), "SELECT FROM dual", cursor
            )
        cursor.execute("SELECT COUNT(*) FROM plan_table")
        row = cursor.fetchone()
        assert row is not None
        assert row[0] == initial_count


def test_estimate_statement_cost_does_not_execute_dml(engine: Engine) -> None:
    """Explaining an INSERT must leave the target table empty."""
    with (
        closing(engine.raw_connection()) as connection,
        closing(connection.cursor()) as cursor,
    ):
        cursor.execute("CREATE TABLE cost_estimate_target (id NUMBER)")
        try:
            result = OracleEngineSpec.estimate_statement_cost(
                Database(), "INSERT INTO cost_estimate_target (id) VALUES (1)", cursor
            )
            assert result["Optimizer cost"] is not None
            cursor.execute("SELECT COUNT(*) FROM cost_estimate_target")
            row = cursor.fetchone()
            assert row is not None
            assert row[0] == 0
        finally:
            cursor.execute("DROP TABLE cost_estimate_target")


def test_paginated_query_returns_correct_rows_in_order(engine: Engine) -> None:
    """
    A plain SQLAlchemy Core LIMIT/OFFSET query, compiled and executed against
    a real instance. Mocked tests cannot catch a dialect compiling this
    incorrectly (see apache/superset#42899, where Trino emitted OFFSET
    before LIMIT) -- only real execution can.
    """
    assert_paginated_query_returns_correct_rows_in_order(engine)


def test_get_columns_maps_native_types(engine: Engine) -> None:
    """
    OracleEngineSpec.get_columns wraps a real SQLAlchemy Inspector; this
    exercises that against actual server-reported column metadata rather
    than a mocked Inspector.
    """
    metadata = MetaData()
    SATable(
        "pilot_types",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("amount", Integer),
    )
    metadata.create_all(engine)

    inspector = inspect(engine)
    columns = OracleEngineSpec.get_columns(inspector, Table("pilot_types"))

    by_name = {col["column_name"]: col for col in columns}
    assert set(by_name) == {"id", "amount"}
    for col in by_name.values():
        spec = OracleEngineSpec.get_column_spec(str(col["type"]))
        assert spec is not None


def test_cancel_query_stops_a_running_statement(engine: Engine) -> None:
    """
    apache/superset#44704 added OracleEngineSpec.get_cancel_query_id/
    cancel_query, verified only by hand against a real Oracle instance
    during development (per that PR's own testing notes) -- never pinned
    down as a repeatable test. This exercises the real pair against a real
    session: identify the session about to run a long statement on one
    connection, cancel it from a second connection mid-flight (mirroring
    SQL Lab's own "new cursor to the db of the query" cancel path), and
    confirm the first connection's statement actually fails with ORA-01013
    well before it would complete on its own -- not just that
    ``cancel_query`` returned ``True`` without effect.

    The container's default user is ``system`` (DBA), which holds the
    ``ALTER SYSTEM`` privilege ``cancel_query`` needs; see
    apache/superset#44704's description for the ``False``/ORA-01031 path
    when that privilege is absent, which this does not exercise.
    """
    query_conn = engine.raw_connection()
    cancel_conn = engine.raw_connection()
    thread: threading.Thread | None = None
    try:
        query_cursor = query_conn.cursor()
        # get_cancel_query_id runs on the same cursor that is about to
        # execute the query, before it does -- mirrors SQL Lab's own order.
        cancel_query_id = OracleEngineSpec.get_cancel_query_id(query_cursor, Query())
        assert cancel_query_id is not None

        outcome: dict[str, Any] = {}

        def run_slow_query() -> None:
            try:
                # A tight PL/SQL loop: CPU-bound with O(1) memory, needs no
                # privileges beyond CREATE SESSION, and (measured directly
                # against this same image) ~8s at 500M iterations -- plenty
                # of margin over the cancel, which fires as soon as the
                # session reports ACTIVE. Two things this is NOT, both tried first:
                #   - `CONNECT BY LEVEL <= n`: materializes the whole
                #     hierarchy and hits ORA-30009 "not enough memory" long
                #     before a count this large finishes -- that failure has
                #     nothing to do with cancellation, so the test would pass
                #     for the wrong reason.
                #   - a loop with no loop-carried side effect (`NULL;` as the
                #     body): optimized away entirely regardless of the
                #     iteration count, so the statement returns instantly and
                #     the cancel never has anything to catch. The `cnt`
                #     assignment here is load-bearing, not cosmetic.
                query_cursor.execute(
                    "DECLARE cnt NUMBER := 0; BEGIN "
                    "FOR i IN 1..500000000 LOOP cnt := cnt + 1; END LOOP; "
                    "END;"
                )
                outcome["completed"] = True
            except Exception as ex:  # noqa: BLE001  # pylint: disable=broad-except
                outcome["error"] = ex

        thread = threading.Thread(target=run_slow_query, daemon=True)
        start = time.monotonic()
        thread.start()

        # Wait until the session is actually executing the statement rather
        # than sleeping for a fixed time.
        sid, serial, _instance = cancel_query_id.split(",")
        cancel_cursor = cancel_conn.cursor()
        deadline = time.monotonic() + 30
        while True:
            cancel_cursor.execute(
                "SELECT status FROM v$session "  # noqa: S608
                f"WHERE sid = {int(sid)} AND serial# = {int(serial)}"
            )
            row = cancel_cursor.fetchone()
            if row is not None and row[0] == "ACTIVE":
                break
            assert thread.is_alive(), "the statement ended before it could be cancelled"
            assert time.monotonic() < deadline, "the statement never became ACTIVE"
            time.sleep(0.1)

        cancelled = OracleEngineSpec.cancel_query(
            cancel_cursor, Query(), cancel_query_id
        )
        assert cancelled is True

        thread.join(timeout=60)
        elapsed = time.monotonic() - start

        assert not thread.is_alive(), (
            "cancel_query returned True but the statement is still running"
        )
        assert "error" in outcome, "the statement completed instead of being cancelled"
        assert "ORA-01013" in str(outcome["error"])
        # The cancel took effect promptly, not "eventually" after the slow
        # statement would have finished on its own regardless.
        assert elapsed < 30
    finally:
        # Make sure the worker has finished before closing its connection, even
        # when an assertion above failed; a still-running worker would otherwise
        # race the close or hang pytest at exit.
        if thread is not None and thread.is_alive():
            thread.join(timeout=60)
        query_conn.close()
        cancel_conn.close()
