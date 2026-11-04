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
RLS and the table denylist for an unqualified table when the query carries no
schema.

On an engine with dynamic-schema support (Postgres, MySQL, Trino, ...) the
per-query schema is whatever the request selected, so a SQL Lab or MCP query
sent without one resolves to no schema at all. The connection still resolves an
unqualified ``sales`` to its default schema (``public`` through the Postgres
``search_path``), so RLS must target that schema too: a dataset registered as
``public.sales`` has to get the same clause whether or not ``public`` was passed,
and a ``DISALLOWED_SQL_TABLES`` entry ``public.sales`` has to block it either way.

These tests run the real RLS lookup: a dataset, a Regular RLS filter assigned to
the user's role subject, and ``SqlaTable.get_sqla_row_level_filters``.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from flask import current_app, g
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session
from superset_core.queries.types import QueryOptions

from superset.models.core import Database
from superset.utils.core import override_user
from tests.unit_tests.conftest import with_feature_flags

CLAUSE = "region = 'east'"
SQL = "SELECT region, amount FROM sales"


# The schemas on the Postgres ``search_path``, in order, without the implicit
# ``pg_catalog`` (``current_schemas(false)``)
SEARCH_PATH = ["public"]


@contextmanager
def _inspector(default_schema: str | None) -> Iterator[Any]:
    """An inspector reporting the connection's default schema."""
    yield MagicMock(default_schema_name=default_schema)


class _Cursor:
    """
    A Postgres cursor answering the search path queries.

    ``current_schemas(true)`` adds the ``pg_catalog`` Postgres searches first when
    the path doesn't place it, and ``current_schemas(false)`` leaves it out.
    ``to_regclass`` resolves a quoted table name to the schema ``tables`` puts it
    in, and to nothing for a table ``tables`` doesn't have.
    """

    def __init__(
        self,
        search_path: list[str],
        tables: dict[str, str],
        error: Exception | None,
    ) -> None:
        self.search_path = search_path
        self.tables = tables
        self.error = error
        self.result: list[tuple[Any, ...]] = []

    def execute(self, sql: str, params: tuple[Any, ...] = ()) -> None:
        if self.error is not None:
            raise self.error
        if "current_schemas" in sql:
            implicit = "current_schemas(true)" in sql
            self.result = [
                (
                    ["pg_catalog"] * (implicit and "pg_catalog" not in self.search_path)
                    + self.search_path,
                )
            ]
        else:
            assert "to_regclass" in sql
            self.result = [
                (spelling, self.tables[spelling[1:-1]])
                for spelling in params[0]
                if spelling[1:-1] in self.tables
            ]

    def fetchone(self) -> tuple[Any, ...] | None:
        return self.result[0] if self.result else None

    def fetchall(self) -> list[tuple[Any, ...]]:
        return self.result


@contextmanager
def _raw_connection(
    search_path: list[str], tables: dict[str, str], error: Exception | None
) -> Iterator[Any]:
    """A connection answering the search path queries (see ``_Cursor``)."""
    connection = MagicMock()
    connection.cursor.return_value = _Cursor(search_path, tables, error)
    yield connection


def _connect(
    mocker: MockerFixture,
    default_schema: str,
    search_path: list[str],
    tables: dict[str, str] | None = None,
    error: Exception | None = None,
) -> None:
    """
    Report the connection's default schema and search path, and resolve each table
    in ``tables`` (by name) to its schema there. ``error`` fails the search path
    queries.
    """
    mocker.patch.object(
        Database, "get_inspector", side_effect=lambda **kw: _inspector(default_schema)
    )
    mocker.patch.object(
        Database,
        "get_raw_connection",
        side_effect=lambda *args, **kw: _raw_connection(
            search_path, tables or {}, error
        ),
    )


@pytest.fixture
def database(session: Session, mocker: MockerFixture) -> Iterator[Database]:
    """
    A Postgres database whose ``public.sales`` dataset has a Regular RLS filter
    assigned to the current user's role.

    The connection's default schema (the Postgres ``search_path``) is ``public``.
    Call ``_connect`` again to change it.
    """
    from flask_appbuilder.security.sqla.models import Role, User

    from superset.connectors.sqla.models import RowLevelSecurityFilter, SqlaTable
    from superset.subjects.models import Subject
    from superset.subjects.types import SubjectType

    SqlaTable.metadata.create_all(session.get_bind())

    database = Database(
        id=1,
        database_name="pg",
        sqlalchemy_uri="postgresql://user:pass@host:5432/analytics",
    )
    dataset = SqlaTable(table_name="sales", schema="public", database=database)
    role = Role(name="east_sales")
    user = User(
        first_name="test",
        last_name="user",
        username="analyst",
        email="analyst@example.org",
        roles=[role],
    )
    subject = Subject(label="east_sales", type=SubjectType.ROLE, role=role)
    rls_filter = RowLevelSecurityFilter(
        name="east only",
        filter_type="Regular",
        clause=CLAUSE,
        tables=[dataset],
        subjects=[subject],
    )
    session.add_all([database, dataset, role, user, subject, rls_filter])
    session.flush()

    mocker.patch(
        "superset.subjects.utils.get_current_user_subject_ids",
        return_value=[subject.id],
    )
    _connect(mocker, "public", SEARCH_PATH, {"sales": "public"})
    with override_user(user):
        yield database


def _executor_sql(database: Database, schema: str | None, *, is_async: bool) -> str:
    """The SQL the MCP / extension executor would run, via a dry run."""
    options = QueryOptions(schema=schema, dry_run=True)
    if is_async:
        handle = database.execute_async(SQL, options=options)
        result = handle.get_result()
    else:
        result = database.execute(SQL, options=options)
    assert result.error_message is None
    return result.statements[0].executed_sql


@pytest.mark.parametrize("is_async", [False, True])
@pytest.mark.parametrize("schema", [None, "public"])
def test_executor_rls_unqualified_table_without_schema(
    database: Database,
    mocker: MockerFixture,
    schema: str | None,
    is_async: bool,
) -> None:
    """
    ``SQLExecutor`` (MCP ``execute_sql``) applies the RLS of ``public.sales`` to an
    unqualified ``sales`` whether or not the query passes the ``public`` schema.
    """
    mocker.patch.dict(current_app.config, {"SQL_QUERY_MUTATOR": None})

    assert CLAUSE in _executor_sql(database, schema, is_async=is_async)


def test_executor_rls_qualified_table_unchanged(
    database: Database,
    mocker: MockerFixture,
) -> None:
    """
    A table the user qualifies keeps its RLS, and a table in another schema with
    no dataset gets none, whatever the default schema. Neither needs the default
    schema, so the connection isn't probed for it.
    """
    mocker.patch.dict(current_app.config, {"SQL_QUERY_MUTATOR": None})
    get_search_path = mocker.spy(Database, "get_search_path")

    options = QueryOptions(dry_run=True)
    qualified = database.execute("SELECT * FROM public.sales", options=options)
    other = database.execute("SELECT * FROM archive.sales", options=options)

    assert CLAUSE in qualified.statements[0].executed_sql
    assert CLAUSE not in other.statements[0].executed_sql
    get_search_path.assert_not_called()


def _run_sql_lab(
    database: Database,
    session: Session,
    mocker: MockerFixture,
    schema: str | None,
    *,
    store_results: bool,
    sql: str = SQL,
) -> tuple[list[str], dict[str, Any] | None]:
    """
    Run a query through SQL Lab's ``get_sql_results``.

    ``store_results`` is how the Celery worker runs it; the synchronous executor
    calls the same task inline without storing results.

    :returns: The SQL sent to the database, and the payload
    """
    from superset import sql_lab
    from superset.models.sql_lab import Query

    query = Query(
        client_id="rls_schema",
        database=database,
        sql=sql,
        schema=schema,
        limit=100,
        user_id=1,
    )
    session.add(query)
    session.flush()

    executed: list[str] = []

    def capture(query: Query, *args: Any) -> None:
        executed.append(query.executed_sql)
        raise sql_lab.SqlLabQueryStoppedException()

    mocker.patch.object(sql_lab, "execute_query", side_effect=capture)
    mocker.patch.object(sql_lab, "commit_query_unless_stopped", return_value=True)
    mocker.patch.object(sql_lab, "results_backend", MagicMock())
    mocker.patch.object(
        database.db_engine_spec, "get_cancel_query_id", return_value=None
    )
    mocker.patch.object(sql_lab.security_manager, "find_user", return_value=g.user)

    payload = sql_lab.get_sql_results(
        query.id,
        sql,
        return_results=not store_results,
        store_results=store_results,
        username="analyst",
    )
    return executed, payload


def _sql_lab_executed_sql(
    database: Database,
    session: Session,
    mocker: MockerFixture,
    schema: str | None,
    *,
    store_results: bool,
) -> str:
    """The SQL that SQL Lab's ``get_sql_results`` sends to the database."""
    executed, payload = _run_sql_lab(
        database, session, mocker, schema, store_results=store_results
    )
    assert len(executed) == 1, payload
    return executed[0]


@with_feature_flags(RLS_IN_SQLLAB=True)
@pytest.mark.parametrize("store_results", [False, True])
@pytest.mark.parametrize("schema", [None, "public"])
def test_sql_lab_rls_unqualified_table_without_schema(
    database: Database,
    session: Session,
    mocker: MockerFixture,
    schema: str | None,
    store_results: bool,
) -> None:
    """
    SQL Lab (sync and Celery) applies the RLS of ``public.sales`` to an
    unqualified ``sales`` whether or not the query has the ``public`` schema.
    """
    executed_sql = _sql_lab_executed_sql(
        database, session, mocker, schema, store_results=store_results
    )

    assert CLAUSE in executed_sql


@with_feature_flags(RLS_IN_SQLLAB=True)
@pytest.mark.parametrize("schema", [None, "public"])
def test_estimate_rls_unqualified_table_without_schema(
    database: Database,
    mocker: MockerFixture,
    schema: str | None,
) -> None:
    """
    The SQL Lab cost estimate prices the query with the same RLS execution
    applies, with or without the ``public`` schema.
    """
    from superset.commands.sql_lab.estimate import QueryEstimationCommand

    command = QueryEstimationCommand(
        {
            "database_id": database.id,
            "sql": SQL,
            "template_params": {},
            "catalog": None,
            "schema": schema,
        }
    )
    command._database = database

    with patch.dict(current_app.config, {"DISALLOWED_SQL_TABLES": {}}):
        assert CLAUSE in command._apply_sql_security(SQL)


# (denylist entry, query schema, query, blocked). A query without a schema reads
# an unqualified table from the connection's default schema, ``public``.
DENYLIST_CASES = [
    # the qualified entry matches the unqualified table with or without a schema
    ("public.sales", None, SQL, True),
    ("public.sales", "public", SQL, True),
    # a qualified entry for another schema doesn't match
    ("archive.sales", None, SQL, False),
    ("archive.sales", "public", SQL, False),
    # a bare entry matches whatever the schema
    ("sales", None, SQL, True),
    ("sales", "public", SQL, True),
    # tables the query qualifies match as before
    ("public.sales", None, "SELECT * FROM public.sales", True),
    ("public.sales", None, "SELECT * FROM archive.sales", False),
]


def _denylist(entry: str) -> dict[str, Any]:
    return {"DISALLOWED_SQL_TABLES": {"postgresql": {entry}}}


@pytest.mark.parametrize("is_async", [False, True])
@pytest.mark.parametrize("entry, schema, sql, blocked", DENYLIST_CASES)
def test_executor_denylist_unqualified_table_without_schema(
    database: Database,
    mocker: MockerFixture,
    entry: str,
    schema: str | None,
    sql: str,
    blocked: bool,
    is_async: bool,
) -> None:
    """
    ``SQLExecutor`` (MCP ``execute_sql``) matches a schema-qualified
    ``DISALLOWED_SQL_TABLES`` entry against an unqualified table whether or not
    the query passes the schema the table resolves to.
    """
    from superset.exceptions import SupersetSecurityException

    mocker.patch.dict(
        current_app.config, {"SQL_QUERY_MUTATOR": None, **_denylist(entry)}
    )
    options = QueryOptions(schema=schema, dry_run=True)

    if is_async:
        if blocked:
            with pytest.raises(SupersetSecurityException, match="Disallowed SQL"):
                database.execute_async(sql, options=options)
        else:
            assert database.execute_async(sql, options=options).get_result()
        return

    result = database.execute(sql, options=options)
    if blocked:
        assert "Disallowed SQL tables" in (result.error_message or "")
    else:
        assert result.error_message is None


@with_feature_flags(RLS_IN_SQLLAB=False)
@pytest.mark.parametrize("store_results", [False, True])
@pytest.mark.parametrize("entry, schema, sql, blocked", DENYLIST_CASES)
def test_sql_lab_denylist_unqualified_table_without_schema(
    database: Database,
    session: Session,
    mocker: MockerFixture,
    entry: str,
    schema: str | None,
    sql: str,
    blocked: bool,
    store_results: bool,
) -> None:
    """
    SQL Lab (sync and Celery) matches a schema-qualified ``DISALLOWED_SQL_TABLES``
    entry against an unqualified table whether or not the query has the schema
    the table resolves to.
    """
    mocker.patch.dict(current_app.config, _denylist(entry))

    executed, payload = _run_sql_lab(
        database, session, mocker, schema, store_results=store_results, sql=sql
    )

    if blocked:
        assert executed == []
        assert payload is not None
        assert "disallowed table" in payload["error"]
    else:
        assert len(executed) == 1, payload


@with_feature_flags(RLS_IN_SQLLAB=False)
@pytest.mark.parametrize("entry, schema, sql, blocked", DENYLIST_CASES)
def test_estimate_denylist_unqualified_table_without_schema(
    database: Database,
    entry: str,
    schema: str | None,
    sql: str,
    blocked: bool,
) -> None:
    """
    The SQL Lab cost estimate matches a schema-qualified ``DISALLOWED_SQL_TABLES``
    entry the same way execution does.
    """
    from superset.commands.sql_lab.estimate import QueryEstimationCommand
    from superset.exceptions import SupersetDisallowedSQLTableException

    command = QueryEstimationCommand(
        {
            "database_id": database.id,
            "sql": sql,
            "template_params": {},
            "catalog": None,
            "schema": schema,
        }
    )
    command._database = database

    with patch.dict(current_app.config, _denylist(entry)):
        if blocked:
            with pytest.raises(SupersetDisallowedSQLTableException):
                command._apply_sql_security(sql)
        else:
            assert command._apply_sql_security(sql) == sql


@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True)
@pytest.mark.parametrize("adhoc", [False, True])
@pytest.mark.parametrize("entry, schema, sql, blocked", DENYLIST_CASES)
def test_datasource_denylist_unqualified_table_without_schema(
    database: Database,
    mocker: MockerFixture,
    entry: str,
    schema: str | None,
    sql: str,
    blocked: bool,
    adhoc: bool,
) -> None:
    """
    A datasource's query and its adhoc SQL expressions match a schema-qualified
    ``DISALLOWED_SQL_TABLES`` entry against an unqualified table whether or not
    the datasource has the schema the table resolves to.
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.exceptions import SupersetDisallowedSQLTableException
    from superset.models.helpers import SqlExpressionContext

    mocker.patch.dict(current_app.config, _denylist(entry))
    datasource = SqlaTable(database=database, schema=schema, table_name="t")

    def check() -> None:
        if adhoc:
            datasource._process_sql_expression(
                f"({sql})", SqlExpressionContext("postgresql", "", None)
            )
        else:
            datasource._raise_for_disallowed_sql(sql)

    if blocked:
        with pytest.raises(SupersetDisallowedSQLTableException):
            check()
    else:
        check()


@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True)
@pytest.mark.parametrize("entry, probes", [("secrets", 0), ("public.secrets", 1)])
def test_datasource_discovers_default_schema_once_and_only_when_needed(
    database: Database,
    mocker: MockerFixture,
    entry: str,
    probes: int,
) -> None:
    """
    A datasource discovers the connection's default schema for the denylist only
    for a schema-qualified entry, and once across its adhoc expressions. (Adhoc
    RLS resolves its own schema, so only the denylist's discovery is counted.)
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.models import helpers
    from superset.models.helpers import SqlExpressionContext

    mocker.patch.dict(current_app.config, _denylist(entry))
    discover = mocker.spy(helpers, "get_unqualified_table_schemas")
    datasource = SqlaTable(database=database, schema=None, table_name="t")

    for expression in ("(SELECT 1 FROM a)", "(SELECT 2 FROM b)"):
        datasource._process_sql_expression(
            expression, SqlExpressionContext("postgresql", "", None)
        )
    datasource._raise_for_disallowed_sql(SQL)

    assert discover.call_count == probes


@pytest.mark.parametrize("rls", [False, True])
@pytest.mark.parametrize("entry, probes", [("secrets", 0), ("public.secrets", 1)])
def test_sql_lab_discovers_default_schema_once_and_only_when_needed(
    database: Database,
    session: Session,
    mocker: MockerFixture,
    entry: str,
    probes: int,
    rls: bool,
) -> None:
    """
    The default schema is discovered only when RLS or a schema-qualified
    denylist entry needs it, and at most once when both do. A bare-name denylist,
    such as the default one, never connects for it. The entries don't match the
    query, so it reaches RLS.
    """
    mocker.patch.dict(current_app.config, _denylist(entry))
    get_search_path = mocker.spy(Database, "get_search_path")

    with patch(
        "superset.sql_lab.is_feature_enabled",
        side_effect=lambda flag: flag == "RLS_IN_SQLLAB" and rls,
    ):
        _run_sql_lab(database, session, mocker, None, store_results=False)

    assert get_search_path.call_count == (1 if rls else probes)


def _statements(sql: str) -> list[Any]:
    from superset.sql.parse import SQLScript

    return SQLScript(sql, engine="postgresql").statements


@pytest.mark.parametrize(
    "schema, dynamic, sql, expected",
    [
        # an explicit or already-resolved schema wins without a lookup
        ("analytics", True, SQL, "analytics"),
        # engines without dynamic schemas resolve their default for execution
        (None, False, SQL, ""),
        # a fully qualified query has no table for the search path to resolve
        (None, True, "SELECT * FROM public.sales JOIN archive.x ON 1 = 1", ""),
        # a query reading no table at all
        (None, True, "SELECT 1", ""),
        # a query reading only a CTE
        (None, True, "WITH Sales AS (SELECT 1 AS n) SELECT * FROM sales", ""),
        # unqualified tables are looked up on the search path, all at once
        (None, True, "SELECT * FROM public.sales JOIN x ON 1 = 1", ["x"]),
        ("", True, "SELECT * FROM b JOIN a ON 1 = 1", ["a", "b"]),
    ],
)
def test_get_unqualified_table_schemas(
    schema: str | None,
    dynamic: bool,
    sql: str,
    expected: str | list[str],
) -> None:
    """
    The search path is used only when RLS needs it: a dynamic-schema engine, no
    per-query schema, and a table read without a schema. The tables read without
    one are then looked up on it in one round trip.

    :param expected: The schema, or the tables looked up on the search path
    """
    from superset.utils.rls import get_unqualified_table_schemas, SearchPath

    database = MagicMock()
    database.db_engine_spec.supports_dynamic_schema = dynamic
    database.get_search_path.return_value = (["analyst", "public"], {"a": ["public"]})

    result = get_unqualified_table_schemas(database, "cat", schema, _statements(sql))

    if isinstance(expected, str):
        assert result == expected
        database.get_search_path.assert_not_called()
    else:
        assert isinstance(result, SearchPath)
        database.get_search_path.assert_called_once_with("cat", expected)
        # the tables were looked up with the path, so resolving them doesn't connect
        assert [result.schemas_for(table) for table in expected] == [
            ("public",) if table == "a" else ("analyst", "public") for table in expected
        ]
        database.get_search_path.assert_called_once()


@pytest.mark.parametrize(
    "search_path, expected",
    [
        # a single schema is where every unqualified table is read from
        (["public"], "public"),
        ([], ""),
        # several need a table looked up to know which of them it's read from
        (["analyst", "public"], ("analyst", "public")),
        # and when the connection can't be asked, none is known
        (Exception("permission denied"), None),
    ],
)
def test_get_unqualified_table_schemas_without_statements(
    search_path: list[str] | Exception,
    expected: str | tuple[str, ...] | None,
) -> None:
    """
    Without the statements the search path is read without looking a table up.
    """
    from superset.utils.rls import get_unqualified_table_schemas, SearchPath

    database = MagicMock()
    database.db_engine_spec.supports_dynamic_schema = True
    if isinstance(search_path, Exception):
        database.get_search_path.side_effect = search_path
    else:
        database.get_search_path.return_value = (search_path, {})

    result = get_unqualified_table_schemas(database, "cat", None)

    database.get_search_path.assert_called_once_with("cat", [])
    if isinstance(expected, str):
        assert result == expected
    else:
        assert isinstance(result, SearchPath)
        assert result.schemas == expected


@pytest.mark.parametrize(
    "found, expected",
    [
        # the schema the connection reads the table from
        ({"sales": ["analyst"]}, ("analyst",)),
        # both, when its name could name a table in either (see get_search_path)
        ({"sales": ["analyst", "public"]}, ("analyst", "public")),
        # every schema on the path when none holds it
        ({}, ("pg_catalog", "analyst", "public")),
        # unknown when the connection can't be asked
        (Exception("permission denied"), None),
    ],
)
def test_search_path_schemas_for(
    found: dict[str, list[str]] | Exception,
    expected: tuple[str, ...] | None,
) -> None:
    """
    A table read through a search path resolves to the schema it's read from,
    looked up once.
    """
    from superset.utils.rls import SearchPath

    database = MagicMock()
    if isinstance(found, Exception):
        database.get_search_path.side_effect = found
    else:
        database.get_search_path.return_value = (
            ["pg_catalog", "analyst", "public"],
            found,
        )
    path = SearchPath(database, "cat", ["analyst", "public"])

    assert path.schemas_for("sales") == expected
    assert path.schemas_for("sales") == expected
    database.get_search_path.assert_called_once_with("cat", ["sales"])


def test_search_path_unknown_is_not_looked_up() -> None:
    """
    A search path the connection couldn't report resolves no table, without asking
    again.
    """
    from superset.utils.rls import SearchPath

    database = MagicMock()

    assert SearchPath(database, None, None).schemas_for("sales") is None
    database.get_search_path.assert_not_called()


def test_search_path_resolves_each_table_once() -> None:
    """
    ``resolve`` looks up, in one round trip, only the tables not looked up yet.
    """
    from superset.utils.rls import SearchPath

    database = MagicMock()
    database.get_search_path.return_value = (["analyst", "public"], {})
    path = SearchPath(database, None, ["analyst", "public"])
    path.record(["d"], {})

    path.resolve(["b", "a", "d"])
    path.resolve(["a", "c", "b"])
    path.resolve(["c"])

    assert database.get_search_path.call_args_list == [
        ((None, ["a", "b"]),),
        ((None, ["c"]),),
    ]


@pytest.fixture
def user_schema_first(database: Database, mocker: MockerFixture) -> Database:
    """
    The Postgres default ``search_path`` (``"$user", public``) for a user whose
    own schema exists: the connection reports that schema as its default, but an
    unqualified ``sales``, which only ``public`` has, still reads ``public.sales``.
    """
    _connect(mocker, "analyst", ["analyst", "public"], {"sales": "public"})
    return database


@pytest.mark.parametrize("is_async", [False, True])
def test_executor_rls_table_later_on_search_path(
    user_schema_first: Database, mocker: MockerFixture, is_async: bool
) -> None:
    """
    ``SQLExecutor`` applies the RLS of ``public.sales`` to an unqualified ``sales``
    when ``public`` is not the first schema on the search path.
    """
    mocker.patch.dict(current_app.config, {"SQL_QUERY_MUTATOR": None})

    assert CLAUSE in _executor_sql(user_schema_first, None, is_async=is_async)


@with_feature_flags(RLS_IN_SQLLAB=True)
@pytest.mark.parametrize("store_results", [False, True])
def test_sql_lab_rls_table_later_on_search_path(
    user_schema_first: Database,
    session: Session,
    mocker: MockerFixture,
    store_results: bool,
) -> None:
    """
    SQL Lab applies the RLS of ``public.sales`` to an unqualified ``sales`` when
    ``public`` is not the first schema on the search path.
    """
    executed_sql = _sql_lab_executed_sql(
        user_schema_first, session, mocker, None, store_results=store_results
    )

    assert CLAUSE in executed_sql


def _estimate(database: Database, sql: str, schema: str | None = None) -> Any:
    from superset.commands.sql_lab.estimate import QueryEstimationCommand

    command = QueryEstimationCommand(
        {
            "database_id": database.id,
            "sql": sql,
            "template_params": {},
            "catalog": None,
            "schema": schema,
        }
    )
    command._database = database
    return command


@with_feature_flags(RLS_IN_SQLLAB=True)
def test_estimate_rls_table_later_on_search_path(
    user_schema_first: Database,
) -> None:
    """
    The cost estimate applies the RLS of ``public.sales`` to an unqualified
    ``sales`` when ``public`` is not the first schema on the search path.
    """
    with patch.dict(current_app.config, {"DISALLOWED_SQL_TABLES": {}}):
        assert CLAUSE in _estimate(user_schema_first, SQL)._apply_sql_security(SQL)


@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True)
def test_adhoc_and_cache_key_rls_table_later_on_search_path(
    user_schema_first: Database,
) -> None:
    """
    The datasource paths that resolve the RLS schema with ``get_rls_schema`` -- an
    adhoc sub-query and the RLS cache key -- also find ``public.sales`` when
    ``public`` is not the first schema on the search path.
    """
    from superset.models.helpers import validate_adhoc_subquery
    from superset.utils.rls import (
        collect_rls_predicates_for_sql,
        get_rls_schema,
        SearchPath,
    )

    assert isinstance(get_rls_schema(user_schema_first, None, None, SQL), SearchPath)
    assert CLAUSE in validate_adhoc_subquery(
        f"({SQL})", user_schema_first, None, "", "postgresql"
    )
    keys = collect_rls_predicates_for_sql(
        SQL,
        user_schema_first,
        None,
        None,
        resolve_schema=lambda: get_rls_schema(user_schema_first, None, None, SQL),
    )
    assert any(CLAUSE in key for key in keys)


def test_virtual_dataset_rls_failure_checks_every_search_path_schema(
    user_schema_first: Database, mocker: MockerFixture
) -> None:
    """
    When RLS can't be injected into a virtual dataset's SQL, the query only runs if
    no rule applies to its tables; that check also looks at ``public.sales`` when
    ``public`` is not the first schema on the search path.
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.exceptions import QueryObjectValidationError

    mocker.patch(
        "superset.models.helpers.apply_rls", side_effect=ValueError("cannot apply")
    )
    # the fixture's rows are only flushed, so keep the handler's rollback off them
    mocker.patch("superset.models.helpers.db.session.rollback")
    virtual = SqlaTable(
        table_name="virtual", sql=SQL, schema=None, database=user_schema_first
    )

    with pytest.raises(QueryObjectValidationError, match="Row-level security"):
        virtual.get_from_clause()


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT * FROM sales JOIN analyst.sales AS s ON TRUE",
        "SELECT * FROM analyst.sales AS s JOIN sales ON TRUE",
    ],
)
def test_apply_rls_keeps_qualified_table_out_of_search_path_rules(
    user_schema_first: Database, sql: str
) -> None:
    """
    An unqualified table gets the rules of the table the search path reads it from,
    while the same table qualified with another schema on the path keeps only its
    own (none here).
    """
    from superset.sql.parse import SQLStatement
    from superset.utils.rls import apply_rls, get_unqualified_table_schemas

    statement = SQLStatement(sql, "postgresql")
    search_path = get_unqualified_table_schemas(user_schema_first, None, None)
    assert apply_rls(user_schema_first, None, search_path, statement)
    output = statement.format()
    assert output.count(CLAUSE) == 1
    # the qualified read is left as written, not wrapped in a filtered sub-query
    assert "analyst.sales AS s" in output


@pytest.mark.parametrize("is_async", [False, True])
@pytest.mark.parametrize(
    "entry, blocked", [("public.sales", True), ("archive.sales", False)]
)
def test_executor_denylist_table_later_on_search_path(
    user_schema_first: Database,
    mocker: MockerFixture,
    entry: str,
    blocked: bool,
    is_async: bool,
) -> None:
    """
    ``SQLExecutor`` matches ``public.sales`` against an unqualified ``sales`` when
    ``public`` is not the first schema on the search path.
    """
    from superset.exceptions import SupersetSecurityException

    mocker.patch.dict(
        current_app.config, {"SQL_QUERY_MUTATOR": None, **_denylist(entry)}
    )
    options = QueryOptions(dry_run=True)

    if is_async:
        if blocked:
            with pytest.raises(SupersetSecurityException, match="Disallowed SQL"):
                user_schema_first.execute_async(SQL, options=options)
        else:
            assert user_schema_first.execute_async(SQL, options=options).get_result()
        return

    result = user_schema_first.execute(SQL, options=options)
    assert ("Disallowed SQL tables" in (result.error_message or "")) is blocked


@with_feature_flags(RLS_IN_SQLLAB=False)
@pytest.mark.parametrize(
    "entry, blocked", [("public.sales", True), ("archive.sales", False)]
)
def test_sql_lab_and_estimate_denylist_table_later_on_search_path(
    user_schema_first: Database,
    session: Session,
    mocker: MockerFixture,
    entry: str,
    blocked: bool,
) -> None:
    """
    SQL Lab and the cost estimate match ``public.sales`` against an unqualified
    ``sales`` when ``public`` is not the first schema on the search path.
    """
    from superset.exceptions import SupersetDisallowedSQLTableException

    mocker.patch.dict(current_app.config, _denylist(entry))

    executed, payload = _run_sql_lab(
        user_schema_first, session, mocker, None, store_results=False
    )
    assert (executed == []) is blocked, payload

    command = _estimate(user_schema_first, SQL)
    if blocked:
        with pytest.raises(SupersetDisallowedSQLTableException):
            command._apply_sql_security(SQL)
    else:
        assert command._apply_sql_security(SQL) == SQL


@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True)
@pytest.mark.parametrize("adhoc", [False, True])
@pytest.mark.parametrize(
    "entry, blocked", [("public.sales", True), ("archive.sales", False)]
)
def test_datasource_denylist_table_later_on_search_path(
    user_schema_first: Database,
    mocker: MockerFixture,
    entry: str,
    blocked: bool,
    adhoc: bool,
) -> None:
    """
    A datasource without a schema matches ``public.sales`` against an unqualified
    ``sales`` when ``public`` is not the first schema on the search path.
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.exceptions import SupersetDisallowedSQLTableException
    from superset.models.helpers import SqlExpressionContext

    mocker.patch.dict(current_app.config, _denylist(entry))
    datasource = SqlaTable(database=user_schema_first, schema=None, table_name="t")

    def check() -> None:
        if adhoc:
            datasource._process_sql_expression(
                f"({SQL})", SqlExpressionContext("postgresql", "", None)
            )
        else:
            datasource._raise_for_disallowed_sql(SQL)

    if blocked:
        with pytest.raises(SupersetDisallowedSQLTableException):
            check()
    else:
        check()


# Queries reading only a CTE that a rule's table name would match without the
# engine's case folding, or without ``WITH RECURSIVE`` forward references.
CTE_ONLY_SQL = [
    "WITH Sales AS (SELECT 'west' AS region, 2 AS amount) SELECT * FROM sales",
    "WITH RECURSIVE a AS (SELECT * FROM sales), "
    "sales AS (SELECT 'west' AS region, 2 AS amount) SELECT * FROM a",
]


@pytest.mark.parametrize("sql", CTE_ONLY_SQL)
def test_executor_cte_only_query_unaffected(
    database: Database, mocker: MockerFixture, sql: str
) -> None:
    """
    ``SQLExecutor`` neither denies nor filters a query reading only a CTE whose
    name a rule's table shares.
    """
    mocker.patch.dict(
        current_app.config,
        {"SQL_QUERY_MUTATOR": None, **_denylist("public.sales")},
    )

    result = database.execute(sql, options=QueryOptions(dry_run=True))

    assert result.error_message is None
    assert CLAUSE not in result.statements[0].executed_sql


@pytest.mark.parametrize("rls", [False, True])
@pytest.mark.parametrize("sql", CTE_ONLY_SQL)
def test_sql_lab_and_estimate_cte_only_query_unaffected(
    database: Database,
    session: Session,
    mocker: MockerFixture,
    sql: str,
    rls: bool,
) -> None:
    """
    SQL Lab and the cost estimate neither deny nor filter a query reading only a
    CTE whose name a rule's table shares.
    """
    mocker.patch.dict(current_app.config, _denylist("public.sales"))

    def enabled(flag: str) -> bool:
        return flag == "RLS_IN_SQLLAB" and rls

    with patch("superset.sql_lab.is_feature_enabled", side_effect=enabled):
        executed, payload = _run_sql_lab(
            database, session, mocker, None, store_results=False, sql=sql
        )
    assert len(executed) == 1, payload
    assert CLAUSE not in executed[0]

    with patch(
        "superset.commands.sql_lab.estimate.is_feature_enabled", side_effect=enabled
    ):
        assert CLAUSE not in _estimate(database, sql)._apply_sql_security(sql)


@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True)
@pytest.mark.parametrize("adhoc", [False, True])
@pytest.mark.parametrize("sql", CTE_ONLY_SQL)
def test_datasource_cte_only_query_not_denied(
    database: Database, mocker: MockerFixture, sql: str, adhoc: bool
) -> None:
    """
    A datasource's query and adhoc expressions reading only a CTE whose name a
    denylisted table shares are not denied.
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.helpers import SqlExpressionContext

    mocker.patch.dict(current_app.config, _denylist("public.sales"))
    datasource = SqlaTable(database=database, schema=None, table_name="t")

    if adhoc:
        datasource._process_sql_expression(
            f"({sql})", SqlExpressionContext("postgresql", "", None)
        )
    else:
        datasource._raise_for_disallowed_sql(sql)


@pytest.mark.parametrize(
    "sql, schema, entry, rls, probes",
    [
        # RLS and a qualified entry share one discovery across the statements
        ("SELECT * FROM sales; SELECT * FROM sales", None, "public.other", True, 1),
        ("SELECT * FROM sales", None, "public.other", False, 1),
        # a bare entry matches whatever the schema, so it doesn't need one
        ("SELECT * FROM sales", None, "other", False, 0),
        ("SELECT * FROM sales", None, "other", True, 1),
        # nothing reads an unqualified table, or the query has a schema
        ("SELECT * FROM public.sales", None, "public.other", True, 0),
        ("SELECT * FROM sales", "public", "public.other", True, 0),
    ],
)
def test_estimate_discovers_search_path_once_and_only_when_needed(
    database: Database,
    mocker: MockerFixture,
    sql: str,
    schema: str | None,
    entry: str,
    rls: bool,
    probes: int,
) -> None:
    """
    The cost estimate discovers the search path at most once, and only when RLS
    or a schema-qualified denylist entry needs it for an unqualified table.
    """
    get_search_path = mocker.spy(Database, "get_search_path")
    mocker.patch(
        "superset.commands.sql_lab.estimate.is_feature_enabled",
        side_effect=lambda flag: flag == "RLS_IN_SQLLAB" and rls,
    )

    with patch.dict(current_app.config, _denylist(entry)):
        _estimate(database, sql, schema)._apply_sql_security(sql)

    assert get_search_path.call_count == probes


@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True)
def test_datasource_skips_search_path_without_unqualified_table(
    database: Database, mocker: MockerFixture
) -> None:
    """
    A datasource doesn't discover the search path for a qualified denylist entry
    when its SQL reads no unqualified table.
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.models import helpers
    from superset.models.helpers import SqlExpressionContext

    mocker.patch.dict(current_app.config, _denylist("public.secrets"))
    discover = mocker.spy(helpers, "get_unqualified_table_schemas")
    datasource = SqlaTable(database=database, schema=None, table_name="t")

    datasource._process_sql_expression(
        "(SELECT 1 FROM archive.a)", SqlExpressionContext("postgresql", "", None)
    )
    datasource._raise_for_disallowed_sql("SELECT * FROM public.sales")

    discover.assert_not_called()


@pytest.mark.parametrize(
    "search_path, entries, expected",
    [
        # an entry for the schema the table is read from
        (
            (["analyst", "public"], {"sales": ["public"]}),
            {"Public.Sales"},
            {"Public.Sales"},
        ),
        # not one for a schema it's not read from, nor a catalog-qualified one
        (
            (["analyst", "public"], {"sales": ["public"]}),
            {"analyst.sales", "public.other", "db.public.sales"},
            set(),
        ),
        # one for any schema on the path when none holds it
        ((["analyst", "public"], {}), {"analyst.sales"}, {"analyst.sales"}),
        # one for any schema when that's unknown
        (Exception("permission denied"), {"archive.sales", "x.y"}, {"archive.sales"}),
        # a bare entry, without a lookup
        (Exception("not looked up"), {"sales"}, {"sales"}),
    ],
)
def test_get_disallowed_tables(
    search_path: tuple[list[str], dict[str, list[str]]] | Exception,
    entries: set[str],
    expected: set[str],
) -> None:
    """
    A schema-qualified entry matches an unqualified table read through a search
    path in the schema the connection reads it from.
    """
    from superset.sql.parse import SQLScript
    from superset.utils.rls import get_disallowed_tables, SearchPath

    database = MagicMock()
    if isinstance(search_path, Exception):
        database.get_search_path.side_effect = search_path
    else:
        database.get_search_path.return_value = search_path
    script = SQLScript("SELECT * FROM sales", engine="postgresql")

    path = SearchPath(database, None, ["analyst", "public"])
    assert get_disallowed_tables(script, entries, path) == expected
    assert database.get_search_path.called is any("." in e for e in entries)


@pytest.mark.parametrize(
    "schema, entries, expected",
    [
        ("public", {"public.sales"}, {"public.sales"}),
        (None, {"public.sales", "sales"}, {"sales"}),
    ],
)
def test_get_disallowed_tables_known_schema(
    schema: str | None, entries: set[str], expected: set[str]
) -> None:
    """
    An unqualified table read from a known schema matches an entry for it, and one
    from an unknown schema only a bare entry.
    """
    from superset.sql.parse import SQLScript
    from superset.utils.rls import get_disallowed_tables

    script = SQLScript("SELECT * FROM sales", engine="postgresql")
    assert get_disallowed_tables(script, entries, schema) == expected


def test_get_disallowed_tables_after_search_path_change() -> None:
    """
    A table read after the script changes its search path matches an entry of its
    name whatever the schema, even when the connection reads it from another one
    before the change.
    """
    from superset.sql.parse import SQLScript
    from superset.utils.rls import get_disallowed_tables, SearchPath

    database = MagicMock()
    database.get_search_path.return_value = (["public"], {"tables": ["public"]})
    script = SQLScript(
        "SET search_path = information_schema; SELECT * FROM tables",
        engine="postgresql",
    )
    entries = {"information_schema.tables"}

    search_path = SearchPath(database, None, ["public", "information_schema"])
    assert get_disallowed_tables(script, entries, search_path) == entries


# The paths that apply RLS to a SQL Lab style query
RLS_PATHS = ["executor", "executor_async", "sql_lab", "sql_lab_celery", "estimate"]


def _rls_sql(
    path: str,
    database: Database,
    session: Session,
    mocker: MockerFixture,
    sql: str = SQL,
) -> str:
    """The SQL a query without a schema runs as (or is priced as) on ``path``."""
    if path.startswith("executor"):
        mocker.patch.dict(current_app.config, {"SQL_QUERY_MUTATOR": None})
        options = QueryOptions(dry_run=True)
        if path == "executor_async":
            result = database.execute_async(sql, options=options).get_result()
        else:
            result = database.execute(sql, options=options)
        assert result.error_message is None
        return result.statements[0].executed_sql
    if path.startswith("sql_lab"):
        with patch(
            "superset.sql_lab.is_feature_enabled",
            side_effect=lambda flag: flag == "RLS_IN_SQLLAB",
        ):
            executed, payload = _run_sql_lab(
                database,
                session,
                mocker,
                None,
                store_results=path == "sql_lab_celery",
                sql=sql,
            )
        assert len(executed) == 1, payload
        return executed[0]
    with (
        patch(
            "superset.commands.sql_lab.estimate.is_feature_enabled",
            side_effect=lambda flag: flag == "RLS_IN_SQLLAB",
        ),
        patch.dict(current_app.config, {"DISALLOWED_SQL_TABLES": {}}),
    ):
        return _estimate(database, sql)._apply_sql_security(sql)


# The paths that check a query against ``DISALLOWED_SQL_TABLES``
DENYLIST_PATHS = ["executor", "sql_lab", "estimate", "datasource", "adhoc"]


def _denied(
    path: str,
    database: Database,
    session: Session,
    mocker: MockerFixture,
    entry: str,
    sql: str = SQL,
) -> bool:
    """Whether ``path`` denies a query without a schema for the denylist ``entry``."""
    from superset.connectors.sqla.models import SqlaTable
    from superset.exceptions import SupersetDisallowedSQLTableException
    from superset.models.helpers import SqlExpressionContext

    mocker.patch.dict(
        current_app.config, {"SQL_QUERY_MUTATOR": None, **_denylist(entry)}
    )
    if path == "executor":
        result = database.execute(sql, options=QueryOptions(dry_run=True))
        return "Disallowed SQL tables" in (result.error_message or "")
    if path == "sql_lab":
        with patch("superset.sql_lab.is_feature_enabled", return_value=False):
            executed, payload = _run_sql_lab(
                database, session, mocker, None, store_results=False, sql=sql
            )
        return not executed
    datasource = SqlaTable(database=database, schema=None, table_name="t")
    try:
        if path == "estimate":
            with patch(
                "superset.commands.sql_lab.estimate.is_feature_enabled",
                return_value=False,
            ):
                _estimate(database, sql)._apply_sql_security(sql)
        elif path == "datasource":
            datasource._raise_for_disallowed_sql(sql)
        else:
            with patch(
                "superset.models.helpers.is_feature_enabled",
                side_effect=lambda flag: flag == "ALLOW_ADHOC_SUBQUERY",
            ):
                datasource._process_sql_expression(
                    f"({sql})", SqlExpressionContext("postgresql", "", None)
                )
    except SupersetDisallowedSQLTableException:
        return True
    return False


@pytest.fixture
def discovery_denied(database: Database, mocker: MockerFixture) -> Database:
    """
    A connection that can't be asked for its search path (``EXECUTE`` on
    ``current_schemas`` revoked, say), although its default schema, which doesn't
    hold ``sales``, is still known.
    """
    _connect(
        mocker,
        "analyst",
        ["analyst", "public"],
        error=Exception("permission denied for function current_schemas"),
    )
    return database


@pytest.mark.parametrize("path", RLS_PATHS)
def test_rls_search_path_discovery_failure_fails_closed(
    discovery_denied: Database,
    session: Session,
    mocker: MockerFixture,
    path: str,
) -> None:
    """
    When the search path can't be discovered, which schema an unqualified ``sales``
    is read from is unknown, so it gets the rules of ``sales`` in any schema
    rather than those of the default schema only (none here).
    """
    assert CLAUSE in _rls_sql(path, discovery_denied, session, mocker)


@pytest.mark.parametrize("path", DENYLIST_PATHS)
@pytest.mark.parametrize(
    "entry, blocked", [("public.sales", True), ("public.other", False)]
)
def test_denylist_search_path_discovery_failure_fails_closed(
    discovery_denied: Database,
    session: Session,
    mocker: MockerFixture,
    path: str,
    entry: str,
    blocked: bool,
) -> None:
    """
    When the search path can't be discovered, a schema-qualified denylist entry
    matches an unqualified table of its name in any schema.
    """
    assert _denied(path, discovery_denied, session, mocker, entry) is blocked


WEST = "region = 'west'"


@pytest.fixture
def shadowed(database: Database, session: Session, mocker: MockerFixture) -> Database:
    """
    ``analyst.sales`` shadows ``public.sales``: both exist, ``analyst`` comes first
    on the search path, and so an unqualified ``sales`` reads ``analyst.sales``,
    whose rule is ``WEST``, never ``public.sales``, whose rule is ``CLAUSE``.
    """
    from superset.connectors.sqla.models import RowLevelSecurityFilter, SqlaTable

    east = session.query(RowLevelSecurityFilter).filter_by(name="east only").one()
    analyst_sales = SqlaTable(table_name="sales", schema="analyst", database=database)
    west = RowLevelSecurityFilter(
        name="west only",
        filter_type="Regular",
        clause=WEST,
        tables=[analyst_sales],
        subjects=list(east.subjects),
    )
    session.add_all([analyst_sales, west])
    session.flush()
    _connect(mocker, "analyst", ["analyst", "public"], {"sales": "analyst"})
    return database


@pytest.mark.parametrize("path", RLS_PATHS)
def test_rls_shadowed_table_gets_only_its_own_rules(
    shadowed: Database, session: Session, mocker: MockerFixture, path: str
) -> None:
    """
    An unqualified table gets the rules of the table the connection reads, the
    first one of its name on the search path, not those of a table it shadows.
    """
    sql = _rls_sql(path, shadowed, session, mocker)

    assert WEST in sql
    assert CLAUSE not in sql


@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True)
def test_adhoc_and_cache_key_shadowed_table_gets_only_its_own_rules(
    shadowed: Database,
) -> None:
    """
    An adhoc sub-query and the RLS cache key, which resolve the search path without
    the statements, also give an unqualified table the rules of the table read.
    """
    from superset.models.helpers import validate_adhoc_subquery
    from superset.utils.rls import collect_rls_predicates_for_sql, get_rls_schema

    adhoc = validate_adhoc_subquery(f"({SQL})", shadowed, None, "", "postgresql")
    keys = collect_rls_predicates_for_sql(
        SQL,
        shadowed,
        None,
        None,
        resolve_schema=lambda: get_rls_schema(shadowed, None, None, SQL),
    )

    assert WEST in adhoc
    assert CLAUSE not in adhoc
    assert any(WEST in key for key in keys)
    assert not any(CLAUSE in key for key in keys)


@pytest.mark.parametrize("datasource", ["dataset", "query"])
def test_virtual_dataset_shadowed_table_gets_only_its_own_rules(
    shadowed: Database, datasource: str
) -> None:
    """
    A virtual dataset's SQL, and a SQL Lab query used as a datasource, give an
    unqualified table the rules of the table read, not those of one it shadows.
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.sql_lab import Query

    virtual = (
        SqlaTable(table_name="virtual", sql=SQL, schema=None, database=shadowed)
        if datasource == "dataset"
        else Query(client_id="virtual", sql=SQL, schema=None, database=shadowed)
    )

    from_clause, _ = virtual.get_from_clause()
    sql = str(from_clause.compile(compile_kwargs={"literal_binds": True}))

    assert WEST in sql
    assert CLAUSE not in sql


@pytest.mark.parametrize("path", DENYLIST_PATHS)
@pytest.mark.parametrize(
    "entry, blocked", [("public.sales", False), ("analyst.sales", True)]
)
def test_denylist_shadowed_table(
    shadowed: Database,
    session: Session,
    mocker: MockerFixture,
    path: str,
    entry: str,
    blocked: bool,
) -> None:
    """
    A schema-qualified denylist entry matches an unqualified table only in the
    schema the connection reads it from, not one whose table it shadows.
    """
    assert _denied(path, shadowed, session, mocker, entry) is blocked


@pytest.mark.parametrize("path", RLS_PATHS)
def test_rls_unresolved_table_gets_rules_of_every_search_path_schema(
    user_schema_first: Database,
    session: Session,
    mocker: MockerFixture,
    path: str,
) -> None:
    """
    A table the connection doesn't find on the search path (one the script creates
    before reading it, say) gets the rules of the table in every schema on it.
    """
    _connect(mocker, "analyst", ["analyst", "public"])

    assert CLAUSE in _rls_sql(path, user_schema_first, session, mocker)


CATALOG_SQL = "SELECT relname FROM pg_class"
CATALOG_CLAUSE = "relname = 'sales'"


@pytest.fixture
def catalog_table(
    database: Database, session: Session, mocker: MockerFixture
) -> Database:
    """
    The rule is on ``pg_catalog.pg_class``, which Postgres searches before the
    schemas on the ``search_path`` without the path naming it.
    """
    from superset.connectors.sqla.models import RowLevelSecurityFilter

    rule = session.query(RowLevelSecurityFilter).filter_by(name="east only").one()
    rule.clause = CATALOG_CLAUSE
    rule.tables[0].schema = "pg_catalog"
    rule.tables[0].table_name = "pg_class"
    session.flush()
    _connect(mocker, "public", SEARCH_PATH, {"pg_class": "pg_catalog"})
    return database


@pytest.mark.parametrize("path", RLS_PATHS)
def test_rls_implicit_pg_catalog_table(
    catalog_table: Database, session: Session, mocker: MockerFixture, path: str
) -> None:
    """
    An unqualified table read from the implicit ``pg_catalog`` gets its rules.
    """
    sql = _rls_sql(path, catalog_table, session, mocker, CATALOG_SQL)

    assert CATALOG_CLAUSE in sql


@pytest.mark.parametrize("path", DENYLIST_PATHS)
def test_denylist_implicit_pg_catalog_table(
    catalog_table: Database, session: Session, mocker: MockerFixture, path: str
) -> None:
    """
    A ``pg_catalog`` denylist entry matches an unqualified table read from the
    implicit ``pg_catalog``.
    """
    assert _denied(
        path, catalog_table, session, mocker, "pg_catalog.pg_class", CATALOG_SQL
    )


@pytest.mark.parametrize(
    "sql, tables",
    [
        # a table no rule applies to
        ("SELECT * FROM no_rules", {}),
        # the table read has no rule, although one it shadows has
        (SQL, {"sales": "analyst"}),
    ],
)
def test_virtual_dataset_rls_failure_without_applicable_rule_continues(
    user_schema_first: Database,
    mocker: MockerFixture,
    sql: str,
    tables: dict[str, str],
) -> None:
    """
    When RLS can't be injected into a virtual dataset's SQL but no rule applies to
    the tables it reads, the query still runs.
    """
    from superset.connectors.sqla.models import SqlaTable

    _connect(mocker, "analyst", ["analyst", "public"], tables)
    mocker.patch(
        "superset.models.helpers.apply_rls", side_effect=ValueError("cannot apply")
    )
    # the fixture's rows are only flushed, so keep the handler's rollback off them
    mocker.patch("superset.models.helpers.db.session.rollback")
    virtual = SqlaTable(
        table_name="virtual", sql=sql, schema=None, database=user_schema_first
    )

    from_clause, _ = virtual.get_from_clause()

    assert "cannot apply" not in str(from_clause)
