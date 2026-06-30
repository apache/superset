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
from typing import Any, Final

from marshmallow import ValidationError

from superset.charts.schemas import ChartDataQueryContextSchema
from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.common.query_context import QueryContext
from superset.models.dashboard import Dashboard
from superset.utils import json
from superset.utils.core import DatasourceType, split_adhoc_filters_into_base_filters

logger: logging.Logger = logging.getLogger(__name__)

NATIVE_FILTER_DEFAULT_ROW_LIMIT: Final[int] = 1000
NO_FILTER_TIME_RANGE: Final[str] = "No filter"


def _resolve_datasource_engine(datasource_id: int) -> str:
    """Return the datasource engine name, or ``"base"`` if it cannot be resolved."""
    try:
        # pylint: disable=import-outside-toplevel
        from superset.daos.datasource import DatasourceDAO

        datasource: Any = DatasourceDAO.get_datasource(
            datasource_type=DatasourceType.TABLE,
            database_id_or_uuid=datasource_id,
        )
        return datasource.database.db_engine_spec.engine
    except Exception:  # noqa: BLE001
        logger.debug("Could not resolve engine for datasource %s", datasource_id)
        return "base"


def _get_filter_target(filter_config: dict[str, Any]) -> tuple[int | str, str] | None:
    for target in filter_config.get("targets") or []:
        if not isinstance(target, dict):
            continue

        dataset_id: Any = target.get("datasetId")
        column: Any = target.get("column") or {}
        column_name: str | None = (
            column.get("name") if isinstance(column, dict) else None
        )

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
        metadata: dict[str, Any] = json.loads(dashboard.json_metadata)
    except (TypeError, ValueError):
        logger.warning(
            "Dashboard %s has malformed json_metadata; skipping native filter warm-up",
            dashboard.id,
        )
        return []

    native_filter_config: Any = metadata.get("native_filter_configuration")
    if not isinstance(native_filter_config, list):
        logger.warning(
            "Dashboard %s has no native_filter_configuration; skipping native "
            "filter warm-up",
            dashboard.id,
        )
        return []

    logger.debug(
        "Dashboard %s native_filter_configuration count: %s",
        dashboard.id,
        len(native_filter_config),
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

    logger.debug(
        "Dashboard %s eligible filters: %s",
        dashboard.id,
        [filter_config.get("id") for filter_config in eligible_filters],
    )

    return eligible_filters


def build_native_filter_option_form_data(
    dashboard: Dashboard,
    filter_config: dict[str, Any],
) -> dict[str, Any] | None:
    """Build form data for a native filter option query."""
    target: tuple[int | str, str] | None = _get_filter_target(filter_config)
    if target is None:
        logger.warning(
            "Native filter %s on dashboard %s has no valid target; skipping",
            filter_config.get("id"),
            dashboard.id,
        )
        return None

    dataset_id: int | str
    column_name: str
    dataset_id, column_name = target
    control_values: dict[str, Any] = filter_config.get("controlValues") or {}

    return {
        "datasource": f"{dataset_id}__table",
        "viz_type": "filter_select",
        "type": "NATIVE_FILTER",
        "native_filter_id": filter_config["id"],
        "dashboardId": dashboard.id,
        "groupby": [column_name],
        "adhoc_filters": filter_config.get("adhoc_filters", []),
        "extra_filters": [],
        "extra_form_data": {},
        "metrics": ["count"],
        "row_limit": NATIVE_FILTER_DEFAULT_ROW_LIMIT,
        "time_range": filter_config.get("time_range") or NO_FILTER_TIME_RANGE,
        "granularity_sqla": filter_config.get("granularity_sqla"),
        "showSearch": True,
        "sortAscending": control_values.get("sortAscending", True),
        "sortMetric": filter_config.get("sortMetric", None),
    }


def build_native_filter_option_query_context(
    form_data: dict[str, Any],
) -> QueryContext | None:
    """Build a query context for a native filter option query."""
    datasource: Any = form_data.get("datasource")
    groupby: Any = form_data.get("groupby") or []
    column_name: str | None = (
        groupby[0]
        if isinstance(groupby, list) and groupby and isinstance(groupby[0], str)
        else None
    )

    if not datasource or not column_name:
        logger.warning(
            "Invalid native filter option form_data; datasource and groupby are "
            "required"
        )
        return None

    try:
        datasource_id: int = int(str(datasource).split("__", 1)[0])
    except (TypeError, ValueError):
        logger.warning(
            "Invalid native filter option datasource %r; skipping query context",
            datasource,
        )
        return None

    sort_metric: str | None = form_data.get("sortMetric")
    sort_ascending: bool = form_data.get("sortAscending", True)
    metrics: list[str] = [sort_metric] if sort_metric else []
    orderby: list[list[str | bool]] = [
        [sort_metric or column_name, bool(sort_ascending)]
    ]
    adhoc_filters: list[Any] = form_data.get("adhoc_filters") or []
    has_sql_filter: bool = any(
        isinstance(filter_, dict) and filter_.get("expressionType") == "SQL"
        for filter_ in adhoc_filters
    )
    engine: str = (
        _resolve_datasource_engine(datasource_id) if has_sql_filter else "base"
    )
    split_adhoc_filters_into_base_filters(form_data, engine)

    payload: dict[str, Any] = {
        "datasource": {
            "id": datasource_id,
            "type": DatasourceType.TABLE,
        },
        "force": False,
        "queries": [
            {
                "groupby": [column_name],
                "filters": form_data.get("filters", []),
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
        logger.debug(
            "Built query context payload for datasource=%s groupby=%s",
            datasource_id,
            column_name,
        )
        return ChartDataQueryContextSchema().load(payload)
    except (KeyError, ValidationError, ValueError) as ex:
        logger.warning(
            "Unable to build native filter option query context: %s",
            ex,
        )
        return None
