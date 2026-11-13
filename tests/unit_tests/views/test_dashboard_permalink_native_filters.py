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
"""Report native filters must survive the dashboard permalink redirect."""

from typing import Any
from urllib.parse import parse_qs, urlsplit

import pytest
import rison
from pytest_mock import MockerFixture

from superset.reports.models import ReportSchedule

NATIVE_FILTERS: dict[str, list[dict[str, Any]]] = {
    "multi_word": [
        {
            "nativeFilterId": "F1",
            "filterType": "filter_select",
            "columnName": "region",
            "filterValues": ["North America", "Electronic Arts"],
        }
    ],
    "comma_and_quote": [
        {
            "nativeFilterId": "F1",
            "filterType": "filter_select",
            "columnName": "name",
            "filterValues": ["Smith, John", "O'Brien"],
        }
    ],
    "numeric_range": [
        {
            "nativeFilterId": "F2",
            "filterType": "filter_range",
            "columnName": "num",
            "filterValues": [3000, 5000],
        }
    ],
    "time_range": [
        {
            "nativeFilterId": "F3",
            "filterType": "filter_time",
            "columnName": "ds",
            "filterValues": ["2004-01-01 : 2005-01-01"],
        },
        {
            "nativeFilterId": "F4",
            "filterType": "filter_time",
            "columnName": "ds",
            "filterValues": ["Last week"],
        },
    ],
}


@pytest.mark.parametrize("case", list(NATIVE_FILTERS))
def test_dashboard_permalink_redirect_native_filters_round_trip(
    case: str,
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    report_schedule = ReportSchedule()
    extra: dict[str, Any] = {"dashboard": {"nativeFilters": NATIVE_FILTERS[case]}}
    report_schedule.extra = extra  # type: ignore[assignment]
    native_filters, warnings = report_schedule.get_native_filters_params()
    assert warnings == []

    mocker.patch(
        "superset.commands.dashboard.permalink.get.GetDashboardPermalinkCommand.run",
        return_value={
            "dashboardId": 1,
            "state": {"urlParams": [["native_filters", native_filters]]},
        },
    )
    response = client.get("/dashboard/p/abc/")

    assert response.status_code == 302
    query = parse_qs(urlsplit(response.headers["Location"]).query)
    expected: dict[str, Any] = {}
    for native_filter in NATIVE_FILTERS[case]:
        config, _ = report_schedule._generate_native_filter(
            native_filter["nativeFilterId"],
            native_filter["filterType"],
            native_filter["columnName"],
            native_filter["filterValues"],
        )
        expected.update(config)
    assert rison.loads(query["native_filters"][0]) == expected
