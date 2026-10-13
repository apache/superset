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
"""Dashboard export endpoint error mapping."""

from collections.abc import Callable, Iterator
from typing import Any
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture
from werkzeug.test import TestResponse

from superset.commands.chart.exceptions import ChartNotFoundError
from superset.commands.dataset.exceptions import DatasetNotFoundError


@pytest.mark.parametrize("error", [ChartNotFoundError, DatasetNotFoundError])
def test_export_maps_inaccessible_nested_object_to_not_found(
    mocker: MockerFixture,
    client: Any,
    full_api_access: None,
    error: type[Exception],
) -> None:
    """sc-124110: a nested chart or dataset the caller cannot access returns
    the bare 404 the chart and dataset exports return, instead of a 500."""

    def run() -> Iterator[tuple[str, Callable[[], str]]]:
        yield "dashboards/dashboard.yaml", lambda: "dashboard_title: dashboard\n"
        # The nested chart and dataset exports hide rows outside the caller's
        # access, so they report them as not found.
        raise error()

    # The endpoint refuses anonymous callers before exporting.
    mocker.patch("superset.dashboards.api.get_user_id", return_value=1)
    command: MagicMock = mocker.patch("superset.dashboards.api.ExportDashboardsCommand")
    command.return_value.run.side_effect = run

    response: TestResponse = client.get("/api/v1/dashboard/export/?q=!(1)")

    assert response.status_code == 404
    assert response.json == {"message": "Not found"}
