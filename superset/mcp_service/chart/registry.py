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
ChartTypeRegistry — central registry mapping chart_type strings to plugins.

Replaces the four previously-scattered dispatch locations:
  - schema_validator.py: chart_type_validators dict
  - dataset_validator.py: isinstance branches in _extract_column_references()
  - chart_utils.py: if/elif chain in map_config_to_form_data()
  - dataset_validator.py: isinstance branches in normalize_column_names()

Usage::

    from superset.mcp_service.chart.registry import get_registry

    plugin = get_registry().get("xy")
    if plugin is None:
        raise ValueError("Unknown chart type: xy")
    form_data = plugin.to_form_data(config, dataset_id)
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from superset.mcp_service.chart.plugin import ChartTypePlugin

logger = logging.getLogger(__name__)

_REGISTRY: dict[str, "ChartTypePlugin"] = {}
_plugins_loaded = False


def _ensure_plugins_loaded() -> None:
    """Lazily import the plugins package to populate _REGISTRY.

    Called before every registry lookup so the registry is always populated,
    even when callers (tests, chart_utils, validators) import this module
    directly without first importing app.py.
    """
    global _plugins_loaded
    if not _plugins_loaded:
        _plugins_loaded = True
        import superset.mcp_service.chart.plugins  # noqa: F401


def register(plugin: "ChartTypePlugin") -> None:
    """Register a chart type plugin in the global registry."""
    if not plugin.chart_type:
        raise ValueError(f"{type(plugin).__name__} must define a non-empty chart_type")
    if plugin.chart_type in _REGISTRY:
        logger.warning(
            "Overwriting existing plugin for chart_type=%r", plugin.chart_type
        )
    _REGISTRY[plugin.chart_type] = plugin
    logger.debug("Registered chart plugin: %r", plugin.chart_type)


def get(chart_type: str) -> "ChartTypePlugin | None":
    """Return the plugin for a given chart_type, or None if not registered."""
    _ensure_plugins_loaded()
    return _REGISTRY.get(chart_type)


def all_types() -> list[str]:
    """Return all registered chart type strings in insertion order."""
    _ensure_plugins_loaded()
    return list(_REGISTRY.keys())


def is_registered(chart_type: str) -> bool:
    """Return True if chart_type has a registered plugin."""
    _ensure_plugins_loaded()
    return chart_type in _REGISTRY


def display_name_for_viz_type(viz_type: str) -> str | None:
    """Return the user-facing display name for a Superset-internal viz_type.

    Searches every registered plugin's ``native_viz_types`` mapping.
    Returns None if no plugin recognises the viz_type.

    Example::

        display_name_for_viz_type("echarts_timeseries_line")  # "Line Chart"
        display_name_for_viz_type("pivot_table_v2")           # "Pivot Table"
        display_name_for_viz_type("unknown_type")             # None
    """
    _ensure_plugins_loaded()
    for plugin in _REGISTRY.values():
        name = plugin.native_viz_types.get(viz_type)
        if name is not None:
            return name
    return None


def get_registry() -> "_RegistryProxy":
    """Return a proxy object for registry access (convenience wrapper)."""
    return _RegistryProxy()


class _RegistryProxy:
    """Thin proxy exposing registry functions as instance methods."""

    def get(self, chart_type: str) -> "ChartTypePlugin | None":
        return get(chart_type)

    def all_types(self) -> list[str]:
        return all_types()

    def is_registered(self, chart_type: str) -> bool:
        return is_registered(chart_type)

    def display_name_for_viz_type(self, viz_type: str) -> str | None:
        return display_name_for_viz_type(viz_type)
