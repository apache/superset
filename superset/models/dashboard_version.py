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
"""Dashboard version snapshot model for version history and restore."""

from __future__ import annotations

from flask_appbuilder import Model
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import backref, relationship

from superset import security_manager
from superset.utils import core as utils


class DashboardVersion(Model):
    """
    Append-only snapshot of a dashboard's position_json and json_metadata.
    Used for version history and one-click restore.
    """

    __tablename__ = "dashboard_versions"

    id = Column(Integer, primary_key=True)
    dashboard_id = Column(
        Integer,
        ForeignKey("dashboards.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version_number = Column(Integer, nullable=False)
    description = Column(String(500), nullable=True)
    position_json = Column(utils.MediumText(), nullable=True)
    json_metadata = Column(utils.MediumText(), nullable=True)
    created_at = Column(DateTime, nullable=True)
    created_by_fk = Column(
        Integer,
        ForeignKey("ab_user.id", ondelete="SET NULL"),
        nullable=True,
    )

    dashboard = relationship(
        "Dashboard",
        backref=backref("versions", cascade="all, delete-orphan"),
    )
    created_by = relationship(
        security_manager.user_model,
        foreign_keys=[created_by_fk],
    )

    def __repr__(self) -> str:
        return (
            f"<DashboardVersion(id={self.id}, dashboard_id={self.dashboard_id}, "
            f"version_number={self.version_number})>"
        )
