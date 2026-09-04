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
from unittest import mock

import pytest

from superset.common.utils.time_range_utils import (
    get_since_until_from_query_object,
    get_since_until_from_time_range,
)


def test__get_since_until_from_time_range():
    assert get_since_until_from_time_range(time_range="2001 : 2002") == (
        datetime(2001, 1, 1),
        datetime(2002, 1, 1),
    )
    assert get_since_until_from_time_range(
        time_range="2001 : 2002", time_shift="8 hours ago"
    ) == (
        datetime(2000, 12, 31, 16, 0, 0),
        datetime(2001, 12, 31, 16, 0, 0),
    )
    with mock.patch(
        "superset.utils.date_parser.EvalDateTruncFunc.eval",
        return_value=datetime(2000, 1, 1, 0, 0, 0),
    ):
        assert (
            get_since_until_from_time_range(
                time_range="Last year",
                extras={
                    "relative_end": "2100",
                },
            )
        )[1] == datetime(2100, 1, 1, 0, 0)
    with mock.patch(
        "superset.utils.date_parser.EvalDateTruncFunc.eval",
        return_value=datetime(2000, 1, 1, 0, 0, 0),
    ):
        assert (
            get_since_until_from_time_range(
                time_range="Next year",
                extras={
                    "relative_start": "2000",
                },
            )
        )[0] == datetime(2000, 1, 1, 0, 0)


@pytest.mark.query_object(
    {
        "time_range": "2001 : 2002",
        "time_shift": "8 hours ago",
    }
)
def test__since_until_from_time_range(dummy_query_object):
    assert get_since_until_from_query_object(dummy_query_object) == (
        datetime(2000, 12, 31, 16, 0, 0),
        datetime(2001, 12, 31, 16, 0, 0),
    )


@pytest.mark.query_object(
    {
        "filters": [{"col": "dttm", "op": "TEMPORAL_RANGE", "val": "2001 : 2002"}],
        "columns": [
            {
                "columnType": "BASE_AXIS",
                "label": "dttm",
                "sqlExpression": "dttm",
            }
        ],
    }
)
def test__since_until_from_adhoc_filters(dummy_query_object):
    assert get_since_until_from_query_object(dummy_query_object) == (
        datetime(2001, 1, 1, 0, 0, 0),
        datetime(2002, 1, 1, 0, 0, 0),
    )
