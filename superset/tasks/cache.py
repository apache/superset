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
import urllib.parse

from celery.utils.log import get_task_logger
from flask import url_for
import requests
from sqlalchemy import and_, func

from superset import app, db
from superset.models.core import Dashboard, Log, Slice
from superset.models.tags import Tag, TaggedObject
from superset.tasks.celery_app import app as celery_app


logger = get_task_logger(__name__)
logger.setLevel(logging.INFO)


def get_url(params):
    """Return external URL for warming up a given chart/table cache."""
    baseurl = 'http://{SUPERSET_WEBSERVER_ADDRESS}:{SUPERSET_WEBSERVER_PORT}/'.format(
        **app.config)
    with app.test_request_context():
        return urllib.parse.urljoin(
            baseurl,
            url_for('Superset.warm_up_cache', **params),
        )


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
                    'n': 10,
                },
            },
        }

    """
    def __init__(self):
        pass

    def get_urls(self):
        raise NotImplementedError('Subclasses must implement get_urls!')


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

    name = 'dummy'

    def get_urls(self):
        session = db.session()
        charts = session.query(Slice).all()

        return [get_url({'slice_id': chart.id}) for chart in charts]


class TopNDashboardsStrategy(Strategy):
    """
    Warm up charts in the top-n dashboards.

        CELERYBEAT_SCHEDULE = {
            'cache-warmup-hourly': {
                'task': 'cache-warmup',
                'schedule': crontab(minute=1, hour='*'),  # @hourly
                'kwargs': {
                    'strategy_name': 'top_n_dashboards',
                    'n': 5,
                },
            },
        }

    """

    name = 'top_n_dashboards'

    def __init__(self, n=5):
        self.n = n

    def get_urls(self):
        session = db.session()
        charts = set()

        records = (
            session
            .query(Log)
            .filter(Log.dashboard_id.isnot(None))
            .group_by(Log.dashboard_id)
            .order_by(func.count(Log.dashboard_id).desc())
            .limit(self.n)
            .all()
        )
        dash_ids = [record.dashboard_id for record in records]
        dashboards = (
            session
            .query(Dashboard)
            .filter(Dashboard.id.in_(dash_ids))
        )
        for dashboard in dashboards:
            charts.update(dashboard.slices)

        return [get_url({'slice_id': chart.id}) for chart in charts]


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

    name = 'dashboard_tags'

    def __init__(self, tags=None):
        self.tags = tags or []

    def get_urls(self):
        session = db.session()
        charts = set()

        tags = (
            session
            .query(Tag)
            .filter(Tag.name.in_(self.tags))
            .all()
        )
        tag_ids = [tag.id for tag in tags]

        # add dashboards that are tagged
        tagged_objects = (
            session
            .query(TaggedObject)
            .filter(and_(
                TaggedObject.object_type == 'dashboard',
                TaggedObject.tag_id.in_(tag_ids),
            ))
            .all()
        )
        dash_ids = [tagged_object.object_id for tagged_object in tagged_objects]
        tagged_dashboards = (
            session
            .query(Dashboard)
            .filter(Dashboard.id.in_(dash_ids))
        )
        for dashboard in tagged_dashboards:
            charts.update(dashboard.slices)

        # add charts that are tagged
        tagged_objects = (
            session
            .query(TaggedObject)
            .filter(and_(
                TaggedObject.object_type == 'chart',
                TaggedObject.tag_id.in_(tag_ids),
            ))
            .all()
        )
        chart_ids = [tagged_object.object_id for tagged_object in tagged_objects]
        tagged_charts = (
            session
            .query(Slice)
            .filter(Slice.id.in_(chart_ids))
        )
        charts.update(tagged_charts)

        return [get_url({'slice_id': chart.id}) for chart in charts]


strategies = [DummyStrategy, TopNDashboardsStrategy, DashboardTagsStrategy]


@celery_app.task(name='cache-warmup')
def cache_warmup(strategy_name, *args, **kwargs):
    """
    Warm up cache.

    This task periodically hits charts to warm up the cache.

    """
    logger.info('Loading strategy')
    for class_ in strategies:
        if class_.name == strategy_name:
            break
    else:
        logger.error(f'No strategy {strategy_name} found!')
        return

    logger.info(f'Loading {class_.__name__}')
    try:
        strategy = class_(*args, **kwargs)
        logger.info('Success!')
    except Exception:
        logger.exception('Error loading strategy!')
        return

    results = {'success': [], 'errors': []}
    for url in strategy.get_urls():
        print(url)
        try:
            logger.info(f'Fetching {url}')
            requests.get(url)
            results['success'].append(url)
        except Exception:
            logger.exception('Error warming up cache!')
            results['errors'].append(url)

    return results
