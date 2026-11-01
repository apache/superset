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
"""Timezone compatibility of the real MCP dashboard range intersection."""

import pytest
from freezegun import freeze_time

from superset.mcp_service.dashboard_scope import (
    intersect_time_ranges,
    MCPDashboardScopeError,
)


@pytest.mark.parametrize("reverse", [False, True])
def test_time_range_intersection_accepts_mixed_quarter_bounds(reverse: bool) -> None:
    """A mixed dashboard range intersects with naive model ranges in either order."""
    quarter = "DATETRUNC(DATETIME('2024-05-31T12:00:00+08:00'), QUARTER) : now"
    model = "2024-05-01 : 2024-06-01"
    with freeze_time("2024-07-01 12:00:00"):
        result = (
            intersect_time_ranges(model, quarter)
            if reverse
            else intersect_time_ranges(quarter, model)
        )
    assert result == "2024-05-01T00:00:00 : 2024-06-01T00:00:00"


def test_time_range_intersection_preserves_selected_offsets() -> None:
    """Intersection keeps the original offset on the selected mixed boundary."""
    assert (
        intersect_time_ranges(
            "2024-04-01T00:00:00+08:00 : 2024-06-01T00:00:00",
            "2024-03-01 : 2024-05-01T00:00:00+08:00",
        )
        == "2024-04-01T00:00:00+08:00 : 2024-05-01T00:00:00+08:00"
    )


def test_time_range_intersection_orders_aware_bounds_by_instant() -> None:
    """Aware ranges intersect by actual instant even when wall clocks differ."""
    assert (
        intersect_time_ranges(
            "2024-04-01T00:00:00+08:00 : 2024-04-02T00:00:00+08:00",
            "2024-03-31T20:00:00+00:00 : 2024-04-01T20:00:00+00:00",
        )
        == "2024-03-31T20:00:00+00:00 : 2024-04-02T00:00:00+08:00"
    )


def test_time_range_intersection_rejects_disjoint_mixed_bounds() -> None:
    """Mixed awareness must not prevent the non-overlap guard from running."""
    with pytest.raises(MCPDashboardScopeError, match="does not overlap"):
        intersect_time_ranges(
            "2024-04-01T00:00:00+08:00 : 2024-05-01T00:00:00+08:00",
            "2024-06-01 : 2024-07-01",
        )


@pytest.mark.parametrize(
    "scope,model,expected",
    [
        ("2024-01-01 : ", " : 2024-02-01", "2024-01-01T00:00:00 : 2024-02-01T00:00:00"),
        (" : 2024-06-01", " : 2024-05-01", " : 2024-05-01T00:00:00"),
        ("2024-04-01 : ", "2024-05-01 : ", "2024-05-01T00:00:00 : "),
    ],
)
def test_time_range_intersection_preserves_open_bounds(
    scope: str, model: str, expected: str
) -> None:
    """Unbounded sides remain unbounded and the other side is narrowed."""
    assert intersect_time_ranges(scope, model) == expected
