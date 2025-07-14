# Licensed to the Apache Software Foundation (ASF) under one
# ... existing license ...
"""
Get Superset instance high-level information FastMCP tool
"""
import logging
from datetime import datetime, timedelta, timezone

from superset.mcp_service.dao_wrapper import MCPDAOWrapper
from superset.mcp_service.pydantic_schemas.system_schemas import (
    DashboardBreakdown, DatabaseBreakdown, InstanceSummary, PopularContent,
    RecentActivity, InstanceInfo, )

logger = logging.getLogger(__name__)

def get_superset_instance_info() -> InstanceInfo:
    """
    Get high-level information about the Superset instance (direct DB query, not via REST API)
    Returns:
        InstanceInfo
    """
    try:
        from superset.extensions import db
        from superset.models.dashboard import Dashboard
        from superset.models.slice import Slice
        from superset.connectors.sqla.models import SqlaTable
        from superset.models.core import Database
        from flask_appbuilder.security.sqla.models import User, Role
        from superset.tags.models import Tag
        from sqlalchemy import and_
        from superset.daos.dashboard import DashboardDAO
        from superset.daos.chart import ChartDAO
        from superset.daos.dataset import DatasetDAO
        from superset.daos.database import DatabaseDAO
        from superset.daos.user import UserDAO
        from superset.daos.tag import TagDAO
        from superset.daos.security import RLSDAO
        from superset.daos.report import ReportScheduleDAO
        from superset.daos.key_value import KeyValueDAO
        from superset.daos.log import LogDAO
        from superset.daos.annotation_layer import AnnotationDAO, AnnotationLayerDAO
        from superset.daos.css import CssTemplateDAO
        from superset.daos.query import QueryDAO, SavedQueryDAO
        from superset.daos.datasource import DatasourceDAO
        from superset.daos.base import BaseDAO, ColumnOperator, ColumnOperatorEnum

        # Instantiate MCPDAOWrappers
        dashboard_wrapper = MCPDAOWrapper(DashboardDAO, "dashboard")
        chart_wrapper = MCPDAOWrapper(ChartDAO, "chart")
        dataset_wrapper = MCPDAOWrapper(DatasetDAO, "dataset")
        database_wrapper = MCPDAOWrapper(DatabaseDAO, "database")
        user_wrapper = MCPDAOWrapper(UserDAO, "user")
        tag_wrapper = MCPDAOWrapper(TagDAO, "tag")

        # Get basic counts using MCPDAOWrapper
        total_dashboards = dashboard_wrapper.count()
        total_charts = chart_wrapper.count()
        total_datasets = dataset_wrapper.count()
        total_databases = database_wrapper.count()
        total_users = user_wrapper.count()
        total_tags = tag_wrapper.count()
        total_roles = db.session.query(Role).count()  # No DAO for Role

        # Recent activity
        now = datetime.now(timezone.utc)
        thirty_days_ago = now - timedelta(days=30)
        seven_days_ago = now - timedelta(days=7)

        dashboards_created_last_30_days = dashboard_wrapper.count(column_operators=[ColumnOperator(col="created_on", opr=ColumnOperatorEnum.gte, value=thirty_days_ago)])
        charts_created_last_30_days = chart_wrapper.count(column_operators=[ColumnOperator(col="created_on", opr=ColumnOperatorEnum.gte, value=thirty_days_ago)])
        datasets_created_last_30_days = dataset_wrapper.count(column_operators=[ColumnOperator(col="created_on", opr=ColumnOperatorEnum.gte, value=thirty_days_ago)])

        dashboards_modified_last_7_days = dashboard_wrapper.count(column_operators=[ColumnOperator(col="changed_on", opr=ColumnOperatorEnum.gte, value=seven_days_ago)])
        charts_modified_last_7_days = chart_wrapper.count(column_operators=[ColumnOperator(col="changed_on", opr=ColumnOperatorEnum.gte, value=seven_days_ago)])
        datasets_modified_last_7_days = dataset_wrapper.count(column_operators=[ColumnOperator(col="changed_on", opr=ColumnOperatorEnum.gte, value=seven_days_ago)])

        # Dashboard breakdown
        published_count = dashboard_wrapper.count(column_operators=[ColumnOperator(col="published", opr=ColumnOperatorEnum.eq, value=True)])
        unpublished_dashboards = total_dashboards - published_count
        certified_count = dashboard_wrapper.count(column_operators=[ColumnOperator(col="certified_by", opr=ColumnOperatorEnum.is_not_null, value=None)])  # Custom logic may be needed
        dashboards_with_charts = db.session.query(Dashboard).join(Dashboard.slices).distinct().count()  # No direct DAO method
        dashboards_without_charts = total_dashboards - dashboards_with_charts
        avg_charts_per_dashboard = (total_charts / total_dashboards) if total_dashboards > 0 else 0

        # Compose response using keyword arguments and nested models
        response = InstanceInfo(
            instance_summary=InstanceSummary(
                total_dashboards=total_dashboards,
                total_charts=total_charts,
                total_datasets=total_datasets,
                total_databases=total_databases,
                total_users=total_users,
                total_roles=total_roles,
                total_tags=total_tags,
                avg_charts_per_dashboard=round(avg_charts_per_dashboard, 2),
            ),
            recent_activity=RecentActivity(
                dashboards_created_last_30_days=dashboards_created_last_30_days,
                charts_created_last_30_days=charts_created_last_30_days,
                datasets_created_last_30_days=datasets_created_last_30_days,
                dashboards_modified_last_7_days=dashboards_modified_last_7_days,
                charts_modified_last_7_days=charts_modified_last_7_days,
                datasets_modified_last_7_days=datasets_modified_last_7_days,
            ),
            dashboard_breakdown=DashboardBreakdown(
                published=published_count,
                unpublished=unpublished_dashboards,
                certified=certified_count,
                with_charts=dashboards_with_charts,
                without_charts=dashboards_without_charts,
            ),
            database_breakdown=DatabaseBreakdown(
                by_type={"sqlite": total_databases}
            ),
            popular_content=PopularContent(
                top_tags=[],
                top_creators=[],
            ),
            timestamp=now,
        )
        logger.info("Successfully retrieved instance information (direct DB query)")
        return response

    except Exception as e:
        error_msg = f"Unexpected error in instance info: {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise

