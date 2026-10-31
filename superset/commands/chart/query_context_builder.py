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
the synthesized context matches what the chart's own ``buildQuery`` would emit
at read time, so an imported chart returns exactly the rows it defines — no
broadened result set, no dropped filter/ordering/role/post-processing, and no
viz-specific semantics (time axis, pivot axes, server pagination, contribution,
aggregation) silently lost (#33615 review).

The datasource is taken from the importer-resolved id/type **only**, never from
``params`` (ADR-014 authz/RLS): the synthesized context names the same real
datasource the authz layer vets at read time.
"""

from __future__ import annotations

from typing import Any

from superset.common.form_data_query_context import (
    build_query_context_from_form_data,
)

# Datasource-less viz types render static/markdown content rather than a
# datasource-backed query; a NULL query_context is the *correct* state for them
# (FR-003), not a bug. Kept as a small, explicit, conservatively-expanded set.
# NOTE: `handlebars` is deliberately NOT here — it renders a template over query
# results and issues a real datasource-backed query, so it must stay on the
# derivable path.
_NON_DATASOURCE_VIZ: frozenset[str] = frozenset({"markup", "divider"})


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
        non-derivable (FR-003): no datasource, a datasource-less viz type, or a
        form-data shape the canonical builder produces no query for. Never
        returns a fabricated/invalid context.
    """
    params = params or {}

    # FR-003 non-derivable classification — return None, importer leaves NULL.
    if not datasource_id or viz_type in _NON_DATASOURCE_VIZ:
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
