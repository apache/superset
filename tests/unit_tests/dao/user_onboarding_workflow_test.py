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
from __future__ import annotations

from typing import List

import pytest
from flask_appbuilder.security.sqla.models import User

from superset.commands.user_onboarding_workflow.exceptions import (
    UserOnboardingWorkflowNotFoundError,
)
from superset.daos.user_onboarding_workflow import UserOnboardingWorkflowDAO
from superset.models.user_onboarding_workflow import UserOnboardingWorkflow
from tests.unit_tests.fixtures.common import (
    admin_user,  # noqa: F401
    after_each,  # noqa: F401
    onboarding_workflows,  # noqa: F401
)


def test_get_by_user_id(
    admin_user: User,  # noqa: F811
    onboarding_workflows: List[UserOnboardingWorkflow],  # noqa: F811
    after_each: None,  # noqa: F811
) -> None:
    user_onboarding_workflows = UserOnboardingWorkflowDAO.get_by_user_id(admin_user.id)

    assert len(user_onboarding_workflows) > 0
    assert user_onboarding_workflows[0].user_id == admin_user.id
    assert (
        user_onboarding_workflows[0].onboarding_workflow.name
        == "CREATE_DASHBOARD_WITH_NO_EXISTING_CHART"
    )


def test_set_visited(
    admin_user: User,  # noqa: F811
    onboarding_workflows: List[UserOnboardingWorkflow],  # noqa: F811
    after_each: None,  # noqa: F811
) -> None:
    user_onboarding_workflows = UserOnboardingWorkflowDAO.get_by_user_id(admin_user.id)

    assert user_onboarding_workflows[0].should_visit

    last_visited_times = user_onboarding_workflows[0].visited_times
    last_changed_on = user_onboarding_workflows[0].changed_on

    UserOnboardingWorkflowDAO.set_visited(
        admin_user.id, user_onboarding_workflows[0].onboarding_workflow_id
    )

    user_onboarding_workflows = UserOnboardingWorkflowDAO.get_by_user_id(admin_user.id)

    assert not user_onboarding_workflows[0].should_visit
    assert last_visited_times < user_onboarding_workflows[0].visited_times
    assert last_changed_on < user_onboarding_workflows[0].changed_on


def test_set_visited_not_found_onboarding_workflow() -> None:
    with pytest.raises(UserOnboardingWorkflowNotFoundError):
        UserOnboardingWorkflowDAO.set_visited(-1, -1)
