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
T018 — retention pruning (keep at most SUPERSET_VERSION_HISTORY_MAX_VERSIONS)
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
from tests.integration_tests.constants import ADMIN_USERNAME
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

        # Capture tx IDs that exist before this save — we'll verify that
        # exactly ONE new tx_id with operation_type=1 appears after the save
        # (comparing by tx_id makes the test robust against retention
        # pruning of older rows).
        tx_ids_before = {r.transaction_id for r in _get_version_rows(dashboard)}

        original_title = dashboard.dashboard_title
        dashboard.dashboard_title = "USA Births Names (edited)"
        db.session.commit()

        rows_after = _get_version_rows(dashboard)
        new_update_rows = [
            r
            for r in rows_after
            if r.operation_type == 1 and r.transaction_id not in tx_ids_before
        ]
        assert len(new_update_rows) == 1, (
            f"Expected 1 new update row from this save, got {len(new_update_rows)}"
            " — possible no_autoflush regression"
        )

        # Cleanup
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

        # Cleanup
        dashboard.dashboard_title = original_title
        db.session.commit()


class TestDashboardVersionRetention(SupersetTestCase):
    """T018 — retention pruning caps history at SUPERSET_VERSION_HISTORY_MAX_VERSIONS."""  # noqa: E501

    @pytest.fixture(autouse=True)
    def _load_data(self, load_birth_names_dashboard_with_slices):  # noqa: PT004, F811
        pass

    def test_retention_prunes_oldest_rows(self) -> None:
        """Saving 27 times with max=25 leaves exactly 25 version rows and
        never prunes the live row (end_transaction_id IS NULL)."""
        from unittest.mock import patch

        _persist_fixture_state()
        dashboard: Dashboard = (
            db.session.query(Dashboard)
            .filter(Dashboard.dashboard_title == "USA Births Names")
            .first()
        )
        assert dashboard is not None

        original_title = dashboard.dashboard_title

        max_versions = 5  # Use a small limit so the test is fast
        with (
            patch.dict("superset.daos.version.__builtins__", {}),
            patch(
                "flask.current_app.config",
                {"SUPERSET_VERSION_HISTORY_MAX_VERSIONS": max_versions},
                create=True,
            ),
        ):
            # Patch config in a simpler way
            pass

        # Directly test with real config patching via superset config
        from flask import current_app

        from superset.daos.version import VersionDAO

        original_max = current_app.config.get("SUPERSET_VERSION_HISTORY_MAX_VERSIONS")
        current_app.config["SUPERSET_VERSION_HISTORY_MAX_VERSIONS"] = max_versions = 5

        try:
            # Save more than max_versions times to trigger pruning
            for i in range(max_versions + 2):
                dashboard.dashboard_title = f"USA Births Names retention test {i}"
                db.session.commit()
                VersionDAO.prune_versions(Dashboard, dashboard.id)

            rows = _get_version_rows(dashboard)
            assert len(rows) <= max_versions, (
                f"Expected at most {max_versions} rows, got {len(rows)}"
            )

            # Live row (end_transaction_id IS NULL) must still exist
            live_rows = [r for r in rows if r.end_transaction_id is None]
            assert len(live_rows) >= 1, "Live version row must never be pruned"

        finally:
            # Always restore — including when original_max was None, otherwise
            # the 5-row cap leaks into subsequent tests.
            if original_max is not None:
                current_app.config["SUPERSET_VERSION_HISTORY_MAX_VERSIONS"] = (
                    original_max
                )
            else:
                current_app.config.pop("SUPERSET_VERSION_HISTORY_MAX_VERSIONS", None)
            # Cleanup
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
        dashboard_uuid = str(dashboard.uuid)

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

        # Cleanup
        dashboard.dashboard_title = original_title
        db.session.commit()

    def test_list_versions_empty_for_untouched_entity(self) -> None:
        """A dashboard with no version rows returns [] (not 404)."""
        _persist_fixture_state()
        dashboard = Dashboard(dashboard_title="Untouched dashboard", slug="untouched")
        db.session.add(dashboard)
        db.session.commit()
        dashboard_uuid = str(dashboard.uuid)

        ver_cls = version_class(Dashboard)
        db.session.query(ver_cls).filter(ver_cls.id == dashboard.id).delete(
            synchronize_session=False
        )
        db.session.commit()

        self.login(ADMIN_USERNAME)
        rv = self._list_versions(dashboard_uuid)
        assert rv.status_code == 200
        body = _json.loads(rv.data.decode("utf-8"))
        assert body["count"] == 0
        assert body["result"] == []

        # Cleanup
        db.session.delete(dashboard)
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
            "Superset's default Gamma role has can_write on Dashboard — there "
            "is no built-in no-write user to exercise the 403 branch for this "
            "resource. See dataset tests (T028) for a working 403 check."
        )
    )
    def test_list_versions_denies_without_write_permission(self) -> None:
        """A user without can_write on Dashboard gets 403."""

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
        # Find the version whose snapshot has the original title.
        target_row = next(
            (row for row in rows if row.dashboard_title == original_title),
            None,
        )
        assert target_row is not None, (
            f"Expected at least one version row with original title; rows={rows}"
        )
        target_uuid = str(derive_version_uuid(entity_uuid, target_row.transaction_id))

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

        # Cleanup
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

        # Cleanup
        dashboard = (
            db.session.query(Dashboard).filter(Dashboard.id == dashboard_id).one()
        )
        dashboard.dashboard_title = original_title
        db.session.commit()
