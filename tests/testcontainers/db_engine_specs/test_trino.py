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
Tests db_engine_specs.trino against a real Trino instance, spun up on
demand via testcontainers. Run nightly (see
.github/workflows/nightly-testcontainers.yml), not on every merge. Only
Presto is covered by existing docker-compose-based integration CI; Trino,
despite sharing lineage with Presto, is not.
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

from superset.db_engine_specs.trino import TrinoEngineSpec
from superset.sql.parse import Table
from superset.utils.core import GenericDataType

pytest.importorskip("testcontainers.community.trino")

from testcontainers.community.trino import TrinoContainer  # noqa: E402

from ._pagination import assert_paginated_query_returns_correct_rows_in_order


@pytest.fixture(scope="module")
def engine() -> Iterator[Engine]:
    with TrinoContainer() as container:
        # TrinoContainer.get_connection_url() (testcontainers 4.15.0) returns
        # the container-internal port (e.g. 8080) instead of the Docker-
        # mapped host port, so the URL it builds cannot actually connect.
        # Build it manually with get_exposed_port() instead. Filed upstream:
        # https://github.com/testcontainers/testcontainers-python/issues
        url = (
            f"trino://{container.user}@{container.get_container_host_ip()}"
            f":{container.get_exposed_port(container.port)}/memory/default"
        )
        yield create_engine(url)


def test_paginated_query_returns_correct_rows_in_order(engine: Engine) -> None:
    """
    A plain SQLAlchemy Core LIMIT/OFFSET query, compiled and executed against
    a real instance. This is the exact bug class in apache/superset#42899,
    where Trino emitted OFFSET before LIMIT for paginated queries -- a
    dialect-compiler bug invisible to mocked tests, only catchable by
    actually executing the compiled SQL.
    """
    assert_paginated_query_returns_correct_rows_in_order(engine)


def test_get_columns_maps_native_types(engine: Engine) -> None:
    """
    TrinoEngineSpec.get_columns wraps a real SQLAlchemy Inspector; this
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
    columns = TrinoEngineSpec.get_columns(inspector, Table("pilot_types"))

    by_name = {col["column_name"]: col for col in columns}
    assert set(by_name) == {"id", "amount"}
    for col in by_name.values():
        spec = TrinoEngineSpec.get_column_spec(str(col["type"]))
        assert spec is not None
        assert spec.generic_type == GenericDataType.NUMERIC
        assert isinstance(spec.sqla_type, Integer)
