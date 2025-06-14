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
# pylint: disable=redefined-outer-name, import-outside-toplevel, unused-argument

import os
from collections.abc import Iterator
from typing import TYPE_CHECKING

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.engine import create_engine
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm.session import Session

from superset import db
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from tests.unit_tests.conftest import with_feature_flags

if TYPE_CHECKING:
    from superset.models.core import Database


@pytest.fixture
def database1(session: Session) -> Iterator["Database"]:
    from superset.models.core import Database

    engine = db.session.connection().engine
    Database.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(
        database_name="database1",
        sqlalchemy_uri="sqlite:///database1.db",
        allow_dml=True,
    )
    db.session.add(database)
    db.session.commit()

    yield database

    db.session.delete(database)
    db.session.commit()
    os.unlink("database1.db")


@pytest.fixture
def table1(session: Session, database1: "Database") -> Iterator[None]:
    with database1.get_sqla_engine() as engine:
        conn = engine.connect()
        conn.execute("CREATE TABLE table1 (a INTEGER NOT NULL PRIMARY KEY, b INTEGER)")
        conn.execute("INSERT INTO table1 (a, b) VALUES (1, 10), (2, 20)")
        db.session.commit()

        yield

        conn.execute("DROP TABLE table1")
        db.session.commit()


@pytest.fixture
def database2(session: Session) -> Iterator["Database"]:
    from superset.models.core import Database

    database = Database(
        database_name="database2",
        sqlalchemy_uri="sqlite:///database2.db",
        allow_dml=False,
    )
    db.session.add(database)
    db.session.commit()

    yield database

    db.session.delete(database)
    db.session.commit()
    os.unlink("database2.db")


@pytest.fixture
def table2(session: Session, database2: "Database") -> Iterator[None]:
    with database2.get_sqla_engine() as engine:
        conn = engine.connect()
        conn.execute("CREATE TABLE table2 (a INTEGER NOT NULL PRIMARY KEY, b TEXT)")
        conn.execute("INSERT INTO table2 (a, b) VALUES (1, 'ten'), (2, 'twenty')")
        db.session.commit()

        yield

        conn.execute("DROP TABLE table2")
        db.session.commit()


@with_feature_flags(ENABLE_SUPERSET_META_DB=True)
def test_superset(mocker: MockerFixture, app_context: None, table1: None) -> None:
    """
    Simple test querying a table.
    """
    mocker.patch("superset.extensions.metadb.security_manager")

    engine = create_engine("superset://")
    conn = engine.connect()
    results = conn.execute('SELECT * FROM "database1.table1"')
    assert list(results) == [(1, 10), (2, 20)]


@with_feature_flags(ENABLE_SUPERSET_META_DB=True)
def test_superset_limit(mocker: MockerFixture, app_context: None, table1: None) -> None:
    """
    Simple that limit is applied when querying a table.
    """
    mocker.patch(
        "superset.extensions.metadb.current_app.config",
        {
            "DB_SQLA_URI_VALIDATOR": None,
            "SUPERSET_META_DB_LIMIT": 1,
            "DATABASE_OAUTH2_CLIENTS": {},
        },
    )
    mocker.patch("superset.extensions.metadb.security_manager")

    engine = create_engine("superset://")
    conn = engine.connect()
    results = conn.execute('SELECT * FROM "database1.table1"')
    assert list(results) == [(1, 10)]


@with_feature_flags(ENABLE_SUPERSET_META_DB=True)
def test_superset_joins(
    mocker: MockerFixture,
    app_context: None,
    table1: None,
    table2: None,
) -> None:
    """
    A test joining across databases.
    """
    mocker.patch("superset.extensions.metadb.security_manager")

    engine = create_engine("superset://")
    conn = engine.connect()
    results = conn.execute(
        """
        SELECT t1.b, t2.b
        FROM "database1.table1" AS t1
        JOIN "database2.table2" AS t2
        ON t1.a = t2.a
        """
    )
    assert list(results) == [(10, "ten"), (20, "twenty")]


@with_feature_flags(ENABLE_SUPERSET_META_DB=True)
def test_dml(
    mocker: MockerFixture,
    app_context: None,
    table1: None,
    table2: None,
) -> None:
    """
    DML tests.

    Test that we can update/delete data, only if DML is enabled.
    """
    mocker.patch("superset.extensions.metadb.security_manager")

    engine = create_engine("superset://")
    conn = engine.connect()

    conn.execute('INSERT INTO "database1.table1" (a, b) VALUES (3, 30)')
    results = conn.execute('SELECT * FROM "database1.table1"')
    assert list(results) == [(1, 10), (2, 20), (3, 30)]
    conn.execute('UPDATE "database1.table1" SET b=35 WHERE a=3')
    results = conn.execute('SELECT * FROM "database1.table1"')
    assert list(results) == [(1, 10), (2, 20), (3, 35)]
    conn.execute('DELETE FROM "database1.table1" WHERE b>20')
    results = conn.execute('SELECT * FROM "database1.table1"')
    assert list(results) == [(1, 10), (2, 20)]

    with pytest.raises(ProgrammingError) as excinfo:
        conn.execute("""INSERT INTO "database2.table2" (a, b) VALUES (3, 'thirty')""")
    assert str(excinfo.value).strip() == (
        "(shillelagh.exceptions.ProgrammingError) DML not enabled in database "
        '"database2"\n[SQL: INSERT INTO "database2.table2" (a, b) '
        "VALUES (3, 'thirty')]\n(Background on this error at: "
        "https://sqlalche.me/e/14/f405)"
    )


@with_feature_flags(ENABLE_SUPERSET_META_DB=True)
def test_security_manager(
    mocker: MockerFixture, app_context: None, table1: None
) -> None:
    """
    Test that we use the security manager to check for permissions.
    """
    security_manager = mocker.MagicMock()
    mocker.patch(
        "superset.extensions.metadb.security_manager",
        new=security_manager,
    )
    security_manager.raise_for_access.side_effect = SupersetSecurityException(
        SupersetError(
            error_type=SupersetErrorType.TABLE_SECURITY_ACCESS_ERROR,
            message=(
                "You need access to the following tables: `table1`,\n            "
                "`all_database_access` or `all_datasource_access` permission"
            ),
            level=ErrorLevel.ERROR,
        )
    )

    engine = create_engine("superset://")
    conn = engine.connect()
    with pytest.raises(SupersetSecurityException) as excinfo:
        conn.execute('SELECT * FROM "database1.table1"')
    assert str(excinfo.value) == (
        "You need access to the following tables: `table1`,\n            "
        "`all_database_access` or `all_datasource_access` permission"
    )


@with_feature_flags(ENABLE_SUPERSET_META_DB=True)
def test_allowed_dbs(mocker: MockerFixture, app_context: None, table1: None) -> None:
    """
    Test that DBs can be restricted.
    """
    mocker.patch("superset.extensions.metadb.security_manager")

    engine = create_engine("superset://", allowed_dbs=["database1"])
    conn = engine.connect()

    results = conn.execute('SELECT * FROM "database1.table1"')
    assert list(results) == [(1, 10), (2, 20)]

    with pytest.raises(ProgrammingError) as excinfo:
        conn.execute('SELECT * FROM "database2.table2"')
    assert str(excinfo.value) == (
        """
(shillelagh.exceptions.ProgrammingError) Unsupported table: database2.table2
[SQL: SELECT * FROM "database2.table2"]
(Background on this error at: https://sqlalche.me/e/14/f405)
        """.strip()
    )
