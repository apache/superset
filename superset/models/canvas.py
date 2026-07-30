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
"""A Canvas is a v2, AI-native dashboard.

Unlike a v1 ``Dashboard`` (which stores a ``position_json`` layout referencing
saved charts), a Canvas stores a single CDL (Canvas Definition Language) tree in
``definition`` — a typed, declarative component tree an AI emits and the
``CanvasRenderer`` walks.
"""

from __future__ import annotations

from flask_appbuilder import Model
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from superset.models.helpers import AuditMixinNullable, UUIDMixin
from superset.subjects.models import canvas_editors, canvas_viewers, Subject
from superset.utils.core import MediumText


class Canvas(AuditMixinNullable, UUIDMixin, Model):
    __tablename__ = "canvas"

    id = Column(Integer, primary_key=True)
    name = Column(String(500), nullable=False, default="Untitled canvas")
    # The CDL definition, stored as a JSON string.
    definition = Column(MediumText())

    editors = relationship(Subject, secondary=canvas_editors, passive_deletes=True)
    viewers = relationship(Subject, secondary=canvas_viewers, passive_deletes=True)

    def __repr__(self) -> str:
        return f"Canvas<{self.id} {self.name}>"
