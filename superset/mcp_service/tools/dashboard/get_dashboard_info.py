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
from datetime import datetime, timezone
from typing import Annotated

from pydantic import Field

from superset.daos.dashboard import DashboardDAO
from superset.mcp_service.pydantic_schemas import DashboardError, DashboardInfo
from superset.mcp_service.pydantic_schemas.chart_schemas import serialize_chart_object
from superset.mcp_service.pydantic_schemas.system_schemas import RoleInfo, TagInfo, \
    UserInfo

logger = logging.getLogger(__name__)


def get_dashboard_info(
    dashboard_id: Annotated[
        int,
        Field(description="ID of the dashboard to retrieve information for")
    ]
) -> DashboardInfo | DashboardError:
    """
    Get detailed information about a specific dashboard.
    Returns a DashboardInfo model or DashboardError on error.
    """
    try:
        dashboard = DashboardDAO.find_by_id(dashboard_id)
        if dashboard is None:
            error_data = DashboardError(
                error=f"Dashboard with ID {dashboard_id} not found",
                error_type="not_found",
                timestamp=datetime.now(timezone.utc)
            )
            logger.warning(f"DashboardInfo {dashboard_id} error: not_found - not found")
            return error_data
        response = DashboardInfo(
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
            created_by=getattr(dashboard.created_by, 'username', None) if dashboard.created_by else None,
            changed_by=getattr(dashboard.changed_by, 'username', None) if dashboard.changed_by else None,
            uuid=str(dashboard.uuid) if dashboard.uuid else None,
            url=dashboard.url,
            thumbnail_url=dashboard.thumbnail_url,
            created_on_humanized=dashboard.created_on_humanized,
            changed_on_humanized=dashboard.changed_on_humanized,
            chart_count=len(dashboard.slices) if dashboard.slices else 0,
            owners=[UserInfo.model_validate(owner, from_attributes=True) for owner in dashboard.owners] if dashboard.owners else [],
            tags=[TagInfo.model_validate(tag, from_attributes=True) for tag in dashboard.tags] if dashboard.tags else [],
            roles=[RoleInfo.model_validate(role, from_attributes=True) for role in dashboard.roles] if dashboard.roles else [],
            charts=[serialize_chart_object(chart) for chart in dashboard.slices] if dashboard.slices else []
        )
        logger.info(f"DashboardInfo response created successfully for dashboard {dashboard.id}")
        return response
    except Exception as context_error:
        error_msg = f"Error within Flask app context: {str(context_error)}"
        logger.error(error_msg, exc_info=True)
        raise
    except Exception as e:
        error_msg = f"Unexpected error in get_dashboard_info: {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise
