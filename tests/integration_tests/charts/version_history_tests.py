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
"""Integration tests for chart (Slice) version history capture.

T014 — chart version capture
T017 — baseline row capture
T018 (partial) — retention pruning (chart side)
T026 — chart version list endpoint
"""

from __future__ import annotations

from typing import Any

import pytest
from sqlalchemy_continuum import version_class

from superset.extensions import db
from superset.models.slice import Slice
from superset.utils import json as _json
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME
from tests.integration_tests.fixtures.birth_names_dashboard import (  # noqa: F401
    load_birth_names_dashboard_with_slices,
    load_birth_names_data,
)


def _get_version_rows(chart: Slice) -> list[Any]:
    ver_cls = version_class(Slice)
    return (
        db.session.query(ver_cls)
        .filter(ver_cls.id == chart.id)
        .order_by(ver_cls.transaction_id.asc())
        .all()
    )


def _persist_fixture_state() -> None:
    """Force fixture's pending INSERTs to commit in their own transaction.

    The birth_names fixture stages charts and the dashboard via session.add()
    but does not commit. Without this, the test's first commit batches the
    INSERTs and UPDATEs into the same Continuum transaction, causing the
    existing version row to be updated in place instead of a new one being
    created.
    """
    db.session.commit()


class TestChartVersionCapture(SupersetTestCase):
    """T014 — version rows are created on save; no spurious extra rows."""

    @pytest.fixture(autouse=True)
    def _load_data(self, load_birth_names_dashboard_with_slices):  # noqa: PT004, F811
        pass

    def test_single_save_creates_one_version_row(self) -> None:
        """Saving a chart for the first time creates exactly one version row."""
        _persist_fixture_state()
        chart: Slice = (
            db.session.query(Slice).filter(Slice.slice_name == "Girls").first()
        )
        assert chart is not None

        # Trigger a save (update a scalar field)
        original_name = chart.slice_name
        chart.slice_name = "Girls (edited)"
        db.session.commit()

        rows = _get_version_rows(chart)
        # Two rows: baseline (operation_type=0) + edit (operation_type=1)
        assert len(rows) == 2, f"Expected 2 version rows, got {len(rows)}"
        assert rows[0].operation_type == 0  # baseline
        assert rows[1].operation_type == 1  # update

        # Cleanup
        chart.slice_name = original_name
        db.session.commit()

    def test_two_saves_create_exactly_two_version_rows_after_baseline(self) -> None:
        """Second save adds exactly one more version row (no duplicate rows)."""
        _persist_fixture_state()
        chart: Slice = (
            db.session.query(Slice).filter(Slice.slice_name == "Boys").first()
        )
        assert chart is not None

        original_name = chart.slice_name

        chart.slice_name = "Boys v1"
        db.session.commit()
        rows_after_first = _get_version_rows(chart)
        # baseline + v1 = 2 rows
        assert len(rows_after_first) == 2

        chart.slice_name = "Boys v2"
        db.session.commit()
        rows_after_second = _get_version_rows(chart)
        # baseline + v1 + v2 = 3 rows
        assert len(rows_after_second) == 3
        assert rows_after_second[-1].slice_name == "Boys v2"

        # Cleanup
        chart.slice_name = original_name
        db.session.commit()


class TestChartBaselineCapture(SupersetTestCase):
    """T017 — the baseline listener inserts a pre-edit snapshot row (operation_type=0)."""  # noqa: E501

    @pytest.fixture(autouse=True)
    def _load_data(self, load_birth_names_dashboard_with_slices):  # noqa: PT004, F811
        pass

    def test_baseline_row_has_pre_edit_state(self) -> None:
        """The baseline row captures the field value *before* the first edit."""
        _persist_fixture_state()
        chart: Slice = (
            db.session.query(Slice)
            .filter(Slice.slice_name == "Top 10 Girl Name Share")
            .first()
        )
        assert chart is not None

        pre_edit_name = chart.slice_name
        chart.slice_name = "Top 10 Girl Name Share (baseline test)"
        db.session.commit()

        rows = _get_version_rows(chart)
        assert rows[0].operation_type == 0  # baseline row
        assert rows[0].slice_name == pre_edit_name  # pre-edit name preserved

        # Cleanup
        chart.slice_name = pre_edit_name
        db.session.commit()

    def test_baseline_row_is_at_position_zero_for_preexisting_entity(self) -> None:
        """When an entity has zero Continuum history (e.g. created before
        versioning was enabled), our baseline listener must produce a row
        that sorts to version_number 0 — i.e. its transaction_id must be
        strictly less than the UPDATE row Continuum writes in the same
        commit."""
        _persist_fixture_state()
        chart: Slice = (
            db.session.query(Slice).filter(Slice.slice_name == "Participants").first()
        )
        assert chart is not None
        chart_id = chart.id
        original_name = chart.slice_name

        # Wipe this chart's Continuum history so our baseline listener has
        # count==0 on the next save — simulating a pre-existing entity.
        ver_cls = version_class(Slice)
        db.session.query(ver_cls).filter(ver_cls.id == chart_id).delete(
            synchronize_session=False
        )
        db.session.commit()

        chart.slice_name = "Participants (preexisting baseline test)"
        db.session.commit()

        rows = _get_version_rows(chart)
        pairs = [(r.operation_type, r.transaction_id) for r in rows]
        assert len(rows) == 2, f"Expected baseline + update; got {pairs}"
        assert rows[0].operation_type == 0, (
            f"Position 0 should be the baseline (op=0); got "
            f"op={rows[0].operation_type} at tx={rows[0].transaction_id}"
        )
        assert rows[0].slice_name == original_name, (
            "The baseline row must carry the pre-edit slice_name"
        )
        assert rows[0].transaction_id < rows[1].transaction_id, (
            "Baseline's transaction_id must be less than the update's so it "
            "sorts to position 0"
        )

        # Cleanup
        chart.slice_name = original_name
        db.session.commit()

    def test_no_duplicate_baseline_on_subsequent_saves(self) -> None:
        """Subsequent saves do NOT add a second baseline row."""
        _persist_fixture_state()
        chart: Slice = (
            db.session.query(Slice)
            .filter(Slice.slice_name == "Top 10 Boy Name Share")
            .first()
        )
        assert chart is not None
        original_name = chart.slice_name

        chart.slice_name = "Top 10 Boy Name Share v1"
        db.session.commit()

        chart.slice_name = "Top 10 Boy Name Share v2"
        db.session.commit()

        baseline_rows = [r for r in _get_version_rows(chart) if r.operation_type == 0]
        assert len(baseline_rows) == 1, "Should have exactly one baseline row"

        # Cleanup
        chart.slice_name = original_name
        db.session.commit()


class TestChartVersionListApi(SupersetTestCase):
    """T026 — GET /api/v1/chart/<uuid>/versions/ endpoint."""

    @pytest.fixture(autouse=True)
    def _load_data(self, load_birth_names_dashboard_with_slices):  # noqa: PT004, F811
        pass

    def _list_versions(self, chart_uuid: str) -> Any:
        return self.client.get(f"/api/v1/chart/{chart_uuid}/versions/")

    def test_list_versions_returns_ordered_sequence(self) -> None:
        """Three saves produce three rows in ascending version_number order."""
        _persist_fixture_state()
        chart: Slice = (
            db.session.query(Slice).filter(Slice.slice_name == "Girls").first()
        )
        assert chart is not None
        original_name = chart.slice_name
        chart_uuid = str(chart.uuid)

        for i in range(3):
            chart.slice_name = f"Girls v{i}"
            db.session.commit()

        self.login(ADMIN_USERNAME)
        rv = self._list_versions(chart_uuid)
        assert rv.status_code == 200

        body = _json.loads(rv.data.decode("utf-8"))
        # Baseline + three updates = 4 rows; we only need to check the last 3
        # are the updates we just made in order.
        assert body["count"] == len(body["result"])
        assert len(body["result"]) >= 3
        for idx, entry in enumerate(body["result"]):
            assert entry["version_number"] == idx
            assert entry["issued_at"] is not None
        # Timestamps are monotonically non-decreasing.
        timestamps = [e["issued_at"] for e in body["result"]]
        assert timestamps == sorted(timestamps)

        # Cleanup
        chart.slice_name = original_name
        db.session.commit()

    def test_list_versions_empty_for_untouched_entity(self) -> None:
        """A chart with no version rows returns [] (not 404)."""
        _persist_fixture_state()
        # Create a chart without subsequently editing it.
        chart = Slice(
            slice_name="Untouched chart for version list test",
            datasource_type="table",
            viz_type="table",
        )
        db.session.add(chart)
        db.session.commit()
        chart_uuid = str(chart.uuid)

        # Purge the INSERT version row so the history is genuinely empty.
        ver_cls = version_class(Slice)
        db.session.query(ver_cls).filter(ver_cls.id == chart.id).delete(
            synchronize_session=False
        )
        db.session.commit()

        self.login(ADMIN_USERNAME)
        rv = self._list_versions(chart_uuid)
        assert rv.status_code == 200
        body = _json.loads(rv.data.decode("utf-8"))
        assert body["count"] == 0
        assert body["result"] == []

        # Cleanup
        db.session.delete(chart)
        db.session.commit()

    def test_list_versions_returns_404_for_unknown_uuid(self) -> None:
        """An unknown UUID returns 404."""
        self.login(ADMIN_USERNAME)
        rv = self._list_versions("00000000-0000-0000-0000-000000000000")
        assert rv.status_code == 404

    def test_list_versions_returns_400_for_invalid_uuid(self) -> None:
        """A malformed UUID string is rejected with 400."""
        self.login(ADMIN_USERNAME)
        rv = self._list_versions("not-a-uuid")
        assert rv.status_code == 400

    @pytest.mark.skip(
        reason=(
            "Superset's default Gamma role has can_write on Chart — there is "
            "no built-in no-write user to exercise the 403 branch for this "
            "resource. See dataset tests (T028) for a working 403 check."
        )
    )
    def test_list_versions_denies_without_write_permission(self) -> None:
        """A user without can_write on Chart gets 403."""

    def test_list_versions_admin_sees_all_entities(self) -> None:
        """FR-013: workspace admin can list versions for any entity."""
        _persist_fixture_state()
        chart: Slice = (
            db.session.query(Slice).filter(Slice.slice_name == "Boys").first()
        )
        assert chart is not None
        chart_uuid = str(chart.uuid)

        self.login(ADMIN_USERNAME)
        rv = self._list_versions(chart_uuid)
        assert rv.status_code == 200


class TestChartRestoreApi(SupersetTestCase):
    """T037 — POST /api/v1/chart/<uuid>/versions/<version_uuid>/restore."""

    @pytest.fixture(autouse=True)
    def _load_data(self, load_birth_names_dashboard_with_slices):  # noqa: PT004, F811
        pass

    def _restore(self, chart_uuid: str, version_uuid: str) -> Any:
        return self.client.post(
            f"/api/v1/chart/{chart_uuid}/versions/{version_uuid}/restore"
        )

    def _list(self, chart_uuid: str) -> Any:
        return self.client.get(f"/api/v1/chart/{chart_uuid}/versions/")

    def test_restore_applies_scalar_field_from_target_version(self) -> None:
        """Restoring version 0 puts the slice_name back to its pre-edit value
        and appends a new version entry."""
        _persist_fixture_state()
        chart: Slice = (
            db.session.query(Slice).filter(Slice.slice_name == "Girls").first()
        )
        assert chart is not None
        chart_uuid = str(chart.uuid)
        original_name = chart.slice_name

        # Produce two additional saves so version history is 0/1/2.
        chart.slice_name = "Girls v1"
        db.session.commit()
        chart.slice_name = "Girls v2"
        db.session.commit()

        self.login(ADMIN_USERNAME)
        rv_list = self._list(chart_uuid)
        assert rv_list.status_code == 200
        listing = _json.loads(rv_list.data.decode("utf-8"))
        initial_count = listing["count"]
        assert initial_count >= 3
        target_uuid = listing["result"][0]["version_uuid"]

        # Restore to the first version (the original "Girls" name).
        rv = self._restore(chart_uuid, target_uuid)
        assert rv.status_code == 200, rv.data

        # Live state matches the restored snapshot.
        db.session.expire_all()
        chart = db.session.query(Slice).filter(Slice.uuid == chart.uuid).one()
        assert chart.slice_name == original_name

        # A new version row was recorded (non-destructive).
        rv_list2 = self._list(chart_uuid)
        body = _json.loads(rv_list2.data.decode("utf-8"))
        assert body["count"] == initial_count + 1

        # Cleanup
        chart.slice_name = original_name
        db.session.commit()

    def test_restore_returns_404_for_unknown_uuid(self) -> None:
        self.login(ADMIN_USERNAME)
        rv = self._restore(
            "00000000-0000-0000-0000-000000000000",
            "00000000-0000-0000-0000-000000000001",
        )
        assert rv.status_code == 404

    def test_restore_returns_404_for_unknown_version_uuid(self) -> None:
        _persist_fixture_state()
        chart: Slice = (
            db.session.query(Slice).filter(Slice.slice_name == "Boys").first()
        )
        assert chart is not None
        self.login(ADMIN_USERNAME)
        rv = self._restore(str(chart.uuid), "00000000-0000-0000-0000-000000000099")
        assert rv.status_code == 404

    def test_restore_returns_400_for_invalid_entity_uuid(self) -> None:
        self.login(ADMIN_USERNAME)
        rv = self._restore("not-a-uuid", "00000000-0000-0000-0000-000000000001")
        assert rv.status_code == 400

    def test_restore_returns_400_for_invalid_version_uuid(self) -> None:
        _persist_fixture_state()
        chart: Slice = (
            db.session.query(Slice).filter(Slice.slice_name == "Boys").first()
        )
        assert chart is not None
        self.login(ADMIN_USERNAME)
        rv = self._restore(str(chart.uuid), "not-a-uuid")
        assert rv.status_code == 400

    def test_get_version_returns_historical_snapshot(self) -> None:
        """GET /versions/<uuid>/ returns the chart's fields at that version
        without modifying live state."""
        _persist_fixture_state()
        chart: Slice = (
            db.session.query(Slice).filter(Slice.slice_name == "Girls").first()
        )
        assert chart is not None
        chart_uuid = str(chart.uuid)
        original_name = chart.slice_name

        chart.slice_name = "Girls (v1)"
        db.session.commit()

        self.login(ADMIN_USERNAME)
        listing = _json.loads(self._list(chart_uuid).data.decode("utf-8"))
        assert listing["count"] >= 2
        # The earliest entry should still hold the original slice_name.
        first_version_uuid = listing["result"][0]["version_uuid"]

        rv = self.client.get(
            f"/api/v1/chart/{chart_uuid}/versions/{first_version_uuid}/"
        )
        assert rv.status_code == 200, rv.data
        body = _json.loads(rv.data.decode("utf-8"))["result"]
        assert body["slice_name"] == original_name
        assert body["_version"]["version_uuid"] == first_version_uuid
        assert body["_version"]["version_number"] == 0
        # Live row unchanged.
        db.session.expire_all()
        live = db.session.query(Slice).filter(Slice.uuid == chart.uuid).one()
        assert live.slice_name == "Girls (v1)"

        # Cleanup
        live.slice_name = original_name
        db.session.commit()

    def test_get_version_returns_404_for_unknown_entity(self) -> None:
        self.login(ADMIN_USERNAME)
        rv = self.client.get(
            "/api/v1/chart/00000000-0000-0000-0000-000000000000"
            "/versions/00000000-0000-0000-0000-000000000001/"
        )
        assert rv.status_code == 404

    def test_get_version_returns_400_for_invalid_uuid(self) -> None:
        self.login(ADMIN_USERNAME)
        rv = self.client.get(
            "/api/v1/chart/not-a-uuid/versions/00000000-0000-0000-0000-000000000001/"
        )
        assert rv.status_code == 400

    def test_restore_stamps_changed_by_with_restoring_user(self) -> None:
        """After a restore, changed_by_fk on the live entity must point at
        the restoring user (not at whoever authored the version being
        restored). created_by_fk stays unchanged. The new version row
        produced by the restore also carries the restoring user in its
        changed_by metadata.
        """
        from superset.daos.version import derive_version_uuid

        _persist_fixture_state()
        self.login(ADMIN_USERNAME)
        admin_id = self.get_user(ADMIN_USERNAME).id
        chart: Slice = (
            db.session.query(Slice).filter(Slice.slice_name == "Girls").first()
        )
        assert chart is not None
        chart_id = chart.id
        chart_uuid = str(chart.uuid)
        entity_uuid = chart.uuid
        original_name = chart.slice_name
        original_created_by = chart.created_by_fk
        before_changed_on = chart.changed_on

        # Produce a second version to restore to.
        chart.slice_name = "Girls v1"
        db.session.commit()

        ver_cls = version_class(Slice)
        first_tx = (
            db.session.query(ver_cls.transaction_id)
            .filter(ver_cls.id == chart_id)
            .order_by(ver_cls.transaction_id.asc())
            .limit(1)
            .scalar()
        )
        assert first_tx is not None
        target_uuid = str(derive_version_uuid(entity_uuid, first_tx))

        rv = self.client.post(
            f"/api/v1/chart/{chart_uuid}/versions/{target_uuid}/restore"
        )
        assert rv.status_code == 200, rv.data

        db.session.expire_all()
        chart = db.session.query(Slice).filter(Slice.id == chart_id).one()

        # Live entity checks.
        assert chart.slice_name == original_name
        assert chart.created_by_fk == original_created_by
        assert chart.changed_by_fk == admin_id, (
            f"Expected changed_by_fk to be restoring user id={admin_id}, "
            f"got {chart.changed_by_fk}"
        )
        if before_changed_on is not None and chart.changed_on is not None:
            assert chart.changed_on >= before_changed_on

        # The new version row produced by the restore must attribute the
        # change to the restoring user.
        rv_list = self.client.get(f"/api/v1/chart/{chart_uuid}/versions/")
        assert rv_list.status_code == 200
        body = _json.loads(rv_list.data.decode("utf-8"))
        latest_entry = body["result"][-1]
        assert latest_entry["changed_by"] is not None, (
            "New version row should have a changed_by"
        )
        assert latest_entry["changed_by"]["id"] == admin_id

        # Cleanup
        chart.slice_name = original_name
        db.session.commit()

    def test_put_response_returns_old_and_new_version_numbers(self) -> None:
        """PUT /api/v1/chart/<id> response must include old_version and
        new_version matching the list-versions ordering."""
        _persist_fixture_state()
        chart: Slice = (
            db.session.query(Slice).filter(Slice.slice_name == "Girls").first()
        )
        assert chart is not None
        chart_id = chart.id
        original_name = chart.slice_name

        ver_cls = version_class(Slice)
        count_before = db.session.query(ver_cls).filter(ver_cls.id == chart_id).count()
        expected_old = count_before - 1 if count_before > 0 else None

        self.login(ADMIN_USERNAME)
        rv = self.client.put(
            f"/api/v1/chart/{chart_id}",
            json={"slice_name": "put-response-version-test"},
        )
        assert rv.status_code == 200, rv.data
        body = _json.loads(rv.data.decode("utf-8"))
        assert body["id"] == chart_id
        assert body["old_version"] == expected_old
        assert body["new_version"] is not None
        assert "old_transaction_id" in body
        assert "new_transaction_id" in body
        if body["old_transaction_id"] is not None:
            assert body["new_transaction_id"] != body["old_transaction_id"]

        # Cleanup
        chart = db.session.query(Slice).filter(Slice.id == chart_id).one()
        chart.slice_name = original_name
        db.session.commit()

    @pytest.mark.skip(
        reason=(
            "Per-entity ownership isn't enforced yet for the restore path — "
            "raise_for_ownership is called inside validate(), but Gamma has "
            "can_write on Chart so the admin-only assertion needs a custom "
            "no-write user setup. See dataset tests (T039) for a working "
            "403 check."
        )
    )
    def test_restore_denies_without_write_permission(self) -> None:
        """A user without can_write on Chart gets 403."""
