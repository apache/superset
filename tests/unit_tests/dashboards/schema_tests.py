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

import pytest
from marshmallow import ValidationError
from pytest_mock import MockerFixture

from superset.dashboards.schemas import DashboardDatasetSchema, DashboardPostSchema

GUEST_RESTRICTED_FIELDS = [
    "owners",
    "database",
    "sql",
    "select_star",
    "perm",
    "edit_url",
    "fetch_values_predicate",
    "template_params",
]


def _dataset_payload() -> dict[str, Any]:
    return {
        "id": 1,
        "database": {"id": 1, "name": "test_db"},
        "owners": [{"id": 1}],
        "sql": "SELECT 1",
        "select_star": "SELECT * FROM t",
        "perm": "[db].[table]",
        "edit_url": "/edit/1",
        "fetch_values_predicate": "1 = 1",
        "template_params": "{}",
        "table_name": "t",
    }


def test_dashboard_dataset_guest_filtering(mocker: MockerFixture) -> None:
    """Guest users should not receive sensitive dataset fields."""
    mocker.patch(
        "superset.dashboards.schemas.security_manager.is_guest_user",
        return_value=True,
    )
    result = DashboardDatasetSchema().dump(_dataset_payload())
    for field in GUEST_RESTRICTED_FIELDS:
        assert field not in result, f"{field} should be removed for guest users"
    assert result["table_name"] == "t"


def test_dashboard_dataset_non_guest_keeps_fields(mocker: MockerFixture) -> None:
    """Non-guest users keep the sensitive dataset fields."""
    mocker.patch(
        "superset.dashboards.schemas.security_manager.is_guest_user",
        return_value=False,
    )
    result = DashboardDatasetSchema().dump(_dataset_payload())
    assert result["sql"] == "SELECT 1"
    assert result["perm"] == "[db].[table]"
    assert "database" in result


def test_dashboard_external_url_accepts_https() -> None:
    """A valid https external_url is accepted."""
    schema = DashboardPostSchema()
    result = schema.load(
        {
            "dashboard_title": "test",
            "external_url": "https://example.com/managed",
        }
    )
    assert result["external_url"] == "https://example.com/managed"


@pytest.mark.parametrize(
    "url",
    [
        "javascript:alert(1)",
        "data:text/html,<script>alert(1)</script>",
        "vbscript:msgbox(1)",
    ],
)
def test_dashboard_external_url_rejects_non_http(url: str) -> None:
    """external_url rejects non-http(s) schemes."""
    schema = DashboardPostSchema()
    with pytest.raises(ValidationError) as exc_info:
        schema.load({"dashboard_title": "test", "external_url": url})
    assert "external_url" in exc_info.value.messages
