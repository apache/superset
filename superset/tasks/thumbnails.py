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

"""Async task implementations for thumbnail generation using the new framework."""

import logging
from typing import Any, cast, Dict, Optional
from uuid import UUID

from flask import current_app
from superset_core.async_tasks import async_task

from superset import security_manager, thumbnail_cache
from superset.async_tasks.executor import check_task_cancelled
from superset.security.guest_token import GuestToken
from superset.tasks.utils import get_executor
from superset.utils.core import override_user
from superset.utils.screenshots import ChartScreenshot, DashboardScreenshot
from superset.utils.urls import get_url_path
from superset.utils.webdriver import WindowSize

logger = logging.getLogger(__name__)


@async_task
def cache_chart_thumbnail(
    task_uuid: UUID,
    current_user: Optional[str],
    chart_id: str,
    force: bool,
    window_size: Optional[WindowSize] = None,
    thumb_size: Optional[WindowSize] = None,
) -> Dict[str, Any]:
    """
    Generate a chart thumbnail using the new async task framework.

    This provides enhanced tracking, cancellation support, and structured results
    while maintaining compatibility with existing thumbnail generation logic.

    Args:
        task_uuid: UUID of the async task (provided automatically by executor)
        current_user: Username of user triggering the task
        chart_id: Chart ID to generate thumbnail for
        force: Whether to force regeneration of existing thumbnail
        window_size: Browser window size for screenshot
        thumb_size: Final thumbnail size

    Returns:
        Dict containing thumbnail generation results and metadata (persisted to DB)
    """
    # pylint: disable=import-outside-toplevel
    from superset.models.slice import Slice

    if not thumbnail_cache:
        logger.warning(
            "No cache set, refusing to compute thumbnail for chart %s", chart_id
        )
        return {
            "success": False,
            "error": "No thumbnail cache configured",
            "chart_id": chart_id,
        }

    chart = cast(Slice, Slice.get(chart_id))
    if not chart:
        logger.warning("Chart %s not found, skipping thumbnail generation", chart_id)
        return {
            "success": False,
            "error": f"Chart {chart_id} not found",
            "chart_id": chart_id,
        }

    try:
        # Check for cancellation before starting
        if check_task_cancelled(task_uuid):
            logger.info("Chart thumbnail task %s was cancelled", task_uuid)
            return {
                "success": False,
                "cancelled": True,
                "chart_id": chart_id,
            }

        url = get_url_path("Superset.slice", slice_id=chart.id)
        logger.info("Generating thumbnail for chart %s at URL: %s", chart_id, url)

        # Get executor user (same logic as original implementation)
        _, username = get_executor(
            executors=current_app.config["THUMBNAIL_EXECUTORS"],
            model=chart,
            current_user=current_user,
        )
        user = security_manager.find_user(username)

        # Check for cancellation before generating screenshot
        if check_task_cancelled(task_uuid):
            logger.info(
                "Chart thumbnail task %s was cancelled before screenshot", task_uuid
            )
            return {
                "success": False,
                "cancelled": True,
                "chart_id": chart_id,
            }

        # Generate screenshot with user context
        with override_user(user):
            screenshot = ChartScreenshot(url, chart.digest)
            screenshot.compute_and_cache(
                user=user,
                window_size=window_size,
                thumb_size=thumb_size,
                force=force,
            )

        logger.info("Successfully generated thumbnail for chart %s", chart_id)
        return {
            "success": True,
            "chart_id": chart_id,
            "chart_name": chart.slice_name,
            "url": url,
            "digest": chart.digest,
            "user": username,
            "force_regeneration": force,
            "window_size": window_size,
            "thumb_size": thumb_size,
        }

    except Exception as e:
        logger.error(
            "Failed to generate thumbnail for chart %s: %s",
            chart_id,
            str(e),
            exc_info=True,
        )
        return {
            "success": False,
            "error": str(e),
            "chart_id": chart_id,
        }


@async_task
def cache_dashboard_thumbnail(
    task_uuid: UUID,
    current_user: Optional[str],
    dashboard_id: int,
    force: bool,
    thumb_size: Optional[WindowSize] = None,
    window_size: Optional[WindowSize] = None,
    cache_key: str | None = None,
) -> Dict[str, Any]:
    """
    Generate a dashboard thumbnail using the new async task framework.

    This wraps the existing dashboard thumbnail logic in our framework,
    providing enhanced tracking while maintaining full compatibility.

    Args:
        task_uuid: UUID of the async task (provided automatically by executor)
        current_user: Username of user triggering the task
        dashboard_id: Dashboard ID to generate thumbnail for
        force: Whether to force regeneration of existing thumbnail
        thumb_size: Final thumbnail size
        window_size: Browser window size for screenshot
        cache_key: Optional cache key override

    Returns:
        Dict containing thumbnail generation results and metadata (persisted to DB)
    """
    # pylint: disable=import-outside-toplevel
    from superset.models.dashboard import Dashboard

    if not thumbnail_cache:
        logger.warning(
            "No cache set, refusing to compute thumbnail for dashboard %s", dashboard_id
        )
        return {
            "success": False,
            "error": "No thumbnail cache configured",
            "dashboard_id": dashboard_id,
        }

    dashboard = Dashboard.get(dashboard_id)
    if not dashboard:
        logger.warning(
            "Dashboard %s not found, skipping thumbnail generation", dashboard_id
        )
        return {
            "success": False,
            "error": f"Dashboard {dashboard_id} not found",
            "dashboard_id": dashboard_id,
        }

    try:
        # Check for cancellation before starting
        if check_task_cancelled(task_uuid):
            logger.info("Dashboard thumbnail task %s was cancelled", task_uuid)
            return {
                "success": False,
                "cancelled": True,
                "dashboard_id": dashboard_id,
            }

        url = get_url_path("Superset.dashboard", dashboard_id_or_slug=dashboard.id)
        logger.info(
            "Generating thumbnail for dashboard %s at URL: %s", dashboard_id, url
        )

        # Get executor user (same logic as original implementation)
        _, username = get_executor(
            executors=current_app.config["THUMBNAIL_EXECUTORS"],
            model=dashboard,
            current_user=current_user,
        )
        user = security_manager.find_user(username)

        # Check for cancellation before generating screenshot
        if check_task_cancelled(task_uuid):
            logger.info(
                "Dashboard thumbnail task %s was cancelled before screenshot", task_uuid
            )
            return {
                "success": False,
                "cancelled": True,
                "dashboard_id": dashboard_id,
            }

        # Generate screenshot with user context
        with override_user(user):
            screenshot = DashboardScreenshot(url, dashboard.digest)
            screenshot.compute_and_cache(
                user=user,
                window_size=window_size,
                thumb_size=thumb_size,
                force=force,
                cache_key=cache_key,
            )

        logger.info("Successfully generated thumbnail for dashboard %s", dashboard_id)
        return {
            "success": True,
            "dashboard_id": dashboard_id,
            "dashboard_title": dashboard.dashboard_title,
            "url": url,
            "digest": dashboard.digest,
            "user": username,
            "cache_key": cache_key,
            "force_regeneration": force,
            "window_size": window_size,
            "thumb_size": thumb_size,
        }

    except Exception as e:
        logger.error(
            "Failed to generate thumbnail for dashboard %s: %s",
            dashboard_id,
            str(e),
            exc_info=True,
        )
        return {
            "success": False,
            "error": str(e),
            "dashboard_id": dashboard_id,
        }


@async_task
def cache_dashboard_screenshot(  # pylint: disable=too-many-arguments
    task_uuid: UUID,
    username: str,
    dashboard_id: int,
    dashboard_url: str,
    force: bool,
    cache_key: Optional[str] = None,
    guest_token: Optional[GuestToken] = None,
    thumb_size: Optional[WindowSize] = None,
    window_size: Optional[WindowSize] = None,
) -> Dict[str, Any]:
    """
    Generate a dashboard screenshot using the new async task framework.

    This handles the more complex screenshot generation with guest tokens
    and custom URLs, demonstrating our framework's flexibility.

    Args:
        task_uuid: UUID of the async task (provided automatically by executor)
        username: Username triggering the task
        dashboard_id: Dashboard ID to screenshot
        dashboard_url: Custom URL to screenshot
        force: Whether to force regeneration
        cache_key: Optional cache key override
        guest_token: Optional guest token for embedded dashboards
        thumb_size: Final thumbnail size
        window_size: Browser window size for screenshot

    Returns:
        Dict containing screenshot generation results and metadata (persisted to DB)
    """
    # pylint: disable=import-outside-toplevel
    from superset.models.dashboard import Dashboard

    if not thumbnail_cache:
        logger.warning(
            "No cache set, refusing to compute screenshot for dashboard %s",
            dashboard_id,
        )
        return {
            "success": False,
            "error": "No thumbnail cache configured",
            "dashboard_id": dashboard_id,
        }

    dashboard = Dashboard.get(dashboard_id)
    if not dashboard:
        logger.warning(
            "Dashboard %s not found, skipping screenshot generation", dashboard_id
        )
        return {
            "success": False,
            "error": f"Dashboard {dashboard_id} not found",
            "dashboard_id": dashboard_id,
        }

    try:
        # Check for cancellation before starting
        if check_task_cancelled(task_uuid):
            logger.info("Dashboard screenshot task %s was cancelled", task_uuid)
            return {
                "success": False,
                "cancelled": True,
                "dashboard_id": dashboard_id,
            }

        logger.info(
            "Generating screenshot for dashboard %s at URL: %s",
            dashboard_id,
            dashboard_url,
        )

        # Handle guest user vs regular user authentication
        if guest_token:
            current_user = security_manager.get_guest_user_from_token(guest_token)
            auth_type = "guest_token"
        else:
            _, exec_username = get_executor(
                executors=current_app.config["THUMBNAIL_EXECUTORS"],
                model=dashboard,
                current_user=username,
            )
            current_user = security_manager.find_user(exec_username)
            auth_type = "user_executor"

        # Check for cancellation before generating screenshot
        if check_task_cancelled(task_uuid):
            logger.info(
                "Dashboard screenshot task %s was cancelled before screenshot",
                task_uuid,
            )
            return {
                "success": False,
                "cancelled": True,
                "dashboard_id": dashboard_id,
            }

        # Generate screenshot with user context
        with override_user(current_user):
            screenshot = DashboardScreenshot(dashboard_url, dashboard.digest)
            screenshot.compute_and_cache(
                user=current_user,
                window_size=window_size,
                thumb_size=thumb_size,
                cache_key=cache_key,
                force=force,
            )

        logger.info("Successfully generated screenshot for dashboard %s", dashboard_id)
        return {
            "success": True,
            "dashboard_id": dashboard_id,
            "dashboard_title": dashboard.dashboard_title,
            "dashboard_url": dashboard_url,
            "digest": dashboard.digest,
            "username": username,
            "auth_type": auth_type,
            "cache_key": cache_key,
            "guest_token_provided": guest_token is not None,
            "force_regeneration": force,
            "window_size": window_size,
            "thumb_size": thumb_size,
        }

    except Exception as e:
        logger.error(
            "Failed to generate screenshot for dashboard %s: %s",
            dashboard_id,
            str(e),
            exc_info=True,
        )
        return {
            "success": False,
            "error": str(e),
            "dashboard_id": dashboard_id,
            "dashboard_url": dashboard_url,
        }
