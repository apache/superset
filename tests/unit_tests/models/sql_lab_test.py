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
from unittest.mock import MagicMock

import pytest
from flask_appbuilder import Model
from jinja2.exceptions import TemplateError
from pytest_mock import MockerFixture

from superset.commands.dataset.exceptions import DatasetNotFoundError
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    SupersetParseError,
    SupersetSecurityException,
    SupersetTemplateException,
)
from superset.models import sql_lab as sql_lab_module
from superset.models.sql_lab import Query, SavedQuery


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
