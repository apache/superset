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
Where the canvas looks up widget types and persisted widgets.

Widget types come from the registry, which built-ins and extensions register
into with ``@widget``; widget entities through a ``WidgetResolver``. The host
may turn a registered type off (``widget_type_enabled``).
"""

from __future__ import annotations

import logging
from collections.abc import Mapping

from flask import current_app, has_app_context
from superset_core.canvas import WidgetResolver
from superset_core.widgets import Widget

logger = logging.getLogger(__name__)

WidgetTypes = Mapping[str, type[Widget]]

TYPE_TURNED_OFF = "this widget type is turned off"


def get_widget_types() -> WidgetTypes:
    from superset.widgets.registry import registry

    return registry


def widget_type_enabled(widget_type: str) -> bool:
    """
    Whether the host has ``widget_type`` on, asked on every call:
    ``CANVAS_WIDGET_TYPE_ENABLED_FUNC`` when it is set, otherwise
    ``CANVAS_DISABLED_WIDGET_TYPES``. Every type is on outside an app.

    A check that raises turns the type off, so a failed lookup never turns on
    a type the host meant to keep off.
    """
    if not has_app_context():
        return True
    config = current_app.config
    if (enabled := config.get("CANVAS_WIDGET_TYPE_ENABLED_FUNC")) is not None:
        try:
            return bool(enabled(widget_type))
        except Exception:  # pylint: disable=broad-except
            logger.warning(
                "CANVAS_WIDGET_TYPE_ENABLED_FUNC raised for widget_type=%r; "
                "turning it off",
                widget_type,
                exc_info=True,
            )
            return False
    return widget_type not in (config.get("CANVAS_DISABLED_WIDGET_TYPES") or ())


def widget_type_available(widget_type: str) -> bool:
    """
    Whether a placement of ``widget_type`` may render and serve its data: the
    type is registered here and the host has it on. What a type this host
    doesn't know stored was never checked by it, and no page renders it.
    """
    return widget_type in get_widget_types() and widget_type_enabled(widget_type)


_resolver: WidgetResolver | None = None


def set_widget_resolver(resolver: WidgetResolver | None) -> None:
    global _resolver
    _resolver = resolver


def get_widget_resolver() -> WidgetResolver:
    """The configured resolver, by default the ``widgets`` table."""
    if _resolver is not None:
        return _resolver
    from superset.canvas.widgets import DatabaseWidgetResolver

    return DatabaseWidgetResolver()
