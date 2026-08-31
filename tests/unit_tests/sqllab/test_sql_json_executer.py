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

from superset.exceptions import SupersetErrorsException
from superset.sqllab.sql_json_executer import SynchronousSqlJsonExecutor
from superset.utils.core import QueryStatus


def _make_executor(data: dict[str, Any]) -> SynchronousSqlJsonExecutor:
    query_dao = MagicMock()
    get_sql_results_task = MagicMock(return_value=data)
    return SynchronousSqlJsonExecutor(
        query_dao,
        get_sql_results_task,
        timeout_duration_in_seconds=60,
        sqllab_backend_persistence_feature_enable=False,
    )


def _make_execution_context() -> MagicMock:
    execution_context = MagicMock()
    execution_context.query.id = 1
    execution_context.expand_data = False
    execution_context.select_as_cta = False
    return execution_context


def test_execute_raises_400_when_all_errors_are_warnings() -> None:
    """
    All-WARNING rich errors (e.g. a Databricks insufficient-permissions
    error) should surface as a 4xx client error, not a 500.
    """
    data = {
        "status": QueryStatus.FAILED,
        "errors": [
            {
                "message": "Insufficient privileges on Catalog 'foo'.",
                "error_type": "CONNECTION_DATABASE_PERMISSIONS_ERROR",
                "level": "warning",
                "extra": {},
            }
        ],
    }
    executor = _make_executor(data)

    with pytest.raises(SupersetErrorsException) as excinfo:
        executor.execute(_make_execution_context(), "SELECT 1", None)

    assert excinfo.value.status == 400


def test_execute_raises_400_when_errors_are_warning_and_info() -> None:
    """
    A mix of WARNING and INFO errors (no ERROR-level entries) should still
    surface as a 4xx, since nothing in the list indicates a server fault.
    """
    data = {
        "status": QueryStatus.FAILED,
        "errors": [
            {
                "message": "Insufficient privileges on Catalog 'foo'.",
                "error_type": "CONNECTION_DATABASE_PERMISSIONS_ERROR",
                "level": "warning",
                "extra": {},
            },
            {
                "message": "For your information.",
                "error_type": "GENERIC_DB_ENGINE_ERROR",
                "level": "info",
                "extra": {},
            },
        ],
    }
    executor = _make_executor(data)

    with pytest.raises(SupersetErrorsException) as excinfo:
        executor.execute(_make_execution_context(), "SELECT 1", None)

    assert excinfo.value.status == 400


def test_execute_raises_500_when_any_error_is_error_level() -> None:
    """
    Existing behavior is preserved: a single ERROR-level rich error still
    surfaces as a 500.
    """
    data = {
        "status": QueryStatus.FAILED,
        "errors": [
            {
                "message": "Something went wrong.",
                "error_type": "GENERIC_DB_ENGINE_ERROR",
                "level": "error",
                "extra": {},
            },
        ],
    }
    executor = _make_executor(data)

    with pytest.raises(SupersetErrorsException) as excinfo:
        executor.execute(_make_execution_context(), "SELECT 1", None)

    assert excinfo.value.status == 500


def test_execute_raises_500_when_errors_are_mixed_warning_and_error() -> None:
    """
    A mix of WARNING and ERROR still surfaces as a 500: any ERROR wins.
    """
    data = {
        "status": QueryStatus.FAILED,
        "errors": [
            {
                "message": "Insufficient privileges on Catalog 'foo'.",
                "error_type": "CONNECTION_DATABASE_PERMISSIONS_ERROR",
                "level": "warning",
                "extra": {},
            },
            {
                "message": "Something went wrong.",
                "error_type": "GENERIC_DB_ENGINE_ERROR",
                "level": "error",
                "extra": {},
            },
        ],
    }
    executor = _make_executor(data)

    with pytest.raises(SupersetErrorsException) as excinfo:
        executor.execute(_make_execution_context(), "SELECT 1", None)

    assert excinfo.value.status == 500
