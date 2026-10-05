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
Widget registration decorator for Superset.

This module provides the decorator an extension (or the host) uses to register
a Dashboard V2 widget with the host application, enabling automatic discovery —
the same contract built-in widgets use.

Usage:
    from superset_core.widgets.base import Widget
    from superset_core.widgets.decorators import widget

    @widget(
        widget_type="my-widget",
        name="My Widget",
        description="...",
    )
    class MyWidget(Widget):
        controls_class = MyWidgetControlsModel
"""

from __future__ import annotations

from typing import Callable, TypeVar

# Type variable for decorated widget classes
T = TypeVar("T")


def widget(
    widget_type: str,
    name: str,
    description: str | None = None,
) -> Callable[[T], T]:
    """
    Decorator to register a widget.

    Automatically detects extension context and applies appropriate
    namespacing to prevent ``widget_type`` conflicts between the host and
    extension widgets, and raises on a genuine collision so one widget cannot
    silently replace another's schema.

    Host implementations replace this function during initialization with a
    concrete implementation providing actual functionality.

    Args:
        widget_type: Unique widget type identifier (e.g., "metric-tile",
            "balloons"), matching the dashboard node's ``type``. Used as the key
            in the widget registry.
        name: Human-readable display name (e.g., "Metric Tile"). Shown in the UI
            when listing available widget types.
        description: Optional description for documentation and UI tooltips.

    Returns:
        The decorated widget class, registered with the host application.

    Raises:
        NotImplementedError: If called before the host implementation is
            initialized.

    Example:
        from superset_core.widgets.base import Widget
        from superset_core.widgets.decorators import widget

        @widget(
            widget_type="my-widget",
            name="My Widget",
            description="A custom widget",
        )
        class MyWidget(Widget):
            controls_class = MyWidgetControlsModel
    """
    raise NotImplementedError(
        "Widget decorator not initialized. "
        "This decorator should be replaced during Superset startup."
    )
