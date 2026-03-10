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
User-friendly display names for chart viz_type identifiers.

Legacy chart names are read from ``BaseViz.verbose_name`` in
``superset/viz.py``, avoiding a duplicate hardcoded list.
Modern frontend-only chart plugins define their names in TypeScript
``ChartMetadata.name``, which is not accessible from the Python backend,
so a small overrides dict is maintained here for those.
"""

import logging

logger = logging.getLogger(__name__)

# Display names for modern chart plugins that exist only in the frontend
# (TypeScript ChartMetadata.name) and have no BaseViz subclass in viz.py.
# These take precedence over viz.py verbose_name when both exist.
# See also: superset-frontend/packages/superset-ui-core/src/chart/types/VizType.ts
_FRONTEND_ONLY_NAMES: dict[str, str] = {
    # ECharts time-series variants
    "echarts_timeseries": "Generic Chart",
    "echarts_timeseries_line": "Line Chart",
    "echarts_timeseries_bar": "Bar Chart",
    "echarts_timeseries_scatter": "Scatter Plot",
    "echarts_timeseries_smooth": "Smooth Line",
    "echarts_timeseries_step": "Stepped Line",
    "echarts_area": "Area Chart",
    # ECharts categorical / statistical
    "pie": "Pie Chart",
    "box_plot": "Box Plot",
    "heatmap_v2": "Heatmap",
    "histogram_v2": "Histogram",
    "radar": "Radar Chart",
    "funnel": "Funnel Chart",
    "gauge_chart": "Gauge Chart",
    "graph_chart": "Graph Chart",
    "mixed_timeseries": "Mixed Chart",
    "treemap_v2": "Treemap",
    "tree_chart": "Tree Chart",
    "sunburst_v2": "Sunburst",
    "sankey_v2": "Sankey Chart",
    "bubble_v2": "Bubble Chart",
    "waterfall": "Waterfall Chart",
    "gantt_chart": "Gantt Chart",
    # Big Number
    "big_number": "Big Number",
    "big_number_total": "Big Number",
    "pop_kpi": "Big Number Period Over Period",
    # Tables
    "table": "Table",
    "ag-grid-table": "Table V2",
    "pivot_table_v2": "Pivot Table",
    # Other frontend-only plugins
    "word_cloud": "Word Cloud",
    "handlebars": "Handlebars",
    "cartodiagram": "Cartodiagram",
}

# Lazy cache for the merged display-names dict (legacy + frontend-only)
_display_names_cache: dict[str, str] | None = None


def _get_legacy_viz_names() -> dict[str, str]:
    """Read display names from BaseViz subclasses in ``superset/viz.py``.

    Iterates all ``BaseViz`` subclasses and collects their
    ``viz_type`` → ``verbose_name`` mapping.  This runs lazily at
    first call so the heavy ``viz.py`` import only happens at runtime
    inside a Flask app context.
    """
    try:
        from superset.viz import BaseViz

        def _collect_subclasses(cls: type) -> set[type]:
            return set(cls.__subclasses__()).union(
                sc for c in cls.__subclasses__() for sc in _collect_subclasses(c)
            )

        return {
            cls.viz_type: str(cls.verbose_name)  # type: ignore[attr-defined]
            for cls in _collect_subclasses(BaseViz)
            if cls.viz_type and cls.verbose_name  # type: ignore[attr-defined]
        }
    except (ImportError, RuntimeError):
        logger.debug("Could not load legacy viz names from viz.py")
        return {}


def _build_display_names() -> dict[str, str]:
    """Build the merged display-names dict.

    Legacy ``verbose_name`` values from ``viz.py`` form the base layer.
    Frontend-only overrides are applied on top so that modern chart
    plugins (whose names exist only in TypeScript ``ChartMetadata``)
    get correct display names.
    """
    names = _get_legacy_viz_names()
    # Frontend-only names take precedence
    names.update(_FRONTEND_ONLY_NAMES)
    return names


# Backward-compatible public alias used by tests.
# Contains only the frontend-only overrides; the full merged dict
# is built lazily by get_viz_type_display_name().
VIZ_TYPE_DISPLAY_NAMES = _FRONTEND_ONLY_NAMES


def get_viz_type_display_name(viz_type: str | None) -> str | None:
    """Return the user-friendly display name for a *viz_type*.

    Resolution order:

    1. Frontend-only overrides (modern plugins with no Python metadata)
    2. ``BaseViz.verbose_name`` from ``superset/viz.py`` (legacy charts)
    3. Title-cased transformation of the raw identifier (fallback)
    """
    global _display_names_cache  # noqa: PLW0603

    if not viz_type:
        return None

    if _display_names_cache is None:
        _display_names_cache = _build_display_names()

    if viz_type in _display_names_cache:
        return _display_names_cache[viz_type]

    # Fallback: replace underscores/hyphens with spaces and title-case
    return viz_type.replace("_", " ").replace("-", " ").title()
