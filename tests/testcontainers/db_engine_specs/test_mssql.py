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
Tests db_engine_specs.mssql against a real SQL Server instance, spun up on
demand via testcontainers. Run via .github/workflows/testcontainers.yml.

mcr.microsoft.com/mssql/server only publishes an amd64 image (SQL Server on
Linux has no ARM build), so this cannot run locally on an Apple Silicon
machine. It runs natively on GitHub Actions' x86_64 runners.
"""

from collections.abc import Iterator

import pytest
from sqlalchemy import (
    Column,
    create_engine,
    insert,
    inspect,
    Integer,
    MetaData,
    select,
    Table as SATable,
)
from sqlalchemy.engine import Engine

from superset.db_engine_specs.mssql import MssqlEngineSpec
from superset.sql.parse import Table

pytest.importorskip("testcontainers.community.mssql")

from testcontainers.community.mssql import SqlServerContainer  # noqa: E402


@pytest.fixture(scope="module")
def engine() -> Iterator[Engine]:
    with SqlServerContainer() as container:
        yield create_engine(container.get_connection_url())


def test_paginated_query_returns_correct_rows_in_order(engine: Engine) -> None:
    """
    A plain SQLAlchemy Core LIMIT/OFFSET query, compiled and executed against
    a real instance. Mocked tests cannot catch a dialect compiling this
    incorrectly (see apache/superset#42899, where Trino emitted OFFSET
    before LIMIT) -- only real execution can.
    """
    metadata = MetaData()
    t = SATable(
        "pilot_pagination",
        metadata,
        Column("id", Integer, primary_key=True),
    )
    metadata.create_all(engine)
    with engine.begin() as conn:
        conn.execute(insert(t), [{"id": i} for i in range(10)])

    with engine.connect() as conn:
        stmt = select(t.c.id).order_by(t.c.id).limit(3).offset(4)
        rows = conn.execute(stmt).fetchall()

    assert [row.id for row in rows] == [4, 5, 6]


def test_get_columns_maps_native_types(engine: Engine) -> None:
    """
    MssqlEngineSpec.get_columns wraps a real SQLAlchemy Inspector; this
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
    columns = MssqlEngineSpec.get_columns(inspector, Table("pilot_types"))

    by_name = {col["column_name"]: col for col in columns}
    assert set(by_name) == {"id", "amount"}
    for col in by_name.values():
        spec = MssqlEngineSpec.get_column_spec(str(col["type"]))
        assert spec is not None
