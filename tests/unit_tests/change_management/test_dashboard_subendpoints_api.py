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
"""The dashboard sub-endpoints answer a captured write the way PUT does."""

from __future__ import annotations

from typing import Any

import pytest
from pytest_mock import MockerFixture

from asset_approval.exceptions import (
    AssetLockedError,
    ChangeRequestCreated,
    UnreviewableWriteRefusedError,
)

ENDPOINTS = [
    ("filters", "UpdateDashboardNativeFiltersCommand", {"modified": [], "deleted": []}),
    (
        "chart_customizations",
        "UpdateDashboardChartCustomizationsCommand",
        {"modified": [], "deleted": []},
    ),
    ("colors", "UpdateDashboardColorsConfigCommand", {"color_scheme": "x"}),
]


@pytest.mark.parametrize("path,command_name,body", ENDPOINTS)
def test_captured_write_answers_202(
    mocker: MockerFixture,
    client: Any,
    full_api_access: None,
    path: str,
    command_name: str,
    body: dict[str, Any],
) -> None:
    command = mocker.patch(f"superset.dashboards.api.{command_name}")
    command.return_value.run.side_effect = ChangeRequestCreated(7, "dashboard", 1)

    response = client.put(f"/api/v1/dashboard/1/{path}", json=body)

    assert response.status_code == 202
    assert response.json["review_required"] is True
    assert response.json["id"] == 7


@pytest.mark.parametrize("path,command_name,body", ENDPOINTS)
def test_locked_write_answers_409(
    mocker: MockerFixture,
    client: Any,
    full_api_access: None,
    path: str,
    command_name: str,
    body: dict[str, Any],
) -> None:
    command = mocker.patch(f"superset.dashboards.api.{command_name}")
    command.return_value.run.side_effect = AssetLockedError("dashboard", 1, "bob")

    response = client.put(f"/api/v1/dashboard/1/{path}", json=body)

    assert response.status_code == 409


def test_background_color_sync_refusal_answers_422(
    mocker: MockerFixture, client: Any, full_api_access: None
) -> None:
    command = mocker.patch("superset.dashboards.api.UpdateDashboardColorsConfigCommand")
    command.return_value.run.side_effect = UnreviewableWriteRefusedError(
        "Updating dashboard colors in the background", "Save instead."
    )

    response = client.put(
        "/api/v1/dashboard/1/colors?mark_updated=false", json={"color_scheme": "x"}
    )

    assert response.status_code == 422
    assert "needs review" in response.json["message"]
