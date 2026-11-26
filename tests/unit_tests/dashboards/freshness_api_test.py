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
"""``GET /api/v1/dashboard/<id_or_slug>/freshness``."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset.commands.dashboard.exceptions import (
    DashboardAccessDeniedError,
    DashboardNotFoundError,
)

URL = "/api/v1/dashboard/sales/freshness"


@pytest.fixture
def dashboard_dao(mocker: MockerFixture) -> MagicMock:
    return mocker.patch("superset.dashboards.api.DashboardDAO")


@pytest.mark.parametrize("app", [{"DATA_FRESHNESS_ENABLED": False}], indirect=True)
def test_freshness_is_404_when_disabled(
    client: Any, full_api_access: None, dashboard_dao: MagicMock
) -> None:
    assert client.get(URL).status_code == 404
    dashboard_dao.get_by_id_or_slug.assert_not_called()


@pytest.mark.parametrize("app", [{"DATA_FRESHNESS_ENABLED": True}], indirect=True)
def test_freshness_returns_roll_up(
    client: Any,
    full_api_access: None,
    dashboard_dao: MagicMock,
    mocker: MockerFixture,
) -> None:
    dashboard = MagicMock()
    dashboard_dao.get_by_id_or_slug.return_value = dashboard
    as_of = datetime(2026, 11, 26, 9, 30, tzinfo=timezone.utc)
    roll_up = mocker.patch(
        "superset.dashboards.api.get_dashboard_freshness",
        return_value={
            "data_as_of": as_of,
            "stale": False,
            "datasets": [
                {
                    "id": 7,
                    "name": "invoices",
                    "data_as_of": as_of,
                    "warn_after_minutes": 120,
                    "stale": False,
                }
            ],
        },
    )

    response = client.get(URL)

    assert response.status_code == 200
    assert response.json == {
        "result": {
            "data_as_of": "2026-11-26T09:30:00+00:00",
            "stale": False,
            "datasets": [
                {
                    "id": 7,
                    "name": "invoices",
                    "data_as_of": "2026-11-26T09:30:00+00:00",
                    "warn_after_minutes": 120,
                    "stale": False,
                }
            ],
        }
    }
    dashboard_dao.get_by_id_or_slug.assert_called_once_with("sales")
    roll_up.assert_called_once_with(dashboard)


@pytest.mark.parametrize("app", [{"DATA_FRESHNESS_ENABLED": True}], indirect=True)
@pytest.mark.parametrize(
    "error, status",
    [(DashboardNotFoundError(), 404), (DashboardAccessDeniedError(), 403)],
)
def test_freshness_respects_dashboard_access(
    client: Any,
    full_api_access: None,
    dashboard_dao: MagicMock,
    mocker: MockerFixture,
    error: Exception,
    status: int,
) -> None:
    dashboard_dao.get_by_id_or_slug.side_effect = error
    roll_up = mocker.patch("superset.dashboards.api.get_dashboard_freshness")

    assert client.get(URL).status_code == status
    roll_up.assert_not_called()


@pytest.mark.parametrize("app", [{"DATA_FRESHNESS_ENABLED": True}], indirect=True)
def test_freshness_requires_dashboard_read(client: Any) -> None:
    # No logged-in user and no grants.
    assert client.get(URL).status_code == 401
