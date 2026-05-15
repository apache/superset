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
import threading
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from superset.mcp_service.chart.plugin import ChartTypePlugin

logger = logging.getLogger(__name__)

_REGISTRY: dict[str, "ChartTypePlugin"] = {}
_plugins_loaded = False
_plugins_lock = threading.Lock()

# ---------------------------------------------------------------------------
# Plugin filter — replaced atomically by configure() at app startup.
# Default: all registered plugins visible (no disabled set, no callable).
# ---------------------------------------------------------------------------

PluginEnabledFunc = Callable[[str], bool]


@dataclass(frozen=True)
class _PluginFilterConfig:
    disabled_plugins: frozenset[str] = field(default_factory=frozenset)
    enabled_func: PluginEnabledFunc | None = None


_filter_config: _PluginFilterConfig = _PluginFilterConfig()


def _ensure_plugins_loaded() -> None:
    """Lazily import the plugins package to populate _REGISTRY.

    Called before every registry lookup so the registry is always populated,
    even when callers (tests, chart_utils, validators) import this module
    directly without first importing app.py.
    """
    global _plugins_loaded
    if _plugins_loaded:
        return
    with _plugins_lock:
        if not _plugins_loaded:
            try:
                import superset.mcp_service.chart.plugins  # noqa: F401

                _plugins_loaded = True
            except Exception:
                logger.exception("Failed to load built-in chart type plugins")


def configure(
    disabled: Iterable[str] | None = None,
    enabled_func: PluginEnabledFunc | None = None,
) -> None:
    """Set runtime plugin filters. Called once during app initialization.

    Replaces the filter config atomically with a single assignment so concurrent
    readers always observe a consistent (disabled_plugins, enabled_func) pair.

    Args:
        disabled: chart_type strings to suppress. Accepts any iterable (set,
            frozenset, list, tuple). Ignored when enabled_func is provided.
        enabled_func: callable(chart_type) -> bool.  When set, overrides
            ``disabled``.  Must be cheap and in-process — no network I/O per
            call.  On exception the registry fails *closed* (plugin hidden).
    """
    global _filter_config

    if enabled_func is not None and not callable(enabled_func):
        raise TypeError("enabled_func must be callable or None")

    new_config = _PluginFilterConfig(
        disabled_plugins=frozenset(disabled or ()),
        enabled_func=enabled_func,
    )
    _filter_config = new_config

    if new_config.disabled_plugins:
        logger.info(
            "MCP chart plugins disabled: %s", sorted(new_config.disabled_plugins)
        )
    if new_config.enabled_func is not None:
        logger.info(
            "MCP chart plugin dynamic filter configured: %r", new_config.enabled_func
        )


def _is_plugin_enabled(chart_type: str) -> bool:
    """Return True if the plugin is currently enabled (not filtered out)."""
    config = _filter_config  # read once — atomic reference in CPython
    if config.enabled_func is not None:
        try:
            return bool(config.enabled_func(chart_type))
        except Exception:
            logger.warning(
                "MCP_CHART_PLUGIN_ENABLED_FUNC raised for chart_type=%r; "
                "failing closed (plugin hidden)",
                chart_type,
                exc_info=True,
            )
            return False
    return chart_type not in config.disabled_plugins


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
    """Return the plugin for chart_type, or None if unknown or disabled."""
    _ensure_plugins_loaded()
    if chart_type not in _REGISTRY or not _is_plugin_enabled(chart_type):
        return None
    return _REGISTRY[chart_type]


def all_types() -> list[str]:
    """Return enabled registered chart type strings in insertion order."""
    _ensure_plugins_loaded()
    return [ct for ct in _REGISTRY if _is_plugin_enabled(ct)]


def is_registered(chart_type: str) -> bool:
    """Return True if chart_type has a registered plugin, regardless of enabled state.

    Use this to distinguish an unknown chart type from a disabled one.
    Use is_enabled() to check whether the plugin is currently available.
    """
    _ensure_plugins_loaded()
    return chart_type in _REGISTRY


def is_enabled(chart_type: str) -> bool:
    """Return True if chart_type is registered AND currently enabled."""
    _ensure_plugins_loaded()
    return chart_type in _REGISTRY and _is_plugin_enabled(chart_type)


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

    def is_enabled(self, chart_type: str) -> bool:
        return is_enabled(chart_type)

    def display_name_for_viz_type(self, viz_type: str) -> str | None:
        return display_name_for_viz_type(viz_type)
