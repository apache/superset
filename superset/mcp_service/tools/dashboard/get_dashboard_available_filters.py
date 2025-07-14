# Licensed to the Apache Software Foundation (ASF) under one
# ... existing license ...
"""
Get available filters FastMCP tool
"""
import logging
from typing import Any
from superset.mcp_service.pydantic_schemas.dashboard_schemas import DashboardAvailableFilters

logger = logging.getLogger(__name__)

def get_dashboard_available_filters() -> DashboardAvailableFilters:
    """
    Get information about available dashboard filters and their operators
    Returns:
        DashboardAvailableFilters
    """
    try:
        filters = {
            "dashboard_title": {
                "name": "dashboard_title",
                "description": "Filter by dashboard title (partial match)",
                "type": "string",
                "operators": ["sw", "in", "eq"],
                "values": None
            },
            "published": {
                "name": "published",
                "description": "Filter by published status",
                "type": "boolean",
                "operators": ["eq"],
                "values": [True, False]
            },
            "changed_by": {
                "name": "changed_by",
                "description": "Filter by last modifier",
                "type": "string",
                "operators": ["in", "eq"],
                "values": None
            },
            "created_by": {
                "name": "created_by",
                "description": "Filter by creator",
                "type": "string",
                "operators": ["in", "eq"],
                "values": None
            },
            "owner": {
                "name": "owner",
                "description": "Filter by owner",
                "type": "string",
                "operators": ["in", "eq"],
                "values": None
            },
            "certified": {
                "name": "certified",
                "description": "Filter by certification status",
                "type": "boolean",
                "operators": ["eq"],
                "values": [True, False]
            },
            "favorite": {
                "name": "favorite",
                "description": "Filter by favorite status",
                "type": "boolean",
                "operators": ["eq"],
                "values": [True, False]
            },
            "chart_count": {
                "name": "chart_count",
                "description": "Filter by chart count",
                "type": "integer",
                "operators": ["eq", "gte", "lte"],
                "values": None
            },
            "tags": {
                "name": "tags",
                "description": "Filter by tags",
                "type": "string",
                "operators": ["in"],
                "values": None
            }
        }
        operators = ["eq", "ne", "in", "nin", "sw", "ew", "gte", "lte", "gt", "lt"]
        columns = [
            "id", "dashboard_title", "slug", "url", "changed_by", "changed_on",
            "created_by", "created_on", "published", "certified_by",
            "certification_details", "chart_count", "owners", "tags", "is_managed_externally",
            "external_url", "uuid", "version"
        ]
        response = DashboardAvailableFilters(
            filters=filters,
            operators=operators,
            columns=columns
        )
        logger.info("Successfully retrieved available dashboard filters and operators")
        return response
    except Exception as e:
        error_msg = f"Unexpected error in get_dashboard_available_filters: {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise
