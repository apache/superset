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
from __future__ import annotations

from typing import Any

from superset_core.widgets import Widget

from superset import security_manager
from superset.commands.widget.exceptions import (
    SavedWidgetForbiddenError,
    SavedWidgetNotFoundError,
    WidgetInvalidError,
)
from superset.daos.saved_widget import SavedWidgetDAO
from superset.models.saved_widget import SavedWidget
from superset.utils.core import get_user_id
from superset.widgets.registry import registry


def validate_widget_props(widget_type: Any, props: Any) -> type[Widget]:
    """The registered widget class, once ``props`` pass its commit-time validation."""
    widget_cls = registry.get(str(widget_type))
    if widget_cls is None:
        raise WidgetInvalidError(f"Unknown widget type {widget_type!r}.")
    if not isinstance(props, dict):
        raise WidgetInvalidError("Widget props must be an object.")
    if errors := widget_cls.validate_control_values(props):
        raise WidgetInvalidError("Widget props failed validation.", errors)
    return widget_cls


def load_saved_widget(ref: str) -> SavedWidget:
    """A saved widget the caller may read; a guest's token must name it."""
    widget = SavedWidgetDAO.find_by_uuid(ref)
    if widget is None:
        raise SavedWidgetNotFoundError(ref)
    if security_manager.is_guest_user() and not (
        security_manager.guest_token_names_widget(str(widget.uuid))
    ):
        raise SavedWidgetForbiddenError()
    return widget


def raise_for_widget_ownership(widget: SavedWidget) -> None:
    if security_manager.is_guest_user():
        raise SavedWidgetForbiddenError()
    if security_manager.is_admin():
        return
    user_id = get_user_id()
    if user_id is None or widget.created_by_fk != user_id:
        raise SavedWidgetForbiddenError()


def serialize_saved_widget(widget: SavedWidget) -> dict[str, Any]:
    return {
        "uuid": str(widget.uuid),
        "widget_type": widget.widget_type,
        "title": widget.title,
        "props": widget.props_dict,
        "dataset_id": widget.dataset_id,
        "changed_on": widget.changed_on,
    }
