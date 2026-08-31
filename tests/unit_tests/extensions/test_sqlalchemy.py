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
import re
from collections.abc import Iterator
from typing import TYPE_CHECKING

import pytest
from flask import current_app
from pytest_mock import MockerFixture
from sqlalchemy import text
from sqlalchemy.engine import create_engine
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm.session import Session

from superset import db
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from tests.conftest import with_config
from tests.unit_tests.conftest import with_feature_flags

if TYPE_CHECKING:
    from superset.models.core import Database


def _normalize_sqla_doc_link(message: str) -> str:
    """
    Replace the SQLAlchemy error-doc URL's version segment (e.g. ``/e/20/``)
    with a placeholder so assertions don't need updating every time
    SQLAlchemy bumps its minor version.
    """
    return re.sub(r"/e/\d+/", "/e/XX/", message)


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
    if os.path.exists("database1.db"):
        os.unlink("database1.db")


@pytest.fixture
def table1(session: Session, database1: "Database") -> Iterator[None]:
    with database1.get_sqla_engine() as engine:
        with engine.begin() as conn:
            conn.execute(
                text("CREATE TABLE table1 (a INTEGER NOT NULL PRIMARY KEY, b INTEGER)")
            )
            conn.execute(text("INSERT INTO table1 (a, b) VALUES (1, 10), (2, 20)"))
        db.session.commit()

        yield

        with engine.begin() as conn:
            conn.execute(text("DROP TABLE table1"))
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
    if os.path.exists("database2.db"):
        os.unlink("database2.db")


@pytest.fixture
def table2(session: Session, database2: "Database") -> Iterator[None]:
    with database2.get_sqla_engine() as engine:
        with engine.begin() as conn:
            conn.execute(
                text("CREATE TABLE table2 (a INTEGER NOT NULL PRIMARY KEY, b TEXT)")
            )
            conn.execute(
                text("INSERT INTO table2 (a, b) VALUES (1, 'ten'), (2, 'twenty')")
            )
        db.session.commit()

        yield

        with engine.begin() as conn:
            conn.execute(text("DROP TABLE table2"))
        db.session.commit()


@with_feature_flags(ENABLE_SUPERSET_META_DB=True)
def test_superset(mocker: MockerFixture, app_context: None, table1: None) -> None:
    """
    Simple test querying a table.
    """
    # Mock the security_manager.raise_for_access to allow access
    mocker.patch(
        "superset.extensions.metadb.security_manager.raise_for_access",
        return_value=None,
    )

    # Mock Flask g.user for security checks
    # In Python 3.8+, we can't directly patch flask.g
    # Instead, we need to ensure g.user exists in the context
    from flask import g

    g.user = mocker.MagicMock()
    g.user.is_anonymous = False

    try:
        engine = create_engine("superset://")
    except Exception as e:
        # Skip test if superset:// dialect can't be loaded (common in Docker)
        pytest.skip(f"Superset dialect not available: {e}")

    with engine.connect() as conn:
        results = conn.execute(text('SELECT * FROM "database1.table1"'))
        assert list(results) == [(1, 10), (2, 20)]


@with_config(
    {
        "DB_SQLA_URI_VALIDATOR": None,
        "SUPERSET_META_DB_LIMIT": 1,
        "DATABASE_OAUTH2_CLIENTS": {},
        "SQLALCHEMY_CUSTOM_PASSWORD_STORE": None,
    }
)
@with_feature_flags(ENABLE_SUPERSET_META_DB=True)
def test_superset_limit(mocker: MockerFixture, app_context: None, table1: None) -> None:
    """
    Simple that limit is applied when querying a table.
    """
    # Note: We don't patch flask.current_app.config directly anymore
    # The @with_config decorator handles the config patching

    # Mock the security_manager.raise_for_access to allow access
    mocker.patch(
        "superset.extensions.metadb.security_manager.raise_for_access",
        return_value=None,
    )

    # Mock Flask g.user for security checks
    # In Python 3.8+, we can't directly patch flask.g
    # Instead, we need to ensure g.user exists in the context
    from flask import g

    g.user = mocker.MagicMock()
    g.user.is_anonymous = False

    try:
        engine = create_engine("superset://")
    except Exception as e:
        # Skip test if superset:// dialect can't be loaded (common in Docker)
        pytest.skip(f"Superset dialect not available: {e}")

    with engine.connect() as conn:
        results = conn.execute(text('SELECT * FROM "database1.table1"'))
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
    # Mock the security_manager.raise_for_access to allow access
    mocker.patch(
        "superset.extensions.metadb.security_manager.raise_for_access",
        return_value=None,
    )

    # Mock Flask g.user for security checks
    # In Python 3.8+, we can't directly patch flask.g
    # Instead, we need to ensure g.user exists in the context
    from flask import g

    g.user = mocker.MagicMock()
    g.user.is_anonymous = False

    try:
        engine = create_engine("superset://")
    except Exception as e:
        # Skip test if superset:// dialect can't be loaded (common in Docker)
        pytest.skip(f"Superset dialect not available: {e}")

    with engine.connect() as conn:
        results = conn.execute(
            text("""
            SELECT t1.b, t2.b
            FROM "database1.table1" AS t1
            JOIN "database2.table2" AS t2
            ON t1.a = t2.a
            """)
        )
        assert list(results) == [(10, "ten"), (20, "twenty")]


@pytest.mark.parametrize(
    ("statement", "expected"),
    [
        # A single table reference is not a multi-table statement...
        ('SELECT * FROM "database1.table1"', 1),
        # ...even when it has a dotted, double-quoted column alias, which a
        # naive `"[^"]*\.[^"]*"`-shaped regex would also match, misidentifying
        # a single-table statement as multi-table and silently skipping
        # SUPERSET_META_DB_LIMIT for it.
        (
            'SELECT COUNT(id) AS "metric.value" FROM "database1.table1"',
            1,
        ),
        (
            'SELECT t1.b, t2.b FROM "database1.table1" AS t1 '
            'JOIN "database2.table2" AS t2 ON t1.a = t2.a',
            2,
        ),
        (
            'SELECT * FROM "database1.table1", "database2.table2" WHERE t1.a = t2.a',
            2,
        ),
        # Statements the parser can't handle fall back to the safe default
        # (treat as single-table, so the app-wide limit still applies).
        ("this is not valid sql (((", 1),
    ],
)
def test_count_referenced_tables(statement: str, expected: int) -> None:
    """
    Regression for a review comment on #42598/#36304: the multi-table
    detection used to gate SUPERSET_META_DB_LIMIT must count actual table
    references via the real SQL parser, not pattern-match dotted quoted
    identifiers, which also matches dotted column aliases.
    """
    from superset.extensions.metadb import _count_referenced_tables

    assert _count_referenced_tables(statement) == expected


@pytest.fixture
def table1_large(session: Session, database1: "Database") -> Iterator[None]:
    with database1.get_sqla_engine() as engine:
        with engine.begin() as conn:
            conn.execute(
                text(
                    "CREATE TABLE table1_large (a INTEGER NOT NULL PRIMARY KEY, "
                    "b INTEGER)"
                )
            )
            conn.execute(
                text("INSERT INTO table1_large (a, b) VALUES (1, 10), (2, 20), (3, 30)")
            )
        db.session.commit()

        yield

        with engine.begin() as conn:
            conn.execute(text("DROP TABLE table1_large"))
        db.session.commit()


@pytest.fixture
def table2_late_match(session: Session, database2: "Database") -> Iterator[None]:
    with database2.get_sqla_engine() as engine:
        with engine.begin() as conn:
            conn.execute(
                text(
                    "CREATE TABLE table2_late_match (a INTEGER NOT NULL PRIMARY KEY, "
                    "b TEXT)"
                )
            )
            conn.execute(
                text("INSERT INTO table2_late_match (a, b) VALUES (3, 'thirty')")
            )
        db.session.commit()

        yield

        with engine.begin() as conn:
            conn.execute(text("DROP TABLE table2_late_match"))
        db.session.commit()


@pytest.fixture
def table2_multi_late_match(session: Session, database2: "Database") -> Iterator[None]:
    with database2.get_sqla_engine() as engine:
        with engine.begin() as conn:
            conn.execute(
                text(
                    "CREATE TABLE table2_multi_late_match "
                    "(a INTEGER NOT NULL PRIMARY KEY, b TEXT)"
                )
            )
            conn.execute(
                text(
                    "INSERT INTO table2_multi_late_match (a, b) "
                    "VALUES (2, 'twenty'), (3, 'thirty')"
                )
            )
        db.session.commit()

        yield

        with engine.begin() as conn:
            conn.execute(text("DROP TABLE table2_multi_late_match"))
        db.session.commit()


@pytest.fixture
def table2_fanout_match(session: Session, database2: "Database") -> Iterator[None]:
    with database2.get_sqla_engine() as engine:
        with engine.begin() as conn:
            conn.execute(
                text(
                    "CREATE TABLE table2_fanout_match "
                    "(id INTEGER NOT NULL PRIMARY KEY, a INTEGER, b TEXT)"
                )
            )
            # `a` is deliberately not unique (unlike table2_late_match, where
            # it's the primary key): a single outer row matching on `a=3`
            # fans out into two inner rows here, so reading the match
            # requires pulling more than one row through the cursor per
            # outer probe, instead of a single unique-index lookup.
            conn.execute(
                text(
                    "INSERT INTO table2_fanout_match (a, b) "
                    "VALUES (3, 'thirty-x'), (3, 'thirty-y')"
                )
            )
        db.session.commit()

        yield

        with engine.begin() as conn:
            conn.execute(text("DROP TABLE table2_fanout_match"))
        db.session.commit()


@with_feature_flags(ENABLE_SUPERSET_META_DB=True)
def test_superset_joins_with_limit_drops_fanout_matches(
    mocker: MockerFixture,
    monkeypatch: pytest.MonkeyPatch,
    app_context: None,
    table1_large: None,
    table2_fanout_match: None,
) -> None:
    """
    Coverage note from review of #42598: the other join regression tests
    match on a primary key on both sides, so each inner lookup returns at
    most one row. Here `table1_large`'s single match (a=3) fans out into two
    rows in `table2_fanout_match`, so satisfying it means pulling more than
    one row through the cursor for a single outer probe, rather than a single
    unique-index lookup.
    """
    monkeypatch.setitem(current_app.config, "DB_SQLA_URI_VALIDATOR", None)
    monkeypatch.setitem(current_app.config, "SUPERSET_META_DB_LIMIT", 2)
    monkeypatch.setitem(current_app.config, "DATABASE_OAUTH2_CLIENTS", {})
    monkeypatch.setitem(current_app.config, "SQLALCHEMY_CUSTOM_PASSWORD_STORE", None)

    mocker.patch(
        "superset.extensions.metadb.security_manager.raise_for_access",
        return_value=None,
    )

    from flask import g

    g.user = mocker.MagicMock()
    g.user.is_anonymous = False

    try:
        engine = create_engine("superset://", future=True)
    except Exception as e:
        pytest.skip(f"Superset dialect not available: {e}")

    with engine.connect() as conn:
        results = conn.execute(
            text("""
            SELECT t1.b, t2.b
            FROM "database1.table1_large" AS t1
            JOIN "database2.table2_fanout_match" AS t2
            ON t1.a = t2.a
            ORDER BY t2.b
            """)
        )
        assert list(results) == [(30, "thirty-x"), (30, "thirty-y")]


@with_feature_flags(ENABLE_SUPERSET_META_DB=True)
def test_superset_joins_with_limit_multiple_late_matches(
    mocker: MockerFixture,
    monkeypatch: pytest.MonkeyPatch,
    app_context: None,
    table1_large: None,
    table2_multi_late_match: None,
) -> None:
    """
    Diagnostic probe raised in review of #42598: does the per-table
    ``SUPERSET_META_DB_LIMIT`` skip (keyed on the
    ``_executing_multi_table_query`` ContextVar) hold for every row of a
    multi-row join result, or only the first? ``table1_large`` has two
    genuine matches in ``table2_multi_late_match`` (a=2 and a=3), both of
    which fall past SUPERSET_META_DB_LIMIT=2 in table1_large's own row
    order for a naive per-table truncation.
    """
    monkeypatch.setitem(current_app.config, "DB_SQLA_URI_VALIDATOR", None)
    monkeypatch.setitem(current_app.config, "SUPERSET_META_DB_LIMIT", 2)
    monkeypatch.setitem(current_app.config, "DATABASE_OAUTH2_CLIENTS", {})
    monkeypatch.setitem(current_app.config, "SQLALCHEMY_CUSTOM_PASSWORD_STORE", None)

    mocker.patch(
        "superset.extensions.metadb.security_manager.raise_for_access",
        return_value=None,
    )

    from flask import g

    g.user = mocker.MagicMock()
    g.user.is_anonymous = False

    try:
        engine = create_engine("superset://", future=True)
    except Exception as e:
        pytest.skip(f"Superset dialect not available: {e}")

    with engine.connect() as conn:
        results = conn.execute(
            text("""
            SELECT t1.b, t2.b
            FROM "database1.table1_large" AS t1
            JOIN "database2.table2_multi_late_match" AS t2
            ON t1.a = t2.a
            ORDER BY t1.b
            """)
        )
        assert list(results) == [(20, "twenty"), (30, "thirty")]


@with_feature_flags(ENABLE_SUPERSET_META_DB=True)
def test_superset_joins_with_limit_drops_matches(
    mocker: MockerFixture,
    monkeypatch: pytest.MonkeyPatch,
    app_context: None,
    table1_large: None,
    table2_late_match: None,
) -> None:
    """
    Regression for #36304: SUPERSET_META_DB_LIMIT is applied to each
    underlying table independently, before the in-memory join runs. A row
    that has a genuine match on the other side of the join but falls past
    the per-table limit is silently dropped from the join result, with no
    error or truncation warning.
    """
    # Use monkeypatch (rather than the `@with_config` decorator) so the
    # config overrides are guaranteed to be undone even though this test is
    # expected to fail its assertion until the underlying bug is fixed.
    # `@with_config` only restores the original values after the wrapped
    # test function returns normally, so an assertion failure here would
    # otherwise leak SUPERSET_META_DB_LIMIT=2 into later tests.
    monkeypatch.setitem(current_app.config, "DB_SQLA_URI_VALIDATOR", None)
    monkeypatch.setitem(current_app.config, "SUPERSET_META_DB_LIMIT", 2)
    monkeypatch.setitem(current_app.config, "DATABASE_OAUTH2_CLIENTS", {})
    monkeypatch.setitem(current_app.config, "SQLALCHEMY_CUSTOM_PASSWORD_STORE", None)

    mocker.patch(
        "superset.extensions.metadb.security_manager.raise_for_access",
        return_value=None,
    )

    from flask import g

    g.user = mocker.MagicMock()
    g.user.is_anonymous = False

    try:
        engine = create_engine("superset://", future=True)
    except Exception as e:
        # Skip test if superset:// dialect can't be loaded (common in Docker)
        pytest.skip(f"Superset dialect not available: {e}")

    with engine.connect() as conn:
        results = conn.execute(
            text("""
            SELECT t1.b, t2.b
            FROM "database1.table1_large" AS t1
            JOIN "database2.table2_late_match" AS t2
            ON t1.a = t2.a
            """)
        )
        # table2_late_match's only row (a=3) has a genuine match in
        # table1_large (a=3, b=30), but SUPERSET_META_DB_LIMIT=2 truncates
        # table1_large to its first two rows (a=1, a=2) before the join
        # runs, so the join comes back empty instead of finding the match.
        assert list(results) == [(30, "thirty")]


@with_feature_flags(ENABLE_SUPERSET_META_DB=True)
def test_superset_comma_join_with_limit_drops_matches(
    mocker: MockerFixture,
    monkeypatch: pytest.MonkeyPatch,
    app_context: None,
    table1_large: None,
    table2_late_match: None,
) -> None:
    """
    Regression for #36304: an implicit comma join (``FROM a, b WHERE ...``)
    references two tables just like an explicit ``JOIN``, but doesn't contain
    the literal `JOIN` keyword. Multi-table detection has to catch this shape
    too, or the per-table limit still gets applied and silently drops matches.
    """
    # See test_superset_joins_with_limit_drops_matches for why monkeypatch is
    # used here instead of `@with_config`.
    monkeypatch.setitem(current_app.config, "DB_SQLA_URI_VALIDATOR", None)
    monkeypatch.setitem(current_app.config, "SUPERSET_META_DB_LIMIT", 2)
    monkeypatch.setitem(current_app.config, "DATABASE_OAUTH2_CLIENTS", {})
    monkeypatch.setitem(current_app.config, "SQLALCHEMY_CUSTOM_PASSWORD_STORE", None)

    mocker.patch(
        "superset.extensions.metadb.security_manager.raise_for_access",
        return_value=None,
    )

    from flask import g

    g.user = mocker.MagicMock()
    g.user.is_anonymous = False

    try:
        engine = create_engine("superset://", future=True)
    except Exception as e:
        # Skip test if superset:// dialect can't be loaded (common in Docker)
        pytest.skip(f"Superset dialect not available: {e}")

    with engine.connect() as conn:
        results = conn.execute(
            text("""
            SELECT t1.b, t2.b
            FROM "database1.table1_large" AS t1, "database2.table2_late_match" AS t2
            WHERE t1.a = t2.a
            """)
        )
        # Same scenario as test_superset_joins_with_limit_drops_matches, but
        # using a comma join instead of the `JOIN` keyword.
        assert list(results) == [(30, "thirty")]


@with_feature_flags(ENABLE_SUPERSET_META_DB=True)
def test_superset_joins_via_raw_cursor_drops_matches(
    mocker: MockerFixture,
    monkeypatch: pytest.MonkeyPatch,
    app_context: None,
    table1_large: None,
    table2_late_match: None,
) -> None:
    """
    Regression for #36304: SQL Lab executes statements through a raw DBAPI
    cursor (``engine.raw_connection().cursor()``), not through SQLAlchemy's
    ``Connection.execute()``. That path never reaches
    ``SupersetAPSWDialect.do_execute*``, so a fix keyed only on those hooks
    leaves the per-table ``SUPERSET_META_DB_LIMIT`` skip blind to exactly the
    statements SQL Lab runs, and the same join match SQL Lab users see would
    still be silently dropped even though
    ``test_superset_joins_with_limit_drops_matches`` (which goes through
    ``Connection.execute()``) passes.
    """
    monkeypatch.setitem(current_app.config, "DB_SQLA_URI_VALIDATOR", None)
    monkeypatch.setitem(current_app.config, "SUPERSET_META_DB_LIMIT", 2)
    monkeypatch.setitem(current_app.config, "DATABASE_OAUTH2_CLIENTS", {})
    monkeypatch.setitem(current_app.config, "SQLALCHEMY_CUSTOM_PASSWORD_STORE", None)

    mocker.patch(
        "superset.extensions.metadb.security_manager.raise_for_access",
        return_value=None,
    )

    from flask import g

    g.user = mocker.MagicMock()
    g.user.is_anonymous = False

    try:
        engine = create_engine("superset://", future=True)
    except Exception as e:
        # Skip test if superset:// dialect can't be loaded (common in Docker)
        pytest.skip(f"Superset dialect not available: {e}")

    raw_connection = engine.raw_connection()
    try:
        cursor = raw_connection.cursor()
        cursor.execute(
            """
            SELECT t1.b, t2.b
            FROM "database1.table1_large" AS t1
            JOIN "database2.table2_late_match" AS t2
            ON t1.a = t2.a
            """
        )
        # Same scenario as test_superset_joins_with_limit_drops_matches, but
        # executed the way SQL Lab actually runs queries: a raw DBAPI cursor
        # obtained from `engine.raw_connection()`, bypassing `do_execute*`.
        assert list(cursor) == [(30, "thirty")]
    finally:
        raw_connection.close()


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
    # Mock the security_manager.raise_for_access to allow access
    mocker.patch(
        "superset.extensions.metadb.security_manager.raise_for_access",
        return_value=None,
    )

    # Mock Flask g.user for security checks
    # In Python 3.8+, we can't directly patch flask.g
    # Instead, we need to ensure g.user exists in the context
    from flask import g

    g.user = mocker.MagicMock()
    g.user.is_anonymous = False

    try:
        engine = create_engine("superset://")
    except Exception as e:
        # Skip test if superset:// dialect can't be loaded (common in Docker)
        pytest.skip(f"Superset dialect not available: {e}")

    with engine.begin() as conn:
        conn.execute(text('INSERT INTO "database1.table1" (a, b) VALUES (3, 30)'))
    with engine.connect() as conn:
        results = conn.execute(text('SELECT * FROM "database1.table1"'))
        assert list(results) == [(1, 10), (2, 20), (3, 30)]
    with engine.begin() as conn:
        conn.execute(text('UPDATE "database1.table1" SET b=35 WHERE a=3'))
    with engine.connect() as conn:
        results = conn.execute(text('SELECT * FROM "database1.table1"'))
        assert list(results) == [(1, 10), (2, 20), (3, 35)]
    with engine.begin() as conn:
        conn.execute(text('DELETE FROM "database1.table1" WHERE b>20'))
    with engine.connect() as conn:
        results = conn.execute(text('SELECT * FROM "database1.table1"'))
        assert list(results) == [(1, 10), (2, 20)]

    with engine.begin() as conn:
        with pytest.raises(ProgrammingError) as excinfo:
            conn.execute(
                text("""INSERT INTO "database2.table2" (a, b) VALUES (3, 'thirty')""")
            )
    assert _normalize_sqla_doc_link(str(excinfo.value).strip()) == (
        "(shillelagh.exceptions.ProgrammingError) DML not enabled in database "
        '"database2"\n[SQL: INSERT INTO "database2.table2" (a, b) '
        "VALUES (3, 'thirty')]\n(Background on this error at: "
        "https://sqlalche.me/e/XX/f405)"
    )


@with_feature_flags(ENABLE_SUPERSET_META_DB=True)
def test_security_manager(
    mocker: MockerFixture, app_context: None, table1: None
) -> None:
    """
    Test that we use the security manager to check for permissions.
    """
    # Skip this test if metadb dependencies are not available
    try:
        import superset.extensions.metadb  # noqa: F401
    except ImportError:
        pytest.skip("metadb dependencies not available")

    # Mock Flask g.user first to avoid AttributeError
    # We need to mock the actual g object that's imported by security.manager
    mock_user = mocker.MagicMock()
    mock_user.is_anonymous = False
    mocker.patch("superset.security.manager.g", mocker.MagicMock(user=mock_user))

    # Then patch the security_manager to raise an exception
    security_manager = mocker.MagicMock()
    # Patch it in the metadb module where it's actually used
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

    try:
        engine = create_engine("superset://")
    except Exception as e:
        # Skip test if superset:// dialect can't be loaded (common in Docker)
        pytest.skip(f"Superset dialect not available: {e}")

    with engine.connect() as conn:
        with pytest.raises(SupersetSecurityException) as excinfo:
            conn.execute(text('SELECT * FROM "database1.table1"'))
    assert str(excinfo.value) == (
        "You need access to the following tables: `table1`,\n            "
        "`all_database_access` or `all_datasource_access` permission"
    )


@with_feature_flags(ENABLE_SUPERSET_META_DB=True)
def test_allowed_dbs(mocker: MockerFixture, app_context: None, table1: None) -> None:
    """
    Test that DBs can be restricted.
    """
    # Mock the security_manager.raise_for_access to allow access
    mocker.patch(
        "superset.extensions.metadb.security_manager.raise_for_access",
        return_value=None,
    )

    # Mock Flask g.user for security checks
    # In Python 3.8+, we can't directly patch flask.g
    # Instead, we need to ensure g.user exists in the context
    from flask import g

    g.user = mocker.MagicMock()
    g.user.is_anonymous = False

    try:
        engine = create_engine("superset://", allowed_dbs=["database1"])
    except Exception as e:
        # Skip test if superset:// dialect can't be loaded (common in Docker)
        pytest.skip(f"Superset dialect not available: {e}")

    with engine.connect() as conn:
        results = conn.execute(text('SELECT * FROM "database1.table1"'))
        assert list(results) == [(1, 10), (2, 20)]

    with engine.connect() as conn:
        with pytest.raises(ProgrammingError) as excinfo:
            conn.execute(text('SELECT * FROM "database2.table2"'))
    assert _normalize_sqla_doc_link(str(excinfo.value)) == (
        """
(shillelagh.exceptions.ProgrammingError) Unsupported table: database2.table2
[SQL: SELECT * FROM "database2.table2"]
(Background on this error at: https://sqlalche.me/e/XX/f405)
        """.strip()
    )
