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
Authoritative chart type registry for Apache Superset.

Single source of truth for mapping ``viz_type`` identifiers to
user-friendly display names.  Display names are sourced from:

* Legacy charts — ``BaseViz.verbose_name`` in ``superset/viz.py``
* Modern charts — ``ChartMetadata.name`` in frontend TypeScript plugins

Other modules (MCP service, REST API, etc.) should import from here
rather than maintaining their own mappings.
"""

# Complete mapping of viz_type -> display name.
# Organised by category; comments note the origin of each name.
CHART_TYPE_NAMES: dict[str, str] = {
    # -- Legacy charts (verbose_name from superset/viz.py) --
    "bubble": "Bubble Chart",
    "bullet": "Bullet Chart",
    "cal_heatmap": "Calendar Heatmap",
    "chord": "Chord Diagram",
    "compare": "Time Series - Percent Change",
    "country_map": "Country Map",
    "event_flow": "Event Flow",
    "horizon": "Horizon Charts",
    "line": "Time Series - Line Chart",
    "mapbox": "Mapbox",
    "paired_ttest": "Paired t-test Table",
    "para": "Parallel Coordinates",
    "partition": "Partition Diagram",
    "rose": "Nightingale Rose Chart",
    "time_pivot": "Time Series - Period Pivot",
    "time_table": "Time Table View",
    "world_map": "World Map",
    # -- Legacy Deck.gl charts (verbose_name from superset/viz.py) --
    "deck_arc": "Deck.gl - Arc",
    "deck_contour": "Deck.gl - Contour",
    "deck_geojson": "Deck.gl - GeoJSON",
    "deck_grid": "Deck.gl - 3D Grid",
    "deck_heatmap": "Deck.gl - Heatmap",
    "deck_hex": "Deck.gl - 3D HEX",
    "deck_multi": "Deck.gl - Multiple Layers",
    "deck_path": "Deck.gl - Paths",
    "deck_polygon": "Deck.gl - Polygon",
    "deck_scatter": "Deck.gl - Scatter Plot",
    "deck_screengrid": "Deck.gl - Screen Grid",
    # -- Modern ECharts time-series plugins (frontend ChartMetadata.name) --
    "echarts_area": "Area Chart",
    "echarts_timeseries": "Generic Chart",
    "echarts_timeseries_bar": "Bar Chart",
    "echarts_timeseries_line": "Line Chart",
    "echarts_timeseries_scatter": "Scatter Plot",
    "echarts_timeseries_smooth": "Smooth Line",
    "echarts_timeseries_step": "Stepped Line",
    # -- Modern ECharts categorical / statistical plugins --
    "box_plot": "Box Plot",
    "bubble_v2": "Bubble Chart",
    "funnel": "Funnel Chart",
    "gantt_chart": "Gantt Chart",
    "gauge_chart": "Gauge Chart",
    "graph_chart": "Graph Chart",
    "heatmap_v2": "Heatmap",
    "histogram_v2": "Histogram",
    "mixed_timeseries": "Mixed Chart",
    "pie": "Pie Chart",
    "radar": "Radar Chart",
    "sankey_v2": "Sankey Chart",
    "sunburst_v2": "Sunburst",
    "tree_chart": "Tree Chart",
    "treemap_v2": "Treemap",
    "waterfall": "Waterfall Chart",
    # -- Big Number plugins --
    "big_number": "Big Number",
    "big_number_total": "Big Number",
    "pop_kpi": "Big Number Period Over Period",
    # -- Table plugins --
    "ag-grid-table": "Table V2",
    "pivot_table_v2": "Pivot Table",
    "table": "Table",
    # -- Other frontend-only plugins --
    "cartodiagram": "Cartodiagram",
    "handlebars": "Handlebars",
    "word_cloud": "Word Cloud",
}


def get_chart_type_display_name(viz_type: str | None) -> str | None:
    """Return the user-friendly display name for a *viz_type*.

    Lookup order:

    1. ``CHART_TYPE_NAMES`` registry (covers both legacy and modern charts)
    2. Title-cased transformation of the raw identifier (fallback)
    """
    if not viz_type:
        return None

    if viz_type in CHART_TYPE_NAMES:
        return CHART_TYPE_NAMES[viz_type]

    # Fallback: replace underscores/hyphens with spaces and title-case
    return viz_type.replace("_", " ").replace("-", " ").title()
