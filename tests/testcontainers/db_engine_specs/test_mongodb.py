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
# KIND, either express or implied. See the License for the
# specific language governing permissions and limitations
# under the License.
"""
Tests db_engine_specs.mongodb against a real MongoDB instance, spun up on
demand via testcontainers. Run via .github/workflows/testcontainers.yml.

MongoDB is schemaless, and Superset talks to it via `pymongosql`, a
SQL-to-MongoDB translation layer (dialect requires a `?mode=superset` query
param -- not part of testcontainers' own MongoDbContainer.get_connection_url()).
Documents get inserted via the native pymongo driver, not SQL INSERT,
matching how Superset actually encounters MongoDB in practice and avoiding
any assumption about pymongosql's own INSERT/DDL support.
"""

from collections.abc import Iterator

import pytest
from sqlalchemy import (
    Column,
    create_engine,
    inspect,
    Integer,
    MetaData,
    select,
    Table as SATable,
    text,
)
from sqlalchemy.engine import Engine

from superset.db_engine_specs.mongodb import MongoDBEngineSpec
from superset.sql.parse import Table
from superset.utils.core import GenericDataType

pytestmark = pytest.mark.testcontainers

from ._driver import require_driver  # noqa: E402

require_driver("testcontainers.community.mongodb")
require_driver("pymongosql")

from testcontainers.community.mongodb import MongoDbContainer  # noqa: E402

COLLECTION = "pilot_pagination"


@pytest.fixture(scope="module")
def engine() -> Iterator[Engine]:
    with MongoDbContainer("mongo:7.0.7") as container:
        client = container.get_connection_client()
        client[container.dbname][COLLECTION].insert_many([{"id": i} for i in range(10)])
        # MongoDbContainer.get_connection_url() has no database path segment
        # or query string at all (it only builds user:pass@host:port), so
        # naively appending "&mode=superset" glues it straight onto the port
        # number instead of starting a query string. Build the full URL
        # ourselves instead of relying on string concatenation.
        host = container.get_container_host_ip()
        port = container.get_exposed_port(container.port)
        # authSource=admin is required: MongoDbContainer creates its root
        # user via MONGO_INITDB_ROOT_USERNAME, which lives in the `admin`
        # database, not in `dbname` -- without it, auth fails against
        # whatever database is in the URL path.
        yield create_engine(
            f"mongodb://{container.username}:{container.password}@{host}:{port}"
            f"/{container.dbname}?mode=superset&authSource=admin"
        )


def test_paginated_query_returns_correct_rows_in_order(engine: Engine) -> None:
    """
    A plain SQLAlchemy Core LIMIT/OFFSET query, compiled and executed
    against a real instance. Mocked tests cannot catch a dialect compiling
    this incorrectly (see apache/superset#42899, where Trino emitted OFFSET
    before LIMIT) -- only real execution can. Unlike Elasticsearch's SQL
    layer (which has no OFFSET support at all), pymongosql maps OFFSET to
    MongoDB's native `skip`, so this dialect supports it.

    Compiled with `literal_binds=True`, matching how Superset actually
    issues chart/SQL Lab queries (see `models/helpers.py`'s
    `get_query_str_extended`): pymongosql's SQL-to-Mongo AST parser reads
    LIMIT/OFFSET straight off the compiled SQL text ahead of parameter
    substitution, so a bound `LIMIT ?`/`OFFSET ?` placeholder is rejected
    ("invalid literal for int() with base 10: '?'") and the clause is
    silently dropped -- unlike its WHERE-clause parameter handling, which
    does substitute correctly. Literal binds sidestep that and exercise
    the dialect's actual LIMIT/OFFSET compilation, per this test's intent.
    """
    t = SATable(COLLECTION, MetaData(), Column("id", Integer))
    stmt = select(t.c.id).order_by(t.c.id).limit(3).offset(4)
    compiled = stmt.compile(engine, compile_kwargs={"literal_binds": True})
    with engine.connect() as conn:
        rows = conn.execute(text(str(compiled))).fetchall()

    assert [row.id for row in rows] == [4, 5, 6]


def test_get_columns_maps_native_types(engine: Engine) -> None:
    """
    MongoDBEngineSpec.get_columns wraps a real SQLAlchemy Inspector, which
    pymongosql implements by sampling real documents to infer column types
    -- this exercises that against an actual running instance rather than
    a mocked Inspector.
    """
    inspector = inspect(engine)
    columns = MongoDBEngineSpec.get_columns(inspector, Table(COLLECTION))

    by_name = {col["column_name"]: col for col in columns}
    assert "id" in by_name
    spec = MongoDBEngineSpec.get_column_spec(str(by_name["id"]["type"]))
    assert spec is not None
    assert spec.generic_type == GenericDataType.NUMERIC
    assert isinstance(spec.sqla_type, Integer)
