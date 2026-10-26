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
"""The widget entities a canvas places, looked up in the ``widgets`` table."""

from __future__ import annotations

from collections.abc import Iterable
from uuid import UUID

from superset_core.canvas import StoredWidget

from superset import db, security_manager
from superset.daos.widget import WidgetDAO
from superset.widgets.models import Widget


def _uuids(widget_ids: Iterable[str]) -> list[UUID]:
    uuids = []
    for widget_id in widget_ids:
        try:
            uuids.append(UUID(str(widget_id)))
        except ValueError:
            continue
    return uuids


def _rows(widget_ids: Iterable[str]) -> list[Widget]:
    uuids = _uuids(widget_ids)
    if not uuids:
        return []
    query = db.session.query(Widget)
    return query.filter(Widget.uuid.in_(uuids)).all()  # type: ignore[attr-defined]


def stored(widget: Widget) -> StoredWidget:
    return StoredWidget(
        widget_type=widget.widget_type,
        schema_version=widget.schema_version,
        name=widget.name,
        props=dict(widget.props or {}),
        revision=widget.revision,
    )


class DatabaseWidgetResolver:
    """Widgets as saved in the ``widgets`` table."""

    def widget_types(self, widget_ids: Iterable[str]) -> dict[str, str]:
        return {str(row.uuid): row.widget_type for row in _rows(widget_ids)}

    def placeable(self, widget_ids: Iterable[str]) -> set[str]:
        uuids = _uuids(widget_ids)
        if not uuids:
            return set()
        readable = WidgetDAO.find_by_ids(uuids, id_column="uuid")  # type: ignore[arg-type]
        return {str(widget.uuid) for widget in readable}

    def widgets(self, widget_ids: Iterable[str]) -> dict[str, StoredWidget]:
        return {str(row.uuid): stored(row) for row in _rows(widget_ids)}

    def editable(self, widget_ids: Iterable[str]) -> set[str]:
        return {
            str(row.uuid)
            for row in _rows(widget_ids)
            if security_manager.is_admin() or security_manager.is_editor(row)
        }
