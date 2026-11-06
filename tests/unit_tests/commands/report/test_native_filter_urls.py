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

from inspect import unwrap
from urllib.parse import parse_qs, urlsplit
from uuid import uuid4

import pytest
import rison
from pytest_mock import MockerFixture

from superset.app import SupersetApp
from superset.commands.report.execute import BaseReportState
from superset.models.dashboard import Dashboard
from superset.reports.models import ReportSchedule
from superset.views.core import Superset


@pytest.mark.parametrize(
    "tabs_enabled,anchor,expected_anchors",
    [
        (False, None, [""]),
        (True, None, [""]),
        (True, "TAB-1", ["TAB-1"]),
        (True, '["TAB-1", "TAB-2"]', ["TAB-1", "TAB-2"]),
    ],
)
def test_report_filters_survive_permalink_redirect(
    app: SupersetApp,
    mocker: MockerFixture,
    tabs_enabled: bool,
    anchor: str | None,
    expected_anchors: list[str],
) -> None:
    """Dashboard capture URLs preserve report filters after the browser decodes them."""
    values = ["Company 2", "O'Brien", "São Paulo", "R&D #1 + 50%", "literal%27"]
    dashboard = Dashboard(id=123, uuid=uuid4())
    schedule = ReportSchedule(
        dashboard=dashboard,
        dashboard_id=dashboard.id,
        force_screenshot=False,
        extra={
            "dashboard": {
                "anchor": anchor,
                "urlParams": [["standalone", "3"]],
                "nativeFilters": [
                    {
                        "nativeFilterId": "company",
                        "filterType": "filter_select",
                        "columnName": "company_name",
                        "filterValues": values,
                    },
                    {
                        "nativeFilterId": "period",
                        "filterType": "filter_time",
                        "columnName": "dttm",
                        "filterValues": ["Last week"],
                    },
                ],
            }
        },
    )
    mocker.patch(
        "superset.commands.report.execute.feature_flag_manager.is_feature_enabled",
        return_value=tabs_enabled,
    )
    create_permalink = mocker.patch(
        "superset.commands.report.execute.CreateDashboardPermalinkCommand"
    )
    create_permalink.return_value.run.return_value = "report-key"
    mocker.patch("superset.commands.report.execute.db.session.commit")
    get_permalink = mocker.patch("superset.views.core.GetDashboardPermalinkCommand.run")

    report = BaseReportState(schedule, "2026-10-19", "report-execution")
    urls = report.get_dashboard_urls()

    assert len(urls) == len(expected_anchors)
    for url, call, expected_anchor in zip(
        urls, create_permalink.call_args_list, expected_anchors, strict=True
    ):
        get_permalink.return_value = {
            "dashboardId": str(dashboard.uuid),
            "state": call.kwargs["state"],
        }
        with app.test_request_context(url):
            # Exercise the redirect itself; authorization and storage are independent.
            response = unwrap(Superset.dashboard_permalink)(Superset(), "report-key")

        assert response.status_code == 302
        location = urlsplit(response.headers["Location"])
        params = parse_qs(location.query)
        assert set(params) == {"permalink_key", "native_filters", "standalone", "force"}
        assert params["standalone"] == ["3"]
        assert params["force"] == ["false"]
        assert location.fragment == expected_anchor
        decoded = rison.loads(params["native_filters"][0])
        assert decoded["company"]["extraFormData"]["filters"] == [
            {"col": "company_name", "op": "IN", "val": values}
        ]
        assert decoded["company"]["filterState"]["value"] == values
        assert decoded["period"]["extraFormData"] == {"time_range": "Last week"}
