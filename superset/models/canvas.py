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
"""Canvas: an AI-first dashboard whose widgets are placed on a canvas."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from flask_appbuilder import Model
from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from superset.models.helpers import AuditMixinNullable, UUIDMixin
from superset.subjects.models import canvas_editors, canvas_viewers, Subject
from superset.utils import core as utils, json


class Canvas(AuditMixinNullable, UUIDMixin, Model):
    """
    A canvas and where its widgets are placed.

    Widgets are separate entities; ``definition`` only references them by id
    and holds their placement and filter scopes (see ``superset.canvas``).
    The integer id plus ``uuid`` shape matches the versioned asset models, so
    version history can be enabled later by adding ``__versioned__``.
    """

    __tablename__ = "canvases"

    id = Column(Integer, primary_key=True)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    # The canvas definition as JSON.
    definition = Column(utils.MediumText(), nullable=False)
    definition_version = Column(Integer, nullable=False)
    # Bumped by every accepted definition write; the base for stale-edit
    # detection.
    revision = Column(BigInteger, nullable=False, default=1)
    # Readable URL key; never all digits, so it can't be mistaken for an id.
    slug = Column(String(255), unique=True)
    css = Column(utils.MediumText())
    theme_id = Column(
        Integer, ForeignKey("themes.id", ondelete="SET NULL"), nullable=True
    )
    theme = relationship("Theme", foreign_keys=[theme_id])
    certified_by = Column(Text)
    certification_details = Column(Text)
    is_managed_externally = Column(Boolean, nullable=False, default=False)
    external_url = Column(Text, nullable=True)

    editors = relationship(Subject, secondary=canvas_editors, passive_deletes=True)
    viewers = relationship(Subject, secondary=canvas_viewers, passive_deletes=True)
    ops = relationship(
        "CanvasOp",
        back_populates="canvas",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    def __repr__(self) -> str:
        return f"Canvas<{self.id}>"

    @property
    def url(self) -> str:
        return f"/canvas/{self.slug or self.id}/"


class CanvasOp(Model):
    """
    One applied operation on a canvas definition.

    A write bumps the canvas' ``revision`` once and logs each of its
    operations here under that revision, in order. ``touched`` lists the
    ``[node_id, field_group]`` pairs the operation changed; later writes based
    on an older revision are checked against them. Rows are also the feed that
    lets open viewers catch up on changes since a revision.
    """

    __tablename__ = "canvas_ops"
    __table_args__ = (
        UniqueConstraint(
            "canvas_id",
            "revision",
            "sequence",
            name="uq_canvas_ops_revision_sequence",
        ),
    )

    # An append-only log keyed by (canvas, revision, sequence), never exposed
    # by id, so it keeps an integer key like the versioning tables.
    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True)
    canvas_id = Column(
        Integer,
        ForeignKey("canvases.id", ondelete="CASCADE"),
        nullable=False,
    )
    revision = Column(BigInteger, nullable=False)
    sequence = Column(Integer, nullable=False)
    op = Column(Text, nullable=False)
    touched = Column(Text, nullable=False)
    created_on = Column(DateTime, default=datetime.now, nullable=False)
    created_by_fk = Column(
        Integer, ForeignKey("ab_user.id", ondelete="SET NULL"), nullable=True
    )

    canvas = relationship(Canvas, back_populates="ops")

    @property
    def op_dict(self) -> dict[str, Any]:
        return json.loads(self.op)

    @property
    def touched_pairs(self) -> list[tuple[str, str]]:
        return [(node_id, group) for node_id, group in json.loads(self.touched)]
