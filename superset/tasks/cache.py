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
import json
import logging
from typing import Any, Optional, Union
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


def get_payload(chart: Slice, dashboard: Optional[Dashboard] = None) -> dict[str, int]:
    """Return payload for warming up a given chart/table cache."""
    payload = {"chart_id": chart.id}
    if dashboard:
        payload["dashboard_id"] = dashboard.id
    return payload


class Strategy:  # pylint: disable=too-few-public-methods
    """
    A cache warm up strategy.

    Each strategy defines a `get_payloads` method that returns a list of payloads to
    send to the `/api/v1/chart/warm_up_cache` endpoint.

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

    def get_payloads(self) -> list[dict[str, int]]:
        raise NotImplementedError("Subclasses must implement get_payloads!")


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

    def get_payloads(self) -> list[dict[str, int]]:
        session = db.create_scoped_session()

        try:
            charts = session.query(Slice).all()
        finally:
            session.close()

        return [get_payload(chart) for chart in charts]


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

    def get_payloads(self) -> list[dict[str, int]]:
        payloads = []
        session = db.create_scoped_session()

        try:
            records = (
                session.query(Log.dashboard_id, func.count(Log.dashboard_id))
                .filter(and_(Log.dashboard_id.isnot(None), Log.dttm >= self.since))
                .group_by(Log.dashboard_id)
                .order_by(func.count(Log.dashboard_id).desc())
                .limit(self.top_n)
                .all()
            )
            dash_ids = [record.dashboard_id for record in records]
            dashboards = (
                session.query(Dashboard).filter(Dashboard.id.in_(dash_ids)).all()
            )
            for dashboard in dashboards:
                for chart in dashboard.slices:
                    payloads.append(get_payload(chart, dashboard))
        finally:
            session.close()
        return payloads


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

    def get_payloads(self) -> list[dict[str, int]]:
        payloads = []
        session = db.create_scoped_session()

        try:
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
            tagged_dashboards = session.query(Dashboard).filter(
                Dashboard.id.in_(dash_ids)
            )
            for dashboard in tagged_dashboards:
                for chart in dashboard.slices:
                    payloads.append(get_payload(chart))

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
                payloads.append(get_payload(chart))
        finally:
            session.close()
        return payloads


strategies = [DummyStrategy, TopNDashboardsStrategy, DashboardTagsStrategy]


@celery_app.task(name="fetch_url")
def fetch_url(data: str, headers: dict[str, str]) -> dict[str, str]:
    """
    Celery job to fetch url
    """
    result = {}
    try:
        baseurl = app.config["WEBDRIVER_BASEURL"]
        url = f"{baseurl}api/v1/chart/warm_up_cache"
        logger.info("Fetching %s with payload %s", url, data)
        req = request.Request(
            url, data=bytes(data, "utf-8"), headers=headers, method="PUT"
        )
        response = request.urlopen(  # pylint: disable=consider-using-with
            req, timeout=600
        )
        logger.info(
            "Fetched %s with payload %s, status code: %s", url, data, response.code
        )
        if response.code == 200:
            result = {"success": data, "response": response.read().decode("utf-8")}
        else:
            result = {"error": data, "status_code": response.code}
            logger.error(
                "Error fetching %s with payload %s, status code: %s",
                url,
                data,
                response.code,
            )
    except URLError as err:
        logger.exception("Error warming up cache!")
        result = {"error": data, "exception": str(err)}
    return result


@celery_app.task(name="cache-warmup")
def cache_warmup(
    strategy_name: str, *args: Any, **kwargs: Any
) -> Union[dict[str, list[str]], str]:
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
    headers = {
        "Cookie": f"session={cookies.get('session', '')}",
        "Content-Type": "application/json",
    }

    results: dict[str, list[str]] = {"scheduled": [], "errors": []}
    for payload in strategy.get_payloads():
        try:
            payload = json.dumps(payload)
            logger.info("Scheduling %s", payload)
            fetch_url.delay(payload, headers)
            results["scheduled"].append(payload)
        except SchedulingError:
            logger.exception("Error scheduling fetch_url for payload: %s", payload)
            results["errors"].append(payload)

    return results
