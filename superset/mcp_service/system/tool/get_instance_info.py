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
from sqlalchemy.exc import OperationalError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import db, event_logger
from superset.mcp_service.mcp_core import InstanceInfoCore
from superset.mcp_service.privacy import user_can_view_data_model_metadata
from superset.mcp_service.system.schemas import (
    GetSupersetInstanceInfoRequest,
    InstanceInfo,
    serialize_user_object,
)
from superset.mcp_service.system.system_utils import (
    calculate_dashboard_breakdown,
    calculate_database_breakdown,
    calculate_feature_availability,
    calculate_instance_summary,
    calculate_popular_content,
    calculate_recent_activity,
)

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
        "feature_availability": calculate_feature_availability,
    },
    time_windows={
        "recent": 7,
        "monthly": 30,
        "quarterly": 90,
    },
    logger=logger,
)


_DEFAULT_INSTANCE_INFO_REQUEST = GetSupersetInstanceInfoRequest()


def _redact_data_model_metadata(result: InstanceInfo) -> InstanceInfo:
    """Remove dataset/database counts and activity from instance overview."""
    data = result.model_copy(deep=True)
    data.instance_summary.total_datasets = 0
    data.instance_summary.total_databases = 0
    data.recent_activity.datasets_created_last_30_days = 0
    data.recent_activity.datasets_modified_last_7_days = 0
    data.database_breakdown.by_type = {}
    data.data_model_metadata_redacted = True
    return data


@tool(
    tags=["core"],
    annotations=ToolAnnotations(
        title="Get instance info",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
def get_instance_info(
    request: GetSupersetInstanceInfoRequest = _DEFAULT_INSTANCE_INFO_REQUEST,
    ctx: Context = None,
) -> InstanceInfo:
    """Get instance statistics.

    Returns counts, activity metrics, and database types.
    """
    try:
        return _run_instance_info()

    except OperationalError as e:
        logger.warning(
            "Database connection error in get_instance_info, "
            "resetting session and retrying: %s",
            e,
        )
        try:
            db.session.rollback()  # pylint: disable=consider-using-transaction
        except Exception:  # noqa: BLE001
            # Broad catch: the DB connection itself may be broken (e.g.,
            # SSL drop), so even rollback can fail with non-SQLAlchemy
            # errors. This is a cleanup path — swallow and log.
            logger.warning(
                "Rollback failed during get_instance_info connection reset",
                exc_info=True,
            )
        try:
            db.session.remove()  # pylint: disable=consider-using-transaction
        except Exception:  # noqa: BLE001
            # Same as above — cleanup must not prevent the retry.
            logger.warning(
                "Session remove failed during get_instance_info connection reset",
                exc_info=True,
            )

        try:
            result = _run_instance_info()
            logger.info("get_instance_info retry succeeded after connection reset")
            return result
        except OperationalError as retry_error:
            logger.error(
                "get_instance_info retry failed after connection reset: %s",
                retry_error,
                exc_info=True,
            )
            raise

    except Exception as e:
        error_msg = f"Unexpected error in instance info: {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise


def _run_instance_info() -> InstanceInfo:
    """Execute the instance info core logic."""
    from flask import g

    from superset.daos.chart import ChartDAO
    from superset.daos.dashboard import DashboardDAO
    from superset.daos.database import DatabaseDAO
    from superset.daos.dataset import DatasetDAO
    from superset.daos.tag import TagDAO
    from superset.daos.user import UserDAO

    _instance_info_core.dao_classes = {
        "dashboards": DashboardDAO,
        "charts": ChartDAO,
        "datasets": DatasetDAO,
        "databases": DatabaseDAO,
        "users": UserDAO,
        "tags": TagDAO,
    }

    with event_logger.log_context(action="mcp.get_instance_info.metrics"):
        result = _instance_info_core.run_tool()

    if not user_can_view_data_model_metadata():
        result = _redact_data_model_metadata(result)

    if (user := getattr(g, "user", None)) is not None:
        result.current_user = serialize_user_object(user)

    return result
