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

from contextlib import nullcontext
from dataclasses import dataclass
from enum import Enum
from typing import Any, Optional, Union

import pytest
from flask_appbuilder.security.sqla.models import User
from superset_core.api.tasks import TaskScope

from superset.tasks.exceptions import ExecutorNotFoundError, InvalidExecutorError
from superset.tasks.types import Executor, ExecutorType, FixedExecutor
from superset.tasks.utils import (
    error_update,
    get_active_dedup_key,
    get_finished_dedup_key,
    parse_properties,
    progress_update,
    serialize_properties,
)
from superset.utils.hashing import hash_from_str

FIXED_USER_ID = 1234
FIXED_USERNAME = "admin"


def _get_users(
    params: Optional[Union[int, list[int]]],
) -> Optional[Union[User, list[User]]]:
    if params is None:
        return None
    if isinstance(params, int):
        return User(id=params, username=str(params))
    return [User(id=user, username=str(user)) for user in params]


@dataclass
class ModelConfig:
    owners: list[int]
    creator: Optional[int] = None
    modifier: Optional[int] = None


class ModelType(int, Enum):
    DASHBOARD = 1
    CHART = 2
    REPORT_SCHEDULE = 3


@pytest.mark.parametrize(
    "model_type,executors,model_config,current_user,expected_result",
    [
        (
            ModelType.REPORT_SCHEDULE,
            [FixedExecutor(FIXED_USERNAME)],
            ModelConfig(
                owners=[1, 2],
                creator=3,
                modifier=4,
            ),
            None,
            (ExecutorType.FIXED_USER, FIXED_USER_ID),
        ),
        (
            ModelType.REPORT_SCHEDULE,
            [
                ExecutorType.CREATOR,
                ExecutorType.CREATOR_OWNER,
                ExecutorType.OWNER,
                ExecutorType.MODIFIER,
                ExecutorType.MODIFIER_OWNER,
                FixedExecutor(FIXED_USERNAME),
            ],
            ModelConfig(owners=[]),
            None,
            (ExecutorType.FIXED_USER, FIXED_USER_ID),
        ),
        (
            ModelType.REPORT_SCHEDULE,
            [
                ExecutorType.CREATOR,
                ExecutorType.CREATOR_OWNER,
                ExecutorType.OWNER,
                ExecutorType.MODIFIER,
                ExecutorType.MODIFIER_OWNER,
                FixedExecutor(FIXED_USERNAME),
            ],
            ModelConfig(owners=[], modifier=1),
            None,
            (ExecutorType.MODIFIER, 1),
        ),
        (
            ModelType.REPORT_SCHEDULE,
            [
                ExecutorType.CREATOR,
                ExecutorType.CREATOR_OWNER,
                ExecutorType.OWNER,
                ExecutorType.MODIFIER,
                ExecutorType.MODIFIER_OWNER,
                FixedExecutor(FIXED_USERNAME),
            ],
            ModelConfig(owners=[2], modifier=1),
            None,
            (ExecutorType.OWNER, 2),
        ),
        (
            ModelType.REPORT_SCHEDULE,
            [
                ExecutorType.CREATOR,
                ExecutorType.CREATOR_OWNER,
                ExecutorType.OWNER,
                ExecutorType.MODIFIER,
                ExecutorType.MODIFIER_OWNER,
                FixedExecutor(FIXED_USERNAME),
            ],
            ModelConfig(owners=[2], creator=3, modifier=1),
            None,
            (ExecutorType.CREATOR, 3),
        ),
        (
            ModelType.REPORT_SCHEDULE,
            [
                ExecutorType.OWNER,
            ],
            ModelConfig(owners=[1, 2, 3, 4, 5, 6, 7], creator=3, modifier=4),
            None,
            (ExecutorType.OWNER, 4),
        ),
        (
            ModelType.REPORT_SCHEDULE,
            [
                ExecutorType.OWNER,
            ],
            ModelConfig(owners=[1, 2, 3, 4, 5, 6, 7], creator=3, modifier=8),
            None,
            (ExecutorType.OWNER, 3),
        ),
        (
            ModelType.REPORT_SCHEDULE,
            [
                ExecutorType.MODIFIER_OWNER,
            ],
            ModelConfig(owners=[1, 2, 3, 4, 5, 6, 7], creator=8, modifier=9),
            None,
            ExecutorNotFoundError(),
        ),
        (
            ModelType.REPORT_SCHEDULE,
            [
                ExecutorType.MODIFIER_OWNER,
            ],
            ModelConfig(owners=[1, 2, 3, 4, 5, 6, 7], creator=8, modifier=4),
            None,
            (ExecutorType.MODIFIER_OWNER, 4),
        ),
        (
            ModelType.REPORT_SCHEDULE,
            [
                ExecutorType.CREATOR_OWNER,
            ],
            ModelConfig(owners=[1, 2, 3, 4, 5, 6, 7], creator=8, modifier=9),
            None,
            ExecutorNotFoundError(),
        ),
        (
            ModelType.REPORT_SCHEDULE,
            [
                ExecutorType.CREATOR_OWNER,
            ],
            ModelConfig(owners=[1, 2, 3, 4, 5, 6, 7], creator=4, modifier=8),
            None,
            (ExecutorType.CREATOR_OWNER, 4),
        ),
        (
            ModelType.REPORT_SCHEDULE,
            [
                ExecutorType.CURRENT_USER,
            ],
            ModelConfig(owners=[1, 2, 3, 4, 5, 6, 7], creator=4, modifier=8),
            None,
            ExecutorNotFoundError(),
        ),
        (
            ModelType.DASHBOARD,
            [
                ExecutorType.CURRENT_USER,
            ],
            ModelConfig(owners=[1], creator=2, modifier=3),
            4,
            (ExecutorType.CURRENT_USER, 4),
        ),
        (
            ModelType.DASHBOARD,
            [
                FixedExecutor(FIXED_USERNAME),
            ],
            ModelConfig(owners=[1], creator=2, modifier=3),
            4,
            (ExecutorType.FIXED_USER, FIXED_USER_ID),
        ),
        (
            ModelType.DASHBOARD,
            [
                ExecutorType.CURRENT_USER,
            ],
            ModelConfig(owners=[1], creator=2, modifier=3),
            None,
            ExecutorNotFoundError(),
        ),
        (
            ModelType.DASHBOARD,
            [
                ExecutorType.CREATOR_OWNER,
                ExecutorType.MODIFIER_OWNER,
                ExecutorType.CURRENT_USER,
                FixedExecutor(FIXED_USERNAME),
            ],
            ModelConfig(owners=[1], creator=2, modifier=3),
            None,
            (ExecutorType.FIXED_USER, FIXED_USER_ID),
        ),
        (
            ModelType.CHART,
            [
                ExecutorType.CURRENT_USER,
            ],
            ModelConfig(owners=[1], creator=2, modifier=3),
            4,
            (ExecutorType.CURRENT_USER, 4),
        ),
        (
            ModelType.CHART,
            [
                FixedExecutor(FIXED_USERNAME),
            ],
            ModelConfig(owners=[1], creator=2, modifier=3),
            4,
            (ExecutorType.FIXED_USER, FIXED_USER_ID),
        ),
        (
            ModelType.CHART,
            [
                ExecutorType.CURRENT_USER,
            ],
            ModelConfig(owners=[1], creator=2, modifier=3),
            None,
            ExecutorNotFoundError(),
        ),
        (
            ModelType.CHART,
            [
                ExecutorType.FIXED_USER,
            ],
            ModelConfig(owners=[]),
            None,
            InvalidExecutorError(),
        ),
        (
            ModelType.CHART,
            [
                ExecutorType.CREATOR_OWNER,
                ExecutorType.MODIFIER_OWNER,
                ExecutorType.CURRENT_USER,
                FixedExecutor(FIXED_USERNAME),
            ],
            ModelConfig(owners=[1], creator=2, modifier=3),
            None,
            (ExecutorType.FIXED_USER, FIXED_USER_ID),
        ),
    ],
)
def test_get_executor(
    model_type: ModelType,
    executors: list[Executor],
    model_config: ModelConfig,
    current_user: Optional[int],
    expected_result: tuple[ExecutorType, int] | Exception,
) -> None:
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice
    from superset.reports.models import ReportSchedule
    from superset.tasks.utils import get_executor

    model: type[Union[Dashboard, ReportSchedule, Slice]]
    model_kwargs: dict[str, Any] = {}
    if model_type == ModelType.REPORT_SCHEDULE:
        model = ReportSchedule
        model_kwargs = {
            "type": "report",
            "name": "test_report",
        }
    elif model_type == ModelType.DASHBOARD:
        model = Dashboard
    elif model_type == ModelType.CHART:
        model = Slice
    else:
        raise Exception(f"Unsupported model type: {model_type}")

    obj = model(
        id=1,
        owners=_get_users(model_config.owners),
        created_by=_get_users(model_config.creator),
        changed_by=_get_users(model_config.modifier),
        **model_kwargs,
    )
    if isinstance(expected_result, Exception):
        cm = pytest.raises(type(expected_result))
        expected_executor_type = None
        expected_executor = None
    else:
        cm = nullcontext()
        expected_executor_type = expected_result[0]
        expected_executor = (
            FIXED_USERNAME
            if expected_executor_type == ExecutorType.FIXED_USER
            else str(expected_result[1])
        )

    with cm:
        executor_type, executor = get_executor(
            executors=executors,
            model=obj,
            current_user=str(current_user) if current_user else None,
        )
        assert executor_type == expected_executor_type
        assert executor == expected_executor


@pytest.mark.parametrize(
    "scope,task_type,task_key,user_id,expected_composite_key",
    [
        # Private tasks with TaskScope enum
        (
            TaskScope.PRIVATE,
            "sql_execution",
            "chart_123",
            42,
            "private|sql_execution|chart_123|42",
        ),
        (
            TaskScope.PRIVATE,
            "thumbnail_gen",
            "dash_456",
            100,
            "private|thumbnail_gen|dash_456|100",
        ),
        # Private tasks with string scope
        (
            "private",
            "api_call",
            "endpoint_789",
            200,
            "private|api_call|endpoint_789|200",
        ),
        # Shared tasks with TaskScope enum
        (
            TaskScope.SHARED,
            "report_gen",
            "monthly_report",
            None,
            "shared|report_gen|monthly_report",
        ),
        (
            TaskScope.SHARED,
            "export_csv",
            "large_export",
            999,  # user_id should be ignored for shared
            "shared|export_csv|large_export",
        ),
        # Shared tasks with string scope
        (
            "shared",
            "batch_process",
            "batch_001",
            123,  # user_id should be ignored for shared
            "shared|batch_process|batch_001",
        ),
        # System tasks with TaskScope enum
        (
            TaskScope.SYSTEM,
            "cleanup_task",
            "daily_cleanup",
            None,
            "system|cleanup_task|daily_cleanup",
        ),
        (
            TaskScope.SYSTEM,
            "db_migration",
            "version_123",
            1,  # user_id should be ignored for system
            "system|db_migration|version_123",
        ),
        # System tasks with string scope
        (
            "system",
            "maintenance",
            "nightly_job",
            2,  # user_id should be ignored for system
            "system|maintenance|nightly_job",
        ),
    ],
)
def test_get_active_dedup_key(
    scope, task_type, task_key, user_id, expected_composite_key, app_context
):
    """Test get_active_dedup_key generates a hash of the composite key.

    The function hashes the composite key using the configured HASH_ALGORITHM
    to produce a fixed-length dedup_key for database storage. The result is
    truncated to 64 chars to fit the database column.
    """
    result = get_active_dedup_key(scope, task_type, task_key, user_id)

    # The result should be a hash of the expected composite key, truncated to 64 chars
    expected_hash = hash_from_str(expected_composite_key)[:64]
    assert result == expected_hash
    assert len(result) <= 64


def test_get_active_dedup_key_private_requires_user_id():
    """Test that private tasks require explicit user_id parameter."""
    with pytest.raises(ValueError, match="user_id required for private tasks"):
        get_active_dedup_key(TaskScope.PRIVATE, "test_type", "test_key")


def test_get_finished_dedup_key():
    """Test that finished tasks use UUID as dedup_key"""
    test_uuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    result = get_finished_dedup_key(test_uuid)
    assert result == test_uuid


@pytest.mark.parametrize(
    "progress,expected",
    [
        # Float (percentage) progress
        (0.5, {"progress_percent": 0.5}),
        (0.0, {"progress_percent": 0.0}),
        (1.0, {"progress_percent": 1.0}),
        (0.25, {"progress_percent": 0.25}),
        # Int (count only) progress
        (42, {"progress_current": 42}),
        (0, {"progress_current": 0}),
        (1000, {"progress_current": 1000}),
        # Tuple (current, total) progress with auto-computed percentage
        (
            (50, 100),
            {"progress_current": 50, "progress_total": 100, "progress_percent": 0.5},
        ),
        (
            (25, 100),
            {"progress_current": 25, "progress_total": 100, "progress_percent": 0.25},
        ),
        (
            (100, 100),
            {"progress_current": 100, "progress_total": 100, "progress_percent": 1.0},
        ),
        # Tuple with zero total (no percentage computed)
        ((10, 0), {"progress_current": 10, "progress_total": 0}),
        ((0, 0), {"progress_current": 0, "progress_total": 0}),
    ],
)
def test_progress_update(progress, expected):
    """Test progress_update returns correct TaskProperties dict."""
    result = progress_update(progress)
    assert result == expected


def test_error_update():
    """Test error_update captures exception details."""
    try:
        raise ValueError("Test error message")
    except ValueError as e:
        result = error_update(e)

    assert result["error_message"] == "Test error message"
    assert result["exception_type"] == "ValueError"
    assert "stack_trace" in result
    assert "ValueError" in result["stack_trace"]


def test_error_update_custom_exception():
    """Test error_update with custom exception class."""

    class CustomError(Exception):
        pass

    try:
        raise CustomError("Custom error")
    except CustomError as e:
        result = error_update(e)

    assert result["error_message"] == "Custom error"
    assert result["exception_type"] == "CustomError"


@pytest.mark.parametrize(
    "json_str,expected",
    [
        # Valid JSON
        (
            '{"is_abortable": true, "progress_percent": 0.5}',
            {"is_abortable": True, "progress_percent": 0.5},
        ),
        (
            '{"error_message": "Something failed"}',
            {"error_message": "Something failed"},
        ),
        (
            '{"progress_current": 50, "progress_total": 100}',
            {"progress_current": 50, "progress_total": 100},
        ),
        # Empty/None cases
        ("", {}),
        (None, {}),
        # Invalid JSON returns empty dict
        ("not valid json", {}),
        ("{broken", {}),
        # Unknown keys are preserved (forward compatibility)
        (
            '{"is_abortable": true, "future_field": "value"}',
            {"is_abortable": True, "future_field": "value"},
        ),
    ],
)
def test_parse_properties(json_str, expected):
    """Test parse_properties parses JSON to TaskProperties dict."""
    result = parse_properties(json_str)
    assert result == expected


@pytest.mark.parametrize(
    "props,expected_contains",
    [
        # Full properties
        (
            {"is_abortable": True, "progress_percent": 0.5},
            {"is_abortable": True, "progress_percent": 0.5},
        ),
        # Empty dict
        ({}, {}),
        # Sparse properties
        ({"is_abortable": True}, {"is_abortable": True}),
        ({"error_message": "fail"}, {"error_message": "fail"}),
    ],
)
def test_serialize_properties(props, expected_contains):
    """Test serialize_properties converts TaskProperties to JSON."""
    from superset.utils import json

    result = serialize_properties(props)
    parsed = json.loads(result)
    assert parsed == expected_contains


def test_properties_roundtrip():
    """Test that serialize -> parse roundtrip preserves data."""
    original = {
        "is_abortable": True,
        "progress_percent": 0.75,
        "error_message": "Test error",
    }
    serialized = serialize_properties(original)
    parsed = parse_properties(serialized)
    assert parsed == original
