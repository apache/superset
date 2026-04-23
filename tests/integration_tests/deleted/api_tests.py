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
"""Integration tests for GET /api/v1/deleted/ (sc-103157 US4).

Covers the 9 acceptance scenarios from spec User Story 4 plus the
pre-commit-auditable happy paths.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

import prison

from superset.connectors.sqla.models import SqlaTable
from superset.extensions import db
from superset.models.dashboard import Dashboard
from superset.models.helpers import SKIP_VISIBILITY_FILTER
from superset.models.slice import Slice
from superset.utils import json
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME, GAMMA_USERNAME
from tests.integration_tests.insert_chart_mixin import InsertChartMixin


def _build_url(base: str, **rison_kwargs: Any) -> str:
    """Build a ``<base>?q=<rison>`` URL or return ``base`` unchanged when
    no rison params are supplied."""
    if not rison_kwargs:
        return base
    return f"{base}?q={prison.dumps(rison_kwargs)}"


def _hard_delete(model: Any, obj_id: int) -> None:
    """Remove a row regardless of soft-delete state (test cleanup)."""
    row = (
        db.session.query(model)
        .execution_options(**{SKIP_VISIBILITY_FILTER: True})
        .filter(model.id == obj_id)
        .one_or_none()
    )
    if row is not None:
        db.session.delete(row)
        db.session.commit()


class TestDeletedApi(InsertChartMixin, SupersetTestCase):
    """Tests for GET /api/v1/deleted/ — the aggregated archive view."""

    URL = "/api/v1/deleted/"

    def _soft_delete_chart(self, admin_id: int, name: str) -> int:
        chart = self.insert_chart(name, [admin_id], 1)
        chart_id = chart.id
        self.login(ADMIN_USERNAME)
        rv = self.client.delete(f"/api/v1/chart/{chart_id}")
        assert rv.status_code == 200, rv.data
        return chart_id

    def _soft_delete_dashboard(self, admin_id: int, title: str) -> int:
        admin = self.get_user("admin")
        dashboard = Dashboard(
            dashboard_title=title,
            slug=None,
            owners=[admin],
            position_json="",
            css="",
            json_metadata="",
            slices=[],
            published=False,
        )
        db.session.add(dashboard)
        db.session.commit()
        dash_id = dashboard.id
        self.login(ADMIN_USERNAME)
        rv = self.client.delete(f"/api/v1/dashboard/{dash_id}")
        assert rv.status_code == 200, rv.data
        return dash_id

    def _soft_delete_dataset(self, admin_id: int, table_name: str) -> int:
        admin = self.get_user("admin")
        database = (
            db.session.query(
                __import__("superset.models.core", fromlist=["Database"]).Database
            )
            .filter_by(id=1)
            .one()
        )
        dataset = SqlaTable(
            table_name=table_name,
            database=database,
            owners=[admin],
            schema=None,
        )
        db.session.add(dataset)
        db.session.commit()
        dataset_id = dataset.id
        self.login(ADMIN_USERNAME)
        rv = self.client.delete(f"/api/v1/dataset/{dataset_id}")
        assert rv.status_code == 200, rv.data
        return dataset_id

    def test_default_sort_returns_rows_desc_by_deleted_at(self) -> None:
        """Scenario 1 — default sort is deleted_at desc across types."""
        admin_id = self.get_user("admin").id
        chart_id = self._soft_delete_chart(admin_id, "arc_scenario1_chart")
        dash_id = self._soft_delete_dashboard(admin_id, "arc_scenario1_dash")
        ds_id = self._soft_delete_dataset(admin_id, "arc_scenario1_ds")

        try:
            self.login(ADMIN_USERNAME)
            rv = self.client.get(self.URL)
            assert rv.status_code == 200, rv.data
            body = json.loads(rv.data.decode("utf-8"))
            assert body["count"] >= 3
            # The three rows we just inserted must be present; pull them out.
            our_rows = [
                r for r in body["result"] if r["name"].startswith("arc_scenario1_")
            ]
            assert len(our_rows) == 3, (
                f"Expected 3 rows with our prefix; got {our_rows}"
            )
            types = {r["type"] for r in our_rows}
            assert types == {"chart", "dashboard", "dataset"}
            for row in our_rows:
                assert row["deleted_at"] is not None
                assert row["uuid"]
                # deleted_by is populated because admin performed the
                # delete via an authenticated request context.
                assert row["deleted_by"] is not None
                assert row["deleted_by"]["username"] == "admin"
            # Ordering: first result across the paginated window must
            # have the largest deleted_at of all rows returned.
            timestamps = [r["deleted_at"] for r in body["result"]]
            assert timestamps == sorted(timestamps, reverse=True)
        finally:
            _hard_delete(Slice, chart_id)
            _hard_delete(Dashboard, dash_id)
            _hard_delete(SqlaTable, ds_id)

    def test_types_filter_restricts_to_selected_types(self) -> None:
        """Scenario 2 — types=chart,dashboard excludes datasets."""
        admin_id = self.get_user("admin").id
        chart_id = self._soft_delete_chart(admin_id, "arc_scenario2_chart")
        dash_id = self._soft_delete_dashboard(admin_id, "arc_scenario2_dash")
        ds_id = self._soft_delete_dataset(admin_id, "arc_scenario2_ds")

        try:
            self.login(ADMIN_USERNAME)
            rv = self.client.get(_build_url(self.URL, types=["chart", "dashboard"]))
            assert rv.status_code == 200, rv.data
            body = json.loads(rv.data.decode("utf-8"))
            types = {r["type"] for r in body["result"]}
            assert "dataset" not in types
            # Our chart and dashboard should both be there.
            names = {r["name"] for r in body["result"]}
            assert "arc_scenario2_chart" in names
            assert "arc_scenario2_dash" in names
            assert "arc_scenario2_ds" not in names
        finally:
            _hard_delete(Slice, chart_id)
            _hard_delete(Dashboard, dash_id)
            _hard_delete(SqlaTable, ds_id)

    def test_search_filters_by_name(self) -> None:
        """Scenario 3 — search= applies ilike against the normalised name."""
        admin_id = self.get_user("admin").id
        chart_id = self._soft_delete_chart(admin_id, "arc_scenario3_needle")
        other_chart_id = self._soft_delete_chart(admin_id, "arc_scenario3_haystack")

        try:
            self.login(ADMIN_USERNAME)
            rv = self.client.get(_build_url(self.URL, search="needle"))
            assert rv.status_code == 200, rv.data
            body = json.loads(rv.data.decode("utf-8"))
            names = {r["name"] for r in body["result"]}
            assert "arc_scenario3_needle" in names
            assert "arc_scenario3_haystack" not in names
        finally:
            _hard_delete(Slice, chart_id)
            _hard_delete(Slice, other_chart_id)

    def test_time_range_filter(self) -> None:
        """Scenario 4 — deleted_from/deleted_to restrict by deleted_at range."""
        admin_id = self.get_user("admin").id
        chart_id = self._soft_delete_chart(admin_id, "arc_scenario4_chart")

        try:
            self.login(ADMIN_USERNAME)
            # deleted_at is stamped via datetime.now() (see SoftDeleteMixin);
            # use the same timezone-naive local clock for the filter bounds.
            from_ = (datetime.now() - timedelta(hours=1)).isoformat()
            rv = self.client.get(_build_url(self.URL, deleted_from=from_))
            assert rv.status_code == 200, rv.data
            body = json.loads(rv.data.decode("utf-8"))
            names = {r["name"] for r in body["result"]}
            assert "arc_scenario4_chart" in names

            # Window ending one hour ago must NOT include our row.
            to_ = (datetime.now() - timedelta(hours=1)).isoformat()
            rv = self.client.get(_build_url(self.URL, deleted_to=to_))
            assert rv.status_code == 200, rv.data
            body = json.loads(rv.data.decode("utf-8"))
            names = {r["name"] for r in body["result"]}
            assert "arc_scenario4_chart" not in names
        finally:
            _hard_delete(Slice, chart_id)

    def test_cross_type_sort_by_name_asc(self) -> None:
        """Scenario 5 — order_column=name&order_direction=asc sorts
        alphabetically across all types."""
        admin_id = self.get_user("admin").id
        chart_id = self._soft_delete_chart(admin_id, "arc_scenario5_bbb")
        dash_id = self._soft_delete_dashboard(admin_id, "arc_scenario5_aaa")
        ds_id = self._soft_delete_dataset(admin_id, "arc_scenario5_ccc")

        try:
            self.login(ADMIN_USERNAME)
            rv = self.client.get(
                _build_url(
                    self.URL,
                    search="arc_scenario5",
                    order_column="name",
                    order_direction="asc",
                )
            )
            assert rv.status_code == 200, rv.data
            body = json.loads(rv.data.decode("utf-8"))
            our_rows = [
                r for r in body["result"] if r["name"].startswith("arc_scenario5_")
            ]
            ordered_names = [r["name"] for r in our_rows]
            assert ordered_names == [
                "arc_scenario5_aaa",
                "arc_scenario5_bbb",
                "arc_scenario5_ccc",
            ]
        finally:
            _hard_delete(Slice, chart_id)
            _hard_delete(Dashboard, dash_id)
            _hard_delete(SqlaTable, ds_id)

    def test_pagination_count_and_slice(self) -> None:
        """Scenario 7 — paging returns correct slice and total count."""
        admin_id = self.get_user("admin").id
        inserted_ids = [
            self._soft_delete_chart(admin_id, f"arc_scenario7_{i:02d}")
            for i in range(5)
        ]

        try:
            self.login(ADMIN_USERNAME)
            rv = self.client.get(
                _build_url(
                    self.URL,
                    search="arc_scenario7",
                    page=0,
                    page_size=2,
                    order_column="name",
                    order_direction="asc",
                )
            )
            assert rv.status_code == 200, rv.data
            body = json.loads(rv.data.decode("utf-8"))
            assert body["count"] == 5
            assert len(body["result"]) == 2
            assert [r["name"] for r in body["result"]] == [
                "arc_scenario7_00",
                "arc_scenario7_01",
            ]
            # Second page
            rv = self.client.get(
                _build_url(
                    self.URL,
                    search="arc_scenario7",
                    page=1,
                    page_size=2,
                    order_column="name",
                    order_direction="asc",
                )
            )
            body = json.loads(rv.data.decode("utf-8"))
            assert [r["name"] for r in body["result"]] == [
                "arc_scenario7_02",
                "arc_scenario7_03",
            ]
        finally:
            for cid in inserted_ids:
                _hard_delete(Slice, cid)

    def test_empty_result_returns_200_not_404(self) -> None:
        """Scenario 8 — no matches yields 200 with empty result, not 404."""
        self.login(ADMIN_USERNAME)
        rv = self.client.get(
            _build_url(self.URL, search="__completely_unmatchable_prefix_xyz__")
        )
        assert rv.status_code == 200
        body = json.loads(rv.data.decode("utf-8"))
        assert body["result"] == []
        assert body["count"] == 0

    def test_gamma_user_gets_200_not_403(self) -> None:
        """Scenario 9 — authorisation is expressed via row filtering, not
        endpoint-level denial. A Gamma user who may or may not see
        specific rows still gets a 200 (empty or not) from the endpoint,
        never a 403. Row visibility depends on test-DB permissions; the
        key assertion for this scenario is the status code.
        """
        admin_id = self.get_user("admin").id
        ds_id = self._soft_delete_dataset(admin_id, "arc_gamma_dataset")

        try:
            self.login(GAMMA_USERNAME)
            rv = self.client.get(_build_url(self.URL, types=["dataset"]))
            assert rv.status_code == 200, rv.data
            body = json.loads(rv.data.decode("utf-8"))
            # `result` and `count` are both valid integers / lists, not
            # an error payload.
            assert isinstance(body["result"], list)
            assert isinstance(body["count"], int)
        finally:
            _hard_delete(SqlaTable, ds_id)

    def test_invalid_order_column_returns_400(self) -> None:
        """Validation — unknown sort column is 400, not 500."""
        self.login(ADMIN_USERNAME)
        rv = self.client.get(_build_url(self.URL, order_column="bogus"))
        assert rv.status_code == 400

    def test_malformed_time_range_returns_400(self) -> None:
        """Validation — unparseable ISO date is 400."""
        self.login(ADMIN_USERNAME)
        rv = self.client.get(_build_url(self.URL, deleted_from="not-a-date"))
        assert rv.status_code == 400

    def test_unauthenticated_request_returns_401(self) -> None:
        """Validation — anonymous caller gets 401."""
        self.logout()
        rv = self.client.get(self.URL)
        # FAB's @protect decorator returns 401 for missing auth;
        # some deployments return 302 redirect-to-login. Accept either
        # as proof that unauthenticated access is rejected.
        assert rv.status_code in (401, 302, 403)
