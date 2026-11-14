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
Tests for how the tag enum columns are declared.

The ``tag.type`` and ``tagged_object.object_type`` columns are plain VARCHAR in
the metadata database (see migration ``07f9a902af1b``). Declaring them as native
Postgres ENUMs makes SQLAlchemy 2.0's ``insertmanyvalues`` batch INSERT cast the
bound parameters to a type (``::objecttype`` / ``::tagtype``) that does not
exist in the database, so saving a tag with two or more objects fails.
"""

from typing import Any
from unittest import mock

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from superset.tags.models import ObjectType, Tag, TaggedObject, TagType


def _fake_returning_rows(cursor: Any, row_count: int) -> None:
    """
    Make a mocked DBAPI cursor answer ``INSERT .. RETURNING id``. The id is
    returned twice because batch INSERTs also return it as the sentinel column.
    """
    rows = [(index + 1, index + 1) for index in range(row_count)]
    cursor.description = [
        ("id", 23, None, None, None, None, None),
        ("id__1", 23, None, None, None, None, None),
    ]
    cursor.fetchall.return_value = rows
    cursor.fetchone.side_effect = rows + [None]
    cursor.fetchmany.side_effect = [rows, []]


@pytest.fixture
def postgres_statements() -> Any:
    """
    Yield ``(session, statements, expect_rows)`` for a Postgres-dialect session
    whose statements are recorded instead of being sent to a database.
    ``expect_rows(n)`` declares how many rows the next INSERT will return ids for.
    """
    expected_rows = [0]
    engine: Engine = create_engine(
        "postgresql+psycopg2://user:pass@localhost/db",
        creator=mock.MagicMock,
        _initialize=False,
    )
    statements: list[str] = []

    @event.listens_for(engine, "do_execute", retval=True)
    def _record_execute(
        cursor: Any, statement: str, parameters: Any, context: Any
    ) -> bool:
        statements.append(statement)
        _fake_returning_rows(cursor, expected_rows[0])
        return True

    @event.listens_for(engine, "do_executemany", retval=True)
    def _record_executemany(
        cursor: Any, statement: str, parameters: Any, context: Any
    ) -> bool:
        statements.append(statement)
        _fake_returning_rows(cursor, expected_rows[0])
        return True

    def expect_rows(row_count: int) -> None:
        expected_rows[0] = row_count

    with Session(engine) as session:
        yield session, statements, expect_rows


@pytest.mark.parametrize("count", [1, 2, 3])
def test_tagged_object_batch_insert_does_not_cast_to_native_enum(
    postgres_statements: Any, count: int
) -> None:
    """
    Inserting any number of ``TaggedObject`` rows on Postgres must not cast to
    a native ``objecttype`` type, which is absent from the metadata database.
    """
    session, statements, expect_rows = postgres_statements
    expect_rows(count)
    session.add_all(
        [
            TaggedObject(tag_id=1, object_id=i, object_type=ObjectType.dashboard)
            for i in range(count)
        ]
    )
    session.flush()

    assert statements, "expected an INSERT to be emitted"
    assert not any("::objecttype" in statement.lower() for statement in statements)


@pytest.mark.parametrize("count", [1, 2, 3])
def test_tag_batch_insert_does_not_cast_to_native_enum(
    postgres_statements: Any, count: int
) -> None:
    """
    Inserting any number of ``Tag`` rows on Postgres must not cast to a native
    ``tagtype`` type, which is absent from the metadata database.
    """
    session, statements, expect_rows = postgres_statements
    expect_rows(count)
    session.add_all([Tag(name=f"tag-{i}", type=TagType.custom) for i in range(count)])
    session.flush()

    assert statements, "expected an INSERT to be emitted"
    assert not any("::tagtype" in statement.lower() for statement in statements)
