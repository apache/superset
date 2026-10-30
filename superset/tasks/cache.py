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
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Optional, Union

from celery.exceptions import SoftTimeLimitExceeded
from celery.utils.log import get_task_logger
from flask import current_app
from sqlalchemy import and_, func
from sqlalchemy.orm import selectinload

from superset import db, security_manager
from superset.common.query_context import QueryContext
from superset.daos.dashboard import DashboardDAO
from superset.exceptions import SupersetSecurityException
from superset.extensions import celery_app
from superset.models.core import FavStar, FavStarClassName, Log
from superset.models.dashboard import Dashboard
from superset.tags.models import Tag, TaggedObject
from superset.tasks.native_filter_cache import (
    build_native_filter_option_form_data,
    build_native_filter_option_query_context,
    get_eligible_native_filters,
)
from superset.utils.date_parser import parse_human_datetime
from superset.utils.webdriver import _browser_manager, WebDriverPlaywright

logger: logging.Logger = get_task_logger(__name__)
logger.setLevel(logging.INFO)


@dataclass(frozen=True)
class CacheWarmupTask:
    """A chart data query to execute for cache warm-up."""

    query_context: QueryContext
    dashboard_id: int
    native_filter_id: str | None = None


def get_dash_url(dashboard: Dashboard) -> str:
    """Return external URL for warming up a given dashboard cache."""
    with current_app.test_request_context():
        baseurl: str = (
            # when running this as an async task, drop the request context with
            # app.test_request_context()
            current_app.config.get("WEBDRIVER_BASEURL")
            or "{SUPERSET_WEBSERVER_PROTOCOL}://"
            "{SUPERSET_WEBSERVER_ADDRESS}:"
            "{SUPERSET_WEBSERVER_PORT}".format(**current_app.config)
        )
        return f"{baseurl.rstrip('/')}{dashboard.url}"


class Strategy:  # pylint: disable=too-few-public-methods
    """
    A cache warm up strategy.

    WebDriver strategies define a `get_urls` method that returns a list of
    dashboard URLs to warm up. Query task strategies define `get_tasks`.

    Strategies can be configured in `superset/config.py`:

        beat_schedule = {
            'cache-warmup-hourly': {
                'task': 'cache-warmup',
                'schedule': crontab(minute=1, hour='*'),  # @hourly
                'kwargs': {
                    'strategy_name': 'top_n_dashboards',
                    'top_n': 10,
                    'since': '7 days ago',
                },
            },
        }

    """

    name: str = ""
    uses_webdriver: bool = True
    # Per-user strategies fan out one task per user from ``get_user_ids``.
    per_user: bool = False

    def __init__(self) -> None:
        pass

    def get_urls(self) -> list[str]:
        raise NotImplementedError("Subclasses must implement get_urls!")

    def get_tasks(self) -> list[CacheWarmupTask]:
        return []

    def get_user_ids(self) -> list[int]:
        return []


class DummyStrategy(Strategy):  # pylint: disable=too-few-public-methods
    """
    Warm up all published dashboards.

    This is a dummy strategy that will fetch all published dashboards.
    Can be configured by:

        beat_schedule = {
            'cache-warmup-hourly': {
                'task': 'cache-warmup',
                'schedule': crontab(minute=1, hour='*'),  # @hourly
                'kwargs': {'strategy_name': 'dummy'},
            },
        }

    """

    name: str = "dummy"

    def get_urls(self) -> list[str]:
        # Use selectinload to avoid N+1 queries when checking dashboard.slices
        dashboards: list[Dashboard] = (
            db.session.query(Dashboard)
            .options(selectinload(Dashboard.slices))
            .filter(Dashboard.published.is_(True))
            .all()
        )

        return [get_dash_url(dashboard) for dashboard in dashboards if dashboard.slices]


class TopNDashboardsStrategy(Strategy):  # pylint: disable=too-few-public-methods
    """
    Warm up charts in the top-n dashboards.

        beat_schedule = {
            'cache-warmup-hourly': {
                'task': 'cache-warmup',
                'schedule': crontab(minute=1, hour='*'),  # @hourly
                'kwargs': {
                    'strategy_name': 'top_n_dashboards',
                    'top_n': 5,
                    'since': '7 days ago',
                },
            },
        }

    """

    name: str = "top_n_dashboards"

    def __init__(self, top_n: int = 5, since: str = "7 days ago") -> None:
        super().__init__()
        self.top_n: int = top_n
        self.since: Any = parse_human_datetime(since) if since else None

    def get_urls(self) -> list[str]:
        records: list[Any] = (
            db.session.query(Log.dashboard_id, func.count(Log.dashboard_id))
            .filter(and_(Log.dashboard_id.isnot(None), Log.dttm >= self.since))
            .group_by(Log.dashboard_id)
            .order_by(func.count(Log.dashboard_id).desc())
            .limit(self.top_n)
            .all()
        )
        dash_ids: list[int] = [record.dashboard_id for record in records]
        dashboards: list[Dashboard] = (
            db.session.query(Dashboard).filter(Dashboard.id.in_(dash_ids)).all()
        )

        return [get_dash_url(dashboard) for dashboard in dashboards]


class DashboardTagsStrategy(Strategy):  # pylint: disable=too-few-public-methods
    """
    Warm up charts in dashboards with custom tags.

        beat_schedule = {
            'cache-warmup-hourly': {
                'task': 'cache-warmup',
                'schedule': crontab(minute=1, hour='*'),  # @hourly
                'kwargs': {
                    'strategy_name': 'dashboard_tags',
                    'tags': ['core', 'warmup'],
                },
            },
        }
    """

    name: str = "dashboard_tags"

    def __init__(self, tags: Optional[list[str]] = None) -> None:
        super().__init__()
        self.tags: list[str] = tags or []

    def get_urls(self) -> list[str]:
        urls: list[str] = []
        tags: list[Tag] = db.session.query(Tag).filter(Tag.name.in_(self.tags)).all()
        tag_ids: list[int] = [tag.id for tag in tags]

        # add dashboards that are tagged
        tagged_objects: list[TaggedObject] = (
            db.session.query(TaggedObject)
            .filter(
                and_(
                    TaggedObject.object_type == "dashboard",
                    TaggedObject.tag_id.in_(tag_ids),
                )
            )
            .all()
        )
        dash_ids: list[int] = [
            tagged_object.object_id for tagged_object in tagged_objects
        ]
        tagged_dashboards: list[Dashboard] = db.session.query(Dashboard).filter(
            Dashboard.id.in_(dash_ids)
        )
        for dashboard in tagged_dashboards:
            urls.append(get_dash_url(dashboard))

        return urls


class NativeFilterOptionsStrategy(Strategy):  # pylint: disable=too-few-public-methods
    """
    Build chart data query tasks for native filter option cache warm-up.
    """

    name: str = "native_filter_options"
    uses_webdriver: bool = False

    def __init__(self, dashboard_ids: list[int]) -> None:
        super().__init__()
        self.dashboard_ids: list[int] = dashboard_ids

    def get_urls(self) -> list[str]:
        return []

    def get_tasks(self) -> list[CacheWarmupTask]:
        tasks: list[CacheWarmupTask] = []

        for dashboard_id in self.dashboard_ids:
            skipped: int = 0
            built: int = 0

            try:
                dashboard: Dashboard | None = DashboardDAO.find_by_id(dashboard_id)
                if dashboard is None:
                    logger.warning(
                        "Dashboard %s not found; skipping native filter option "
                        "cache warm-up",
                        dashboard_id,
                    )
                    continue

                filter_configs: list[dict[str, Any]] = get_eligible_native_filters(
                    dashboard
                )

                for filter_config in filter_configs:
                    try:
                        form_data: dict[str, Any] | None = (
                            build_native_filter_option_form_data(
                                dashboard,
                                filter_config,
                            )
                        )
                        if form_data is None:
                            skipped += 1
                            continue

                        query_context: QueryContext | None = (
                            build_native_filter_option_query_context(form_data)
                        )
                        if query_context is None:
                            skipped += 1
                            continue

                        tasks.append(
                            CacheWarmupTask(
                                query_context=query_context,
                                dashboard_id=dashboard.id,
                                native_filter_id=filter_config.get("id"),
                            )
                        )
                        built += 1
                    except Exception:  # noqa: BLE001
                        skipped += 1
                        logger.exception(
                            "Error building native filter option cache warm-up "
                            "task for dashboard %s filter %s",
                            dashboard_id,
                            filter_config.get("id"),
                        )

                logger.info(
                    "Dashboard %s native filter option cache warm-up: %s filters "
                    "found, %s tasks built, %s skipped",
                    dashboard_id,
                    len(filter_configs),
                    built,
                    skipped,
                )
            except Exception:  # noqa: BLE001
                logger.exception(
                    "Error building native filter option cache warm-up tasks for "
                    "dashboard %s",
                    dashboard_id,
                )

        return tasks


class FavoritesStrategy(Strategy):  # pylint: disable=too-few-public-methods
    """
    Warm up charts on each user's favorited dashboards.

    Cache keys depend on the requesting user (row level security, impersonation),
    so each user's dashboards are warmed by a separate task that runs as that user.
    Only results that are missing or expired are computed. Users are selected by
    recent login, most recent first, up to ``max_users`` per run. Requires
    ``CACHE_WARMUP_FAVORITES = True``.

        beat_schedule = {
            'cache-warmup-favorites': {
                'task': 'cache-warmup',
                'schedule': crontab(minute=0, hour='*/6'),
                'kwargs': {
                    'strategy_name': 'favorites',
                    'since': '7 days ago',
                    'max_users': 100,
                },
            },
        }

    """

    name: str = "favorites"
    uses_webdriver: bool = False
    per_user: bool = True

    def __init__(self, since: str = "7 days ago", max_users: int = 100) -> None:
        super().__init__()
        self.since: Any = parse_human_datetime(since) if since else None
        self.max_users: int = max_users

    def get_urls(self) -> list[str]:
        return []

    def get_user_ids(self) -> list[int]:
        """Return ids of active users with favorited dashboards, newest login first."""
        query = (
            db.session.query(FavStar.user_id)
            .join(
                security_manager.user_model,
                security_manager.user_model.id == FavStar.user_id,
            )
            .filter(
                FavStar.class_name == FavStarClassName.DASHBOARD,
                security_manager.user_model.active.is_(True),
            )
        )
        if self.since:
            query = query.filter(security_manager.user_model.last_login >= self.since)
        rows = (
            query.group_by(FavStar.user_id, security_manager.user_model.last_login)
            .order_by(security_manager.user_model.last_login.desc())
            .limit(self.max_users)
            .all()
        )
        return [row.user_id for row in rows]


strategies: list[type[Strategy]] = [
    DummyStrategy,
    TopNDashboardsStrategy,
    DashboardTagsStrategy,
    NativeFilterOptionsStrategy,
    FavoritesStrategy,
]
strategy_registry: dict[str, type[Strategy]] = {
    strategy.name: strategy for strategy in strategies
}


def _warmup_urls(
    urls: list[str],
    user: Any,
    window: tuple[int, int],
    results: dict[str, list[str]],
) -> None:
    wd: WebDriverPlaywright = WebDriverPlaywright("", window)
    try:
        for url in urls:
            try:
                logger.info("Fetching %s", url)
                screenshot = wd.get_screenshot(url, "grid-container", user=user)
                if not screenshot:
                    raise RuntimeError("No screenshot captured")
                results["success"].append(url)
            except Exception:  # noqa: BLE001
                logger.exception("Error warming up cache for %s", url)
                results["errors"].append(url)
    finally:
        _browser_manager._cleanup()  # noqa: SLF001


def _dispatch_per_user(
    strategy: Strategy, results: dict[str, list[str]]
) -> Union[dict[str, list[str]], str]:
    """Enqueue one warm-up task per user selected by a per-user strategy."""
    if not current_app.config.get("CACHE_WARMUP_FAVORITES"):
        message = "CACHE_WARMUP_FAVORITES is disabled; nothing was warmed up."
        logger.warning(message)
        return message
    queue: str | None = current_app.config.get("CACHE_WARMUP_FAVORITES_QUEUE")
    for user_id in strategy.get_user_ids():
        try:
            cache_warmup_user_favorites.apply_async(args=(user_id,), queue=queue)
            results["success"].append(f"user:{user_id}")
        except Exception:  # noqa: BLE001
            logger.exception("Error enqueueing cache warm-up for user %s", user_id)
            results["errors"].append(f"user:{user_id}")
    return results


@celery_app.task(name="cache-warmup")
def cache_warmup(
    strategy_name: str, *args: Any, **kwargs: Any
) -> Union[dict[str, list[str]], str]:
    """
    Warm up cache.

    This task periodically hits dashboards to warm up the cache.

    """
    logger.info("Loading strategy")
    class_: type[Strategy] | None = strategy_registry.get(strategy_name)
    if class_ is None:
        message: str = "No strategy %s found!" % strategy_name
        logger.error(message, exc_info=True)
        return message

    logger.info("Loading %s", class_.__name__)
    try:
        strategy: Strategy = class_(*args, **kwargs)
        logger.info("Success!")
    except TypeError:
        message = "Error loading strategy!"
        logger.exception(message)
        return message

    results: dict[str, list[str]] = {"success": [], "errors": []}

    if strategy.per_user:
        return _dispatch_per_user(strategy, results)

    warmup_username: str | None = current_app.config.get("SUPERSET_CACHE_WARMUP_USER")
    if not warmup_username:
        message = (
            "SUPERSET_CACHE_WARMUP_USER is not configured. Set it to a dedicated "
            "least-privilege user with access to the dashboards you want warmed up."
        )
        logger.error(message)
        return message

    user: Any = security_manager.find_user(username=warmup_username)
    if not user:
        message = (
            f"Cache warmup user '{warmup_username}' not found. Please configure "
            "SUPERSET_CACHE_WARMUP_USER with a valid username."
        )
        logger.error(message)
        return message

    if not strategy.uses_webdriver:
        # pylint: disable=import-outside-toplevel
        from superset.commands.chart.data.get_data_command import ChartDataCommand
        from superset.utils.core import override_user

        with override_user(user, force=False):
            tasks: list[CacheWarmupTask] = strategy.get_tasks()
            for task in tasks:
                task_name: str = (
                    f"dashboard:{task.dashboard_id}:"
                    f"native_filter:{task.native_filter_id}"
                )
                try:
                    logger.info("Warming up cache for %s", task_name)
                    command: Any = ChartDataCommand(task.query_context)
                    command.validate()
                    command.run(cache=True)
                    results["success"].append(task_name)
                except Exception:  # noqa: BLE001
                    logger.exception("Error warming up cache for %s", task_name)
                    results["errors"].append(task_name)

        return results

    _warmup_urls(
        strategy.get_urls(),
        user,
        current_app.config["WEBDRIVER_WINDOW"]["dashboard"],
        results,
    )
    return results


def _get_favorite_dashboards(user_id: int, limit: int) -> list[Dashboard]:
    """Return the user's most recently favorited dashboards, newest first."""
    dashboard_ids: list[int] = [
        row.obj_id
        for row in db.session.query(FavStar.obj_id)
        .filter(
            FavStar.user_id == user_id,
            FavStar.class_name == FavStarClassName.DASHBOARD,
        )
        .order_by(FavStar.dttm.desc())
        .all()
    ]
    dashboards: list[Dashboard] = []
    if not dashboard_ids:
        return dashboards
    by_id: dict[int, Dashboard] = {
        dashboard.id: dashboard
        for dashboard in db.session.query(Dashboard)
        .options(selectinload(Dashboard.slices))
        .filter(Dashboard.id.in_(dashboard_ids))
        .all()
    }
    for dashboard_id in dashboard_ids:
        if (dashboard := by_id.get(dashboard_id)) is None:
            continue
        try:
            security_manager.raise_for_access(dashboard=dashboard)
        except SupersetSecurityException:
            continue
        dashboards.append(dashboard)
        if len(dashboards) >= limit:
            break
    return dashboards


@celery_app.task(
    name="cache-warmup-user-favorites", soft_time_limit=840, time_limit=900
)
def cache_warmup_user_favorites(user_id: int) -> dict[str, list[int]]:
    """
    Warm the cache for charts on a user's favorited dashboards.

    Runs as the given user, since cache keys depend on the requesting user (row
    level security, impersonation). Charts whose cached results are all present
    are skipped; only missing or expired results are computed.
    """
    # pylint: disable=import-outside-toplevel
    from superset.commands.chart.warm_up_cache import ChartWarmUpCacheCommand
    from superset.utils.core import override_user

    results: dict[str, list[int]] = {"success": [], "errors": []}
    user: Any = security_manager.get_user_by_id(user_id)
    if not user:
        logger.warning("Favorites cache warm-up: user %s not found", user_id)
        return results

    limit: int = current_app.config["CACHE_WARMUP_FAVORITES_MAX_DASHBOARDS"]
    with override_user(user, force=True):
        for dashboard in _get_favorite_dashboards(user_id, limit):
            for chart in dashboard.slices:
                try:
                    outcome: dict[str, Any] = ChartWarmUpCacheCommand(
                        chart, dashboard.id, None, only_if_stale=True
                    ).run(skip_disabled=True)
                except SoftTimeLimitExceeded:
                    logger.warning(
                        "Favorites cache warm-up for user %s timed out", user_id
                    )
                    return results
                except Exception:  # noqa: BLE001
                    logger.exception(
                        "Error warming up chart %s on dashboard %s",
                        chart.id,
                        dashboard.id,
                    )
                    results["errors"].append(chart.id)
                    continue
                key: str = "errors" if outcome.get("viz_error") else "success"
                results[key].append(chart.id)
    return results
