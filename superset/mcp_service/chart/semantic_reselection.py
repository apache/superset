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
"""Prove bounded table reselections without certifying inherited query state."""

from typing import Any

from superset.mcp_service.chart.chart_utils import map_config_to_form_data
from superset.mcp_service.chart.schemas import (
    ChartConfig,
    TableChartConfig,
    TableColumnConfig,
)

# These keys carry neither member identity nor executable query expressions.
_PRESENTATION_KEYS: frozenset[str] = frozenset(
    {
        "datasource",
        "slice_id",
        "slice_name",
        "viz_type",
        "semantic_selection_version",
        "row_limit",
        "color_scheme",
        "number_format",
        "date_format",
        "show_cell_bars",
        "show_totals",
        "page_length",
        "table_timestamp_format",
        "dashboards",
        "server_page_length",
        "allow_render_html",
        "color_pn",
    }
)
_QUERY_KEYS: frozenset[str] = frozenset(
    {
        "all_columns",
        "columns",
        "groupby",
        "metrics",
        "query_mode",
        "include_time",
        "order_desc",
        "adhoc_filters",
        "order_by_cols",
    }
)
_FILTER_KEYS: frozenset[str] = frozenset(
    {
        "adhoc_filters",
        "filters",
        "extra_filters",
        "where",
        "having",
    }
)
_EMPTY_LIST_KEYS: frozenset[str] = frozenset(
    {
        "conditional_formatting",
        "annotation_layers",
        "percent_metrics",
        "time_compare",
        "time_offsets",
        "extra_filters",
        "filters",
    }
)
_EMPTY_STRING_KEYS: frozenset[str] = frozenset(
    {
        "where",
        "having",
        "granularity",
        "granularity_sqla",
        "time_grain_sqla",
        "since",
        "until",
    }
)
_EMPTY_DICT_KEYS: frozenset[str] = frozenset(
    {
        "extra_form_data",
        "url_params",
        "semantic_selection_sources",
    }
)


def _neutral_control(key: str, value: Any) -> bool:
    """Recognize empty values only for individually classified controls."""
    if key in _EMPTY_LIST_KEYS:
        return value is None or value == []
    if key in _EMPTY_STRING_KEYS:
        return value is None or value == ""
    if key in _EMPTY_DICT_KEYS:
        return value is None or value == {}
    if key == "time_range":
        return value is None or value in ("", "No filter")
    return False


def _formatting_only(value: Any) -> bool:
    """Reject unmodeled nested formatting instead of assuming it is cosmetic."""
    if value is None:
        return True
    if not isinstance(value, dict):
        return False
    allowed: set[str] = {
        field.alias or name for name, field in TableColumnConfig.model_fields.items()
    }
    return all(
        isinstance(settings, dict) and set(settings) <= allowed
        for settings in value.values()
    )


def _category(key: str) -> str:
    """Name a recovery category without exposing saved values."""
    if key in _FILTER_KEYS:
        return "filters"
    if key == "order_by_cols":
        return "sorting"
    if key in _EMPTY_STRING_KEYS or key in {
        "time_range",
        "time_compare",
        "time_offsets",
    }:
        return "temporal selections"
    if key in _EMPTY_DICT_KEYS:
        return "external selections"
    return "native/plugin or secondary-query selections"


def _query_mismatch(fresh: dict[str, Any], candidate: dict[str, Any]) -> str | None:
    """Require every effective query role to match freshly mapped input."""
    for key in _QUERY_KEYS:
        expected: Any = fresh.get(key)
        actual: Any = candidate.get(key)
        if key in {
            "order_by_cols",
            "adhoc_filters",
            "metrics",
            "groupby",
            "columns",
            "all_columns",
        }:
            expected = [] if expected is None else expected
            actual = [] if actual is None else actual
        if actual != expected:
            return _category(key)
    return None


def _unverified_control(
    state: dict[str, Any],
    *,
    replacing_filters: bool = False,
    temporal_subject: str | None = None,
) -> str | None:
    """Classify retained controls without discarding unknown state."""
    for key, value in state.items():
        if key == "_mcp_dashboard_time_filter_subject":
            if temporal_subject is not None and value == temporal_subject:
                continue
            return "temporal selections"
        if key == "include_time" and value is not None and value is not False:
            return "temporal selections"
        if key in _PRESENTATION_KEYS or key in _QUERY_KEYS:
            continue
        if replacing_filters and key in _FILTER_KEYS:
            continue
        if key == "column_config" and _formatting_only(value):
            continue
        if _neutral_control(key, value):
            continue
        return _category(key)
    return None


def _has_saved_predicates(state: dict[str, Any]) -> bool:
    """Recognize predicate aliases without treating replacement as a clear."""
    for key in _FILTER_KEYS:
        value: Any = state.get(key)
        empty: str | list[Any] = "" if key in {"where", "having"} else []
        if value is not None and value != empty:
            return True
    return False


def prove_table_reselection(
    original: ChartConfig | None,
    resolved: ChartConfig | None,
    existing: dict[str, Any],
    candidate: dict[str, Any],
    *,
    temporal_columns: set[str] | None = None,
) -> str | None:
    """Return an incomplete category, or None for a fully repicked table."""
    if original is None:
        return "no reselection supplied"
    if not isinstance(original, TableChartConfig) or not isinstance(
        resolved, TableChartConfig
    ):
        return "unsupported chart type"
    if existing.get("viz_type") not in {"table", "ag-grid-table"}:
        return "unsupported saved chart type"
    if "columns" not in original.model_fields_set:
        return "columns"
    if "filters" not in original.model_fields_set or original.filters is None:
        return "filters"
    if original.filters != [] and _has_saved_predicates(existing):
        return "saved WHERE/HAVING predicates"
    fresh: dict[str, Any] = map_config_to_form_data(
        resolved, include_disabled=True, temporal_columns=temporal_columns
    )
    # Original presence, not equality or post-normalization fields_set, is proof.
    if "sort_by" not in original.model_fields_set or original.sort_by is None:
        if existing.get("order_by_cols") not in (None, []):
            return "sorting"
    return _unrequested_control_change(
        original, existing, candidate
    ) or _mapped_reselection_mismatch(original, existing, candidate, fresh)


def _mapped_reselection_mismatch(
    original: TableChartConfig,
    existing: dict[str, Any],
    candidate: dict[str, Any],
    fresh: dict[str, Any],
) -> str | None:
    """Compare effective mapped controls while preserving classified saved scalars."""
    # Aggregate mapping omits this scalar; retain the saved direction without
    # allowing it to carry a member identity or changing it during a rebind.
    if "order_desc" not in fresh and "order_desc" in existing:
        if not isinstance(existing["order_desc"], bool):
            return "sorting"
        fresh["order_desc"] = existing["order_desc"]
    temporal_subject: str | None = (
        fresh.get("_mcp_dashboard_time_filter_subject")
        if "temporal_column" in original.model_fields_set
        else None
    )
    if candidate.get("_mcp_dashboard_time_filter_subject") != temporal_subject:
        return "temporal selections"
    # Inspect saved state too: a rebind/cross-viz merge can discard controls.
    # Disappearance is not an explicit clear and must not manufacture proof.
    return (
        _query_mismatch(fresh, candidate)
        or _unverified_control(
            existing, replacing_filters=True, temporal_subject=temporal_subject
        )
        or _unverified_control(candidate, temporal_subject=temporal_subject)
    )


def _unrequested_control_change(
    original: TableChartConfig,
    existing: dict[str, Any],
    candidate: dict[str, Any],
) -> str | None:
    """Do not treat a rebind's dropped limits or sort direction as intent."""
    controls: tuple[tuple[str, str, str], ...] = (
        ("row_limit", "row_limit", "row limits"),
        ("order_desc", "sort_by", "sorting"),
    )
    for key, request_field, category in controls:
        if (
            key in existing
            and request_field not in original.model_fields_set
            and candidate.get(key) != existing[key]
        ):
            return category
    return None
