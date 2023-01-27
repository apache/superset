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
import logging
from typing import Any, Dict, List, Optional, Union
from urllib import request
from urllib.error import URLError

from celery.beat import SchedulingError
from celery.utils.log import get_task_logger
from sqlalchemy import and_, func

from superset import app, db, security_manager
from superset.extensions import celery_app
from superset.models.core import Log
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.tags.models import Tag, TaggedObject
from superset.utils.date_parser import parse_human_datetime
from superset.utils.machine_auth import MachineAuthProvider

logger = get_task_logger(__name__)
logger.setLevel(logging.INFO)


def get_url(chart: Slice, dashboard: Optional[Dashboard] = None) -> str:
    """Return external URL for warming up a given chart/table cache."""
    with app.test_request_context():
        baseurl = "{WEBDRIVER_BASEURL}".format(**app.config)
        url = f"{baseurl}superset/warm_up_cache/?slice_id={chart.id}"
        if dashboard:
            url += f"&dashboard_id={dashboard.id}"
        return url


class Strategy:  # pylint: disable=too-few-public-methods
    """
    A cache warm up strategy.

    Each strategy defines a `get_urls` method that returns a list of URLs to
    be fetched from the `/superset/warm_up_cache/` endpoint.

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

    def get_urls(self) -> List[str]:
        raise NotImplementedError("Subclasses must implement get_urls!")


class DummyStrategy(Strategy):  # pylint: disable=too-few-public-methods
    """
    Warm up all charts.

    This is a dummy strategy that will fetch all charts. Can be configured by:

        beat_schedule = {
            'cache-warmup-hourly': {
                'task': 'cache-warmup',
                'schedule': crontab(minute=1, hour='*'),  # @hourly
                'kwargs': {'strategy_name': 'dummy'},
            },
        }

    """

    name = "dummy"

    def get_urls(self) -> List[str]:
        session = db.create_scoped_session()
        charts = session.query(Slice).all()

        return [get_url(chart) for chart in charts]


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

    def get_urls(self) -> List[str]:
        urls = []
        session = db.create_scoped_session()

        records = (
            session.query(Log.dashboard_id, func.count(Log.dashboard_id))
            .filter(and_(Log.dashboard_id.isnot(None), Log.dttm >= self.since))
            .group_by(Log.dashboard_id)
            .order_by(func.count(Log.dashboard_id).desc())
            .limit(self.top_n)
            .all()
        )
        dash_ids = [record.dashboard_id for record in records]
        dashboards = session.query(Dashboard).filter(Dashboard.id.in_(dash_ids)).all()
        for dashboard in dashboards:
            for chart in dashboard.slices:
                urls.append(get_url(chart, dashboard))

        return urls


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

    def __init__(self, tags: Optional[List[str]] = None) -> None:
        super().__init__()
        self.tags = tags or []

    def get_urls(self) -> List[str]:
        urls = []
        session = db.create_scoped_session()

        tags = session.query(Tag).filter(Tag.name.in_(self.tags)).all()
        tag_ids = [tag.id for tag in tags]

        # add dashboards that are tagged
        tagged_objects = (
            session.query(TaggedObject)
            .filter(
                and_(
                    TaggedObject.object_type == "dashboard",
                    TaggedObject.tag_id.in_(tag_ids),
                )
            )
            .all()
        )
        dash_ids = [tagged_object.object_id for tagged_object in tagged_objects]
        tagged_dashboards = session.query(Dashboard).filter(Dashboard.id.in_(dash_ids))
        for dashboard in tagged_dashboards:
            for chart in dashboard.slices:
                urls.append(get_url(chart))

        # add charts that are tagged
        tagged_objects = (
            session.query(TaggedObject)
            .filter(
                and_(
                    TaggedObject.object_type == "chart",
                    TaggedObject.tag_id.in_(tag_ids),
                )
            )
            .all()
        )
        chart_ids = [tagged_object.object_id for tagged_object in tagged_objects]
        tagged_charts = session.query(Slice).filter(Slice.id.in_(chart_ids))
        for chart in tagged_charts:
            urls.append(get_url(chart))

        return urls


strategies = [DummyStrategy, TopNDashboardsStrategy, DashboardTagsStrategy]


@celery_app.task(name="fetch_url")
def fetch_url(url: str, headers: Dict[str, str]) -> Dict[str, str]:
    """
    Celery job to fetch url
    """
    result = {}
    try:
        logger.info("Fetching %s", url)
        req = request.Request(url, headers=headers)
        response = request.urlopen(  # pylint: disable=consider-using-with
            req, timeout=600
        )
        logger.info("Fetched %s, status code: %s", url, response.code)
        if response.code == 200:
            result = {"success": url, "response": response.read().decode("utf-8")}
        else:
            result = {"error": url, "status_code": response.code}
            logger.error("Error fetching %s, status code: %s", url, response.code)
    except URLError as err:
        logger.exception("Error warming up cache!")
        result = {"error": url, "exception": str(err)}
    return result


@celery_app.task(name="cache-warmup")
def cache_warmup(
    strategy_name: str, *args: Any, **kwargs: Any
) -> Union[Dict[str, List[str]], str]:
    """
    Warm up cache.

    This task periodically hits charts to warm up the cache.

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

    user = security_manager.get_user_by_username(app.config["THUMBNAIL_SELENIUM_USER"])
    cookies = MachineAuthProvider.get_auth_cookies(user)
    headers = {"Cookie": f"session={cookies.get('session', '')}"}

    results: Dict[str, List[str]] = {"scheduled": [], "errors": []}
    for url in strategy.get_urls():
        try:
            logger.info("Scheduling %s", url)
            fetch_url.delay(url, headers)
            results["scheduled"].append(url)
        except SchedulingError:
            logger.exception("Error scheduling fetch_url: %s", url)
            results["errors"].append(url)

    return results
