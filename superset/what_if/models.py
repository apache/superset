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
"""What-If Simulation persistence models."""

from __future__ import annotations

import json
import uuid
from typing import Any

from flask_appbuilder import Model
from sqlalchemy import Boolean, Column, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy_utils import UUIDType

from superset import security_manager
from superset.models.helpers import AuditMixinNullable


class WhatIfSimulation(Model, AuditMixinNullable):
    """Saved What-If simulation configuration."""

    __tablename__ = "what_if_simulations"

    id = Column(Integer, primary_key=True)
    uuid = Column(
        UUIDType(binary=True), default=uuid.uuid4, unique=True, nullable=False
    )
    name = Column(String(256), nullable=False)
    description = Column(Text, nullable=True)
    dashboard_id = Column(
        Integer, ForeignKey("dashboards.id", ondelete="CASCADE"), nullable=False
    )
    user_id = Column(Integer, ForeignKey("ab_user.id"), nullable=False)

    # JSON column storing modifications array
    # Structure: [{"column": "...", "multiplier": 1.1, "filters": [...]}]
    modifications_json = Column(Text, nullable=False)

    # Whether cascading effects were enabled when saved
    cascading_effects_enabled = Column(Boolean, default=False, nullable=False)

    # Relationships
    dashboard = relationship(
        "Dashboard",
        foreign_keys=[dashboard_id],
        backref="what_if_simulations",
    )
    user = relationship(
        security_manager.user_model,
        foreign_keys=[user_id],
    )

    __table_args__ = (
        Index("ix_what_if_simulations_dashboard_user", dashboard_id, user_id),
    )

    @property
    def modifications(self) -> list[dict[str, Any]]:
        """Parse and return modifications from JSON."""
        if self.modifications_json:
            return json.loads(self.modifications_json)
        return []

    @modifications.setter
    def modifications(self, value: list[dict[str, Any]]) -> None:
        """Serialize modifications to JSON."""
        self.modifications_json = json.dumps(value)

    def __repr__(self) -> str:
        return f"WhatIfSimulation<{self.name}>"
