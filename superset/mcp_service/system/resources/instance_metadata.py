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
System resources for providing instance configuration and stats.

This resource differs from the get_instance_info tool by also including
available dataset IDs and database IDs, so LLMs can immediately call
get_dataset_info or execute_sql without an extra list call.
"""

import logging

from sqlalchemy.exc import SQLAlchemyError

from superset.mcp_service.app import mcp
from superset.mcp_service.auth import mcp_auth_hook

logger = logging.getLogger(__name__)


@mcp.resource("instance://metadata")
@mcp_auth_hook
def get_instance_metadata_resource() -> str:
    """
    Provide instance metadata with available dataset and database IDs.

    This resource gives LLMs context about:
    - Instance summary stats (counts of dashboards, charts, datasets)
    - Available database connections with their IDs (for execute_sql)
    - Available datasets with IDs and table names (for get_dataset_info)
    - Dashboard and chart statistics
    """
    try:
        from typing import Any, cast, Type

        from superset.daos.base import BaseDAO
        from superset.daos.chart import ChartDAO
        from superset.daos.dashboard import DashboardDAO
        from superset.daos.database import DatabaseDAO
        from superset.daos.dataset import DatasetDAO
        from superset.daos.tag import TagDAO
        from superset.daos.user import UserDAO
        from superset.mcp_service.mcp_core import InstanceInfoCore
        from superset.mcp_service.system.schemas import InstanceInfo
        from superset.mcp_service.system.system_utils import (
            calculate_dashboard_breakdown,
            calculate_database_breakdown,
            calculate_instance_summary,
            calculate_popular_content,
            calculate_recent_activity,
        )
        from superset.utils import json

        instance_info_core = InstanceInfoCore(
            dao_classes={
                "dashboards": cast(Type[BaseDAO[Any]], DashboardDAO),
                "charts": cast(Type[BaseDAO[Any]], ChartDAO),
                "datasets": cast(Type[BaseDAO[Any]], DatasetDAO),
                "databases": cast(Type[BaseDAO[Any]], DatabaseDAO),
                "users": cast(Type[BaseDAO[Any]], UserDAO),
                "tags": cast(Type[BaseDAO[Any]], TagDAO),
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

        # Get base instance info
        base_result = json.loads(instance_info_core.get_resource())

        # Remove empty popular_content if it has no useful data
        popular = base_result.get("popular_content", {})
        if popular and not any(popular.get(k) for k in popular):
            del base_result["popular_content"]

        # Add available datasets (top 20 by most recent modification)
        try:
            datasets = DatasetDAO.find_all()
            sorted_datasets = sorted(
                datasets,
                key=lambda d: getattr(d, "changed_on", None) or "",
                reverse=True,
            )[:20]
            base_result["available_datasets"] = [
                {
                    "id": ds.id,
                    "table_name": ds.table_name,
                    "schema": getattr(ds, "schema", None),
                    "database_id": getattr(ds, "database_id", None),
                }
                for ds in sorted_datasets
            ]
        except (SQLAlchemyError, AttributeError) as e:
            logger.warning("Could not fetch datasets for metadata: %s", e)
            base_result["available_datasets"] = []

        # Add available databases (for execute_sql)
        try:
            databases = DatabaseDAO.find_all()
            base_result["available_databases"] = [
                {
                    "id": db.id,
                    "database_name": db.database_name,
                    "backend": getattr(db, "backend", None),
                }
                for db in databases
            ]
        except (SQLAlchemyError, AttributeError) as e:
            logger.warning("Could not fetch databases for metadata: %s", e)
            base_result["available_databases"] = []

        return json.dumps(base_result, indent=2)

    except (SQLAlchemyError, AttributeError, KeyError, ValueError) as e:
        logger.error("Error generating instance metadata: %s", e)
        from superset.utils import json

        return json.dumps(
            {
                "error": "Unable to fetch complete metadata",
                "tips": [
                    "Use list_datasets to explore available data",
                    "Use get_instance_info for basic stats",
                ],
            }
        )
