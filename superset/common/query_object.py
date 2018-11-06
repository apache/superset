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
            since: Optional[str] = None,
            until: Optional[str] = None,
            time_shift: Optional[str] = None,
            is_timeseries: bool = False,
            row_limit: int = app.config.get('ROW_LIMIT'),
            limit: int = 0,
            timeseries_limit_metric: Optional[Metric] = None,
            order_desc: bool = True,
            extras: Optional[Dict] = None,
    ):
        self.granularity = granularity

        since_dttm, until_dttm = utils.get_since_until(time_range, since, until)
        time_shift_dttm = utils.parse_human_timedelta(time_shift)
        self.from_dttm = None if since_dttm is None else (since_dttm - time_shift_dttm)
        self.to_dttm = None if until_dttm is None else (until_dttm - time_shift_dttm)
        utils.check_from_to_dttm(self.from_dttm, self.to_dttm)

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
        pass

    def get_data(self):
        # TODO: implement
        return ''
