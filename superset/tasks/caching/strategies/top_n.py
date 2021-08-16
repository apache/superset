from typing import Any, Dict, List, Optional, Union

from sqlalchemy import and_, func

from superset import db
from superset.models.core import Log
from superset.models.dashboard import Dashboard
from superset.tasks.caching.strategies.utils import get_form_data, get_url
from superset.tasks.caching.strategy import Strategy
from superset.utils.date_parser import parse_human_datetime


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
                form_data_with_filters = get_form_data(chart.id, dashboard)
                urls.append(get_url(chart, form_data_with_filters))

        return urls
