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
Mapping of internal viz_type identifiers to user-friendly display names.

This module provides human-readable chart type names for MCP responses,
preventing internal implementation details from leaking to end users.
The display names match those shown in the Superset UI.
"""

# Internal viz_type → user-facing display name
VIZ_TYPE_DISPLAY_NAMES: dict[str, str] = {
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
    # Word Cloud / Handlebars / Cartodiagram
    "word_cloud": "Word Cloud",
    "handlebars": "Handlebars",
    "cartodiagram": "Cartodiagram",
    # deck.gl
    "deck_grid": "deck.gl Grid",
    "deck_scatter": "deck.gl Scatterplot",
    "deck_arc": "deck.gl Arc",
    "deck_hexbin": "deck.gl 3D Hexagon",
    "deck_screengrid": "deck.gl Screen Grid",
    "deck_path": "deck.gl Path",
    "deck_heatmap": "deck.gl Heatmap",
    "deck_geojson": "deck.gl GeoJSON",
    "deck_polygon": "deck.gl Polygon",
    "deck_contour": "deck.gl Contour",
    "deck_multi": "deck.gl Multiple Layers",
    # Legacy NVD3
    "bubble": "Bubble Chart",
    "bullet": "Bullet Chart",
    "compare": "Time-series Percent Change",
    "time_pivot": "Time-series Period Pivot",
    # Legacy
    "cal_heatmap": "Calendar Heatmap",
    "chord": "Chord Diagram",
    "country_map": "Country Map",
    "horizon": "Horizon Chart",
    "mapbox": "MapBox",
    "paired_ttest": "Paired t-test Table",
    "para": "Parallel Coordinates",
    "partition": "Partition Chart",
    "rose": "Nightingale Rose Chart",
    "world_map": "World Map",
    "time_table": "Time-series Table",
}


def get_viz_type_display_name(viz_type: str | None) -> str | None:
    """Return the user-friendly display name for a viz_type.

    Falls back to a title-cased transformation of the raw identifier
    when no explicit mapping exists, so new chart plugins still get
    a reasonable label without a code change.
    """
    if not viz_type:
        return None
    if viz_type in VIZ_TYPE_DISPLAY_NAMES:
        return VIZ_TYPE_DISPLAY_NAMES[viz_type]
    # Fallback: replace underscores/hyphens with spaces and title-case
    return viz_type.replace("_", " ").replace("-", " ").title()
