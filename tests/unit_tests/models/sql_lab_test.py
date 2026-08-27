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
    SupersetParseError,
    SupersetSecurityException,
    SupersetTemplateException,
)
from superset.models import sql_lab as sql_lab_module
from superset.models.core import Database
from superset.models.sql_lab import Query, SavedQuery
from superset.superset_typing import AdhocColumn


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
