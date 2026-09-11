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
"""Folder models for the analytics folder feature."""

from __future__ import annotations

import uuid

from flask_appbuilder.security.sqla.models import User
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy_utils import UUIDType

from flask_appbuilder import Model
from superset.models.helpers import AuditMixinNullable, SoftDeleteMixin
from superset.subjects.models import Subject

metadata = Model.metadata  # pylint: disable=no-member


# Junction table: folder editors (subjects who can manage folder contents).
folder_editors = Table(
    "folder_editors",
    metadata,
    Column("id", Integer, primary_key=True),
    Column(
        "folder_id",
        Integer,
        ForeignKey("folders.id", ondelete="CASCADE"),
        nullable=False,
    ),
    Column(
        "subject_id",
        Integer,
        ForeignKey("subjects.id", ondelete="CASCADE"),
        nullable=False,
    ),
    UniqueConstraint("folder_id", "subject_id"),
    Index("ix_folder_editors_subject_id", "subject_id"),
)

# Junction table: folder viewers (subjects who can see folder and its assets).
folder_viewers = Table(
    "folder_viewers",
    metadata,
    Column("id", Integer, primary_key=True),
    Column(
        "folder_id",
        Integer,
        ForeignKey("folders.id", ondelete="CASCADE"),
        nullable=False,
    ),
    Column(
        "subject_id",
        Integer,
        ForeignKey("subjects.id", ondelete="CASCADE"),
        nullable=False,
    ),
    UniqueConstraint("folder_id", "subject_id"),
    Index("ix_folder_viewers_subject_id", "subject_id"),
)


class Folder(AuditMixinNullable, SoftDeleteMixin, Model):
    """A folder for organizing dashboards, charts, and datasets."""

    __tablename__ = "folders"
    # Name uniqueness enforced by partial index ix_folders_active_parent_name_type
    # (WHERE deleted_at IS NULL) created in the migration.
    __table_args__: tuple = ()

    id = Column(Integer, primary_key=True)
    uuid = Column(
        UUIDType(binary=True), unique=True, nullable=False, default=uuid.uuid4
    )
    name = Column(String(250), nullable=False)
    description = Column(Text, nullable=True)
    parent_id = Column(Integer, ForeignKey("folders.id"), nullable=True)
    folder_type = Column(String(50), nullable=False, default="analytics")
    is_private = Column(Boolean, nullable=False, default=False)
    is_only_me = Column(Boolean, nullable=False, default=False)
    extra = Column(Text, nullable=True)

    # Relationships
    parent = relationship(
        "Folder",
        remote_side=[id],
        back_populates="children",
    )
    children = relationship(
        "Folder",
        back_populates="parent",
    )
    objects = relationship(
        "FolderObject",
        back_populates="folder",
        cascade="all, delete-orphan",
    )
    editors = relationship(
        Subject,
        secondary=folder_editors,
        primaryjoin=lambda: Folder.id == folder_editors.c.folder_id,
        secondaryjoin=lambda: folder_editors.c.subject_id == Subject.id,
        viewonly=True,
    )
    viewers = relationship(
        Subject,
        secondary=folder_viewers,
        primaryjoin=lambda: Folder.id == folder_viewers.c.folder_id,
        secondaryjoin=lambda: folder_viewers.c.subject_id == Subject.id,
        viewonly=True,
    )

    def __repr__(self) -> str:
        return f"Folder<{self.id or self.name}>"


class FolderObject(Model):
    """Links a folder to an asset (dashboard, chart, or dataset).

    Uses separate FK columns instead of polymorphic object_id/object_type
    so that ON DELETE CASCADE works at the DB level.
    Only one of dashboard_id, chart_id, dataset_id is set per row.

    ``dashboard_id``/``chart_id``/``dataset_id`` reference Superset-owned tables;
    their FK constraints are created by the Preset migration (no declarative
    ``ForeignKey`` here, see module docstring).
    """

    __tablename__ = "folder_objects"
    __table_args__ = (
        CheckConstraint(
            "(CASE WHEN dashboard_id IS NOT NULL THEN 1 ELSE 0 END"
            " + CASE WHEN chart_id IS NOT NULL THEN 1 ELSE 0 END"
            " + CASE WHEN dataset_id IS NOT NULL THEN 1 ELSE 0 END) = 1",
            name="ck_folder_objects_exactly_one_fk",
        ),
        Index("ix_folder_objects_folder_id", "folder_id"),
        Index("ix_folder_objects_chart_id", "chart_id"),
        Index("ix_folder_objects_dashboard_id", "dashboard_id"),
    )

    id = Column(Integer, primary_key=True)
    folder_id = Column(
        Integer,
        ForeignKey("folders.id", ondelete="CASCADE"),
        nullable=False,
    )
    dashboard_id = Column(Integer, nullable=True)
    chart_id = Column(Integer, nullable=True)
    dataset_id = Column(Integer, nullable=True)
    created_on = Column(DateTime, nullable=True)

    # Relationships
    folder = relationship("Folder", back_populates="objects")

    def __repr__(self) -> str:
        asset = (
            f"dashboard={self.dashboard_id}"
            if self.dashboard_id
            else f"chart={self.chart_id}"
            if self.chart_id
            else f"dataset={self.dataset_id}"
        )
        return f"FolderObject<folder={self.folder_id}, {asset}>"


class FolderPin(Model):
    """Per-user pinned items on the Analytics root view.

    Max 3 pins per user (enforced by UNIQUE on user_id + position).
    Pins are user-specific and only shown on the main Analytics view.

    Uses separate FK columns instead of polymorphic object_id/object_type
    so that ON DELETE CASCADE works at the DB level.
    Only one of folder_id, dashboard_id, chart_id is set per row.

    ``user_id``/``dashboard_id``/``chart_id`` reference Superset-owned tables;
    their FK constraints are created by the migration.
    """

    __tablename__ = "folder_pins"
    __table_args__ = (
        UniqueConstraint("user_id", "position"),
        CheckConstraint(
            "position >= 1 AND position <= 3",
            name="ck_folder_pins_position_range",
        ),
        CheckConstraint(
            "(CASE WHEN folder_id IS NOT NULL THEN 1 ELSE 0 END"
            " + CASE WHEN dashboard_id IS NOT NULL THEN 1 ELSE 0 END"
            " + CASE WHEN chart_id IS NOT NULL THEN 1 ELSE 0 END) = 1",
            name="ck_folder_pins_exactly_one_fk",
        ),
        Index("ix_folder_pins_folder_id", "folder_id"),
        Index("ix_folder_pins_dashboard_id", "dashboard_id"),
        Index("ix_folder_pins_chart_id", "chart_id"),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False)
    folder_id = Column(
        Integer,
        ForeignKey("folders.id", ondelete="CASCADE"),
        nullable=True,
    )
    dashboard_id = Column(Integer, nullable=True)
    chart_id = Column(Integer, nullable=True)
    position = Column(Integer, nullable=False)
    created_on = Column(DateTime, nullable=True)

    @property
    def object_type(self) -> str:
        if self.folder_id is not None:
            return "folder"
        if self.dashboard_id is not None:
            return "dashboard"
        return "chart"

    @property
    def object_id(self) -> int:
        if self.folder_id is not None:
            return self.folder_id
        if self.dashboard_id is not None:
            return self.dashboard_id
        return self.chart_id
