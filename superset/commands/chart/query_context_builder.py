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

from superset.utils.core import split_adhoc_filters_into_base_filters

# Datasource-less viz types render static/markdown content rather than a
# datasource-backed query; a NULL query_context is the *correct* state for them
# (FR-003), not a bug. Kept as a small, explicit, conservatively-expanded set.
# NOTE: `handlebars` is deliberately NOT here — it renders a template over query
# results and ships a real buildQuery (its generated registry entry and golden
# fixture build a datasource-backed query), so it must stay on the derivable path.
# Classifying it datasource-less left imported handlebars charts with a NULL
# context that 400s on the data endpoint whenever the V8 bundle is unavailable.
_NON_DATASOURCE_VIZ: frozenset[str] = frozenset({"markup", "divider"})


def _is_mappable_adhoc_filter(adhoc_filter: dict[str, Any]) -> bool:
    """
    Whether ``split_adhoc_filters_into_base_filters`` will actually carry this
    adhoc filter into the synthesized context.

    The shared splitter preserves only SIMPLE ``WHERE`` clauses (a subject +
    operator) and SQL ``WHERE`` / ``HAVING`` clauses (a non-empty expression).
    Anything else — a SIMPLE ``HAVING``, an unknown ``expressionType``, or a
    SIMPLE filter missing its subject/operator — is silently discarded, which
    would broaden the imported chart's result set. Such filters are treated as
    unmappable so the caller can fail closed instead of querying more rows than
    the chart defines.
    """
    expression_type = adhoc_filter.get("expressionType")
    clause = adhoc_filter.get("clause")
    if expression_type == "SIMPLE":
        return (
            clause == "WHERE"
            and bool(adhoc_filter.get("subject"))
            and bool(adhoc_filter.get("operator"))
        )
    if expression_type == "SQL":
        return clause in ("WHERE", "HAVING") and bool(adhoc_filter.get("sqlExpression"))
    return False


def _translate_adhoc_filters(
    adhoc_filters: list[Any] | None,
) -> tuple[list[dict[str, Any]], str, str] | None:
    """
    Translate viz ``adhoc_filters`` into base filters via the shared splitter.

    Delegates to ``split_adhoc_filters_into_base_filters`` — the same helper the
    read path uses — so SQL predicates are composed identically rather than by a
    bare ``" AND ".join``: each clause is wrapped in parentheses (preserving
    ``OR`` precedence) and a trailing ``--`` line comment is prevented from
    swallowing predicates joined after it.

    Fails closed (#33615 review): if any adhoc filter would be silently dropped
    by the splitter, the synthesized context would query a broader row set than
    the chart defines. Returning ``None`` here makes the caller classify the
    chart non-derivable and leave the ``query_context`` NULL — an honest 400
    until backfilled is safer than a wrong, broadened result. Non-dict junk is
    still tolerated (dropped, never raised) so a stray serialization artifact
    does not by itself void an otherwise sound chart (RISK-T05).

    Returns ``(filters, where, having)`` where ``where``/``having`` are the
    parenthesized, comment-safe SQL strings ready for ``extras``, or ``None``
    when a real filter could not be preserved.
    """
    # Drop non-dict junk up front (RISK-T05): the shared splitter calls
    # ``.get`` on each entry and would raise on a stray non-dict item.
    sanitized = [f for f in (adhoc_filters or []) if isinstance(f, dict)]
    if any(not _is_mappable_adhoc_filter(f) for f in sanitized):
        return None
    form_data: dict[str, Any] = {"adhoc_filters": sanitized}
    split_adhoc_filters_into_base_filters(form_data)
    return (
        form_data.get("filters") or [],
        form_data.get("where") or "",
        form_data.get("having") or "",
    )


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
    # Single-metric viz types (e.g. Big Number) persist the metric under the
    # singular `metric` key; normalize it into `metrics` so those charts are not
    # misclassified as non-derivable (#33615: Big Number left with a NULL context).
    if not metrics and params.get("metric"):
        metrics = [params["metric"]]
    # `groupby` is the deprecated alias of `columns`.
    columns = params.get("columns") or params.get("groupby") or []
    # Raw (non-aggregated) tables carry no metrics/groupby and select row-level
    # ``all_columns`` instead. Without this the bundled raw ``Table.yaml``
    # (query_mode: raw, empty metrics/groupby, populated all_columns) is
    # misclassified non-derivable and its data endpoint 400s (#33615 review).
    if not columns and params.get("query_mode") == "raw":
        columns = params.get("all_columns") or []
    if not metrics and not columns:
        return None

    translated = _translate_adhoc_filters(params.get("adhoc_filters", []))
    # Fail closed: an adhoc filter could not be preserved, so a synthesized
    # context would silently query a broader row set than the chart defines.
    if translated is None:
        return None
    filters, where, having = translated

    query_object = {
        "time_range": params.get("time_range", " : "),
        "granularity": params.get("granularity_sqla") or params.get("granularity"),
        "filters": filters,
        "extras": {
            "time_grain_sqla": params.get("time_grain_sqla"),
            "having": having,
            "where": where,
        },
        "applied_time_extras": {},
        "columns": columns,
        "metrics": metrics,
        "orderby": _derive_orderby(params),
        "annotation_layers": [],
        # Leave ``row_limit`` unset when the chart does not specify one so the
        # read path applies the runtime-configured ``ROW_LIMIT`` (50,000 by
        # default), rather than baking in a hard-coded cap that would silently
        # truncate imported charts to fewer rows than the UI shows (#33615 review).
        "row_limit": params.get("row_limit"),
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
