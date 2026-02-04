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

import logging

from rpds import List

from superset.commands.user_onboarding_workflow.exceptions import (
    UserOnboardingWorkflowNotFoundError,
)
from superset.daos.base import BaseDAO
from superset.extensions import db
from superset.models.user_onboarding_workflow import UserOnboardingWorkflow
from superset.utils.decorators import transaction

logger = logging.getLogger(__name__)


class UserOnboardingWorkflowDAO(BaseDAO[UserOnboardingWorkflow]):
    @staticmethod
    def get_by_user_id(user_id: int) -> List[UserOnboardingWorkflow]:
        return (
            db.session.query(UserOnboardingWorkflow)
            .filter_by(user_id=user_id)
            .order_by(UserOnboardingWorkflow.onboarding_workflow_id.asc())
            .all()
        )

    @staticmethod
    @transaction()
    def set_visited(user_id: int, onboarding_workflow_id: int) -> None:
        uow = (
            db.session.query(UserOnboardingWorkflow)
            .filter_by(user_id=user_id, onboarding_workflow_id=onboarding_workflow_id)
            .one_or_none()
        )

        if not uow:
            raise UserOnboardingWorkflowNotFoundError(
                user_id=user_id, onboarding_workflow_id=onboarding_workflow_id
            )

        uow.should_visit = False
        uow.visited_times += 1
