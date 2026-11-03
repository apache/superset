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
from typing import Any

from pytest_mock import MockerFixture

from superset.commands.report.exceptions import ReportConfigConflictError
from tests.unit_tests.conftest import with_feature_flags

CONFIG = {
    "alerts_attach_reports": True,
    "alert_minimum_interval": 0,
    "report_minimum_interval": 600,
    "limit_recipients_to_users": False,
    "allowed_email_domains": ["example.com"],
}


@with_feature_flags(ALERT_REPORTS=True)
def test_get_configuration_returns_effective_values(
    mocker: MockerFixture,
    client: Any,
    full_api_access: None,
) -> None:
    mocker.patch(
        "superset.reports.api.ReportConfigDAO.get_effective_config",
        return_value=CONFIG,
    )
    rv = client.get("/api/v1/report/configuration/")
    assert rv.status_code == 200
    assert rv.json["result"] == CONFIG


@with_feature_flags(ALERT_REPORTS=True)
def test_put_configuration_requires_admin(
    mocker: MockerFixture,
    client: Any,
    full_api_access: None,
) -> None:
    mocker.patch("superset.reports.api.security_manager.is_admin", return_value=False)
    run = mocker.patch("superset.reports.api.UpdateReportConfigCommand.run")
    rv = client.put(
        "/api/v1/report/configuration/", json={"alerts_attach_reports": False}
    )
    assert rv.status_code == 403
    run.assert_not_called()


@with_feature_flags(ALERT_REPORTS=True)
def test_put_configuration_saves_and_returns_config(
    mocker: MockerFixture,
    client: Any,
    full_api_access: None,
) -> None:
    mocker.patch("superset.reports.api.security_manager.is_admin", return_value=True)
    command = mocker.patch("superset.reports.api.UpdateReportConfigCommand")
    command.return_value.run.return_value = CONFIG
    payload = {
        "alerts_attach_reports": True,
        "allowed_email_domains": [
            " @Example.COM ",
            "example.com",
            "partner.org",
            "PRESET.*",
        ],
    }
    rv = client.put("/api/v1/report/configuration/", json=payload)
    assert rv.status_code == 200
    assert rv.json["result"] == CONFIG
    # Domains are normalized and de-duplicated before reaching the command.
    command.assert_called_once_with(
        {
            "alerts_attach_reports": True,
            "allowed_email_domains": ["example.com", "partner.org", "preset.*"],
        }
    )


@with_feature_flags(ALERT_REPORTS=True)
def test_put_configuration_rejects_invalid_payload(
    mocker: MockerFixture,
    client: Any,
    full_api_access: None,
) -> None:
    mocker.patch("superset.reports.api.security_manager.is_admin", return_value=True)
    rv = client.put(
        "/api/v1/report/configuration/",
        json={"allowed_email_domains": ["not a domain"], "alert_minimum_interval": -1},
    )
    assert rv.status_code == 400
    assert "allowed_email_domains" in rv.json["message"]
    assert "alert_minimum_interval" in rv.json["message"]


@with_feature_flags(ALERT_REPORTS=True)
def test_put_configuration_returns_impacted_schedules_on_conflict(
    mocker: MockerFixture,
    client: Any,
    full_api_access: None,
) -> None:
    mocker.patch("superset.reports.api.security_manager.is_admin", return_value=True)
    impacted = [
        {
            "id": 7,
            "name": "External digest",
            "type": "Report",
            "reason": "recipient",
            "detail": "someone@other.org",
        }
    ]
    mocker.patch(
        "superset.reports.api.UpdateReportConfigCommand.run",
        side_effect=ReportConfigConflictError(impacted),
    )
    rv = client.put(
        "/api/v1/report/configuration/",
        json={"allowed_email_domains": ["example.com"]},
    )
    assert rv.status_code == 422
    assert rv.json["impacted_schedules"] == impacted
    assert "conflict" in rv.json["message"]
