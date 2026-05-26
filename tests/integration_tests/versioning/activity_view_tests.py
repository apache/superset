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
"""Integration tests for the cross-entity activity-view API (sc-107283).

US1 — dashboard activity stream: ``GET /api/v1/dashboard/<uuid>/activity/``.
Tests for US2 (chart activity) and US3 (dataset activity) come in later
phases.

Per spec T053 / sc-103156 T062, every test that mutates a fixture entity
wraps the test body in ``try``/``finally`` with
``metadata_db.session.rollback()`` in the ``finally``. The rationale is
documented in the spec — Continuum captures dirty mappers during
autoflush, so leaving an instrumented attribute dirty pollutes
downstream tests via the shadow tables.
"""

from __future__ import annotations

from typing import Any

import pytest

from superset.connectors.sqla.models import SqlaTable
from superset.extensions import db
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils import json as _json
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME, ALPHA_USERNAME
from tests.integration_tests.fixtures.birth_names_dashboard import (  # noqa: F401
    load_birth_names_dashboard_with_slices,
    load_birth_names_data,
)


def _get_birth_names_dataset() -> SqlaTable:
    return (
        db.session.query(SqlaTable)
        .filter(SqlaTable.table_name == "birth_names")
        .first()
    )


def _persist_fixture_state() -> None:
    """Force the fixture's pending INSERTs to commit so subsequent edits
    produce *new* version rows instead of being batched into the
    creation transaction. Mirrors the same helper in
    ``tests/integration_tests/dashboards/version_history_tests.py``.
    """
    db.session.commit()


def _get_birth_names_dashboard() -> Dashboard:
    return (
        db.session.query(Dashboard)
        .filter(Dashboard.dashboard_title == "USA Births Names")
        .first()
    )


class TestDashboardActivityView(SupersetTestCase):
    """T017–T026 — ``GET /api/v1/dashboard/<uuid>/activity/`` (US1)."""

    @pytest.fixture(autouse=True)
    def _load_data(self, load_birth_names_dashboard_with_slices):  # noqa: PT004, F811
        pass

    def _activity(self, dashboard_uuid: str, **query: Any) -> Any:
        return self.client.get(
            f"/api/v1/dashboard/{dashboard_uuid}/activity/",
            query_string=query,
        )

    # ---- 4xx boundary cases ----

    def test_activity_returns_404_for_unknown_uuid(self) -> None:
        """AV-009: unknown path entity → 404."""
        self.login(ADMIN_USERNAME)
        rv = self._activity("00000000-0000-0000-0000-000000000000")
        assert rv.status_code == 404

    def test_activity_returns_400_for_invalid_uuid(self) -> None:
        """A malformed UUID is rejected by the endpoint, not by Werkzeug."""
        self.login(ADMIN_USERNAME)
        rv = self._activity("not-a-uuid")
        assert rv.status_code == 400

    def test_activity_returns_400_for_invalid_include(self) -> None:
        _persist_fixture_state()
        dashboard = _get_birth_names_dashboard()
        assert dashboard is not None
        self.login(ADMIN_USERNAME)
        rv = self._activity(str(dashboard.uuid), include="sibling")
        assert rv.status_code == 400

    def test_activity_returns_400_for_invalid_since(self) -> None:
        _persist_fixture_state()
        dashboard = _get_birth_names_dashboard()
        assert dashboard is not None
        self.login(ADMIN_USERNAME)
        rv = self._activity(str(dashboard.uuid), since="yesterday")
        assert rv.status_code == 400

    def test_activity_denies_non_owner(self) -> None:
        """Mirrors sc-103156 T056 — Alpha doesn't own the admin-fixture
        dashboard, so raise_for_ownership rejects with 403 before the
        activity layer runs."""
        _persist_fixture_state()
        dashboard = _get_birth_names_dashboard()
        assert dashboard is not None
        dashboard_uuid = str(dashboard.uuid)

        self.login(ALPHA_USERNAME)
        rv = self._activity(dashboard_uuid)
        assert rv.status_code == 403

    # ---- 200 happy paths ----

    def test_activity_returns_200_with_envelope_shape(self) -> None:
        """Smoke test: the endpoint returns the documented envelope shape
        (``result`` list + ``count`` integer) even when the dashboard has
        no activity yet."""
        _persist_fixture_state()
        dashboard = _get_birth_names_dashboard()
        assert dashboard is not None
        dashboard_uuid = str(dashboard.uuid)

        self.login(ADMIN_USERNAME)
        rv = self._activity(dashboard_uuid)
        assert rv.status_code == 200
        body = _json.loads(rv.data.decode("utf-8"))
        assert "result" in body
        assert "count" in body
        assert isinstance(body["result"], list)
        assert isinstance(body["count"], int)

    def test_activity_includes_chart_edit_as_related(self) -> None:
        """T018 / AS-1 of US1: editing a chart on the dashboard surfaces
        the chart-edit record with ``entity_kind=Slice`` and
        ``source=related``."""
        _persist_fixture_state()
        dashboard = _get_birth_names_dashboard()
        assert dashboard is not None
        dashboard_uuid = str(dashboard.uuid)
        chart_on_dashboard = next(iter(dashboard.slices), None)
        assert chart_on_dashboard is not None
        chart_id = chart_on_dashboard.id
        original_name = chart_on_dashboard.slice_name

        try:
            chart_on_dashboard.slice_name = f"{original_name} (edited)"
            db.session.commit()

            self.login(ADMIN_USERNAME)
            rv = self._activity(dashboard_uuid)
            assert rv.status_code == 200
            body = _json.loads(rv.data.decode("utf-8"))
            related = [
                r
                for r in body["result"]
                if r["entity_kind"] == "Slice" and r["source"] == "related"
            ]
            assert related, (
                "Expected at least one Slice/related record from the chart "
                "edit; got: "
                f"{[(r['entity_kind'], r['source']) for r in body['result']]}"
            )
            # Spot-check the carry-through of denormalized fields
            sample = related[0]
            assert sample["entity_uuid"] is not None
            assert "transaction_id" in sample
            assert "issued_at" in sample
        finally:
            db.session.rollback()
            chart = db.session.query(Slice).filter(Slice.id == chart_id).one()
            chart.slice_name = original_name
            db.session.commit()

    def test_activity_include_self_excludes_related(self) -> None:
        """T023 / AV-016: ``?include=self`` filters out related records."""
        _persist_fixture_state()
        dashboard = _get_birth_names_dashboard()
        assert dashboard is not None
        dashboard_uuid = str(dashboard.uuid)
        chart_on_dashboard = next(iter(dashboard.slices), None)
        assert chart_on_dashboard is not None
        chart_id = chart_on_dashboard.id
        original_name = chart_on_dashboard.slice_name

        try:
            chart_on_dashboard.slice_name = f"{original_name} (edited self)"
            db.session.commit()

            self.login(ADMIN_USERNAME)
            rv = self._activity(dashboard_uuid, include="self")
            assert rv.status_code == 200
            body = _json.loads(rv.data.decode("utf-8"))
            for record in body["result"]:
                assert record["source"] == "self", (
                    f"include=self leaked a non-self record: {record}"
                )
                assert record["entity_kind"] == "Dashboard"
        finally:
            db.session.rollback()
            chart = db.session.query(Slice).filter(Slice.id == chart_id).one()
            chart.slice_name = original_name
            db.session.commit()

    def test_activity_include_related_excludes_self(self) -> None:
        """T024 / AV-016: ``?include=related`` returns only related records."""
        _persist_fixture_state()
        dashboard = _get_birth_names_dashboard()
        assert dashboard is not None
        dashboard_uuid = str(dashboard.uuid)
        original_title = dashboard.dashboard_title
        dashboard_id = dashboard.id

        try:
            # Edit the dashboard's own field so we have a self record to
            # filter out, and edit a chart on it so we have a related
            # record to keep.
            dashboard.dashboard_title = f"{original_title} (edited dash)"
            db.session.commit()
            chart_on_dashboard = next(iter(dashboard.slices), None)
            assert chart_on_dashboard is not None
            chart_id = chart_on_dashboard.id
            chart_original_name = chart_on_dashboard.slice_name
            chart_on_dashboard.slice_name = f"{chart_original_name} (edited chart)"
            db.session.commit()

            self.login(ADMIN_USERNAME)
            rv = self._activity(dashboard_uuid, include="related")
            assert rv.status_code == 200
            body = _json.loads(rv.data.decode("utf-8"))
            for record in body["result"]:
                assert record["source"] == "related", (
                    f"include=related leaked a self record: {record}"
                )
                assert record["entity_kind"] != "Dashboard"
        finally:
            db.session.rollback()
            dashboard = (
                db.session.query(Dashboard).filter(Dashboard.id == dashboard_id).one()
            )
            dashboard.dashboard_title = original_title
            chart = db.session.query(Slice).filter(Slice.id == chart_id).one()
            chart.slice_name = chart_original_name
            db.session.commit()

    def test_activity_pagination_clamps_oversized_page_size(self) -> None:
        """``?page_size=500`` is silently clamped to the contract max
        (200) rather than rejected with 400."""
        _persist_fixture_state()
        dashboard = _get_birth_names_dashboard()
        assert dashboard is not None
        self.login(ADMIN_USERNAME)
        rv = self._activity(str(dashboard.uuid), page_size="500")
        assert rv.status_code == 200


class TestChartActivityView(SupersetTestCase):
    """T028–T032 — ``GET /api/v1/chart/<uuid>/activity/`` (US2).

    Chart activity = chart's own edits + datasets the chart pointed at
    during association. **No** dashboard records — even when the chart
    is on a dashboard, sibling-traversal is excluded per the spec's
    Relationship Traversal section (T032).
    """

    @pytest.fixture(autouse=True)
    def _load_data(self, load_birth_names_dashboard_with_slices):  # noqa: PT004, F811
        pass

    def _activity(self, chart_uuid: str, **query: Any) -> Any:
        return self.client.get(
            f"/api/v1/chart/{chart_uuid}/activity/",
            query_string=query,
        )

    def _get_birth_names_chart(self) -> Slice:
        return db.session.query(Slice).filter(Slice.slice_name == "Girls").first()

    # ---- 4xx boundary cases ----

    def test_chart_activity_returns_404_for_unknown_uuid(self) -> None:
        self.login(ADMIN_USERNAME)
        rv = self._activity("00000000-0000-0000-0000-000000000000")
        assert rv.status_code == 404

    def test_chart_activity_returns_400_for_invalid_uuid(self) -> None:
        self.login(ADMIN_USERNAME)
        rv = self._activity("not-a-uuid")
        assert rv.status_code == 400

    def test_chart_activity_returns_400_for_invalid_include(self) -> None:
        _persist_fixture_state()
        chart = self._get_birth_names_chart()
        assert chart is not None
        self.login(ADMIN_USERNAME)
        rv = self._activity(str(chart.uuid), include="upstream")
        assert rv.status_code == 400

    def test_chart_activity_denies_non_owner(self) -> None:
        """Same shape as the dashboard endpoint: Alpha lacks ownership
        on the admin-fixture chart so raise_for_ownership returns 403."""
        _persist_fixture_state()
        chart = self._get_birth_names_chart()
        assert chart is not None
        self.login(ALPHA_USERNAME)
        rv = self._activity(str(chart.uuid))
        assert rv.status_code == 403

    # ---- 200 happy paths ----

    def test_chart_activity_returns_200_with_envelope_shape(self) -> None:
        _persist_fixture_state()
        chart = self._get_birth_names_chart()
        assert chart is not None
        self.login(ADMIN_USERNAME)
        rv = self._activity(str(chart.uuid))
        assert rv.status_code == 200
        body = _json.loads(rv.data.decode("utf-8"))
        assert isinstance(body["result"], list)
        assert isinstance(body["count"], int)

    def test_chart_activity_self_edit_appears_as_self_record(self) -> None:
        """Editing the chart itself surfaces a ``source=self``,
        ``entity_kind=Slice`` record."""
        _persist_fixture_state()
        chart = self._get_birth_names_chart()
        assert chart is not None
        chart_id = chart.id
        chart_uuid = str(chart.uuid)
        original_name = chart.slice_name

        try:
            chart.slice_name = f"{original_name} (edited self)"
            db.session.commit()

            self.login(ADMIN_USERNAME)
            rv = self._activity(chart_uuid)
            assert rv.status_code == 200
            body = _json.loads(rv.data.decode("utf-8"))
            self_records = [
                r
                for r in body["result"]
                if r["entity_kind"] == "Slice" and r["source"] == "self"
            ]
            got = [(r["entity_kind"], r["source"]) for r in body["result"]]
            assert self_records, (
                f"Expected ≥1 Slice/self record from the chart edit; got: {got}"
            )
        finally:
            db.session.rollback()
            chart = db.session.query(Slice).filter(Slice.id == chart_id).one()
            chart.slice_name = original_name
            db.session.commit()

    def test_chart_activity_includes_dataset_edit_as_related(self) -> None:
        """T030 / AS-1 of US2: editing the chart's dataset surfaces a
        ``source=related``, ``entity_kind=SqlaTable`` record."""
        _persist_fixture_state()
        chart = self._get_birth_names_chart()
        dataset = _get_birth_names_dataset()
        assert chart is not None
        assert dataset is not None
        chart_uuid = str(chart.uuid)
        dataset_id = dataset.id
        original_description = dataset.description

        try:
            dataset.description = "edited for activity-view test"
            db.session.commit()

            self.login(ADMIN_USERNAME)
            rv = self._activity(chart_uuid)
            assert rv.status_code == 200
            body = _json.loads(rv.data.decode("utf-8"))
            related = [
                r
                for r in body["result"]
                if r["entity_kind"] == "SqlaTable" and r["source"] == "related"
            ]
            assert related, (
                "Expected at least one SqlaTable/related record from the "
                "dataset edit; got: "
                f"{[(r['entity_kind'], r['source']) for r in body['result']]}"
            )
        finally:
            db.session.rollback()
            dataset = (
                db.session.query(SqlaTable).filter(SqlaTable.id == dataset_id).one()
            )
            dataset.description = original_description
            db.session.commit()

    def test_chart_activity_excludes_sibling_dashboards(self) -> None:
        """T032: Even when the chart is on a dashboard, dashboard edits
        do NOT appear in the chart's activity. Per the spec's Relationship
        Traversal section: charts don't see "sideways" to the dashboards
        they happen to be on."""
        _persist_fixture_state()
        chart = self._get_birth_names_chart()
        dashboard = _get_birth_names_dashboard()
        assert chart is not None
        assert dashboard is not None
        chart_uuid = str(chart.uuid)
        dashboard_id = dashboard.id
        original_title = dashboard.dashboard_title

        try:
            # Mutate the dashboard the chart is on — that edit MUST NOT
            # appear in the chart's activity stream.
            dashboard.dashboard_title = f"{original_title} (edited sibling)"
            db.session.commit()

            self.login(ADMIN_USERNAME)
            rv = self._activity(chart_uuid)
            assert rv.status_code == 200
            body = _json.loads(rv.data.decode("utf-8"))
            for record in body["result"]:
                assert record["entity_kind"] != "Dashboard", (
                    f"Dashboard edit leaked into chart's activity stream: {record}"
                )
        finally:
            db.session.rollback()
            dashboard = (
                db.session.query(Dashboard).filter(Dashboard.id == dashboard_id).one()
            )
            dashboard.dashboard_title = original_title
            db.session.commit()

    def test_chart_activity_include_self_excludes_related(self) -> None:
        """``?include=self`` filters out the dataset records."""
        _persist_fixture_state()
        chart = self._get_birth_names_chart()
        dataset = _get_birth_names_dataset()
        assert chart is not None
        assert dataset is not None
        chart_uuid = str(chart.uuid)
        dataset_id = dataset.id
        original_description = dataset.description

        try:
            dataset.description = "edited (self filter test)"
            db.session.commit()

            self.login(ADMIN_USERNAME)
            rv = self._activity(chart_uuid, include="self")
            assert rv.status_code == 200
            body = _json.loads(rv.data.decode("utf-8"))
            for record in body["result"]:
                assert record["source"] == "self"
                assert record["entity_kind"] == "Slice"
        finally:
            db.session.rollback()
            dataset = (
                db.session.query(SqlaTable).filter(SqlaTable.id == dataset_id).one()
            )
            dataset.description = original_description
            db.session.commit()
