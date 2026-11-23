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
"""Visualization compatibility policy for semantic-view charts and images."""

from __future__ import annotations

from typing import Any, TYPE_CHECKING

from flask_babel import lazy_gettext as _
from flask_babel.speaklater import LazyString

from superset.exceptions import QueryObjectValidationError

if TYPE_CHECKING:
    from superset.common.query_context import QueryContext

UNSUPPORTED_SEMANTIC_CHART_TYPES: dict[str, LazyString] = {
    "histogram_v2": _(
        "Histogram is not yet supported on semantic views. "
        "Use a Bar or Table chart with an explicit count metric."
    ),
    "cal_heatmap": _(
        "Calendar Heatmap is not yet supported on semantic views. "
        "Use a Line or Bar chart."
    ),
    "time_table": _(
        "Time-series Table is not yet supported on semantic views. "
        "Use a Table chart with an explicit time dimension."
    ),
    "time_pivot": _(
        "Time-series Period Pivot is not yet supported on semantic views. "
        "Use a Line or Bar chart."
    ),
    "rose": _(
        "Nightingale Rose is not yet supported on semantic views. "
        "Use a Line or Bar chart."
    ),
    "horizon": _(
        "Horizon is not yet supported on semantic views. Use a Line or Bar chart."
    ),
    "paired_ttest": _(
        "Paired t-test is not yet supported on semantic views. "
        "Use a Table chart to inspect the metric by time."
    ),
}


def validate_semantic_chart_type(datasource_type: str, viz_type: object) -> None:
    """Reject visualizations whose input contract semantic views cannot supply."""
    if datasource_type != "semantic_view" or viz_type is None:
        return
    if not isinstance(viz_type, str):
        raise QueryObjectValidationError(str(_("Chart type must be a string.")))
    message: LazyString | None = UNSUPPORTED_SEMANTIC_CHART_TYPES.get(viz_type)
    if message:
        raise QueryObjectValidationError(str(message))


def semantic_chart_refusal(datasource_type: object, viz_type: object) -> str | None:
    """Return why a chart type cannot run on a semantic view, or ``None``."""
    if datasource_type != "semantic_view" or not isinstance(viz_type, str):
        return None
    message: LazyString | None = UNSUPPORTED_SEMANTIC_CHART_TYPES.get(viz_type)
    return str(message) if message else None


def validate_query_context_chart_type(query_context: QueryContext) -> None:
    """Refuse a query context whose chart type semantic views cannot supply.

    The request's ``viz_type`` wins, so Explore can switch a saved chart to a
    supported type; the saved chart's type is the fallback when the request
    carries none.
    """
    datasource_type: str = query_context.datasource.type
    if datasource_type != "semantic_view":
        return
    viz_type: object = (query_context.form_data or {}).get("viz_type")
    if not viz_type and query_context.slice_ is not None:
        viz_type = query_context.slice_.viz_type
    validate_semantic_chart_type(datasource_type, viz_type)


def pin_saved_chart_type(
    payload: dict[str, Any], datasource_type: object, viz_type: object
) -> None:
    """Stamp a refused saved chart's type onto a replayed query context.

    A saved query context is replayed verbatim, so its ``form_data.viz_type``
    can be stale after the chart's type changed. Only refused types are
    stamped, so supported charts keep their saved export post-processing.
    """
    if semantic_chart_refusal(datasource_type, viz_type) is None:
        return
    payload["form_data"] = {**(payload.get("form_data") or {}), "viz_type": viz_type}
