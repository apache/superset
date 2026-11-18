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
"""
``ArtifactAccess`` on the saved widgets: an artifact's widget, and its editors.

Lookups go through ``WidgetDAO``, whose access filter answers who may read a
widget; ``is_editor`` answers who may change it, through the user's roles and
groups too. An artifact's widget is created here, through the same DAO, with
its author as its editor: the widget row holds its name, editors and viewers,
and the store only its content.
"""

from __future__ import annotations

from uuid import UUID

from superset_core.common.daos import SubjectDAO
from superset_core.common.models import get_session
from superset_core.common.security import is_editor
from superset_core.widgets.daos import WidgetDAO
from superset_core.widgets.models import WidgetModel
from superset_oss.artifacts.constants import WIDGET_TYPE
from superset_oss.artifacts.errors import artifact_not_found


class WidgetAccess:
    """What the signed-in caller may do with artifacts, as their widgets say."""

    def register(self, artifact_id: str, name: str, editor: str) -> None:
        subject = SubjectDAO.find_one_or_none(user_id=int(editor))
        if subject is None:
            raise artifact_not_found(artifact_id)
        session = get_session()
        try:
            WidgetDAO.create(
                attributes={
                    "uuid": UUID(artifact_id),
                    "widget_type": WIDGET_TYPE,
                    "name": name,
                    "props": {},
                    "editors": [subject],
                }
            )
            session.commit()
        except Exception:
            session.rollback()
            raise

    def can_read(self, artifact_id: str) -> bool:
        return self._widget(artifact_id) is not None

    def can_edit(self, artifact_id: str) -> bool:
        widget = self._widget(artifact_id)
        return widget is not None and is_editor(widget)

    @staticmethod
    def _widget(artifact_id: str) -> WidgetModel | None:
        """The artifact's widget, if the caller may read it."""
        try:
            uuid = UUID(artifact_id)
        except (TypeError, ValueError):
            return None
        return WidgetDAO.find_one_or_none(uuid=uuid, widget_type=WIDGET_TYPE)
