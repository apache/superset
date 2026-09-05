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
Tests db_engine_specs.starrocks against a real StarRocks instance, spun up
on demand via testcontainers. Run via .github/workflows/testcontainers.yml.

StarRocks has no dedicated testcontainers module, so this uses a generic
DockerContainer against the official `starrocks/allin1-ubuntu` image, which
brings up both the FE (query frontend, MySQL wire protocol on port 9030)
and BE (execution backend) in a single container -- a heavier bring-up than
a single-process database. `root` has no password by default and no
database exists yet, so the fixture creates one itself before yielding an
engine pointed at it. The FE's query port accepts connections, and can even
run metadata statements like CREATE DATABASE, before the BE has registered
with it -- an actual CREATE TABLE/INSERT then fails with "Backend node not
found" -- so the fixture retries a real create-table-and-insert probe
against a throwaway table rather than trusting the open port or a bare
CREATE DATABASE as a readiness signal.

Not verified locally in this environment: the `allin1-ubuntu` image is
multiple GB and was skipped here to keep local Docker resource usage low,
per session guidance to lean on CI (which has no such constraint) for
dialects with unusually heavy images.
"""

import time
from collections.abc import Iterator

import pytest
from sqlalchemy import (
    Column,
    create_engine,
    inspect,
    Integer,
    MetaData,
    Table as SATable,
    text,
)
from sqlalchemy.engine import Engine

from superset.db_engine_specs.starrocks import StarRocksEngineSpec
from superset.sql.parse import Table
from superset.utils.core import GenericDataType

pytestmark = pytest.mark.testcontainers

from ._driver import require_driver  # noqa: E402

require_driver("testcontainers.core.container")
require_driver("starrocks")

from testcontainers.core.container import DockerContainer  # noqa: E402
from testcontainers.core.wait_strategies import PortWaitStrategy  # noqa: E402

from ._pagination import (  # noqa: E402
    assert_paginated_query_returns_correct_rows_in_order,
)

QUERY_PORT = 9030
DBNAME = "pilot"


@pytest.fixture(scope="module")
def engine() -> Iterator[Engine]:
    container = DockerContainer("starrocks/allin1-ubuntu")
    container.with_exposed_ports(QUERY_PORT)
    container.waiting_for(PortWaitStrategy(QUERY_PORT))

    with container:
        host = container.get_container_host_ip()
        port = container.get_exposed_port(QUERY_PORT)
        bootstrap_engine = create_engine(
            f"starrocks://root:@{host}:{port}/default_catalog.information_schema"
        )

        # The FE's query port accepts connections, and can even run metadata
        # statements like CREATE DATABASE, before any BE (execution backend)
        # has registered with it -- an actual table create/insert then fails
        # with "Backend node not found". Probe with the real operations the
        # tests below need, in a throwaway table, so readiness is confirmed
        # for what actually matters rather than just the FE's own port.
        last_error: Exception | None = None
        for _ in range(60):
            try:
                with bootstrap_engine.begin() as conn:
                    conn.execute(text(f"CREATE DATABASE IF NOT EXISTS {DBNAME}"))
                probe_engine = create_engine(
                    f"starrocks://root:@{host}:{port}/default_catalog.{DBNAME}"
                )
                with probe_engine.begin() as conn:
                    conn.execute(
                        text("CREATE TABLE IF NOT EXISTS pilot_ready (id INT)")
                    )
                    conn.execute(text("INSERT INTO pilot_ready VALUES (1)"))
                    conn.execute(text("DROP TABLE pilot_ready"))
                break
            except Exception as ex:  # noqa: BLE001 -- retry on any not-ready-yet error
                last_error = ex
                time.sleep(2)
        else:
            raise RuntimeError(
                "StarRocks FE/BE never became ready to create and use a table"
            ) from last_error

        yield create_engine(f"starrocks://root:@{host}:{port}/default_catalog.{DBNAME}")


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
    StarRocksEngineSpec.get_columns wraps a real SQLAlchemy Inspector; this
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
    columns = StarRocksEngineSpec.get_columns(inspector, Table("pilot_types"))

    by_name = {col["column_name"]: col for col in columns}
    assert set(by_name) == {"id", "amount"}
    for col in by_name.values():
        spec = StarRocksEngineSpec.get_column_spec(str(col["type"]))
        assert spec is not None
        assert spec.generic_type == GenericDataType.NUMERIC
        assert isinstance(spec.sqla_type, Integer)
