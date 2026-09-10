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

"""Native geographic chart mapping shared by the three public map types."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, ClassVar

from superset.mcp_service.chart.chart_utils import (
    _add_adhoc_filters,
    create_metric_object,
)
from superset.mcp_service.chart.plugin import BaseChartPlugin
from superset.mcp_service.chart.schemas import (
    ColumnRef,
    CountryMapChartConfig,
    DeckScatterChartConfig,
    WorldMapChartConfig,
)
from superset.mcp_service.chart.validation.dataset_validator import DatasetValidator

GeographicConfig = CountryMapChartConfig | WorldMapChartConfig | DeckScatterChartConfig
ROLE_FIELDS = (
    "entity",
    "metric",
    "secondary_metric",
    "latitude",
    "longitude",
    "dimension",
    "radius_metric",
)


class GeographicChartPlugin(BaseChartPlugin):
    """Translate explicit geographic roles into native plugin controls."""

    native_viz_types: ClassVar[Mapping[str, str]] = {}

    def extract_column_refs(self, config: GeographicConfig) -> list[ColumnRef]:
        """Include all spatial, metric, and filter references."""
        refs = [
            ref
            for field in ROLE_FIELDS
            if (ref := getattr(config, field, None)) is not None
        ]
        refs.extend(ColumnRef(name=f.column) for f in config.filters or [])
        return refs

    def normalize_column_refs(
        self, config: GeographicConfig, dataset_context: Any
    ) -> GeographicConfig:
        """Canonicalize dataset identifiers without losing explicit field sets."""
        patch = config.model_dump(exclude_unset=True)
        for field in ROLE_FIELDS:
            ref = patch.get(field)
            if ref and ref.get("name"):
                canonical = (
                    DatasetValidator.get_canonical_metric_name
                    if ref.get("saved_metric")
                    else DatasetValidator.get_canonical_column_name
                )
                ref["name"] = canonical(ref["name"], dataset_context)
        DatasetValidator.normalize_filters(patch, dataset_context)
        return type(config).model_validate(patch)

    def resolve_viz_type(self, config: GeographicConfig) -> str:
        """Public names match frontend registration keys."""
        return config.chart_type

    def generate_name(
        self, config: GeographicConfig, dataset_name: str | None = None
    ) -> str:
        """Name geographic charts without guessing the source geography."""
        return self._with_context(self.display_name, dataset_name)

    def to_form_data(
        self, config: GeographicConfig, dataset_id: int | str | None = None
    ) -> dict[str, Any]:
        """Mirror native country/world/deck Scatter controls and defaults."""
        result: dict[str, Any] = {
            "viz_type": config.chart_type,
            "row_limit": config.row_limit,
            "mcp_geographic": True,
        }
        if config.time_range is not None:
            result["time_range"] = config.time_range
        _add_adhoc_filters(result, config.filters)
        if isinstance(config, CountryMapChartConfig):
            result.update(
                entity=config.entity.name,
                metric=create_metric_object(config.metric),
                select_country=config.country,
                region_format=config.region_format,
                linear_color_scheme=config.linear_color_scheme,
                number_format=config.number_format,
            )
        elif isinstance(config, WorldMapChartConfig):
            result.update(
                entity=config.entity.name,
                metric=create_metric_object(config.metric),
                country_fieldtype=config.country_format,
                secondary_metric=create_metric_object(config.secondary_metric)
                if config.secondary_metric
                else None,
                show_bubbles=config.show_bubbles,
                max_bubble_size=config.max_bubble_size,
                sort_by_metric=config.sort_by_metric,
                linear_color_scheme=config.linear_color_scheme,
                color_by="metric",
                color_picker={"r": 0, "g": 122, "b": 135, "a": 1},
                color_scheme="supersetColors",
                y_axis_format="SMART_NUMBER",
            )
        else:
            radius: dict[str, Any] = {"type": "fix", "value": config.radius}
            if config.radius_metric:
                radius = {
                    "type": "metric",
                    "value": create_metric_object(config.radius_metric),
                }
            result.update(
                spatial={
                    "type": "latlong",
                    "latCol": config.latitude.name,
                    "lonCol": config.longitude.name,
                },
                dimension=config.dimension.name if config.dimension else None,
                point_radius_fixed=radius,
                point_unit=config.point_unit,
                multiplier=1,
                min_radius=2,
                max_radius=250,
                color_picker={"r": 0, "g": 122, "b": 135, "a": 1},
                color_scheme="supersetColors",
                map_renderer="maplibre",
                maplibre_style="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
                viewport={
                    "longitude": 0,
                    "latitude": 0,
                    "zoom": 1,
                    "bearing": 0,
                    "pitch": 0,
                },
                autozoom=True,
                filter_nulls=True,
            )
        return result


class CountryMapChartPlugin(GeographicChartPlugin):
    """Register the Country Map visualization."""

    chart_type = "country_map"
    display_name = "Country Map"
    native_viz_types: ClassVar[Mapping[str, str]] = {"country_map": "Country Map"}


class WorldMapChartPlugin(GeographicChartPlugin):
    """Register the World Map visualization."""

    chart_type = "world_map"
    display_name = "World Map"
    native_viz_types: ClassVar[Mapping[str, str]] = {"world_map": "World Map"}


class DeckScatterChartPlugin(GeographicChartPlugin):
    """Register the Geographic Points visualization."""

    chart_type = "deck_scatter"
    display_name = "Geographic Points"
    native_viz_types: ClassVar[Mapping[str, str]] = {
        "deck_scatter": "Geographic Points"
    }
