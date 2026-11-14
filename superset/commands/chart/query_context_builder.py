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

The mapping itself is **not** reimplemented here. Instead this delegates to the
canonical, server-side form-data → query-context builder
``superset.common.form_data_query_context.build_query_context_from_form_data``
— the same one the dashboard Excel export and the MCP chart service already use
to rebuild a context for charts that predate persisted query contexts. Reusing
it (rather than maintaining a second, partial form-data-to-query mapping) means
that, for the viz types that builder has an explicit adapter for, the
synthesized context matches what the chart's own ``buildQuery`` would emit at
read time, so an imported chart returns exactly the rows it defines — no dropped
filter/ordering/role/post-processing and no viz-specific semantics (time axis,
pivot axes, server pagination, contribution, aggregation) silently lost.

That builder is a **generic** mapper, not the chart's per-viz ``buildQuery``, so
two things are guarded here so synthesis never persists a context that returns
*more* rows than the chart shows (#33615 review):

* **Allowlist (honest-fail).** Only viz types the builder maps explicitly are
  synthesized; any other viz type (e.g. ``sankey_v2``, ``graph_chart``) falls
  through the builder's generic top-N branch, which has no alias for its
  controls and would emit a single aggregate query that *looks* valid. Those are
  classified non-derivable and left ``NULL`` so the chart keeps prompting a
  re-save rather than silently returning wrong data.
* **Adhoc time range.** The canonical builder injects ``time_range="No filter"``
  on a query that carries no top-level ``time_range``. At read time
  ``QueryContextFactory._apply_filters`` would then overwrite a bound
  ``TEMPORAL_RANGE`` adhoc filter's value with ``"No filter"`` and count every
  date, so the injected sentinel is dropped when it would clobber a real range.
  The decision is made per query, not per chart: the second query of a
  ``mixed_timeseries`` chart is built from its own ``_b`` controls, so it can
  carry the sentinel even when the first query has an explicit top-level range.

Charts carrying dashboard-context filters (``extra_filters`` /
``extra_form_data``, including the ``_b`` variants) are also left ``NULL`` — any
non-empty value means the live chart applies an override (a native filter, a
time-grain, a time range) the generic builder does not reproduce.

The datasource is taken from the importer-resolved id/type **only**, never from
``params`` (ADR-014 authz/RLS): the synthesized context names the same real
datasource the authz layer vets at read time.
"""

from __future__ import annotations

from typing import Any

from superset.common.form_data_query_context import (
    build_query_context_from_form_data,
)
from superset.utils.date_parser import is_no_time_range

# Datasource-less viz types render static/markdown content rather than a
# datasource-backed query; a NULL query_context is the *correct* state for them
# (FR-003), not a bug. Kept as a small, explicit, conservatively-expanded set.
# NOTE: `handlebars` is deliberately NOT here — it renders a template over query
# results and issues a real datasource-backed query, so it must stay on the
# derivable path.
_NON_DATASOURCE_VIZ: frozenset[str] = frozenset({"markup", "divider"})

# Viz types the canonical ``build_query_objects_from_form_data`` has an explicit
# adapter for (mirrors its ``effective_viz`` branches). Only these are
# synthesized; everything else falls through that builder's generic top-N branch,
# which cannot be trusted to map the viz faithfully, so we honest-fail to NULL.
# Keep in sync with ``superset.common.form_data_query_context``.
_BUILDER_MAPPED_VIZ: frozenset[str] = frozenset(
    {
        "table",
        "ag-grid-table",
        "ag-grid-pivot-table",
        "histogram_v2",
        "box_plot",
        "pivot_table_v2",
        "waterfall",
        "gantt",
        "gantt_chart",
        "echarts_area",
        "mixed_timeseries",
        "big_number",
        "big_number_total",
        "handlebars",
        "pie",
        "gauge_chart",
        "treemap_v2",
        "sunburst_v2",
        "bubble",
        "bubble_v2",
        "world_map",
        "country_map",
    }
)


def _is_builder_mapped(viz_type: str) -> bool:
    """Return True if the canonical builder maps ``viz_type`` explicitly."""
    return viz_type in _BUILDER_MAPPED_VIZ or viz_type.startswith("echarts_timeseries")


# Keys that carry dashboard-context overrides (native dashboard filters, URL
# params, cross-filters, time-grain/time-range overrides). The ``_b`` variants
# feed the *second* query of a ``mixed_timeseries`` chart. The canonical builder
# applies none of these the way the live chart does.
_DASHBOARD_CONTEXT_KEYS = (
    "extra_filters",
    "extra_filters_b",
    "extra_form_data",
    "extra_form_data_b",
)


def _has_dashboard_context_filters(params: dict[str, Any]) -> bool:
    """
    Return True if ``params`` carries any non-empty dashboard-context override.

    ``extra_filters`` / ``extra_form_data`` (and their ``_b`` variants for the
    second query of a ``mixed_timeseries`` chart) are applied by the live chart
    (native dashboard filters, URL params, cross-filters) in ways the generic
    builder does not reproduce. The guard treats *any* non-empty value as
    non-derivable, not only ``filters``/``adhoc_filters``/``time_range``: an
    ``extra_form_data`` carrying only ``time_grain_sqla`` (e.g. ``P1M`` over a
    chart saved with ``P1D``) would otherwise be synthesized with the wrong
    buckets, and a chart with only ``extra_filters_b`` / ``extra_form_data_b``
    would have its second query synthesized unfiltered. Leave such a chart
    ``NULL`` rather than persist a context that returns different rows than the
    live chart (#33615 review).
    """
    return any(params.get(key) for key in _DASHBOARD_CONTEXT_KEYS)


def _preserve_adhoc_temporal_range(context: dict[str, Any]) -> None:
    """
    Drop a builder-injected ``time_range="No filter"`` that would clobber a range.

    The canonical builder ``setdefault``s ``time_range="No filter"`` on every
    query when the chart has no top-level ``time_range``. For a chart whose date
    constraint lives in a bound ``TEMPORAL_RANGE`` adhoc filter,
    ``QueryContextFactory._apply_filters`` would overwrite that filter's value
    with ``"No filter"`` at read time and count every date. Removing the injected
    sentinel (only when a bound ``TEMPORAL_RANGE`` filter is present) leaves the
    adhoc filter's own range intact. Decided per query, not per chart: the second
    query of a ``mixed_timeseries`` chart is built from its own ``_b`` controls,
    so it can carry the injected sentinel even when the first query has an
    explicit top-level range. A query that kept a real range (anything other than
    the ``"No filter"`` sentinel), or that has no bound ``TEMPORAL_RANGE`` filter,
    is never touched, so a genuinely unbounded query is left alone.
    """
    for query in context.get("queries") or []:
        if query.get("time_range") != "No filter":
            continue
        for flt in query.get("filters") or []:
            if not isinstance(flt, dict) or flt.get("op") != "TEMPORAL_RANGE":
                continue
            val = flt.get("val")
            bound = val is not None and not (
                isinstance(val, str) and is_no_time_range(val)
            )
            if bound:
                query.pop("time_range", None)
                break


def build_query_context_config(
    params: dict[str, Any] | None,
    viz_type: str,
    datasource_id: int | None,
    datasource_type: str = "table",
) -> dict[str, Any] | None:
    """
    Map a chart's ``params`` + resolved datasource to a ``query_context`` payload.

    :param params: the chart's viz form-data (a dict at ``import_chart`` time).
    :param viz_type: the chart's viz type (classification + builder input).
    :param datasource_id: the importer-resolved datasource id. **Datasource is
        taken from this argument only, never from ``params`` (ADR-014 / RISK-T02)**
        so the synthesized context names the same real datasource the authz layer
        vets at read time.
    :param datasource_type: the datasource type — ``"table"`` on import.
    :returns: a ``query_context`` payload dict (the shape
        ``ChartDataQueryContextSchema`` loads), or ``None`` when the chart is
        non-derivable (FR-003): no datasource, a datasource-less viz type, a viz
        type the canonical builder has no explicit adapter for, a chart carrying
        dashboard-context filters, or a form-data shape the canonical builder
        produces no query for. Never returns a fabricated/invalid context.
    """
    params = params or {}

    # FR-003 non-derivable classification — return None, importer leaves NULL.
    if not datasource_id or viz_type in _NON_DATASOURCE_VIZ:
        return None

    # Honest-fail for viz types the canonical builder has no explicit adapter
    # for: its generic top-N branch would emit a plausible-looking but wrong
    # context (e.g. ``sankey_v2``/``graph_chart`` -> one aggregate row instead of
    # edges). Leave those NULL so the chart keeps prompting a re-save (#33615).
    if not _is_builder_mapped(viz_type):
        return None

    # Dashboard-context filters are applied by the live chart in ways the generic
    # builder does not reproduce; synthesizing would drop them, so leave NULL.
    if _has_dashboard_context_filters(params):
        return None

    # The datasource is the importer-resolved id/type only; overwrite any
    # datasource carried in params and never trust it (ADR-014). The exported
    # ``slice_id`` is dropped here so the synthesized context — which embeds the
    # form data — cannot bind to an unrelated local chart that happens to share
    # that id; the local slice is bound by the caller once the row's id is known.
    form_data = {
        **params,
        "datasource": f"{datasource_id}__{datasource_type}",
    }
    form_data.pop("slice_id", None)

    context = build_query_context_from_form_data(
        form_data,
        {"id": datasource_id, "type": datasource_type},
        viz_type,
    )

    # Honest-fail: if the canonical builder produced nothing to query, leave the
    # chart non-derivable rather than persist an empty/invalid context.
    if not context or not context.get("queries"):
        return None

    # Drop any builder-injected ``time_range="No filter"`` that would clobber a
    # bound ``TEMPORAL_RANGE`` adhoc filter. Decided per query (not per chart): a
    # ``mixed_timeseries`` chart builds query B from its own ``_b`` controls, so
    # query B can lack a top-level range and receive the sentinel even when query
    # A carries an explicit one — the per-query guard inside the helper keeps a
    # query that has a real range of its own untouched (#33615 review).
    _preserve_adhoc_temporal_range(context)

    return context


def bind_slice_id(context: dict[str, Any], slice_id: int) -> dict[str, Any]:
    """
    Bind a synthesized context to a local chart's own id (in place).

    Synthesis drops the exported ``slice_id`` so the context cannot bind to a
    foreign chart. Once the destination row's id is known, inject it into the
    context's embedded ``form_data`` so ``QueryContextFactory`` resolves THIS
    chart at read time — its cache timeout and guest-token access then follow
    the imported chart live (and later edits to its ``cache_timeout`` take
    effect), instead of freezing an import-time value or silently reverting to
    the datasource default (#33615 review). Shared by both the import and the
    backfill paths so the two cannot drift.
    """
    form_data = context.get("form_data")
    if isinstance(form_data, dict):
        form_data["slice_id"] = slice_id
    return context
