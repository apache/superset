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
Tests db_engine_specs.monetdb against a real MonetDB instance, spun up on
demand via testcontainers. Run via .github/workflows/testcontainers.yml.

monetdb/monetdb publishes an amd64-only image, so this needs Rosetta/QEMU
emulation on Apple Silicon -- unlike CrateDB's x86-64-v3 CPU requirement,
this one actually runs fine under emulation (verified locally). No native
testcontainers module exists for MonetDB, so this uses a generic
DockerContainer with the documented MDB_* environment variables and waits
for the daemon's own startup log line.
"""

import re
from collections.abc import Iterator

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

from superset.db_engine_specs.monetdb import MonetDbEngineSpec
from superset.sql.parse import Table

pytestmark = pytest.mark.testcontainers

from ._driver import require_driver  # noqa: E402

require_driver("testcontainers.core.container")
require_driver("sqlalchemy_monetdb")

from testcontainers.core.container import DockerContainer  # noqa: E402
from testcontainers.core.wait_strategies import LogMessageWaitStrategy  # noqa: E402

from ._pagination import (  # noqa: E402
    assert_paginated_query_returns_correct_rows_in_order,
)

PORT = 50000
PASSWORD = "monetdb"  # noqa: S105 -- fixed test-fixture password, not a secret
DBNAME = "test"


@pytest.fixture(scope="module")
def engine() -> Iterator[Engine]:
    container = DockerContainer("monetdb/monetdb:latest")
    container.with_exposed_ports(PORT)
    container.with_env("MDB_DB_ADMIN_PASS", PASSWORD)
    container.with_env("MDB_CREATE_DBS", DBNAME)
    container.waiting_for(LogMessageWaitStrategy(re.compile("Starting MonetDB daemon")))

    with container:
        host = container.get_container_host_ip()
        port = container.get_exposed_port(PORT)
        yield create_engine(f"monetdb://monetdb:{PASSWORD}@{host}:{port}/{DBNAME}")


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
    MonetDbEngineSpec.get_columns wraps a real SQLAlchemy Inspector; this
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
    columns = MonetDbEngineSpec.get_columns(inspector, Table("pilot_types"))

    by_name = {col["column_name"]: col for col in columns}
    assert set(by_name) == {"id", "amount"}
    for col in by_name.values():
        spec = MonetDbEngineSpec.get_column_spec(str(col["type"]))
        assert spec is not None
