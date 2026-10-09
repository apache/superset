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
from unittest.mock import MagicMock, patch

import pytest
from flask import current_app, Response

from superset.charts.data.api import ChartDataRestApi


@pytest.mark.parametrize("time_range", ["garbage", "", "2025-03-15 - 2025-04-01"])
def test_chart_data_rejects_malformed_time_range(
    time_range: str, full_api_access: None
) -> None:
    """The real schema/parser path returns 400 before any chart query executes."""
    api: ChartDataRestApi = ChartDataRestApi()
    command: MagicMock
    response: Response
    with (
        current_app.test_request_context(
            "/api/v1/chart/data",
            method="POST",
            json={
                "datasource": {"id": 1, "type": "table"},
                "queries": [{"time_range": time_range}],
            },
        ),
        patch("superset.daos.datasource.DatasourceDAO.get_datasource"),
        patch("superset.charts.data.api.ChartDataCommand") as command,
    ):
        response = api.data()
    assert response.status_code == 400
    assert "time_range" in response.get_json()["message"]
    command.assert_not_called()
