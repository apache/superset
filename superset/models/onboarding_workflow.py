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
from sqlalchemy import Column, Integer, String

from superset.models.helpers import AuditMixinNullable


class OnboardingWorkflow(Model, AuditMixinNullable):
    """
    Represents a high-level onboarding workflow definition.

    An onboarding workflow defines a guided user experience (e.g. creating a
    dashboard or chart) that can be presented to users as part of Superset’s
    onboarding system. This model stores the static metadata for each workflow
    and is intended to be reusable across all users.

    User-specific progress and visitation state (e.g. whether a workflow has
    been completed or how many times it has been viewed) is tracked separately
    and should not be stored on this model.
    """

    __tablename__ = "onboarding_workflow"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True)
    description = Column(String(255))
