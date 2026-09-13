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
"""Dashboard folder models."""

from __future__ import annotations

from uuid import uuid4

from flask_appbuilder import Model
from sqlalchemy import Column, ForeignKey, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy_utils import UUIDType

from superset.models.helpers import AuditMixinNullable
from superset.subjects.models import (
    dashboard_folder_editors,
    dashboard_folder_viewers,
    Subject,
)

metadata = Model.metadata  # pylint: disable=no-member


class DashboardFolder(AuditMixinNullable, Model):
    """A hierarchical folder used to organize dashboards."""

    __tablename__ = "dashboard_folders"

    id = Column(UUIDType(binary=True), primary_key=True, default=uuid4)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    parent_id = Column(
        UUIDType(binary=True),
        ForeignKey("dashboard_folders.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    editors = relationship(
        Subject,
        secondary=dashboard_folder_editors,
        passive_deletes=True,
    )
    viewers = relationship(
        Subject,
        secondary=dashboard_folder_viewers,
        passive_deletes=True,
    )
    dashboards = relationship(
        "Dashboard",
        back_populates="folder",
        passive_deletes=True,
    )
    parent = relationship(
        "DashboardFolder",
        remote_side=[id],
        back_populates="children",
    )
    children = relationship(
        "DashboardFolder",
        back_populates="parent",
        cascade="all, delete-orphan",
        passive_deletes=True,
        single_parent=True,
    )

    def __repr__(self) -> str:
        return f"DashboardFolder<{self.id}: {self.name}>"
