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

"""Host implementations of the `superset_core.exports` chart-query functions."""

from __future__ import annotations

from typing import Any

from marshmallow import ValidationError
from superset_core.exports.types import ChartQueryResult, GenericDataType

from superset import is_feature_enabled, security_manager
from superset.charts.client_processing import apply_client_processing
from superset.charts.schemas import ChartDataQueryContextSchema
from superset.commands.chart.data.get_data_command import ChartDataCommand
from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.common.query_context_factory import QueryContextFactory
from superset.daos.dashboard import DashboardDAO
from superset.exceptions import SupersetSecurityException

# Result types whose queries return rows; the rest return SQL or metadata.
ROW_RESULT_TYPES = frozenset(
    {
        ChartDataResultType.FULL,
        ChartDataResultType.RESULTS,
        ChartDataResultType.POST_PROCESSED,
        ChartDataResultType.SAMPLES,
        ChartDataResultType.DRILL_DETAIL,
    }
)


def _requested_result_types(payload: dict[str, Any]) -> set[str]:
    """Collect the context-level and per-query result types a payload asks for."""
    requested = {str(payload.get("result_type") or ChartDataResultType.FULL)}
    for query in payload.get("queries") or []:
        if isinstance(query, dict) and query.get("result_type"):
            requested.add(str(query["result_type"]))
    return requested


def _coltype(value: Any) -> GenericDataType:
    """Map a host column type to the core enum; unknown types read as strings."""
    try:
        return GenericDataType(value)
    except ValueError:
        return GenericDataType.STRING


def run_query_context(payload: dict[str, Any]) -> list[ChartQueryResult]:
    """
    Run a chart-data payload as the current user, always as JSON rows.

    :raises SupersetSecurityException: If the user may not access the datasource
    :raises ValidationError: If the payload is malformed
    :raises ValueError: If a result type carries no row data
    """
    if unsupported := sorted(_requested_result_types(payload) - ROW_RESULT_TYPES):
        raise ValueError(
            f"Result type {', '.join(unsupported)} returns no rows; use one of "
            f"{', '.join(sorted(ROW_RESULT_TYPES))}"
        )
    # Rows are read from JSON results, whatever format the payload asks for.
    payload = {**payload, "result_format": ChartDataResultFormat.JSON}
    schema: ChartDataQueryContextSchema = ChartDataQueryContextSchema()
    schema.query_context_factory = QueryContextFactory(
        authorize_semantic_before_metadata=True
    )
    try:
        query_context = schema.load(payload)
    except KeyError as ex:
        raise ValidationError("Request is incorrect") from ex
    except ValueError as ex:
        raise ValidationError(str(ex)) from ex

    command = ChartDataCommand(query_context)
    command.validate()
    result = command.run()

    if query_context.result_type == ChartDataResultType.POST_PROCESSED:
        result = apply_client_processing(
            result, payload.get("form_data") or {}, query_context.datasource
        )

    return [
        ChartQueryResult(
            colnames=query.get("colnames") or [],
            coltypes=[_coltype(t) for t in query.get("coltypes") or []],
            data=query.get("data") or [],
        )
        for query in result["queries"]
    ]


def can_export_data() -> bool:
    """Whether the current user may export chart data as a file."""
    if is_feature_enabled("GRANULAR_EXPORT_CONTROLS"):
        return security_manager.can_access("can_export_data", "Superset")
    return security_manager.can_access("can_csv", "Superset")


def can_export_dashboard(dashboard_id: int) -> bool:
    """Whether the current user may export the dashboard; False if it is missing."""
    dashboard = DashboardDAO.find_by_id(dashboard_id)
    if dashboard is None:
        return False
    try:
        security_manager.raise_for_access(dashboard=dashboard)
    except SupersetSecurityException:
        return False
    return security_manager.can_access("can_export", "Dashboard")
