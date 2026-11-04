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
RLS for an unqualified table when the query carries no schema.

On an engine with dynamic-schema support (Postgres, MySQL, Trino, ...) the
per-query schema is whatever the request selected, so a SQL Lab or MCP query
sent without one resolves to no schema at all. The connection still resolves an
unqualified ``sales`` to its default schema (``public`` through the Postgres
``search_path``), so RLS must target that schema too: a dataset registered as
``public.sales`` has to get the same clause whether or not ``public`` was passed.

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


@contextmanager
def _inspector(default_schema: str | None) -> Iterator[Any]:
    """An inspector reporting the connection's default schema."""
    yield MagicMock(default_schema_name=default_schema)


@pytest.fixture
def database(session: Session, mocker: MockerFixture) -> Iterator[Database]:
    """
    A Postgres database whose ``public.sales`` dataset has a Regular RLS filter
    assigned to the current user's role.

    The connection's default schema (the Postgres ``search_path``) is ``public``.
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
        Database, "get_inspector", side_effect=lambda **kw: _inspector("public")
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
    get_default_schema = mocker.spy(Database, "get_default_schema")

    options = QueryOptions(dry_run=True)
    qualified = database.execute("SELECT * FROM public.sales", options=options)
    other = database.execute("SELECT * FROM archive.sales", options=options)

    assert CLAUSE in qualified.statements[0].executed_sql
    assert CLAUSE not in other.statements[0].executed_sql
    get_default_schema.assert_not_called()


def _sql_lab_executed_sql(
    database: Database,
    session: Session,
    mocker: MockerFixture,
    schema: str | None,
    *,
    store_results: bool,
) -> str:
    """
    The SQL that SQL Lab's ``get_sql_results`` sends to the database.

    ``store_results`` is how the Celery worker runs it; the synchronous executor
    calls the same task inline without storing results.
    """
    from superset import sql_lab
    from superset.models.sql_lab import Query

    query = Query(
        client_id="rls_schema",
        database=database,
        sql=SQL,
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
        SQL,
        return_results=not store_results,
        store_results=store_results,
        username="alice",
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
        # a fully qualified query has no table for the default schema to qualify
        (None, True, "SELECT * FROM public.sales JOIN archive.x ON 1 = 1", "", False),
        # a query reading no table at all
        (None, True, "SELECT 1", "", False),
        # an unqualified table resolves to the connection's default schema
        (None, True, "SELECT * FROM public.sales JOIN x ON 1 = 1", "public", True),
        ("", True, SQL, "public", True),
    ],
)
def test_get_rls_default_schema(
    schema: str | None,
    dynamic: bool,
    sql: str,
    expected: str,
    probed: bool,
) -> None:
    """
    The default schema is discovered only when RLS needs it: a dynamic-schema
    engine, no per-query schema, and a table read without a schema.
    """
    from superset.utils.rls import get_rls_default_schema

    database = MagicMock()
    database.db_engine_spec.supports_dynamic_schema = dynamic
    database.get_default_schema.return_value = "public"

    assert get_rls_default_schema(database, "cat", schema, _statements(sql)) == expected
    assert database.get_default_schema.called is probed
    if probed:
        database.get_default_schema.assert_called_once_with("cat")


@pytest.mark.parametrize("default_schema, expected", [("public", "public"), (None, "")])
def test_get_rls_default_schema_without_statements(
    default_schema: str | None, expected: str
) -> None:
    """
    Without the statements the default schema is always discovered, and a
    connection reporting none leaves the schema empty.
    """
    from superset.utils.rls import get_rls_default_schema

    database = MagicMock()
    database.db_engine_spec.supports_dynamic_schema = True
    database.get_default_schema.return_value = default_schema

    assert get_rls_default_schema(database, None, None) == expected
