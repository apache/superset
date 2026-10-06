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

"""Dashboard filter scope for MCP tool calls.

A client answering questions about a dashboard the user is looking at (an AI
assistant embedded next to it, for example) sends that dashboard's active
filters in the ``X-Superset-Dashboard-Scope`` request header. The header rides
every HTTP request of the conversation turn, so the model driving the tool
calls can neither see nor remove it, and a retried call carries it again.

Scope is a *correctness* control: answers must reflect the filtered view the
user sees. It is not an authorization boundary. RBAC, dataset permissions and
row-level security are applied by the normal execution paths exactly as
without a scope, and nothing here relaxes or replaces them.

Enforcement happens once per tool call in ``mcp_auth_hook`` (see
``apply_call_dashboard_scope``), before the tool runs. Every tool is in exactly
one class while a scope is active:

* rewritten: the tool's request is rewritten so the scope is AND-composed with
  whatever the model supplied. The rewrite happens before the tool builds a
  query, so every internal path and every cache key sees the scoped request.
* gated: allowed unless the particular call would return data the scope cannot
  be applied to, in which case it is refused.
* neutral: returns no dataset rows (metadata, links, mutations), unchanged.
* anything else, including extension tools and tools added later: refused.

A refusal is always explicit. Scope that cannot be applied is never dropped.
"""

from __future__ import annotations

import base64
import binascii
import logging
import zlib
from collections.abc import Callable, Mapping, Sequence
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime
from typing import Any, TYPE_CHECKING, TypeGuard

from fastmcp.exceptions import ToolError

from superset.constants import (
    EXTRA_FORM_DATA_APPEND_KEYS,
    EXTRA_FORM_DATA_OVERRIDE_REGULAR_MAPPINGS,
    NO_TIME_RANGE,
)
from superset.utils import json

if TYPE_CHECKING:
    import inspect

    from superset.models.slice import Slice

logger = logging.getLogger(__name__)

HEADER_NAME = "X-Superset-Dashboard-Scope"
SCOPE_VERSION = 1
# The header is compressed by the sender; these bound what a request can make
# the server allocate before any scope logic runs.
MAX_HEADER_LENGTH = 64 * 1024
MAX_PAYLOAD_BYTES = 1024 * 1024

REFUSAL_PREFIX = "Dashboard filter scope refused this call:"
_NO_QUERY = "No query was run."

# extra_form_data keys whose value decides which rows a query includes. A model
# may repeat the scope's value but never replace it.
ROW_OVERRIDE_KEYS = frozenset(
    {"time_range", "granularity_sqla", "time_column", "relative_start", "relative_end"}
)
# Keys that choose the column a time range applies to. Setting one while the
# scope carries filters would move the dashboard window to another column, and
# Superset's granularity handling drops existing filters on the chosen column.
TIME_TARGET_KEYS = frozenset({"granularity_sqla", "time_column"})
# Keys that only change presentation (bucketing, interactivity), never which
# rows are included. The model's value wins.
PRESENTATION_KEYS = frozenset(
    set(EXTRA_FORM_DATA_OVERRIDE_REGULAR_MAPPINGS) - ROW_OVERRIDE_KEYS
) | (set(EXTRA_FORM_DATA_APPEND_KEYS) - {"filters", "adhoc_filters"})

# Filter operators the dataset and SQL paths know how to apply. Anything else
# a dashboard sends is refused on those paths rather than guessed at.
SUPPORTED_OPERATORS = frozenset(
    {
        "==",
        "!=",
        ">",
        "<",
        ">=",
        "<=",
        "IN",
        "NOT IN",
        "IS NULL",
        "IS NOT NULL",
        "LIKE",
        "ILIKE",
    }
)
TEMPORAL_RANGE = "TEMPORAL_RANGE"

# Preview formats that carry query results rather than a link.
DATA_PREVIEW_FORMATS = frozenset({"ascii", "table", "vega_lite"})


class MCPDashboardScopeError(ToolError):
    """A tool call refused because the dashboard scope cannot be applied to it.

    Subclasses ``ToolError`` so the message reaches the caller verbatim and the
    model can explain the limitation instead of retrying blindly.
    """

    def __init__(self, reason: str, guidance: str = "") -> None:
        message = f"{REFUSAL_PREFIX} {reason} {_NO_QUERY}"
        if guidance:
            message = f"{message} {guidance}"
        super().__init__(message)


_USE_CHART_TOOLS = (
    "Use get_chart_data or get_dashboard_data on the dashboard's charts, which "
    "apply the filters each chart shows. The request must stay within the "
    "active dashboard filters."
)
_ASK_USER = (
    "Explain that the active dashboard filters cannot be applied to this "
    "request, and do not present unfiltered results as the filtered answer."
)


@dataclass(frozen=True)
class DashboardScope:
    """The active filters of the dashboard a request is scoped to."""

    dashboard_id: int
    # Chart id -> the extra_form_data the dashboard applies to that chart.
    # Charts on the dashboard without an entry have no active filters.
    chart_filters: Mapping[int, Mapping[str, Any]]

    @property
    def has_constraints(self) -> bool:
        """True when any chart's filters restrict which rows are included."""
        return any(_restricts_rows(efd) for efd in self.chart_filters.values())


@dataclass(frozen=True)
class DashboardConstraints:
    """Constraints for queries not tied to one dashboard chart.

    Derived from the queried dataset's charts, or all charts for other datasets.

    ``clauses`` are ``{"col", "op", "val"}`` dicts AND-ed into the query.
    ``time_range`` is the dashboard time window; ``time_column`` names the
    column it applies to. A time window without a resolved column must be
    refused by dataset and SQL queries.
    """

    clauses: tuple[dict[str, Any], ...]
    time_range: str | None
    time_column: str | None

    @property
    def is_empty(self) -> bool:
        return not self.clauses and self.time_range is None

    @property
    def columns(self) -> set[str]:
        return {clause["col"] for clause in self.clauses}


def _restricts_rows(extra_form_data: Mapping[str, Any]) -> bool:
    return bool(
        extra_form_data.get("filters")
        or extra_form_data.get("adhoc_filters")
        or _time_range(extra_form_data) is not None
    )


def _time_range(extra_form_data: Mapping[str, Any]) -> str | None:
    value = extra_form_data.get("time_range")
    if value is None or value == NO_TIME_RANGE:
        return None
    return value


# ---------------------------------------------------------------------------
# Header decoding
# ---------------------------------------------------------------------------


def _malformed(detail: str) -> MCPDashboardScopeError:
    return MCPDashboardScopeError(
        f"the {HEADER_NAME} request header is malformed ({detail}).",
        "This is a client integration error; the request cannot be answered "
        "until the client sends a valid dashboard scope.",
    )


def decode_dashboard_scope(value: str) -> DashboardScope:
    """Decode ``base64url(zlib(JSON))`` into a validated ``DashboardScope``.

    Any deviation is an error rather than "no scope": a caller that sent a
    scope expects it applied, so a garbled one must not silently widen answers.
    """
    if len(value) > MAX_HEADER_LENGTH:
        raise _malformed("too large")
    try:
        compressed = base64.b64decode(
            value.strip() + "=" * (-len(value.strip()) % 4),
            altchars=b"-_",
            validate=True,
        )
    except (binascii.Error, ValueError) as ex:
        raise _malformed("not base64url") from ex

    decompressor = zlib.decompressobj()
    try:
        raw = decompressor.decompress(compressed, MAX_PAYLOAD_BYTES + 1)
    except zlib.error as ex:
        raise _malformed("not zlib-compressed") from ex
    if len(raw) > MAX_PAYLOAD_BYTES or decompressor.unconsumed_tail:
        raise _malformed("payload too large")
    if not decompressor.eof:
        raise _malformed("truncated payload")

    try:
        payload = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, ValueError) as ex:
        raise _malformed("not JSON") from ex
    return _parse_payload(payload)


def _parse_payload(payload: Any) -> DashboardScope:
    if not isinstance(payload, dict):
        raise _malformed("payload must be a JSON object")
    if payload.get("version") != SCOPE_VERSION:
        raise _malformed(f"unsupported version {payload.get('version')!r}")
    dashboard_id = payload.get("dashboard_id")
    if not _is_positive_int(dashboard_id):
        raise _malformed("dashboard_id must be a positive integer")
    return DashboardScope(
        dashboard_id=dashboard_id,
        chart_filters=_parse_chart_filters(payload.get("chart_filters")),
    )


def _parse_chart_filters(raw_filters: Any) -> dict[int, Mapping[str, Any]]:
    if raw_filters is None:
        return {}
    if not isinstance(raw_filters, dict):
        raise _malformed("chart_filters must be an object")
    chart_filters: dict[int, Mapping[str, Any]] = {}
    for key, extra_form_data in raw_filters.items():
        chart_id = _chart_id(key)
        if chart_id is None:
            raise _malformed(f"chart id {key!r} is not a positive integer")
        if not isinstance(extra_form_data, dict):
            raise _malformed(f"filters for chart {chart_id} must be an object")
        # Checked by type, not truthiness: a falsy non-list such as ``false``
        # must not read as "no filters" and silently widen answers.
        for list_key in ("filters", "adhoc_filters"):
            if not isinstance(extra_form_data.get(list_key, []), (list, type(None))):
                raise _malformed(f"{list_key} for chart {chart_id} must be a list")
        for str_key in sorted(ROW_OVERRIDE_KEYS):
            if not isinstance(extra_form_data.get(str_key), (str, type(None))):
                raise _malformed(f"{str_key} for chart {chart_id} must be a string")
        chart_filters[chart_id] = extra_form_data
    return chart_filters


def _is_positive_int(value: Any) -> TypeGuard[int]:
    return isinstance(value, int) and not isinstance(value, bool) and value > 0


def _chart_id(value: Any) -> int | None:
    if _is_positive_int(value):
        return value
    if isinstance(value, str) and value.isdecimal() and int(value) > 0:
        return int(value)
    return None


def _scope_header_values() -> list[str]:
    """Every value of the scope header on the current MCP HTTP request."""
    from fastmcp.server.dependencies import get_http_request

    try:
        request = get_http_request()
    except RuntimeError:
        # stdio / in-process transports carry no HTTP headers.
        return []
    return request.headers.getlist(HEADER_NAME)


def get_request_dashboard_scope() -> DashboardScope | None:
    """The scope of the current request, or None when it carries none."""
    values = _scope_header_values()
    if not values:
        return None
    if len(values) > 1:
        raise _malformed("sent more than once")
    return decode_dashboard_scope(values[0])


# ---------------------------------------------------------------------------
# Per-chart composition
# ---------------------------------------------------------------------------


def _clause_key(clause: Any) -> str:
    return json.dumps(clause, sort_keys=True, default=str)


def _dedupe(clauses: list[Any]) -> list[Any]:
    seen: set[str] = set()
    result = []
    for clause in clauses:
        key = _clause_key(clause)
        if key not in seen:
            seen.add(key)
            result.append(clause)
    return result


def _column_names(column: Any) -> set[str]:
    """Names a filter column can be matched by: the name itself, or an adhoc
    column's label and SQL expression."""
    if isinstance(column, str):
        return {column}
    if isinstance(column, dict):
        return {
            value
            for value in (column.get("label"), column.get("sqlExpression"))
            if isinstance(value, str)
        }
    return set()


def _clauses(extra_form_data: Mapping[str, Any]) -> list[tuple[Any, Any]]:
    """(column, operator) for every filter and adhoc filter clause."""
    clauses = [
        (clause.get("col"), clause.get("op"))
        for clause in extra_form_data.get("filters") or []
        if isinstance(clause, dict)
    ]
    clauses += [
        (clause.get("subject"), clause.get("operator"))
        for clause in extra_form_data.get("adhoc_filters") or []
        if isinstance(clause, dict)
    ]
    return clauses


def _clause_columns(extra_form_data: Mapping[str, Any]) -> set[str]:
    return {
        name
        for column, _ in _clauses(extra_form_data)
        for name in _column_names(column)
    }


def _constrains_time(extra_form_data: Mapping[str, Any]) -> bool:
    """True when the scope limits the time window: a time range, or a
    TEMPORAL_RANGE clause such as a cross-filter on a time-series axis."""
    return _time_range(extra_form_data) is not None or any(
        op == TEMPORAL_RANGE for _, op in _clauses(extra_form_data)
    )


def _check_model_temporal_filters(
    scope_efd: Mapping[str, Any], model_efd: Mapping[str, Any]
) -> None:
    """Refuse model TEMPORAL_RANGE clauses that Superset could apply in place
    of the scope's filters.

    Query construction keeps one time window per granularity column and drops
    other filters on that column, so a model temporal clause may replace the
    dashboard's window or remove a dashboard filter on the same column.
    """
    # Clauses the scope already carries (e.g. a client re-sending the chart's
    # filters) add nothing and are ignored.
    scope_keys = {
        _clause_key(clause)
        for key in ("filters", "adhoc_filters")
        for clause in scope_efd.get(key) or []
    }
    added = {
        key: [
            clause
            for clause in model_efd.get(key) or []
            if _clause_key(clause) not in scope_keys
        ]
        for key in ("filters", "adhoc_filters")
    }
    temporal = [column for column, op in _clauses(added) if op == TEMPORAL_RANGE]
    if not temporal or not _restricts_rows(scope_efd):
        return
    if _constrains_time(scope_efd):
        raise MCPDashboardScopeError(
            "a TEMPORAL_RANGE filter cannot be added while the dashboard limits "
            "the time range for this chart.",
            _ASK_USER,
        )
    scope_columns = _clause_columns(scope_efd)
    for column in temporal:
        if not isinstance(column, str) or column in scope_columns:
            raise MCPDashboardScopeError(
                f"a TEMPORAL_RANGE filter on {column!r} would replace the "
                "dashboard's filter on that column.",
                _ASK_USER,
            )


def compose_extra_form_data(
    scope_efd: Mapping[str, Any] | None,
    model_efd: Mapping[str, Any] | None,
) -> dict[str, Any]:
    """AND-compose a chart's dashboard filters with model-supplied ones.

    The scope is a floor the model cannot lower: filter lists are
    concatenated, and a row-constraining override the scope sets cannot be
    changed. An empty or absent model payload yields the scope unchanged.
    """
    scope_efd = dict(scope_efd or {})
    if model_efd is None:
        return scope_efd
    if not isinstance(model_efd, Mapping):
        raise MCPDashboardScopeError(
            "extra_form_data must be an object while dashboard filters apply."
        )

    _check_model_temporal_filters(scope_efd, model_efd)

    composed = dict(scope_efd)
    for key, value in model_efd.items():
        _merge_model_value(composed, scope_efd, key, value)
    return composed


def _merge_model_value(
    composed: dict[str, Any], scope_efd: Mapping[str, Any], key: str, value: Any
) -> None:
    """Merge one model-supplied extra_form_data key into ``composed``."""
    if key in ("filters", "adhoc_filters"):
        if not isinstance(value, list):
            raise MCPDashboardScopeError(f"extra_form_data.{key} must be a list.")
        composed[key] = _dedupe([*(scope_efd.get(key) or []), *value])
    elif key in ROW_OVERRIDE_KEYS:
        _check_row_override(scope_efd, key, value)
        composed[key] = value
    elif key in PRESENTATION_KEYS:
        current = composed.get(key)
        if isinstance(current, list) and isinstance(value, list):
            composed[key] = [*current, *value]
        elif isinstance(current, dict) and isinstance(value, dict):
            composed[key] = {**current, **value}
        else:
            composed[key] = value
    elif key in scope_efd and value != scope_efd[key]:
        raise MCPDashboardScopeError(
            f"extra_form_data.{key} is set by the dashboard and cannot be changed.",
            _ASK_USER,
        )
    else:
        composed[key] = value


def _check_row_override(scope_efd: Mapping[str, Any], key: str, value: Any) -> None:
    """Refuse a model override that would change which rows the scope keeps."""
    if key in scope_efd:
        if value != scope_efd[key]:
            raise MCPDashboardScopeError(
                f"the dashboard sets {key}={scope_efd[key]!r} for this chart and "
                f"it cannot be changed to {value!r}.",
                _ASK_USER,
            )
    elif key in TIME_TARGET_KEYS and _restricts_rows(scope_efd):
        raise MCPDashboardScopeError(
            f"{key} cannot be set while dashboard filters apply, because it "
            "changes which column the dashboard's filters and time range "
            "constrain.",
            _ASK_USER,
        )
    elif key not in TIME_TARGET_KEYS and _constrains_time(scope_efd):
        # time_range or a relative anchor would move a window the dashboard
        # set through a temporal cross-filter rather than a time range.
        raise MCPDashboardScopeError(
            f"{key} cannot be set while the dashboard limits the time range for "
            "this chart.",
            _ASK_USER,
        )


# ---------------------------------------------------------------------------
# Dashboard-wide constraints (dataset and SQL paths)
# ---------------------------------------------------------------------------


def _normalize_filter_clause(clause: Any, chart_id: int) -> dict[str, Any]:
    if not isinstance(clause, dict) or not isinstance(clause.get("col"), str):
        raise MCPDashboardScopeError(
            f"a dashboard filter on chart {chart_id} targets an expression "
            "rather than a column, which can only be applied through that chart.",
            _USE_CHART_TOOLS,
        )
    return {"col": clause["col"], "op": clause.get("op"), "val": clause.get("val")}


def _normalize_adhoc_clause(clause: Any, chart_id: int) -> dict[str, Any]:
    if (
        not isinstance(clause, dict)
        or clause.get("expressionType") != "SIMPLE"
        or str(clause.get("clause") or "WHERE").upper() != "WHERE"
        or not isinstance(clause.get("subject"), str)
    ):
        raise MCPDashboardScopeError(
            f"a dashboard filter on chart {chart_id} is a custom SQL or HAVING "
            "filter, which can only be applied through that chart.",
            _USE_CHART_TOOLS,
        )
    return {
        "col": clause["subject"],
        "op": clause.get("operator"),
        "val": clause.get("comparator"),
    }


def _validate_clause(clause: dict[str, Any]) -> None:
    if (op := clause["op"]) not in SUPPORTED_OPERATORS:
        raise MCPDashboardScopeError(
            f"the dashboard filter operator {op!r} on column {clause['col']!r} "
            "can only be applied through the dashboard's charts.",
            _USE_CHART_TOOLS,
        )
    values = clause["val"] if isinstance(clause["val"], list) else [clause["val"]]
    for value in values:
        if value is not None and not isinstance(value, (str, int, float, bool)):
            raise MCPDashboardScopeError(
                f"the dashboard filter on column {clause['col']!r} has a value "
                "that can only be applied through the dashboard's charts.",
                _USE_CHART_TOOLS,
            )


def _dataset_chart_filters(
    scope: DashboardScope, dataset_ids: set[int], charts: list[Slice]
) -> Mapping[int, Mapping[str, Any]]:
    """Select filters for charts on these datasets, or all charts if none match."""
    chart_ids = {
        chart.id
        for chart in charts
        if chart.datasource_type == "table" and chart.datasource_id in dataset_ids
    }
    if not chart_ids:
        return scope.chart_filters
    return {
        chart_id: efd
        for chart_id, efd in scope.chart_filters.items()
        if chart_id in chart_ids
    }


def _validate_saved_chart_filters(
    form_data: Mapping[str, Any], *, chart_id: int, append_filters: bool
) -> None:
    """Refuse malformed saved filter lists used by the dashboard override merge."""
    # The merge reads adhoc_filters and appends dashboard filters to every
    # saved adhoc_filter* list. Validate those lists before it touches them.
    for key, saved_filters in form_data.items():
        if key == "adhoc_filters" or (
            append_filters and key.startswith("adhoc_filter")
        ):
            if not isinstance(saved_filters, list) or any(
                not isinstance(clause, dict) for clause in saved_filters
            ):
                raise MCPDashboardScopeError(
                    f"chart {chart_id} has malformed saved filters in {key!r} "
                    "that cannot be mapped to a time-filter column.",
                    _USE_CHART_TOOLS,
                )


def _chart_time_column(chart: Slice | None, efd: Mapping[str, Any]) -> str:
    """Resolve the temporal target after the chart's dashboard overrides."""
    from superset.utils.core import merge_extra_form_data

    if chart is None:
        raise MCPDashboardScopeError(
            "the queried dataset has no chart in the dashboard scope "
            "from which to resolve the time-filter column.",
            _USE_CHART_TOOLS,
        )
    form_data = deepcopy(chart.form_data)
    _validate_saved_chart_filters(
        form_data, chart_id=chart.id, append_filters=bool(efd.get("filters"))
    )
    form_data["extra_form_data"] = deepcopy(dict(efd))
    merge_extra_form_data(form_data)
    columns: set[str] = set()
    for clause in form_data.get("adhoc_filters") or []:
        if clause.get("operator") != TEMPORAL_RANGE:
            continue
        subject = clause.get("subject")
        if (
            clause.get("expressionType") != "SIMPLE"
            or clause.get("clause") != "WHERE"
            or not isinstance(subject, str)
            or not subject
        ):
            raise MCPDashboardScopeError(
                f"chart {chart.id} has a temporal filter that cannot be mapped "
                "to a dataset column.",
                _USE_CHART_TOOLS,
            )
        columns.add(subject)
    # Legacy charts carry their temporal target directly in form data. The
    # merge writes a granularity_sqla override to ``granularity``, which the
    # query object reads before the saved ``granularity_sqla``; that override
    # also supersedes a saved ``time_column`` unless the dashboard sets one.
    legacy_targets = [form_data.get("granularity") or form_data.get("granularity_sqla")]
    if efd.get("granularity_sqla") is None or efd.get("time_column") is not None:
        legacy_targets.append(form_data.get("time_column"))
    for column in legacy_targets:
        if not column:
            continue
        if not isinstance(column, str):
            raise MCPDashboardScopeError(
                f"chart {chart.id} has a non-column temporal target.",
                _USE_CHART_TOOLS,
            )
        columns.add(column)
    if len(columns) != 1:
        raise MCPDashboardScopeError(
            f"chart {chart.id} has no single time-filter column for the "
            "dashboard time range.",
            _USE_CHART_TOOLS,
        )
    return next(iter(columns))


def dashboard_constraints(
    scope: DashboardScope, *, dataset_ids: set[int] | None = None
) -> DashboardConstraints:
    """Collapse the per-chart filters into one dashboard-wide constraint set.

    Every chart that filters a column must filter it identically; otherwise
    the dashboard shows that column filtered differently in different places
    and there is no single dataset-level answer, so the call is refused.
    A chart with no clause for a column does not count against it: a
    cross-filter's emitting chart and a chart a native filter is scoped away
    from both lack the clause, and the clause is still applied. A dataset-level
    answer therefore narrows to the filtered charts' view and never widens.
    When datasets back dashboard charts, only those charts contribute filters;
    otherwise all charts contribute, including for datasets outside the dashboard.
    Time windows require an unambiguous temporal target on every affected chart
    backed by the queried datasets; the dataset's main datetime is not a fallback.
    """
    charts = _dashboard_slices(scope) if dataset_ids is not None else []
    chart_filters = (
        scope.chart_filters
        if dataset_ids is None
        else _dataset_chart_filters(scope, dataset_ids, charts)
    )
    dataset_charts = {
        chart.id: chart
        for chart in charts
        if chart.datasource_type == "table"
        and chart.datasource_id in (dataset_ids or set())
    }

    by_column: dict[str, tuple[str, ...]] = {}
    clauses: dict[str, dict[str, Any]] = {}
    windows: set[tuple[str, str | None]] = set()

    for chart_id, efd in sorted(chart_filters.items()):
        if efd.get("relative_start") or efd.get("relative_end"):
            raise MCPDashboardScopeError(
                f"chart {chart_id} uses a relative time anchor that can only be "
                "applied through that chart.",
                _USE_CHART_TOOLS,
            )
        chart_clauses = [
            *(_normalize_filter_clause(c, chart_id) for c in efd.get("filters") or []),
            *(
                _normalize_adhoc_clause(c, chart_id)
                for c in efd.get("adhoc_filters") or []
            ),
        ]
        per_column: dict[str, set[str]] = {}
        for clause in chart_clauses:
            _validate_clause(clause)
            key = _clause_key(clause)
            clauses[key] = clause
            per_column.setdefault(clause["col"], set()).add(key)
        for column, keys in per_column.items():
            signature = tuple(sorted(keys))
            if by_column.setdefault(column, signature) != signature:
                raise MCPDashboardScopeError(
                    f"the dashboard filters column {column!r} differently for "
                    "different charts, so there is no single dashboard-wide "
                    "filter to apply here.",
                    _USE_CHART_TOOLS,
                )

        if (time_range := _time_range(efd)) is not None:
            granularity = efd.get("granularity_sqla")
            time_column = efd.get("time_column")
            if granularity and time_column and granularity != time_column:
                raise MCPDashboardScopeError(
                    f"chart {chart_id} names two different time columns.",
                    _USE_CHART_TOOLS,
                )
            if dataset_ids is not None:
                time_column = _chart_time_column(dataset_charts.get(chart_id), efd)
            else:
                time_column = granularity or time_column
            windows.add((time_range, time_column))

    if len(windows) > 1:
        raise MCPDashboardScopeError(
            "the dashboard applies different time ranges (or time columns) to "
            "different charts, so there is no single dashboard-wide time range "
            "to apply here.",
            _USE_CHART_TOOLS,
        )
    time_range, time_column = next(iter(windows)) if windows else (None, None)
    ordered = tuple(clauses[key] for key in sorted(clauses))
    return DashboardConstraints(ordered, time_range, time_column)


def intersect_time_ranges(scope_range: str, model_range: str | None) -> str:
    """The window both ranges allow, as a time range string.

    The scope's own string is kept when the model adds nothing, so relative
    ranges keep their exact dataset semantics (grain alignment, timezone).
    """
    from superset.common.utils.time_range_utils import (
        get_since_until_from_time_range,
    )

    if not model_range or model_range in (scope_range, NO_TIME_RANGE):
        return scope_range
    try:
        scope_since, scope_until = get_since_until_from_time_range(
            time_range=scope_range
        )
        model_since, model_until = get_since_until_from_time_range(
            time_range=model_range
        )
    except ValueError as ex:
        raise MCPDashboardScopeError(
            f"the requested time_range could not be combined with the "
            f"dashboard time range {scope_range!r} ({ex}).",
            _ASK_USER,
        ) from ex

    since = _latest(scope_since, model_since)
    until = _earliest(scope_until, model_until)
    if since is not None and until is not None and since >= until:
        raise MCPDashboardScopeError(
            f"the requested time_range {model_range!r} does not overlap the "
            f"dashboard time range {scope_range!r}.",
            _ASK_USER,
        )
    return f"{_iso(since)} : {_iso(until)}"


def _latest(first: datetime | None, second: datetime | None) -> datetime | None:
    candidates = [value for value in (first, second) if value is not None]
    return max(candidates) if candidates else None


def _earliest(first: datetime | None, second: datetime | None) -> datetime | None:
    candidates = [value for value in (first, second) if value is not None]
    return min(candidates) if candidates else None


def _iso(value: datetime | None) -> str:
    return value.isoformat() if value is not None else ""


def removed_granularity_column(
    filters: Sequence[Mapping[str, Any]], granularity: str | None
) -> str | None:
    """The column Superset drops filters on when building this query.

    ``QueryContextFactory._apply_granularity`` removes every filter on the
    granularity column (or, failing that, the first temporal-range column)
    before re-adding a single time filter. A dashboard clause on that column
    would silently disappear, so callers refuse instead.
    """
    temporal = [f.get("col") for f in filters if f.get("op") == TEMPORAL_RANGE]
    if not granularity or not temporal:
        return None
    return granularity if granularity in temporal else temporal[0]


# ---------------------------------------------------------------------------
# Request helpers
# ---------------------------------------------------------------------------


def _field(request: Any, name: str) -> Any:
    if isinstance(request, Mapping):
        return request.get(name)
    return getattr(request, name, None)


def _with_fields(request: Any, **updates: Any) -> Any:
    if isinstance(request, Mapping):
        return {**request, **updates}
    return request.model_copy(update=updates)


# ---------------------------------------------------------------------------
# Chart tools
# ---------------------------------------------------------------------------


def _dashboard_slices(scope: DashboardScope) -> list[Slice]:
    """Resolve the accessible scoped dashboard's charts, or refuse."""
    from superset.commands.dashboard.exceptions import (
        DashboardAccessDeniedError,
        DashboardNotFoundError,
    )
    from superset.daos.dashboard import DashboardDAO

    try:
        dashboard = DashboardDAO.get_by_id_or_slug(str(scope.dashboard_id))
    except (DashboardNotFoundError, DashboardAccessDeniedError) as ex:
        raise MCPDashboardScopeError(
            f"the scoped dashboard {scope.dashboard_id} was not "
            "found or is not accessible, so its filters cannot be resolved.",
            _ASK_USER,
        ) from ex
    return list(dashboard.slices or [])


class _ChartResolver:
    """Resolve charts against the scoped dashboard, once per call."""

    def __init__(self, scope: DashboardScope) -> None:
        self.scope = scope
        self._dashboard_chart_ids: set[int] | None = None

    def dashboard_chart_ids(self) -> set[int]:
        if self._dashboard_chart_ids is None:
            self._dashboard_chart_ids = {
                slc.id for slc in _dashboard_slices(self.scope)
            }
        return self._dashboard_chart_ids

    def chart_scope(self, chart_id: int) -> Mapping[str, Any] | None:
        """The chart's dashboard filters, {} when on the dashboard unfiltered,
        None when the chart is not on the scoped dashboard."""
        if chart_id in self.scope.chart_filters:
            return self.scope.chart_filters[chart_id]
        if chart_id in self.dashboard_chart_ids():
            return {}
        return None


def _resolve_chart_id(identifier: Any) -> int | None:
    from superset.mcp_service.chart.chart_helpers import find_chart_by_identifier

    chart = find_chart_by_identifier(identifier)
    return chart.id if chart is not None else None


def _compose_chart_request(
    request: Any, scope: DashboardScope, *, returns_rows: bool
) -> Any:
    identifier = _field(request, "identifier")
    if returns_rows and _field(request, "form_data_key"):
        # Unsaved Explore state can query any dataset with any filters; the
        # chart it was opened from says nothing about what it reads.
        raise MCPDashboardScopeError(
            "unsaved chart state (form_data_key) is not part of the dashboard, "
            "so the dashboard's filters cannot be mapped to it.",
            _USE_CHART_TOOLS,
        )
    if identifier is None:
        if returns_rows:
            raise MCPDashboardScopeError(
                "the request names no chart on the dashboard, so the "
                "dashboard's filters cannot be mapped to it.",
                _USE_CHART_TOOLS,
            )
        return request
    chart_id = _resolve_chart_id(identifier)
    if chart_id is None:
        if returns_rows:
            # Some tools fall back to reading an unresolvable identifier as a
            # form_data_key, so "not found" must not mean "pass through".
            raise MCPDashboardScopeError(
                f"{identifier!r} is not an accessible chart on the scoped dashboard.",
                _USE_CHART_TOOLS,
            )
        return request
    chart_scope = _ChartResolver(scope).chart_scope(chart_id)
    if chart_scope is None:
        if returns_rows:
            raise MCPDashboardScopeError(
                f"chart {chart_id} is not on the scoped dashboard, so the "
                "dashboard's per-chart filters cannot be mapped to it.",
                "Use query_dataset on its dataset, which applies the dashboard's "
                "filters, or a chart that is on the dashboard.",
            )
        return request
    composed = compose_extra_form_data(chart_scope, _field(request, "extra_form_data"))
    return _with_fields(request, extra_form_data=composed or None)


def _rewrite_chart_data(request: Any, scope: DashboardScope) -> Any:
    return _compose_chart_request(request, scope, returns_rows=True)


def _rewrite_chart_descriptive(request: Any, scope: DashboardScope) -> Any:
    return _compose_chart_request(request, scope, returns_rows=False)


def _rewrite_chart_preview(request: Any, scope: DashboardScope) -> Any:
    returns_rows = _field(request, "format") in DATA_PREVIEW_FORMATS
    return _compose_chart_request(request, scope, returns_rows=returns_rows)


def _rewrite_dashboard_data(request: Any, scope: DashboardScope) -> Any:
    from superset.commands.dashboard.exceptions import (
        DashboardAccessDeniedError,
        DashboardNotFoundError,
    )
    from superset.daos.dashboard import DashboardDAO

    try:
        dashboard = DashboardDAO.get_by_id_or_slug(str(_field(request, "identifier")))
    except (DashboardNotFoundError, DashboardAccessDeniedError):
        return request
    if dashboard.id != scope.dashboard_id:
        raise MCPDashboardScopeError(
            f"dashboard {dashboard.id} is not the scoped dashboard "
            f"{scope.dashboard_id}, so the active filters cannot be mapped to "
            "its charts.",
            _ASK_USER,
        )
    model_filters = _field(request, "applied_filters") or {}
    if not isinstance(model_filters, Mapping):
        raise MCPDashboardScopeError("applied_filters must be an object.")
    composed: dict[str, Any] = {}
    for slc in dashboard.slices or []:
        chart_efd = compose_extra_form_data(
            scope.chart_filters.get(slc.id), model_filters.get(str(slc.id))
        )
        if chart_efd:
            composed[str(slc.id)] = chart_efd
    return _with_fields(request, applied_filters=composed or None)


# ---------------------------------------------------------------------------
# Dataset tools
# ---------------------------------------------------------------------------


def scoped_dataset_query(
    constraints: DashboardConstraints,
    *,
    subject: str,
    columns: set[str],
    temporal_columns: set[str],
    main_dttm_col: str | None,
    filters: list[dict[str, Any]],
    time_range: str | None,
    time_column: str | None,
) -> tuple[list[dict[str, Any]], str | None, str | None]:
    """AND the dashboard constraints into a name-based dataset query.

    Returns the filters, time range and time column the query must use. The
    query tools append the time range as a trailing TEMPORAL_RANGE filter on
    the time column, which becomes the query granularity.
    """
    if missing := sorted(constraints.columns - columns):
        raise MCPDashboardScopeError(
            f"{subject} has no column {', '.join(repr(c) for c in missing)} "
            "that the dashboard filters, so the filter cannot be applied.",
            "Query a dataset that has the filtered columns or use the dashboard's "
            "charts; the request must stay within the active dashboard filters.",
        )

    scope_filters = [dict(clause) for clause in constraints.clauses]
    if constraints.time_range is not None:
        scope_column = constraints.time_column
        if not scope_column or scope_column not in temporal_columns:
            raise MCPDashboardScopeError(
                f"{subject} has no datetime column "
                f"{scope_column!r} to apply the dashboard time range to."
                if scope_column
                else f"{subject} has no resolved time-filter column to apply the "
                "dashboard time range to.",
                "Query a dataset with a datetime column or use the dashboard's "
                "charts; the request must stay within the active dashboard "
                "time filter.",
            )
        if time_column and time_column != scope_column:
            raise MCPDashboardScopeError(
                f"the dashboard time range applies to {scope_column!r}, and a "
                f"time range on {time_column!r} cannot be combined with it here.",
                f"Omit time_column or set it to {scope_column!r}.",
            )
        if any(f.get("op") == TEMPORAL_RANGE for f in filters):
            raise MCPDashboardScopeError(
                "TEMPORAL_RANGE filters cannot be combined with the dashboard "
                "time range.",
                "Pass the window as time_range instead; it is intersected with "
                "the dashboard time range.",
            )
        time_range = intersect_time_ranges(constraints.time_range, time_range)
        time_column = scope_column

    granularity = (time_column or main_dttm_col) if time_range else time_column
    final = [*filters, *scope_filters]
    if time_range and granularity:
        final_with_time = [
            *final,
            {"col": granularity, "op": TEMPORAL_RANGE, "val": time_range},
        ]
    else:
        final_with_time = final
    removed = removed_granularity_column(final_with_time, granularity)
    if removed is not None and removed in constraints.columns:
        raise MCPDashboardScopeError(
            f"the dashboard filter on {removed!r} would be dropped because that "
            "column is also the query's time column.",
            "Query without a time range on that column, or use the dashboard's charts.",
        )
    return final, time_range, time_column


def _rewrite_query_dataset(request: Any, scope: DashboardScope) -> Any:
    from sqlalchemy.orm import subqueryload

    from superset.connectors.sqla.models import SqlaTable
    from superset.mcp_service.dataset.dataset_utils import resolve_dataset

    dataset = resolve_dataset(
        _field(request, "dataset_id"), [subqueryload(SqlaTable.columns)]
    )
    if dataset is None:
        return request
    constraints = dashboard_constraints(scope, dataset_ids={dataset.id})
    if constraints.is_empty:
        return request
    return _rewrite_dataset_request(request, constraints, dataset, _query_filter)


def _rewrite_get_table(request: Any, scope: DashboardScope) -> Any:
    from sqlalchemy.orm import subqueryload

    from superset.connectors.sqla.models import SqlaTable
    from superset.daos.dataset import DatasetDAO

    dataset_id = _field(request, "dataset_id")
    if dataset_id is None:
        if _field(request, "view_id") is None:
            return request
        raise MCPDashboardScopeError(
            "dashboard filters cannot yet be applied to semantic views.",
            "Use query_dataset on a dataset, or the dashboard's charts.",
        )
    dataset = DatasetDAO.find_by_id(
        dataset_id, query_options=[subqueryload(SqlaTable.columns)]
    )
    if dataset is None:
        return request
    constraints = dashboard_constraints(scope, dataset_ids={dataset.id})
    if constraints.is_empty:
        return request
    return _rewrite_dataset_request(request, constraints, dataset, _table_filter)


def _query_filter(clause: dict[str, Any]) -> Any:
    from superset.mcp_service.dataset.schemas import QueryDatasetFilter

    return QueryDatasetFilter.model_validate(clause)


def _table_filter(clause: dict[str, Any]) -> Any:
    from superset.mcp_service.semantic_layer.schemas import GetTableFilter

    return GetTableFilter.model_validate(clause)


def _rewrite_dataset_request(
    request: Any,
    constraints: DashboardConstraints,
    dataset: Any,
    make_filter: Callable[[dict[str, Any]], Any],
) -> Any:
    request_filters = list(_field(request, "filters") or [])
    filters, time_range, time_column = scoped_dataset_query(
        constraints,
        subject=f"dataset {getattr(dataset, 'table_name', dataset.id)!r}",
        columns={column.column_name for column in dataset.columns},
        temporal_columns={c.column_name for c in dataset.columns if c.is_dttm},
        main_dttm_col=getattr(dataset, "main_dttm_col", None),
        filters=[_as_clause(f) for f in request_filters],
        time_range=_field(request, "time_range"),
        time_column=_field(request, "time_column"),
    )
    scope_filters = [make_filter(clause) for clause in filters[len(request_filters) :]]
    return _with_fields(
        request,
        filters=[*request_filters, *scope_filters],
        time_range=time_range,
        time_column=time_column,
    )


def _as_clause(query_filter: Any) -> dict[str, Any]:
    return {
        "col": _field(query_filter, "col"),
        "op": _field(query_filter, "op"),
        "val": _field(query_filter, "val"),
    }


# ---------------------------------------------------------------------------
# SQL
# ---------------------------------------------------------------------------


def _rewrite_execute_sql(request: Any, scope: DashboardScope) -> Any:
    from superset.mcp_service.dashboard_scope_sql import scope_execute_sql_request

    return scope_execute_sql_request(request, scope)


# ---------------------------------------------------------------------------
# Authoring tools that can return data previews
# ---------------------------------------------------------------------------


def _refuse_data_preview(tool_name: str) -> MCPDashboardScopeError:
    return MCPDashboardScopeError(
        f"{tool_name} was asked for a data preview of a chart that is not part "
        "of the dashboard, so the dashboard filters cannot be applied to it.",
        "Request preview_formats=['url'] instead, or use query_dataset for the "
        "numbers, which applies the dashboard filters.",
    )


def _wants_data_preview(request: Any) -> bool:
    return bool(set(_field(request, "preview_formats") or []) & DATA_PREVIEW_FORMATS)


def _gate_generate_chart(request: Any, scope: DashboardScope) -> Any:
    if _field(request, "generate_preview") and _wants_data_preview(request):
        raise _refuse_data_preview("generate_chart")
    return request


def _gate_update_chart(request: Any, scope: DashboardScope) -> Any:
    # generate_preview=True only returns an Explore link; False saves the edit.
    if not _field(request, "generate_preview"):
        raise _refuse_definition_change("update_chart")
    return request


def _gate_update_chart_preview(request: Any, scope: DashboardScope) -> Any:
    if _field(request, "generate_preview") and _wants_data_preview(request):
        raise _refuse_data_preview("update_chart_preview")
    return request


Rewriter = Callable[[Any, DashboardScope], Any]


def _refuse_definition_change(tool_name: str) -> MCPDashboardScopeError:
    return MCPDashboardScopeError(
        f"{tool_name} changes what charts or datasets query, which could put "
        "data on the dashboard that its captured filters do not cover.",
        "Definition changes are restricted while the conversation is scoped "
        "to the active dashboard filters.",
    )


def _refuse_while_scoped(tool_name: str) -> Rewriter:
    def refuse(request: Any, scope: DashboardScope) -> Any:
        raise _refuse_definition_change(tool_name)

    return refuse


# Writes that change what existing or new charts and datasets query. A chart
# added to the scoped dashboard, a re-pointed chart, or a dataset defined by
# the model (e.g. ``SELECT 'A' AS client, ...``) would otherwise be read under
# filters captured before the change, or satisfy them vacuously.
DEFINITION_CHANGING_TOOLS = (
    "add_chart_to_existing_dashboard",
    "update_dashboard",
    "create_virtual_dataset",
    "update_dataset",
    "create_dataset_metric",
    "update_dataset_metric",
    "restore_chart",
    "restore_dataset",
)


# ---------------------------------------------------------------------------
# Tool classification and dispatch
# ---------------------------------------------------------------------------

SCOPE_REWRITERS: dict[str, Rewriter] = {
    "get_chart_data": _rewrite_chart_data,
    "get_chart_preview": _rewrite_chart_preview,
    "get_chart_info": _rewrite_chart_descriptive,
    "get_chart_sql": _rewrite_chart_descriptive,
    "get_dashboard_data": _rewrite_dashboard_data,
    "query_dataset": _rewrite_query_dataset,
    "get_table": _rewrite_get_table,
    "execute_sql": _rewrite_execute_sql,
    "generate_chart": _gate_generate_chart,
    "update_chart": _gate_update_chart,
    "update_chart_preview": _gate_update_chart_preview,
    **{name: _refuse_while_scoped(name) for name in DEFINITION_CHANGING_TOOLS},
}

# Tools that return no dataset rows: metadata, links, and writes. Keep this an
# explicit list — a tool missing from both maps is refused while a scope is
# active, which is the safe failure for anything that might read data.
SCOPE_NEUTRAL_TOOLS = frozenset(
    {
        "apply_dashboard_filters",
        "create_dataset",
        "create_theme",
        "delete_chart",
        "delete_dashboard",
        "delete_dataset",
        "delete_dataset_metric",
        "duplicate_dashboard",
        "find_users",
        "generate_bug_report",
        "generate_dashboard",
        "generate_explore_link",
        "get_annotation_layer_info",
        "get_catalog",
        "get_chart_type_schema",
        "get_compatible_dimensions",
        "get_compatible_metrics",
        "get_dashboard_datasets",
        "get_dashboard_info",
        "get_dashboard_layout",
        "get_database_info",
        "get_dataset_info",
        "get_instance_info",
        "get_layer_annotation_info",
        "get_query_info",
        "get_report_info",
        "get_rls_filter_info",
        "get_role_info",
        "get_saved_query_info",
        "get_schema",
        "get_tag_info",
        "get_task_info",
        "get_theme_info",
        "get_user_info",
        "health_check",
        "list_annotation_layers",
        "list_charts",
        "list_dashboards",
        "list_databases",
        "list_datasets",
        "list_layer_annotations",
        "list_metrics",
        "list_queries",
        "list_reports",
        "list_rls_filters",
        "list_roles",
        "list_saved_queries",
        "list_tags",
        "list_tasks",
        "list_themes",
        "list_users",
        "manage_dashboard_certification",
        "manage_dashboard_markdown",
        "manage_dashboard_owners",
        "manage_dashboard_roles",
        "manage_native_filters",
        "open_sql_lab_with_context",
        "remove_chart_from_dashboard",
        "restore_dashboard",
        "save_sql_query",
    }
)


def apply_call_dashboard_scope(
    tool_name: str,
    signature: inspect.Signature,
    args: tuple[Any, ...],
    kwargs: dict[str, Any],
) -> tuple[tuple[Any, ...], dict[str, Any]]:
    """Apply the request's dashboard scope to one tool call.

    Returns the (possibly rewritten) call arguments, or raises
    ``MCPDashboardScopeError``. Calls without a scope header are returned
    untouched, so the feature costs nothing when unused.
    """
    scope = get_request_dashboard_scope()
    if scope is None or not scope.has_constraints:
        return args, kwargs

    rewriter = SCOPE_REWRITERS.get(tool_name)
    if rewriter is None:
        if tool_name in SCOPE_NEUTRAL_TOOLS:
            return args, kwargs
        raise MCPDashboardScopeError(
            f"{tool_name} does not support dashboard filters, and its results "
            "could include rows those filters exclude.",
            "Use query_dataset, execute_sql, or the dashboard's chart tools, "
            "which apply the dashboard filters.",
        )

    try:
        bound = signature.bind_partial(*args, **kwargs)
    except TypeError as ex:
        raise MCPDashboardScopeError(
            f"the arguments to {tool_name} could not be read to apply the "
            "dashboard filters."
        ) from ex
    request = bound.arguments.get("request")
    if request is None:
        raise MCPDashboardScopeError(
            f"{tool_name} was called without a request to apply the dashboard "
            "filters to."
        )

    rewritten = rewriter(request, scope)
    if rewritten is request:
        return args, kwargs
    logger.debug(
        "Applied dashboard %s filter scope to %s", scope.dashboard_id, tool_name
    )
    # Replace the request where the caller passed it. Re-deriving the call
    # from ``bound.args`` would move keyword arguments such as ``ctx`` into
    # positional slots, and the auth wrapper would then pass ``ctx`` twice.
    if "request" in kwargs:
        return args, {**kwargs, "request": rewritten}
    position = list(signature.parameters).index("request")
    return (*args[:position], rewritten, *args[position + 1 :]), kwargs
