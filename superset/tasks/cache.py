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
# pylint: disable=too-few-public-methods

import json
import logging
from typing import Any, Dict, List, Optional, Union
from urllib import request
from urllib.error import URLError

from celery.utils.log import get_task_logger
from sqlalchemy import and_, func

from superset import app, db
from superset.extensions import celery_app
from superset.models.core import Log
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.models.tags import Tag, TaggedObject
from superset.utils.core import parse_human_datetime
from superset.views.utils import build_extra_filters

logger = get_task_logger(__name__)
logger.setLevel(logging.INFO)


def get_form_data(
    chart_id: int, dashboard: Optional[Dashboard] = None
) -> Dict[str, Any]:
    """
    Build `form_data` for chart GET request from dashboard's `default_filters`.

    When a dashboard has `default_filters` they need to be added  as extra
    filters in the GET request for charts.

    """
    form_data: Dict[str, Any] = {"slice_id": chart_id}

    if dashboard is None or not dashboard.json_metadata:
        return form_data

    json_metadata = json.loads(dashboard.json_metadata)
    default_filters = json.loads(json_metadata.get("default_filters", "null"))
    if not default_filters:
        return form_data

    filter_scopes = json_metadata.get("filter_scopes", {})
    layout = json.loads(dashboard.position_json or "{}")
    if (
        isinstance(layout, dict)
        and isinstance(filter_scopes, dict)
        and isinstance(default_filters, dict)
    ):
        extra_filters = build_extra_filters(
            layout, filter_scopes, default_filters, chart_id
        )
        if extra_filters:
            form_data["extra_filters"] = extra_filters

    return form_data


def get_url(chart: Slice, extra_filters: Optional[Dict[str, Any]] = None) -> str:
    """Return external URL for warming up a given chart/table cache."""
    with app.test_request_context():
        baseurl = (
            "{SUPERSET_WEBSERVER_PROTOCOL}://"
            "{SUPERSET_WEBSERVER_ADDRESS}:"
            "{SUPERSET_WEBSERVER_PORT}".format(**app.config)
        )
        return f"{baseurl}{chart.get_explore_url(overrides=extra_filters)}"


class Strategy:
    """
    A cache warm up strategy.

    Each strategy defines a `get_urls` method that returns a list of URLs to
    be fetched from the `/superset/warm_up_cache/` endpoint.

    Strategies can be configured in `superset/config.py`:

        CELERYBEAT_SCHEDULE = {
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


class DummyStrategy(Strategy):
    """
    Warm up all charts.

    This is a dummy strategy that will fetch all charts. Can be configured by:

        CELERYBEAT_SCHEDULE = {
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


class TopNDashboardsStrategy(Strategy):
    """
    Warm up charts in the top-n dashboards.

        CELERYBEAT_SCHEDULE = {
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
        super(TopNDashboardsStrategy, self).__init__()
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
                form_data_with_filters = get_form_data(chart.id, dashboard)
                urls.append(get_url(chart, form_data_with_filters))

        return urls


class DashboardTagsStrategy(Strategy):
    """
    Warm up charts in dashboards with custom tags.

        CELERYBEAT_SCHEDULE = {
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
        super(DashboardTagsStrategy, self).__init__()
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
        logger.error(message)
        return message

    logger.info("Loading %s", class_.__name__)
    try:
        strategy = class_(*args, **kwargs)
        logger.info("Success!")
    except TypeError:
        message = "Error loading strategy!"
        logger.exception(message)
        return message

    results: Dict[str, List[str]] = {"success": [], "errors": []}
    for url in strategy.get_urls():
        try:
            logger.info("Fetching %s", url)
            request.urlopen(url)
            results["success"].append(url)
        except URLError:
            logger.exception("Error warming up cache!")
            results["errors"].append(url)

    return results
