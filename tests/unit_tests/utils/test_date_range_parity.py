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
Server half of the time range limits parity check. The browser half,
``dateRangeParity.test.ts``, reads the same case list, so both sides must give
every case the same outcome.
"""

from datetime import datetime
from pathlib import Path
from typing import Any

import pytest
from flask import current_app
from pytest_mock import MockerFixture

from superset.utils import json
from tests.fixtures.time_range_policy import ALIAS_ADDONS

PARITY_CASES = (
    Path(__file__).parents[3] / "superset-frontend/spec/fixtures/dateRangeParity.json"
)
CASES: list[dict[str, Any]] = json.loads(PARITY_CASES.read_text())["cases"]


def case_levels(case: dict[str, Any]) -> list[tuple[str, Any]]:
    """
    The levels of a case. A tie case gives the dashboard payload instead, in the
    order ``get_effective_time_range_limits`` loads it: global, dataset,
    dashboard.
    """
    if (payload := case.get("payload")) is None:
        return [(source, raw) for source, raw in case["levels"]]
    return [
        ("global", payload["global"]),
        *[("dataset", dataset["policy"]) for dataset in payload["datasets"]],
        ("dashboard", payload["dashboard"]),
    ]


def server_outcome(case: dict[str, Any]) -> dict[str, Any]:
    from superset.time_range_limits.policy import (
        parse_time_range_limits,
        resolve_time_range_limits,
        TimeRangeLimitError,
        TimeRangeLimitsInvalidError,
        validate_date_range,
    )

    def parse(value: str | None) -> datetime | None:
        return datetime.fromisoformat(value) if value else None

    try:
        levels = [
            (source, parse_time_range_limits(raw)) for source, raw in case_levels(case)
        ]
    except TimeRangeLimitsInvalidError:
        return {"outcome": "invalid_policy"}
    limits = resolve_time_range_limits(levels, datetime.fromisoformat(case["now"]))
    if limits is None:
        return {"outcome": "no_limits"}
    try:
        validate_date_range(
            parse(case["since"]),
            parse(case["until"]),
            limits,
            time_offset=case.get("time_offset"),
            dashboard_id=case.get("dashboard_id"),
            timezone="UTC",
        )
    except TimeRangeLimitError as ex:
        extra = ex.error.extra or {}
        return {
            "outcome": "failure",
            "reason_code": extra["reason_code"],
            "rule": extra["rule"],
            "source": extra["source"],
            "limit": extra["limit"],
            "message": ex.error.message,
        }
    except ValueError:
        return {"outcome": "since_after_until"}
    return {"outcome": "pass"}


@pytest.mark.parametrize("case", CASES, ids=[case["id"] for case in CASES])
def test_parity_case(
    app_context: None, mocker: MockerFixture, case: dict[str, Any]
) -> None:
    mocker.patch.dict(current_app.config, ALIAS_ADDONS)
    assert server_outcome(case) == case["expected"]
