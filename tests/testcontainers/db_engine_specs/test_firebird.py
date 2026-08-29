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
Tests db_engine_specs.firebird against a real Firebird instance, spun up
on demand via testcontainers. Run via .github/workflows/testcontainers.yml.

Firebird references a database *file* rather than a server-managed named
database -- the connection URI is `firebird://user:pass@host:port/<path>`,
where <path> is the path to a .fdb file on the server. This uses the
well-known `jacobalberty/firebird` image, which creates that file (per
FIREBIRD_DATABASE) under /firebird/data on first boot.

FirebirdEngineSpec sets `limit_method = LimitMethod.FETCH_MANY` with a
comment claiming Firebird "uses FIRST to limit" -- stale relative to the
modern sqlalchemy-firebird driver, which compiles real ROWS-based
pagination (confirmed via an offline dialect compile: `SELECT ... ROWS
4 + 1 TO 4 + 3`, correctly ordered, not a Trino-style bug). That staleness
affects what Superset's own query layer emits, not what this suite's
direct dialect-compilation check exercises.

Could not be verified against a real running instance in this
environment: `firebird-driver` is a pure-Python ctypes wrapper (its wheel
is `py3-none-any`, confirmed by downloading it directly) that dynamically
loads the native Firebird client library (`libfbclient`) from the host at
import time -- it doesn't bundle that library itself. This machine has no
Homebrew formula or straightforward install path for it. The container
itself was confirmed to start and pass its own healthcheck; CI installs
the `libfbclient2` system package separately (see
.github/workflows/testcontainers.yml) for the actual client-library
dependency this driver needs.
"""

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

from superset.db_engine_specs.firebird import FirebirdEngineSpec
from superset.sql.parse import Table
from superset.utils.core import GenericDataType

pytestmark = pytest.mark.testcontainers

from ._driver import require_driver  # noqa: E402

require_driver("testcontainers.core.container")
require_driver("firebird.driver")

from testcontainers.core.container import DockerContainer  # noqa: E402
from testcontainers.core.wait_strategies import HealthcheckWaitStrategy  # noqa: E402

from ._pagination import (  # noqa: E402
    assert_paginated_query_returns_correct_rows_in_order,
)

PORT = 3050
PASSWORD = "masterkey"  # noqa: S105 -- fixed test-fixture password, not a secret
DB_FILE = "test.fdb"


@pytest.fixture(scope="module")
def engine() -> Iterator[Engine]:
    container = DockerContainer("jacobalberty/firebird")
    container.with_exposed_ports(PORT)
    container.with_env("ISC_PASSWORD", PASSWORD)
    container.with_env("FIREBIRD_DATABASE", DB_FILE)
    # The image logs nothing beyond a single startup banner line and never
    # prints a distinct "ready" message -- it ships its own Docker
    # HEALTHCHECK instead, confirmed via `docker ps` reporting (healthy).
    container.waiting_for(HealthcheckWaitStrategy())

    with container:
        host = container.get_container_host_ip()
        port = container.get_exposed_port(PORT)
        yield create_engine(
            f"firebird://sysdba:{PASSWORD}@{host}:{port}//firebird/data/{DB_FILE}"
        )


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
    FirebirdEngineSpec.get_columns wraps a real SQLAlchemy Inspector; this
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
    columns = FirebirdEngineSpec.get_columns(inspector, Table("pilot_types"))

    by_name = {col["column_name"]: col for col in columns}
    assert set(by_name) == {"id", "amount"}
    for col in by_name.values():
        spec = FirebirdEngineSpec.get_column_spec(str(col["type"]))
        assert spec is not None
        assert spec.generic_type == GenericDataType.NUMERIC
        assert isinstance(spec.sqla_type, Integer)
