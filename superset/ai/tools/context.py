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
Reading what an existing chart or dashboard is made of.

These answer "what does this thing already show?", which is what a question like
"why is this number different from the dashboard" needs. Both are reads of
Superset's metadata; neither queries a warehouse.

Three authorization gates apply to each:

* the requesting role needs ``can_read`` on Chart or Dashboard;
* the DAO's ``base_filter`` decides whether the object is visible at all, so an
  id the user may not see is reported as not found rather than forbidden; and
* ``security_manager.raise_for_access`` re-checks the specific object, which is
  what catches a chart that is listed but whose underlying dataset the user has
  lost access to.

Saved chart controls are returned intact: visualization plugins can introduce
transformations that change the meaning of a value. The shared tool budget
bounds the response, and user-authored strings remain untrusted context.
"""

from __future__ import annotations

import logging
from typing import Any, ClassVar

from superset.ai.tools.base import AITool, require_read_access, ToolError, ToolOutput

logger = logging.getLogger(__name__)

#: Legacy model-output and UI display limits. Exact context accounting retains
#: complete metadata for the model; the display copy remains bounded separately.
MAX_CHARTS = 50

#: Columns and metrics listed for a chart's dataset.
MAX_DATASET_FIELDS = 100

#: Legacy ceiling for a virtual dataset's SQL.
MAX_SQL_CHARS = 4000


def _positive_id(value: Any, field: str) -> int:
    """Validate an id argument."""
    if not isinstance(value, int) or isinstance(value, bool) or value < 1:
        raise ToolError(f"{field!r} must be a positive integer.")
    return value


def _untrusted(value: Any) -> Any:
    """Wrap user-authored free text so it cannot pose as instructions."""
    from superset.ai.prompt_framing import sanitize_for_llm_context

    if value is None:
        return None
    return sanitize_for_llm_context(value)


def _load_chart(chart_id: int) -> Any:
    """
    Fetch a chart the user may see, or refuse.

    ``ChartDAO.find_by_id`` applies ``ChartFilter``; the explicit
    ``raise_for_access`` then re-checks this specific chart, which is the gate
    that catches a chart whose dataset access has since been revoked.
    """
    from superset import security_manager
    from superset.daos.chart import ChartDAO
    from superset.exceptions import SupersetSecurityException

    require_read_access("Chart")
    chart = ChartDAO.find_by_id(chart_id)
    if chart is None:
        raise ToolError(
            f"No chart with id {chart_id} is available to you. Use search_assets "
            f"to find charts you can read."
        )
    try:
        security_manager.raise_for_access(chart=chart)
    except SupersetSecurityException:
        raise ToolError(
            f"You do not have access to the data behind chart {chart_id}."
        ) from None
    return chart


def _load_dashboard(dashboard_id: int) -> Any:
    """Fetch a dashboard the user may see, or refuse."""
    from superset import security_manager
    from superset.daos.dashboard import DashboardDAO
    from superset.exceptions import SupersetSecurityException

    require_read_access("Dashboard")
    dashboard = DashboardDAO.find_by_id(dashboard_id)
    if dashboard is None:
        raise ToolError(
            f"No dashboard with id {dashboard_id} is available to you. Use "
            f"search_assets to find dashboards you can read."
        )
    try:
        security_manager.raise_for_access(dashboard=dashboard)
    except SupersetSecurityException:
        raise ToolError(
            f"You do not have access to dashboard {dashboard_id}."
        ) from None
    return dashboard


def _chart_params(chart: Any) -> dict[str, Any]:
    """
    Read the saved controls without guessing which ones affect the result.

    A malformed blob is reported rather than raised: a chart saved by an older
    version, or hand-edited, should still yield the rest of its context.
    """
    from superset.utils import json

    raw = chart.params
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except Exception:  # pylint: disable=broad-except
        logger.info("Chart %s has unparseable params", chart.id)
        return {"_note": "This chart's saved configuration could not be read."}
    if not isinstance(parsed, dict):
        return {}

    return _untrusted(parsed)


def _dataset_summary(
    dataset: Any, *, preserve_metadata: bool = False
) -> dict[str, Any]:
    """
    Describe the dataset a chart reads from.

    Column and metric names are operational identifiers and stay verbatim so the
    model can put them straight into SQL; their descriptions and labels are
    user-authored and are wrapped.
    """
    field_limit = None if preserve_metadata else MAX_DATASET_FIELDS
    columns = [
        {
            "name": column.column_name,
            "type": str(column.type or ""),
            "is_temporal": bool(column.is_dttm),
            "expression": _untrusted(column.expression),
            "is_calculated": bool(column.expression),
            "description": _untrusted(column.description),
        }
        for column in (dataset.columns or [])[:field_limit]
    ]
    metrics = [
        {
            "name": metric.metric_name,
            "label": _untrusted(metric.verbose_name),
            "expression": metric.expression,
            "description": _untrusted(metric.description),
        }
        for metric in (dataset.metrics or [])[:field_limit]
    ]

    summary: dict[str, Any] = {
        "id": dataset.id,
        "name": _untrusted(dataset.table_name),
        "description": _untrusted(dataset.description),
        "database_id": dataset.database_id,
        "database_name": _untrusted(dataset.database.database_name),
        "dialect": dataset.database.backend,
        "schema": dataset.schema,
        "catalog": dataset.catalog,
        "is_virtual": bool(dataset.sql),
        "main_temporal_column": dataset.main_dttm_col,
        "columns": columns,
        "metrics": metrics,
        "column_count": len(dataset.columns or []),
        "metric_count": len(dataset.metrics or []),
        "columns_truncated": len(dataset.columns or []) > len(columns),
        "metrics_truncated": len(dataset.metrics or []) > len(metrics),
    }

    if dataset.sql:
        sql = str(dataset.sql)
        summary["sql"] = sql if preserve_metadata else sql[:MAX_SQL_CHARS]
        if len(sql) > len(summary["sql"]):
            summary["sql_truncated"] = True
            summary["sql_note"] = (
                f"Showing the first {MAX_SQL_CHARS} of {len(sql)} characters of "
                f"this virtual dataset's SQL."
            )
    return summary


class GetChartContextTool(AITool):
    """Describe one chart and the dataset behind it."""

    name: ClassVar[str] = "get_chart_context"
    description: ClassVar[str] = (
        "Describe an existing chart: its name, visualization type, the metrics "
        "and dimensions it uses, and the dataset it reads from including that "
        "dataset's columns, metrics and — for a virtual dataset — its SQL. Use "
        "this to understand or reproduce what a chart shows before writing your "
        "own query. Get the chart_id from search_assets."
    )
    input_schema: ClassVar[dict[str, Any]] = {
        "type": "object",
        "properties": {
            "chart_id": {
                "type": "integer",
                "description": "Chart to describe, from search_assets.",
            },
        },
        "required": ["chart_id"],
    }

    def run(self, chart_id: Any = None, **_ignored: Any) -> ToolOutput:
        return self._run(chart_id, preserve_metadata=False)

    def run_for_context(self, chart_id: Any = None, **_ignored: Any) -> ToolOutput:
        """Read complete metadata through the same chart authorization gates."""
        return self._run(chart_id, preserve_metadata=True)

    def _run(self, chart_id: Any, *, preserve_metadata: bool) -> ToolOutput:
        """Share authorization and payload construction across budgeting modes."""
        chart = _load_chart(_positive_id(chart_id, "chart_id"))

        payload: dict[str, Any] = {
            "id": chart.id,
            "name": _untrusted(chart.slice_name),
            "description": _untrusted(chart.description),
            "viz_type": chart.viz_type,
            "configuration": _chart_params(chart),
        }

        dataset = chart.datasource
        if dataset is None:
            payload["note"] = (
                "This chart's dataset is missing or is not a table dataset, so "
                "no column information is available."
            )
        else:
            payload["dataset"] = _dataset_summary(
                dataset, preserve_metadata=preserve_metadata
            )

        return ToolOutput.of(
            payload,
            display={
                "kind": "chart_context",
                "chart_id": chart.id,
                "name": chart.slice_name,
                "viz_type": chart.viz_type,
                "dataset_id": dataset.id if dataset is not None else None,
                "dataset_name": dataset.table_name if dataset is not None else None,
                "is_virtual_dataset": (
                    bool(dataset.sql) if dataset is not None else None
                ),
                "metrics": payload["configuration"].get("metrics"),
                "dimensions": payload["configuration"].get("groupby"),
            },
        )


class GetDashboardContextTool(AITool):
    """Describe one dashboard and the charts on it."""

    name: ClassVar[str] = "get_dashboard_context"
    description: ClassVar[str] = (
        "Describe an existing dashboard: its title, whether it is published, and "
        "the charts it contains with each chart's id, visualization type and "
        "dataset. Use this to see what a dashboard already covers, then "
        "get_chart_context for the detail of any one chart. Get the "
        "dashboard_id from search_assets."
    )
    input_schema: ClassVar[dict[str, Any]] = {
        "type": "object",
        "properties": {
            "dashboard_id": {
                "type": "integer",
                "description": "Dashboard to describe, from search_assets.",
            },
        },
        "required": ["dashboard_id"],
    }

    def run(self, dashboard_id: Any = None, **_ignored: Any) -> ToolOutput:
        return self._run(dashboard_id, preserve_metadata=False)

    def run_for_context(self, dashboard_id: Any = None, **_ignored: Any) -> ToolOutput:
        """Return all chart summaries for measured context accounting."""
        return self._run(dashboard_id, preserve_metadata=True)

    def _run(self, dashboard_id: Any, *, preserve_metadata: bool) -> ToolOutput:
        """Keep the model list independent of its bounded display copy."""
        dashboard = _load_dashboard(_positive_id(dashboard_id, "dashboard_id"))

        charts = dashboard.slices or []
        summaries: list[dict[str, Any]] = []
        for chart in charts[: None if preserve_metadata else MAX_CHARTS]:
            dataset = chart.datasource
            summaries.append(
                {
                    "id": chart.id,
                    "name": _untrusted(chart.slice_name),
                    "viz_type": chart.viz_type,
                    "dataset_id": dataset.id if dataset is not None else None,
                    "dataset_name": (
                        _untrusted(dataset.table_name) if dataset is not None else None
                    ),
                }
            )

        payload: dict[str, Any] = {
            "id": dashboard.id,
            "title": _untrusted(dashboard.dashboard_title),
            "description": _untrusted(dashboard.description),
            "slug": dashboard.slug,
            "published": bool(dashboard.published),
            "charts": summaries,
            "chart_count": len(charts),
        }
        if len(charts) > len(summaries):
            payload["truncated"] = True
            payload["note"] = (
                f"Showing {MAX_CHARTS} of {len(charts)} charts. Call "
                f"get_chart_context for any one of them."
            )

        return ToolOutput.of(
            payload,
            display={
                "kind": "dashboard_context",
                "dashboard_id": dashboard.id,
                "title": dashboard.dashboard_title,
                "published": bool(dashboard.published),
                "chart_count": len(charts),
                "truncated": len(charts) > MAX_CHARTS,
                "charts": [
                    {
                        "id": chart.id,
                        "name": chart.slice_name,
                        "viz_type": chart.viz_type,
                    }
                    for chart in charts[:MAX_CHARTS]
                ],
            },
        )
