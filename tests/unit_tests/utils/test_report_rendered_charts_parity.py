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
"""
Server half of the report rendered-charts parity check. The browser half,
``reportRenderedCharts.test.ts``, reads the same case list, so both sides must
give every case the same charts.
"""

from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

from superset.utils import json

PARITY_CASES = (
    Path(__file__).parents[3]
    / "superset-frontend/spec/fixtures/reportRenderedCharts.json"
)
FIXTURE: dict[str, Any] = json.loads(PARITY_CASES.read_text())


def position_json(case: dict[str, Any]) -> str | None:
    """The case's layout text: its own, else its named layout serialized."""
    if "position_json" in case:
        return case["position_json"]
    return json.dumps(FIXTURE["layouts"][case["layout"]])


@pytest.mark.parametrize(
    "case", FIXTURE["cases"], ids=[case["name"] for case in FIXTURE["cases"]]
)
def test_report_rendered_charts_parity(case: dict[str, Any]) -> None:
    from superset.time_range_limits.enforcement import report_state_charts

    dashboard: Any = SimpleNamespace(
        slices=[SimpleNamespace(id=chart_id) for chart_id in case["slices"]],
        position_json=position_json(case),
    )

    rendered = report_state_charts(dashboard, case["state"], case["tabs_enabled"])

    assert [chart.id for chart in rendered] == case["expected"]
