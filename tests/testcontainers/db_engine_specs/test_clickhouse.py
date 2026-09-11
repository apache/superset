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
