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
Get dashboard info FastMCP tool

This module contains the FastMCP tool for getting detailed information
about a specific dashboard.
"""

import logging
from typing import Any

from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.chart.schemas import serialize_chart_object
from superset.mcp_service.dashboard.schemas import (
    DashboardError,
    DashboardInfo,
    GetDashboardInfoRequest,
)
from superset.mcp_service.mcp_app import mcp
from superset.mcp_service.mcp_core import ModelGetInfoCore
from superset.mcp_service.system.schemas import (
    RoleInfo,
    TagInfo,
    UserInfo,
)

logger = logging.getLogger(__name__)


def dashboard_serializer(dashboard: Any) -> DashboardInfo:
    return DashboardInfo(
        id=dashboard.id,
        dashboard_title=dashboard.dashboard_title or "Untitled",
        slug=dashboard.slug or "",
        description=dashboard.description,
        css=dashboard.css,
        certified_by=dashboard.certified_by,
        certification_details=dashboard.certification_details,
        json_metadata=dashboard.json_metadata,
        position_json=dashboard.position_json,
        published=dashboard.published,
        is_managed_externally=dashboard.is_managed_externally,
        external_url=dashboard.external_url,
        created_on=dashboard.created_on,
        changed_on=dashboard.changed_on,
        created_by=getattr(dashboard.created_by, "username", None)
        if dashboard.created_by
        else None,
        changed_by=getattr(dashboard.changed_by, "username", None)
        if dashboard.changed_by
        else None,
        uuid=str(dashboard.uuid) if dashboard.uuid else None,
        url=dashboard.url,
        thumbnail_url=dashboard.thumbnail_url,
        created_on_humanized=dashboard.created_on_humanized,
        changed_on_humanized=dashboard.changed_on_humanized,
        chart_count=len(dashboard.slices) if dashboard.slices else 0,
        owners=[
            UserInfo.model_validate(owner, from_attributes=True)
            for owner in dashboard.owners
        ]
        if dashboard.owners
        else [],
        tags=[
            TagInfo.model_validate(tag, from_attributes=True) for tag in dashboard.tags
        ]
        if dashboard.tags
        else [],
        roles=[
            RoleInfo.model_validate(role, from_attributes=True)
            for role in dashboard.roles
        ]
        if dashboard.roles
        else [],
        charts=[serialize_chart_object(chart) for chart in dashboard.slices]
        if dashboard.slices
        else [],
    )


@mcp.tool
@mcp_auth_hook
def get_dashboard_info(
    request: GetDashboardInfoRequest,
) -> DashboardInfo | DashboardError:
    """
    Get detailed information about a specific dashboard with metadata cache control.

    Supports lookup by:
    - Numeric ID (e.g., 123)
    - UUID string (e.g., "a1b2c3d4-e5f6-7890-abcd-ef1234567890")
    - Slug string (e.g., "my-dashboard")

    Metadata Cache Control:
    - use_cache: Whether to use metadata cache for faster responses
    - refresh_metadata: Force refresh of metadata cache for fresh data

    Returns a DashboardInfo model or DashboardError on error.
    """

    from superset.daos.dashboard import DashboardDAO

    tool = ModelGetInfoCore(
        dao_class=DashboardDAO,  # type: ignore[arg-type]
        output_schema=DashboardInfo,
        error_schema=DashboardError,
        serializer=dashboard_serializer,
        supports_slug=True,  # Dashboards support slugs
        logger=logger,
    )
    return tool.run_tool(request.identifier)
