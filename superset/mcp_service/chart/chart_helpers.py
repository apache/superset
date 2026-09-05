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
Shared helper functions for MCP chart tools.

This module contains reusable utility functions for common operations
across chart tools: chart lookup, cached form data retrieval, and
URL parameter extraction. Config mapping logic lives in chart_utils.py.
"""

from __future__ import annotations

import logging
import re
from typing import Any, TYPE_CHECKING
from urllib.parse import parse_qs, urlparse

from superset.constants import EXTRA_FORM_DATA_OVERRIDE_REGULAR_MAPPINGS
from superset.utils import json as utils_json

if TYPE_CHECKING:
    from superset.mcp_service.chart.schemas import AppliedDashboardFilter
    from superset.models.slice import Slice

logger = logging.getLogger(__name__)

# extra_form_data override targets that the query object actually reads. Note
# that ``time_grain`` is deliberately absent: the query object has no such field
# and nothing downstream consumes it, matching the REST path, where
# form_data_query_context reads only ``time_grain_sqla``. Listing it here would
# write a key that ChartDataQueryObjectSchema (``unknown = EXCLUDE``) discards.
QUERY_CONTEXT_EXTRA_FORM_DATA_OVERRIDE_KEYS = {
    "granularity",
    "time_grain_sqla",
    "time_range",
}

# Of the keys above, these are not query object fields: the query object carries
# the time grain inside ``extras`` (see ChartDataExtrasSchema), mirroring how
# form_data is translated in superset.common.form_data_query_context. Writing
# them at the top level instead means ChartDataQueryObjectSchema, which is
# configured with ``unknown = EXCLUDE``, silently drops the override.
QUERY_CONTEXT_EXTRA_FORM_DATA_EXTRAS_KEYS = {
    "time_grain_sqla",
}


class ChartNotOnDashboardError(ValueError):
    """Raised when a chart is not part of the given dashboard's slices."""


def find_chart_by_identifier(
    identifier: int | str,
    query_options: list[Any] | None = None,
) -> Slice | None:
    """Find a chart by numeric ID or UUID string.

    Accepts an integer ID, a string that looks like a digit (e.g. "123"),
    or a UUID string. Returns the Slice model instance or None.

    ``query_options`` is forwarded to the DAO so callers can eager-load
    relationships needed after the request-scoped session is detached.
    """
    from superset.daos.chart import ChartDAO  # avoid circular import

    extra: dict[str, Any] = (
        {"query_options": query_options} if query_options is not None else {}
    )
    if isinstance(identifier, int) or (
        isinstance(identifier, str) and identifier.isdigit()
    ):
        chart_id = int(identifier) if isinstance(identifier, str) else identifier
        return ChartDAO.find_by_id(chart_id, **extra)
    return ChartDAO.find_by_id(identifier, id_column="uuid", **extra)


def get_cached_form_data(form_data_key: str) -> str | None:
    """Retrieve form_data from cache using form_data_key.

    Returns the JSON string of form_data if found, None otherwise.
    """
    # avoid circular import — commands depend on app initialization
    from superset.commands.exceptions import CommandException
    from superset.commands.explore.form_data.get import GetFormDataCommand
    from superset.commands.explore.form_data.parameters import CommandParameters

    try:
        cmd_params = CommandParameters(key=form_data_key)
        return GetFormDataCommand(cmd_params).run()
    except (KeyError, ValueError, CommandException) as e:
        logger.warning("Failed to retrieve form_data from cache: %s", e)
        return None


def resolve_datasource_engine(datasource_id: Any, datasource_type: str) -> str:
    """Return the datasource engine name, or ``"base"`` if it cannot be resolved."""
    if not isinstance(datasource_id, (int, str)):
        return "base"
    try:
        # avoid circular import
        from superset.daos.datasource import DatasourceDAO
        from superset.utils.core import DatasourceType

        datasource = DatasourceDAO.get_datasource(
            datasource_type=DatasourceType(datasource_type),
            database_id_or_uuid=datasource_id,
        )
        return datasource.database.db_engine_spec.engine
    except Exception:  # noqa: BLE001
        # Engine lookup is best-effort; fall back to generic filter normalization.
        logger.debug("Could not resolve engine for datasource %s", datasource_id)
        return "base"


def prepare_form_data_for_query(
    form_data: dict[str, Any],
    datasource_id: Any,
    datasource_type: str,
    extra_form_data: dict[str, Any] | None = None,
    datasource_engine: str | None = None,
) -> None:
    """Normalize form_data filters before building a QueryObject payload.

    Explore and legacy viz query construction merge dashboard/native filter payloads
    and split adhoc filters into the concrete ``filters``/``where``/``having``
    fields consumed by QueryObject. MCP tools that build query payloads directly
    must perform the same normalization before calling QueryContextFactory.

    Mutates ``form_data`` in place.
    """
    # avoid circular import
    from superset.utils.core import (
        convert_legacy_filters_into_adhoc,
        form_data_to_adhoc,
        merge_extra_filters,
        simple_filter_to_adhoc,
        split_adhoc_filters_into_base_filters,
    )

    if isinstance(form_data.get("adhoc_filters"), list):
        adhoc_filters = [
            *(
                form_data_to_adhoc(form_data, clause)
                for clause in ("having", "where")
                if form_data.get(clause)
            ),
            *(
                simple_filter_to_adhoc(filter_, "where")
                for filter_ in form_data.get("filters") or []
                if filter_ is not None
            ),
            *form_data["adhoc_filters"],
        ]
        form_data["adhoc_filters"] = adhoc_filters

    if extra_form_data:
        form_data["extra_form_data"] = merge_extra_form_data(
            form_data.get("extra_form_data"),
            extra_form_data,
        )
    convert_legacy_filters_into_adhoc(form_data)
    merge_extra_filters(form_data)
    split_adhoc_filters_into_base_filters(
        form_data,
        datasource_engine or resolve_datasource_engine(datasource_id, datasource_type),
    )


def merge_extra_form_data(
    existing: Any,
    incoming: dict[str, Any],
) -> dict[str, Any]:
    """Merge cached and request-level extra_form_data payloads."""
    merged: dict[str, Any] = dict(existing) if isinstance(existing, dict) else {}
    for key, value in incoming.items():
        current = merged.get(key)
        if isinstance(current, list) and isinstance(value, list):
            merged[key] = [*current, *value]
        elif isinstance(current, dict) and isinstance(value, dict):
            merged[key] = {**current, **value}
        else:
            merged[key] = value
    return merged


def apply_form_data_filters_to_query(
    query: dict[str, Any],
    form_data: dict[str, Any],
) -> None:
    """Copy normalized form_data filter fields into a fresh query payload."""
    if filters := form_data.get("filters"):
        query["filters"] = filters
    else:
        query.setdefault("filters", [])

    if time_range := form_data.get("time_range"):
        query["time_range"] = time_range
    if where := form_data.get("where"):
        query["where"] = where
    if having := form_data.get("having"):
        query["having"] = having
    if extras := form_data.get("extras"):
        query["extras"] = {**(query.get("extras") or {}), **extras}


def _join_sql_clause(existing_clause: str, additional_clause: str) -> str:
    """AND two SQL filter clauses while preserving their original grouping."""
    return f"({existing_clause}) AND ({additional_clause})"


def _is_temporal_override_filter(
    filter_: dict[str, Any],
    form_data: dict[str, Any],
) -> bool:
    return (
        filter_.get("op") == "TEMPORAL_RANGE"
        and form_data.get("time_range") is not None
        and filter_.get("val") == form_data.get("time_range")
        and (
            form_data.get("granularity") is None
            or filter_.get("col") == form_data.get("granularity")
        )
    )


def merge_form_data_filters_into_query(
    query: dict[str, Any],
    form_data: dict[str, Any],
) -> None:
    """Merge normalized form_data filters into an existing query payload.

    Saved query contexts can contain query-specific filter, where, or having
    fields. This helper adds normalized predicates while applying request-level
    extra_form_data overrides for temporal query fields.
    """
    if filters := [
        filter_
        for filter_ in form_data.get("filters") or []
        if not _is_temporal_override_filter(filter_, form_data)
    ]:
        query["filters"] = [
            *(query.get("filters") or []),
            *filters,
        ]

    for key in EXTRA_FORM_DATA_OVERRIDE_REGULAR_MAPPINGS.values():
        if (
            key in QUERY_CONTEXT_EXTRA_FORM_DATA_OVERRIDE_KEYS
            and key in form_data
            and form_data[key] is not None
        ):
            if key in QUERY_CONTEXT_EXTRA_FORM_DATA_EXTRAS_KEYS:
                query["extras"] = {**(query.get("extras") or {}), key: form_data[key]}
            else:
                query[key] = form_data[key]

    for clause in ("where", "having"):
        if additional_clause := form_data.get(clause):
            if existing_clause := query.get(clause):
                query[clause] = _join_sql_clause(existing_clause, additional_clause)
            else:
                query[clause] = additional_clause

    if extras := form_data.get("extras"):
        query["extras"] = {**(query.get("extras") or {}), **extras}


def merge_extra_form_data_filters_into_query(
    query: dict[str, Any],
    extra_form_data: dict[str, Any],
    datasource_id: Any,
    datasource_type: str,
) -> None:
    """Merge request extra_form_data predicates into an existing query payload."""
    extra_query_form_data: dict[str, Any] = {"adhoc_filters": []}
    prepare_form_data_for_query(
        extra_query_form_data,
        datasource_id,
        datasource_type,
        extra_form_data,
    )
    merge_form_data_filters_into_query(query, extra_query_form_data)


def _deck_gl_spatial_cols(spatial: dict[str, Any] | None) -> list[str]:
    """Return the column names referenced by a single Deck.gl spatial control."""
    if not isinstance(spatial, dict):
        return []
    spatial_type = spatial.get("type")
    if spatial_type == "latlong":
        return [c for c in [spatial.get("lonCol"), spatial.get("latCol")] if c]
    if spatial_type == "delimited":
        return [c for c in [spatial.get("lonlatCol")] if c]
    if spatial_type == "geohash":
        return [c for c in [spatial.get("geohashCol")] if c]
    return []


def _is_metric_ref(value: Any) -> bool:
    """Return True if value is a metric reference (dict or non-numeric string).

    Deck.gl size/metric fields hold either a dict metric definition or a
    simple saved-metric string key (e.g. "count"). Scalar numeric strings
    like "100" are fixed display settings and must not be treated as metrics.
    Note: float() accepts "inf", "-inf", and "nan", so those strings would be
    excluded here too — they are not valid metric names in practice.
    """
    if isinstance(value, dict):
        return True
    if isinstance(value, str) and value:
        try:
            float(value)
            return False
        except ValueError:
            return True
    return False


def _deck_gl_null_filters(form_data: dict[str, Any]) -> list[dict[str, Any]]:
    """Build IS NOT NULL simple filters for Deck.gl spatial and data columns.

    Mirrors BaseDeckGLViz.add_null_filters() behavior: spatial control columns,
    line_column, and the geojson column are filtered for non-null values by
    default.
    """
    seen: set[str] = set()
    result: list[dict[str, Any]] = []
    for key in ("spatial", "start_spatial", "end_spatial"):
        for col in _deck_gl_spatial_cols(form_data.get(key)):
            if col not in seen:
                seen.add(col)
                result.append({"col": col, "op": "IS NOT NULL", "val": ""})
    for field in ("line_column", "geojson"):
        data_col = form_data.get(field)
        if isinstance(data_col, str) and data_col and data_col not in seen:
            seen.add(data_col)
            result.append({"col": data_col, "op": "IS NOT NULL", "val": ""})
    return result


def _resolve_deck_gl_metrics(
    form_data: dict[str, Any], viz_type: str = ""
) -> list[Any]:
    """Extract metrics for Deck.gl chart types.

    deck_geojson.query_obj() forces metrics=[] regardless of form_data.
    For other types, size/metric values are included when they are metric
    references (dicts or non-numeric strings); numeric scalars like "100"
    are fixed display settings and are excluded.
    deck_scatter and deck_polygon can additionally store metric-backed
    values in point_radius_fixed (radius for scatter, elevation for polygon).
    """
    if viz_type == "deck_geojson":
        return []
    metrics: list[Any] = []
    for field in ("size", "metric"):
        m = form_data.get(field)
        if _is_metric_ref(m):
            metrics.append(m)
    prf = form_data.get("point_radius_fixed")
    if isinstance(prf, dict) and prf.get("type") == "metric":
        value = prf.get("value")
        if value:
            metrics.append(value)
    elif isinstance(prf, str) and _is_metric_ref(prf):
        # Legacy deck_scatter: point_radius_fixed as a bare non-numeric metric key
        logger.debug("Legacy point_radius_fixed string metric encountered: %s", prf)
        metrics.append(prf)
    return metrics


def resolve_deck_gl_columns(form_data: dict[str, Any]) -> list[str]:
    """Extract SQL column names for Deck.gl chart types from form_data.

    Deck.gl charts use spatial controls (lat/lon pairs, geohash, etc.)
    rather than the standard metrics/groupby structure. This function
    maps those spatial control configs to the actual column names
    needed by the SQL query.
    """
    seen: set[str] = set()
    columns: list[str] = []

    def _add(col: str | None) -> None:
        if col and isinstance(col, str) and col not in seen:
            seen.add(col)
            columns.append(col)

    # Most Deck.gl types use "spatial"; arc charts use start/end spatial
    for key in ("spatial", "start_spatial", "end_spatial"):
        for col in _deck_gl_spatial_cols(form_data.get(key)):
            _add(col)

    # deck_path / deck_polygon use a line column; deck_geojson uses geojson
    for field in ("line_column", "geojson", "dimension"):
        _add(form_data.get(field))

    return columns


def resolve_metrics(form_data: dict[str, Any], viz_type: str) -> list[Any]:
    """Extract metrics from form_data, handling chart-type-specific fields."""
    if viz_type == "bubble":
        return [m for field in ("x", "y", "size") if (m := form_data.get(field))]

    metrics = form_data.get("metrics") or []
    if not metrics and (metric := form_data.get("metric")):
        metrics = [metric]
    return metrics


def resolve_groupby(form_data: dict[str, Any]) -> list[Any]:
    """Extract groupby columns from form_data with fallback aliases."""
    raw_columns = form_data.get("all_columns")
    if form_data.get("query_mode") == "raw" and isinstance(raw_columns, list):
        return list(raw_columns)

    raw_groupby = form_data.get("groupby") or []
    if isinstance(raw_groupby, str):
        groupby: list[Any] = [raw_groupby]
    else:
        groupby = list(raw_groupby)

    if groupby:
        return groupby

    for field in ("entity", "series"):
        value = form_data.get(field)
        if isinstance(value, str) and value not in groupby:
            groupby.append(value)

    form_columns = form_data.get("columns")
    if isinstance(form_columns, list):
        for col in form_columns:
            if isinstance(col, str) and col not in groupby:
                groupby.append(col)

    if not groupby and isinstance(raw_columns, list):
        groupby.extend(raw_columns)

    return groupby


def resolve_metrics_and_groupby(
    form_data: dict[str, Any],
    chart: Any | None = None,
) -> tuple[list[Any], list[Any]]:
    """Resolve metrics and groupby columns from form_data."""
    viz_type = (
        form_data.get("viz_type", getattr(chart, "viz_type", "") if chart else "") or ""
    )
    singular_metric_no_groupby = (
        "big_number",
        "big_number_total",
        "pop_kpi",
    )
    if viz_type in singular_metric_no_groupby:
        metric = form_data.get("metric")
        if not metric:
            # Some saved/migrated form_data stores the metric under the
            # plural "metrics" key even for single-metric chart types.
            plural_metrics = form_data.get("metrics") or []
            metric = plural_metrics[0] if plural_metrics else None
        return ([metric] if metric else []), []

    return resolve_metrics(form_data, viz_type), resolve_groupby(form_data)


def extract_x_axis_col(form_data: dict[str, Any]) -> str | None:
    """Return the x_axis column name from form_data, or None if not set."""
    x_axis = form_data.get("x_axis")
    if isinstance(x_axis, str) and x_axis:
        return x_axis
    if isinstance(x_axis, dict):
        col_name = x_axis.get("column_name")
        return col_name if isinstance(col_name, str) and col_name else None
    return None


def _x_axis_query_field(form_data: dict[str, Any]) -> Any | None:
    """Resolve a frontend x-axis value without losing SQL expressions."""
    x_axis = form_data.get("x_axis")
    if isinstance(x_axis, str) and x_axis:
        return x_axis
    if isinstance(x_axis, dict):
        if (
            isinstance(x_axis.get("sqlExpression"), str)
            and x_axis.get("sqlExpression")
            and isinstance(x_axis.get("label"), str)
            and x_axis.get("label")
            and x_axis.get("expressionType") in (None, "SQL")
        ):
            return x_axis
        column_name = x_axis.get("column_name") or x_axis.get("columnName")
        if isinstance(column_name, str) and column_name:
            return column_name
    return None


def _normalized_x_axis_query_field(form_data: dict[str, Any]) -> Any | None:
    """Mirror ``buildQueryContext.normalizeTimeColumn`` for a set x-axis."""
    x_axis = _x_axis_query_field(form_data)
    if x_axis is None:
        return None
    time_grain = form_data.get("time_grain_sqla")
    if isinstance(x_axis, str):
        normalized = {
            "columnType": "BASE_AXIS",
            "sqlExpression": x_axis,
            "label": x_axis,
            "expressionType": "SQL",
            "isColumnReference": True,
        }
        if time_grain is not None:
            normalized["timeGrain"] = time_grain
        return normalized
    normalized = {"columnType": "BASE_AXIS", **x_axis}
    # The original adhoc column's grain overrides the common control, matching
    # the frontend spread order.
    if "timeGrain" not in normalized and time_grain is not None:
        normalized["timeGrain"] = time_grain
    return normalized


def resolve_big_number_columns(form_data: dict[str, Any]) -> list[Any]:
    """Resolve only Big Number's explicit x-axis query column.

    The frontend keeps ``granularity_sqla`` out of ``columns`` and asks the
    backend for a timeseries instead, which yields ``__timestamp``. An explicit
    ``x_axis`` is different: the plugin retains that column in the final query.
    """
    if (x_axis := _normalized_x_axis_query_field(form_data)) is not None:
        return [x_axis]
    return []


def _as_list(value: Any) -> list[Any]:
    """Match the frontend's ``ensureIsArray`` for query controls."""
    if value is None:
        return []
    return value if isinstance(value, list) else [value]


def _column_label(column: Any) -> str | None:
    """Return the frontend ``getColumnLabel`` value for a query column."""
    if isinstance(column, str):
        return column
    if not isinstance(column, dict):
        return None
    return (
        column.get("label") or column.get("sqlExpression") or column.get("column_name")
    )


def _metric_label(metric: Any) -> str | None:
    """Return the frontend ``getMetricLabel`` value for a query metric."""
    if isinstance(metric, str):
        return metric
    if not isinstance(metric, dict):
        return None
    if label := metric.get("label"):
        return label
    if metric.get("expressionType") == "SIMPLE":
        column = metric.get("column") or {}
        name = (
            column.get("columnName") or column.get("column_name")
            if isinstance(column, dict)
            else None
        )
        if name and metric.get("aggregate"):
            return f"{metric['aggregate']}({name})"
    return metric.get("sqlExpression")


def _is_query_form_metric(value: Any) -> bool:
    """Mirror the frontend's ``isQueryFormMetric`` type guard."""
    return isinstance(value, str) or (
        isinstance(value, dict) and value.get("expressionType") in {"SIMPLE", "SQL"}
    )


def _timeseries_base_metrics(form_data: dict[str, Any]) -> list[Any]:
    """Return metrics extracted by the common frontend query-field aliases."""
    metrics = list(_as_list(form_data.get("metrics")))
    if (size := form_data.get("size")) is not None:
        metrics.append(size)
    return _dedupe_query_fields(metrics, _metric_label)


def _timeseries_extra_metrics(form_data: dict[str, Any]) -> list[Any]:
    """Mirror ``extractExtraMetrics`` for ungrouped x-axis sorting."""
    if _as_list(form_data.get("groupby")):
        return []
    limit_metrics = _as_list(form_data.get("timeseries_limit_metric"))
    if not limit_metrics:
        return []
    limit_metric = limit_metrics[0]
    limit_label = _metric_label(limit_metric)
    if not limit_label or limit_label != form_data.get("x_axis_sort"):
        return []
    if any(
        _metric_label(metric) == form_data.get("x_axis_sort")
        for metric in _as_list(form_data.get("metrics"))
    ):
        return []
    return [limit_metric]


def _query_series_columns(query: dict[str, Any]) -> list[Any]:
    """Resolve pivot columns with JavaScript's array-truthiness semantics.

    JavaScript treats an explicitly empty array as truthy, so
    ``series_columns: []`` must not fall through to the query's x-axis column.
    Only an absent/null series-columns field falls back to ``columns``.
    """
    if "series_columns" in query and query["series_columns"] is not None:
        return _as_list(query["series_columns"])
    return _as_list(query.get("columns"))


def _dedupe_query_fields(values: list[Any], labeler: Any) -> list[Any]:
    """Preserve the first query field for each frontend result label."""
    result: list[Any] = []
    seen: set[str] = set()
    for value in values:
        label = labeler(value)
        if not label or label in seen:
            continue
        seen.add(label)
        result.append(value)
    return result


def _deck_tooltip_columns(value: Any) -> list[str]:
    """Extract the physical tooltip fields accepted by Deck.gl plugins."""
    if not isinstance(value, list):
        return []
    columns: list[str] = []
    for item in value:
        column: Any = None
        if isinstance(item, str):
            column = item
        elif isinstance(item, dict) and item.get("item_type") == "column":
            column = item.get("column_name")
        if isinstance(column, str) and column and column not in columns:
            columns.append(column)
    return columns


def _deck_base_query_fields(  # noqa: C901
    form_data: dict[str, Any],
) -> tuple[list[Any], list[Any], list[list[Any]] | None]:
    """Mirror the common fields built before a Deck.gl layer adapter runs."""
    query_mode = form_data.get("query_mode")
    columns: list[Any] = []
    metrics: list[Any] = []
    raw_orderby: list[Any] = []
    aliases = {
        "metric": "metrics",
        "metric_2": "metrics",
        "secondary_metric": "metrics",
        "left_metric": "metrics",
        "right_metric": "metrics",
        "x": "metrics",
        "y": "metrics",
        "size": "metrics",
        "all_columns": "columns",
        "series": "groupby",
        "order_by_cols": "orderby",
    }
    for key, value in form_data.items():
        if value is None:
            continue
        normalized = aliases.get(key, key)
        if query_mode == "aggregate" and normalized == "columns":
            continue
        if query_mode == "raw" and normalized in {"groupby", "metrics"}:
            continue
        if normalized == "groupby":
            normalized = "columns"
        if normalized == "columns":
            columns.extend(_as_list(value))
        elif normalized == "metrics":
            metrics.extend(_as_list(value))
        elif normalized == "orderby":
            raw_orderby.extend(_as_list(value))

    orderby: list[list[Any]] = []
    if len(raw_orderby) > 100:
        raise ValueError("Deck orderby must contain at most 100 entries")
    for index, value in enumerate(raw_orderby):
        if isinstance(value, str):
            if len(value) > 1000:
                raise ValueError(f"Deck orderby[{index}] is too long")
            try:
                value = utils_json.loads(value)
            except (TypeError, ValueError) as ex:
                raise ValueError(f"Deck orderby[{index}] is not valid JSON") from ex
        if (
            not isinstance(value, (list, tuple))
            or len(value) != 2
            or not isinstance(value[1], bool)
        ):
            raise ValueError(
                f"Deck orderby[{index}] must be [field, ascending_boolean]"
            )
        orderby.append(list(value))

    return (
        _dedupe_query_fields(columns, _column_label),
        _dedupe_query_fields(metrics, _metric_label),
        orderby or None,
    )


def _deck_add_columns(columns: list[Any], *values: Any) -> list[Any]:
    """Add layer fields by frontend result label without duplicates."""
    expanded = list(columns)
    for value in values:
        expanded.extend(_as_list(value))
    return _dedupe_query_fields(expanded, _column_label)


def _deck_add_metrics(metrics: list[Any], *values: Any) -> list[Any]:
    """Add layer metric roles without emitting the same output label twice."""
    expanded = list(metrics)
    for value in values:
        expanded.extend(_as_list(value))
    return _dedupe_query_fields(expanded, _metric_label)


def _deck_fixed_or_metric(
    value: Any, *, allow_legacy_string: bool = True
) -> Any | None:
    """Return the metric stored in a Deck fixed-or-metric control."""
    if allow_legacy_string and isinstance(value, str) and value:
        # Legacy Deck controls store the metric key directly as a string.
        return value
    if not isinstance(value, dict) or value.get("type") != "metric":
        return None
    metric = value.get("value")
    return (
        metric if metric is not None and not isinstance(metric, (int, float)) else None
    )


def _deck_spatial_columns(value: Any) -> list[str]:
    """Resolve one complete frontend Deck spatial configuration."""
    if not isinstance(value, dict) or not value.get("type"):
        raise ValueError("Bad spatial key")
    spatial_type = value["type"]
    fields = {
        "latlong": ("lonCol", "latCol"),
        "delimited": ("lonlatCol",),
        "geohash": ("geohashCol",),
    }.get(spatial_type)
    if fields is None:
        raise ValueError(f"Unknown spatial type: {spatial_type}")
    columns: list[str] = []
    for field in fields:
        column = value.get(field)
        if not isinstance(column, str) or not column:
            raise ValueError(f"Incomplete {spatial_type} spatial configuration")
        columns.append(column)
    return columns


def _deck_add_null_filters(
    query: dict[str, Any], columns: list[str], *, include_null_value: bool = False
) -> None:
    """Append renderer-required non-null filters, deduplicated by column."""
    filters = list(query.get("filters") or [])
    present = {
        item.get("col")
        for item in filters
        if isinstance(item, dict) and item.get("op") == "IS NOT NULL"
    }
    for column in columns:
        if not column or column in present:
            continue
        filter_: dict[str, Any] = {"col": column, "op": "IS NOT NULL"}
        if include_null_value:
            filter_["val"] = None
        filters.append(filter_)
        present.add(column)
    query["filters"] = filters


def _build_deck_query(  # noqa: C901
    form_data: dict[str, Any],
    viz_type: str,
    *,
    row_limit: int | None,
    order_desc: bool | None,
) -> dict[str, Any]:
    """Build the final QueryObject for one concrete Deck.gl layer plugin."""
    base_columns, base_metrics, base_orderby = _deck_base_query_fields(form_data)
    query = _build_single_query_dict(
        form_data,
        base_columns,
        base_metrics,
        row_limit=row_limit,
        order_desc=order_desc,
        orderby=base_orderby,
    )
    tooltip_columns = _deck_tooltip_columns(form_data.get("tooltip_contents"))

    if viz_type == "deck_arc":
        if not form_data.get("start_spatial") or not form_data.get("end_spatial"):
            raise ValueError(
                "Start and end spatial configurations are required for Arc charts"
            )
        start_columns = _deck_spatial_columns(form_data["start_spatial"])
        end_columns = _deck_spatial_columns(form_data["end_spatial"])
        query["columns"] = _deck_add_columns(
            base_columns,
            start_columns,
            end_columns,
            form_data.get("dimension"),
            tooltip_columns,
        )
        _deck_add_null_filters(
            query, [*start_columns, *end_columns], include_null_value=True
        )
        query["is_timeseries"] = bool(form_data.get("time_grain_sqla"))
        return query

    if viz_type == "deck_geojson":
        geojson = form_data.get("geojson")
        if not isinstance(geojson, str) or not geojson:
            raise ValueError("GeoJSON column is required for GeoJSON charts")
        query["columns"] = _deck_add_columns(
            base_columns,
            geojson,
            form_data.get("cross_filter_column"),
            tooltip_columns,
        )
        query["metrics"] = []
        # Retain the frontend field even though the backend canonicalizes it to
        # columns; an empty groupby must not replace the renderer columns.
        query["groupby"] = []
        if form_data.get("filter_nulls", True):
            _deck_add_null_filters(query, [geojson])
        query["is_timeseries"] = False
        return query

    if viz_type == "deck_scatter":
        if not form_data.get("spatial"):
            raise ValueError("Spatial configuration is required for Scatter charts")
        spatial_columns = _deck_spatial_columns(form_data["spatial"])
        query["columns"] = _deck_add_columns(
            base_columns,
            spatial_columns,
            form_data.get("dimension"),
            tooltip_columns,
        )
        radius_metric = _deck_fixed_or_metric(form_data.get("point_radius_fixed"))
        query["metrics"] = _deck_add_metrics(base_metrics, radius_metric)
        if radius_metric is not None:
            query["orderby"] = [[_metric_label(radius_metric), False]]
        _deck_add_null_filters(query, spatial_columns, include_null_value=True)
        query["is_timeseries"] = False
        return query

    if viz_type == "deck_polygon":
        line_column = form_data.get("line_column")
        if not isinstance(line_column, str) or not line_column:
            raise ValueError("Polygon column is required for Polygon charts")
        query["columns"] = _deck_add_columns(
            base_columns,
            line_column,
            form_data.get("cross_filter_column"),
            tooltip_columns,
        )
        metric = form_data.get("metric")
        elevation_metric = _deck_fixed_or_metric(
            form_data.get("point_radius_fixed"), allow_legacy_string=False
        )
        query["metrics"] = _deck_add_metrics([], metric, elevation_metric)
        if form_data.get("filter_nulls", True):
            null_columns = [line_column]
            if metric is not None and (metric_label := _metric_label(metric)):
                null_columns.append(metric_label)
            _deck_add_null_filters(query, null_columns)
        query["is_timeseries"] = False
        return query

    if viz_type == "deck_path":
        line_column = form_data.get("line_column")
        if not isinstance(line_column, str) or not line_column:
            raise ValueError("Line column is required for Path charts")
        metrics = list(base_metrics)
        metric = form_data.get("metric")
        metrics = _deck_add_metrics(metrics, metric)
        width_metric = _deck_fixed_or_metric(form_data.get("line_width"))
        breakpoint_metric = form_data.get("breakpoint_metric")
        metrics = _deck_add_metrics(metrics, width_metric, breakpoint_metric)

        columns = list(base_columns)
        groupby: list[Any] = []
        if metrics or metric is not None:
            groupby = _deck_add_columns(groupby, line_column)
        else:
            columns = _deck_add_columns(columns, line_column)
        if width_metric is not None or breakpoint_metric is not None:
            groupby = _deck_add_columns(groupby, line_column)
        columns = _deck_add_columns(
            columns, form_data.get("dimension"), tooltip_columns
        )
        groupby = _deck_add_columns(groupby, tooltip_columns)
        query["columns"] = columns
        query["metrics"] = metrics
        query["groupby"] = groupby
        _deck_add_null_filters(query, [line_column])
        query["is_timeseries"] = bool(form_data.get("time_grain_sqla"))
        return query

    if viz_type in {
        "deck_grid",
        "deck_hex",
        "deck_heatmap",
        "deck_contour",
        "deck_screengrid",
    }:
        if not form_data.get("spatial"):
            raise ValueError("Spatial configuration is required for this chart")
        spatial_columns = _deck_spatial_columns(form_data["spatial"])
        metric = form_data.get("size")
        query["columns"] = _deck_add_columns(
            base_columns, spatial_columns, tooltip_columns
        )
        query["metrics"] = _deck_add_metrics([], metric)
        if metric is not None and (metric_label := _metric_label(metric)):
            query["orderby"] = [[metric_label, False]]
        _deck_add_null_filters(query, spatial_columns, include_null_value=True)
        query["is_timeseries"] = False
        return query

    raise ValueError(f"Unsupported Deck.gl visualization type: {viz_type}")


def _parse_orderby(values: Any) -> list[list[Any]]:
    """Parse bounded native ``order_by_cols`` without coercing malformed input."""
    if values is not None and not isinstance(values, list):
        raise ValueError("order_by_cols must be a list")
    if isinstance(values, list) and len(values) > 100:
        raise ValueError("order_by_cols must contain at most 100 entries")
    result: list[list[Any]] = []
    for index, value in enumerate(_as_list(values)):
        if isinstance(value, str):
            if len(value) > 1000:
                raise ValueError(f"order_by_cols[{index}] is too long")
            try:
                value = utils_json.loads(value)
            except (TypeError, ValueError) as ex:
                raise ValueError(f"order_by_cols[{index}] is not valid JSON") from ex
        if (
            isinstance(value, (list, tuple))
            and len(value) == 2
            and isinstance(value[0], str)
            and bool(value[0])
            and isinstance(value[1], bool)
        ):
            result.append(list(value))
        else:
            raise ValueError(
                f"order_by_cols[{index}] must be [column, ascending_boolean]"
            )
    return result


def resolve_gantt_query_fields(
    form_data: dict[str, Any],
) -> tuple[list[Any], list[Any], list[list[Any]], list[Any]]:
    """Mirror the bounded ECharts Gantt field extraction contract."""

    def require_column(value: Any, field_name: str) -> Any:
        if isinstance(value, str) and value:
            return value
        if isinstance(value, dict) and 0 < len(value) <= 20:
            if value.get("column_name") or (
                value.get("expressionType") and value.get("label")
            ):
                return value
        raise ValueError(f"Gantt {field_name} must be a column reference")

    start_time = require_column(form_data.get("start_time"), "start_time")
    end_time = require_column(form_data.get("end_time"), "end_time")
    category = require_column(form_data.get("y_axis"), "y_axis")
    raw_series = form_data.get("series")
    series_columns = (
        [require_column(raw_series, "series")] if raw_series is not None else []
    )
    raw_tooltips = form_data.get("tooltip_columns") or []
    raw_metrics = form_data.get("tooltip_metrics") or []
    if not isinstance(raw_tooltips, list) or len(raw_tooltips) > 50:
        raise ValueError("Gantt tooltip_columns must contain at most 50 entries")
    if not isinstance(raw_metrics, list) or len(raw_metrics) > 50:
        raise ValueError("Gantt tooltip_metrics must contain at most 50 entries")
    tooltip_columns = [
        require_column(column, f"tooltip_columns[{index}]")
        for index, column in enumerate(raw_tooltips)
    ]
    orderby = _parse_orderby(form_data.get("order_by_cols"))
    columns = _dedupe_query_fields(
        [
            start_time,
            end_time,
            category,
            *series_columns,
            *tooltip_columns,
            *(item[0] for item in orderby),
        ],
        _column_label,
    )
    return columns, list(raw_metrics), orderby, series_columns


def _table_time_offsets(form_data: dict[str, Any], query: dict[str, Any]) -> list[Any]:
    """Resolve the Table plugin's custom/inherit comparison offsets."""
    if not _time_comparison(form_data, query.get("metrics") or []):
        return []
    offsets: list[Any] = []
    for offset in _as_list(form_data.get("time_compare")):
        if offset == "custom":
            offset = form_data.get("start_date_offset")
        elif offset == "inherit":
            offset = "inherit"
        if offset is not None and offset not in offsets:
            offsets.append(offset)
    extra = form_data.get("extra_form_data")
    if isinstance(extra, dict):
        offset = extra.get("time_compare")
        if offset is not None and offset not in offsets:
            offsets = [offset]
    return offsets


def _table_totals_metrics(metrics: list[Any], aggregate: Any) -> list[Any]:
    """Mirror ``getTotalsMetrics`` for Table summary queries."""
    if aggregate not in {"SUM", "AVG"}:
        return metrics
    result: list[Any] = []
    for metric in metrics:
        if isinstance(metric, dict) and metric.get("expressionType") == "SIMPLE":
            result.append({**metric, "aggregate": aggregate})
        else:
            result.append(metric)
    return result


def _temporal_column(column: Any, form_data: dict[str, Any]) -> Any:
    """Apply the frontend BASE_AXIS wrapper for a physical temporal column."""
    if not isinstance(column, str) or not form_data.get("time_grain_sqla"):
        return column
    lookup = form_data.get("temporal_columns_lookup")
    if not isinstance(lookup, dict) or not lookup.get(column):
        return column
    return {
        "timeGrain": form_data["time_grain_sqla"],
        "columnType": "BASE_AXIS",
        "sqlExpression": column,
        "label": column,
        "expressionType": "SQL",
    }


def _normalize_orderby(query: dict[str, Any]) -> None:
    """Mirror ``normalizeOrderBy`` without dropping independent mixed state."""
    orderby = query.get("orderby")
    if (
        isinstance(orderby, list)
        and orderby
        and isinstance(orderby[0], (list, tuple))
        and len(orderby[0]) == 2
        and orderby[0][0]
        and isinstance(orderby[0][1], bool)
    ):
        return
    query.pop("orderby", None)
    target = query.get("series_limit_metric") or query.get("legacy_order_by")
    if target is None:
        metrics = query.get("metrics") or []
        target = metrics[0] if metrics else None
    if target is not None:
        query["orderby"] = [[target, not query.get("order_desc", True)]]


def _time_comparison(form_data: dict[str, Any], metrics: list[Any]) -> bool:
    return bool(
        metrics
        and _as_list(form_data.get("time_compare"))
        and form_data.get("comparison_type")
        in {"values", "difference", "percentage", "ratio"}
    )


def _timeseries_post_processing(  # noqa: C901
    form_data: dict[str, Any],
    query: dict[str, Any],
    *,
    operator_metrics: list[Any] | None = None,
    complete_timeseries_contract: bool = False,
) -> list[dict[str, Any]]:
    """Build the frontend Mixed/Timeseries post-processing contract.

    Timeseries passes its pre-extra-metric QueryObject to every operator, while
    adding ``extractExtraMetrics`` only to its final query and normal pivot.
    Mixed passes each layer QueryObject and implements the smaller operator set
    in its own frontend builder.
    """
    metrics = (
        list(operator_metrics)
        if operator_metrics is not None
        else list(query.get("metrics") or [])
    )
    metric_labels = [label for metric in metrics if (label := _metric_label(metric))]
    x_axis = form_data.get("x_axis")
    x_label = (
        _column_label(x_axis)
        if x_axis
        else ("__timestamp" if form_data.get("granularity_sqla") else None)
    )
    series = _query_series_columns(query)
    series_labels = [label for column in series if (label := _column_label(column))]
    offsets = _as_list(form_data.get("time_compare"))
    comparison = _time_comparison(form_data, metrics)
    offset_map = {
        f"{metric}__{offset}": metric for metric in metric_labels for offset in offsets
    }
    pivot_metrics = (
        [*offset_map.values(), *offset_map.keys()]
        if comparison
        else [
            *metric_labels,
            *(
                [
                    label
                    for metric in _timeseries_extra_metrics(form_data)
                    if (label := _metric_label(metric))
                ]
                if complete_timeseries_contract
                else []
            ),
        ]
    )
    chain: list[dict[str, Any] | None] = []
    if x_label and pivot_metrics:
        chain.append(
            {
                "operation": "pivot",
                "options": {
                    "index": [x_label],
                    "columns": series_labels,
                    "aggregates": {
                        metric: {"operator": "mean"} for metric in pivot_metrics
                    },
                    "drop_missing_columns": not form_data.get(
                        "show_empty_columns", False
                    ),
                },
            }
        )
    method = form_data.get("resample_method")
    rule = form_data.get("resample_rule")
    if method and rule:
        zero_fill = method == "zerofill"
        chain.append(
            {
                "operation": "resample",
                "options": {
                    "method": "asfreq" if zero_fill else method,
                    "rule": rule,
                    "fill_value": 0 if zero_fill else None,
                },
            }
        )
    rolling_type = form_data.get("rolling_type")
    rolling_columns = (
        [*offset_map.values(), *offset_map.keys()] if comparison else metric_labels
    )
    if rolling_type == "cumsum":
        chain.append(
            {
                "operation": "cum",
                "options": {
                    "operator": "sum",
                    "columns": {column: column for column in rolling_columns},
                },
            }
        )
    elif rolling_type in {"sum", "mean", "std"}:
        chain.append(
            {
                "operation": "rolling",
                "options": {
                    "rolling_type": rolling_type,
                    "window": int(form_data.get("rolling_periods") or 1),
                    "min_periods": int(form_data.get("min_periods") or 0),
                    "columns": {column: column for column in rolling_columns},
                },
            }
        )
    comparison_type = form_data.get("comparison_type")
    if comparison and comparison_type != "values":
        chain.append(
            {
                "operation": "compare",
                "options": {
                    "source_columns": list(offset_map.values()),
                    "compare_columns": list(offset_map.keys()),
                    "compare_type": comparison_type,
                    "drop_original_columns": True,
                },
            }
        )
    if complete_timeseries_contract and form_data.get("contributionMode"):
        chain.append(
            {
                "operation": "contribution",
                "options": {
                    "orientation": form_data["contributionMode"],
                    "time_shifts": offsets if comparison else [],
                },
            }
        )
    if comparison:
        rename: dict[str, str | None] = {}
        for shifted, metric in offset_map.items():
            offset = next(
                (item for item in offsets if shifted.endswith(f"__{item}")), None
            )
            source = (
                shifted
                if comparison_type == "values"
                else f"{comparison_type}__{metric}__{shifted}"
            )
            rename[source] = f"{metric}, {offset}" if len(metrics) > 1 else offset
        if rename:
            chain.append(
                {
                    "operation": "rename",
                    "options": {"columns": rename, "level": 0, "inplace": True},
                }
            )
    elif (
        x_label
        and len(metrics) == 1
        and (series_labels or len(offsets) > 1)
        and form_data.get("truncate_metric") is not None
        and form_data.get("truncate_metric")
    ):
        chain.append(
            {
                "operation": "rename",
                "options": {
                    "columns": {metric_labels[0]: None},
                    "level": 0,
                    "inplace": True,
                },
            }
        )
    if complete_timeseries_contract:
        x_axis_sort = form_data.get("x_axis_sort")
        x_axis_sort_asc = form_data.get("x_axis_sort_asc")
        sortable_labels = [
            label
            for label in [
                x_label,
                *(
                    _metric_label(metric)
                    for metric in _as_list(form_data.get("metrics"))
                ),
                *(
                    _metric_label(metric)
                    for metric in _timeseries_extra_metrics(form_data)
                ),
            ]
            if label
        ]
        if (
            x_axis_sort is not None
            and x_axis_sort_asc is not None
            and x_axis_sort in sortable_labels
            and not _as_list(form_data.get("groupby"))
        ):
            options: dict[str, Any] = {"ascending": x_axis_sort_asc}
            if x_axis_sort == x_label:
                options["is_sort_index"] = True
            else:
                options["by"] = x_axis_sort
            chain.append({"operation": "sort", "options": options})
    chain.append({"operation": "flatten"})

    if complete_timeseries_contract and form_data.get("forecastEnabled") and x_label:
        x_axis_grain = (
            x_axis.get("timeGrain")
            if isinstance(x_axis, dict)
            and x_axis.get("expressionType") in {"SIMPLE", "SQL"}
            else None
        )
        time_grain = (
            x_axis_grain
            or (query.get("extras") or {}).get("time_grain_sqla")
            or form_data.get("time_grain_sqla")
            or "P1D"
        )
        chain.append(
            {
                "operation": "prophet",
                "options": {
                    "time_grain": time_grain,
                    "periods": int(form_data.get("forecastPeriods", 10)),
                    "confidence_interval": float(
                        form_data.get("forecastInterval", 0.8)
                    ),
                    "yearly_seasonality": form_data.get("forecastSeasonalityYearly"),
                    "weekly_seasonality": form_data.get("forecastSeasonalityWeekly"),
                    "daily_seasonality": form_data.get("forecastSeasonalityDaily"),
                    "index": x_label,
                },
            }
        )
    return [operator for operator in chain if operator is not None]


def _mixed_layer_form_data(
    form_data: dict[str, Any], *, secondary: bool
) -> dict[str, Any]:
    """Mirror MixedTimeseries remove/retainFormDataSuffix for one layer."""
    if not secondary:
        return {
            key: value for key, value in form_data.items() if not key.endswith("_b")
        }
    layer = {key: value for key, value in form_data.items() if not key.endswith("_b")}
    for isolated_key in (
        "metrics",
        "groupby",
        "orderby",
        "limit",
        "series_limit",
        "timeseries_limit_metric",
        "series_limit_metric",
        "order_desc",
        "row_limit",
        "truncate_metric",
        "time_compare",
        "comparison_type",
        "resample_method",
        "resample_rule",
        "rolling_type",
        "rolling_periods",
        "min_periods",
        "show_empty_columns",
    ):
        if f"{isolated_key}_b" not in form_data:
            layer.pop(isolated_key, None)
    # Suffixed values are visited first by retainFormDataSuffix and therefore
    # override same-named shared controls without leaking primary-only state.
    for key, value in form_data.items():
        if key.endswith("_b"):
            layer[key[:-2]] = value
    return layer


def _pivot_grouping_sets(
    form_data: dict[str, Any], rows: list[Any], columns: list[Any]
) -> list[list[str]] | None:
    """Mirror Pivot Table's non-additive GROUPING SETS contract."""
    metrics = _as_list(form_data.get("metrics"))
    additive = bool(metrics) and all(
        isinstance(metric, dict)
        and metric.get("expressionType") == "SIMPLE"
        and metric.get("aggregate") in {"SUM", "COUNT", "MIN", "MAX"}
        for metric in metrics
    )
    if additive:
        return None

    show_values = form_data.get("showValuesAs")
    needs_rows_collapsed = show_values in {"percent_col", "percent_total"}
    needs_columns_collapsed = show_values in {"percent_row", "percent_total"}
    row_prefixes = [[], *(rows[: index + 1] for index in range(len(rows)))]
    column_prefixes = [
        [],
        *(columns[: index + 1] for index in range(len(columns))),
    ]
    row_prefixes = [
        prefix
        for prefix in row_prefixes
        if len(prefix) == len(rows)
        or (not prefix and (form_data.get("colTotals") or needs_rows_collapsed))
        or (prefix and form_data.get("rowSubTotals"))
    ]
    column_prefixes = [
        prefix
        for prefix in column_prefixes
        if len(prefix) == len(columns)
        or (not prefix and (form_data.get("rowTotals") or needs_columns_collapsed))
        or (prefix and form_data.get("colSubTotals"))
    ]

    if form_data.get("combineMetric"):

        def forced_denominator(row_prefix: list[Any], column_prefix: list[Any]) -> bool:
            return bool(
                (needs_rows_collapsed and not row_prefix)
                or (needs_columns_collapsed and not column_prefix)
            )

        combinations = [
            (row_prefix, column_prefix)
            for row_prefix in row_prefixes
            for column_prefix in column_prefixes
            if (
                (
                    len(row_prefix) == len(rows)
                    if form_data.get("metricsLayout") == "ROWS"
                    else len(column_prefix) == len(columns)
                )
                or forced_denominator(row_prefix, column_prefix)
            )
        ]
    else:
        combinations = [
            (row_prefix, column_prefix)
            for row_prefix in row_prefixes
            for column_prefix in column_prefixes
        ]
    levels: list[list[str]] = []
    for row_prefix, column_prefix in combinations:
        labels: list[str] = []
        for column in [*row_prefix, *column_prefix]:
            label = _column_label(column)
            if label and label not in labels:
                labels.append(label)
        levels.append(labels)
    return levels


def _build_single_query_dict(  # noqa: C901
    form_data: dict[str, Any],
    columns: list[Any],
    metrics: list[Any],
    row_limit: int | None = None,
    order_desc: bool | None = None,
    orderby: list[Any] | None = None,
    include_common_temporal: bool = True,
) -> dict[str, Any]:
    """Build one query entry with explicitly scoped ordering.

    ``mixed_timeseries`` has two independent form-data namespaces.  Callers
    must therefore select the ordering for each query rather than allowing a
    primary ``form_data.orderby`` value to leak into every query shape.
    """
    qd: dict[str, Any] = {"columns": columns, "metrics": metrics}
    effective_row_limit = row_limit
    if effective_row_limit is None:
        effective_row_limit = form_data.get("row_limit")
    if effective_row_limit is not None:
        qd["row_limit"] = effective_row_limit
    effective_order_desc = (
        order_desc if order_desc is not None else form_data.get("order_desc")
    )
    if effective_order_desc is not None:
        qd["order_desc"] = effective_order_desc
    if orderby:
        qd["orderby"] = orderby
    for key in (
        "annotation_layers",
        "row_offset",
        "series_columns",
        "group_others_when_limit_reached",
        "is_timeseries",
        "time_offsets",
        "time_compare_full_range",
    ):
        if key in form_data and form_data[key] is not None:
            qd[key] = form_data[key]

    # ``buildQueryObject`` keeps the modern series-limit controls, falls back
    # to their legacy Timeseries names, and defaults the limit to zero.  A
    # malformed modern metric does not mask a valid legacy metric.
    series_limit = form_data.get("series_limit")
    if series_limit is None:
        series_limit = form_data.get("limit")
    if series_limit is not None:
        qd["series_limit"] = series_limit
    series_limit_metric = form_data.get("series_limit_metric")
    if not _is_query_form_metric(series_limit_metric):
        series_limit_metric = form_data.get("timeseries_limit_metric")
    if series_limit_metric is not None:
        qd["series_limit_metric"] = series_limit_metric
    apply_form_data_filters_to_query(qd, form_data)
    # Mirror the common ``buildQueryObject``/``extractExtras`` translation used
    # by native frontend plugins. ``granularity_sqla`` is a form-data control,
    # while QueryObject calls the field ``granularity``; the SQL time grain is
    # carried inside ``extras`` rather than as a top-level query field.
    if include_common_temporal:
        granularity = form_data.get("granularity") or form_data.get("granularity_sqla")
        if granularity:
            qd["granularity"] = granularity
        if time_grain := form_data.get("time_grain_sqla"):
            qd["extras"] = {
                **(qd.get("extras") or {}),
                "time_grain_sqla": time_grain,
            }
        elif extras := qd.get("extras"):
            # A cleared common control must not be resurrected by stale
            # form-data extras. ``extractExtras`` constructs this value from
            # the common control rather than accepting an extras copy.
            extras.pop("time_grain_sqla", None)
            if not extras:
                qd.pop("extras")
    return qd


def _build_mixed_timeseries_secondary(
    form_data: dict[str, Any],
    x_axis_col: str | None,
    engine: str,
    row_limit: int | None = None,
    order_desc: bool | None = None,
) -> dict[str, Any]:
    """Build the secondary query dict for the ``mixed_timeseries`` viz type."""
    # avoid circular import
    from superset.utils.core import split_adhoc_filters_into_base_filters

    metrics_b: list[Any] = list(form_data.get("metrics_b") or [])
    raw_b = form_data.get("groupby_b") or []
    groupby_b: list[Any] = [raw_b] if isinstance(raw_b, str) else list(raw_b)
    if x_axis_col and x_axis_col not in groupby_b:
        groupby_b = [x_axis_col] + groupby_b

    qd = _build_single_query_dict(
        form_data,
        groupby_b,
        metrics_b,
        row_limit=row_limit,
        order_desc=order_desc,
        orderby=form_data.get("orderby_b"),
    )
    if time_range_b := form_data.get("time_range_b"):
        qd["time_range"] = time_range_b
    if row_limit is None and (row_limit_b := form_data.get("row_limit_b")) is not None:
        qd["row_limit"] = row_limit_b

    if adhoc_filters_b := form_data.get("adhoc_filters_b"):
        secondary_fd: dict[str, Any] = {"adhoc_filters": adhoc_filters_b}
        split_adhoc_filters_into_base_filters(secondary_fd, engine)
        if secondary_filters := secondary_fd.get("filters"):
            qd["filters"] = secondary_filters
        else:
            qd.pop("filters", None)
        for clause in ("where", "having"):
            if secondary_clause := secondary_fd.get(clause):
                qd[clause] = secondary_clause
            else:
                qd.pop(clause, None)
    return qd


def build_query_dicts_from_form_data(  # noqa: C901
    form_data: dict[str, Any],
    datasource_id: Any,
    datasource_type: str,
    chart: Any | None = None,
    extra_form_data: dict[str, Any] | None = None,
    row_limit: int | None = None,
    order_desc: bool | None = None,
) -> list[dict[str, Any]]:
    """Build chart-type-aware query dicts from Explore form_data."""
    engine = resolve_datasource_engine(datasource_id, datasource_type)
    prepare_form_data_for_query(
        form_data,
        datasource_id,
        datasource_type,
        extra_form_data,
        datasource_engine=engine,
    )

    metrics, groupby = resolve_metrics_and_groupby(form_data, chart)
    viz_type: str = (
        form_data.get("viz_type")
        or (getattr(chart, "viz_type", "") if chart else "")
        or ""
    )

    # Each branch below is a direct Python rendering of the named frontend
    # plugin's buildQuery. Keep this dispatcher exhaustive for every native
    # viz type produced by an MCP typed adapter; falling through is reserved
    # for legacy/plugin charts whose common buildQueryObject contract is enough.
    if viz_type == "histogram_v2":
        column = form_data.get("column")
        histogram_groupby = _as_list(form_data.get("groupby"))
        query = _build_single_query_dict(
            form_data,
            [*histogram_groupby, column] if column is not None else histogram_groupby,
            [],
            row_limit=row_limit,
            order_desc=order_desc,
        )
        having_filter = any(
            isinstance(filter_, dict) and filter_.get("clause") == "HAVING"
            for filter_ in form_data.get("adhoc_filters") or []
        )
        if having_filter:
            query["metrics"] = [
                {
                    "expressionType": "SQL",
                    "sqlExpression": "COUNT(*)",
                    "label": "COUNT(*)",
                }
            ]
        bins = form_data.get("bins", 5)
        try:
            parsed_bins = float(bins)
            parsed_bins = int(parsed_bins) if parsed_bins.is_integer() else parsed_bins
        except (TypeError, ValueError):
            parsed_bins = 5
        query["post_processing"] = [
            {
                "operation": "histogram",
                "options": {
                    "column": _column_label(column),
                    "groupby": [
                        label
                        for item in histogram_groupby
                        if (label := _column_label(item))
                    ],
                    "bins": parsed_bins,
                    "cumulative": form_data.get("cumulative"),
                    "normalize": form_data.get("normalize"),
                },
            }
        ]
        return [query]

    if viz_type == "box_plot":
        distribute = _as_list(form_data.get("columns"))
        if not distribute and form_data.get("granularity_sqla"):
            distribute = [form_data["granularity_sqla"]]
        box_groupby = _as_list(form_data.get("groupby"))
        query = _build_single_query_dict(
            form_data,
            [
                *(_temporal_column(column, form_data) for column in distribute),
                *box_groupby,
            ],
            list(form_data.get("metrics") or []),
            row_limit=row_limit,
            order_desc=order_desc,
        )
        query["series_columns"] = box_groupby
        whisker = form_data.get("whiskerOptions")
        if whisker:
            whisker_type = "tukey"
            percentiles: list[int] | None = None
            if whisker == "Min/max (no outliers)":
                whisker_type = "min/max"
            elif match := re.fullmatch(
                r"(\d{1,3})/(\d{1,3}) percentiles", str(whisker)
            ):
                whisker_type = "percentile"
                percentiles = [int(match.group(1)), int(match.group(2))]
            elif whisker != "Tukey":
                raise ValueError(f"Unsupported whisker type: {whisker}")
            query["post_processing"] = [
                {
                    "operation": "boxplot",
                    "options": {
                        "whisker_type": whisker_type,
                        "percentiles": percentiles,
                        "groupby": [
                            label
                            for column in box_groupby
                            if (label := _column_label(column))
                        ],
                        "metrics": [
                            label
                            for metric in query["metrics"]
                            if (label := _metric_label(metric))
                        ],
                    },
                }
            ]
        return [query]

    if viz_type == "pivot_table_v2":
        rows = _as_list(form_data.get("groupbyRows"))
        pivot_columns = _as_list(form_data.get("groupbyColumns"))
        if form_data.get("transposePivot"):
            rows, pivot_columns = pivot_columns, rows
        columns = _dedupe_query_fields([*rows, *pivot_columns], _column_label)
        query = _build_single_query_dict(
            form_data,
            [_temporal_column(column, form_data) for column in columns],
            list(form_data.get("metrics") or []),
            row_limit=row_limit,
            order_desc=order_desc,
        )
        sort_metric = query.get("series_limit_metric")
        if sort_metric is None and query["metrics"]:
            sort_metric = query["metrics"][0]
        if sort_metric is not None:
            query["orderby"] = [[sort_metric, not query.get("order_desc", True)]]
        if grouping_sets := _pivot_grouping_sets(form_data, rows, pivot_columns):
            query["grouping_sets"] = grouping_sets
        return [query]

    if viz_type in {"pie", "sunburst_v2"}:
        metric = form_data.get("metric")
        query = _build_single_query_dict(
            form_data,
            _as_list(form_data.get("groupby")),
            [metric] if metric is not None else [],
            row_limit=row_limit,
            order_desc=order_desc,
            orderby=form_data.get("orderby"),
        )
        if form_data.get("sort_by_metric") and metric is not None:
            query["orderby"] = [[metric, False]]
        if viz_type == "pie" and (label := _metric_label(metric)):
            query["post_processing"] = [
                {
                    "operation": "contribution",
                    "options": {
                        "columns": [label],
                        "rename_columns": [f"{label}__contribution"],
                    },
                }
            ]
        return [query]

    if viz_type in {"table", "ag-grid-table"}:
        raw_mode = form_data.get("query_mode") == "raw" or (
            form_data.get("query_mode") not in {"raw", "aggregate"}
            and bool(form_data.get("all_columns"))
        )
        table_columns = list(
            (form_data.get("all_columns") or [])
            if raw_mode
            else (form_data.get("groupby") or [])
        )
        table_metrics = [] if raw_mode else list(form_data.get("metrics") or [])
        percent_metrics = [] if raw_mode else _as_list(form_data.get("percent_metrics"))
        table_metrics = _dedupe_query_fields(
            [*table_metrics, *percent_metrics], _metric_label
        )
        table_orderby = _parse_orderby(form_data.get("order_by_cols"))
        if not raw_mode:
            sort_metrics = _as_list(form_data.get("timeseries_limit_metric"))
            if sort_metrics:
                table_orderby = [
                    [sort_metrics[0], not form_data.get("order_desc", False)]
                ]
            elif table_metrics:
                table_orderby = [[table_metrics[0], False]]
        query = _build_single_query_dict(
            form_data,
            table_columns,
            table_metrics,
            row_limit=row_limit,
            order_desc=order_desc,
            orderby=table_orderby,
        )
        if not raw_mode:
            query["columns"] = [
                _temporal_column(column, form_data) for column in table_columns
            ]
        offsets = _table_time_offsets(form_data, query)
        query["time_offsets"] = offsets
        post_processing: list[dict[str, Any]] = []
        contribution: dict[str, Any] | None = None
        if percent_metrics:
            labels: list[str] = []
            for metric in percent_metrics:
                if label := _metric_label(metric):
                    candidates = [label]
                    if offsets:
                        candidates.extend(f"{label}__{offset}" for offset in offsets)
                    for candidate in candidates:
                        if candidate not in labels:
                            labels.append(candidate)
            contribution = {
                "operation": "contribution",
                "options": {
                    "columns": labels,
                    "rename_columns": [f"%{label}" for label in labels],
                },
            }
            post_processing.append(contribution)
        if offsets and form_data.get("comparison_type") != "values":
            source: list[str] = []
            shifted: list[str] = []
            for metric in table_metrics:
                if label := _metric_label(metric):
                    for offset in offsets:
                        source.append(label)
                        shifted.append(f"{label}__{offset}")
            post_processing.append(
                {
                    "operation": "compare",
                    "options": {
                        "source_columns": source,
                        "compare_columns": shifted,
                        "compare_type": form_data.get("comparison_type"),
                        "drop_original_columns": True,
                    },
                }
            )
        query["post_processing"] = post_processing

        configured_limit = form_data.get("row_limit")
        if form_data.get("server_pagination"):
            page_size = form_data.get("server_page_length") or 0
            if page_size:
                query["row_limit"] = (
                    min(page_size, configured_limit) if configured_limit else page_size
                )
            query["row_offset"] = 0

        extra_queries: list[dict[str, Any]] = []
        if (
            form_data.get("percent_metric_calculation") == "all_records"
            and percent_metrics
        ):
            extra_queries.append(
                {
                    **query,
                    "columns": [],
                    "metrics": percent_metrics,
                    "post_processing": [],
                    "row_limit": 0,
                    "row_offset": 0,
                    "orderby": [],
                    "is_timeseries": False,
                }
            )
        if table_metrics and form_data.get("show_totals") and not raw_mode:
            totals = {
                **query,
                "columns": [],
                "metrics": _table_totals_metrics(
                    table_metrics, form_data.get("totals_aggregate")
                ),
                "row_limit": 0,
                "row_offset": 0,
                "post_processing": [contribution] if contribution else [],
            }
            totals.pop("orderby", None)
            totals.pop("order_desc", None)
            extra_queries.append(totals)
        if form_data.get("server_pagination"):
            rowcount = {
                **query,
                "time_offsets": [],
                "row_limit": configured_limit or 0,
                "row_offset": 0,
                "post_processing": [],
                "is_rowcount": True,
            }
            return [query, rowcount, *extra_queries]
        return [query, *extra_queries]

    if viz_type in {"gantt", "gantt_chart"}:
        (
            gantt_columns,
            gantt_metrics,
            gantt_orderby,
            gantt_groupby,
        ) = resolve_gantt_query_fields(form_data)
        query = _build_single_query_dict(
            form_data,
            gantt_columns,
            gantt_metrics,
            row_limit=row_limit,
            order_desc=order_desc,
            orderby=gantt_orderby,
        )
        query["series_columns"] = gantt_groupby
        return [query]

    if viz_type == "ag-grid-pivot-table":
        interactive_columns = [
            _temporal_column(column, form_data)
            for column in _as_list(form_data.get("groupby"))
        ]
        query = _build_single_query_dict(
            form_data,
            interactive_columns,
            list(form_data.get("metrics") or []),
            row_limit=row_limit,
            order_desc=order_desc,
            orderby=form_data.get("orderby"),
        )
        _normalize_orderby(query)
        return [query]

    if viz_type in {"big_number", "big_number_total"}:
        metric = form_data.get("metric")
        columns = (
            resolve_big_number_columns(form_data) if viz_type == "big_number" else []
        )
        query = _build_single_query_dict(
            form_data,
            columns,
            [metric] if metric is not None else [],
            row_limit=row_limit,
            order_desc=order_desc,
            orderby=form_data.get("orderby"),
        )
        if viz_type == "big_number":
            # Big Number has no series dimension. Its frontend pivot receives
            # the common base QueryObject (whose columns are empty), not the
            # final QueryObject after the explicit x-axis is added. Preserve
            # that distinction instead of falling back to the final columns.
            query["series_columns"] = []
            if not form_data.get("x_axis"):
                query["is_timeseries"] = True
            query["post_processing"] = _timeseries_post_processing(form_data, query)
            if form_data.get("aggregation") == "raw":
                return [
                    query,
                    {
                        **query,
                        "columns": [],
                        "is_timeseries": False,
                        "post_processing": [],
                    },
                ]
        return [query]

    if viz_type.startswith("deck_"):
        return [
            _build_deck_query(
                form_data,
                viz_type,
                row_limit=row_limit,
                order_desc=order_desc,
            )
        ]

    if viz_type == "waterfall":
        # normalizeTimeColumn runs after Waterfall's buildQuery callback. It
        # wraps only the final x-axis column; orderby deliberately retains the
        # raw control value produced inside the callback.
        raw_axis = form_data.get("x_axis") or form_data.get("granularity_sqla")
        query_axis = (
            _normalized_x_axis_query_field(form_data)
            if form_data.get("x_axis")
            else raw_axis
        )
        waterfall_columns = ([query_axis] if query_axis else []) + groupby
        raw_ordering_columns = ([raw_axis] if raw_axis else []) + groupby
        query = _build_single_query_dict(
            form_data,
            waterfall_columns,
            metrics,
            row_limit=row_limit,
            order_desc=order_desc,
            orderby=None,
        )
        query["orderby"] = [[column, True] for column in raw_ordering_columns]
        if form_data.get("x_axis"):
            query.pop("is_timeseries", None)
        return [query]

    if viz_type == "mixed_timeseries":
        from superset.utils.core import split_adhoc_filters_into_base_filters

        queries: list[dict[str, Any]] = []
        x_axis = _normalized_x_axis_query_field(form_data)
        for secondary in (False, True):
            layer = _mixed_layer_form_data(form_data, secondary=secondary)
            if secondary and form_data.get("adhoc_filters_b") is not None:
                for key in ("filters", "where", "having"):
                    layer.pop(key, None)
                layer["adhoc_filters"] = form_data.get("adhoc_filters_b") or []
                split_adhoc_filters_into_base_filters(layer, engine)
            layer_metrics = _timeseries_base_metrics(layer)
            layer_groupby = _as_list(layer.get("groupby"))
            columns = [*(_as_list(x_axis) if x_axis else []), *layer_groupby]
            query = _build_single_query_dict(
                layer,
                _dedupe_query_fields(columns, _column_label),
                layer_metrics,
                row_limit=row_limit,
                order_desc=order_desc,
                orderby=layer.get("orderby"),
            )
            query["series_columns"] = layer_groupby
            if not x_axis:
                query["is_timeseries"] = True
            comparison = _time_comparison(layer, layer_metrics)
            query["time_offsets"] = (
                _as_list(layer.get("time_compare")) if comparison else []
            )
            query["post_processing"] = _timeseries_post_processing(
                layer,
                query,
                operator_metrics=layer_metrics,
            )
            _normalize_orderby(query)
            queries.append(query)
        return queries

    if viz_type.startswith("echarts_timeseries") or viz_type == "echarts_area":
        x_axis = _normalized_x_axis_query_field(form_data)
        timeseries_metrics = _timeseries_base_metrics(form_data)
        extra_metrics = _timeseries_extra_metrics(form_data)
        timeseries_groupby = _as_list(form_data.get("groupby"))
        columns = [*(_as_list(x_axis) if x_axis else []), *timeseries_groupby]
        query = _build_single_query_dict(
            form_data,
            _dedupe_query_fields(columns, _column_label),
            [*timeseries_metrics, *extra_metrics],
            row_limit=row_limit,
            order_desc=order_desc,
            orderby=form_data.get("orderby"),
        )
        query["series_columns"] = timeseries_groupby
        if not x_axis:
            query["is_timeseries"] = True
        comparison = _time_comparison(form_data, timeseries_metrics)
        query["time_offsets"] = (
            _as_list(form_data.get("time_compare")) if comparison else []
        )
        query["time_compare_full_range"] = bool(
            query["time_offsets"] and form_data.get("time_compare_full_range")
        )
        query["post_processing"] = _timeseries_post_processing(
            form_data,
            query,
            operator_metrics=timeseries_metrics,
            complete_timeseries_contract=True,
        )
        _normalize_orderby(query)
        return [query]

    return [
        _build_single_query_dict(
            form_data,
            groupby,
            metrics,
            row_limit=row_limit,
            order_desc=order_desc,
            orderby=form_data.get("orderby"),
        )
    ]


def resolve_form_data_datasource(
    form_data: dict[str, Any],
    chart: Any | None = None,
) -> tuple[int | str | None, str]:
    """Resolve datasource id/type from form_data with chart fallbacks."""
    datasource_id = form_data.get("datasource_id")
    datasource_type = form_data.get("datasource_type")

    if not datasource_id and (combined := form_data.get("datasource")):
        if isinstance(combined, str) and "__" in combined:
            parts = combined.split("__", 1)
            datasource_id = int(parts[0]) if parts[0].isdigit() else parts[0]
            datasource_type = parts[1] if len(parts) > 1 else None

    if not datasource_id and chart:
        datasource_id = getattr(chart, "datasource_id", None)
    if not datasource_type and chart:
        datasource_type = getattr(chart, "datasource_type", None)

    return datasource_id, datasource_type if isinstance(
        datasource_type, str
    ) else "table"


def build_query_context_from_form_data(
    form_data: dict[str, Any],
    chart: Any | None = None,
    extra_form_data: dict[str, Any] | None = None,
    row_limit: int | None = None,
    order_desc: bool | None = None,
    result_type: Any = None,
    force: bool = False,
    custom_cache_timeout: int | None = None,
) -> Any:
    """Build a QueryContext from chart-type-aware Explore form_data."""
    # avoid circular import
    from superset.common.query_context_factory import QueryContextFactory

    datasource_id, datasource_type = resolve_form_data_datasource(form_data, chart)
    if not isinstance(datasource_id, (int, str)):
        raise ValueError(
            "Cannot determine datasource ID from form_data. "
            "Provide a chart identifier or ensure form_data contains "
            "'datasource_id' or 'datasource'."
        )

    queries = build_query_dicts_from_form_data(
        form_data,
        datasource_id,
        datasource_type,
        chart=chart,
        extra_form_data=extra_form_data,
        row_limit=row_limit,
        order_desc=order_desc,
    )
    return QueryContextFactory().create(
        datasource={"id": datasource_id, "type": datasource_type},
        queries=queries,
        form_data=form_data,
        result_type=result_type,
        force=force,
        custom_cache_timeout=custom_cache_timeout,
    )


def extract_form_data_key_from_url(url: str | None) -> str | None:
    """Extract the form_data_key query parameter from an explore URL.

    Returns the form_data_key value or None if not found or URL is empty.
    """
    if not url:
        return None
    parsed = urlparse(url)
    values = parse_qs(parsed.query).get("form_data_key", [])
    return values[0] if values else None


def _match_adhoc_by_subject(
    adhoc_filters: Any, column: str | None
) -> tuple[str | None, Any] | None:
    if not column or not isinstance(adhoc_filters, list):
        return None
    for af in adhoc_filters:
        if isinstance(af, dict) and af.get("subject") == column:
            return af.get("operator"), af.get("comparator")
    return None


def _match_legacy_by_col(
    legacy_filters: Any, column: str | None
) -> tuple[str | None, Any] | None:
    if not column or not isinstance(legacy_filters, list):
        return None
    for f in legacy_filters:
        if isinstance(f, dict) and f.get("col") == column:
            return f.get("op"), f.get("val")
    return None


def _resolve_filter_operator_and_value(
    extra_form_data: dict[str, Any] | None,
    column: str | None,
) -> tuple[str | None, Any]:
    """Pull operator and value for a dashboard filter from its
    default extra_form_data, matching on target column where applicable."""
    if not extra_form_data:
        return None, None

    if match := _match_adhoc_by_subject(extra_form_data.get("adhoc_filters"), column):
        return match
    if match := _match_legacy_by_col(extra_form_data.get("filters"), column):
        return match
    # Temporal filters contribute time_range with no target column
    if time_range := extra_form_data.get("time_range"):
        return "TIME_RANGE", time_range
    return None, None


def build_applied_dashboard_filters(
    dashboard_id: int, chart_id: int
) -> list[AppliedDashboardFilter]:
    """Resolve dashboard-level native filters in scope for a chart.

    Validates that the dashboard exists, the caller has access, and the chart
    is on the dashboard. Returns one AppliedDashboardFilter per non-DIVIDER
    native filter whose scope includes the chart, populated with the filter's
    default operator and value.

    Raises DashboardNotFoundError if the dashboard is missing,
    ChartNotOnDashboardError if the chart is not on it, and
    SupersetSecurityException if the caller cannot access the dashboard.
    """
    # Local imports avoid circular deps at module load
    from superset import db, security_manager
    from superset.charts.data.dashboard_filter_context import (
        _extract_filter_extra_form_data,
        _get_filter_target_column,
        _is_filter_in_scope_for_chart,
    )
    from superset.commands.dashboard.exceptions import DashboardNotFoundError
    from superset.mcp_service.chart.schemas import AppliedDashboardFilter
    from superset.models.dashboard import Dashboard
    from superset.utils import json

    dashboard = db.session.query(Dashboard).filter_by(id=dashboard_id).one_or_none()
    if not dashboard:
        raise DashboardNotFoundError(dashboard_id=str(dashboard_id))

    security_manager.raise_for_access(dashboard=dashboard)

    slice_ids = {slc.id for slc in dashboard.slices}
    if chart_id not in slice_ids:
        raise ChartNotOnDashboardError(
            f"Chart {chart_id} is not on dashboard {dashboard_id}"
        )

    metadata = json.loads(dashboard.json_metadata or "{}")
    native_filter_config = metadata.get("native_filter_configuration", [])
    if not isinstance(native_filter_config, list):
        return []
    position_json = json.loads(dashboard.position_json or "{}")
    if not isinstance(position_json, dict):
        position_json = {}

    applied: list[AppliedDashboardFilter] = []
    for flt in native_filter_config:
        if not isinstance(flt, dict):
            continue
        if flt.get("type", "") == "DIVIDER":
            continue
        if not _is_filter_in_scope_for_chart(flt, chart_id, position_json):
            continue

        extra_form_data, status = _extract_filter_extra_form_data(flt)
        column = _get_filter_target_column(flt)
        operator, value = _resolve_filter_operator_and_value(extra_form_data, column)

        applied.append(
            AppliedDashboardFilter(
                id=flt.get("id"),
                name=flt.get("name"),
                filter_type=flt.get("filterType"),
                column=column,
                operator=operator,
                value=value,
                status=status.value,
            )
        )

    return applied
