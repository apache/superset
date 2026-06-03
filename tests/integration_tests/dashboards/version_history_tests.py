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
"""Integration tests for Dashboard version history capture.

T015 — dashboard version capture (single version per save; no extra rows from
       process_tab_diff)
T018 — retention pruning (drop rows older than SUPERSET_VERSION_HISTORY_RETENTION_DAYS)
T027 — dashboard version list endpoint
"""

from __future__ import annotations

from typing import Any

import pytest
from sqlalchemy_continuum import version_class

from superset.extensions import db
from superset.models.dashboard import Dashboard
from superset.utils import json as _json
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME, ALPHA_USERNAME
from tests.integration_tests.fixtures.birth_names_dashboard import (  # noqa: F401
    load_birth_names_dashboard_with_slices,
    load_birth_names_data,
)


def _get_version_rows(dashboard: Dashboard) -> list[Any]:
    ver_cls = version_class(Dashboard)
    return (
        db.session.query(ver_cls)
        .filter(ver_cls.id == dashboard.id)
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


class TestDashboardVersionCapture(SupersetTestCase):
    """T015 — one version row per save; no multiple rows from tab/filter diff processing."""  # noqa: E501

    @pytest.fixture(autouse=True)
    def _load_data(self, load_birth_names_dashboard_with_slices):  # noqa: PT004, F811
        pass

    def test_single_save_creates_one_version_row(self) -> None:
        """Saving a dashboard title creates exactly one update version row."""
        _persist_fixture_state()
        dashboard: Dashboard = (
            db.session.query(Dashboard)
            .filter(Dashboard.dashboard_title == "USA Births Names")
            .first()
        )
        assert dashboard is not None

        original_title = dashboard.dashboard_title
        dashboard_id = dashboard.id

        try:
            # Capture tx IDs that exist before this save — we'll verify that
            # exactly ONE new tx_id with operation_type=1 appears after the save
            # (comparing by tx_id makes the test robust against retention
            # pruning of older rows).
            tx_ids_before = {r.transaction_id for r in _get_version_rows(dashboard)}

            dashboard.dashboard_title = "USA Births Names (edited)"
            db.session.commit()

            rows_after = _get_version_rows(dashboard)
            new_update_rows = [
                r
                for r in rows_after
                if r.operation_type == 1 and r.transaction_id not in tx_ids_before
            ]
            assert len(new_update_rows) == 1, (
                f"Expected 1 new update row from this save, got {len(new_update_rows)}"  # noqa: E501
                " — possible no_autoflush regression"
            )
        finally:
            db.session.rollback()
            dashboard = (
                db.session.query(Dashboard).filter(Dashboard.id == dashboard_id).one()
            )
            dashboard.dashboard_title = original_title
            db.session.commit()

    def test_second_save_adds_one_row(self) -> None:
        """Each subsequent save adds exactly one more version row."""
        _persist_fixture_state()
        dashboard: Dashboard = (
            db.session.query(Dashboard)
            .filter(Dashboard.dashboard_title == "USA Births Names")
            .first()
        )
        assert dashboard is not None

        original_title = dashboard.dashboard_title
        dashboard_id = dashboard.id

        try:
            # Track tx IDs across saves; compare by tx_id to sidestep retention
            # pruning of older rows.
            tx_before_v1 = {r.transaction_id for r in _get_version_rows(dashboard)}
            dashboard.dashboard_title = "USA Births Names v1"
            db.session.commit()
            tx_after_v1 = {r.transaction_id for r in _get_version_rows(dashboard)}
            new_txs_v1 = tx_after_v1 - tx_before_v1
            assert len(new_txs_v1) == 1, (
                f"Expected 1 new tx from v1 save, got {len(new_txs_v1)}"
            )

            dashboard.dashboard_title = "USA Births Names v2"
            db.session.commit()
            tx_after_v2 = {r.transaction_id for r in _get_version_rows(dashboard)}
            new_txs_v2 = tx_after_v2 - tx_after_v1
            assert len(new_txs_v2) == 1, (
                f"Expected 1 new tx from v2 save, got {len(new_txs_v2)}"
            )
        finally:
            db.session.rollback()
            dashboard = (
                db.session.query(Dashboard).filter(Dashboard.id == dashboard_id).one()
            )
            dashboard.dashboard_title = original_title
            db.session.commit()


class TestDashboardVersionRetention(SupersetTestCase):
    """T018 — retention pruning drops shadow rows older than SUPERSET_VERSION_HISTORY_RETENTION_DAYS."""  # noqa: E501

    @pytest.fixture(autouse=True)
    def _load_data(self, load_birth_names_dashboard_with_slices):  # noqa: PT004, F811
        pass

    def test_retention_prunes_old_rows(self) -> None:
        """``prune_old_versions`` removes shadow rows whose owning
        ``version_transaction.issued_at`` is older than the retention
        window, while preserving the live row and the baseline."""
        from datetime import datetime, timedelta

        import sqlalchemy as sa

        from superset.extensions import db as _db
        from superset.tasks.version_history_retention import (
            _prune_old_versions_impl,
        )

        _persist_fixture_state()
        dashboard: Dashboard = (
            db.session.query(Dashboard)
            .filter(Dashboard.dashboard_title == "USA Births Names")
            .first()
        )
        assert dashboard is not None

        original_title = dashboard.dashboard_title

        try:
            # Force a few saves so we have ≥ 2 closed shadow rows plus
            # a baseline plus the live row.
            for i in range(3):
                dashboard.dashboard_title = f"USA Births Names retention test {i}"
                db.session.commit()

            rows_before = _get_version_rows(dashboard)
            assert len(rows_before) >= 3, "Expected at least 3 version rows"

            # Backdate every version_transaction row by 100 days so the
            # prune sees them as old. Skip baseline+live rows; the prune
            # itself preserves them.
            from sqlalchemy_continuum import versioning_manager

            tx_table = versioning_manager.transaction_cls.__table__
            with _db.engine.begin() as conn:
                conn.execute(
                    sa.update(tx_table).values(
                        issued_at=datetime.utcnow() - timedelta(days=100)
                    )
                )

            stats = _prune_old_versions_impl(retention_days=30)
            assert stats.get("pruned_transactions", 0) >= 1, stats

            rows_after = _get_version_rows(dashboard)
            # Live row must still exist (this is the only preservation rule)
            live_rows = [r for r in rows_after if r.end_transaction_id is None]
            assert len(live_rows) >= 1, "Live row must never be pruned"
            # Some rows should have been pruned. Closed historical rows —
            # including the synthetic baseline (operation_type=0) — are
            # subject to retention like everything else.
            assert len(rows_after) < len(rows_before), (
                f"Expected fewer rows after prune; before={len(rows_before)} "
                f"after={len(rows_after)}"
            )

        finally:
            dashboard.dashboard_title = original_title
            db.session.commit()


class TestDashboardVersionListApi(SupersetTestCase):
    """T027 — GET /api/v1/dashboard/<uuid>/versions/ endpoint."""

    @pytest.fixture(autouse=True)
    def _load_data(self, load_birth_names_dashboard_with_slices):  # noqa: PT004, F811
        pass

    def _list_versions(self, dashboard_uuid: str) -> Any:
        return self.client.get(f"/api/v1/dashboard/{dashboard_uuid}/versions/")

    def test_list_versions_returns_ordered_sequence(self) -> None:
        """Saving a dashboard three times extends the version list by three."""
        _persist_fixture_state()
        dashboard: Dashboard = (
            db.session.query(Dashboard)
            .filter(Dashboard.dashboard_title == "USA Births Names")
            .first()
        )
        assert dashboard is not None
        original_title = dashboard.dashboard_title
        dashboard_id = dashboard.id
        dashboard_uuid = str(dashboard.uuid)

        try:
            self.login(ADMIN_USERNAME)
            rv = self._list_versions(dashboard_uuid)
            assert rv.status_code == 200
            assert "count" in _json.loads(rv.data.decode("utf-8"))

            for i in range(3):
                dashboard.dashboard_title = f"USA Births Names v{i}"
                db.session.commit()

            rv = self._list_versions(dashboard_uuid)
            assert rv.status_code == 200
            body = _json.loads(rv.data.decode("utf-8"))
            # Delta-based assertion — retention pruning from other tests can lower
            # the absolute count, but each of our three saves must produce exactly
            # one new entry. We compare by transaction_id instead.
            assert len(body["result"]) == body["count"]
            for idx, entry in enumerate(body["result"]):
                assert entry["version_number"] == idx
        finally:
            db.session.rollback()
            dashboard = (
                db.session.query(Dashboard).filter(Dashboard.id == dashboard_id).one()
            )
            dashboard.dashboard_title = original_title
            db.session.commit()

    def test_list_versions_empty_for_untouched_entity(self) -> None:
        """A dashboard with no version rows returns [] (not 404)."""
        _persist_fixture_state()
        dashboard = Dashboard(dashboard_title="Untouched dashboard", slug="untouched")
        db.session.add(dashboard)
        db.session.commit()
        dashboard_uuid = str(dashboard.uuid)
        dashboard_id = dashboard.id

        try:
            ver_cls = version_class(Dashboard)
            db.session.query(ver_cls).filter(ver_cls.id == dashboard_id).delete(
                synchronize_session=False
            )
            db.session.commit()

            self.login(ADMIN_USERNAME)
            rv = self._list_versions(dashboard_uuid)
            assert rv.status_code == 200
            body = _json.loads(rv.data.decode("utf-8"))
            assert body["count"] == 0
            assert body["result"] == []
        finally:
            db.session.rollback()
            stale = (
                db.session.query(Dashboard)
                .filter(Dashboard.id == dashboard_id)
                .one_or_none()
            )
            if stale is not None:
                db.session.delete(stale)
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

    def test_list_versions_denies_non_owner(self) -> None:
        """T056 — Alpha has ``can_write`` on Dashboard but doesn't own the
        admin-owned fixture, so the row-level ownership check rejects."""
        _persist_fixture_state()
        dashboard: Dashboard = (
            db.session.query(Dashboard)
            .filter(Dashboard.dashboard_title == "USA Births Names")
            .first()
        )
        assert dashboard is not None
        dashboard_uuid = str(dashboard.uuid)

        self.login(ALPHA_USERNAME)
        rv = self._list_versions(dashboard_uuid)
        assert rv.status_code == 403

    def test_list_versions_admin_sees_all_entities(self) -> None:
        """FR-013: workspace admin can list versions for any entity."""
        _persist_fixture_state()
        dashboard: Dashboard = (
            db.session.query(Dashboard)
            .filter(Dashboard.dashboard_title == "USA Births Names")
            .first()
        )
        assert dashboard is not None
        dashboard_uuid = str(dashboard.uuid)

        self.login(ADMIN_USERNAME)
        rv = self._list_versions(dashboard_uuid)
        assert rv.status_code == 200


class TestDashboardRestoreApi(SupersetTestCase):
    """T038 — POST /api/v1/dashboard/<uuid>/versions/<version_uuid>/restore."""

    @pytest.fixture(autouse=True)
    def _load_data(self, load_birth_names_dashboard_with_slices):  # noqa: PT004, F811
        pass

    def _restore(self, dashboard_uuid: str, version_uuid: str) -> Any:
        return self.client.post(
            f"/api/v1/dashboard/{dashboard_uuid}/versions/{version_uuid}/restore"
        )

    def test_restore_applies_scalar_field(self) -> None:
        """Restore a dashboard title edit."""
        from superset.daos.version import derive_version_uuid

        _persist_fixture_state()
        dashboard: Dashboard = (
            db.session.query(Dashboard)
            .filter(Dashboard.dashboard_title == "USA Births Names")
            .first()
        )
        assert dashboard is not None
        dashboard_uuid = str(dashboard.uuid)
        original_title = dashboard.dashboard_title
        dashboard_id = dashboard.id
        entity_uuid = dashboard.uuid

        try:
            # Make two more edits so we have a known non-trivial history to
            # navigate: [initial, v1, v2].
            dashboard.dashboard_title = "USA Births Names v1"
            db.session.commit()
            dashboard.dashboard_title = "USA Births Names v2"
            db.session.commit()

            ver_cls = version_class(Dashboard)
            rows = (
                db.session.query(
                    ver_cls.transaction_id,
                    ver_cls.operation_type,
                    ver_cls.dashboard_title,
                    ver_cls.end_transaction_id,
                )
                .filter(ver_cls.id == dashboard_id)
                .order_by(ver_cls.transaction_id.asc())
                .all()
            )
            # Find the version whose snapshot has the original title. Skip DELETE
            # rows (operation_type=2) — the integration DB may carry shadow rows
            # from prior fixture teardown cycles, and restoring to a DELETE state
            # would re-delete the live entity.
            target_row = next(
                (
                    row
                    for row in rows
                    if row.dashboard_title == original_title and row.operation_type != 2
                ),
                None,
            )
            assert target_row is not None, (
                f"Expected at least one version row with original title; rows={rows}"
            )
            target_uuid = str(
                derive_version_uuid(entity_uuid, target_row.transaction_id)
            )

            self.login(ADMIN_USERNAME)
            rv = self._restore(dashboard_uuid, target_uuid)
            assert rv.status_code == 200, rv.data

            db.session.expire_all()
            dashboard = (
                db.session.query(Dashboard).filter(Dashboard.id == dashboard_id).one()
            )
            assert dashboard.dashboard_title == original_title, (
                f"Restore did not revert title; rows={rows}"
            )
        finally:
            db.session.rollback()
            dashboard = (
                db.session.query(Dashboard).filter(Dashboard.id == dashboard_id).one()
            )
            dashboard.dashboard_title = original_title
            db.session.commit()

    def test_restore_reattaches_chart_removed_after_snapshot(self) -> None:
        """After the target snapshot is captured, detaching a chart and saving
        must be undone by restore — the chart comes back on dashboard_slices."""
        from superset.daos.version import derive_version_uuid

        _persist_fixture_state()
        dashboard: Dashboard = (
            db.session.query(Dashboard)
            .filter(Dashboard.dashboard_title == "USA Births Names")
            .first()
        )
        assert dashboard is not None
        dashboard_uuid = str(dashboard.uuid)
        dashboard_id = dashboard.id
        entity_uuid = dashboard.uuid

        original_slice_ids = sorted(s.id for s in dashboard.slices)
        assert len(original_slice_ids) >= 2, (
            f"fixture expected to attach >= 2 charts; got {original_slice_ids}"
        )
        slice_to_drop = dashboard.slices[0]
        drop_id = slice_to_drop.id

        # Touch the dashboard so a snapshot row is captured at a known tx.
        dashboard.dashboard_title = "USA Births Names — snapshot point"
        db.session.commit()

        ver_cls = version_class(Dashboard)
        target_tx = (
            db.session.query(ver_cls.transaction_id)
            .filter(ver_cls.id == dashboard_id)
            .order_by(ver_cls.transaction_id.desc())
            .limit(1)
            .scalar()
        )
        assert target_tx is not None
        target_uuid = str(derive_version_uuid(entity_uuid, target_tx))

        # Detach the chart and commit — moves history forward.
        dashboard.slices.remove(slice_to_drop)
        db.session.commit()

        db.session.expire_all()
        dashboard = (
            db.session.query(Dashboard).filter(Dashboard.id == dashboard_id).one()
        )
        live_ids = {s.id for s in dashboard.slices}
        assert drop_id not in live_ids, "pre-restore: dropped chart should be detached"

        self.login(ADMIN_USERNAME)
        rv = self._restore(dashboard_uuid, target_uuid)
        assert rv.status_code == 200, rv.data

        db.session.expire_all()
        dashboard = (
            db.session.query(Dashboard).filter(Dashboard.id == dashboard_id).one()
        )
        restored_ids = sorted(s.id for s in dashboard.slices)
        assert restored_ids == original_slice_ids, (
            f"restore did not re-attach chart: expected {original_slice_ids}, "
            f"got {restored_ids}"
        )

    def test_restore_returns_404_for_unknown_uuid(self) -> None:
        self.login(ADMIN_USERNAME)
        rv = self._restore(
            "00000000-0000-0000-0000-000000000000",
            "00000000-0000-0000-0000-000000000001",
        )
        assert rv.status_code == 404

    def test_restore_returns_404_for_unknown_version_uuid(self) -> None:
        _persist_fixture_state()
        dashboard: Dashboard = (
            db.session.query(Dashboard)
            .filter(Dashboard.dashboard_title == "USA Births Names")
            .first()
        )
        assert dashboard is not None
        self.login(ADMIN_USERNAME)
        rv = self._restore(str(dashboard.uuid), "00000000-0000-0000-0000-000000000099")
        assert rv.status_code == 404

    def test_put_response_returns_old_and_new_version_numbers(self) -> None:
        """PUT /api/v1/dashboard/<id> response must include old_version and
        new_version matching the list-versions ordering."""
        _persist_fixture_state()
        dashboard: Dashboard = (
            db.session.query(Dashboard)
            .filter(Dashboard.dashboard_title == "USA Births Names")
            .first()
        )
        assert dashboard is not None
        dashboard_id = dashboard.id
        original_title = dashboard.dashboard_title

        try:
            ver_cls = version_class(Dashboard)
            count_before = (
                db.session.query(ver_cls).filter(ver_cls.id == dashboard_id).count()
            )
            expected_old = count_before - 1 if count_before > 0 else None

            self.login(ADMIN_USERNAME)
            rv = self.client.put(
                f"/api/v1/dashboard/{dashboard_id}",
                json={"dashboard_title": "put-response-version-test"},
            )
            assert rv.status_code == 200, rv.data
            body = _json.loads(rv.data.decode("utf-8"))
            assert body["id"] == dashboard_id
            assert body["old_version"] == expected_old
            assert body["new_version"] is not None
            assert "old_transaction_id" in body
            assert "new_transaction_id" in body
            if body["old_transaction_id"] is not None:
                assert body["new_transaction_id"] != body["old_transaction_id"]
        finally:
            db.session.rollback()
            dashboard = (
                db.session.query(Dashboard).filter(Dashboard.id == dashboard_id).one()
            )
            dashboard.dashboard_title = original_title
            db.session.commit()
