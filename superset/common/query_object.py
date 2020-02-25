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
# pylint: disable=R
import hashlib
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Union

import simplejson as json

from superset import app
from superset.utils import core as utils

# TODO: Type Metrics dictionary with TypedDict when it becomes a vanilla python type
# https://github.com/python/mypy/issues/5288


class QueryObject:
    """
    The query object's schema matches the interfaces of DB connectors like sqla
    and druid. The query objects are constructed on the client.
    """

    granularity: str
    from_dttm: datetime
    to_dttm: datetime
    is_timeseries: bool
    time_shift: Optional[timedelta]
    groupby: List[str]
    metrics: List[Union[Dict, str]]
    row_limit: int
    filter: List[str]
    timeseries_limit: int
    timeseries_limit_metric: Optional[Dict]
    order_desc: bool
    extras: Dict
    columns: List[str]
    orderby: List[List]

    def __init__(
        self,
        granularity: str,
        metrics: List[Union[Dict, str]],
        groupby: Optional[List[str]] = None,
        filters: Optional[List[str]] = None,
        time_range: Optional[str] = None,
        time_shift: Optional[str] = None,
        is_timeseries: bool = False,
        timeseries_limit: int = 0,
        row_limit: int = app.config["ROW_LIMIT"],
        timeseries_limit_metric: Optional[Dict] = None,
        order_desc: bool = True,
        extras: Optional[Dict] = None,
        columns: Optional[List[str]] = None,
        orderby: Optional[List[List]] = None,
        relative_start: str = app.config["DEFAULT_RELATIVE_START_TIME"],
        relative_end: str = app.config["DEFAULT_RELATIVE_END_TIME"],
    ):
        self.granularity = granularity
        self.from_dttm, self.to_dttm = utils.get_since_until(
            relative_start=relative_start,
            relative_end=relative_end,
            time_range=time_range,
            time_shift=time_shift,
        )
        self.is_timeseries = is_timeseries
        self.time_range = time_range
        self.time_shift = utils.parse_human_timedelta(time_shift)
        self.groupby = groupby or []

        # Temporal solution for backward compatability issue due the new format of
        # non-ad-hoc metric which needs to adhere to superset-ui per
        # https://git.io/Jvm7P.
        self.metrics = [
            metric if "expressionType" in metric else metric["label"]  # type: ignore
            for metric in metrics
        ]

        self.row_limit = row_limit
        self.filter = filters or []
        self.timeseries_limit = timeseries_limit
        self.timeseries_limit_metric = timeseries_limit_metric
        self.order_desc = order_desc
        self.extras = extras or {}
        self.columns = columns or []
        self.orderby = orderby or []

    def to_dict(self) -> Dict[str, Any]:
        query_object_dict = {
            "granularity": self.granularity,
            "from_dttm": self.from_dttm,
            "to_dttm": self.to_dttm,
            "is_timeseries": self.is_timeseries,
            "groupby": self.groupby,
            "metrics": self.metrics,
            "row_limit": self.row_limit,
            "filter": self.filter,
            "timeseries_limit": self.timeseries_limit,
            "timeseries_limit_metric": self.timeseries_limit_metric,
            "order_desc": self.order_desc,
            "extras": self.extras,
            "columns": self.columns,
            "orderby": self.orderby,
        }
        return query_object_dict

    def cache_key(self, **extra) -> str:
        """
        The cache key is made out of the key/values from to_dict(), plus any
        other key/values in `extra`
        We remove datetime bounds that are hard values, and replace them with
        the use-provided inputs to bounds, which may be time-relative (as in
        "5 days ago" or "now").
        """
        cache_dict = self.to_dict()
        cache_dict.update(extra)

        for k in ["from_dttm", "to_dttm"]:
            del cache_dict[k]
        if self.time_range:
            cache_dict["time_range"] = self.time_range
        json_data = self.json_dumps(cache_dict, sort_keys=True)
        return hashlib.md5(json_data.encode("utf-8")).hexdigest()

    def json_dumps(self, obj: Any, sort_keys: bool = False) -> str:
        return json.dumps(
            obj, default=utils.json_int_dttm_ser, ignore_nan=True, sort_keys=sort_keys
        )
