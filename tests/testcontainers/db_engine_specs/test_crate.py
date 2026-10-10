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
Tests db_engine_specs.crate against a real CrateDB instance, spun up on
demand via testcontainers. Run via .github/workflows/testcontainers.yml.

crate/crate only publishes an amd64 image (no arm64 build), and requires a
host CPU supporting the x86-64-v3 instruction set -- QEMU emulation on
Apple Silicon cannot satisfy that, so this file cannot run locally on an
Apple Silicon machine even with `docker pull --platform linux/amd64`. It
runs natively on GitHub Actions' x86_64 runners.
"""

from collections.abc import Iterator
from datetime import datetime

import pytest
from sqlalchemy import (
    Column,
    create_engine,
    inspect,
    Integer,
    MetaData,
    Table as SATable,
)
from sqlalchemy.engine import Connection, Engine

from superset.db_engine_specs.crate import CrateEngineSpec
from superset.sql.parse import Table

pytestmark = pytest.mark.testcontainers

from ._driver import require_driver  # noqa: E402

require_driver("testcontainers.community.cratedb")

from testcontainers.community.cratedb import CrateDBContainer  # noqa: E402

from ._pagination import (  # noqa: E402
    assert_paginated_query_returns_correct_rows_in_order,
)


@pytest.fixture(scope="module")
def engine() -> Iterator[Engine]:
    with CrateDBContainer() as container:
        yield create_engine(container.get_connection_url())


def _refresh_pilot_pagination(conn: Connection) -> None:
    # CrateDB is eventually consistent: a row is not guaranteed visible to
    # subsequent selects immediately after insert.
    conn.exec_driver_sql("REFRESH TABLE pilot_pagination")


def test_paginated_query_returns_correct_rows_in_order(engine: Engine) -> None:
    """
    A plain SQLAlchemy Core LIMIT/OFFSET query, compiled and executed against
    a real instance. Mocked tests cannot catch a dialect compiling this
    incorrectly (see apache/superset#42899, where Trino emitted OFFSET
    before LIMIT) -- only real execution can.
    """
    assert_paginated_query_returns_correct_rows_in_order(
        engine, after_insert=_refresh_pilot_pagination
    )


def test_get_columns_maps_native_types(engine: Engine) -> None:
    """
    CrateEngineSpec.get_columns wraps a real SQLAlchemy Inspector; this
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
    columns = CrateEngineSpec.get_columns(inspector, Table("pilot_types"))

    by_name = {col["column_name"]: col for col in columns}
    assert set(by_name) == {"id", "amount"}
    for col in by_name.values():
        spec = CrateEngineSpec.get_column_spec(str(col["type"]))
        assert spec is not None


def test_fetch_data_decodes_epoch_ms_timestamps(engine: Engine) -> None:
    """
    Regression for apache/superset#44720: crate-python's real DBAPI cursor
    always reports ``type_code=None`` in ``cursor.description`` (confirmed
    by reading ``crate.client.cursor.Cursor.description`` directly -- it
    hardcodes ``None`` for every description slot but the column name), so
    ``CrateEngineSpec.fetch_data`` has to find TIMESTAMP columns via the
    driver's private ``cursor._result["col_types"]`` instead. The existing
    unit tests mock that attribute directly and would never notice if a
    future crate-python release renamed or restructured it; only a real
    cursor, from a real query against a real server, exercises the actual
    attribute this code depends on.

    CrateDB's wire protocol reports both ``TIMESTAMP WITHOUT TIME ZONE`` and
    ``TIMESTAMP WITH TIME ZONE`` as epoch-millisecond integers (type codes
    15 and 11 respectively -- see ``crate.client.converter.DataType``);
    both must decode to the same real ``datetime``.
    """
    with engine.begin() as conn:
        conn.exec_driver_sql(
            "CREATE TABLE pilot_timestamps ("
            "id INTEGER PRIMARY KEY, "
            "ts_no_tz TIMESTAMP WITHOUT TIME ZONE, "
            "ts_with_tz TIMESTAMP WITH TIME ZONE"
            ")"
        )
        conn.exec_driver_sql(
            "INSERT INTO pilot_timestamps (id, ts_no_tz, ts_with_tz) "
            "VALUES (1, 1704067200000, 1704067200000)"
        )
        conn.exec_driver_sql("REFRESH TABLE pilot_timestamps")

    raw_conn = engine.raw_connection()
    try:
        cursor = raw_conn.cursor()
        cursor.execute("SELECT ts_no_tz, ts_with_tz FROM pilot_timestamps WHERE id = 1")
        rows = CrateEngineSpec.fetch_data(cursor)
    finally:
        raw_conn.close()

    assert rows == [(datetime(2024, 1, 1), datetime(2024, 1, 1))]
