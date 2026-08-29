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
Tests db_engine_specs.vertica against a real Vertica instance, spun up on
demand via testcontainers. Run via .github/workflows/testcontainers.yml,
on the nightly cron / manual dispatch only (see `nightly_only: true` on
this dialect's matrix entry) -- Vertica Community Edition has a
well-documented ~12GB RAM floor to even start (a license-tier check baked
into the image), well above what a per-PR CI runner should be expected to
provide.

VerticaEngineSpec extends PostgresBaseEngineSpec, and
sqla_vertica_python.vertica_python.VerticaDialect is a direct subclass of
SQLAlchemy's own postgresql.PGDialect with only an index-syntax override
-- no custom DDL or LIMIT/OFFSET compiler, so a bare
Column(..., primary_key=True) table and standard LIMIT/OFFSET pagination
both compile with plain Postgres semantics (Vertica auto-creates a
default superprojection; no explicit projection/segmentation clause is
needed the way ClickHouse needs an ENGINE=).

Not verified locally in this environment: Vertica CE's RAM/image weight
was judged not worth pulling on a resource-constrained local machine per
session guidance -- CI-only verification, matching the nightly_only
gating.
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

from superset.db_engine_specs.vertica import VerticaEngineSpec
from superset.sql.parse import Table
from superset.utils.core import GenericDataType

pytestmark = pytest.mark.testcontainers

from ._driver import require_driver  # noqa: E402

require_driver("testcontainers.core.container")
require_driver("vertica_python")

from testcontainers.core.container import DockerContainer  # noqa: E402
from testcontainers.core.wait_strategies import LogMessageWaitStrategy  # noqa: E402

from ._pagination import (  # noqa: E402
    assert_paginated_query_returns_correct_rows_in_order,
)

PORT = 5433


@pytest.fixture(scope="module")
def engine() -> Iterator[Engine]:
    container = DockerContainer("vertica/vertica-ce")
    container.with_exposed_ports(PORT)
    container.waiting_for(LogMessageWaitStrategy("Vertica is now running"))

    with container:
        host = container.get_container_host_ip()
        port = container.get_exposed_port(PORT)
        yield create_engine(f"vertica+vertica_python://dbadmin@{host}:{port}/VMart")


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
    VerticaEngineSpec.get_columns wraps a real SQLAlchemy Inspector; this
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
    columns = VerticaEngineSpec.get_columns(inspector, Table("pilot_types"))

    by_name = {col["column_name"]: col for col in columns}
    assert set(by_name) == {"id", "amount"}
    for col in by_name.values():
        spec = VerticaEngineSpec.get_column_spec(str(col["type"]))
        assert spec is not None
        assert spec.generic_type == GenericDataType.NUMERIC
        assert isinstance(spec.sqla_type, Integer)
