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

from superset.common.query_object import QueryObject


def test_get_series_limit_prequery_obj():
    """
    Test get_series_limit_prequery_obj method
    """
    # Create a QueryObject with series limit settings
    query_object = QueryObject(
        columns=["country", "year"],
        metrics=["sum__sales"],
        series_limit=10,
        from_dttm=datetime(2020, 1, 1),
        to_dttm=datetime(2021, 1, 1),
        filters=[{"col": "region", "op": "IN", "val": ["US", "EU"]}],
        extras={"time_grain_sqla": "P1D"},
        order_desc=False,
    )

    # Test basic prequery object creation
    prequery_obj = query_object.get_series_limit_prequery_obj(
        granularity="ds",
        inner_from_dttm=None,
        inner_to_dttm=None,
    )

    assert prequery_obj["is_timeseries"] is False
    assert prequery_obj["row_limit"] == 10
    assert prequery_obj["metrics"] == ["sum__sales"]
    assert prequery_obj["granularity"] == "ds"
    assert prequery_obj["groupby"] == ["country", "year"]
    assert prequery_obj["from_dttm"] == datetime(2020, 1, 1)
    assert prequery_obj["to_dttm"] == datetime(2021, 1, 1)
    assert prequery_obj["filter"] == [
        {"col": "region", "op": "IN", "val": ["US", "EU"]}
    ]
    assert prequery_obj["orderby"] == []
    assert prequery_obj["extras"] == {"time_grain_sqla": "P1D"}
    assert prequery_obj["order_desc"] is True  # Always True for prequery


def test_get_series_limit_prequery_obj_with_overrides():
    """
    Test get_series_limit_prequery_obj with inner dates and orderby override
    """
    query_object = QueryObject(
        columns=["country"],
        metrics=["count"],
        series_limit=5,
        from_dttm=datetime(2020, 1, 1),
        to_dttm=datetime(2021, 1, 1),
    )

    # Test with inner dates and custom orderby
    inner_from = datetime(2020, 6, 1)
    inner_to = datetime(2020, 12, 31)
    custom_orderby = [("sum__revenue", False)]

    prequery_obj = query_object.get_series_limit_prequery_obj(
        granularity="date_col",
        inner_from_dttm=inner_from,
        inner_to_dttm=inner_to,
        orderby=custom_orderby,
    )

    assert prequery_obj["from_dttm"] == inner_from
    assert prequery_obj["to_dttm"] == inner_to
    assert prequery_obj["orderby"] == custom_orderby


def test_get_series_limit_prequery_obj_base_axis_filtering():
    """
    Test that base axis columns are filtered out in prequery
    """
    # Mock the x-axis column with proper structure for base axis
    query_object = QueryObject(
        columns=[
            {
                "label": "__timestamp",
                "sqlExpression": "__timestamp",
                "columnType": "BASE_AXIS",
            },
            "country",
            "city",
        ],
        metrics=["revenue"],
        series_limit=20,
    )

    prequery_obj = query_object.get_series_limit_prequery_obj(
        granularity=None,
        inner_from_dttm=None,
        inner_to_dttm=None,
    )

    # The columns in prequery should exclude the base axis column
    assert prequery_obj["columns"] == ["country", "city"]
