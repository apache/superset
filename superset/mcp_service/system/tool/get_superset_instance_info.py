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
Get Superset instance high-level information FastMCP tool using configurable
InstanceInfoCore for flexible, extensible metrics calculation.
"""

import logging
from typing import Any, Dict

from fastmcp import Context

from superset.mcp_service.app import mcp
from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.mcp_core import InstanceInfoCore
from superset.mcp_service.system.schemas import (
    DashboardBreakdown,
    DatabaseBreakdown,
    GetSupersetInstanceInfoRequest,
    InstanceInfo,
    InstanceSummary,
    PopularContent,
    RecentActivity,
)

logger = logging.getLogger(__name__)


def calculate_dashboard_breakdown(
    base_counts: Dict[str, int],
    time_metrics: Dict[str, Dict[str, int]],
    dao_classes: Dict[str, Any],
) -> DashboardBreakdown:
    """Calculate detailed dashboard breakdown metrics."""
    try:
        from superset.daos.base import ColumnOperator, ColumnOperatorEnum
        from superset.extensions import db
        from superset.models.dashboard import Dashboard

        dashboard_dao = dao_classes["dashboards"]

        # Published vs unpublished
        published_count = dashboard_dao.count(
            column_operators=[
                ColumnOperator(col="published", opr=ColumnOperatorEnum.eq, value=True)
            ]
        )
        unpublished_count = base_counts.get("total_dashboards", 0) - published_count

        # Certified dashboards
        certified_count = dashboard_dao.count(
            column_operators=[
                ColumnOperator(
                    col="certified_by", opr=ColumnOperatorEnum.is_not_null, value=None
                )
            ]
        )

        # Dashboards with/without charts
        dashboards_with_charts = (
            db.session.query(Dashboard).join(Dashboard.slices).distinct().count()
        )
        dashboards_without_charts = (
            base_counts.get("total_dashboards", 0) - dashboards_with_charts
        )

        return DashboardBreakdown(
            published=published_count,
            unpublished=unpublished_count,
            certified=certified_count,
            with_charts=dashboards_with_charts,
            without_charts=dashboards_without_charts,
        )
    except Exception:
        # Return empty breakdown on error
        return DashboardBreakdown(
            published=0,
            unpublished=0,
            certified=0,
            with_charts=0,
            without_charts=0,
        )


def calculate_database_breakdown(
    base_counts: Dict[str, int],
    time_metrics: Dict[str, Dict[str, int]],
    dao_classes: Dict[str, Any],
) -> DatabaseBreakdown:
    """Calculate database type breakdown."""
    try:
        from superset.extensions import db
        from superset.models.core import Database

        # Get database types distribution
        db_types = db.session.query(
            Database.database_name, Database.sqlalchemy_uri
        ).all()

        type_counts: Dict[str, int] = {}
        for _name, uri in db_types:
            if uri:
                # Extract database type from SQLAlchemy URI
                db_type = uri.split("://")[0] if "://" in uri else "unknown"
                type_counts[db_type] = type_counts.get(db_type, 0) + 1
            else:
                type_counts["unknown"] = type_counts.get("unknown", 0) + 1

        return DatabaseBreakdown(by_type=type_counts)
    except Exception:
        # Return empty breakdown on error
        return DatabaseBreakdown(by_type={})


def calculate_instance_summary(
    base_counts: Dict[str, int],
    time_metrics: Dict[str, Dict[str, int]],
    dao_classes: Dict[str, Any],
) -> InstanceSummary:
    """Calculate instance summary with computed metrics."""
    try:
        from flask_appbuilder.security.sqla.models import Role

        from superset.extensions import db

        # Add roles count (no DAO available)
        total_roles = db.session.query(Role).count()

        # Calculate average charts per dashboard
        total_dashboards = base_counts.get("total_dashboards", 0)
        total_charts = base_counts.get("total_charts", 0)
        avg_charts_per_dashboard = (
            (total_charts / total_dashboards) if total_dashboards > 0 else 0
        )

        return InstanceSummary(
            total_dashboards=total_dashboards,
            total_charts=total_charts,
            total_datasets=base_counts.get("total_datasets", 0),
            total_databases=base_counts.get("total_databases", 0),
            total_users=base_counts.get("total_users", 0),
            total_roles=total_roles,
            total_tags=base_counts.get("total_tags", 0),
            avg_charts_per_dashboard=round(avg_charts_per_dashboard, 2),
        )
    except Exception:
        # Return empty summary on error
        return InstanceSummary(
            total_dashboards=0,
            total_charts=0,
            total_datasets=0,
            total_databases=0,
            total_users=0,
            total_roles=0,
            total_tags=0,
            avg_charts_per_dashboard=0.0,
        )


def calculate_recent_activity(
    base_counts: Dict[str, int],
    time_metrics: Dict[str, Dict[str, int]],
    dao_classes: Dict[str, Any],
) -> RecentActivity:
    """Transform time metrics into RecentActivity format."""
    monthly = time_metrics.get("monthly", {})
    recent = time_metrics.get("recent", {})

    return RecentActivity(
        dashboards_created_last_30_days=monthly.get("dashboards_created", 0),
        charts_created_last_30_days=monthly.get("charts_created", 0),
        datasets_created_last_30_days=monthly.get("datasets_created", 0),
        dashboards_modified_last_7_days=recent.get("dashboards_modified", 0),
        charts_modified_last_7_days=recent.get("charts_modified", 0),
        datasets_modified_last_7_days=recent.get("datasets_modified", 0),
    )


def calculate_popular_content(
    base_counts: Dict[str, int],
    time_metrics: Dict[str, Dict[str, int]],
    dao_classes: Dict[str, Any],
) -> PopularContent:
    """Calculate popular content metrics (placeholder implementation)."""

    return PopularContent(
        top_tags=[],
        top_creators=[],
    )


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


@mcp.tool
@mcp_auth_hook
def get_superset_instance_info(
    request: GetSupersetInstanceInfoRequest, ctx: Context
) -> InstanceInfo:
    """
    Get comprehensive high-level information about the Superset instance.

    Uses a configurable InstanceInfoCore to gather statistics including:
    - Basic entity counts (dashboards, charts, datasets, etc.)
    - Recent activity metrics across multiple time windows
    - Dashboard status breakdown (published, certified, etc.)
    - Database type distribution
    - Popular content analysis

    This tool uses system-level metadata caching for performance. The data
    is typically cached and refreshed automatically by Superset's background
    processes.

    Returns:
        InstanceInfo: Comprehensive instance statistics and metadata
    """
    try:
        # Import DAOs at runtime to avoid circular imports
        from superset.daos.chart import ChartDAO
        from superset.daos.dashboard import DashboardDAO
        from superset.daos.database import DatabaseDAO
        from superset.daos.dataset import DatasetDAO
        from superset.daos.tag import TagDAO
        from superset.daos.user import UserDAO

        # Configure DAO classes at runtime
        _instance_info_core.dao_classes = {
            "dashboards": DashboardDAO,  # type: ignore[dict-item]
            "charts": ChartDAO,  # type: ignore[dict-item]
            "datasets": DatasetDAO,  # type: ignore[dict-item]
            "databases": DatabaseDAO,  # type: ignore[dict-item]
            "users": UserDAO,  # type: ignore[dict-item]
            "tags": TagDAO,  # type: ignore[dict-item]
        }

        # Run the configurable core
        return _instance_info_core.run_tool()

    except Exception as e:
        error_msg = f"Unexpected error in instance info: {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise
