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
from typing import Any, Optional, TypedDict, Union
from urllib.error import URLError

from celery.utils.log import get_task_logger
from flask import current_app
from sqlalchemy import and_, func

from superset import db, security_manager
from superset.extensions import celery_app
from superset.models.core import Log
from superset.models.dashboard import Dashboard
from superset.tags.models import Tag, TaggedObject
from superset.utils.date_parser import parse_human_datetime
from superset.utils.webdriver import WebDriverSelenium

logger = get_task_logger(__name__)
logger.setLevel(logging.INFO)


class CacheWarmupPayload(TypedDict, total=False):
    chart_id: int
    dashboard_id: int | None


class CacheWarmupTask(TypedDict):
    payload: CacheWarmupPayload
    username: str | None


def get_dash_url(dashboard: Dashboard) -> str:
    """Return external URL for warming up a given dashboard cache."""
    with current_app.test_request_context():
        baseurl = (
            # when running this as an async task, drop the request context with
            # app.test_request_context()
            current_app.config.get("WEBDRIVER_BASEURL")
            or "{SUPERSET_WEBSERVER_PROTOCOL}://"
            "{SUPERSET_WEBSERVER_ADDRESS}:"
            "{SUPERSET_WEBSERVER_PORT}".format(**current_app.config)
        )
        return f"{baseurl}{dashboard.url}"


class Strategy:  # pylint: disable=too-few-public-methods
    """
    A cache warm up strategy.

    Each strategy defines a `get_urls` method that returns a list of dashboard URLs to
    warm up using WebDriver.

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

    def __init__(self) -> None:
        pass

    def get_urls(self) -> list[str]:
        raise NotImplementedError("Subclasses must implement get_urls!")


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

    name = "dummy"

    def get_urls(self) -> list[str]:
        dashboards = (
            db.session.query(Dashboard).filter(Dashboard.published.is_(True)).all()
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

    name = "top_n_dashboards"

    def __init__(self, top_n: int = 5, since: str = "7 days ago") -> None:
        super().__init__()
        self.top_n = top_n
        self.since = parse_human_datetime(since) if since else None

    def get_urls(self) -> list[str]:
        records = (
            db.session.query(Log.dashboard_id, func.count(Log.dashboard_id))
            .filter(and_(Log.dashboard_id.isnot(None), Log.dttm >= self.since))
            .group_by(Log.dashboard_id)
            .order_by(func.count(Log.dashboard_id).desc())
            .limit(self.top_n)
            .all()
        )
        dash_ids = [record.dashboard_id for record in records]
        dashboards = (
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

    name = "dashboard_tags"

    def __init__(self, tags: Optional[list[str]] = None) -> None:
        super().__init__()
        self.tags = tags or []

    def get_urls(self) -> list[str]:
        urls = []
        tags = db.session.query(Tag).filter(Tag.name.in_(self.tags)).all()
        tag_ids = [tag.id for tag in tags]

        # add dashboards that are tagged
        tagged_objects = (
            db.session.query(TaggedObject)
            .filter(
                and_(
                    TaggedObject.object_type == "dashboard",
                    TaggedObject.tag_id.in_(tag_ids),
                )
            )
            .all()
        )
        dash_ids = [tagged_object.object_id for tagged_object in tagged_objects]
        tagged_dashboards = db.session.query(Dashboard).filter(
            Dashboard.id.in_(dash_ids)
        )
        for dashboard in tagged_dashboards:
            urls.append(get_dash_url(dashboard))

        return urls


strategies = [DummyStrategy, TopNDashboardsStrategy, DashboardTagsStrategy]


@celery_app.task(name="cache-warmup")
def cache_warmup(
    strategy_name: str, *args: Any, **kwargs: Any
) -> Union[dict[str, list[str]], str]:
    """
    Warm up cache.

    This task periodically hits dashboards to warm up the cache.

    """
    logger.info("Loading strategy")
    class_ = None
    for class_ in strategies:
        if class_.name == strategy_name:  # type: ignore
            break
    else:
        message = f"No strategy {strategy_name} found!"
        logger.error(message, exc_info=True)
        return message

    logger.info("Loading %s", class_.__name__)
    try:
        strategy = class_(*args, **kwargs)
        logger.info("Success!")
    except TypeError:
        message = "Error loading strategy!"
        logger.exception(message)
        return message

    results: dict[str, list[str]] = {"success": [], "errors": []}

    user = security_manager.find_user(
        username=current_app.config["SUPERSET_CACHE_WARMUP_USER"]
    )
    wd = WebDriverSelenium(current_app.config["WEBDRIVER_TYPE"], user=user)

    for url in strategy.get_urls():
        try:
            logger.info("Fetching %s", url)
            wd.get_screenshot(url, "grid-container")
            results["success"].append(url)
        except URLError:
            logger.exception("Error warming up cache!")
            results["errors"].append(url)

    return results
