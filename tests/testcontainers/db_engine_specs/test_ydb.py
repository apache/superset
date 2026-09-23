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
Tests db_engine_specs.ydb against a real YDB instance, spun up on demand
via testcontainers. Run via .github/workflows/testcontainers.yml.

YDB has no dedicated testcontainers module, so this uses a generic
DockerContainer against the official `ydbplatform/local-ydb` image, which
needs no auth for local/anonymous access -- YDBEngineSpec's own
`sqlalchemy_uri_placeholder` ("ydb://{host}:{port}/{database_name}") has
no username/password at all.
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
)
from sqlalchemy.engine import Engine

from superset.db_engine_specs.ydb import YDBEngineSpec
from superset.sql.parse import Table
from superset.utils.core import GenericDataType

pytestmark = pytest.mark.testcontainers

from ._driver import require_driver  # noqa: E402

require_driver("testcontainers.core.container")
require_driver("ydb_sqlalchemy")

from testcontainers.core.container import DockerContainer  # noqa: E402
from testcontainers.core.wait_strategies import PortWaitStrategy  # noqa: E402

from ._pagination import (  # noqa: E402
    assert_paginated_query_returns_correct_rows_in_order,
)

GRPC_PORT = 2136
DATABASE = "/local"


@pytest.fixture(scope="module")
def engine() -> Iterator[Engine]:
    container = DockerContainer("ydbplatform/local-ydb")
    container.with_exposed_ports(GRPC_PORT)
    # YDB's gRPC client does endpoint discovery: it asks the server for its
    # "real" endpoints and reconnects to whatever comes back, rather than
    # just using the address it was originally given. By default that's
    # the container's own internal Docker hostname (e.g. "6abbb4bb0ab7"),
    # which isn't reachable from the host. Binding the same port number on
    # the host as inside the container, plus advertising "localhost" as
    # the container's own hostname, makes the discovered endpoint
    # ("localhost:2136") actually resolve to something reachable.
    container.with_bind_ports(GRPC_PORT, GRPC_PORT)
    container.with_kwargs(hostname="localhost")
    container.with_env("YDB_USE_IN_MEMORY_PDISKS", "true")
    container.waiting_for(PortWaitStrategy(GRPC_PORT))

    with container:
        host = container.get_container_host_ip()
        port = container.get_exposed_port(GRPC_PORT)
        eng = create_engine(f"yql://{host}:{port}{DATABASE}")

        # The gRPC port opens, and even a bare SELECT succeeds, before YDB's
        # storage pools are fully initialized -- an actual CREATE TABLE can
        # still fail with "database doesn't have storage pools at all to
        # create tablet channels" (confirmed on a real instance). Probe with
        # metadata.create_all()/drop_all() specifically, the same call the
        # real tests below make: a raw `text("CREATE TABLE ...")` hits a
        # separate, unrelated error ("Scheme operations cannot be executed
        # inside transaction") that create_all()'s own DDL execution path
        # doesn't, even with AUTOCOMMIT set on a manually-opened connection.
        probe_metadata = MetaData()
        SATable("pilot_ready", probe_metadata, Column("id", Integer, primary_key=True))
        last_error: Exception | None = None
        for _ in range(30):
            try:
                probe_metadata.create_all(eng)
                probe_metadata.drop_all(eng)
                break
            except Exception as ex:  # noqa: BLE001 -- retry on any not-ready-yet error
                last_error = ex
                time.sleep(2)
        else:
            raise RuntimeError(
                "YDB never became ready to create and use a table"
            ) from last_error

        yield eng


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
    YDBEngineSpec.get_columns wraps a real SQLAlchemy Inspector; this
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
    columns = YDBEngineSpec.get_columns(inspector, Table("pilot_types"))

    by_name = {col["column_name"]: col for col in columns}
    assert set(by_name) == {"id", "amount"}
    for col in by_name.values():
        spec = YDBEngineSpec.get_column_spec(str(col["type"]))
        assert spec is not None
        assert spec.generic_type == GenericDataType.NUMERIC
        assert isinstance(spec.sqla_type, Integer)
