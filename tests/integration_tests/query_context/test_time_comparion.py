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
from datetime import datetime
from typing import TYPE_CHECKING

from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.common.query_context import QueryContext
from superset.common.query_object import QueryObject

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable


def test_time_comparison(load_sales_dataset: SqlaTable) -> None:
    query_context = QueryContext(
        datasource=load_sales_dataset,
        queries=[],
        form_data={},
        result_type=ChartDataResultType.FULL,
        result_format=ChartDataResultFormat.JSON,
        force=True,
        cache_values={},
    )
    query_object = QueryObject(
        metrics=["count"],
        columns=["order_date"],
        orderby=[
            (
                "order_date",
                True,
            )
        ],
        granularity="order_date",
        extras={"time_grain_sqla": "P1M"},
        from_dttm=datetime(2004, 1, 1),
        to_dttm=datetime(2005, 1, 1),
        row_limit=100000,
    )
    rv_2014 = query_context.get_df_payload(query_object, force_cached=True)
    """
    >>> rv_2014['df']
           order_date  count
    0  2004-01-01     91
    1  2004-02-01     86
    2  2004-03-01     56
    3  2004-04-01     64
    4  2004-05-01     74
    5  2004-06-01     85
    6  2004-07-01     91
    7  2004-08-01    133
    8  2004-09-01     95
    9  2004-10-01    159
    10 2004-11-01    301
    11 2004-12-01    110
    """

    query_object = QueryObject(
        metrics=["count"],
        columns=["order_date"],
        orderby=[
            (
                "order_date",
                True,
            )
        ],
        granularity="order_date",
        extras={"time_grain_sqla": "P1M"},
        from_dttm=datetime(2003, 1, 1),
        to_dttm=datetime(2004, 1, 1),
        row_limit=100000,
    )
    rv_2013 = query_context.get_df_payload(query_object, force_cached=True)
    """
    >>> rv_2013['df']
           order_date  count
    0  2003-01-01     39
    1  2003-02-01     41
    2  2003-03-01     50
    3  2003-04-01     58
    4  2003-05-01     58
    5  2003-06-01     46
    6  2003-07-01     50
    7  2003-08-01     58
    8  2003-09-01     76
    9  2003-10-01    158
    10 2003-11-01    296
    11 2003-12-01     70
    """

    query_object = QueryObject(
        metrics=["count"],
        columns=["order_date"],
        orderby=[
            (
                "order_date",
                True,
            )
        ],
        granularity="order_date",
        extras={"time_grain_sqla": "P1M"},
        from_dttm=datetime(2004, 1, 1),
        to_dttm=datetime(2005, 1, 1),
        row_limit=100000,
        time_offsets=["1 year ago"],
    )
    rv_2014_2013 = query_context.get_df_payload(query_object, force_cached=True)

    assert rv_2014_2013["df"]["order_date"].equals(rv_2014["df"]["order_date"])
    assert rv_2014_2013["df"]["count"].equals(rv_2014["df"]["count"])
    assert rv_2014_2013["df"]["count__1 year ago"].equals(rv_2013["df"]["count"])
