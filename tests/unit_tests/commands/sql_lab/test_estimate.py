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
"""Unit tests for resource-level authorization in QueryEstimationCommand."""

from unittest.mock import MagicMock, patch

import pytest

from superset.commands.sql_lab.estimate import (
    EstimateQueryCostType,
    QueryEstimationCommand,
)
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetErrorException, SupersetSecurityException


def _make_params(**kwargs: object) -> EstimateQueryCostType:
    base: EstimateQueryCostType = {
        "database_id": 1,
        "sql": "SELECT 1",
        "template_params": {},
        "catalog": None,
        "schema": None,
    }
    base.update(kwargs)  # type: ignore[typeddict-item]
    return base


def _security_exception() -> SupersetSecurityException:
    return SupersetSecurityException(
        SupersetError(
            message="Access denied",
            error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
            level=ErrorLevel.WARNING,
        )
    )


# ---------------------------------------------------------------------------
# Existing behaviour: database not found
# ---------------------------------------------------------------------------


@patch("superset.commands.sql_lab.estimate.security_manager", new_callable=MagicMock)
@patch("superset.commands.sql_lab.estimate.db")
def test_validate_raises_when_database_not_found(
    mock_db: MagicMock,
    mock_security_manager: MagicMock,
) -> None:
    """404 is raised before the access check when the database does not exist."""
    mock_db.session.query.return_value.get.return_value = None

    command = QueryEstimationCommand(_make_params())
    with pytest.raises(SupersetErrorException) as exc_info:
        command.validate()

    assert exc_info.value.error.error_type == SupersetErrorType.RESULTS_BACKEND_ERROR
    mock_security_manager.raise_for_access.assert_not_called()


# ---------------------------------------------------------------------------
# New behaviour: database exists but caller has no access
# ---------------------------------------------------------------------------


@patch("superset.commands.sql_lab.estimate.security_manager", new_callable=MagicMock)
@patch("superset.commands.sql_lab.estimate.db")
def test_validate_raises_when_database_access_denied(
    mock_db: MagicMock,
    mock_security_manager: MagicMock,
) -> None:
    """SupersetSecurityException propagates when raise_for_access denies access."""
    mock_database = MagicMock()
    mock_db.session.query.return_value.get.return_value = mock_database
    mock_security_manager.raise_for_access.side_effect = _security_exception()

    command = QueryEstimationCommand(_make_params())
    with pytest.raises(SupersetSecurityException):
        command.validate()

    mock_security_manager.raise_for_access.assert_called_once_with(
        database=mock_database
    )


# ---------------------------------------------------------------------------
# New behaviour: authorised caller succeeds
# ---------------------------------------------------------------------------


@patch("superset.commands.sql_lab.estimate.security_manager", new_callable=MagicMock)
@patch("superset.commands.sql_lab.estimate.db")
def test_validate_succeeds_for_authorised_user(
    mock_db: MagicMock,
    mock_security_manager: MagicMock,
) -> None:
    """validate() completes without error when access is granted."""
    mock_database = MagicMock()
    mock_db.session.query.return_value.get.return_value = mock_database
    mock_security_manager.raise_for_access.return_value = None

    command = QueryEstimationCommand(_make_params())
    command.validate()  # must not raise

    mock_security_manager.raise_for_access.assert_called_once_with(
        database=mock_database
    )


# ---------------------------------------------------------------------------
# Kwarg correctness
# ---------------------------------------------------------------------------


@patch("superset.commands.sql_lab.estimate.security_manager", new_callable=MagicMock)
@patch("superset.commands.sql_lab.estimate.db")
def test_raise_for_access_called_with_correct_database(
    mock_db: MagicMock,
    mock_security_manager: MagicMock,
) -> None:
    """The database object fetched from the session is passed to raise_for_access."""
    mock_database = MagicMock()
    mock_database.id = 42
    mock_db.session.query.return_value.get.return_value = mock_database
    mock_security_manager.raise_for_access.return_value = None

    command = QueryEstimationCommand(_make_params(database_id=42))
    command.validate()

    call_kwargs = mock_security_manager.raise_for_access.call_args.kwargs
    assert call_kwargs["database"] is mock_database
