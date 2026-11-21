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
"""Widget model for the Widget Framework."""

from __future__ import annotations

from flask_appbuilder import Model
from sqlalchemy import Column, Index, Integer, JSON, String, Text
from sqlalchemy.orm import relationship
from superset_core.widgets.models import WidgetModel as CoreWidgetModel

from superset.models.helpers import AuditMixinNullable, ImportExportMixin
from superset.subjects.models import Subject, widget_editors, widget_viewers


class Widget(CoreWidgetModel, AuditMixinNullable, ImportExportMixin, Model):
    """
    A saved, permissioned widget.

    ``widget_type`` is the namespaced id of the registered widget class this is
    an occurrence of, and ``props`` holds its type-specific values, valid against
    that type's schema at ``schema_version``. ``name`` and ``description`` are
    common to every widget, so they are columns rather than props. ``revision``
    increments on every change and guards against concurrent edits.
    """

    __tablename__ = "widgets"
    __table_args__ = (Index("idx_widgets_widget_type", "widget_type"),)

    id = Column(Integer, primary_key=True)
    widget_type = Column(String(250), nullable=False)
    schema_version = Column(Integer, nullable=False, default=1)
    name = Column(String(250), nullable=False)
    description = Column(Text, nullable=True)
    props = Column(JSON, nullable=False, default=dict)
    revision = Column(Integer, nullable=False, default=1)

    # Optimistic concurrency: every UPDATE is issued as
    # ``... WHERE id = :id AND revision = :loaded_revision``, so a concurrent
    # write raises ``StaleDataError`` instead of being silently overwritten. The
    # update command bumps the revision itself (``version_id_generator=False``),
    # which also forces a row UPDATE when only editors or viewers change.
    __mapper_args__ = {"version_id_col": revision, "version_id_generator": False}

    editors = relationship(Subject, secondary=widget_editors, passive_deletes=True)
    viewers = relationship(Subject, secondary=widget_viewers, passive_deletes=True)

    export_fields = ["widget_type", "schema_version", "name", "description", "props"]

    def __repr__(self) -> str:
        return f"<Widget {self.uuid} ({self.widget_type})>"
