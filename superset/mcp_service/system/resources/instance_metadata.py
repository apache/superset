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
        # Import DAOs inside function to avoid global scope imports
        from superset.daos.chart import ChartDAO
        from superset.daos.dashboard import DashboardDAO
        from superset.daos.database import DatabaseDAO
        from superset.daos.dataset import DatasetDAO
        from superset.extensions import db

        # Gather instance statistics using DAOs
        dataset_count = DatasetDAO.count()
        dashboard_count = DashboardDAO.count()
        chart_count = ChartDAO.count()
        database_count = DatabaseDAO.count()

        # Get popular datasets (by chart count) using raw query for complex join
        # Get the model classes
        dataset_model = DatasetDAO.model_cls
        chart_model = ChartDAO.model_cls

        if dataset_model and chart_model:
            popular_datasets = (
                db.session.query(
                    dataset_model.table_name,
                    dataset_model.schema,
                    db.func.count(chart_model.id).label("chart_count"),
                )
                .join(
                    chart_model,
                    chart_model.datasource_id == dataset_model.id,
                )
                .filter(chart_model.datasource_type == "table")
                .group_by(dataset_model.table_name, dataset_model.schema)
                .order_by(db.desc("chart_count"))
                .limit(10)
                .all()
            )
        else:
            popular_datasets = []

        # Get recent published dashboards using DAO with filters
        from superset.daos.base import ColumnOperator, ColumnOperatorEnum

        recent_dashboards, _ = DashboardDAO.list(
            column_operators=[
                ColumnOperator(col="published", opr=ColumnOperatorEnum.eq, value=True)
            ],
            order_column="changed_on",
            order_direction="desc",
            page_size=10,
            columns=["id", "dashboard_title", "slug"],
        )

        # Get available chart types - simplified list (config access would need Flask
        # app)
        available_viz_types = [
            "line",
            "bar",
            "area",
            "scatter",
            "pie",
            "table",
            "pivot_table",
            "heatmap",
            "box_plot",
            "histogram",
            "time_series",
            "big_number",
            "mixed_timeseries",
            "dist_bar",
            "world_map",
            "country_map",
        ]

        # Get sample queries (non-sensitive templates)
        sample_queries = [
            {
                "description": "Top 10 by metric",
                "template": "SELECT dimension, SUM(metric) as total FROM table GROUP "
                "BY dimension ORDER BY total DESC LIMIT 10",
            },
            {
                "description": "Time series daily",
                "template": "SELECT DATE(timestamp) as date, COUNT(*) as count FROM "
                "table GROUP BY DATE(timestamp) ORDER BY date",
            },
            {
                "description": "Year-over-year comparison",
                "template": "SELECT YEAR(date) as year, MONTH(date) as month, "
                "SUM(value) FROM table GROUP BY year, month",
            },
            {
                "description": "Moving average",
                "template": "SELECT date, value, AVG(value) OVER (ORDER BY date ROWS "
                "BETWEEN 6 PRECEDING AND CURRENT ROW) as moving_avg FROM "
                "table",
            },
        ]

        # Get database engines using DAO
        databases, _ = DatabaseDAO.list(
            columns=["database_name", "sqlalchemy_uri"],
            page_size=100,  # Get all databases
        )

        db_engines = set()
        for database in databases:
            if hasattr(database, "sqlalchemy_uri") and database.sqlalchemy_uri:
                # Extract database type from SQLAlchemy URI
                db_type = (
                    database.sqlalchemy_uri.split("://")[0]
                    if "://" in database.sqlalchemy_uri
                    else "unknown"
                )
                db_engines.add(db_type)

        db_engines_list = list(db_engines)

        # Build metadata response
        metadata = {
            "instance_stats": {
                "dataset_count": dataset_count,
                "dashboard_count": dashboard_count,
                "chart_count": chart_count,
                "database_count": database_count,
            },
            "popular_datasets": [
                {
                    "name": f"{ds.schema}.{ds.table_name}"
                    if ds.schema
                    else ds.table_name,
                    "chart_count": ds.chart_count,
                }
                for ds in popular_datasets
            ],
            "recent_dashboards": [
                {
                    "id": getattr(d, "id", None),
                    "title": getattr(d, "dashboard_title", "Unknown"),
                    "slug": getattr(d, "slug", None),
                }
                for d in recent_dashboards
            ],
            "available_chart_types": available_viz_types,
            "database_engines": db_engines_list,
            "sample_queries": sample_queries,
            "features": {
                "sql_lab_enabled": True,
                # Default to enabled (would need Flask app config for actual value)
                "csv_upload_enabled": True,  # Default to enabled
                "thumbnails_enabled": False,  # Default to disabled
            },
            "tips": [
                "Use list_datasets to see all available datasets",
                "Use get_dataset_info to explore columns and metrics",
                "Popular datasets often have well-defined metrics",
                "Start with simple visualizations like line and bar charts",
                "Dashboards can be filtered dynamically",
                "Use get_superset_instance_info for detailed statistics",
            ],
        }

        from superset.utils import json

        return json.dumps(metadata, indent=2)

    except Exception as e:
        logger.error(f"Error generating instance metadata: {e}")
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
