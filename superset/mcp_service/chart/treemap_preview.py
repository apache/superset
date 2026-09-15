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

"""Bounded slice-and-dice Treemap previews using explicit rectangle geometry."""

from __future__ import annotations

import math
from typing import Any

from superset.mcp_service.chart.query_result import (
    metric_result_label,
    normalize_chart_query_result,
)
from superset.mcp_service.chart.schemas import ChartError, VegaLitePreview

# Match the built-in frontend categorical schemes. Unknown schemes are not guessed.
_PALETTES = {
    "supersetColors": [
        "#1FA8C9",
        "#454E7C",
        "#5AC189",
        "#FF7F44",
        "#666666",
        "#E04355",
        "#FCC700",
        "#A868B7",
        "#3CCCCB",
        "#A38F79",
        "#8FD3E4",
        "#A1A6BD",
        "#ACE1C4",
        "#FEC0A1",
        "#B2B2B2",
        "#EFA1AA",
        "#FDE380",
        "#D3B3DA",
        "#9EE5E5",
        "#D1C6BC",
    ],
    "lyftColors": [
        "#EA0B8C",
        "#6C838E",
        "#29ABE2",
        "#33D9C1",
        "#9DACB9",
        "#7560AA",
        "#2D5584",
        "#831C4A",
        "#333D47",
        "#AC2077",
    ],
}
_MAX_ROWS = 1000


def treemap_ascii(
    data: list[dict[str, Any]], form_data: dict[str, Any], width: int = 80
) -> str | ChartError:
    """Show the ordered hierarchy and values rather than unrelated bar geometry."""
    checked = normalize_chart_query_result({"queries": [{"data": data}]}, form_data)
    if isinstance(checked, ChartError):
        return checked
    label = metric_result_label(form_data["metric"])
    assert label is not None
    lines = [f"Treemap hierarchy | {label}"]
    for row in data[:_MAX_ROWS]:
        path = " > ".join(str(row[column]) for column in form_data["groupby"])
        lines.append(f"{path} | {row[label]}")
    if len(data) > _MAX_ROWS:
        lines.append(f"Showing {_MAX_ROWS} of {len(data)} rows")
    return "\n".join(line[:width] for line in lines)


def treemap_vega_lite(  # noqa: C901
    data: list[dict[str, Any]], form_data: dict[str, Any]
) -> VegaLitePreview | ChartError:
    """Render nested metric-proportional rectangles; never substitute scatter/bar marks.

    Vega-Lite has no hierarchy transform. A bounded slice-and-dice layout is
    computed here and sent as explicit coordinates, without executable hooks.
    Native ECharts layout and dashboard interactions remain available in Explore.
    """
    checked = normalize_chart_query_result({"queries": [{"data": data}]}, form_data)
    if isinstance(checked, ChartError):
        return checked
    label = metric_result_label(form_data["metric"])
    assert label is not None
    if not data:
        return ChartError(error="No Treemap data available.", error_type="NoDataError")
    scheme = form_data.get("color_scheme") or "supersetColors"
    if (
        scheme not in _PALETTES
        or form_data.get("currency_format")
        or form_data.get("label_position", "insideTopLeft") != "insideTopLeft"
    ):
        return ChartError(
            error=(
                "This Treemap color/currency/label format requires the native "
                "Explore renderer; use url or table preview."
            ),
            error_type="UnsupportedTreemapPreview",
        )
    if (
        len(data) > _MAX_ROWS
        or any(row[label] < 0 for row in data)
        or not any(row[label] > 0 for row in data)
    ):
        return ChartError(
            error=(
                "Treemap geometry requires at most 1000 nonnegative rows and "
                "a positive total; use table or url preview."
            ),
            error_type="UnsupportedTreemapPreview",
        )
    hierarchy = form_data["groupby"]
    if len(hierarchy) > 20 or not math.isfinite(sum(float(row[label]) for row in data)):
        return ChartError(
            error="Treemap preview requires at most 20 levels and a finite total.",
            error_type="UnsupportedTreemapPreview",
        )
    nodes: list[dict[str, Any]] = []

    def layout(
        rows: list[dict[str, Any]],
        depth: int,
        path: list[str],
        x: float,
        y: float,
        width: float,
        height: float,
    ) -> None:
        """Recursively partition the parent rectangle in hierarchy order."""
        groups: dict[tuple[str, str], list[dict[str, Any]]] = {}
        for row in rows:
            value = row[hierarchy[depth]]
            groups.setdefault((type(value).__name__, str(value)), []).append(row)
        total = sum(float(row[label]) for row in rows)
        offset = 0.0
        for (_, name), children in groups.items():
            value = sum(float(row[label]) for row in children)
            ratio = value / total if total else 0
            nx, ny = (
                (x + offset * width, y) if depth % 2 == 0 else (x, y + offset * height)
            )
            nw, nh = (
                (width * ratio, height) if depth % 2 == 0 else (width, height * ratio)
            )
            node_path = [*path, name]
            leaf = depth == len(hierarchy) - 1
            nodes.append(
                {
                    "x0": nx,
                    "y0": ny,
                    "x1": nx + nw,
                    "y1": ny + nh,
                    "label_y": ny + 14 * depth,
                    "name": name,
                    "path": " > ".join(node_path),
                    "value": value,
                    "leaf": leaf,
                    "depth": depth,
                    "percent": ratio,
                }
            )
            if not leaf:
                layout(children, depth + 1, node_path, nx, ny, nw, nh)
            offset += ratio

    layout(data, 0, [], 0, 0, 600, 400)
    coordinates: dict[str, dict[str, Any]] = {
        "x": {
            "field": "x0",
            "type": "quantitative",
            "scale": {"domain": [0, 600]},
            "axis": None,
        },
        "x2": {"field": "x1"},
        "y": {
            "field": "y0",
            "type": "quantitative",
            "scale": {"domain": [400, 0]},
            "axis": None,
        },
        "y2": {"field": "y1"},
    }
    layers: list[dict[str, Any]] = [
        {
            "mark": {"type": "rect", "stroke": "white", "strokeWidth": 1},
            "encoding": {
                **coordinates,
                "color": {
                    "field": "name",
                    "type": "nominal",
                    "scale": {
                        "range": _PALETTES[scheme],
                        # Native traversal assigns the metric root first.
                        "domain": list(
                            dict.fromkeys([label, *(node["name"] for node in nodes)])
                        ),
                    },
                    "legend": None,
                },
                "tooltip": [
                    {"field": "path", "title": "Hierarchy"},
                    {"field": "value", "type": "quantitative", "title": label},
                    {
                        "field": "percent",
                        "type": "quantitative",
                        "format": ".2%",
                        "title": "Share of parent",
                    },
                ],
            },
        }
    ]
    if form_data.get("show_labels", True) or form_data.get("show_upper_labels", True):
        label_type = form_data.get("label_type", "key_value")
        number_format = form_data.get("number_format") or "SMART_NUMBER"
        from superset.utils import json

        fmt = json.dumps(".3~s" if number_format == "SMART_NUMBER" else number_format)
        expression = (
            "datum.name"
            if label_type in ("key", "Key")
            else f"format(datum.value, {fmt})"
        )
        if label_type == "key_value":
            expression = f"datum.name + ': ' + {expression}"
        leaves = str(bool(form_data.get("show_labels", True))).lower()
        parents = str(bool(form_data.get("show_upper_labels", True))).lower()
        layers.append(
            {
                "transform": [
                    {
                        "filter": (
                            f"(datum.leaf ? {leaves} : {parents}) "
                            "&& datum.x1-datum.x0 > 50 "
                            "&& datum.y1-datum.label_y > 20"
                        )
                    },
                    {"calculate": expression, "as": "label"},
                ],
                "mark": {
                    "type": "text",
                    "align": "left",
                    "baseline": "top",
                    "dx": 3,
                    "dy": 3,
                    "limit": {"expr": "datum.x1 - datum.x0 - 6"},
                },
                "encoding": {
                    "x": coordinates["x"],
                    "y": {**coordinates["y"], "field": "label_y"},
                    "text": {"field": "label"},
                },
            }
        )
    return VegaLitePreview(
        specification={
            "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
            "width": 600,
            "height": 400,
            "data": {"values": nodes},
            "layer": layers,
            "usermeta": {
                "viz_type": "treemap_v2",
                "layout": "slice-and-dice",
                "hierarchy": hierarchy,
                "metric": label,
                "row_count": len(data),
                "native_renderer": False,
                "format_note": (
                    "SMART_NUMBER uses SI approximation; use Explore for native "
                    "formatting and interactions."
                ),
            },
        }
    )
