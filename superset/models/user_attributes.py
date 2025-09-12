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

from typing import TYPE_CHECKING

from flask_appbuilder import Model

if TYPE_CHECKING:
    from superset.models.dashboard import Dashboard
from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, relationship

from superset import security_manager
from superset.models.helpers import AuditMixinNullable


class UserAttribute(Model, AuditMixinNullable):
    """
    Custom attributes attached to the user.

    Extending the user attribute is tricky due to its dependency on the
    authentication type and circular dependencies in Superset. Instead, we use
    a custom model for adding attributes.

    """

    __tablename__ = "user_attribute"
    id: Mapped[int] = Column(Integer, primary_key=True)
    user_id: Mapped[int | None] = Column(Integer, ForeignKey("ab_user.id"))
    user: Mapped[object] = relationship(
        security_manager.user_model, backref="extra_attributes", foreign_keys=[user_id]
    )
    welcome_dashboard_id: Mapped[int | None] = Column(
        Integer, ForeignKey("dashboards.id")
    )
    welcome_dashboard: Mapped["Dashboard"] = relationship("Dashboard")
    avatar_url: Mapped[str | None] = Column(String(100))
