# Licensed to the Apache Software Foundation (ASF) under one
# ... existing license ...
"""
Get available filters FastMCP tool
"""

import logging

from fastmcp import Context

from superset.mcp_service.app import mcp
from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.dashboard.schemas import (
    DashboardAvailableFilters,
    GetDashboardAvailableFiltersRequest,
)
from superset.mcp_service.mcp_core import ModelGetAvailableFiltersCore

logger = logging.getLogger(__name__)


@mcp.tool
@mcp_auth_hook
def get_dashboard_available_filters(
    request: GetDashboardAvailableFiltersRequest, ctx: Context
) -> DashboardAvailableFilters:
    """
    Get information about available dashboard filters and their operators
    Returns:
        DashboardAvailableFilters
    """
    from superset.daos.dashboard import DashboardDAO

    tool = ModelGetAvailableFiltersCore(
        dao_class=DashboardDAO,  # type: ignore[arg-type]
        output_schema=DashboardAvailableFilters,
        logger=logger,
    )
    return tool.run_tool()
