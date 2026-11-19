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
from uuid import uuid4

import pytest
from flask import current_app, g
from pytest_mock import MockerFixture
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm.session import Session
from superset_core.queries.types import QueryOptions

from superset.models.core import Database
from superset.sql.parse import Table
from superset.utils import json
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
    in, and to nothing for a table ``tables`` doesn't have. ``named`` is the
    ``search_path`` setting, which names schemas ``current_schemas`` leaves out
    because they don't exist; it names those of ``search_path`` by default.
    """

    def __init__(
        self,
        search_path: list[str],
        tables: dict[str, str],
        error: Exception | None,
        named: str | None = None,
    ) -> None:
        self.search_path = search_path
        self.tables = tables
        self.error = error
        self.named = ", ".join(search_path) if named is None else named
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
                    self.named,
                    "analyst",
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
    search_path: list[str],
    tables: dict[str, str],
    error: Exception | None,
    named: str | None = None,
) -> Iterator[Any]:
    """A connection answering the search path queries (see ``_Cursor``)."""
    connection = MagicMock()
    connection.cursor.return_value = _Cursor(search_path, tables, error, named)
    yield connection


def _connect(
    mocker: MockerFixture,
    default_schema: str,
    search_path: list[str],
    tables: dict[str, str] | None = None,
    error: Exception | None = None,
    named: str | None = None,
) -> None:
    """
    Report the connection's default schema and search path, and resolve each table
    in ``tables`` (by name) to its schema there. ``error`` fails the search path
    queries, and ``named`` is the ``search_path`` setting (see ``_Cursor``).
    """
    mocker.patch.object(
        Database, "get_inspector", side_effect=lambda **kw: _inspector(default_schema)
    )
    mocker.patch.object(
        Database,
        "get_raw_connection",
        side_effect=lambda *args, **kw: _raw_connection(
            search_path, tables or {}, error, named
        ),
    )


def _rls_user(session: Session, mocker: MockerFixture, dataset: Any) -> Any:
    """
    Assign a Regular RLS filter on the dataset to the role of a new user, whose
    subject the queries run as.
    """
    from flask_appbuilder.security.sqla.models import Role, User

    from superset.connectors.sqla.models import RowLevelSecurityFilter
    from superset.subjects.models import Subject
    from superset.subjects.types import SubjectType

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
    session.add_all([dataset.database, dataset, role, user, subject, rls_filter])
    session.flush()

    mocker.patch(
        "superset.subjects.utils.get_current_user_subject_ids",
        return_value=[subject.id],
    )
    return user


@pytest.fixture
def database(session: Session, mocker: MockerFixture) -> Iterator[Database]:
    """
    A Postgres database whose ``public.sales`` dataset has a Regular RLS filter
    assigned to the current user's role.

    The connection's default schema (the Postgres ``search_path``) is ``public``.
    Call ``_connect`` again to change it.
    """
    from superset.connectors.sqla.models import SqlaTable

    SqlaTable.metadata.create_all(session.get_bind())

    database = Database(
        id=1,
        database_name="pg",
        sqlalchemy_uri="postgresql://user:pass@host:5432/analytics",
    )
    dataset = SqlaTable(table_name="sales", schema="public", database=database)
    user = _rls_user(session, mocker, dataset)

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
    catalog: str | None = None,
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
        client_id=uuid4().hex[:11],
        database=database,
        sql=sql,
        catalog=catalog,
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


def _denylist(entry: str, engine: str = "postgresql") -> dict[str, Any]:
    return {"DISALLOWED_SQL_TABLES": {engine: {entry}}}


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
        assert [result.schemas_for(Table(table)) for table in expected] == [
            ("public",) if table == "a" else ("analyst", "public") for table in expected
        ]
        database.get_search_path.assert_called_once()


@pytest.mark.parametrize(
    "search_path, expected",
    [
        # a single schema is where every unqualified table is read from
        (["public"], ("public",)),
        # several need a table looked up to know which of them it's read from
        (["analyst", "public"], ("analyst", "public")),
        # none is known when the path is empty, or the connection can't be asked
        ([], None),
        (Exception("permission denied"), None),
    ],
)
def test_get_unqualified_table_schemas_without_statements(
    mocker: MockerFixture,
    search_path: list[str] | Exception,
    expected: tuple[str, ...] | None,
) -> None:
    """
    Without the statements the search path is read when a table first needs it, not
    before, and with that table.
    """
    from superset.utils.rls import get_unqualified_table_schemas, SearchPath

    mocker.patch("superset.utils.rls.is_table_controlled", return_value=True)
    database = MagicMock()
    database.db_engine_spec.supports_dynamic_schema = True
    if isinstance(search_path, Exception):
        database.get_search_path.side_effect = search_path
    else:
        database.get_search_path.return_value = (search_path, {})

    result = get_unqualified_table_schemas(database, "cat", None)

    assert isinstance(result, SearchPath)
    database.get_search_path.assert_not_called()
    assert result.schemas_for(Table("sales")) == expected
    database.get_search_path.assert_called_once_with("cat", ["sales"])


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

    assert path.schemas_for(Table("sales")) == expected
    assert path.schemas_for(Table("sales")) == expected
    database.get_search_path.assert_called_once_with("cat", ["sales"])


def test_search_path_unknown_is_not_looked_up() -> None:
    """
    A search path the connection couldn't report resolves no table, without asking
    again.
    """
    from superset.utils.rls import SearchPath

    database = MagicMock()

    assert SearchPath(database, None, None).schemas_for(Table("sales")) is None
    database.get_search_path.assert_not_called()


def test_search_path_resolves_each_table_once() -> None:
    """
    ``resolve`` looks up, in one round trip, only the tables not looked up yet.
    """
    from superset.utils.rls import SearchPath

    database = MagicMock()
    database.get_search_path.return_value = (["analyst", "public"], {})
    path = SearchPath(database, None, ["analyst", "public"])
    path.record([Table("d")], {})

    path.resolve(Table(name) for name in ["b", "a", "d"])
    path.resolve(Table(name) for name in ["a", "c", "b"])
    path.resolve([Table("c")])

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


def _estimate(
    database: Database,
    sql: str,
    schema: str | None = None,
    catalog: str | None = None,
) -> Any:
    from superset.commands.sql_lab.estimate import QueryEstimationCommand

    command = QueryEstimationCommand(
        {
            "database_id": database.id,
            "sql": sql,
            "template_params": {},
            "catalog": catalog,
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
    denied = database.execute(SQL, options=QueryOptions(dry_run=True))
    assert "Disallowed SQL tables" in (denied.error_message or "")


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

    for path in ("sql_lab", "estimate"):
        assert _denied(path, database, session, mocker, "public.sales")


@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True)
@pytest.mark.parametrize("adhoc", [False, True])
@pytest.mark.parametrize("sql", CTE_ONLY_SQL)
def test_datasource_cte_only_query_not_denied(
    database: Database, session: Session, mocker: MockerFixture, sql: str, adhoc: bool
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

    assert _denied(
        "adhoc" if adhoc else "datasource", database, session, mocker, "public.sales"
    )


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
    assert get_disallowed_tables(database, script, entries, path) == expected
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
    assert get_disallowed_tables(MagicMock(), script, entries, schema) == expected


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
    assert get_disallowed_tables(database, script, entries, search_path) == entries


# The paths that apply RLS to a SQL Lab style query
RLS_PATHS = ["executor", "executor_async", "sql_lab", "sql_lab_celery", "estimate"]


def _rls_sql(
    path: str,
    database: Database,
    session: Session,
    mocker: MockerFixture,
    sql: str = SQL,
    catalog: str | None = None,
    schema: str | None = None,
) -> str:
    """The SQL a query runs as (or is priced as) on ``path``."""
    if path.startswith("executor"):
        mocker.patch.dict(current_app.config, {"SQL_QUERY_MUTATOR": None})
        options = QueryOptions(catalog=catalog, schema=schema, dry_run=True)
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
                schema,
                store_results=path == "sql_lab_celery",
                sql=sql,
                catalog=catalog,
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
        return _estimate(
            database, sql, schema=schema, catalog=catalog
        )._apply_sql_security(sql)


# The paths that check a query against ``DISALLOWED_SQL_TABLES``
DENYLIST_PATHS = ["executor", "sql_lab", "estimate", "datasource", "adhoc"]


def _denied(
    path: str,
    database: Database,
    session: Session,
    mocker: MockerFixture,
    entry: str,
    sql: str = SQL,
    catalog: str | None = None,
    engine: str = "postgresql",
) -> bool:
    """Whether ``path`` denies a query without a schema for the denylist ``entry``."""
    from superset.connectors.sqla.models import SqlaTable
    from superset.exceptions import SupersetDisallowedSQLTableException
    from superset.models.helpers import SqlExpressionContext

    mocker.patch.dict(
        current_app.config, {"SQL_QUERY_MUTATOR": None, **_denylist(entry, engine)}
    )
    if path == "executor":
        result = database.execute(
            sql, options=QueryOptions(catalog=catalog, dry_run=True)
        )
        return "Disallowed SQL tables" in (result.error_message or "")
    if path == "sql_lab":
        with patch("superset.sql_lab.is_feature_enabled", return_value=False):
            executed, payload = _run_sql_lab(
                database,
                session,
                mocker,
                None,
                store_results=False,
                sql=sql,
                catalog=catalog,
            )
        return not executed
    datasource = SqlaTable(
        database=database, catalog=catalog, schema=None, table_name="t"
    )
    try:
        if path == "estimate":
            with patch(
                "superset.commands.sql_lab.estimate.is_feature_enabled",
                return_value=False,
            ):
                _estimate(database, sql, catalog=catalog)._apply_sql_security(sql)
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
@pytest.mark.parametrize("holding_schema", ["analyst", "public"])
def test_adhoc_and_cache_key_shadowed_table_gets_only_its_own_rules(
    shadowed: Database, mocker: MockerFixture, holding_schema: str
) -> None:
    """
    An adhoc sub-query and the RLS cache key, which resolve the search path without
    the statements, also give an unqualified table the rules of the table read.
    """
    from superset.models.helpers import validate_adhoc_subquery
    from superset.utils.rls import collect_rls_predicates_for_sql, get_rls_schema

    _connect(mocker, "analyst", ["analyst", "public"], {"sales": holding_schema})
    own, other = (WEST, CLAUSE) if holding_schema == "analyst" else (CLAUSE, WEST)
    adhoc = validate_adhoc_subquery(f"({SQL})", shadowed, None, "", "postgresql")
    keys = collect_rls_predicates_for_sql(
        SQL,
        shadowed,
        None,
        None,
        resolve_schema=lambda: get_rls_schema(shadowed, None, None, SQL),
    )

    assert own in adhoc
    assert other not in adhoc
    assert any(own in key for key in keys)
    assert not any(other in key for key in keys)


@pytest.mark.parametrize("datasource", ["dataset", "query"])
@pytest.mark.parametrize("holding_schema", ["analyst", "public"])
def test_virtual_dataset_shadowed_table_gets_only_its_own_rules(
    shadowed: Database, mocker: MockerFixture, datasource: str, holding_schema: str
) -> None:
    """
    A virtual dataset's SQL, and a SQL Lab query used as a datasource, give an
    unqualified table the rules of the table read, not those of one it shadows.
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.sql_lab import Query

    _connect(mocker, "analyst", ["analyst", "public"], {"sales": holding_schema})
    own, other = (WEST, CLAUSE) if holding_schema == "analyst" else (CLAUSE, WEST)
    virtual = (
        SqlaTable(table_name="virtual", sql=SQL, schema=None, database=shadowed)
        if datasource == "dataset"
        else Query(client_id="virtual", sql=SQL, schema=None, database=shadowed)
    )

    from_clause, _ = virtual.get_from_clause()
    sql = str(from_clause.compile(compile_kwargs={"literal_binds": True}))

    assert own in sql
    assert other not in sql


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


DROP_SHADOWING = "DROP TABLE analyst.sales; SELECT * FROM sales"


@pytest.mark.parametrize("path", ["executor", "executor_async", "sql_lab"])
def test_rls_script_dropping_shadowing_table_gets_rules_of_every_schema(
    shadowed: Database, session: Session, mocker: MockerFixture, path: str
) -> None:
    """
    A script that drops the table shadowing ``public.sales`` before reading
    ``sales`` reads ``public.sales``, so the read gets its rules too, and not only
    those of the table the search path resolved before the script ran.
    """
    from superset import sql_lab
    from superset.utils.rls import apply_rls

    shadowed.allow_dml = True
    mocker.patch.dict(current_app.config, {"SQL_QUERY_MUTATOR": None})
    if path.startswith("executor"):
        options = QueryOptions(dry_run=True)
        result = (
            shadowed.execute_async(DROP_SHADOWING, options=options).get_result()
            if path == "executor_async"
            else shadowed.execute(DROP_SHADOWING, options=options)
        )
        assert result.error_message is None
        sql = result.statements[1].executed_sql
    else:
        rewritten: list[str] = []

        def record(*args: Any) -> None:
            apply_rls(*args)
            rewritten.append(args[-1].format())

        mocker.patch.object(sql_lab, "apply_rls", side_effect=record)
        with patch(
            "superset.sql_lab.is_feature_enabled",
            side_effect=lambda flag: flag == "RLS_IN_SQLLAB",
        ):
            _run_sql_lab(
                shadowed, session, mocker, None, store_results=False, sql=DROP_SHADOWING
            )
        sql = rewritten[1]

    assert CLAUSE in sql
    assert WEST in sql


@pytest.mark.parametrize("path", ["executor", "sql_lab"])
def test_denylist_script_dropping_shadowing_table(
    shadowed: Database, session: Session, mocker: MockerFixture, path: str
) -> None:
    """
    A schema-qualified denylist entry for a shadowed table matches an unqualified
    read after a statement that can drop the table shadowing it.
    """
    shadowed.allow_dml = True

    assert _denied(path, shadowed, session, mocker, "public.sales", DROP_SHADOWING)


CREATE_SCHEMA = (
    "CREATE SCHEMA analyst; CREATE TABLE analyst.sales (region text); "
    "SELECT * FROM sales"
)


@pytest.fixture
def absent_schema(shadowed: Database, mocker: MockerFixture) -> Database:
    """
    The search path names ``analyst``, which doesn't exist, so ``current_schemas``
    leaves it out and ``sales`` is found in ``public`` only, until a script
    creates ``analyst`` and a ``sales`` in it.
    """
    _connect(mocker, "public", ["public"], {"sales": "public"}, named="analyst, public")
    return shadowed


@pytest.mark.parametrize("path", RLS_PATHS)
def test_rls_script_creating_schema_gets_its_rules(
    absent_schema: Database, session: Session, mocker: MockerFixture, path: str
) -> None:
    """
    A script that creates a schema the search path names, and a table in it,
    before reading the table unqualified reads that table, so the read gets its
    rules too, and not only those of the table the path resolved before.
    """
    from superset import sql_lab
    from superset.utils.rls import apply_rls

    absent_schema.allow_dml = True
    mocker.patch.dict(current_app.config, {"SQL_QUERY_MUTATOR": None})
    if path.startswith("executor"):
        options = QueryOptions(dry_run=True)
        result = (
            absent_schema.execute_async(CREATE_SCHEMA, options=options).get_result()
            if path == "executor_async"
            else absent_schema.execute(CREATE_SCHEMA, options=options)
        )
        assert result.error_message is None
        sql = result.statements[2].executed_sql
    elif path.startswith("sql_lab"):
        rewritten: list[str] = []

        def record(*args: Any) -> None:
            apply_rls(*args)
            rewritten.append(args[-1].format())

        mocker.patch.object(sql_lab, "apply_rls", side_effect=record)
        with patch(
            "superset.sql_lab.is_feature_enabled",
            side_effect=lambda flag: flag == "RLS_IN_SQLLAB",
        ):
            _run_sql_lab(
                absent_schema,
                session,
                mocker,
                None,
                store_results=path == "sql_lab_celery",
                sql=CREATE_SCHEMA,
            )
        sql = rewritten[2]
    else:
        sql = _rls_sql(path, absent_schema, session, mocker, CREATE_SCHEMA)

    assert WEST in sql
    assert CLAUSE in sql


@pytest.mark.parametrize("path", ["executor", "sql_lab", "estimate"])
def test_denylist_script_creating_schema(
    absent_schema: Database, session: Session, mocker: MockerFixture, path: str
) -> None:
    """
    A schema-qualified denylist entry matches an unqualified read of a table in a
    schema the search path names after a statement that can create the schema.
    """
    absent_schema.allow_dml = True

    assert _denied(path, absent_schema, session, mocker, "analyst.sales", CREATE_SCHEMA)


def test_absent_schema_lookup_succeeds(absent_schema: Database) -> None:
    """
    The search path is read, so a rule matches because the schema is on it, not
    because a failed lookup matches the table in any schema.
    """
    from superset.utils.rls import get_unqualified_table_schemas, SearchPath

    search_path = get_unqualified_table_schemas(
        absent_schema, None, None, _statements(CREATE_SCHEMA)
    )

    assert isinstance(search_path, SearchPath)
    assert search_path.schemas_for(Table("sales")) == (
        "pg_catalog",
        "public",
        "analyst",
    )


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
        (SQL, {"sales": "public"}),
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
    the tables it reads, the query still runs. An applicable rule fails closed.
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

    if tables.get("sales") == "public":
        from superset.exceptions import QueryObjectValidationError

        with pytest.raises(QueryObjectValidationError):
            virtual.get_from_clause()
        return

    from_clause, _ = virtual.get_from_clause()

    assert "cannot apply" not in str(from_clause)


# A table no rule, and no entry of the denylist below, is about
UNCONTROLLED_SQL = "SELECT region, amount FROM unrelated"


@pytest.mark.parametrize("path", RLS_PATHS)
def test_rls_search_path_not_read_when_no_rule_could_match(
    database: Database,
    session: Session,
    mocker: MockerFixture,
    path: str,
) -> None:
    """
    No rule is about a table named ``unrelated`` in any schema, so which schema an
    unqualified one is read from doesn't matter: the connection isn't asked
    for its search path, as it wasn't before the search path was taken into account.
    """
    get_search_path = mocker.spy(Database, "get_search_path")

    executed_sql = _rls_sql(path, database, session, mocker, UNCONTROLLED_SQL)

    assert CLAUSE not in executed_sql
    get_search_path.assert_not_called()


@pytest.mark.parametrize("path", RLS_PATHS)
def test_rls_search_path_read_once_when_a_rule_could_match(
    database: Database,
    session: Session,
    mocker: MockerFixture,
    path: str,
) -> None:
    """
    A rule is about ``sales`` in some schema, so the connection is asked which
    schema an unqualified one is read from, once, and the rule applied.
    """
    get_search_path = mocker.spy(Database, "get_search_path")

    assert CLAUSE in _rls_sql(path, database, session, mocker)

    assert get_search_path.call_count == 1


@pytest.mark.parametrize("path", DENYLIST_PATHS)
@pytest.mark.parametrize("entry", ["public.secrets", "Archive.Secrets"])
def test_denylist_search_path_not_read_when_no_entry_could_match(
    database: Database,
    session: Session,
    mocker: MockerFixture,
    path: str,
    entry: str,
) -> None:
    """
    No entry of the denylist names a table called ``unrelated`` in any schema, so
    a query reading one doesn't open the connection to find which schema it's in.
    """
    get_search_path = mocker.spy(Database, "get_search_path")

    assert not _denied(path, database, session, mocker, entry, UNCONTROLLED_SQL)

    get_search_path.assert_not_called()


@pytest.mark.parametrize("path", DENYLIST_PATHS)
def test_denylist_search_path_read_when_an_entry_could_match(
    database: Database,
    session: Session,
    mocker: MockerFixture,
    path: str,
) -> None:
    """
    An entry names ``sales`` in some schema, so the connection is asked which
    schema an unqualified one is read from, and the entry matches it.
    """
    get_search_path = mocker.spy(Database, "get_search_path")

    assert _denied(path, database, session, mocker, "public.sales")

    assert get_search_path.call_count >= 1


def test_virtual_dataset_search_path_not_read_when_no_rule_could_match(
    database: Database, mocker: MockerFixture
) -> None:
    """
    A virtual dataset without a schema reads no search path for tables no rule is
    about, for its cache key or its query.
    """
    from superset.connectors.sqla.models import SqlaTable

    get_search_path = mocker.spy(Database, "get_search_path")
    connect = Database.get_raw_connection
    virtual = SqlaTable(
        table_name="virtual", sql=UNCONTROLLED_SQL, schema=None, database=database
    )

    assert virtual.get_inner_rls_cache_key() == []
    virtual.get_from_clause()

    get_search_path.assert_not_called()
    connect.assert_not_called()  # type: ignore[attr-defined]


def test_virtual_dataset_cache_key_and_query_read_search_path_once(
    user_schema_first: Database, mocker: MockerFixture
) -> None:
    """
    A virtual dataset's RLS cache key and its query look an unqualified table up on
    the search path once between them, and agree on the rule that applies.
    """
    from superset.connectors.sqla.models import SqlaTable

    get_search_path = mocker.spy(Database, "get_search_path")
    virtual = SqlaTable(
        table_name="virtual", sql=SQL, schema=None, database=user_schema_first
    )

    keys = virtual.get_inner_rls_cache_key()
    from_clause, _ = virtual.get_from_clause()

    assert any(CLAUSE in key for key in keys)
    assert CLAUSE in str(from_clause)
    assert get_search_path.call_count == 1


def test_virtual_dataset_search_path_discovery_failure_fails_closed(
    discovery_denied: Database,
) -> None:
    """
    A virtual dataset whose search path can't be read still gets the rules of its
    tables in any schema, in its cache key and its query.
    """
    from superset.connectors.sqla.models import SqlaTable

    virtual = SqlaTable(
        table_name="virtual", sql=SQL, schema=None, database=discovery_denied
    )

    keys = virtual.get_inner_rls_cache_key()
    from_clause, _ = virtual.get_from_clause()

    assert any(CLAUSE in key for key in keys)
    assert CLAUSE in str(from_clause)


def _oauth2_redirect() -> Exception:
    from superset.exceptions import OAuth2RedirectError

    return OAuth2RedirectError("https://idp/auth", "tab", "https://superset/oauth2")


@pytest.fixture
def needs_oauth2(database: Database, mocker: MockerFixture) -> Database:
    """A connection that asks the user to sign in before it answers anything."""
    _connect(mocker, "public", SEARCH_PATH, error=_oauth2_redirect())
    return database


@pytest.mark.parametrize("path", ["executor", "executor_async", "estimate"])
def test_rls_search_path_oauth2_redirect_propagates(
    needs_oauth2: Database,
    session: Session,
    mocker: MockerFixture,
    path: str,
) -> None:
    """
    A connection that needs the user to sign in prompts them to, rather than the
    lookup falling back to matching a table in every schema.
    """
    from superset.exceptions import OAuth2RedirectError

    with pytest.raises(OAuth2RedirectError):
        _rls_sql(path, needs_oauth2, session, mocker)


@pytest.mark.parametrize("store_results", [False, True])
def test_sql_lab_rls_search_path_oauth2_redirect_prompts_sign_in(
    needs_oauth2: Database,
    session: Session,
    mocker: MockerFixture,
    store_results: bool,
) -> None:
    """
    SQL Lab reports the redirect to sign in, and doesn't run the query.
    """
    from superset.errors import SupersetErrorType

    with patch(
        "superset.sql_lab.is_feature_enabled",
        side_effect=lambda flag: flag == "RLS_IN_SQLLAB",
    ):
        executed, payload = _run_sql_lab(
            needs_oauth2, session, mocker, None, store_results=store_results
        )

    assert executed == []
    assert payload is not None
    assert payload["errors"][0]["error_type"] == SupersetErrorType.OAUTH2_REDIRECT


def test_denylist_search_path_oauth2_redirect_propagates(
    needs_oauth2: Database, session: Session, mocker: MockerFixture
) -> None:
    """
    The denylist check prompts the user to sign in too.
    """
    from superset.exceptions import OAuth2RedirectError

    with pytest.raises(OAuth2RedirectError):
        _denied("datasource", needs_oauth2, session, mocker, "public.sales")


def test_virtual_dataset_oauth2_redirect_propagates(needs_oauth2: Database) -> None:
    """
    A virtual dataset's query and RLS cache key prompt the user to sign in, rather
    than the redirect being reported as RLS that could not be applied, or keyed on
    a per-viewer marker.
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.exceptions import OAuth2RedirectError

    virtual = SqlaTable(
        table_name="virtual", sql=SQL, schema=None, database=needs_oauth2
    )

    with pytest.raises(OAuth2RedirectError):
        virtual.get_inner_rls_cache_key()
    with pytest.raises(OAuth2RedirectError):
        virtual.get_from_clause()


def test_search_path_oauth2_errors_propagate(mocker: MockerFixture) -> None:
    """
    Both errors that ask the user to sign in propagate out of the lookup, while any
    other failure leaves the schema unknown.
    """
    from superset.exceptions import OAuth2Error
    from superset.utils.rls import get_unqualified_table_schemas, SearchPath

    mocker.patch("superset.utils.rls.is_table_controlled", return_value=True)
    database = MagicMock()
    database.db_engine_spec.supports_dynamic_schema = True
    statements = _statements(SQL)

    for error in (_oauth2_redirect(), OAuth2Error("denied")):
        database.get_search_path.side_effect = error
        with pytest.raises(type(error)):
            get_unqualified_table_schemas(database, None, None, statements)
        with pytest.raises(type(error)):
            SearchPath.deferred(database, None).schemas_for(Table("sales"))
        with pytest.raises(type(error)):
            SearchPath(database, None, ["a", "b"]).schemas_for(Table("sales"))

    database.get_search_path.side_effect = ValueError("permission denied")
    failed = get_unqualified_table_schemas(database, None, None, statements)
    assert isinstance(failed, SearchPath)
    assert failed.schemas is None
    assert SearchPath.deferred(database, None).schemas_for(Table("sales")) is None


@pytest.mark.parametrize(
    "entry, name, controlled",
    [
        # an entry naming the table in some schema, whatever its case
        ("public.secrets", "secrets", True),
        ("Public.Secrets", "SECRETS", True),
        ("db.public.secrets", "secrets", True),
        # not one for another table, nor a bare one, which needs no schema
        ("public.secrets", "sales_secrets", False),
        ("secrets", "secrets", False),
    ],
)
def test_is_table_controlled_by_denylist(
    database: Database, mocker: MockerFixture, entry: str, name: str, controlled: bool
) -> None:
    """
    Only a schema-qualified denylist entry makes the schema an unqualified table
    is read from matter.
    """
    from superset.utils.rls import is_table_controlled

    mocker.patch.dict(current_app.config, _denylist(entry))

    assert is_table_controlled(database, None, Table(name)) is controlled


def test_is_table_controlled_by_rls(database: Database) -> None:
    """
    A table is controlled when a dataset of its name, in any schema, has a rule;
    Postgres folds the case of a name, so a dataset registered in lower case does.
    """
    from superset.utils.rls import is_table_controlled

    assert is_table_controlled(database, None, Table("sales"))
    assert is_table_controlled(database, None, Table("Sales"))
    assert is_table_controlled(database, None, Table("unrelated")) is False


def test_is_table_controlled_when_rules_cannot_be_read(
    database: Database, mocker: MockerFixture
) -> None:
    """
    When the rules of a table can't be looked up, one is assumed to match.
    """
    from superset.utils.rls import is_table_controlled

    mocker.patch(
        "superset.utils.rls.get_predicates_for_table", side_effect=ValueError("boom")
    )
    rollback = mocker.patch("superset.utils.rls.db.session.rollback")

    assert is_table_controlled(database, None, Table("unrelated"))
    rollback.assert_called_once()


def test_search_path_skips_uncontrolled_tables(mocker: MockerFixture) -> None:
    """
    ``resolve`` looks up only the tables a control may match; the others are
    unknown, which a control that can't match them in any schema ignores.
    """
    from superset.utils.rls import SearchPath

    mocker.patch(
        "superset.utils.rls.is_table_controlled",
        side_effect=lambda database, catalog, table: table.table == "sales",
    )
    database = MagicMock()
    database.get_search_path.return_value = (["analyst", "public"], {})
    path = SearchPath.deferred(database, "cat")

    assert path.schemas_for(Table("other")) is None
    database.get_search_path.assert_not_called()
    assert path.schemas_for(Table("sales")) == ("analyst", "public")
    database.get_search_path.assert_called_once_with("cat", ["sales"])
    assert path.schemas_for(Table("other")) is None
    assert path.schemas_for(Table("sales")) == ("analyst", "public")
    database.get_search_path.assert_called_once()


def test_get_unqualified_table_schemas_skips_uncontrolled_tables(
    mocker: MockerFixture,
) -> None:
    """
    A query reading only tables no control may match needs no search path, and so
    no connection, on any dynamic-schema engine; the others are looked up with it.
    """
    from superset.utils.rls import get_unqualified_table_schemas, SearchPath

    mocker.patch(
        "superset.utils.rls.is_table_controlled",
        side_effect=lambda database, catalog, table: table.table == "sales",
    )
    database = MagicMock()
    database.db_engine_spec.supports_dynamic_schema = True
    database.get_search_path.return_value = (["analyst", "public"], {})

    assert (
        get_unqualified_table_schemas(
            database, None, None, _statements("SELECT * FROM a JOIN b ON 1 = 1")
        )
        == ""
    )
    database.get_search_path.assert_not_called()
    database.get_inspector.assert_not_called()
    database.get_raw_connection.assert_not_called()

    result = get_unqualified_table_schemas(
        database, None, None, _statements("SELECT * FROM a JOIN sales ON 1 = 1")
    )

    assert isinstance(result, SearchPath)
    database.get_search_path.assert_called_once_with(None, ["sales"])


# A Snowflake reference naming a database (catalog) but no schema: it always reads
# the ``PUBLIC`` schema of that database, whatever schema the connection is in
OTHER_CATALOG_SQL = "SELECT region, amount FROM OTHERDB..SALES"


@pytest.fixture(params=["ANALYTICS", "PUBLIC"])
def cross_catalog(
    session: Session, mocker: MockerFixture, request: pytest.FixtureRequest
) -> Iterator[Database]:
    """
    A Snowflake database queried in its ``MAIN`` catalog, whose only RLS rule is on
    the ``OTHERDB.PUBLIC.SALES`` dataset.

    The connection's default schema in ``MAIN`` is ``ANALYTICS``, which is not the
    schema ``OTHERDB..SALES`` reads, and ``PUBLIC``, which happens to be.
    """
    default_schema: str = request.param
    from superset.connectors.sqla.models import SqlaTable

    SqlaTable.metadata.create_all(session.get_bind())

    database = Database(
        id=2,
        database_name="snow",
        sqlalchemy_uri=f"snowflake://user:pass@account/MAIN/{default_schema}",
    )
    dataset = SqlaTable(
        table_name="SALES", catalog="OTHERDB", schema="PUBLIC", database=database
    )
    user = _rls_user(session, mocker, dataset)

    # the Snowflake SQLAlchemy dialect isn't installed with Superset's own requirements
    mocker.patch.object(Database, "get_dialect", return_value=postgresql.dialect())
    _connect(mocker, default_schema, [default_schema])
    with override_user(user):
        yield database


@pytest.mark.parametrize("path", RLS_PATHS)
def test_rls_table_naming_a_catalog_but_no_schema(
    cross_catalog: Database,
    session: Session,
    mocker: MockerFixture,
    path: str,
) -> None:
    """
    ``OTHERDB..SALES`` names the table in another catalog than the query's and
    reads the ``PUBLIC`` schema of that catalog, not the schema the query's own
    catalog defaults to. The rule on ``OTHERDB.PUBLIC.SALES`` is about it, so it
    applies, although the query's own catalog has no such rule.
    """
    executed_sql = _rls_sql(
        path, cross_catalog, session, mocker, OTHER_CATALOG_SQL, catalog="MAIN"
    )

    assert CLAUSE in executed_sql


@pytest.mark.parametrize("path", RLS_PATHS)
@pytest.mark.parametrize(
    "sql",
    [
        # no rule is about a table of this name, in any catalog
        "SELECT region, amount FROM unrelated",
        "SELECT region, amount FROM OTHERDB..UNRELATED",
        # the rule is about the table in another catalog than the one it's read from
        "SELECT region, amount FROM SALES",
        "SELECT region, amount FROM THIRDDB..SALES",
    ],
)
def test_rls_search_path_not_read_for_tables_no_rule_is_about(
    cross_catalog: Database,
    session: Session,
    mocker: MockerFixture,
    path: str,
    sql: str,
) -> None:
    """
    A table is only looked up on the search path when a rule is about it in the
    catalog it's read from: its own, or the query's when it names none.
    """
    get_search_path = mocker.spy(Database, "get_search_path")

    executed_sql = _rls_sql(path, cross_catalog, session, mocker, sql, catalog="MAIN")

    assert CLAUSE not in executed_sql
    get_search_path.assert_not_called()


@pytest.mark.parametrize("path", ["executor", "sql_lab", "estimate", "datasource"])
def test_denylist_table_naming_a_catalog_but_no_schema(
    cross_catalog: Database,
    session: Session,
    mocker: MockerFixture,
    path: str,
) -> None:
    """
    A schema-qualified entry matches ``OTHERDB..SALES``, which reads the table from
    the ``PUBLIC`` schema of ``OTHERDB``, whatever the query's own default schema.
    """
    assert _denied(
        path,
        cross_catalog,
        session,
        mocker,
        "PUBLIC.SALES",
        OTHER_CATALOG_SQL,
        catalog="MAIN",
        engine="snowflake",
    )


@pytest.mark.parametrize("path", ["executor", "sql_lab", "estimate", "datasource"])
@pytest.mark.parametrize(
    "entry", ["ANALYTICS.SALES", "MAIN.ANALYTICS.SALES", "X.SALES"]
)
def test_denylist_table_naming_a_catalog_not_matched_in_the_query_schema(
    cross_catalog: Database,
    session: Session,
    mocker: MockerFixture,
    path: str,
    entry: str,
) -> None:
    """
    An entry for another schema does not match ``OTHERDB..SALES``, which reads
    ``PUBLIC``, not the schema the query's own catalog defaults to.
    """
    assert not _denied(
        path,
        cross_catalog,
        session,
        mocker,
        entry,
        OTHER_CATALOG_SQL,
        catalog="MAIN",
        engine="snowflake",
    )

    assert _denied(
        path,
        cross_catalog,
        session,
        mocker,
        "PUBLIC.SALES",
        OTHER_CATALOG_SQL,
        catalog="MAIN",
        engine="snowflake",
    )


@pytest.mark.parametrize("path", ["executor", "sql_lab", "estimate", "datasource"])
def test_denylist_three_part_entry_matches_table_naming_a_catalog(
    cross_catalog: Database,
    session: Session,
    mocker: MockerFixture,
    path: str,
) -> None:
    """
    An entry naming the catalog and the schema matches ``OTHERDB..SALES``, which
    reads ``OTHERDB.PUBLIC.SALES``.
    """
    assert _denied(
        path,
        cross_catalog,
        session,
        mocker,
        "OTHERDB.PUBLIC.SALES",
        OTHER_CATALOG_SQL,
        catalog="MAIN",
        engine="snowflake",
    )


@pytest.mark.parametrize("path", RLS_PATHS)
def test_rls_table_naming_a_catalog_of_unknown_schema(
    cross_catalog: Database,
    session: Session,
    mocker: MockerFixture,
    path: str,
) -> None:
    """
    When the engine doesn't say which schema a catalog gives a table, the rule on
    the table in that catalog applies whatever the schema, as the table may be read
    from it, rather than being looked up in the query's default schema.
    """
    from superset.db_engine_specs.snowflake import SnowflakeEngineSpec

    mocker.patch.object(
        SnowflakeEngineSpec, "get_catalog_reference_schema", return_value=None
    )

    executed_sql = _rls_sql(
        path, cross_catalog, session, mocker, OTHER_CATALOG_SQL, catalog="MAIN"
    )

    assert CLAUSE in executed_sql


@pytest.mark.parametrize("path", ["executor", "sql_lab", "estimate", "datasource"])
def test_denylist_table_naming_a_catalog_of_unknown_schema(
    cross_catalog: Database,
    session: Session,
    mocker: MockerFixture,
    path: str,
) -> None:
    """
    When the engine doesn't say which schema a catalog gives a table, a
    schema-qualified entry matches it by name, whatever the schema.
    """
    from superset.db_engine_specs.snowflake import SnowflakeEngineSpec

    mocker.patch.object(
        SnowflakeEngineSpec, "get_catalog_reference_schema", return_value=None
    )

    assert _denied(
        path,
        cross_catalog,
        session,
        mocker,
        "ANALYTICS.SALES",
        OTHER_CATALOG_SQL,
        catalog="MAIN",
        engine="snowflake",
    )


@pytest.mark.parametrize("is_async", [False, True])
def test_executor_rls_table_naming_a_catalog_ignores_the_query_schema(
    cross_catalog: Database, mocker: MockerFixture, is_async: bool
) -> None:
    """
    ``OTHERDB..SALES`` reads ``OTHERDB.PUBLIC.SALES`` even when the query selects
    another schema: the schema of a query applies to the tables in its own catalog.
    """
    mocker.patch.dict(current_app.config, {"SQL_QUERY_MUTATOR": None})
    options = QueryOptions(catalog="MAIN", schema="ANALYTICS", dry_run=True)

    if is_async:
        result = cross_catalog.execute_async(
            OTHER_CATALOG_SQL, options=options
        ).get_result()
    else:
        result = cross_catalog.execute(OTHER_CATALOG_SQL, options=options)

    assert result.error_message is None
    assert CLAUSE in result.statements[0].executed_sql


def test_is_table_controlled_uses_the_catalog_the_table_names(
    cross_catalog: Database,
) -> None:
    """
    A rule is looked up in the catalog the reference names, and in the query's
    when it names none, as ``Table.qualify`` resolves it when the rule is applied.
    """
    from superset.utils.rls import is_table_controlled

    assert is_table_controlled(cross_catalog, "MAIN", Table("SALES", catalog="OTHERDB"))
    assert is_table_controlled(cross_catalog, None, Table("SALES", catalog="OTHERDB"))
    assert is_table_controlled(cross_catalog, "OTHERDB", Table("SALES"))
    assert not is_table_controlled(cross_catalog, "MAIN", Table("SALES"))
    assert not is_table_controlled(cross_catalog, None, Table("SALES"))
    assert not is_table_controlled(
        cross_catalog, "OTHERDB", Table("SALES", catalog="THIRDDB")
    )


def test_is_table_controlled_when_the_rules_of_a_catalog_cannot_be_read(
    cross_catalog: Database, mocker: MockerFixture
) -> None:
    """
    When a table naming a catalog can't be looked up in it, a rule is assumed to
    match, rather than the table being skipped.
    """
    from superset.utils.rls import is_table_controlled

    mocker.patch(
        "superset.utils.rls.get_predicates_for_table", side_effect=ValueError("boom")
    )

    assert is_table_controlled(cross_catalog, "MAIN", Table("UNRELATED", catalog="X"))


def test_search_path_resolves_a_table_naming_a_catalog_without_a_lookup(
    cross_catalog: Database, mocker: MockerFixture
) -> None:
    """
    A table naming a catalog but no schema isn't read through the search path of
    the catalog the query runs in: it's resolved to the ``PUBLIC`` schema of the
    catalog it names without connecting, while the same name naming no catalog is
    looked up on the path.
    """
    from superset.utils.rls import SearchPath

    get_search_path = mocker.spy(Database, "get_search_path")
    path = SearchPath.deferred(cross_catalog, "MAIN")

    assert path.schemas_for(Table("SALES", catalog="OTHERDB")) == ("PUBLIC",)
    assert path.schemas_for(Table("SALES", catalog="THIRDDB")) == ("PUBLIC",)
    get_search_path.assert_not_called()
    # nothing is about ``SALES`` in ``MAIN``, so it isn't looked up either
    assert path.schemas_for(Table("SALES")) is None
    get_search_path.assert_not_called()


def test_search_path_table_naming_a_catalog_of_unknown_schema(
    cross_catalog: Database, mocker: MockerFixture
) -> None:
    """
    When the engine doesn't say which schema a catalog gives a table, it's read
    from an unknown schema, rather than the one the query's catalog defaults to.
    """
    from superset.db_engine_specs.snowflake import SnowflakeEngineSpec
    from superset.utils.rls import SearchPath

    mocker.patch.object(
        SnowflakeEngineSpec, "get_catalog_reference_schema", return_value=None
    )
    path = SearchPath.deferred(cross_catalog, "MAIN")

    assert path.schemas_for(Table("SALES", catalog="OTHERDB")) is None


def test_get_unqualified_table_schemas_skips_tables_naming_a_catalog(
    cross_catalog: Database, mocker: MockerFixture
) -> None:
    """
    A table naming a catalog is not read through the search path of the catalog the
    query runs in, so it doesn't make the query read it, even with a rule about it,
    and the schema returned for the other tables is the one the query's catalog
    defaults to.
    """
    from superset.utils.rls import get_unqualified_table_schemas

    get_search_path = mocker.spy(Database, "get_search_path")
    named = _statements("SELECT * FROM OTHERDB..SALES")
    unnamed = _statements("SELECT * FROM SALES")

    assert get_unqualified_table_schemas(cross_catalog, "MAIN", None, named) == ""
    assert get_unqualified_table_schemas(cross_catalog, "MAIN", None, unnamed) == ""
    get_search_path.assert_not_called()


def test_qualify_table_table_naming_a_catalog(cross_catalog: Database) -> None:
    """
    A table naming a catalog but no schema is qualified with the schema its catalog
    gives it, whatever the schema or search path of the query's catalog. It's the
    catalog it names that decides, as it does for ``Table.qualify``.
    """
    from superset.utils.rls import qualify_table, SearchPath

    named = Table("SALES", catalog="OTHERDB")
    other = Table("SALES", catalog="OTHERDB", schema="PUBLIC")
    unnamed = Table("SALES")
    path = SearchPath.deferred(cross_catalog, "MAIN")

    for schema in ("ANALYTICS", "", path):
        assert qualify_table(cross_catalog, named, "MAIN", schema) == [
            (Table("SALES", catalog="OTHERDB", schema="PUBLIC"), False)
        ]
        assert qualify_table(cross_catalog, other, "MAIN", schema) == [
            (Table("SALES", catalog="OTHERDB", schema="PUBLIC"), False)
        ]
    assert qualify_table(cross_catalog, unnamed, "MAIN", "ANALYTICS") == [
        (Table("SALES", catalog="MAIN", schema="ANALYTICS"), False)
    ]
    # nothing is about ``SALES`` in ``MAIN``: any schema, without a lookup
    assert qualify_table(cross_catalog, unnamed, "MAIN", path) == [
        (Table("SALES", catalog="MAIN"), True)
    ]


def test_qualify_table_table_naming_a_catalog_of_unknown_schema(
    cross_catalog: Database, mocker: MockerFixture
) -> None:
    """
    A table naming a catalog whose schema isn't known stands for a table of its name
    in any schema of that catalog, not for one in the query's default schema.
    """
    from superset.db_engine_specs.snowflake import SnowflakeEngineSpec
    from superset.utils.rls import qualify_table, SearchPath

    mocker.patch.object(
        SnowflakeEngineSpec, "get_catalog_reference_schema", return_value=None
    )
    named = Table("SALES", catalog="OTHERDB")
    path = SearchPath.deferred(cross_catalog, "MAIN")

    for schema in ("ANALYTICS", path):
        assert qualify_table(cross_catalog, named, "MAIN", schema) == [
            (Table("SALES", catalog="OTHERDB"), True)
        ]


def test_cache_key_of_a_search_path_with_one_schema_matches_the_explicit_schema(
    database: Database, mocker: MockerFixture
) -> None:
    """
    A search path with a single schema reads every unqualified table from it, so
    the rules the cache key carries are keyed under that schema, as they are for a
    query that names it, not under no schema, which is how a table read through
    several is keyed.
    """
    from superset.utils.rls import collect_rls_predicates_for_sql, SearchPath

    mocker.patch.object(
        Database, "get_search_path", return_value=(["public"], {"sales": ["public"]})
    )

    through_path = collect_rls_predicates_for_sql(
        SQL,
        database,
        None,
        None,
        resolve_schema=lambda: SearchPath.deferred(database, None),
    )
    explicit = collect_rls_predicates_for_sql(SQL, database, None, "public")

    assert through_path == explicit
    assert [json.loads(key)[2:4] for key in explicit] == [["public", "sales"]]


@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True)
def test_adhoc_and_cache_key_rls_table_naming_a_catalog_but_no_schema(
    cross_catalog: Database,
) -> None:
    """
    The datasource paths that resolve the RLS schema with ``get_rls_schema`` -- an
    adhoc sub-query and the RLS cache key -- apply the rule on
    ``OTHERDB.PUBLIC.SALES`` to ``OTHERDB..SALES``.
    """
    from superset.models.helpers import validate_adhoc_subquery
    from superset.utils.rls import collect_rls_predicates_for_sql, get_rls_schema

    assert CLAUSE in validate_adhoc_subquery(
        f"({OTHER_CATALOG_SQL})", cross_catalog, "MAIN", "", "snowflake"
    )
    keys = collect_rls_predicates_for_sql(
        OTHER_CATALOG_SQL,
        cross_catalog,
        "MAIN",
        None,
        resolve_schema=lambda: get_rls_schema(
            cross_catalog, "MAIN", None, OTHER_CATALOG_SQL
        ),
    )
    # the rule is keyed under the table the query reads, in the schema its catalog
    # gives it, whatever schema the query's own catalog defaults to
    assert [json.loads(key)[1:] for key in keys] == [
        ["OTHERDB", "PUBLIC", "SALES", f"({CLAUSE})"]
    ]


@pytest.mark.parametrize("datasource", ["dataset", "query"])
def test_virtual_dataset_rls_table_naming_a_catalog_but_no_schema(
    cross_catalog: Database, datasource: str
) -> None:
    """
    A virtual dataset's SQL, and a SQL Lab query used as a datasource, get the rule
    on ``OTHERDB.PUBLIC.SALES`` for ``OTHERDB..SALES``.
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.sql_lab import Query

    virtual = (
        SqlaTable(
            table_name="virtual",
            sql=OTHER_CATALOG_SQL,
            catalog="MAIN",
            schema=None,
            database=cross_catalog,
        )
        if datasource == "dataset"
        else Query(
            client_id="virtual",
            sql=OTHER_CATALOG_SQL,
            catalog="MAIN",
            schema=None,
            database=cross_catalog,
        )
    )

    from_clause, _ = virtual.get_from_clause()

    assert CLAUSE in str(from_clause.compile(compile_kwargs={"literal_binds": True}))


# Two statements reading ``OTHERDB.PUBLIC.SALES`` once and ``OTHERDB.ANALYTICS.SALES``
# not at all, whichever way they name the tables. The rule is on the first.
SAME_NAME_SQL = {
    "catalog_and_schema": (
        "SELECT region FROM OTHERDB..SALES UNION ALL "
        "SELECT region FROM OTHERDB.ANALYTICS.SALES"
    ),
    "catalog_and_unqualified": (
        "SELECT region FROM OTHERDB..SALES UNION ALL SELECT region FROM SALES"
    ),
}


def _apply_rls_in_order(
    database: Database, sql: str, schema: Any, *, reverse: bool
) -> str:
    """
    The statement after ``apply_rls``, with its tables visited in a fixed order.

    The order of ``statement.tables`` (a set) varies with the process's hash seed,
    so a result that depends on it differs between workers; visiting the tables in
    each order pins both outcomes.
    """
    from superset.sql.parse import SQLScript
    from superset.utils.rls import apply_rls

    statement = SQLScript(sql, engine="snowflake").statements[0]
    statement.tables = sorted(statement.tables, key=str, reverse=reverse)  # type: ignore[assignment]
    apply_rls(database, "OTHERDB", schema, statement)
    return statement.format()


@pytest.mark.parametrize("reverse", [False, True])
@pytest.mark.parametrize("sql_name", list(SAME_NAME_SQL))
def test_rls_tables_of_one_name_in_two_schemas_keep_their_own_rules(
    cross_catalog: Database, sql_name: str, reverse: bool
) -> None:
    """
    ``OTHERDB..SALES`` reads ``OTHERDB.PUBLIC.SALES``, which the rule is on, and
    ``OTHERDB.ANALYTICS.SALES`` (or a ``SALES`` the query's schema puts there)
    is another table, which has none. Keying the rules by the query's schema made
    both the same key, so the rule was dropped or doubled depending on the order
    the tables were visited in.
    """
    result = _apply_rls_in_order(
        cross_catalog, SAME_NAME_SQL[sql_name], "ANALYTICS", reverse=reverse
    )

    assert result.count(CLAUSE) == 1


@pytest.mark.parametrize("reverse", [False, True])
def test_rls_tables_of_one_name_in_two_schemas_through_a_search_path(
    cross_catalog: Database, mocker: MockerFixture, reverse: bool
) -> None:
    """
    The same holds when the unqualified ``SALES`` is read through a search path of
    one schema, which keys it under that schema.
    """
    from superset.utils.rls import SearchPath

    _connect(mocker, "ANALYTICS", ["ANALYTICS"])
    result = _apply_rls_in_order(
        cross_catalog,
        SAME_NAME_SQL["catalog_and_unqualified"],
        SearchPath.deferred(cross_catalog, "OTHERDB"),
        reverse=reverse,
    )

    assert result.count(CLAUSE) == 1


# ``MAIN`` is the catalog the connection is in; the rule and the denylist entry are
# about ``SALES`` in the ``sales_s`` schema of ``OTHERDB``
MSSQL_CATALOG_SQL = "SELECT region, amount FROM OTHERDB..SALES"


@pytest.fixture(params=["mssql", "trino"])
def other_engine_catalog(
    session: Session, mocker: MockerFixture, request: pytest.FixtureRequest
) -> Iterator[Database]:
    """
    A database on an engine with catalogs that doesn't say which schema a
    ``catalog..table`` reference reads (SQL Server's ``db..t`` reads the login's
    default schema there; Trino has no such syntax, but parses it the same way), with
    a rule on ``OTHERDB.sales_s.SALES``.
    """
    engine: str = request.param
    from superset.connectors.sqla.models import SqlaTable

    SqlaTable.metadata.create_all(session.get_bind())

    database = Database(
        id=3,
        database_name=engine,
        sqlalchemy_uri=f"{engine}://user:pass@host:1234/MAIN",
    )
    dataset = SqlaTable(
        table_name="SALES", catalog="OTHERDB", schema="sales_s", database=database
    )
    user = _rls_user(session, mocker, dataset)

    mocker.patch.object(Database, "get_dialect", return_value=postgresql.dialect())
    _connect(mocker, "dbo", ["dbo"])
    with override_user(user):
        yield database


@pytest.mark.parametrize("path", RLS_PATHS)
@pytest.mark.parametrize(
    "sql, applied",
    [
        # the table may be in the schema the rule is on, so the rule applies: an
        # extra rule when it's in another, never a missing one
        (MSSQL_CATALOG_SQL, True),
        # a table of the same name in another catalog is not about it
        ("SELECT region, amount FROM THIRDDB..SALES", False),
    ],
)
def test_rls_table_naming_a_catalog_of_unknown_schema_other_engines(
    other_engine_catalog: Database,
    session: Session,
    mocker: MockerFixture,
    path: str,
    sql: str,
    applied: bool,
) -> None:
    """
    The engine doesn't say which schema ``OTHERDB..SALES`` is read from, so the rule
    on the table in any schema of ``OTHERDB`` applies to it.
    """
    executed_sql = _rls_sql(
        path, other_engine_catalog, session, mocker, sql, catalog="MAIN"
    )

    assert (CLAUSE in executed_sql) is applied


@pytest.mark.parametrize("path", ["executor", "sql_lab", "estimate", "datasource"])
@pytest.mark.parametrize(
    "entry, blocked",
    [
        # matched by name whatever the schema: an extra denial, never a missed one
        ("sales_s.SALES", True),
        ("other_schema.SALES", True),
        ("sales_s.OTHER", False),
    ],
)
def test_denylist_table_naming_a_catalog_of_unknown_schema_other_engines(
    other_engine_catalog: Database,
    session: Session,
    mocker: MockerFixture,
    path: str,
    entry: str,
    blocked: bool,
) -> None:
    """
    A schema-qualified denylist entry matches ``OTHERDB..SALES`` by name when the
    engine doesn't say its schema. An entry for another table doesn't.
    """
    assert (
        _denied(
            path,
            other_engine_catalog,
            session,
            mocker,
            entry,
            MSSQL_CATALOG_SQL,
            catalog="MAIN",
            engine=other_engine_catalog.db_engine_spec.engine,
        )
        is blocked
    )


@pytest.mark.parametrize("path", RLS_PATHS)
@pytest.mark.parametrize("sql_name", list(SAME_NAME_SQL))
@pytest.mark.parametrize("schema", [None, "ANALYTICS"])
def test_rls_tables_of_one_name_in_two_schemas_end_to_end(
    cross_catalog: Database,
    session: Session,
    mocker: MockerFixture,
    path: str,
    sql_name: str,
    schema: str | None,
) -> None:
    """
    In a query running in ``OTHERDB``, the rule on ``OTHERDB.PUBLIC.SALES`` applies
    once to ``OTHERDB..SALES``, and to another table of the name only if it's that
    table: ``OTHERDB.ANALYTICS.SALES`` isn't, and an unqualified ``SALES`` is when
    the connection's default schema is ``PUBLIC``. The result doesn't depend on the
    order the statement's tables are visited in (the hash seed of the process).
    """
    expected = (
        2
        if sql_name == "catalog_and_unqualified"
        and schema is None
        and ("/PUBLIC" in cross_catalog.sqlalchemy_uri)
        else 1
    )

    executed_sql = _rls_sql(
        path,
        cross_catalog,
        session,
        mocker,
        SAME_NAME_SQL[sql_name],
        catalog="OTHERDB",
        schema=schema,
    )

    protected, other = executed_sql.split("UNION ALL")
    assert protected.count(CLAUSE) == 1
    assert other.count(CLAUSE) == expected - 1


def test_unknown_catalog_schema_and_search_path_share_all_applicable_rules(
    other_engine_catalog: Database,
) -> None:
    """An unknown catalog schema cannot lose rules to a resolved bare reference."""
    from superset.sql.parse import SQLScript
    from superset.utils.rls import apply_rls, SearchPath

    # Both references have an unresolved key schema, but only the catalog-only
    # reference may read sales_s.SALES. Its rule must survive the shared key.
    schema = SearchPath(other_engine_catalog, "OTHERDB", ["dbo", "sales_s"])
    schema.record([Table("SALES")], {"SALES": ["dbo"]})
    statement = SQLScript(
        "SELECT region FROM OTHERDB..SALES UNION ALL SELECT region FROM SALES",
        engine=other_engine_catalog.db_engine_spec.engine,
    ).statements[0]

    apply_rls(other_engine_catalog, "OTHERDB", schema, statement)

    protected, other = statement.format().split("UNION ALL")
    assert protected.count(CLAUSE) == 1
    assert other.count(CLAUSE) == 1


@pytest.mark.parametrize("method", ["AS_SUBQUERY", "AS_PREDICATE"])
def test_catalog_schema_reaches_uncorrelated_subquery_transformer(
    mocker: MockerFixture, method: str
) -> None:
    """Excluded dataset rules still filter catalog-only subquery reads."""
    from superset.db_engine_specs.snowflake import SnowflakeEngineSpec
    from superset.sql.parse import RLSMethod, SQLStatement
    from superset.utils import rls

    database = MagicMock(db_engine_spec=SnowflakeEngineSpec)
    database.get_default_catalog.return_value = "MAINDB"
    mocker.patch.object(
        SnowflakeEngineSpec, "get_rls_method", return_value=RLSMethod[method]
    )
    mocker.patch.object(rls, "_dataset_has_rls", return_value=True)

    def rules(table: Table, *args: Any, **kwargs: Any) -> list[str]:
        """Only the unexcluded lookup returns the protected table's rule."""
        if table == Table("SALES", "PUBLIC", "OTHERDB"):
            return [CLAUSE] if kwargs.get("exclude_dataset_id") is None else []
        return []

    lookup = mocker.patch.object(rls, "get_predicates_for_table", side_effect=rules)
    statement = SQLStatement(
        "SELECT * FROM T WHERE ID IN (SELECT ID FROM OTHERDB..SALES)", "snowflake"
    )

    assert rls.apply_rls(
        database, "MAINDB", "ANALYTICS", statement, exclude_dataset_id=7
    )

    assert statement.format().count(CLAUSE) == 1
    assert {call.kwargs["exclude_dataset_id"] for call in lookup.call_args_list} == {
        7,
        None,
    }


@pytest.mark.parametrize("reverse", [False, True])
def test_shared_rls_key_preserves_deterministic_rule_order(
    mocker: MockerFixture, reverse: bool
) -> None:
    """Shared-key rules retain the same order for either table iteration order."""
    from superset.db_engine_specs.mssql import MssqlEngineSpec
    from superset.sql.parse import SQLStatement
    from superset.utils import rls

    database = MagicMock(db_engine_spec=MssqlEngineSpec)
    schema = rls.SearchPath(database, "OTHERDB", ["dbo", "sales_s"])
    schema.record([Table("SALES")], {"SALES": ["dbo"]})
    statement = SQLStatement(
        "SELECT 1 FROM OTHERDB..SALES UNION ALL SELECT 1 FROM SALES", "mssql"
    )
    # Pin both possible set iteration orders without depending on PYTHONHASHSEED.
    statement.tables = sorted(statement.tables, key=str, reverse=reverse)  # type: ignore[assignment]
    r_sales, r_dbo = "region = 'sales'", "region = 'dbo'"

    def rules(table: Table, *args: Any, **kwargs: Any) -> list[str]:
        """Unknown schemas include both rules; the resolved bare read has one."""
        assert table.catalog == "OTHERDB"
        if kwargs["any_schema"]:
            assert table.schema is None
            return [r_sales, r_dbo]
        assert table.schema == "dbo"
        return [r_dbo]

    mocker.patch.object(rls, "get_predicates_for_table", side_effect=rules)

    predicates, subquery_predicates = rls.get_rls_predicates(
        database, "OTHERDB", schema, statement, "OTHERDB"
    )

    assert predicates == {Table("SALES", catalog="OTHERDB"): [r_sales, r_dbo]}
    assert subquery_predicates is None
