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
"""Chart/dashboard ids written to the log context are coerced to ints."""

from __future__ import annotations

import pytest


@pytest.mark.parametrize(
    "value,expected",
    [
        (5, 5),
        ("5", 5),
        (None, None),
        ("", None),
        ("not-an-int", None),
        ("5\nextra", None),
        ({"nested": "dict"}, None),
    ],
)
def test_as_int_coerces_or_drops(value, expected) -> None:
    from superset.charts.data.api import ChartDataRestApi

    assert ChartDataRestApi._as_int(value) == expected


def test_map_form_data_keeps_ids_as_ints(app_context: None) -> None:
    from superset.charts.data.api import ChartDataRestApi

    api = ChartDataRestApi()
    mapped = api._map_form_data_datasource_to_dataset_id(
        {
            "form_data": {"dashboardId": "7", "slice_id": "9\nextra"},
            "datasource": {"id": 3, "type": "table"},
        }
    )
    assert mapped["dashboard_id"] == 7
    assert mapped["slice_id"] is None  # non-int string is dropped, not carried through
    assert mapped["dataset_id"] == 3
