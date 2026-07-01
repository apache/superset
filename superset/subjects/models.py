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
from sqlalchemy import (
    Boolean,
    Column,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy_utils import UUIDType

from superset.models.helpers import AuditMixinNullable
from superset.subjects.types import SubjectType

metadata = Model.metadata  # pylint: disable=no-member


class Subject(AuditMixinNullable, Model):
    """A unified entity representing a User, Role, or Group."""

    __tablename__ = "subjects"
    __table_args__ = (
        Index("ix_subjects_label", "label"),
        Index("ix_subjects_extra_search", "extra_search"),
    )

    id = Column(Integer, primary_key=True)
    uuid = Column(UUIDType(binary=True), nullable=True)
    label = Column(String(255), nullable=False)
    secondary_label = Column(String(255), nullable=True)
    active = Column(Boolean, nullable=True)
    extra_search = Column(String(255), nullable=True)
    type = Column(Integer, nullable=False)
    user_id = Column(
        Integer,
        ForeignKey("ab_user.id", ondelete="CASCADE"),
        unique=True,
        nullable=True,
    )
    role_id = Column(
        Integer,
        ForeignKey("ab_role.id", ondelete="CASCADE"),
        unique=True,
        nullable=True,
    )
    group_id = Column(
        Integer,
        ForeignKey("ab_group.id", ondelete="CASCADE"),
        unique=True,
        nullable=True,
    )

    user = relationship("User", foreign_keys=[user_id], lazy="joined")
    role = relationship("Role", foreign_keys=[role_id], lazy="joined")
    group = relationship("Group", foreign_keys=[group_id], lazy="joined")

    def __repr__(self) -> str:
        return f"Subject<{self.id} {self.label} type={self.type}>"

    @property
    def img(self) -> str | None:
        """Avatar image URL."""
        if self.type == SubjectType.USER and self.user_id:
            return f"/api/v1/user/{self.user_id}/avatar.png"
        return None


# --- Junction tables ---

dashboard_editors = Table(
    "dashboard_editors",
    metadata,
    Column("id", Integer, primary_key=True),
    Column(
        "subject_id",
        Integer,
        ForeignKey("subjects.id", ondelete="CASCADE"),
        nullable=False,
    ),
    Column(
        "dashboard_id",
        Integer,
        ForeignKey("dashboards.id", ondelete="CASCADE"),
        nullable=False,
    ),
    UniqueConstraint("subject_id", "dashboard_id"),
)

dashboard_viewers = Table(
    "dashboard_viewers",
    metadata,
    Column("id", Integer, primary_key=True),
    Column(
        "subject_id",
        Integer,
        ForeignKey("subjects.id", ondelete="CASCADE"),
        nullable=False,
    ),
    Column(
        "dashboard_id",
        Integer,
        ForeignKey("dashboards.id", ondelete="CASCADE"),
        nullable=False,
    ),
    UniqueConstraint("subject_id", "dashboard_id"),
)

chart_editors = Table(
    "chart_editors",
    metadata,
    Column("id", Integer, primary_key=True),
    Column(
        "subject_id",
        Integer,
        ForeignKey("subjects.id", ondelete="CASCADE"),
        nullable=False,
    ),
    Column(
        "chart_id",
        Integer,
        ForeignKey("slices.id", ondelete="CASCADE"),
        nullable=False,
    ),
    UniqueConstraint("subject_id", "chart_id"),
)

chart_viewers = Table(
    "chart_viewers",
    metadata,
    Column("id", Integer, primary_key=True),
    Column(
        "subject_id",
        Integer,
        ForeignKey("subjects.id", ondelete="CASCADE"),
        nullable=False,
    ),
    Column(
        "chart_id",
        Integer,
        ForeignKey("slices.id", ondelete="CASCADE"),
        nullable=False,
    ),
    UniqueConstraint("subject_id", "chart_id"),
)

sqlatable_editors = Table(
    "sqlatable_editors",
    metadata,
    Column("id", Integer, primary_key=True),
    Column(
        "subject_id",
        Integer,
        ForeignKey("subjects.id", ondelete="CASCADE"),
        nullable=False,
    ),
    Column(
        "table_id",
        Integer,
        ForeignKey("tables.id", ondelete="CASCADE"),
        nullable=False,
    ),
    UniqueConstraint("subject_id", "table_id"),
)

report_schedule_editors = Table(
    "report_schedule_editors",
    metadata,
    Column("id", Integer, primary_key=True),
    Column(
        "subject_id",
        Integer,
        ForeignKey("subjects.id", ondelete="CASCADE"),
        nullable=False,
    ),
    Column(
        "report_schedule_id",
        Integer,
        ForeignKey("report_schedule.id", ondelete="CASCADE"),
        nullable=False,
    ),
    UniqueConstraint("subject_id", "report_schedule_id"),
)
