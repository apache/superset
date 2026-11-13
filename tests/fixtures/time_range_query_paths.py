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

from datetime import datetime
from typing import Any
from unittest.mock import PropertyMock

import pytest
from flask import current_app
from pytest_mock import MockerFixture

from superset.extensions import security_manager
from superset.utils import json

NOW = "2026-10-21 12:00:00"


BAD_GLOBAL = {"schema_version": 1, "max_span": "x"}


class SqlRanError(Exception):
    pass


def policy(span: int | None = None, back: int | None = None) -> dict[str, Any] | None:
    return {
        "schema_version": 1,
        "max_span": {"quantity": span, "time_grain": "P1D"} if span else None,
        "max_look_back": {"quantity": back, "time_grain": "P1D"} if back else None,
        "max_look_forward": None,
    }


def set_global(mocker: MockerFixture, limits: Any) -> None:
    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": limits})


def make_dataset(temporal: bool = True, dataset_id: int = 7) -> Any:
    from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
    from superset.models.core import Database

    columns = [
        TableColumn(column_name="name", type="VARCHAR"),
        TableColumn(column_name="value", type="INTEGER"),
    ]
    if temporal:
        columns.append(TableColumn(column_name="ds", is_dttm=1, type="TIMESTAMP"))
    return SqlaTable(
        id=dataset_id,
        table_name="t",
        columns=columns,
        main_dttm_col="ds" if temporal else None,
        database=Database(id=1, database_name="db", sqlalchemy_uri="sqlite://"),
        metrics=[SqlMetric(metric_name="count", expression="COUNT(*)")],
        changed_on=datetime(2026, 1, 1),
    )


def layout(*charts: int) -> str:
    """``ROOT_ID → GRID_ID → ROW-1 → CHART-<id>`` for each chart."""
    position: dict[str, Any] = {
        "ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["GRID_ID"]},
        "GRID_ID": {"id": "GRID_ID", "type": "GRID", "children": ["ROW-1"]},
        "ROW-1": {
            "id": "ROW-1",
            "type": "ROW",
            "children": [f"CHART-{chart}" for chart in charts],
        },
    }
    for chart in charts:
        position[f"CHART-{chart}"] = {
            "id": f"CHART-{chart}",
            "type": "CHART",
            "children": [],
            "meta": {"chartId": chart},
        }
    return json.dumps(position)


def time_filter(
    value: str | None = "Last 30 days",
    excluded: Any = (),
    filter_id: str = "NATIVE_FILTER-time",
    filter_type: str = "filter_time",
    root_path: Any = ("ROOT_ID",),
    **extra_form_data: Any,
) -> dict[str, Any]:
    key = {
        "filter_time": "time_range",
        "filter_timecolumn": "granularity_sqla",
        "filter_timegrain": "time_grain_sqla",
    }[filter_type]
    state_value = value if filter_type == "filter_time" else [value]
    return {
        "id": filter_id,
        "type": "NATIVE_FILTER",
        "filterType": filter_type,
        "targets": [{}],
        "scope": {"rootPath": list(root_path), "excluded": list(excluded)},
        "defaultDataMask": {
            "filterState": {"value": state_value if value is not None else None},
            "extraFormData": extra_form_data or ({key: value} if value else {}),
        },
    }


def use_dashboards(mocker: MockerFixture, *dashboards: Any) -> Any:
    by_id = {dashboard.id: dashboard for dashboard in dashboards}
    return mocker.patch(
        "superset.daos.dashboard.DashboardDAO.find_by_id",
        side_effect=lambda model_id, **kwargs: by_id.get(model_id),
    )


def as_user(mocker: MockerFixture, kind: str, can_open: bool = True) -> Any:
    """
    ``alpha``: ``datasource_access`` on the dataset. ``rbac``: dashboard access
    only. ``guest``: embedded guest. ``can_open``: what ``can_access_dashboard``
    returns.
    """
    mocker.patch.object(security_manager, "is_guest_user", return_value=kind == "guest")
    mocker.patch.object(security_manager, "can_access_schema", return_value=False)
    mocker.patch.object(security_manager, "can_access", return_value=kind == "alpha")
    mocker.patch.object(security_manager, "is_editor", return_value=False)
    return mocker.patch.object(
        security_manager, "can_access_dashboard", return_value=can_open
    )


def tr(value: str) -> dict[str, Any]:
    return {"col": "ds", "op": "TEMPORAL_RANGE", "val": value}


MODERN = "echarts_timeseries_line"


def saved_chart(
    chart_id: int,
    time_range: str = "Last year",
    **form_data: Any,
) -> Any:
    from superset.models.slice import Slice

    params = {
        "datasource": "7__table",
        "viz_type": MODERN,
        "granularity_sqla": "ds",
        "time_range": time_range,
        "metrics": ["count"],
        "groupby": [],
        **form_data,
    }
    query_context = {
        "datasource": {"type": "table", "id": 7},
        "queries": [
            {
                "filters": [tr(time_range)],
                "metrics": ["count"],
                "columns": [],
                "time_range": time_range,
                "time_offsets": form_data.get("time_compare") or [],
            }
        ],
        "form_data": {**params, "slice_id": chart_id},
        "result_type": "full",
    }
    return Slice(
        id=chart_id,
        viz_type=params["viz_type"],
        datasource_type="table",
        datasource_id=7,
        params=json.dumps(params),
        query_context=json.dumps(query_context),
    )


__all__ = [
    "Any",
    "BAD_GLOBAL",
    "MODERN",
    "MockerFixture",
    "NOW",
    "PropertyMock",
    "SqlRanError",
    "as_user",
    "current_app",
    "datetime",
    "json",
    "layout",
    "make_dataset",
    "policy",
    "pytest",
    "saved_chart",
    "security_manager",
    "set_global",
    "time_filter",
    "tr",
    "use_dashboards",
]
