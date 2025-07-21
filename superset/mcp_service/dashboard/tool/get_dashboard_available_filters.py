# Licensed to the Apache Software Foundation (ASF) under one
# ... existing license ...
"""
Get available filters FastMCP tool
"""

import logging

from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.mcp_app import mcp
from superset.mcp_service.model_tools import ModelGetAvailableFiltersTool
from superset.mcp_service.pydantic_schemas.dashboard_schemas import (
    DashboardAvailableFilters,
)

logger = logging.getLogger(__name__)


@mcp.tool
@mcp_auth_hook
def get_dashboard_available_filters() -> DashboardAvailableFilters:
    """
    Get information about available dashboard filters and their operators
    Returns:
        DashboardAvailableFilters
    """
    from superset.daos.dashboard import DashboardDAO

    tool = ModelGetAvailableFiltersTool(
        dao_class=DashboardDAO,
        output_schema=DashboardAvailableFilters,
        logger=logger,
    )
    return tool.run()
