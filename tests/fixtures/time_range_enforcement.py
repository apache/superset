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

from flask import current_app
from pytest_mock import MockerFixture

from superset.common.chart_data import ChartDataResultType
from superset.extensions import security_manager
from superset.utils import json


def tr(val: Any, col: str = "ds") -> dict[str, Any]:
    return {"col": col, "op": "TEMPORAL_RANGE", "val": val}


def make_dataset(
    main: str | None = "ds",
    extra: str | None = None,
    temporal: bool = True,
    verbose: dict[str, str] | None = None,
) -> Any:
    from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
    from superset.models.core import Database

    columns = [
        TableColumn(column_name="name", type="VARCHAR"),
        TableColumn(column_name="value", type="INTEGER"),
    ]
    if temporal:
        columns += [
            TableColumn(column_name="ds", is_dttm=1, type="TIMESTAMP"),
            TableColumn(column_name="other_ts", is_dttm=1, type="TIMESTAMP"),
        ]
    for column in columns:
        column.verbose_name = (verbose or {}).get(column.column_name)
    return SqlaTable(
        id=7,
        table_name="t",
        columns=columns,
        main_dttm_col=main if temporal else None,
        database=Database(id=1, database_name="db", sqlalchemy_uri="sqlite://"),
        metrics=[SqlMetric(metric_name="count", expression="COUNT(*)")],
        extra=extra,
    )


def use_datasource(mocker: MockerFixture, datasource: Any) -> Any:
    mocker.patch("superset.daos.chart.ChartDAO.find_by_id", return_value=None)
    mocker.patch(
        "superset.daos.datasource.DatasourceDAO.get_datasource",
        return_value=datasource,
    )
    return datasource


def make_context(
    queries: list[dict[str, Any]],
    form_data: dict[str, Any] | None = None,
    result_type: ChartDataResultType | None = None,
    datasource_type: str = "table",
) -> Any:
    from superset.common.query_context_factory import QueryContextFactory

    return QueryContextFactory().create(
        datasource={"type": datasource_type, "id": 7},
        queries=queries,
        form_data=form_data or {},
        result_type=result_type,
    )


def set_limits(mocker: MockerFixture, limits: dict[str, Any] | None) -> None:
    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": limits})


def policy(
    max_span: tuple[int, str] | None = None,
    max_look_back: tuple[int, str] | None = None,
    max_look_forward: tuple[int, str] | None = None,
) -> dict[str, Any]:
    def rule(value: tuple[int, str] | None) -> dict[str, Any] | None:
        return {"quantity": value[0], "time_grain": value[1]} if value else None

    return {
        "schema_version": 1,
        "max_span": rule(max_span),
        "max_look_back": rule(max_look_back),
        "max_look_forward": rule(max_look_forward),
    }


def as_user(mocker: MockerFixture, kind: str, can_open: bool = True) -> Any:
    """
    ``admin``: schema access. ``alpha``: ``datasource_access`` on the dataset.
    ``editor``: an editor of the dataset. ``rbac``: dashboard access only.
    ``guest``: embedded guest. ``can_open``: what ``can_access_dashboard``
    returns.
    """
    mocker.patch.object(security_manager, "is_guest_user", return_value=kind == "guest")
    mocker.patch.object(
        security_manager, "can_access_schema", return_value=kind == "admin"
    )
    mocker.patch.object(security_manager, "can_access", return_value=kind == "alpha")
    mocker.patch.object(security_manager, "is_editor", return_value=kind == "editor")
    return mocker.patch.object(
        security_manager, "can_access_dashboard", return_value=can_open
    )


def make_dashboard(
    dashboard_id: int = 3,
    limits: dict[str, Any] | None = None,
    slices: list[tuple[int, int]] = ((11, 7),),  # type: ignore[assignment]
    native_filters: list[dict[str, Any]] | None = None,
    json_metadata: str | None = None,
) -> Any:
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

    metadata: dict[str, Any] = {"native_filter_configuration": native_filters or []}
    if limits is not None:
        metadata["time_range_limits"] = limits
    return Dashboard(
        id=dashboard_id,
        json_metadata=json_metadata or json.dumps(metadata),
        slices=[
            Slice(id=slice_id, datasource_id=ds_id, datasource_type="table")
            for slice_id, ds_id in slices
        ],
    )


def use_dashboards(mocker: MockerFixture, *dashboards: Any) -> Any:
    by_id = {dashboard.id: dashboard for dashboard in dashboards}
    return mocker.patch(
        "superset.daos.dashboard.DashboardDAO.find_by_id",
        side_effect=lambda model_id, **kwargs: by_id.get(model_id),
    )


def check(context: Any) -> None:
    from superset.time_range_limits.enforcement import (
        check_query_context_date_ranges,
    )

    check_query_context_date_ranges(context)


__all__ = [
    "Any",
    "ChartDataResultType",
    "MockerFixture",
    "as_user",
    "check",
    "current_app",
    "json",
    "make_context",
    "make_dashboard",
    "make_dataset",
    "policy",
    "security_manager",
    "set_limits",
    "tr",
    "use_dashboards",
    "use_datasource",
]
