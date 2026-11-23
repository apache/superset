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
from __future__ import annotations

from pytest_mock import MockerFixture


def test_a_binding_reports_each_columns_type(mocker: MockerFixture) -> None:
    from superset.canvas.data import run_binding

    mocker.patch("superset.charts.schemas.ChartDataQueryContextSchema")
    command = mocker.patch(
        "superset.commands.chart.data.get_data_command.ChartDataCommand"
    )
    command.return_value.run.return_value = {
        "queries": [
            {
                "data": [{"ds": 1706659200000, "count": 3}],
                "colnames": ["ds", "count"],
                "coltypes": [2, 0],
            }
        ]
    }

    data = run_binding({"datasetId": 1, "metrics": ["count"]})

    assert data.coltypes == {"ds": 2, "count": 0}
