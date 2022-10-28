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

from dataclasses import dataclass
from typing import List, Optional, Union
from unittest.mock import patch

import pytest
from flask_appbuilder.security.sqla.models import User

from superset.reports.types import ReportScheduleExecutor

SELENIUM_USER_ID = 1234


def _get_users(
    params: Optional[Union[int, List[int]]]
) -> Optional[Union[User, List[User]]]:
    if params is None:
        return None
    if isinstance(params, int):
        return User(id=params)
    return [User(id=user) for user in params]


@dataclass
class ReportConfig:
    owners: List[int]
    creator: Optional[int] = None
    modifier: Optional[int] = None


@pytest.mark.parametrize(
    "config,report_config,expected_user",
    [
        (
            [ReportScheduleExecutor.SELENIUM],
            ReportConfig(
                owners=[1, 2],
                creator=3,
                modifier=4,
            ),
            SELENIUM_USER_ID,
        ),
        (
            [
                ReportScheduleExecutor.CREATOR,
                ReportScheduleExecutor.CREATOR_OWNER,
                ReportScheduleExecutor.OWNER,
                ReportScheduleExecutor.MODIFIER,
                ReportScheduleExecutor.MODIFIER_OWNER,
                ReportScheduleExecutor.SELENIUM,
            ],
            ReportConfig(owners=[]),
            SELENIUM_USER_ID,
        ),
        (
            [
                ReportScheduleExecutor.CREATOR,
                ReportScheduleExecutor.CREATOR_OWNER,
                ReportScheduleExecutor.OWNER,
                ReportScheduleExecutor.MODIFIER,
                ReportScheduleExecutor.MODIFIER_OWNER,
                ReportScheduleExecutor.SELENIUM,
            ],
            ReportConfig(owners=[], modifier=1),
            1,
        ),
        (
            [
                ReportScheduleExecutor.CREATOR,
                ReportScheduleExecutor.CREATOR_OWNER,
                ReportScheduleExecutor.OWNER,
                ReportScheduleExecutor.MODIFIER,
                ReportScheduleExecutor.MODIFIER_OWNER,
                ReportScheduleExecutor.SELENIUM,
            ],
            ReportConfig(owners=[2], modifier=1),
            2,
        ),
        (
            [
                ReportScheduleExecutor.CREATOR,
                ReportScheduleExecutor.CREATOR_OWNER,
                ReportScheduleExecutor.OWNER,
                ReportScheduleExecutor.MODIFIER,
                ReportScheduleExecutor.MODIFIER_OWNER,
                ReportScheduleExecutor.SELENIUM,
            ],
            ReportConfig(owners=[2], creator=3, modifier=1),
            3,
        ),
        (
            [
                ReportScheduleExecutor.OWNER,
            ],
            ReportConfig(owners=[1, 2, 3, 4, 5, 6, 7], creator=3, modifier=4),
            4,
        ),
        (
            [
                ReportScheduleExecutor.OWNER,
            ],
            ReportConfig(owners=[1, 2, 3, 4, 5, 6, 7], creator=3, modifier=8),
            3,
        ),
        (
            [
                ReportScheduleExecutor.MODIFIER_OWNER,
            ],
            ReportConfig(owners=[1, 2, 3, 4, 5, 6, 7], creator=8, modifier=9),
            None,
        ),
        (
            [
                ReportScheduleExecutor.MODIFIER_OWNER,
            ],
            ReportConfig(owners=[1, 2, 3, 4, 5, 6, 7], creator=8, modifier=4),
            4,
        ),
        (
            [
                ReportScheduleExecutor.CREATOR_OWNER,
            ],
            ReportConfig(owners=[1, 2, 3, 4, 5, 6, 7], creator=8, modifier=9),
            None,
        ),
        (
            [
                ReportScheduleExecutor.CREATOR_OWNER,
            ],
            ReportConfig(owners=[1, 2, 3, 4, 5, 6, 7], creator=4, modifier=8),
            4,
        ),
    ],
)
def test_get_executor(
    config: List[ReportScheduleExecutor],
    report_config: ReportConfig,
    expected_user: Optional[int],
) -> None:
    from superset import app, security_manager
    from superset.reports.commands.exceptions import ReportScheduleUserNotFoundError
    from superset.reports.models import ReportSchedule
    from superset.reports.utils import get_executor

    selenium_user = User(id=SELENIUM_USER_ID)

    with patch.dict(app.config, {"ALERT_REPORTS_EXECUTE_AS": config}), patch.object(
        security_manager, "find_user", return_value=selenium_user
    ):
        report_schedule = ReportSchedule(
            id=1,
            type="report",
            name="test_report",
            owners=_get_users(report_config.owners),
            created_by=_get_users(report_config.creator),
            changed_by=_get_users(report_config.modifier),
        )
        if expected_user is None:
            with pytest.raises(ReportScheduleUserNotFoundError):
                get_executor(report_schedule)
        else:
            assert get_executor(report_schedule).id == expected_user
