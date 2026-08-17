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

import logging
from typing import Any

from pydantic import BaseModel

# Reuse the Semantic Layer's schema helper: it turns a Pydantic model into a
# JSON Schema, preserves field order, and blanks ``x-dynamic`` enums when no
# configuration is supplied — the exact machinery the SIP proposes to share.
from superset_core.semantic_layers.config import build_configuration_schema

logger = logging.getLogger(__name__)


class WidgetControls:
    """
    Base class for a schema-driven Dashboard V2 building-widget control set.

    A concrete widget type sets ``widget_type`` (matching the dashboard node's
    ``type``), ``name``/``description``, and a ``controls_class`` (a Pydantic
    model). The model's JSON Schema *is* the control panel; it describes the
    widget's ``node.props`` and is served to both the frontend and MCP.
    """

    widget_type: str
    name: str
    description: str = ""
    controls_class: type[BaseModel]

    @classmethod
    def get_control_schema(
        cls,
        control_values: dict[str, Any] | None = None,
        series: list[str] | None = None,
    ) -> dict[str, Any]:
        """
        Return the JSON Schema for this widget's controls.

        ``control_values`` (the full current ``node.props``) is accepted so
        dynamic fields can be enriched from it, mirroring the Semantic Layer.
        ``series`` carries the distinct dimension values the frontend
        discovered from the query results (they cannot come from
        ``control_values`` alone, which hold the dimension *name*, not its
        values). Partial or invalid values during editing are tolerated and
        fall back to the base schema; enrichment errors propagate so the caller
        can degrade gracefully.
        """
        parsed: BaseModel | None = None
        if control_values:
            try:
                parsed = cls.controls_class.model_validate(control_values)
            except Exception:  # pylint: disable=broad-except
                # Partial control values during editing are expected; fall back
                # to the base schema.
                logger.debug(
                    "Could not validate control values for %s; using base schema",
                    cls.widget_type,
                    exc_info=True,
                )
        schema = build_configuration_schema(cls.controls_class, parsed)
        cls.enrich_schema(schema, parsed, series or [])
        return schema

    @classmethod
    def enrich_schema(
        cls,
        schema: dict[str, Any],
        parsed: BaseModel | None,
        series: list[str],
    ) -> None:
        """
        Hook to populate ``x-dynamic`` fields from the current control values
        and the discovered ``series`` values. Default is a no-op; overridden by
        widgets with dependent fields. Mutates ``schema`` in place.
        """


class WidgetControlsRegistry:
    """In-memory registry of building-widget control sets, keyed by widget type."""

    def __init__(self) -> None:
        self._types: dict[str, type[WidgetControls]] = {}

    def register(self, widget: type[WidgetControls]) -> type[WidgetControls]:
        """Register a widget control set. Usable as a class decorator."""
        self._types[widget.widget_type] = widget
        return widget

    def get(self, widget_type: str) -> type[WidgetControls] | None:
        return self._types.get(widget_type)

    def list(self) -> list[type[WidgetControls]]:
        return list(self._types.values())


registry = WidgetControlsRegistry()
