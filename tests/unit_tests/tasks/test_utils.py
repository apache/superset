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
from superset.tasks.utils import get_active_dedup_key, get_finished_dedup_key

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
    "scope,task_type,task_key,user_id,expected",
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
def test_get_active_dedup_key(scope, task_type, task_key, user_id, expected, mocker):
    """Test get_active_dedup_key generates correct format for all scopes"""
    # Mock get_user_id to return the specified user_id
    mocker.patch("superset.utils.core.get_user_id", return_value=user_id)

    result = get_active_dedup_key(scope, task_type, task_key)
    assert result == expected


def test_get_active_dedup_key_private_requires_user_id(mocker):
    """Test that private tasks require user_id from get_user_id()"""
    # Mock get_user_id to return None
    mocker.patch("superset.utils.core.get_user_id", return_value=None)

    with pytest.raises(ValueError, match="user_id required for private tasks"):
        get_active_dedup_key(TaskScope.PRIVATE, "test_type", "test_key")


def test_get_finished_dedup_key():
    """Test that finished tasks use UUID as dedup_key"""
    test_uuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    result = get_finished_dedup_key(test_uuid)
    assert result == test_uuid
