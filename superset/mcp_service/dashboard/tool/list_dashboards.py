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
List dashboards FastMCP tool (Advanced with clear request schema)

This module contains the FastMCP tool for listing dashboards using
advanced filtering with clear, unambiguous request schema.
"""

import logging
from typing import Any

from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.mcp_app import mcp
from superset.mcp_service.model_tools import ModelListTool
from superset.mcp_service.pydantic_schemas import (
    DashboardFilter,
    DashboardInfo,
    DashboardList,
)
from superset.mcp_service.pydantic_schemas.chart_schemas import serialize_chart_object
from superset.mcp_service.pydantic_schemas.dashboard_schemas import (
    ListDashboardsRequest,
)

logger = logging.getLogger(__name__)


def serialize_dashboard_object(dashboard: Any) -> DashboardInfo:
    """Simple dashboard serializer that safely handles object attributes."""
    return DashboardInfo(
        id=getattr(dashboard, "id", None),
        dashboard_title=getattr(dashboard, "dashboard_title", None),
        slug=getattr(dashboard, "slug", None),
        url=getattr(dashboard, "url", None),
        published=getattr(dashboard, "published", None),
        changed_by_name=getattr(dashboard, "changed_by_name", None),
        changed_on=getattr(dashboard, "changed_on", None),
        changed_on_humanized=getattr(dashboard, "changed_on_humanized", None),
        created_by_name=getattr(dashboard, "created_by_name", None),
        created_on=getattr(dashboard, "created_on", None),
        created_on_humanized=getattr(dashboard, "created_on_humanized", None),
        description=getattr(dashboard, "description", None),
        css=getattr(dashboard, "css", None),
        certified_by=getattr(dashboard, "certified_by", None),
        certification_details=getattr(dashboard, "certification_details", None),
        json_metadata=getattr(dashboard, "json_metadata", None),
        position_json=getattr(dashboard, "position_json", None),
        is_managed_externally=getattr(dashboard, "is_managed_externally", None),
        external_url=getattr(dashboard, "external_url", None),
        uuid=str(getattr(dashboard, "uuid", ""))
        if getattr(dashboard, "uuid", None)
        else None,
        thumbnail_url=getattr(dashboard, "thumbnail_url", None),
        chart_count=len(getattr(dashboard, "slices", [])),
        owners=getattr(dashboard, "owners", []),
        tags=getattr(dashboard, "tags", []),
        roles=getattr(dashboard, "roles", []),
        charts=[
            serialize_chart_object(chart) for chart in getattr(dashboard, "slices", [])
        ]
        if getattr(dashboard, "slices", None)
        else [],
    )


DEFAULT_DASHBOARD_COLUMNS = [
    "id",
    "dashboard_title",
    "slug",
    "published",
    "changed_on",
    "created_on",
]


@mcp.tool
@mcp_auth_hook
def list_dashboards(request: ListDashboardsRequest) -> DashboardList:
    """
    List dashboards with advanced filtering, search, and column selection.

    Uses a clear request object schema to avoid validation ambiguity with
    arrays/strings.
    All parameters are properly typed and have sensible defaults.
    """

    from superset.daos.dashboard import DashboardDAO

    tool = ModelListTool(
        dao_class=DashboardDAO,
        output_schema=DashboardInfo,
        item_serializer=lambda obj, cols: serialize_dashboard_object(obj),
        filter_type=DashboardFilter,
        default_columns=DEFAULT_DASHBOARD_COLUMNS,
        search_columns=[
            "dashboard_title",
            "owners",
            "published",
            "roles",
            "slug",
            "tags",
            "uuid",
        ],
        list_field_name="dashboards",
        output_list_schema=DashboardList,
        logger=logger,
    )
    return tool.run(
        filters=request.filters,
        search=request.search,
        select_columns=request.select_columns,
        order_column=request.order_column,
        order_direction=request.order_direction,
        page=max(request.page - 1, 0),
        page_size=request.page_size,
    )
