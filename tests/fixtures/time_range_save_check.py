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
"""Shared builders for time range limits tests."""

from __future__ import annotations

from typing import Any

import pytest
from flask import current_app
from pytest_mock import MockerFixture

from superset.extensions import security_manager
from superset.time_range_limits.policy import FEATURE_FLAG
from superset.utils import json
from tests.fixtures.time_range_enforcement import tr
from tests.fixtures.time_range_query_paths import time_filter

NOW = "2026-10-28 12:00:00"


FLAG_ON = {FEATURE_FLAG: True}


MODERN = "echarts_timeseries_line"


def P(  # noqa: N802
    span: int | None = None,
    back: int | None = None,
    span_grain: str = "P1D",
    back_grain: str = "P1D",
) -> dict[str, Any]:
    return {
        "schema_version": 1,
        "max_span": {"quantity": span, "time_grain": span_grain} if span else None,
        "max_look_back": {"quantity": back, "time_grain": back_grain} if back else None,
        "max_look_forward": None,
    }


def adhoc(flt: dict[str, Any]) -> dict[str, Any]:
    return {
        "expressionType": "SIMPLE",
        "clause": "WHERE",
        "subject": flt["col"],
        "operator": "TEMPORAL_RANGE",
        "comparator": flt["val"],
    }


def modern(
    chart_id: int | None,
    name: str,
    dataset_id: int,
    filters: list[dict[str, Any]],
    metrics: list[Any] | None = None,
    **query: Any,
) -> Any:
    from superset.models.slice import Slice

    metrics = metrics or ["count"]
    params = {
        "datasource": f"{dataset_id}__table",
        "viz_type": MODERN,
        "metrics": metrics,
        "adhoc_filters": [adhoc(flt) for flt in filters],
        "time_range": "No filter",
    }
    query_context = {
        "datasource": {"id": dataset_id, "type": "table"},
        "queries": [{"metrics": metrics, "columns": [], "filters": filters, **query}],
        "form_data": {**params, "slice_id": chart_id},
        "result_type": "full",
        "result_format": "json",
    }
    return Slice(
        id=chart_id,
        slice_name=name,
        datasource_id=dataset_id,
        datasource_type="table",
        viz_type=MODERN,
        params=json.dumps(params),
        query_context=json.dumps(query_context),
    )


def form_data_chart(
    chart_id: int | None, name: str, dataset_id: int, **form: Any
) -> Any:
    """A chart saved without a query context: only its form data."""
    from superset.models.slice import Slice

    params = {
        "datasource": f"{dataset_id}__table",
        "viz_type": MODERN,
        "granularity_sqla": "ds",
        "metrics": ["count"],
        "groupby": [],
        **form,
    }
    return Slice(
        id=chart_id,
        slice_name=name,
        datasource_id=dataset_id,
        datasource_type="table",
        viz_type=MODERN,
        params=json.dumps(params),
        query_context=None,
    )


def layout(chart_ids: list[int], tab_charts: list[int] | None = None) -> str:
    tab_charts = tab_charts or []
    position: dict[str, Any] = {
        "ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["GRID_ID"]},
        "GRID_ID": {"id": "GRID_ID", "type": "GRID", "children": ["ROW-1", "TABS-1"]},
        "ROW-1": {
            "id": "ROW-1",
            "type": "ROW",
            "children": [f"CHART-{chart_id}" for chart_id in chart_ids],
        },
        "TABS-1": {"id": "TABS-1", "type": "TABS", "children": ["TAB-A", "TAB-B"]},
        "TAB-A": {"id": "TAB-A", "type": "TAB", "children": []},
        "TAB-B": {
            "id": "TAB-B",
            "type": "TAB",
            "children": [f"CHART-{chart_id}" for chart_id in tab_charts],
        },
    }
    for chart_id in [*chart_ids, *tab_charts]:
        position[f"CHART-{chart_id}"] = {
            "id": f"CHART-{chart_id}",
            "type": "CHART",
            "children": [],
            "meta": {"chartId": chart_id},
        }
    return json.dumps(position)


def named_filter(name: str, value: str | None, **kwargs: Any) -> dict[str, Any]:
    kwargs.setdefault("root_path", ["ROW-1", "TAB-A"])
    return {**time_filter(value, **kwargs), "name": name}


DASHBOARD_URL = "/api/v1/dashboard/{}/time_range_limits/charts/"


DATASET_URL = "/api/v1/dataset/{}/time_range_limits/charts/"


def rison(policy: Any) -> str:
    import prison

    return "?q=" + prison.dumps({"policy": policy})


def snapshot(save_check_objects: dict[str, Any]) -> Any:
    from superset import db
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

    db.session.expire_all()
    dashboard = db.session.get(Dashboard, save_check_objects["dashboard"].id)
    return (
        dashboard.json_metadata,
        dashboard.position_json,
        [
            (chart.params, chart.query_context, chart.changed_on)
            for chart in db.session.query(Slice).order_by(Slice.id)
        ],
        db.session.get(SqlaTable, save_check_objects["table"].id).extra,
    )


__all__ = [
    "Any",
    "DASHBOARD_URL",
    "DATASET_URL",
    "FEATURE_FLAG",
    "FLAG_ON",
    "MODERN",
    "MockerFixture",
    "NOW",
    "P",
    "adhoc",
    "current_app",
    "form_data_chart",
    "json",
    "layout",
    "modern",
    "named_filter",
    "pytest",
    "rison",
    "security_manager",
    "snapshot",
    "time_filter",
    "tr",
]
