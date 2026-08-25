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
Shared body for the "paginated query returns correct rows in order" test
that db_engine_specs.{cockroachdb,crate,db2,mssql,oracle,trino}'s
testcontainers suites each run against their own real instance: a plain
SQLAlchemy Core LIMIT/OFFSET query, compiled and executed for real. Mocked
tests cannot catch a dialect compiling this incorrectly (see
apache/superset#42899, where Trino emitted OFFSET before LIMIT) -- only
real execution can.

Each call site keeps its own test function (and dialect-specific docstring)
so failures still report against the right module; this only factors out
the identical table setup/assert body, via an optional post-insert hook for
dialects (CrateDB) that need one.
"""

from collections.abc import Callable

from sqlalchemy import Column, insert, Integer, MetaData, select, Table as SATable
from sqlalchemy.engine import Connection, Engine


def assert_paginated_query_returns_correct_rows_in_order(
    engine: Engine,
    after_insert: Callable[[Connection], None] | None = None,
) -> None:
    metadata = MetaData()
    t = SATable(
        "pilot_pagination",
        metadata,
        Column("id", Integer, primary_key=True),
    )
    metadata.create_all(engine)
    with engine.begin() as conn:
        conn.execute(insert(t), [{"id": i} for i in range(10)])
        if after_insert is not None:
            after_insert(conn)

    with engine.connect() as conn:
        stmt = select(t.c.id).order_by(t.c.id).limit(3).offset(4)
        rows = conn.execute(stmt).fetchall()

    assert [row.id for row in rows] == [4, 5, 6]
