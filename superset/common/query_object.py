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
from typing import Dict, List, Optional

from superset import app
from superset.utils import core as utils

# TODO: Type Metrics dictionary with TypedDict when it becomes a vanilla python type
# https://github.com/python/mypy/issues/5288
Metric = Dict


class QueryObject:
    """
    The query object's schema matches the interfaces of DB connectors like sqla
    and druid. The query objects are constructed on the client.
    """
    def __init__(
            self,
            granularity: str,
            groupby: List[str] = None,
            metrics: List[Metric] = None,
            filters: List[str] = None,
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
        self.groupby = groupby or []
        self.metrics = metrics or []
        self.filter = filters or []
        self.row_limit = row_limit
        self.timeseries_limit = int(limit)
        self.timeseries_limit_metric = timeseries_limit_metric
        self.order_desc = order_desc
        self.prequeries = []
        self.is_prequery = False
        self.extras = extras

    def to_dict(self):
        raise NotImplementedError()
