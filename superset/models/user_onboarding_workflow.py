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
from flask_appbuilder import Model
from sqlalchemy import Boolean, Column, ForeignKey, Integer
from sqlalchemy.orm import relationship

from superset.models.helpers import AuditMixinNullable


class UserOnboardingWorkflow(Model, AuditMixinNullable):
    """
    Stores per-user state for onboarding workflows.

    This model tracks a user's interaction with a specific onboarding workflow,
    including whether the workflow has been visited and how many times it has
    been completed or re-run. It enables Superset to determine when onboarding
    experiences should be shown automatically and allows users to re-trigger
    workflows as needed.

    This table represents user-specific state only and should not contain any
    workflow definition or UI configuration details.
    """

    __tablename__ = "user_onboarding_workflow"
    user_id = Column(Integer, ForeignKey("ab_user.id"), primary_key=True)
    onboarding_workflow_id = Column(
        Integer, ForeignKey("onboarding_workflow.id"), primary_key=True
    )

    onboarding_workflow = relationship("OnboardingWorkflow")

    visited_times = Column(Integer, default=0)
    should_visit = Column(Boolean, default=False)
