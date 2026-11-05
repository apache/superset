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
Widgets a draft or a batch of operations created or changed, layered over the
saved ones until they are saved with the canvas.
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from superset_core.canvas import StoredWidget, WidgetResolver


class PendingWidgetResolver:
    """
    ``base`` with the widgets a draft created or changed layered on top.

    A widget created in the draft can be placed and edited by whoever holds
    the draft; it exists nowhere else until the draft is saved.
    """

    def __init__(self, base: WidgetResolver, pending: dict[str, StoredWidget]) -> None:
        self.base = base
        self.pending = pending

    def _rest(self, widget_ids: Iterable[str]) -> set[str]:
        return set(widget_ids) - set(self.pending)

    def _mine(self, widget_ids: Iterable[str]) -> set[str]:
        return set(widget_ids) & set(self.pending)

    def widget_types(self, widget_ids: Iterable[str]) -> dict[str, str]:
        ids = set(widget_ids)
        return {
            **self.base.widget_types(self._rest(ids)),
            **{i: self.pending[i].widget_type for i in self._mine(ids)},
        }

    def placeable(self, widget_ids: Iterable[str]) -> set[str]:
        ids = set(widget_ids)
        return self.base.placeable(self._rest(ids)) | self._mine(ids)

    def widgets(self, widget_ids: Iterable[str]) -> dict[str, StoredWidget]:
        ids = set(widget_ids)
        return {
            **self.base.widgets(self._rest(ids)),
            **{i: self.pending[i] for i in self._mine(ids)},
        }

    def editable(self, widget_ids: Iterable[str]) -> set[str]:
        ids = set(widget_ids)
        new = {i for i in self._mine(ids) if self.pending[i].revision is None}
        return self.base.editable(ids - new) | new


def pending_to_value(pending: dict[str, StoredWidget]) -> dict[str, Any]:
    """Draft widgets as stored with the draft."""
    return {
        widget_id: {
            "widgetType": widget.widget_type,
            "schemaVersion": widget.schema_version,
            "name": widget.name,
            "props": widget.props,
            "revision": widget.revision,
        }
        for widget_id, widget in pending.items()
    }


def pending_from_value(value: dict[str, Any]) -> dict[str, StoredWidget]:
    return {
        widget_id: StoredWidget(
            widget_type=widget["widgetType"],
            schema_version=widget["schemaVersion"],
            name=widget["name"],
            props=widget["props"],
            revision=widget.get("revision"),
        )
        for widget_id, widget in value.items()
    }


def widget_payload(widgets: dict[str, StoredWidget]) -> dict[str, Any]:
    """Widget content as the canvas API returns it, keyed by UUID."""
    return {
        widget_id: {
            "widgetType": widget.widget_type,
            "schemaVersion": widget.schema_version,
            "name": widget.name,
            "props": widget.props,
        }
        for widget_id, widget in widgets.items()
    }
