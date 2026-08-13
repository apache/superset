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
End-to-end acceptance tests for non-additive metric totals (Table chart).

Companion to tests/unit_tests/charts/test_non_additive_totals.py and the
root SIP.md. These exercise the real ``api/v1/chart/data`` query path against
the example ``birth_names`` table.

Findings these tests pin down:

* **Bucket A (SQL-aggregate grand total)** is already correct for the Table
  chart, because the "Show summary" row is produced by a *separate query with
  no GROUP BY* (``columns=[]``). The database evaluates the metric expression
  over all rows, so a ratio / distinct count is right even though summing the
  per-group cells would be wrong. These are asserted as regression guards.
* **Bucket B (post-processing % columns)** was broken in the *frontend*:
  ``plugin-chart-table/buildQuery.ts`` built the totals query with
  ``post_processing=[]``, so a contribution / percent column never appeared in
  the summary row (#37627, #34350). The fix retains post-processing on that
  query; the guard below pins the backend capability the fix relies on (a
  no-GROUP-BY summary query computes the percent column = 100%).
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pytest

from superset.charts.schemas import ChartDataQueryContextSchema
from superset.common.grouping_sets import split_grouping_sets_result
from superset.common.query_context import QueryContext
from superset.utils.core import QueryStatus
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,  # noqa: F401
    load_birth_names_data,  # noqa: F401
)
from tests.integration_tests.fixtures.query_context import get_query_context

# A non-additive ratio metric: fraction of births in California.
# Inlined CASE over physical columns (num, state); * 1.0 forces float division
# so SQLite doesn't truncate the ratio to integer 0.
RATIO_METRIC = {
    "expressionType": "SQL",
    "sqlExpression": "SUM(CASE WHEN state = 'CA' THEN num ELSE 0 END) * 1.0 / SUM(num)",
    "label": "ca_share",
}

# COUNT_DISTINCT over a low-cardinality column (gender) that recurs across the
# groupby (state). The per-group distinct counts therefore overlap heavily, so
# summing them double-counts -- which is exactly what the grand total must avoid.
DISTINCT_METRIC = {
    "expressionType": "SIMPLE",
    "column": {"column_name": "gender"},
    "aggregate": "COUNT_DISTINCT",
    "label": "distinct_genders",
}


def _result_df(payload: dict[str, Any]):
    # Use get_query_result (not get_payload) to avoid the flask-caching/Redis
    # layer, so these tests run against just the metadata + results DB.
    query_context: QueryContext = ChartDataQueryContextSchema().load(payload)
    query_object = query_context.queries[0]
    result = query_context.get_query_result(query_object)
    assert result.status == QueryStatus.SUCCESS, result.errors
    return result.df


def _base_payload(
    metric: dict[str, Any], columns: list[str], clear_filters: bool = False
):
    payload = get_query_context("birth_names")
    query = payload["queries"][0]
    query["metrics"] = [metric]
    query["columns"] = columns
    query["groupby"] = columns
    query["orderby"] = []
    query["post_processing"] = []
    query["is_timeseries"] = False
    query["row_limit"] = None
    if clear_filters:
        # Drop the default gender='boy' filter so both genders are present and
        # genuinely recur across states.
        query["filters"] = []
    return payload


@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
class TestNonAdditiveTotalsTable(SupersetTestCase):
    def test_ratio_grand_total_is_db_computed_not_summed(self):
        """
        Bucket A regression guard: the grand total of a ratio metric is the
        ratio of the summed parts (DB-computed at no-GROUP-BY), and is NOT the
        sum of the per-group ratios.
        """
        self.login("admin")

        # Per-group ratios (grouped by state).
        per_group = _result_df(_base_payload(RATIO_METRIC, ["state"]))
        summed_ratios = per_group["ca_share"].sum()

        # Grand total: no GROUP BY -> the summary-row query the table chart runs.
        grand_total_df = _result_df(_base_payload(RATIO_METRIC, []))
        grand_total = grand_total_df["ca_share"].iloc[0]

        # The grand total is a genuine ratio in [0, 1] ...
        assert 0.0 <= grand_total <= 1.0
        # ... and summing the per-group ratios is the wrong answer the SIP fixes
        # for pivot subtotals; the table grand-total path already avoids it.
        assert not np.isclose(grand_total, summed_ratios), (
            f"grand total {grand_total} should differ from summed per-group "
            f"ratios {summed_ratios}"
        )

    def test_distinct_count_grand_total_is_db_computed(self):
        """
        Bucket A regression guard: COUNT_DISTINCT grand total is computed over
        all rows, so it equals the true distinct count and is strictly less than
        the sum of per-group distinct counts when members recur across groups
        (gender recurs across every state, so summing double-counts).
        """
        self.login("admin")

        per_group = _result_df(
            _base_payload(DISTINCT_METRIC, ["state"], clear_filters=True)
        )
        summed = per_group["distinct_genders"].sum()

        grand_total_df = _result_df(
            _base_payload(DISTINCT_METRIC, [], clear_filters=True)
        )
        grand_total = grand_total_df["distinct_genders"].iloc[0]

        # Grand total is the true number of distinct genders (boy + girl) ...
        assert grand_total == 2
        # ... and summing per-state distinct counts double-counts (2 per state
        # across many states), so the naive sum is strictly larger.
        assert grand_total < summed

    def test_backend_computes_percent_column_for_summary_query(self):
        """
        Bucket B backend-capability guard.

        The #37627 bug is in the frontend (``plugin-chart-table/buildQuery.ts``
        built the totals query with ``post_processing=[]``). The backend itself
        can compute the contribution/percent column on a no-GROUP-BY summary
        query: the total's contribution to itself is 100%. This guard pins that
        capability so the frontend fix (retaining post_processing on the totals
        query) produces a correct summary % rather than an empty one.
        """
        self.login("admin")

        # Mirror the *fixed* frontend totals query: no GROUP BY, but with the
        # percent-metric contribution op retained.
        totals_payload = _base_payload({"label": "sum__num"}, [])
        totals_payload["queries"][0]["post_processing"] = [
            {
                "operation": "contribution",
                "options": {
                    "columns": ["sum__num"],
                    "orientation": "column",
                    "rename_columns": ["sum__num_pct"],
                },
            }
        ]
        totals_df = _result_df(totals_payload)

        assert "sum__num_pct" in totals_df.columns
        # Single total row -> its contribution to itself is 100%.
        assert totals_df["sum__num_pct"].iloc[0] == pytest.approx(1.0)


@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
class TestTablePercentMetricSummary(SupersetTestCase):
    """
    #37627 / #34350: a Table "Percentage metrics" column must appear in the
    summary row when "Show summary" is on. The fix retains the contribution
    post-processing on the totals query (plugin-chart-table buildQuery), so the
    summary row recomputes the percent column instead of omitting it. The main
    column is unaffected (verified: identical with/without the fix).
    """

    def test_percent_metric_present_in_summary_and_nonzero_in_body(self):
        self.login("admin")
        pct = {
            "expressionType": "SIMPLE",
            "column": {"column_name": "num"},
            "aggregate": "SUM",
            "label": "sum__num",
        }
        contribution = {
            "operation": "contribution",
            "options": {
                "columns": ["sum__num"],
                "rename_columns": ["%sum__num"],
            },
        }
        main_query = {
            "columns": ["state"],
            "metrics": [pct],
            "post_processing": [contribution],
            "orderby": [],
            "row_limit": 100,
            "is_timeseries": False,
        }
        # Mirrors the fixed frontend buildQuery: the show_totals query retains
        # the contribution op (was post_processing=[]).
        totals_query = {
            "columns": [],
            "metrics": [pct],
            "post_processing": [contribution],
            "orderby": [],
            "row_limit": 0,
            "is_timeseries": False,
        }
        payload = {
            "datasource": {"id": self.get_birth_names_dataset().id, "type": "table"},
            "queries": [main_query, totals_query],
            "result_type": "full",
        }
        query_context: QueryContext = ChartDataQueryContextSchema().load(payload)
        response = query_context.get_payload()

        body = response["queries"][0]["data"]
        summary = response["queries"][1]["data"]
        # Body percent column is computed (non-zero for rows with data).
        assert any(row.get("%sum__num") for row in body)
        # The fix: the percent column is present in the summary row too.
        assert summary
        assert "%sum__num" in summary[0]

    def get_birth_names_dataset(self):
        from superset import db
        from superset.connectors.sqla.models import SqlaTable

        return db.session.query(SqlaTable).filter_by(table_name="birth_names").one()


@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
class TestGroupingSetsRollup(SupersetTestCase):
    """
    Phase 3b: a `grouping_sets` query returns every rollup level tagged with
    GROUPING()-equivalent markers, regardless of engine. Engines that support
    GROUPING SETS (Postgres) compute it in one native query
    (get_sqla_query); engines that don't (SQLite) use the per-level fallback in
    QueryContextProcessor. Either way the combined result is identical in shape,
    so this test exercises both paths.
    """

    def test_grouping_sets_returns_all_levels(self):
        self.login("admin")
        ratio = {
            "expressionType": "SQL",
            "sqlExpression": "SUM(CASE WHEN state = 'CA' THEN num ELSE 0 END) "
            "* 1.0 / SUM(num)",
            "label": "ca_share",
        }
        levels = [["gender", "state"], ["gender"], []]
        payload = {
            "datasource": {"id": 1, "type": "table"},
            "queries": [
                {
                    "columns": ["gender", "state"],
                    "metrics": [ratio],
                    "grouping_sets": levels,
                    "orderby": [],
                    "row_limit": 50000,
                    "is_timeseries": False,
                }
            ],
            "result_type": "full",
        }
        # birth_names dataset id is environment-specific; resolve it.
        from superset import db
        from superset.connectors.sqla.models import SqlaTable

        table = db.session.query(SqlaTable).filter_by(table_name="birth_names").one()
        payload["datasource"]["id"] = table.id

        query_context: QueryContext = ChartDataQueryContextSchema().load(payload)
        df = query_context.get_query_result(query_context.queries[0]).df

        # One query produced the GROUPING() markers for both groupby columns.
        assert "gender__superset_grouping" in df.columns
        assert "state__superset_grouping" in df.columns

        leaf, gender_sub, grand = split_grouping_sets_result(
            df, levels, ["gender", "state"]
        )
        # Markers are stripped from the split frames.
        assert "gender__superset_grouping" not in leaf.columns
        # Grand total is a single, valid ratio (DB-computed, not summed cells).
        assert len(grand) == 1
        assert 0.0 <= grand["ca_share"].iloc[0] <= 1.0
        # One subtotal row per gender.
        assert len(gender_sub) == 2
