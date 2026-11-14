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
"""Describe a dashboard export (title, permalink, filters, chart links)."""

from __future__ import annotations

from typing import Any

from superset_core.exports.types import AppliedFilter, DashboardExportInfo

from superset import security_manager
from superset.charts.data.dashboard_filter_context import (
    _resolve_filter_extra_form_data,
    DashboardFilterStatus,
)
from superset.commands.dashboard.exceptions import DashboardNotFoundError
from superset.commands.dashboard.permalink.create import (
    CreateDashboardPermalinkCommand,
)
from superset.daos.dashboard import DashboardDAO
from superset.dashboards.excel_export.layout import get_charts_in_layout_order
from superset.utils.urls import get_url_path


def _is_empty(value: Any) -> bool:
    return value is None or value == [] or value == ""


def _display_value(filter_state: dict[str, Any]) -> str:
    label = filter_state.get("label")
    if isinstance(label, str) and label:
        return label
    value = filter_state["value"]
    if isinstance(value, list):
        return ", ".join(str(item) for item in value)
    return str(value)


def describe_dashboard_export(
    dashboard_id: int, active_data_mask: dict[str, Any]
) -> DashboardExportInfo:
    """
    Describe a dashboard export for an extension's "About" tab.

    Raises DashboardNotFoundError for a missing dashboard and
    SupersetSecurityException when the current user cannot access it.
    """
    dashboard = DashboardDAO.find_by_id(dashboard_id)
    if dashboard is None:
        raise DashboardNotFoundError(str(dashboard_id))
    security_manager.raise_for_access(dashboard=dashboard)

    key = CreateDashboardPermalinkCommand(
        dashboard_id=str(dashboard_id), state={"dataMask": active_data_mask}
    ).run()
    permalink_url = get_url_path(
        "Superset.dashboard_permalink", user_friendly=True, key=key
    )

    charts = get_charts_in_layout_order(dashboard)
    native_filters = {
        config["id"]: config
        for config in dashboard.params_dict.get("native_filter_configuration", [])
        if "id" in config and "name" in config
    }

    applied_filters: list[AppliedFilter] = []
    # Exports apply native filters only, so cross-filters are not listed.
    for filter_id in sorted(native_filters):
        config = native_filters[filter_id]
        if filter_id in active_data_mask:
            entry = active_data_mask[filter_id]
            # The mask is client-supplied, so entries of the wrong shape are skipped.
            if not isinstance(entry, dict):
                continue
        else:
            entry = config.get("defaultDataMask")
        # Execution's resolver decides whether the filter was applied.
        _, status = _resolve_filter_extra_form_data(config, active_data_mask)
        if status != DashboardFilterStatus.APPLIED:
            continue
        filter_state = entry.get("filterState") if isinstance(entry, dict) else None
        if not isinstance(filter_state, dict) or _is_empty(filter_state.get("value")):
            continue
        applied_filters.append(
            AppliedFilter(config["name"], _display_value(filter_state))
        )

    return DashboardExportInfo(
        title=dashboard.dashboard_title,
        permalink_url=permalink_url,
        applied_filters=applied_filters,
        chart_urls={
            chart.id: get_url_path(
                "ExploreView.root", user_friendly=True, slice_id=chart.id
            )
            for chart in charts
        },
    )
