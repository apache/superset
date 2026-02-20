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
Get instance high-level information FastMCP tool using configurable
InstanceInfoCore for flexible, extensible metrics calculation.
"""

import logging

from fastmcp import Context
from superset_core.mcp import tool

from superset.extensions import event_logger
from superset.mcp_service.mcp_core import InstanceInfoCore
from superset.mcp_service.system.schemas import (
    GetSupersetInstanceInfoRequest,
    InstanceInfo,
    UserInfo,
)
from superset.mcp_service.system.system_utils import (
    calculate_dashboard_breakdown,
    calculate_database_breakdown,
    calculate_instance_summary,
    calculate_popular_content,
    calculate_recent_activity,
)
from superset.mcp_service.utils.schema_utils import parse_request

logger = logging.getLogger(__name__)


# Configure the instance info core
_instance_info_core = InstanceInfoCore(
    dao_classes={
        "dashboards": None,  # type: ignore[dict-item]  # Will be set at runtime
        "charts": None,  # type: ignore[dict-item]
        "datasets": None,  # type: ignore[dict-item]
        "databases": None,  # type: ignore[dict-item]
        "users": None,  # type: ignore[dict-item]
        "tags": None,  # type: ignore[dict-item]
    },
    output_schema=InstanceInfo,
    metric_calculators={
        "instance_summary": calculate_instance_summary,
        "recent_activity": calculate_recent_activity,
        "dashboard_breakdown": calculate_dashboard_breakdown,
        "database_breakdown": calculate_database_breakdown,
        "popular_content": calculate_popular_content,
    },
    time_windows={
        "recent": 7,
        "monthly": 30,
        "quarterly": 90,
    },
    logger=logger,
)


@tool(tags=["core"])
@parse_request(GetSupersetInstanceInfoRequest)
def get_instance_info(
    request: GetSupersetInstanceInfoRequest, ctx: Context
) -> InstanceInfo:
    """Get instance statistics.

    Returns counts, activity metrics, and database types.
    """
    try:
        # Import DAOs at runtime to avoid circular imports
        from flask import g

        from superset.daos.chart import ChartDAO
        from superset.daos.dashboard import DashboardDAO
        from superset.daos.database import DatabaseDAO
        from superset.daos.dataset import DatasetDAO
        from superset.daos.tag import TagDAO
        from superset.daos.user import UserDAO

        # Configure DAO classes at runtime
        _instance_info_core.dao_classes = {
            "dashboards": DashboardDAO,
            "charts": ChartDAO,
            "datasets": DatasetDAO,
            "databases": DatabaseDAO,
            "users": UserDAO,
            "tags": TagDAO,
        }

        # Run the configurable core
        with event_logger.log_context(action="mcp.get_instance_info.metrics"):
            result = _instance_info_core.run_tool()

        # Attach the authenticated user's identity to the response
        user = getattr(g, "user", None)
        if user is not None:
            result.current_user = UserInfo(
                id=getattr(user, "id", None),
                username=getattr(user, "username", None),
                first_name=getattr(user, "first_name", None),
                last_name=getattr(user, "last_name", None),
                email=getattr(user, "email", None),
            )

        return result

    except Exception as e:
        error_msg = f"Unexpected error in instance info: {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise
