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
from datetime import datetime
from hashlib import sha256
from typing import Any
from unittest.mock import MagicMock

import pytest
from flask_appbuilder import Model
from jinja2.exceptions import TemplateError
from pytest_mock import MockerFixture
from sqlalchemy.dialects import sqlite

from superset.commands.dataset.exceptions import DatasetNotFoundError
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    QueryObjectValidationError,
    SupersetParseError,
    SupersetSecurityException,
    SupersetTemplateException,
)
from superset.models import sql_lab as sql_lab_module
from superset.models.core import Database
from superset.models.sql_lab import Query, SavedQuery
from superset.superset_typing import AdhocColumn
from superset.utils.core import QueryStatus


@pytest.mark.parametrize(
    "klass",
    [
        Query,
        SavedQuery,
    ],
)
@pytest.mark.parametrize(
    ("exception", "should_warn"),
    [
        # Original silent handler — security/parse/template errors are
        # expected during list rendering and produce no log noise.
        (
            SupersetSecurityException(
                SupersetError(
                    error_type=SupersetErrorType.QUERY_SECURITY_ACCESS_ERROR,
                    message="",
                    level=ErrorLevel.ERROR,
                )
            ),
            False,
        ),
        (
            SupersetParseError(
                sql="INVALID SQL",
                message="Invalid SQL syntax",
            ),
            False,
        ),
        (TemplateError, False),
        # ``{{ dataset(id) }}`` referencing a deleted dataset previously
        # bubbled up through ``sql_tables`` and broke saved-query list
        # endpoints (see issue #32771). The new handler swallows it but
        # logs a warning so the underlying breakage is still observable —
        # pinned here so a future refactor that collapses the case into
        # the silent handler fails this test.
        (DatasetNotFoundError("Dataset 1 not found!"), True),
        (SupersetTemplateException("Template rendering failed"), True),
    ],
)
def test_sql_tables_mixin_sql_tables_exception(
    klass: type[Model],
    exception: Exception,
    should_warn: bool,
    mocker: MockerFixture,
) -> None:
    mocker.patch(
        "superset.models.sql_lab.process_jinja_sql",
        side_effect=exception,
    )
    warning_spy = mocker.spy(sql_lab_module.logger, "warning")

    assert klass(sql="SELECT 1", database=MagicMock()).sql_tables == []

    if should_warn:
        assert warning_spy.call_count == 1, (
            f"{type(exception).__name__} should hit the warning-logging "
            "handler; if this fails, the case was likely collapsed into "
            "the silent first-handler clause."
        )
    else:
        warning_spy.assert_not_called()


@pytest.mark.parametrize(
    "klass",
    [
        Query,
        SavedQuery,
    ],
)
@pytest.mark.parametrize(
    "invalid_sql",
    [
        "SELECT * FROM table WHERE invalid syntax",
        "INVALID SQL STATEMENT",
        "SELECT * FROM; DROP TABLE users;",
        "",
        None,
    ],
)
def test_sql_tables_mixin_invalid_sql_returns_empty_list(
    klass: type[Model],
    invalid_sql: str,
    mocker: MockerFixture,
) -> None:
    """Test that SqlTablesMixin returns empty list when SQL parsing fails."""
    mocker.patch(
        "superset.models.sql_lab.process_jinja_sql",
        side_effect=SupersetParseError(
            sql=invalid_sql or "INVALID SQL",
            message=f"Failed to parse SQL: {invalid_sql}",
        ),
    )

    instance = (
        klass(sql=invalid_sql, database=MagicMock())
        if invalid_sql is not None
        else klass(database=MagicMock())
    )
    assert instance.sql_tables == []


def _query_with_column(column: dict[str, Any]) -> Query:
    """Build an unsaved-dataset ``Query`` exposing a single result column."""
    query = Query(
        database=Database(database_name="db", sqlalchemy_uri="sqlite://"),
        database_id=1,
        sql="SELECT ds FROM t",
    )
    query.extra = {"columns": [column]}
    return query


def _compile(column_element) -> str:
    return str(
        column_element.compile(
            dialect=sqlite.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )


def test_adhoc_column_to_sqla_applies_time_grain_for_unsaved_dataset() -> None:
    """
    Selecting a time grain on a chart backed by an unsaved SQL Lab query must
    wrap the temporal column in the engine's time-grain expression.

    Regression test for issue #38529: the ``Query`` datasource previously
    emitted the raw column without applying the requested grain because the
    temporal metadata from the query result columns was never consulted.
    """
    query = _query_with_column(
        {"column_name": "ds", "is_dttm": True, "type": "TIMESTAMP"}
    )

    col: AdhocColumn = {
        "sqlExpression": "ds",
        "label": "ds",
        "isColumnReference": True,
        "timeGrain": "P1D",
        "columnType": "BASE_AXIS",
    }

    result, _ = query.adhoc_column_to_sqla(col)

    # SQLite's P1D (DAY) grain wraps the column in ``DATETIME(..., 'start of day')``.
    compiled = _compile(result)
    assert "DATETIME" in compiled
    assert "start of day" in compiled
    assert "ds" in compiled


def test_adhoc_column_to_sqla_skips_time_grain_without_base_axis() -> None:
    """
    The grain must only be applied for the base axis column; a temporal column
    with a ``timeGrain`` but no ``BASE_AXIS`` type is emitted as the raw column.
    """
    query = _query_with_column(
        {"column_name": "ds", "is_dttm": True, "type": "TIMESTAMP"}
    )

    col: AdhocColumn = {
        "sqlExpression": "ds",
        "label": "ds",
        "isColumnReference": True,
        "timeGrain": "P1D",
    }

    result, _ = query.adhoc_column_to_sqla(col)

    assert "start of day" not in _compile(result)


def test_adhoc_column_to_sqla_skips_time_grain_for_non_temporal_column() -> None:
    """
    A non-temporal column must not be wrapped in a time-grain expression even
    when a ``timeGrain`` is requested for the base axis.
    """
    query = _query_with_column(
        {"column_name": "ds", "is_dttm": False, "type": "VARCHAR"}
    )

    col: AdhocColumn = {
        "sqlExpression": "ds",
        "label": "ds",
        "isColumnReference": True,
        "timeGrain": "P1D",
        "columnType": "BASE_AXIS",
    }

    result, _ = query.adhoc_column_to_sqla(col)

    assert "start of day" not in _compile(result)


def _query_for_explore(
    *,
    sql: str = "SELECT {{ requested_value }} AS value",
    status: QueryStatus = QueryStatus.SUCCESS,
    user_id: int = 7,
    select_as_cta: bool = False,
) -> Query:
    database = Database(id=3, database_name="db", sqlalchemy_uri="sqlite://")
    query = Query(
        id=17,
        client_id="client-id",
        database=database,
        database_id=database.id,
        sql=sql,
        schema="main",
        status=status,
        user_id=user_id,
        select_as_cta=select_as_cta,
        changed_on=datetime(2026, 1, 1),
    )
    query.extra = {"columns": []}
    return query


def test_query_explore_uses_frozen_rendered_source() -> None:
    query = _query_for_explore()
    query.set_explore_source("SELECT 42 AS value")
    template_processor = MagicMock()
    template_processor.process_template.side_effect = AssertionError(
        "frozen query source must not be rendered again"
    )

    assert query.get_rendered_sql(template_processor) == "SELECT 42 AS value"
    template_processor.process_template.assert_not_called()


@pytest.mark.parametrize(
    ("source", "status", "select_as_cta"),
    [
        (None, QueryStatus.SUCCESS, False),
        ("SELECT 1", QueryStatus.RUNNING, False),
        ("SELECT 1; SELECT 2", QueryStatus.SUCCESS, False),
        ("DELETE FROM events", QueryStatus.SUCCESS, False),
        ("CALL refresh_data()", QueryStatus.SUCCESS, False),
        ("SELECT 1", QueryStatus.SUCCESS, True),
    ],
)
def test_query_explore_rejects_non_replayable_sources(
    source: str | None,
    status: QueryStatus,
    select_as_cta: bool,
) -> None:
    query = _query_for_explore(status=status, select_as_cta=select_as_cta)
    if source is not None:
        query.set_explore_source(source)

    with pytest.raises(QueryObjectValidationError):
        query.get_rendered_sql()


def test_query_explore_rejects_unknown_artifact_version() -> None:
    query = _query_for_explore()
    query.extra = {
        "columns": [],
        "_explore_source": {"version": 2, "sql": "SELECT 1"},
    }

    with pytest.raises(QueryObjectValidationError):
        query.get_rendered_sql()


def test_query_explore_rejects_malformed_extra_json() -> None:
    query = _query_for_explore()
    query.extra_json = "[]"

    with pytest.raises(QueryObjectValidationError):
        query.get_rendered_sql()


def test_query_explore_normalizes_parser_failure(
    mocker: MockerFixture,
) -> None:
    query = _query_for_explore()
    query.set_explore_source("SELECT 1")
    mocker.patch.object(
        sql_lab_module,
        "SQLScript",
        side_effect=RuntimeError("parser unavailable"),
    )

    with pytest.raises(QueryObjectValidationError, match="fully parseable"):
        query.get_rendered_sql()


def test_query_serialization_hides_frozen_source() -> None:
    query = _query_for_explore()
    query.set_explore_source("SELECT 42 AS value")

    payload = query.to_dict()

    assert payload["extra"] == {"columns": []}
    assert "SELECT 42" not in str(payload)


def test_query_explore_cache_key_binds_source_and_underlying_rls(
    mocker: MockerFixture,
) -> None:
    query = _query_for_explore()
    source = "SELECT account_id FROM accounts"
    query.set_explore_source(source)
    collect_rls = mocker.patch(
        "superset.utils.rls.collect_rls_predicates_for_sql_or_raise",
        return_value=["tenant_id = 7"],
    )

    cache_keys = query.get_extra_cache_keys({})

    digest = sha256(source.encode("utf-8")).hexdigest()
    assert cache_keys == [f"query-explore-source:v1:{digest}", "tenant_id = 7"]
    collect_rls.assert_called_once_with(
        source,
        query.database,
        query.catalog,
        query.schema,
        exclude_dataset_id=None,
    )


def test_query_explore_access_requires_owner_and_checks_frozen_source(
    mocker: MockerFixture,
) -> None:
    query = _query_for_explore(user_id=7)
    query.set_explore_source("SELECT account_id FROM accounts")
    mocker.patch.object(sql_lab_module, "get_user_id", return_value=7)
    mocker.patch.object(
        sql_lab_module.security_manager,
        "can_access_all_queries",
        return_value=False,
    )
    strict_access = mocker.patch.object(
        sql_lab_module.security_manager,
        "raise_for_access",
    )

    query.raise_for_explore_access()

    strict_access.assert_called_once_with(
        database=query.database,
        rendered_sql="SELECT account_id FROM accounts",
        catalog=query.catalog,
        schema=query.schema,
        force_dataset_match=True,
    )


def test_query_explore_access_rejects_non_owner_before_source_disclosure(
    mocker: MockerFixture,
) -> None:
    query = _query_for_explore(user_id=7)
    query.set_explore_source("SELECT account_id FROM accounts")
    mocker.patch.object(sql_lab_module, "get_user_id", return_value=8)
    mocker.patch.object(
        sql_lab_module.security_manager,
        "can_access_all_queries",
        return_value=False,
    )
    strict_access = mocker.patch.object(
        sql_lab_module.security_manager,
        "raise_for_access",
    )

    with pytest.raises(SupersetSecurityException):
        query.raise_for_explore_access()

    strict_access.assert_not_called()


def test_query_explore_access_allows_all_query_access(
    mocker: MockerFixture,
) -> None:
    query = _query_for_explore(user_id=7)
    query.set_explore_source("SELECT account_id FROM accounts")
    mocker.patch.object(sql_lab_module, "get_user_id", return_value=8)
    mocker.patch.object(
        sql_lab_module.security_manager,
        "can_access_all_queries",
        return_value=True,
    )
    strict_access = mocker.patch.object(
        sql_lab_module.security_manager,
        "raise_for_access",
    )

    query.raise_for_explore_access()

    strict_access.assert_called_once()


def test_query_result_access_authorizes_complete_frozen_source(
    mocker: MockerFixture,
) -> None:
    query = _query_for_explore(user_id=7)
    source = "SELECT account_id FROM accounts; SELECT region_id FROM regions"
    query.set_explore_source(source)
    mocker.patch.object(sql_lab_module, "get_user_id", return_value=7)
    strict_access = mocker.patch.object(
        sql_lab_module.security_manager,
        "raise_for_access",
    )

    query.raise_for_access()

    strict_access.assert_called_once_with(
        database=query.database,
        rendered_sql=source,
        catalog=query.catalog,
        schema=query.schema,
        force_dataset_match=True,
    )


def test_legacy_query_result_access_retains_executed_sql_fallback(
    mocker: MockerFixture,
) -> None:
    query = _query_for_explore(user_id=7)
    mocker.patch.object(sql_lab_module, "get_user_id", return_value=7)
    strict_access = mocker.patch.object(
        sql_lab_module.security_manager,
        "raise_for_access",
    )

    query.raise_for_access()

    strict_access.assert_called_once_with(query=query, force_dataset_match=True)


def test_query_explore_rls_does_not_exclude_colliding_query_id(
    mocker: MockerFixture,
) -> None:
    query = _query_for_explore()
    query.set_explore_source("SELECT account_id FROM accounts")
    query.database.get_default_schema = MagicMock(return_value="main")
    apply_rls = mocker.patch("superset.models.helpers.apply_rls", return_value=False)

    query.get_from_clause()

    apply_rls.assert_called_once()
    assert apply_rls.call_args.kwargs["exclude_dataset_id"] is None


def test_query_explore_rls_failure_is_closed(mocker: MockerFixture) -> None:
    query = _query_for_explore()
    query.set_explore_source("SELECT account_id FROM accounts")
    query.database.get_default_schema = MagicMock(return_value="main")
    mocker.patch(
        "superset.models.helpers.apply_rls",
        side_effect=RuntimeError("RLS lookup failed"),
    )

    with pytest.raises(QueryObjectValidationError, match="row-level security"):
        query.get_from_clause()
