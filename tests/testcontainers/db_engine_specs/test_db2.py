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
Tests db_engine_specs.db2 against a real IBM Db2 instance, spun up on
demand via testcontainers. Run via .github/workflows/testcontainers.yml.

icr.io/db2_community/db2 only publishes amd64/ppc64le/s390x images (no
arm64 build), so this cannot run locally on an Apple Silicon machine. It
runs natively on GitHub Actions' x86_64 runners. Db2 is also a notably slow
starter (a full instance bring-up, not just a process start) -- expect this
module alone to take several minutes.
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

from superset.db_engine_specs.db2 import Db2EngineSpec
from superset.sql.parse import Table

pytestmark = pytest.mark.testcontainers

from ._driver import require_driver  # noqa: E402

require_driver("testcontainers.community.db2")

from testcontainers.community.db2 import Db2Container  # noqa: E402
from testcontainers.core.wait_strategies import LogMessageWaitStrategy  # noqa: E402

from ._pagination import (  # noqa: E402
    assert_paginated_query_returns_correct_rows_in_order,
)


@pytest.fixture(scope="module")
def engine() -> Iterator[Engine]:
    container = Db2Container()
    # Db2Container._connect waits for this same line, but hardcodes
    # testcontainers' global 120s default (max_tries 120 x sleep_time 1s) and
    # exposes no argument to widen it. A full Db2 instance bring-up varies
    # widely -- nightly sessions for this module measure 88s to 153s -- so
    # 120s has near-zero margin, and has timed out mid-"Creating database
    # testdb" against a container that was still running and progressing.
    # Matching the line here first means _connect finds it already logged.
    # 900s stays well inside the job's 25-minute budget.
    container.waiting_for(
        LogMessageWaitStrategy("Setup has completed").with_startup_timeout(900)
    )

    with container:
        yield create_engine(container.get_connection_url())


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
    Db2EngineSpec.get_columns wraps a real SQLAlchemy Inspector; this
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
    columns = Db2EngineSpec.get_columns(inspector, Table("pilot_types"))

    by_name = {col["column_name"]: col for col in columns}
    assert set(by_name) == {"id", "amount"}
    for col in by_name.values():
        spec = Db2EngineSpec.get_column_spec(str(col["type"]))
        assert spec is not None
