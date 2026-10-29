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

"""Embedded-guest data-query authorization for MCP chart tools.

Chart *resolution* is scoped for guests by the core ``ChartFilter`` (mirroring
``DashboardAccessFilter``). This module handles the remaining MCP-layer concern:
attaching the embedded dashboard context to a chart's data query so the existing
guest ``raise_for_access`` branch authorizes it, exactly as the embedded
dashboard frontend does.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


def is_guest_read() -> bool:
    """True when the current MCP read is an embedded guest's, so the chart tools
    skip the dataset RBAC pre-check: a guest reads via the dashboard context, not
    dataset RBAC, and ``raise_for_access`` remains the real gate."""
    from superset import security_manager

    return security_manager.is_guest_user()


def guest_dashboard_id(chart: Any) -> int | None:
    """Id of a guest-accessible dashboard containing ``chart``, else None (also
    the "is embedded-guest read" signal: None for non-guests)."""
    from superset import security_manager

    if not security_manager.is_guest_user():
        return None
    for dashboard in getattr(chart, "dashboards", None) or []:
        if security_manager.has_guest_access(dashboard):
            return dashboard.id
    return None


def authorize_query(query_context: Any, dashboard_id: int, chart: Any) -> None:
    """Attach the embedded dashboard context so the guest ``raise_for_access``
    branch authorizes the query, and pin ``slice_`` (when unset) so the guest
    payload tamper-guard compares the request against this chart."""
    if getattr(query_context, "slice_", None) is None:
        query_context.slice_ = chart

    form_data = getattr(query_context, "form_data", None)
    if isinstance(form_data, dict):
        form_data["dashboardId"] = dashboard_id
        form_data["slice_id"] = chart.id
        return
    try:
        query_context.form_data = {"dashboardId": dashboard_id, "slice_id": chart.id}
    except (AttributeError, TypeError):
        logger.warning("Could not attach embedded dashboard context to query_context")
