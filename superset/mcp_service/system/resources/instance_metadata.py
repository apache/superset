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
System resources for providing Superset configuration and stats
"""

import logging

from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.mcp_app import mcp

logger = logging.getLogger(__name__)


@mcp.resource("superset://instance/metadata")
@mcp_auth_hook
async def get_instance_metadata_resource() -> str:
    """
    Provide comprehensive metadata about the Superset instance.

    This resource gives LLMs context about:
    - Available datasets and their popularity
    - Dashboard and chart statistics
    - Database connections
    - Popular queries and usage patterns
    - Available visualization types
    - Feature flags and configuration
    """
    try:
        # Import the shared core and DAOs at runtime
        # Create a shared core instance for the resource
        from typing import cast, Type

        from superset.daos.chart import ChartDAO
        from superset.daos.dashboard import DashboardDAO
        from superset.daos.database import DatabaseDAO
        from superset.daos.dataset import DatasetDAO
        from superset.daos.tag import TagDAO
        from superset.daos.user import UserDAO
        from superset.mcp_service.dao.base import DAO
        from superset.mcp_service.mcp_core import InstanceInfoCore
        from superset.mcp_service.system.schemas import InstanceInfo
        from superset.mcp_service.system.tool.get_superset_instance_info import (
            calculate_dashboard_breakdown,
            calculate_database_breakdown,
            calculate_instance_summary,
            calculate_popular_content,
            calculate_recent_activity,
        )

        instance_info_core = InstanceInfoCore(
            dao_classes={
                "dashboards": cast(Type[DAO], DashboardDAO),
                "charts": cast(Type[DAO], ChartDAO),
                "datasets": cast(Type[DAO], DatasetDAO),
                "databases": cast(Type[DAO], DatabaseDAO),
                "users": cast(Type[DAO], UserDAO),
                "tags": cast(Type[DAO], TagDAO),
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

        # Use the shared core's resource method
        return instance_info_core.get_resource()

    except Exception as e:
        logger.error("Error generating instance metadata: %s", e)
        # Return minimal metadata on error
        from superset.utils import json

        return json.dumps(
            {
                "error": "Unable to fetch complete metadata",
                "tips": [
                    "Use list_datasets to explore available data",
                    "Use get_superset_instance_info for basic stats",
                ],
            }
        )
