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
Tests db_engine_specs.oceanbase against a real OceanBase instance, spun up
on demand via testcontainers. Run via .github/workflows/testcontainers.yml,
on the nightly cron / manual dispatch only (see `nightly_only: true` on
this dialect's matrix entry) -- OceanBase bootstraps a distributed-style
cluster even in single-node MODE=MINI, a substantially heavier first-boot
than a single-process database, not a good fit for every PR's CI budget.

OceanBaseEngineSpec extends MySQLEngineSpec and its dialect
(oceanbase_py.sqlalchemy.dialect.OceanBaseDialect) extends
MySQLDialect_mysqldb directly with no custom DDL or LIMIT/OFFSET compiler,
so this follows the same mysqlclient-based pattern as MariaDB/MySQL/
StarRocks in this suite -- including the same "localhost" -> "127.0.0.1"
fix MySQLdb needs on native Linux Docker.

Could not be verified locally in this environment: mysqlclient (MySQLdb)
has a pre-existing, unrelated native-library linking issue against this
machine's Homebrew-installed libmysqlclient, and this dialect wasn't
pulled/run locally at all given its heavier resource footprint -- CI-only
verification, matching the nightly_only gating.

oceanbase_py.sqlalchemy.dialect.OceanBaseDialect.has_table() -- called by
both create_all()'s default checkfirst=True and by Inspector.get_columns()
internally -- passes a raw string straight to Connection.execute()
(`connection.execute(f"DESCRIBE {full_name}")`), which SQLAlchemy 2.0
rejects outright (ObjectNotExecutableError, confirmed on real CI). Every
*other* raw-SQL method in the same dialect module correctly uses
`connection.exec_driver_sql(...)` instead -- this looks like an isolated
oversight in just this one method, not a deliberate design choice, so this
test monkeypatches has_table() to do the same thing the rest of the
dialect already does, rather than working around it from the test side.
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
from sqlalchemy.engine import Connection, Engine, URL

from superset.db_engine_specs.oceanbase import OceanBaseEngineSpec
from superset.sql.parse import Table
from superset.utils.core import GenericDataType

pytestmark = pytest.mark.testcontainers

from ._driver import require_driver  # noqa: E402

require_driver("testcontainers.core.container")
require_driver("oceanbase_py")

from oceanbase_py.sqlalchemy.dialect import OceanBaseDialect  # noqa: E402
from testcontainers.core.container import DockerContainer  # noqa: E402
from testcontainers.core.wait_strategies import LogMessageWaitStrategy  # noqa: E402

from ._pagination import (  # noqa: E402
    assert_paginated_query_returns_correct_rows_in_order,
)


def _has_table(
    self: OceanBaseDialect,
    connection: Connection,
    table_name: str,
    schema: str | None = None,
    **kw: object,
) -> bool:
    if schema is None:
        schema = self.default_schema_name
    quote = self.identifier_preparer.quote_identifier
    full_name = quote(table_name)
    if schema:
        full_name = f"{quote(schema)}.{full_name}"
    res = connection.exec_driver_sql(f"DESCRIBE {full_name}")
    return res.first() is not None


OceanBaseDialect.has_table = _has_table

PORT = 2881
PASSWORD = "pilot"  # noqa: S105 -- fixed test-fixture password, not a secret


@pytest.fixture(scope="module")
def engine() -> Iterator[Engine]:
    container = DockerContainer("oceanbase/oceanbase-ce")
    container.with_exposed_ports(PORT)
    container.with_env("MODE", "MINI")
    container.with_env("OB_TENANT_PASSWORD", PASSWORD)
    container.waiting_for(LogMessageWaitStrategy("boot success!"))

    with container:
        host = container.get_container_host_ip()
        if host == "localhost":
            host = "127.0.0.1"
        port = container.get_exposed_port(PORT)
        # OceanBase usernames for a MySQL-mode tenant use "user@tenant"
        # (e.g. "root@test"), a literal "@" that URL.create() percent-encodes
        # correctly -- an f-string would produce a second "@" that breaks
        # the URL's own host/user boundary parsing.
        yield create_engine(
            URL.create(
                "oceanbase",
                username="root@test",
                password=PASSWORD,
                host=host,
                port=int(port),
                database="test",
            )
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
    OceanBaseEngineSpec.get_columns wraps a real SQLAlchemy Inspector; this
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
    columns = OceanBaseEngineSpec.get_columns(inspector, Table("pilot_types"))

    by_name = {col["column_name"]: col for col in columns}
    assert set(by_name) == {"id", "amount"}
    for col in by_name.values():
        spec = OceanBaseEngineSpec.get_column_spec(str(col["type"]))
        assert spec is not None
        assert spec.generic_type == GenericDataType.NUMERIC
        assert isinstance(spec.sqla_type, Integer)
