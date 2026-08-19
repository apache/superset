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
Derive a ``query_context`` payload from a chart's stored ``params``.

Charts imported via a v1 ZIP bundle persist with ``Slice.query_context = NULL``
(the importer never synthesizes one), so the first
``GET /api/v1/chart/{pk}/data/`` returns HTTP 400 "Chart has no query context
saved" (Apache Superset #33615). This module builds a valid ``query_context``
payload from the chart's viz ``params`` + its importer-resolved datasource, so
the imported row becomes queryable on first read — or classifies the chart
non-derivable and returns ``None`` (honest-fail; never a fabricated context).

The function is **pure** (no DB / network / analytical-DB access). Its output,
when passed to ``QueryContextFactory.create(**payload)``, constructs a valid
``QueryContext``. See ADR-013 (synthesize-at-import) and ADR-014
(datasource authz/RLS preservation).
"""

from __future__ import annotations

from typing import Any

# Datasource-less viz types render static/markdown content rather than a
# datasource-backed query; a NULL query_context is the *correct* state for them
# (FR-003), not a bug. Kept as a small, explicit, conservatively-expanded set.
_NON_DATASOURCE_VIZ: frozenset[str] = frozenset({"markup", "handlebars", "divider"})

# Default row limit mirrors the query-object default used across the read path.
_DEFAULT_ROW_LIMIT = 5000


def _translate_adhoc_filters(
    adhoc_filters: list[Any] | None,
) -> tuple[list[dict[str, Any]], list[str], list[str]]:
    """
    Translate viz ``adhoc_filters`` into simple ``{col, op, val}`` filters.

    - ``expressionType == "SIMPLE"`` → a ``{col, op, val}`` filter.
    - ``expressionType == "SQL"``    → routed to ``extras.where`` (or
      ``extras.having`` for a HAVING clause) so a hand-written SQL predicate is
      preserved rather than lost.
    - Anything that cannot be mapped cleanly (missing subject/operator, malformed
      entry) is dropped **without raising** (RISK-T05) — an imported chart must
      never abort its bundle over a single unmappable filter.

    Returns ``(filters, where_expressions, having_expressions)``.
    """
    filters: list[dict[str, Any]] = []
    where_expressions: list[str] = []
    having_expressions: list[str] = []
    for adhoc_filter in adhoc_filters or []:
        if not isinstance(adhoc_filter, dict):
            continue
        expression_type = adhoc_filter.get("expressionType") or "SIMPLE"
        if expression_type == "SIMPLE":
            subject = adhoc_filter.get("subject")
            operator = adhoc_filter.get("operator")
            if subject and operator:
                filters.append(
                    {
                        "col": subject,
                        "op": operator,
                        "val": adhoc_filter.get("comparator"),
                    }
                )
            # else: unmappable SIMPLE filter — dropped, no crash (RISK-T05).
        elif expression_type == "SQL":
            sql_expression = adhoc_filter.get("sqlExpression")
            if sql_expression:
                clause = (adhoc_filter.get("clause") or "WHERE").upper()
                if clause == "HAVING":
                    having_expressions.append(sql_expression)
                else:
                    where_expressions.append(sql_expression)
    return filters, where_expressions, having_expressions


def _derive_orderby(params: dict[str, Any]) -> list[list[Any]]:
    """
    Best-effort ordering from ``params`` (FR-002).

    Handles an explicit ``orderby`` list (either ``[[col, asc_bool], ...]`` or a
    flat list of expressions) and a single sort metric
    (``timeseries_limit_metric`` / ``sort_by_metric``). Falls back to no
    ordering when nothing is derivable — the query builder supplies defaults.
    """
    order_asc = not params.get("order_desc", True)

    orderby = params.get("orderby")
    if isinstance(orderby, list) and orderby:
        normalized: list[list[Any]] = []
        for entry in orderby:
            if isinstance(entry, (list, tuple)) and len(entry) == 2:
                normalized.append([entry[0], bool(entry[1])])
            else:
                normalized.append([entry, order_asc])
        return normalized

    sort_metric = params.get("timeseries_limit_metric") or params.get("sort_by_metric")
    if sort_metric:
        return [[sort_metric, order_asc]]
    return []


def build_query_context_config(
    params: dict[str, Any] | None,
    viz_type: str,
    datasource_id: int | None,
    datasource_type: str = "table",
) -> dict[str, Any] | None:
    """
    Map a chart's ``params`` + resolved datasource to a ``query_context`` payload.

    :param params: the chart's viz form-data (a dict at ``import_chart`` time).
    :param viz_type: the chart's viz type (classification input).
    :param datasource_id: the importer-resolved datasource id. **Datasource is
        taken from this argument only, never from ``params`` (ADR-014 / RISK-T02)**
        so the synthesized context names the same real datasource the authz layer
        vets at read time.
    :param datasource_type: the datasource type — ``"table"`` on import.
    :returns: a ``query_context`` payload dict whose keys are the kwargs of
        ``QueryContextFactory.create``, or ``None`` when the chart is
        non-derivable (FR-003): no datasource, nothing to query, or a
        datasource-less viz type. Never returns a fabricated/invalid context.
    """
    params = params or {}

    # FR-003 non-derivable classification — return None, importer leaves NULL.
    if not datasource_id or viz_type in _NON_DATASOURCE_VIZ:
        return None
    metrics = params.get("metrics") or []
    # `groupby` is the deprecated alias of `columns`.
    columns = params.get("columns") or params.get("groupby") or []
    if not metrics and not columns:
        return None

    filters, where_expressions, having_expressions = _translate_adhoc_filters(
        params.get("adhoc_filters", [])
    )

    query_object = {
        "time_range": params.get("time_range", " : "),
        "granularity": params.get("granularity_sqla") or params.get("granularity"),
        "filters": filters,
        "extras": {
            "time_grain_sqla": params.get("time_grain_sqla"),
            "having": " AND ".join(having_expressions),
            "where": " AND ".join(where_expressions),
        },
        "applied_time_extras": {},
        "columns": columns,
        "metrics": metrics,
        "orderby": _derive_orderby(params),
        "annotation_layers": [],
        "row_limit": params.get("row_limit", _DEFAULT_ROW_LIMIT),
        "timeseries_limit": 0,
        "order_desc": params.get("order_desc", True),
        "url_params": {},
        "custom_params": {},
        "custom_form_data": {},
    }

    return {
        "datasource": {"id": datasource_id, "type": datasource_type},
        "force": False,
        "queries": [query_object],
        "result_format": "json",
        "result_type": "full",
    }
