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
from typing import Any, TYPE_CHECKING
from urllib.parse import parse_qs, urlparse

from superset.constants import EXTRA_FORM_DATA_OVERRIDE_REGULAR_MAPPINGS

if TYPE_CHECKING:
    from superset.mcp_service.chart.schemas import AppliedDashboardFilter
    from superset.models.slice import Slice

logger = logging.getLogger(__name__)

QUERY_CONTEXT_EXTRA_FORM_DATA_OVERRIDE_KEYS = {
    "granularity",
    "time_grain",
    "time_grain_sqla",
    "time_range",
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
            query[key] = form_data[key]

    for clause in ("where", "having"):
        if additional_clause := form_data.get(clause):
            if existing_clause := query.get(clause):
                query[clause] = _join_sql_clause(existing_clause, additional_clause)
            else:
                query[clause] = additional_clause


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

    for col in form_data.get("js_columns") or []:
        if isinstance(col, str):
            _add(col)

    return columns


def resolve_metrics(form_data: dict[str, Any], viz_type: str) -> list[Any]:
    """Extract metrics from form_data, handling chart-type-specific fields."""
    if viz_type == "bubble":
        return [m for field in ("x", "y", "size") if (m := form_data.get(field))]

    metrics = form_data.get("metrics", [])
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
    viz_type = form_data.get(
        "viz_type", getattr(chart, "viz_type", "") if chart else ""
    )
    singular_metric_no_groupby = (
        "big_number",
        "big_number_total",
        "pop_kpi",
    )
    if viz_type in singular_metric_no_groupby:
        metrics: list[Any] = [metric] if (metric := form_data.get("metric")) else []
        return metrics, []

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


def _build_single_query_dict(
    form_data: dict[str, Any],
    columns: list[Any],
    metrics: list[Any],
    row_limit: int | None = None,
    order_desc: bool | None = None,
) -> dict[str, Any]:
    """Build one query entry for QueryContextFactory from form_data fields."""
    qd: dict[str, Any] = {"columns": columns, "metrics": metrics}
    effective_row_limit = row_limit
    if effective_row_limit is None:
        effective_row_limit = form_data.get("row_limit")
    if effective_row_limit is not None:
        qd["row_limit"] = effective_row_limit
    if order_desc is not None:
        qd["order_desc"] = order_desc
    apply_form_data_filters_to_query(qd, form_data)
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


# Deck.gl viz types that conditionally set is_timeseries from time_grain_sqla
_DECK_TIMESERIES_VIZ_TYPES: frozenset[str] = frozenset(
    {"deck_arc", "deck_path", "deck_polygon", "deck_scatter", "deck_screengrid"}
)


def build_query_dicts_from_form_data(
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

    # Deck.gl charts use spatial column configs rather than the standard
    # metrics / groupby fields. Extract columns from the spatial controls.
    if viz_type.startswith("deck_"):
        deck_columns = resolve_deck_gl_columns(form_data)
        deck_metrics = _resolve_deck_gl_metrics(form_data, viz_type)
        qd = _build_single_query_dict(
            form_data,
            deck_columns,
            deck_metrics,
            row_limit=row_limit,
            order_desc=order_desc,
        )
        if deck_metrics:
            # Mirror BaseDeckGLViz.query_obj(): order by first metric descending
            qd["orderby"] = [(deck_metrics[0], not form_data.get("order_desc", True))]
        if viz_type in _DECK_TIMESERIES_VIZ_TYPES and (
            time_grain := form_data.get("time_grain_sqla")
        ):
            qd["is_timeseries"] = True
            qd["granularity"] = form_data.get("granularity_sqla")
            qd.setdefault("extras", {})["time_grain_sqla"] = time_grain
        if form_data.get("filter_nulls", True):
            null_filters = _deck_gl_null_filters(form_data)
            if null_filters:
                qd["filters"] = [*(qd.get("filters") or []), *null_filters]
        return [qd]

    is_timeseries = (
        viz_type.startswith("echarts_timeseries") or viz_type == "mixed_timeseries"
    )

    x_axis_col: str | None = None
    if is_timeseries:
        x_axis_col = extract_x_axis_col(form_data)
        if x_axis_col and x_axis_col not in groupby:
            groupby = [x_axis_col] + groupby

    queries = [
        _build_single_query_dict(
            form_data,
            groupby,
            metrics,
            row_limit=row_limit,
            order_desc=order_desc,
        )
    ]
    if viz_type == "mixed_timeseries":
        queries.append(
            _build_mixed_timeseries_secondary(
                form_data,
                x_axis_col,
                engine,
                row_limit=row_limit,
                order_desc=order_desc,
            )
        )
    return queries


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
