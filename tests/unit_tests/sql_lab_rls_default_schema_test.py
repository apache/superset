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


# The schemas the Postgres connection searches, in order (``current_schemas(false)``)
SEARCH_PATH = ["public"]


@contextmanager
def _inspector(default_schema: str | None, search_path: list[str]) -> Iterator[Any]:
    """An inspector reporting the connection's default schema and search path."""
    inspector = MagicMock(default_schema_name=default_schema)
    connection = inspector.engine.connect.return_value.__enter__.return_value
    connection.execute.return_value.scalar.return_value = search_path
    yield inspector


@pytest.fixture
def database(session: Session, mocker: MockerFixture) -> Iterator[Database]:
    """
    A Postgres database whose ``public.sales`` dataset has a Regular RLS filter
    assigned to the current user's role.

    The connection's default schema (the Postgres ``search_path``) is ``public``.
    Patch ``Database.get_inspector`` again to change it.
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
        first_name="alice",
        last_name="doe",
        username="alice",
        email="alice@example.org",
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
    mocker.patch.object(
        Database,
        "get_inspector",
        side_effect=lambda **kw: _inspector("public", SEARCH_PATH),
    )
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
    mocker.patch.object(Database, "get_raw_connection")
    mocker.patch.object(
        database.db_engine_spec, "get_cancel_query_id", return_value=None
    )
    mocker.patch.object(sql_lab.security_manager, "find_user", return_value=g.user)

    payload = sql_lab.get_sql_results(
        query.id,
        sql,
        return_results=not store_results,
        store_results=store_results,
        username="alice",
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
    "schema, dynamic, sql, expected, probed",
    [
        # an explicit or already-resolved schema wins without a probe
        ("analytics", True, SQL, "analytics", False),
        # engines without dynamic schemas resolve their default for execution
        (None, False, SQL, "", False),
        # a fully qualified query has no table for the search path to qualify
        (None, True, "SELECT * FROM public.sales JOIN archive.x ON 1 = 1", "", False),
        # a query reading no table at all
        (None, True, "SELECT 1", "", False),
        # a query reading only a CTE
        (None, True, "WITH Sales AS (SELECT 1 AS n) SELECT * FROM sales", "", False),
        # an unqualified table resolves through the connection's search path
        (
            None,
            True,
            "SELECT * FROM public.sales JOIN x ON 1 = 1",
            ("alice", "public"),
            True,
        ),
        ("", True, SQL, ("alice", "public"), True),
    ],
)
def test_get_unqualified_table_schemas(
    schema: str | None,
    dynamic: bool,
    sql: str,
    expected: str | tuple[str, ...],
    probed: bool,
) -> None:
    """
    The search path is discovered only when RLS needs it: a dynamic-schema
    engine, no per-query schema, and a table read without a schema.
    """
    from superset.utils.rls import get_unqualified_table_schemas

    database = MagicMock()
    database.db_engine_spec.supports_dynamic_schema = dynamic
    database.get_search_path.return_value = ["alice", "public"]

    assert (
        get_unqualified_table_schemas(database, "cat", schema, _statements(sql))
        == expected
    )
    assert database.get_search_path.called is probed
    if probed:
        database.get_search_path.assert_called_once_with("cat")


@pytest.mark.parametrize(
    "search_path, expected",
    [
        (["public"], "public"),
        (["alice", "public"], ("alice", "public")),
        ([], ""),
    ],
)
def test_get_unqualified_table_schemas_without_statements(
    search_path: list[str], expected: str | tuple[str, ...]
) -> None:
    """
    Without the statements the search path is always discovered. A path of one
    schema gives that schema, one of several gives all of them, and a connection
    reporting none leaves the schema empty.
    """
    from superset.utils.rls import get_unqualified_table_schemas

    database = MagicMock()
    database.db_engine_spec.supports_dynamic_schema = True
    database.get_search_path.return_value = search_path

    assert get_unqualified_table_schemas(database, None, None) == expected


@pytest.fixture
def user_schema_first(database: Database, mocker: MockerFixture) -> Database:
    """
    The Postgres default ``search_path`` (``"$user", public``) for a user whose
    own schema exists: the connection reports that schema as its default, but an
    unqualified ``sales``, which only ``public`` has, still reads ``public.sales``.
    """
    mocker.patch.object(
        Database,
        "get_inspector",
        side_effect=lambda **kw: _inspector("alice", ["alice", "public"]),
    )
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
    from superset.utils.rls import collect_rls_predicates_for_sql, get_rls_schema

    assert get_rls_schema(user_schema_first, None, None, SQL) == ("alice", "public")
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
        "SELECT * FROM sales JOIN alice.sales AS s ON TRUE",
        "SELECT * FROM alice.sales AS s JOIN sales ON TRUE",
    ],
)
def test_apply_rls_keeps_rules_of_every_search_path_schema(
    user_schema_first: Database, sql: str
) -> None:
    """
    An unqualified table keyed under the first schema on the search path keeps
    the rules found in later schemas, even when the query also reads the table
    qualified with that first schema (which then gets them too, erring toward an
    extra filter).
    """
    from superset.sql.parse import SQLStatement
    from superset.utils.rls import apply_rls

    statement = SQLStatement(sql, "postgresql")
    assert apply_rls(user_schema_first, None, ("alice", "public"), statement)
    assert statement.format().count(CLAUSE) == 2


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
    "schema, entries, expected",
    [
        # an entry matching the table in any schema it may resolve to
        (("alice", "public"), {"public.sales", "archive.sales"}, {"public.sales"}),
        (("alice", "public"), {"alice.sales"}, {"alice.sales"}),
        # without any schema only a bare entry can match
        ((), {"public.sales", "sales"}, {"sales"}),
        ("public", {"public.sales"}, {"public.sales"}),
        (None, {"public.sales"}, set()),
    ],
)
def test_get_disallowed_tables(
    schema: tuple[str, ...] | str | None, entries: set[str], expected: set[str]
) -> None:
    """
    An unqualified table matches a schema-qualified entry for any schema it may
    resolve to.
    """
    from superset.sql.parse import SQLScript
    from superset.utils.rls import get_disallowed_tables

    script = SQLScript("SELECT * FROM sales", engine="postgresql")
    assert get_disallowed_tables(script, entries, schema) == expected
