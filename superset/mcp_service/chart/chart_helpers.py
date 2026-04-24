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
Shared helper functions for MCP chart tools.

This module contains reusable utility functions for common operations
across chart tools: chart lookup, cached form data retrieval, and
URL parameter extraction. Config mapping logic lives in chart_utils.py.
"""

from __future__ import annotations

import logging
from typing import Any, TYPE_CHECKING
from urllib.parse import parse_qs, urlparse

if TYPE_CHECKING:
    from superset.mcp_service.chart.schemas import AppliedDashboardFilter
    from superset.models.slice import Slice

logger = logging.getLogger(__name__)


class ChartNotOnDashboardError(ValueError):
    """Raised when a chart is not part of the given dashboard's slices."""


def find_chart_by_identifier(identifier: int | str) -> Slice | None:
    """Find a chart by numeric ID or UUID string.

    Accepts an integer ID, a string that looks like a digit (e.g. "123"),
    or a UUID string. Returns the Slice model instance or None.
    """
    from superset.daos.chart import ChartDAO  # avoid circular import

    if isinstance(identifier, int) or (
        isinstance(identifier, str) and identifier.isdigit()
    ):
        chart_id = int(identifier) if isinstance(identifier, str) else identifier
        return ChartDAO.find_by_id(chart_id)
    return ChartDAO.find_by_id(identifier, id_column="uuid")


def get_cached_form_data(form_data_key: str) -> str | None:
    """Retrieve form_data from cache using form_data_key.

    Returns the JSON string of form_data if found, None otherwise.
    """
    # avoid circular import — commands depend on app initialization
    from superset.commands.exceptions import CommandException
    from superset.commands.explore.form_data.get import GetFormDataCommand
    from superset.commands.explore.form_data.parameters import CommandParameters

    try:
        cmd_params = CommandParameters(key=form_data_key)
        return GetFormDataCommand(cmd_params).run()
    except (KeyError, ValueError, CommandException) as e:
        logger.warning("Failed to retrieve form_data from cache: %s", e)
        return None


def extract_form_data_key_from_url(url: str | None) -> str | None:
    """Extract the form_data_key query parameter from an explore URL.

    Returns the form_data_key value or None if not found or URL is empty.
    """
    if not url:
        return None
    parsed = urlparse(url)
    values = parse_qs(parsed.query).get("form_data_key", [])
    return values[0] if values else None


def _match_adhoc_by_subject(
    adhoc_filters: Any, column: str | None
) -> tuple[str | None, Any] | None:
    if not column or not isinstance(adhoc_filters, list):
        return None
    for af in adhoc_filters:
        if isinstance(af, dict) and af.get("subject") == column:
            return af.get("operator"), af.get("comparator")
    return None


def _match_legacy_by_col(
    legacy_filters: Any, column: str | None
) -> tuple[str | None, Any] | None:
    if not column or not isinstance(legacy_filters, list):
        return None
    for f in legacy_filters:
        if isinstance(f, dict) and f.get("col") == column:
            return f.get("op"), f.get("val")
    return None


def _resolve_filter_operator_and_value(
    extra_form_data: dict[str, Any] | None,
    column: str | None,
) -> tuple[str | None, Any]:
    """Pull operator and value for a dashboard filter from its
    default extra_form_data, matching on target column where applicable."""
    if not extra_form_data:
        return None, None

    if match := _match_adhoc_by_subject(extra_form_data.get("adhoc_filters"), column):
        return match
    if match := _match_legacy_by_col(extra_form_data.get("filters"), column):
        return match
    # Temporal filters contribute time_range with no target column
    if time_range := extra_form_data.get("time_range"):
        return "TIME_RANGE", time_range
    return None, None


def build_applied_dashboard_filters(
    dashboard_id: int, chart_id: int
) -> list[AppliedDashboardFilter]:
    """Resolve dashboard-level native filters in scope for a chart.

    Validates that the dashboard exists, the caller has access, and the chart
    is on the dashboard. Returns one AppliedDashboardFilter per non-DIVIDER
    native filter whose scope includes the chart, populated with the filter's
    default operator and value.

    Raises DashboardNotFoundError if the dashboard is missing,
    ChartNotOnDashboardError if the chart is not on it, and
    SupersetSecurityException if the caller cannot access the dashboard.
    """
    # Local imports avoid circular deps at module load
    from superset import db, security_manager
    from superset.charts.data.dashboard_filter_context import (
        _extract_filter_extra_form_data,
        _get_filter_target_column,
        _is_filter_in_scope_for_chart,
    )
    from superset.commands.dashboard.exceptions import DashboardNotFoundError
    from superset.mcp_service.chart.schemas import AppliedDashboardFilter
    from superset.models.dashboard import Dashboard
    from superset.utils import json

    dashboard = db.session.query(Dashboard).filter_by(id=dashboard_id).one_or_none()
    if not dashboard:
        raise DashboardNotFoundError(dashboard_id=str(dashboard_id))

    security_manager.raise_for_access(dashboard=dashboard)

    slice_ids = {slc.id for slc in dashboard.slices}
    if chart_id not in slice_ids:
        raise ChartNotOnDashboardError(
            f"Chart {chart_id} is not on dashboard {dashboard_id}"
        )

    metadata = json.loads(dashboard.json_metadata or "{}")
    native_filter_config = metadata.get("native_filter_configuration", [])
    if not isinstance(native_filter_config, list):
        return []
    position_json = json.loads(dashboard.position_json or "{}")
    if not isinstance(position_json, dict):
        position_json = {}

    applied: list[AppliedDashboardFilter] = []
    for flt in native_filter_config:
        if not isinstance(flt, dict):
            continue
        if flt.get("type", "") == "DIVIDER":
            continue
        if not _is_filter_in_scope_for_chart(flt, chart_id, position_json):
            continue

        extra_form_data, status = _extract_filter_extra_form_data(flt)
        column = _get_filter_target_column(flt)
        operator, value = _resolve_filter_operator_and_value(extra_form_data, column)

        applied.append(
            AppliedDashboardFilter(
                id=flt.get("id"),
                name=flt.get("name"),
                filter_type=flt.get("filterType"),
                column=column,
                operator=operator,
                value=value,
                status=status.value,
            )
        )

    return applied
