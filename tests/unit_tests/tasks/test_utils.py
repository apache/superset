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

from superset.tasks.exceptions import ExecutorNotFoundError
from superset.tasks.types import ExecutorType

SELENIUM_USER_ID = 1234
SELENIUM_USERNAME = "admin"


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
    "model_type,executor_types,model_config,current_user,expected_result",
    [
        (
            ModelType.REPORT_SCHEDULE,
            [ExecutorType.SELENIUM],
            ModelConfig(
                owners=[1, 2],
                creator=3,
                modifier=4,
            ),
            None,
            (ExecutorType.SELENIUM, SELENIUM_USER_ID),
        ),
        (
            ModelType.REPORT_SCHEDULE,
            [
                ExecutorType.CREATOR,
                ExecutorType.CREATOR_OWNER,
                ExecutorType.OWNER,
                ExecutorType.MODIFIER,
                ExecutorType.MODIFIER_OWNER,
                ExecutorType.SELENIUM,
            ],
            ModelConfig(owners=[]),
            None,
            (ExecutorType.SELENIUM, SELENIUM_USER_ID),
        ),
        (
            ModelType.REPORT_SCHEDULE,
            [
                ExecutorType.CREATOR,
                ExecutorType.CREATOR_OWNER,
                ExecutorType.OWNER,
                ExecutorType.MODIFIER,
                ExecutorType.MODIFIER_OWNER,
                ExecutorType.SELENIUM,
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
                ExecutorType.SELENIUM,
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
                ExecutorType.SELENIUM,
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
                ExecutorType.SELENIUM,
            ],
            ModelConfig(owners=[1], creator=2, modifier=3),
            4,
            (ExecutorType.SELENIUM, SELENIUM_USER_ID),
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
                ExecutorType.SELENIUM,
            ],
            ModelConfig(owners=[1], creator=2, modifier=3),
            None,
            (ExecutorType.SELENIUM, SELENIUM_USER_ID),
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
                ExecutorType.SELENIUM,
            ],
            ModelConfig(owners=[1], creator=2, modifier=3),
            4,
            (ExecutorType.SELENIUM, SELENIUM_USER_ID),
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
                ExecutorType.CREATOR_OWNER,
                ExecutorType.MODIFIER_OWNER,
                ExecutorType.CURRENT_USER,
                ExecutorType.SELENIUM,
            ],
            ModelConfig(owners=[1], creator=2, modifier=3),
            None,
            (ExecutorType.SELENIUM, SELENIUM_USER_ID),
        ),
    ],
)
def test_get_executor(
    model_type: ModelType,
    executor_types: list[ExecutorType],
    model_config: ModelConfig,
    current_user: Optional[int],
    expected_result: tuple[int, ExecutorNotFoundError],
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
            SELENIUM_USERNAME
            if expected_executor_type == ExecutorType.SELENIUM
            else str(expected_result[1])
        )

    with cm:
        executor_type, executor = get_executor(
            executor_types=executor_types,
            model=obj,
            current_user=str(current_user) if current_user else None,
        )
        assert executor_type == expected_executor_type
        assert executor == expected_executor
