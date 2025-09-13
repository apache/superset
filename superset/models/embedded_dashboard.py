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

import uuid
from typing import TYPE_CHECKING
from uuid import UUID

from flask_appbuilder import Model

if TYPE_CHECKING:
    from superset.models.dashboard import Dashboard
from sqlalchemy import Column, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, relationship
from sqlalchemy_utils import UUIDType

from superset.models.helpers import AuditMixinNullable


class EmbeddedDashboard(Model, AuditMixinNullable):
    """
    A configuration of embedding for a dashboard.
    Currently, the only embeddable resource is the Dashboard.
    If we add new embeddable resource types, this model should probably be renamed.

    References the dashboard, and contains a config for embedding that dashboard.

    This data model allows multiple configurations for a given dashboard,
    but at this time the API only allows setting one.
    """

    __tablename__ = "embedded_dashboards"

    uuid: Mapped[UUID] = Column(
        UUIDType(binary=True), default=uuid.uuid4, primary_key=True
    )
    allow_domain_list: Mapped[str | None] = Column(
        Text
    )  # reference the `allowed_domains` property instead
    dashboard_id: Mapped[int] = Column(
        Integer,
        ForeignKey("dashboards.id", ondelete="CASCADE"),
        nullable=False,
    )
    dashboard: Mapped["Dashboard"] = relationship(
        "Dashboard",
        back_populates="embedded",
        foreign_keys=[dashboard_id],
    )

    @property
    def allowed_domains(self) -> list[str]:
        """
        A list of domains which are allowed to embed the dashboard.
        An empty list means any domain can embed.
        """
        return self.allow_domain_list.split(",") if self.allow_domain_list else []
