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

import threading
import time
from collections.abc import Iterator

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


def _processes_count_for(engine: Engine, query_id: str) -> int:
    conn = engine.raw_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT count() FROM system.processes WHERE query_id = %(query_id)s",
        {"query_id": query_id},
    )
    return cursor.fetchone()[0]


def test_cancel_query_actually_stops_the_query_server_side(engine: Engine) -> None:
    """
    SQL Lab's Stop button must make the query actually stop running on the
    ClickHouse server -- not just make Superset give up waiting on it. Drives
    the real `get_cancel_query_id` -> `execute_with_cursor` -> `cancel_query`
    sequence `superset/sql_lab.py` uses, against a real server, with a second,
    independent connection/cursor for the cancellation itself (mirroring
    `superset/sql_lab.py::cancel_query()`'s own `engine.raw_connection()`).
    A regression that merely raises client-side without reaching a real
    `KILL QUERY` on the server would leave the query in `system.processes`
    and this test would catch that even though the client-side call returned.

    Two things this test deliberately gets right that an earlier version of
    it got wrong (caught by review, see RCA.md):

    - `sleep(N)` runs once PER BLOCK, not once per row. `numbers(20)` alone
      fits in a single block under ClickHouse's default `max_block_size`, so
      `SELECT sleep(1) FROM numbers(20)` finishes in ~1s regardless of
      whether cancellation works at all -- a no-op `KILL QUERY` would look
      identical to a real one. `SETTINGS max_block_size=1` forces 20
      separate blocks (and therefore 20 separate ~1s `sleep()` calls),
      guaranteeing the query is still running seconds in, verified
      empirically against a real server.
    - The test confirms the query is ACTUALLY still running (queries
      `system.processes` directly) before cancelling, rather than just
      sleeping an arbitrary amount of time and hoping that's enough.
    """
    from tests.integration_tests.test_app import app

    with app.app_context():
        from superset.db_engine_specs.clickhouse import ClickHouseConnectEngineSpec

    from superset.models.sql_lab import Query

    query = Query()
    query.id = 1

    worker_conn = engine.raw_connection()
    worker_cursor = worker_conn.cursor()

    cancel_query_id = ClickHouseConnectEngineSpec.get_cancel_query_id(
        worker_cursor, query
    )
    assert cancel_query_id is not None
    query.set_extra_json_key("cancel_query", cancel_query_id)

    # Forces 20 separate ~1s `sleep()` calls (one per block), guaranteeing
    # genuine multi-second runtime regardless of ClickHouse's default block
    # sizing -- see the docstring above.
    sql = "SELECT sleep(1) FROM numbers(20) SETTINGS max_block_size=1"
    elapsed_seconds: list[float] = []
    errors: list[BaseException] = []
    start = time.monotonic()

    def run_query() -> None:
        try:
            ClickHouseConnectEngineSpec.execute_with_cursor(worker_cursor, sql, query)
        except Exception as ex:  # pylint: disable=broad-except
            # A genuine mid-flight kill makes clickhouse-connect raise
            # QUERY_WAS_CANCELLED on the worker's own cursor.execute() call
            # -- verified empirically against a real server. This is
            # expected and not itself a failure; the real proof of
            # cancellation is `system.processes` below, not whether this
            # particular call happened to raise.
            errors.append(ex)
        finally:
            elapsed_seconds.append(time.monotonic() - start)

    worker_thread = threading.Thread(target=run_query)
    worker_thread.start()

    # Confirm the query is ACTUALLY still running server-side before
    # cancelling it -- not just "we slept a bit and assumed so". Polls
    # briefly since the query needs a moment to register in
    # system.processes after the thread starts.
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        if _processes_count_for(engine, cancel_query_id) == 1:
            break
        time.sleep(0.2)
    else:
        raise AssertionError(
            "query never appeared in system.processes -- can't prove "
            "cancellation works against a query that was never confirmed "
            "running in the first place"
        )

    cancel_conn = engine.raw_connection()
    cancel_cursor = cancel_conn.cursor()
    assert (
        ClickHouseConnectEngineSpec.cancel_query(cancel_cursor, query, cancel_query_id)
        is True
    )

    worker_thread.join(timeout=25)
    assert not worker_thread.is_alive(), (
        "worker query did not stop after cancel_query() returned True"
    )
    # The real assertion: fewer than the full ~20s elapsed, proving the
    # query was actually killed server-side rather than running to
    # completion while Superset's cancel_query() call merely returned True.
    assert elapsed_seconds[0] < 15

    assert _processes_count_for(engine, cancel_query_id) == 0
