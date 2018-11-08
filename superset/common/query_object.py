# pylint: disable=R
from typing import Dict, List, Optional, Union

from superset import app
from superset.utils import core as utils

# TODO: Type Metrics dictionary with TypedDict when it becomes a vanilla python type
# https://github.com/python/mypy/issues/5288
Metric = Union[str, Dict]


class QueryObject:
    """
    The query object's schema matches the interfaces of DB connectors like sqla
    and druid. The query objects are constructed on the client.
    """
    def __init__(
            self,
            granularity: str,
            groupby: List[str],
            metrics: List[Metric],
            filters: List[str],
            time_range: Optional[str] = None,
            time_shift: Optional[str] = None,
            is_timeseries: bool = False,
            row_limit: int = app.config.get('ROW_LIMIT'),
            limit: int = 0,
            timeseries_limit_metric: Optional[Metric] = None,
            order_desc: bool = True,
            extras: Optional[Dict] = None,
    ):
        self.granularity = granularity
        self.from_dttm, self.to_dttm = utils.get_since_until(time_range, time_shift)
        self.is_timeseries = is_timeseries
        self.groupby = groupby
        self.metrics = metrics
        self.row_limit = row_limit
        self.filter = filters
        self.timeseries_limit = int(limit)
        self.timeseries_limit_metric = timeseries_limit_metric
        self.order_desc = order_desc
        self.prequeries = []
        self.is_prequery = False
        self.extras = extras

    def to_dict(self):
        raise NotImplementedError()
