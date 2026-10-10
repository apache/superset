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

import logging
import math
import re
from collections.abc import Mapping
from decimal import Decimal
from functools import lru_cache
from numbers import Real
from typing import Any, ClassVar, TypeGuard

from superset.mcp_service.chart.chart_utils import (
    _add_adhoc_filters,
    _apply_geographic_temporal_update,
    _DECK_DATASET_ROLE_KEYS,
    create_metric_object,
    merge_geographic_update_form_data,
)
from superset.mcp_service.chart.plugin import BaseChartPlugin
from superset.mcp_service.chart.query_result import (
    column_result_label,
    metric_result_label,
    query_result_failure,
)
from superset.mcp_service.chart.schemas import (
    ChartError,
    ColumnRef,
    CountryMapChartConfig,
    DeckScatterChartConfig,
    VegaLitePreview,
    WorldMapChartConfig,
)
from superset.mcp_service.chart.validation.dataset_validator import DatasetValidator

logger = logging.getLogger(__name__)

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
MAX_GEOGRAPHIC_ROWS = 10000
ASCII_BANNER = "Geographic source data (geometry not reproduced)"


def _is_finite_geographic_number(value: object) -> TypeGuard[Real | Decimal]:
    """Accept database NUMERIC/real scalars that remain finite in JSON.

    Validation precedes JSON conversion; retain the original Decimal values for
    data/export while rejecting booleans, complex numbers, and numeric strings.
    """
    if isinstance(value, bool) or not isinstance(value, (Real, Decimal)):
        return False
    if isinstance(value, Decimal) and not value.is_finite():
        return False
    try:
        return math.isfinite(value)
    except (OverflowError, ValueError):
        return False


def _decode_geographic_coordinates(value: object, spatial_type: str) -> list[float]:
    """Decode native encoded coordinates for validation, not result replacement."""
    if not isinstance(value, str) or not value:
        raise ValueError("Spatial coordinates require a nonempty string")
    if spatial_type == "geohash":
        import pygeohash

        try:
            latitude, longitude = pygeohash.decode(value.lower())
        except (ValueError, KeyError, TypeError) as ex:
            raise ValueError("Invalid geographic geohash") from ex
        return [longitude, latitude]
    # Match the numeric prefix consumed by JavaScript parseFloat in the native
    # Deck.gl spatial transform, including incomplete exponents and suffixes.
    coordinates: list[float] = []
    for part in value.split(","):
        prefix = re.match(
            r"[+-]?(?:Infinity|(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)"
            r"(?:[eE][+-]?[0-9]+)?)",
            part.lstrip(
                "\t\n\v\f\r \u00a0\u1680\u2000\u2001\u2002\u2003"
                "\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028"
                "\u2029\u202f\u205f\u3000\ufeff"
            ),
        )
        if prefix is None:
            raise ValueError("Invalid delimited geographic coordinates")
        coordinates.append(float(prefix[0]))
    if len(coordinates) != 2:
        raise ValueError("Delimited coordinates require two values")
    return coordinates


@lru_cache(maxsize=4)
def _world_country_entries(field: str) -> tuple[tuple[str, str], ...]:
    """Reuse immutable country aliases for the four supported world formats."""
    from superset.examples.countries import countries

    return tuple(
        (country[field], country["cca3"]) for country in countries if country[field]
    )


def _metric_expression(metric: object) -> tuple[object, ...] | None:
    """Identify native metric expressions without UI labels or column metadata."""
    if isinstance(metric, str):
        return ("saved", metric)
    if not isinstance(metric, Mapping):
        return None
    expression_type = metric.get("expressionType")
    if expression_type == "SQL" and isinstance(metric.get("sqlExpression"), str):
        return (expression_type, metric["sqlExpression"])
    column = metric.get("column")
    if expression_type == "SIMPLE" and isinstance(column, Mapping):
        name = column.get("column_name") or column.get("columnName")
        if isinstance(name, str) and isinstance(metric.get("aggregate"), str):
            return (expression_type, metric["aggregate"], name)
    return None


def _bind_time_column(qd: dict[str, Any], form_data: Mapping[str, Any]) -> None:
    """Bind the legacy SQL time column so a saved ``time_range`` stays applied.

    Native map viz classes filter ``time_range`` on ``granularity_sqla``; a
    normalized dashboard ``granularity`` override takes precedence.
    """
    granularity = form_data.get("granularity", form_data.get("granularity_sqla"))
    if granularity:
        qd["granularity"] = granularity


def _typed_row_limit(form_data: Mapping[str, Any]) -> int:
    """Bound the typed map row limit, matching the frontend's full-map query."""
    try:
        limit = int(form_data.get("row_limit") or MAX_GEOGRAPHIC_ROWS)
    except (TypeError, ValueError, OverflowError):
        return MAX_GEOGRAPHIC_ROWS
    return min(MAX_GEOGRAPHIC_ROWS, max(1, limit))


def _normalize_fixed_radius(form_data: dict[str, Any]) -> None:
    """Save a preserved numeric-string radius as an explicit fixed radius.

    The typed contract reads a bare numeric string as a fixed size, while the
    native Scatter query reads any bare string as a saved metric; the explicit
    ``fix`` object keeps both in agreement.
    """
    from superset.mcp_service.chart.chart_helpers import _is_metric_ref

    radius = form_data.get("point_radius_fixed")
    if not isinstance(radius, str) or not radius or _is_metric_ref(radius):
        return
    value = float(radius)
    if math.isfinite(value):
        form_data["point_radius_fixed"] = {
            "type": "fix",
            "value": int(value) if value.is_integer() else value,
        }


class GeographicChartPlugin(BaseChartPlugin):
    """Translate explicit geographic roles into native plugin controls.

    Typed MCP charts carry ``mcp_geographic`` in their saved form_data. Only
    those charts get the full-map row limits and strict result contract;
    charts built in Explore keep their native behavior.
    """

    native_viz_types: ClassVar[Mapping[str, str]] = {}
    owned_query_roles: ClassVar[frozenset[str]] = frozenset()
    requires_compile_check = True
    requires_config_for_dataset_rebind = True
    dataset_rebind_roles = "geographic/metric roles"
    strict_dataset_rebind = True
    owns_update_merge = True
    normalize_data_results = True
    supports_vega_lite_preview = False
    invalid_result_error_code = "INVALID_GEOGRAPHIC_RESULT"
    invalid_result_message = "Geographic query returned invalid values"
    invalid_result_suggestions: ClassVar[tuple[str, ...]] = (
        "Match country and value format to the source identifiers",
        "Correct source values or filter other geographies",
        "Use finite numeric metrics and valid latitude/longitude",
    )

    # ------------------------------------------------------------------
    # Result contract
    # ------------------------------------------------------------------

    def result_metrics(self, form_data: Mapping[str, Any]) -> list[Any]:
        """Return the metrics whose values every result row must carry."""
        raise NotImplementedError

    def size_metric_labels(
        self, form_data: Mapping[str, Any], labels: list[str]
    ) -> set[str]:
        """Return the metric labels that size marks and must be nonnegative."""
        return set()

    def row_identifier(
        self, row: Mapping[str, Any], form_data: Mapping[str, Any]
    ) -> str | None:
        """Resolve the row's geography, or validate it and return None."""
        raise NotImplementedError

    def build_query_dicts(
        self,
        form_data: dict[str, Any],
        *,
        viz_type: str,
        engine: str,
        row_limit: int | None,
        order_desc: bool | None,
    ) -> list[dict[str, Any]] | None:
        """Build the shared single query, keeping the saved time column bound."""
        from superset.mcp_service.chart.chart_helpers import build_single_query_dict

        fields = self.resolve_query_fields(form_data, viz_type)
        if fields is None:
            return None
        metrics, groupby = fields
        qd = build_single_query_dict(
            form_data, groupby, metrics, row_limit=row_limit, order_desc=order_desc
        )
        # Match the native buildQuery's ``[metric, ascending]`` pair shape.
        qd["orderby"] = [list(item) for item in qd.get("orderby") or []]
        _bind_time_column(qd, form_data)
        return [qd]

    def _metric_labels(self, form_data: Mapping[str, Any]) -> list[str]:
        labels = [metric_result_label(m) for m in self.result_metrics(form_data)]
        if any(label is None for label in labels):
            raise ValueError("Geographic metric has no resolvable result label")
        return [label for label in labels if label is not None]

    def _validate_rows(self, result: Any, form_data: Mapping[str, Any]) -> None:
        if (
            not isinstance(result, Mapping)
            or not isinstance(result.get("queries"), list)
            or len(result["queries"]) != 1
        ):
            raise ValueError("Expected exactly one geographic query result")
        query = result["queries"][0]
        if not isinstance(query, Mapping) or not isinstance(query.get("data"), list):
            raise ValueError("Expected geographic query data to be a list of records")
        labels = self._metric_labels(form_data)
        size_labels = self.size_metric_labels(form_data, labels)
        seen: set[str] = set()
        for row in query["data"]:
            if not isinstance(row, Mapping):
                raise ValueError("Expected geographic rows to be records")
            for label in labels:
                value = row.get(label)
                if not _is_finite_geographic_number(value):
                    raise ValueError(
                        f"Geographic metric {label!r} must be a finite number"
                    )
                if value < 0 and label in size_labels:
                    raise ValueError("Geographic size metrics must be nonnegative")
            if identifier := self.row_identifier(row, form_data):
                if identifier in seen:
                    raise ValueError(
                        f"Multiple result rows resolve to {identifier}; "
                        "normalize source values before aggregation"
                    )
                seen.add(identifier)

    def normalize_query_result(self, result: Any, form_data: Mapping[str, Any]) -> Any:
        """Reject unresolved regions and malformed or nonfinite results.

        Source values are preserved for exports and filtering; the native
        transform owns display-only ISO mapping using the same bundled
        boundary identifiers. Charts without the typed MCP marker keep their
        native behavior.
        """
        if failure := query_result_failure(result):
            return failure
        if not form_data.get("mcp_geographic"):
            return result
        try:
            self._validate_rows(result, form_data)
        except (ValueError, TypeError, KeyError) as exc:
            return ChartError(error=str(exc), error_type="InvalidGeographicResult")
        return result

    # ------------------------------------------------------------------
    # Query limits and previews
    # ------------------------------------------------------------------

    def compile_row_limit(self, form_data: Mapping[str, Any]) -> int:
        """Validate the full bounded map, not only its first rows."""
        if form_data.get("mcp_geographic"):
            return _typed_row_limit(form_data)
        return super().compile_row_limit(form_data)

    def preview_row_limit(self, form_data: Mapping[str, Any], fallback: int) -> int:
        """Preview the same bounded rows the native map renders."""
        if form_data.get("mcp_geographic"):
            return _typed_row_limit(form_data)
        return fallback

    def ascii_preview(
        self,
        data: list[Any],
        form_data: dict[str, Any],
        width: int,
        height: int = 20,
    ) -> str | ChartError | None:
        """Render the source rows; map geometry has no ASCII form."""
        from superset.mcp_service.chart.ascii_charts import generate_ascii_table

        try:
            return f"{ASCII_BANNER}\n" + generate_ascii_table(data, max(width, 21))
        except (TypeError, ValueError, KeyError, IndexError) as exc:
            logger.error("ASCII chart generation failed: %s", exc, exc_info=True)
            return "ASCII chart generation failed"

    def vega_lite_preview(
        self, data: list[Any], form_data: dict[str, Any]
    ) -> VegaLitePreview | ChartError | None:
        """Never fabricate a non-geographic Vega-Lite chart for a map."""
        return ChartError(
            error=(
                "Geographic Vega previews are not supported. Use table/ascii for "
                "source data, or open Explore for native geography."
            ),
            error_type="UnsupportedGeographicPreview",
        )

    # ------------------------------------------------------------------
    # Updates
    # ------------------------------------------------------------------

    def merge_update_form_data(
        self,
        existing_form_data: dict[str, Any],
        new_form_data: dict[str, Any],
        config: Any,
        *,
        dataset_rebind: bool,
    ) -> dict[str, Any] | None:
        """Preserve omitted native controls; a rebind keeps presentation only."""
        merged = merge_geographic_update_form_data(
            existing_form_data, new_form_data, config, dataset_rebind=dataset_rebind
        )
        # Saved query aliases this map never reads are replaced, not inherited.
        for key in self.query_role_keys - self.owned_query_roles:
            if key not in new_form_data:
                merged.pop(key, None)
        # Native query and compile validation must cover the same bounded rows.
        if merged.get("mcp_geographic"):
            merged["row_limit"] = _typed_row_limit(merged)
            _normalize_fixed_radius(merged)
        return merged

    def finalize_update_form_data(
        self,
        existing_form_data: dict[str, Any],
        new_form_data: dict[str, Any],
        merged: dict[str, Any],
        config: Any,
    ) -> dict[str, Any]:
        """Let explicit time changes win over controls kept by a conversion."""
        if merged.get("mcp_geographic"):
            _apply_geographic_temporal_update(merged, config)
        return merged

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
    owned_query_roles: ClassVar[frozenset[str]] = frozenset({"entity", "metric"})
    query_role_keys = BaseChartPlugin.query_role_keys | {
        "entity",
        "metric",
        "series_columns",
    }

    def resolve_query_fields(
        self, form_data: Mapping[str, Any], viz_type: str
    ) -> tuple[list[Any], list[Any]] | None:
        """Query the region entity and its single metric."""
        metric = form_data.get("metric")
        entity = form_data.get("entity")
        return [metric] if metric else [], [entity] if entity else []

    def result_metrics(self, form_data: Mapping[str, Any]) -> list[Any]:
        return [form_data.get("metric")]

    def row_identifier(
        self, row: Mapping[str, Any], form_data: Mapping[str, Any]
    ) -> str | None:
        """Resolve the row to one bundled region boundary."""
        from superset.utils.geographic import resolve_region

        entity = column_result_label(form_data.get("entity"))
        if entity is None:
            raise ValueError("Geographic maps require an entity column")
        # Explore's legacy format joins on exact boundary ISO codes without
        # normalization, so only an exact identifier renders.
        region_format = form_data.get("region_format")
        return resolve_region(
            row.get(entity),
            form_data.get("select_country", ""),
            region_format or "iso_3166_2",
            exact_only=not region_format,
        )


def _bubbles_shown(form_data: Mapping[str, Any]) -> bool:
    """Whether the world map renders its secondary metric as bubble sizes."""
    return bool(form_data.get("show_bubbles"))


class WorldMapChartPlugin(GeographicChartPlugin):
    """Register the World Map visualization."""

    chart_type = "world_map"
    display_name = "World Map"
    native_viz_types: ClassVar[Mapping[str, str]] = {"world_map": "World Map"}
    owned_query_roles: ClassVar[frozenset[str]] = frozenset(
        {"entity", "metric", "secondary_metric"}
    )
    query_role_keys = BaseChartPlugin.query_role_keys | {
        "entity",
        "metric",
        "secondary_metric",
        "series_columns",
    }

    def resolve_query_fields(
        self, form_data: Mapping[str, Any], viz_type: str
    ) -> tuple[list[Any], list[Any]] | None:
        """Query the country entity, its metric and the bubble-size metric.

        The secondary metric is queried unless its result label is shared
        with the primary metric.
        """
        metrics: list[Any] = []
        labels: set[str | None] = set()
        for field in ("metric", "secondary_metric"):
            if metric := form_data.get(field):
                label = metric_result_label(metric)
                if label not in labels:
                    metrics.append(metric)
                    labels.add(label)
        entity = form_data.get("entity")
        return metrics, [entity] if entity else []

    def validate_merged_form_data(
        self,
        form_data: Mapping[str, Any],
        dataset_id: int | str | None,
        dataset_context: Any = None,
    ) -> Any | None:
        """Reject merged color and bubble metrics that share a label.

        An update can keep a saved ``secondary_metric`` while replacing
        ``metric`` with a different expression under the same label. Query
        deduplication would then size bubbles from the color metric.
        """
        metric = form_data.get("metric")
        secondary = form_data.get("secondary_metric")
        if (
            _bubbles_shown(form_data)
            and metric is not None
            and secondary is not None
            and metric != secondary
            and (
                _metric_expression(metric) is None
                or _metric_expression(metric) != _metric_expression(secondary)
            )
            and metric_result_label(metric) == metric_result_label(secondary)
        ):
            raise ValueError(
                "metric and secondary_metric must have distinct result labels; "
                "rename one or send both metrics in the update"
            )
        return None

    def result_metrics(self, form_data: Mapping[str, Any]) -> list[Any]:
        """Require the color metric, plus the bubble metric when bubbles show.

        A secondary metric kept alongside ``show_bubbles=False`` is not
        rendered, so its values do not gate the choropleth.
        """
        metrics = [form_data.get("metric")]
        if not _bubbles_shown(form_data):
            return metrics
        secondary = form_data.get("secondary_metric")
        if secondary is None:
            raise ValueError("show_bubbles requires secondary_metric")
        metrics.append(secondary)
        return metrics

    def size_metric_labels(
        self, form_data: Mapping[str, Any], labels: list[str]
    ) -> set[str]:
        """Bubble sizes come from the secondary metric when bubbles show."""
        if not _bubbles_shown(form_data):
            return set()
        secondary = metric_result_label(form_data.get("secondary_metric"))
        return {secondary} if secondary is not None else set()

    def row_identifier(
        self, row: Mapping[str, Any], form_data: Mapping[str, Any]
    ) -> str | None:
        """Resolve the row to one ISO 3166-1 alpha-3 country."""
        from superset.utils.geographic import resolve_geographic_value
        from superset.utils.geographic_world import WORLD_BOUNDARY_IDS

        entity = column_result_label(form_data.get("entity"))
        if entity is None:
            raise ValueError("Geographic maps require an entity column")
        field = form_data.get("country_fieldtype")
        if field not in {"name", "cca2", "cca3", "cioc"}:
            raise ValueError("Choose country_format name, cca2, cca3, or cioc")
        # Fold diacritics for country names only, so localized spellings such
        # as "Curaçao" reach their country. The ISO code fields are too short
        # to fold safely: an accented label like "Áo" would fold onto an
        # unrelated country's code and resolve silently to the wrong country.
        identifier = resolve_geographic_value(
            row.get(entity),
            _world_country_entries(field),
            fold_diacritics=field == "name",
        )

        if not _bubbles_shown(form_data) and identifier not in WORLD_BOUNDARY_IDS:
            raise ValueError(
                f"Country {identifier} has no bundled world-map boundary; "
                "enable bubbles with a secondary metric or filter the dataset"
            )
        return identifier


class DeckScatterChartPlugin(GeographicChartPlugin):
    """Register the Geographic Points visualization."""

    chart_type = "deck_scatter"
    display_name = "Geographic Points"
    native_viz_types: ClassVar[Mapping[str, str]] = {
        "deck_scatter": "Geographic Points"
    }
    owned_query_roles: ClassVar[frozenset[str]] = frozenset(
        {"spatial", "dimension", "point_radius_fixed"}
    )
    query_role_keys = BaseChartPlugin.query_role_keys | _DECK_DATASET_ROLE_KEYS

    def validate_merged_form_data(
        self,
        form_data: Mapping[str, Any],
        dataset_id: int | str | None,
        dataset_context: Any = None,
    ) -> Any | None:
        """Reject effective roles that conflict with native spatial features.

        Omitted dimensions and radius metrics survive updates. The frontend
        strips coordinate properties and reserves computed spatial field names.
        """
        dimension = column_result_label(form_data.get("dimension"))
        spatial = form_data.get("spatial")
        if (
            dimension is not None
            and isinstance(spatial, Mapping)
            and spatial.get("type") == "latlong"
            and dimension in {spatial.get("latCol"), spatial.get("lonCol")}
        ):
            raise ValueError(
                f"Dimension column {dimension!r} reuses a coordinate column; "
                "choose a separate category column"
            )
        column_labels = {dimension} if dimension is not None else set()
        if isinstance(spatial, Mapping):
            spatial_keys = {
                "latlong": ("latCol", "lonCol"),
                "geohash": ("geohashCol",),
                "delimited": ("lonlatCol",),
            }.get(spatial.get("type", ""), ())
            column_labels.update(
                spatial[key] for key in spatial_keys if spatial.get(key) is not None
            )
        for metric in self.result_metrics(form_data):
            label = metric_result_label(metric)
            if label in column_labels:
                raise ValueError(
                    f"Radius metric label {label!r} conflicts with an effective "
                    "dimension or coordinate column; clear or replace the radius metric"
                )
            if label in {"weight", "position", "extraProps"}:
                raise ValueError(
                    f"Radius metric label {label!r} conflicts with a native spatial "
                    "field; clear or replace the radius metric"
                )
        return None

    def build_query_dicts(
        self,
        form_data: dict[str, Any],
        *,
        viz_type: str,
        engine: str,
        row_limit: int | None,
        order_desc: bool | None,
    ) -> list[dict[str, Any]] | None:
        """Query raw points, ordered by radius metric, without time bucketing.

        Charts without the typed MCP marker use the shared Deck.gl query. Both
        keep the saved time column bound so ``time_range`` still filters.
        """
        from superset.mcp_service.chart.chart_helpers import (
            build_deck_gl_query_dict,
        )

        typed = bool(form_data.get("mcp_geographic"))
        qd = build_deck_gl_query_dict(
            form_data,
            viz_type,
            row_limit=row_limit,
            order_desc=order_desc,
        )
        if not qd.get("is_timeseries"):
            _bind_time_column(qd, form_data)
        if not typed:
            return [qd]
        metrics = qd.get("metrics") or []
        qd["is_timeseries"] = False
        if isinstance(extras := qd.get("extras"), dict):
            extras.pop("time_grain_sqla", None)
        qd["orderby"] = [[metric_result_label(metrics[0]), False]] if metrics else []
        return [qd]

    def result_metrics(self, form_data: Mapping[str, Any]) -> list[Any]:
        """Require the radius metric when the radius is metric-backed.

        Legacy native charts store a bare saved-metric key (or a numeric
        string for a fixed radius) instead of the typed ``fix``/``metric``
        object; both stay valid when an unrelated update preserves them.
        """
        from superset.mcp_service.chart.chart_helpers import _is_metric_ref

        radius = form_data.get("point_radius_fixed")
        if isinstance(radius, str) and radius:
            return [radius] if _is_metric_ref(radius) else []
        if not isinstance(radius, Mapping) or radius.get("type") not in {
            "fix",
            "metric",
        }:
            raise ValueError("Invalid geographic point radius configuration")
        return [radius.get("value")] if radius["type"] == "metric" else []

    def size_metric_labels(
        self, form_data: Mapping[str, Any], labels: list[str]
    ) -> set[str]:
        """Every point metric sizes the point radius."""
        return set(labels)

    def row_identifier(
        self, row: Mapping[str, Any], form_data: Mapping[str, Any]
    ) -> str | None:
        """Validate native spatial formats without changing exported source values."""
        spatial = form_data.get("spatial")
        if not isinstance(spatial, Mapping):
            raise ValueError("Geographic points require spatial columns")
        spatial_type = spatial.get("type")
        coordinates: list[object] = []
        if spatial_type == "latlong":
            for role in ("lonCol", "latCol"):
                column = spatial.get(role)
                if not isinstance(column, str):
                    raise ValueError(f"{role} requires a named coordinate column")
                coordinates.append(row.get(column))
        elif spatial_type in {"geohash", "delimited"}:
            column = spatial.get(
                "geohashCol" if spatial_type == "geohash" else "lonlatCol"
            )
            if not isinstance(column, str):
                raise ValueError("Spatial coordinates require a named column")
            coordinates.extend(
                _decode_geographic_coordinates(row.get(column), spatial_type)
            )
        else:
            raise ValueError("Unsupported geographic spatial format")
        if spatial.get("reverseCheckbox"):
            coordinates.reverse()
        for value, role, bound in zip(
            coordinates, ("lonCol", "latCol"), (180, 90), strict=True
        ):
            if (
                not _is_finite_geographic_number(value)
                or value < -bound
                or not value <= bound
            ):
                raise ValueError(
                    f"{role} must be a finite number between {-bound} and {bound}"
                )
        return None
