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
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from flask_babel import gettext as _

from superset import db, security_manager
from superset.models.dashboard import Dashboard
from superset.utils import json

logger = logging.getLogger(__name__)

CHART_TYPE = "CHART"


class DashboardFilterStatus(str, Enum):
    APPLIED = "applied"
    NOT_APPLIED = "not_applied"
    NOT_APPLIED_USES_DEFAULT_TO_FIRST_ITEM_PREQUERY = (
        "not_applied_uses_default_to_first_item_prequery"
    )


@dataclass
class DashboardFilterInfo:
    id: str
    name: str
    status: DashboardFilterStatus
    column: str | None = None


@dataclass
class DashboardFilterContext:
    extra_form_data: dict[str, Any] = field(default_factory=dict)
    filters: list[DashboardFilterInfo] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "filters": [
                {
                    "id": f.id,
                    "name": f.name,
                    "status": f.status.value,
                    **({"column": f.column} if f.column else {}),
                }
                for f in self.filters
            ],
        }


def _is_filter_in_scope_for_chart(
    filter_config: dict[str, Any],
    chart_id: int,
    position_json: dict[str, Any],
) -> bool:
    """
    Determines whether a native filter applies to a given chart. When
    chartsInScope is present on the filter config, uses that directly.
    Otherwise falls back to scope.rootPath and scope.excluded with
    the dashboard layout.
    """
    if charts_in_scope := filter_config.get("chartsInScope"):
        return chart_id in charts_in_scope

    scope = filter_config.get("scope", {})
    root_path: list[str] = scope.get("rootPath", [])
    excluded: list[int] = scope.get("excluded", [])

    if chart_id in excluded:
        return False

    chart_layout_item = _find_chart_layout_item(chart_id, position_json)
    if not chart_layout_item:
        return False

    parents: list[str] = chart_layout_item.get("parents", [])
    return any(parent in root_path for parent in parents)


def _find_chart_layout_item(
    chart_id: int,
    position_json: dict[str, Any],
) -> dict[str, Any] | None:
    """Find the layout item for a chart in the dashboard position JSON."""
    for item in position_json.values():
        if not isinstance(item, dict):
            continue
        if (
            item.get("type") == CHART_TYPE
            and item.get("meta", {}).get("chartId") == chart_id
        ):
            return item
    return None


def _merge_extra_form_data(
    base: dict[str, Any],
    new: dict[str, Any],
) -> dict[str, Any]:
    """
    Merge two extra_form_data dicts, appending list-type keys (like filters,
    adhoc_filters) and overriding scalar keys (like granularity_sqla, time_range).
    """
    append_keys = {"filters", "adhoc_filters", "custom_form_data"}
    override_keys = {
        "granularity_sqla",
        "time_grain_sqla",
        "time_range",
        "druid_time_origin",
        "time_column",
        "time_grain",
    }

    merged: dict[str, Any] = {}

    for key in append_keys:
        base_val = base.get(key, [])
        new_val = new.get(key, [])
        combined = list(base_val) + list(new_val)
        if combined:
            merged[key] = combined

    for key in override_keys:
        if key in new:
            merged[key] = new[key]
        elif key in base:
            merged[key] = base[key]

    return merged


def _extract_filter_extra_form_data(
    filter_config: dict[str, Any],
) -> tuple[dict[str, Any] | None, DashboardFilterStatus]:
    """
    Extract extra_form_data from a native filter's defaultDataMask.

    Mirrors frontend dashboard behavior except for defaultToFirstItem
    filters: filters with a static default contribute their
    extraFormData to the query. Filters without a default or with
    defaultToFirstItem set to True are simply not applied.

    Returns (extra_form_data, status).
    """
    default_data_mask = filter_config.get("defaultDataMask", {})
    control_values = filter_config.get("controlValues", {})

    extra_form_data = default_data_mask.get("extraFormData")
    filter_state = default_data_mask.get("filterState", {})
    has_static_default = filter_state.get("value") is not None

    if control_values.get("defaultToFirstItem"):
        return (
            None,
            DashboardFilterStatus.NOT_APPLIED_USES_DEFAULT_TO_FIRST_ITEM_PREQUERY,
        )

    if has_static_default and extra_form_data:
        return extra_form_data, DashboardFilterStatus.APPLIED

    return None, DashboardFilterStatus.NOT_APPLIED


def _get_filter_target_column(filter_config: dict[str, Any]) -> str | None:
    """Extract the target column name from a native filter configuration."""
    if targets := filter_config.get("targets", []):
        column = targets[0].get("column", {})
        if isinstance(column, dict):
            return column.get("name")
        if isinstance(column, str):
            return column
    return None


def _validate_chart_on_dashboard(
    dashboard: Dashboard,
    chart_id: int,
) -> None:
    """
    Validate that a chart belongs to a dashboard.

    :raises ValueError: if the chart is not found on the dashboard
    """
    slice_ids = {slc.id for slc in dashboard.slices}
    if chart_id not in slice_ids:
        raise ValueError(
            _(
                "Chart %(chart_id)s is not on dashboard %(dashboard_id)s",
                chart_id=chart_id,
                dashboard_id=dashboard.id,
            )
        )


def _check_dashboard_access(dashboard: Dashboard) -> None:
    """
    Check that the user has access to the dashboard.
    Uses the security manager's raise_for_access which handles
    guest users, admins, owners, and DASHBOARD_RBAC.

    :raises SupersetSecurityException: if the user cannot access the dashboard
    """
    security_manager.raise_for_access(dashboard=dashboard)


def get_dashboard_filter_context(
    dashboard_id: int,
    chart_id: int,
) -> DashboardFilterContext:
    """
    Build a DashboardFilterContext for a chart on a dashboard.

    Loads the dashboard's native filter configuration, determines which
    filters are in scope for the given chart, extracts default filter values,
    and returns the merged extra_form_data along with metadata about each filter.

    :param dashboard_id: The ID of the dashboard
    :param chart_id: The ID of the chart
    :returns: DashboardFilterContext with merged extra_form_data and filter metadata
    :raises ValueError: if dashboard not found or chart not on dashboard
    :raises SupersetSecurityException: if the user cannot access the dashboard
    """
    dashboard = db.session.query(Dashboard).filter_by(id=dashboard_id).one_or_none()
    if not dashboard:
        raise ValueError(
            _("Dashboard %(dashboard_id)s not found", dashboard_id=dashboard_id)
        )

    _check_dashboard_access(dashboard)
    _validate_chart_on_dashboard(dashboard, chart_id)

    metadata = json.loads(dashboard.json_metadata or "{}")
    native_filter_config: list[dict[str, Any]] = metadata.get(
        "native_filter_configuration", []
    )

    position_json: dict[str, Any] = json.loads(dashboard.position_json or "{}")

    context = DashboardFilterContext()

    for flt in native_filter_config:
        flt_type = flt.get("type", "")
        if flt_type == "DIVIDER":
            continue

        flt_id = flt.get("id", "")
        flt_name = flt.get("name", "")

        if not _is_filter_in_scope_for_chart(flt, chart_id, position_json):
            continue

        target_column = _get_filter_target_column(flt)
        extra_form_data, status = _extract_filter_extra_form_data(flt)

        if extra_form_data and status == DashboardFilterStatus.APPLIED:
            context.extra_form_data = _merge_extra_form_data(
                context.extra_form_data, extra_form_data
            )

        context.filters.append(
            DashboardFilterInfo(
                id=flt_id,
                name=flt_name,
                status=status,
                column=target_column,
            )
        )

    return context
