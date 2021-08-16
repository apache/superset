from typing import List

from maf.tests.models import Slice

from superset import db
from superset.tasks.caching.strategies.utils import get_url
from superset.tasks.caching.strategy import Strategy


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
