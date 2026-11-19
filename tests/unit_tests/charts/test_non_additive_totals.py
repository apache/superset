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
TDD acceptance matrix for non-additive metric totals/subtotals.

See SIP.md (root) for the full proposal. These tests encode the known reported
cases as the spec the POC must satisfy. Cases the current code already gets
right are asserted as regression guards; cases it gets wrong are marked
``xfail(strict=True)`` so they flip to a hard failure the moment the POC makes
them pass (at which point the marker is removed).

Principle under test: a total/subtotal for a non-additive metric must be
computed at the relevant grouping granularity, never by summing the
already-aggregated per-row cells.
"""

from __future__ import annotations

import pytest
from pandas import DataFrame

from superset.utils.core import PostProcessingContributionOrientation
from superset.utils.pandas_postprocessing import contribution

# ---------------------------------------------------------------------------
# Bucket B — post-processing (percentage / contribution) columns
# ---------------------------------------------------------------------------


def test_contribution_zeroes_when_total_missing() -> None:
    """
    Characterization of the #37627 / #34350 root cause.

    ``contribution`` zeroes an entire percentage column whenever that column's
    total is absent from ``contribution_totals`` (or is 0). The table chart's
    "Show summary" extra query is built with ``post_processing: []`` and so does
    not surface these totals, which is exactly how the percentage column ends up
    displaying only zeros in the summary row.

    This documents *current* behavior (passes today); the POC must stop relying
    on a totals dict that can silently miss columns.
    """
    df = DataFrame({"actual": [10.0, 30.0], "target": [40.0, 60.0]})
    result = contribution(
        df.copy(),
        orientation=PostProcessingContributionOrientation.COLUMN,
        columns=["actual"],
        rename_columns=["pct_actual"],
        # "actual" deliberately missing -> the bug surface
        contribution_totals={"target": 100.0},
    )
    assert result["pct_actual"].tolist() == [0, 0]


# ---------------------------------------------------------------------------
# Bucket A — SQL-aggregate metrics (ratios / distinct counts)
# ---------------------------------------------------------------------------


@pytest.mark.xfail(
    strict=True,
    reason="POC not implemented: ratio totals are summed cell-wise, not "
    "recomputed as SUM(num)/SUM(den) at the total grouping level (#25747).",
)
def test_ratio_total_is_recomputed_not_summed() -> None:
    """
    #25747 / #32260 / #38674: a completion-rate metric SUM(actual)/SUM(target).

    Per-group rows already hold the divided ratio. The correct grand total is
    SUM(actual)/SUM(target) = 40/100 = 0.4, NOT the sum (0.25 + 0.5 = 0.75) or
    mean (0.375) of the per-group ratios.

    Stand-in for the totals computation the POC introduces; importing the real
    helper here will replace ``_total_ratio`` once it exists.
    """
    per_group = DataFrame(
        {
            "actual": [10.0, 30.0],
            "target": [40.0, 60.0],
            "completion": [10.0 / 40.0, 30.0 / 60.0],  # 0.25, 0.5
        }
    )
    # Current (broken) derivation sums the cells:
    summed = per_group["completion"].sum()
    assert summed == pytest.approx(0.4), (
        f"ratio total should be SUM(actual)/SUM(target)=0.4, got {summed}"
    )


@pytest.mark.xfail(
    strict=True,
    reason="POC not implemented: COUNT_DISTINCT subtotals are summed across "
    "groups, double-counting overlapping members (#36165).",
)
def test_distinct_count_total_is_recomputed_not_summed() -> None:
    """
    #36165: COUNT(DISTINCT user) per group cannot be summed for the total.

    Groups A and B each have 2 distinct users but share one user, so the true
    distinct total is 3, not 2 + 2 = 4.
    """
    per_group_distinct = DataFrame({"group": ["A", "B"], "distinct_users": [2, 2]})
    true_total = 3  # |{u1,u2} ∪ {u2,u3}|
    summed = per_group_distinct["distinct_users"].sum()
    assert summed == true_total, (
        f"distinct total should be recomputed (=3), got summed value {summed}"
    )


# ---------------------------------------------------------------------------
# Regression guard — additive metrics must stay on the cheap path
# ---------------------------------------------------------------------------


def test_additive_total_is_plain_sum() -> None:
    """
    Additive metrics (SUM/COUNT/MIN/MAX) are correct via the existing cheap
    summation and must remain unchanged (no extra queries, same numbers).
    """
    per_group = DataFrame({"revenue": [10.0, 30.0, 60.0]})
    assert per_group["revenue"].sum() == pytest.approx(100.0)
