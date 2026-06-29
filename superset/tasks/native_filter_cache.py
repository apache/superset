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
from __future__ import annotations

import logging
from typing import Any

from marshmallow import ValidationError

from superset.charts.schemas import ChartDataQueryContextSchema
from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.common.query_context import QueryContext
from superset.models.dashboard import Dashboard
from superset.utils import json
from superset.utils.core import DatasourceType

logger = logging.getLogger(__name__)

NATIVE_FILTER_DEFAULT_ROW_LIMIT = 1000
NO_FILTER_TIME_RANGE = "No filter"


def _get_filter_target(filter_config: dict[str, Any]) -> tuple[int | str, str] | None:
    for target in filter_config.get("targets") or []:
        if not isinstance(target, dict):
            continue

        dataset_id = target.get("datasetId")
        column = target.get("column") or {}
        column_name = column.get("name") if isinstance(column, dict) else None

        if dataset_id is not None and column_name:
            return dataset_id, column_name

    return None


def get_eligible_native_filters(dashboard: Dashboard) -> list[dict[str, Any]]:
    """Return native filter value filters eligible for option cache warm-up."""
    if not dashboard.json_metadata:
        logger.warning(
            "Dashboard %s has no json_metadata; skipping native filter warm-up",
            dashboard.id,
        )
        return []

    try:
        metadata = json.loads(dashboard.json_metadata)
    except (TypeError, ValueError):
        logger.warning(
            "Dashboard %s has malformed json_metadata; skipping native filter warm-up",
            dashboard.id,
        )
        return []

    native_filter_config = metadata.get("native_filter_configuration")
    if not isinstance(native_filter_config, list):
        logger.warning(
            "Dashboard %s has no native_filter_configuration; skipping native "
            "filter warm-up",
            dashboard.id,
        )
        return []

    print(
        f"[DEBUG] Dashboard {dashboard.id} native_filter_configuration count: "
        f"{len(native_filter_config)}",
        flush=True,
    )

    eligible_filters: list[dict[str, Any]] = []
    for filter_config in native_filter_config:
        if not isinstance(filter_config, dict):
            continue
        if filter_config.get("type") == "DIVIDER":
            continue
        if filter_config.get("filterType") != "filter_select":
            continue
        if _get_filter_target(filter_config) is None:
            continue

        eligible_filters.append(filter_config)

    print(
        f"[DEBUG] Dashboard {dashboard.id} eligible filters: "
        f"{[f.get('id') for f in eligible_filters]}",
        flush=True,
    )

    return eligible_filters


def build_native_filter_option_form_data(
    dashboard: Dashboard,
    filter_config: dict[str, Any],
) -> dict[str, Any] | None:
    """Build form data for a native filter option query."""
    target = _get_filter_target(filter_config)
    if target is None:
        logger.warning(
            "Native filter %s on dashboard %s has no valid target; skipping",
            filter_config.get("id"),
            dashboard.id,
        )
        return None

    dataset_id, column_name = target
    control_values = filter_config.get("controlValues") or {}

    return {
        "datasource": f"{dataset_id}__table",
        "viz_type": "filter_select",
        "type": "NATIVE_FILTER",
        "native_filter_id": filter_config["id"],
        "dashboardId": dashboard.id,
        "groupby": [column_name],
        "adhoc_filters": filter_config.get("adhocFilters", []),
        "extra_filters": [],
        "extra_form_data": {},
        "metrics": ["count"],
        "row_limit": NATIVE_FILTER_DEFAULT_ROW_LIMIT,
        "time_range": NO_FILTER_TIME_RANGE,
        "granularity_sqla": None,
        "showSearch": True,
        "sortAscending": control_values.get("sortAscending", True),
        "sortMetric": filter_config.get("sortMetric", None),
    }


def build_native_filter_option_query_context(
    form_data: dict[str, Any],
) -> QueryContext | None:
    """Build a query context for a native filter option query."""
    datasource = form_data.get("datasource")
    groupby = form_data.get("groupby") or []
    column_name = groupby[0] if groupby else None

    if not datasource or not column_name:
        logger.warning(
            "Invalid native filter option form_data; datasource and groupby are "
            "required"
        )
        return None

    try:
        datasource_id = int(str(datasource).split("__", 1)[0])
    except (TypeError, ValueError):
        logger.warning(
            "Invalid native filter option datasource %r; skipping query context",
            datasource,
        )
        return None

    sort_metric = form_data.get("sortMetric")
    sort_ascending = form_data.get("sortAscending", True)
    metrics = [sort_metric] if sort_metric else []
    orderby = [[sort_metric or column_name, bool(sort_ascending)]]

    payload = {
        "datasource": {
            "id": datasource_id,
            "type": DatasourceType.TABLE,
        },
        "force": False,
        "queries": [
            {
                "groupby": [column_name],
                "filters": form_data.get("adhoc_filters", []),
                "extras": {},
                "metrics": metrics,
                "orderby": orderby,
                "row_limit": form_data.get(
                    "row_limit",
                    NATIVE_FILTER_DEFAULT_ROW_LIMIT,
                ),
                "time_range": form_data.get("time_range", NO_FILTER_TIME_RANGE),
            }
        ],
        "form_data": form_data,
        "result_format": ChartDataResultFormat.JSON,
        "result_type": ChartDataResultType.FULL,
    }

    try:
        print(
            "[DEBUG] Built query context payload for "
            f"datasource={datasource_id} groupby={column_name}",
            flush=True,
        )
        return ChartDataQueryContextSchema().load(payload)
    except (KeyError, ValidationError, ValueError) as ex:
        logger.warning(
            "Unable to build native filter option query context: %s",
            ex,
        )
        return None
