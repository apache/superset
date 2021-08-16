from typing import List, Optional

from sqlalchemy import and_

from superset import db
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.models.tags import Tag, TaggedObject
from superset.tasks.caching.strategies.utils import get_url
from superset.tasks.caching.strategy import Strategy


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
