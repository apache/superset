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
"""Integration tests for Dashboard version restore.

Covers POST /api/v1/dashboard/<uuid>/versions/<version_uuid>/restore:
the non-destructive revert applies the target snapshot (including
reattaching a chart removed after that snapshot) and returns the
documented 404s for unknown entity/version UUIDs.
"""

from __future__ import annotations

from typing import Any

import pytest
import sqlalchemy as sa
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
        .filter(ver_cls.id == dashboard.id, ver_cls.uuid == dashboard.uuid)
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
        assert entity_uuid is not None

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
            .filter(ver_cls.id == dashboard_id, ver_cls.uuid == entity_uuid)
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
        assert entity_uuid is not None

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
            .filter(ver_cls.id == dashboard_id, ver_cls.uuid == entity_uuid)
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

    def test_restore_preserves_live_chart_content(self) -> None:
        """Dashboard restore is membership-only: a member chart edited
        AFTER the snapshot keeps its current content — charts are shared
        entities with their own restore endpoint, so a dashboard restore
        must never rewrite them to historical values."""
        from superset.daos.version import derive_version_uuid
        from superset.models.slice import Slice

        _persist_fixture_state()
        dashboard: Dashboard = (
            db.session.query(Dashboard)
            .filter(Dashboard.dashboard_title == "USA Births Names")
            .first()
        )
        assert dashboard is not None
        dashboard_id = dashboard.id
        member = dashboard.slices[0]
        member_id = member.id
        original_chart_name = member.slice_name
        original_title = dashboard.dashboard_title

        # Snapshot point: chart still has its original name.
        dashboard.dashboard_title = "USA Births Names — content snapshot"
        db.session.commit()

        ver_cls = version_class(Dashboard)
        entity_uuid = dashboard.uuid
        assert entity_uuid is not None
        target_tx = (
            db.session.query(ver_cls.transaction_id)
            .filter(ver_cls.id == dashboard_id, ver_cls.uuid == entity_uuid)
            .order_by(ver_cls.transaction_id.desc())
            .limit(1)
            .scalar()
        )
        target_uuid = str(derive_version_uuid(entity_uuid, target_tx))

        # Edit the member chart AFTER the snapshot.
        member = db.session.query(Slice).filter(Slice.id == member_id).one()
        member.slice_name = "edited after snapshot"
        db.session.commit()

        self.login(ADMIN_USERNAME)
        rv = self._restore(str(dashboard.uuid), target_uuid)
        assert rv.status_code == 200, rv.data

        db.session.expire_all()
        member = db.session.query(Slice).filter(Slice.id == member_id).one()
        assert member.slice_name == "edited after snapshot", (
            "dashboard restore must not rewrite live member chart content"
        )

        # Cleanup
        member.slice_name = original_chart_name
        dashboard = (
            db.session.query(Dashboard).filter(Dashboard.id == dashboard_id).one()
        )
        dashboard.dashboard_title = original_title
        db.session.commit()

    def test_restore_skips_member_chart_that_no_longer_exists(self) -> None:
        """A snapshot member whose chart row has been hard-deleted stays
        deleted: restore succeeds, reattaches the surviving members, does
        NOT revive the deleted chart, and says so in the response."""
        from superset.daos.version import derive_version_uuid
        from superset.models.slice import Slice

        _persist_fixture_state()
        dashboard: Dashboard = (
            db.session.query(Dashboard)
            .filter(Dashboard.dashboard_title == "USA Births Names")
            .first()
        )
        assert dashboard is not None
        dashboard_id = dashboard.id
        original_ids = sorted(s.id for s in dashboard.slices)
        assert len(original_ids) >= 2
        victim = dashboard.slices[0]
        victim_id = victim.id

        # Snapshot point: victim is a member.
        dashboard.dashboard_title = "USA Births Names — skip snapshot"
        db.session.commit()

        ver_cls = version_class(Dashboard)
        entity_uuid = dashboard.uuid
        assert entity_uuid is not None
        target_tx = (
            db.session.query(ver_cls.transaction_id)
            .filter(ver_cls.id == dashboard_id, ver_cls.uuid == entity_uuid)
            .order_by(ver_cls.transaction_id.desc())
            .limit(1)
            .scalar()
        )
        target_uuid = str(derive_version_uuid(entity_uuid, target_tx))

        # Detach, then hard-delete the victim via raw SQL so no live row
        # remains (bypasses the soft-delete listener deliberately — the
        # scenario is a purged/legacy-deleted chart).
        dashboard.slices.remove(victim)
        db.session.commit()
        for assoc in ("chart_editors", "chart_viewers"):
            db.session.execute(
                sa.text(f"DELETE FROM {assoc} WHERE chart_id = :sid"),  # noqa: S608
                {"sid": victim_id},
            )
        db.session.execute(
            sa.text("DELETE FROM slices WHERE id = :sid"), {"sid": victim_id}
        )
        db.session.commit()

        self.login(ADMIN_USERNAME)
        rv = self._restore(str(dashboard.uuid), target_uuid)
        assert rv.status_code == 200, rv.data
        message = _json.loads(rv.data.decode("utf-8")).get("message", "")
        assert "no longer exist" in message, message

        db.session.expire_all()
        dashboard = (
            db.session.query(Dashboard).filter(Dashboard.id == dashboard_id).one()
        )
        restored_ids = sorted(s.id for s in dashboard.slices)
        assert victim_id not in restored_ids, "deleted chart must stay deleted"
        assert restored_ids == sorted(sid for sid in original_ids if sid != victim_id)
        assert (
            db.session.query(Slice).filter(Slice.id == victim_id).one_or_none() is None
        ), "restore must not revive a hard-deleted chart"

    def test_restore_denies_non_editor_with_write_permission(self) -> None:
        """A user holding can_write on Dashboard but who is not an editor
        of THIS dashboard gets 403 from the command's editorship check."""
        from superset.daos.version import derive_version_uuid
        from tests.integration_tests.constants import ALPHA_USERNAME

        _persist_fixture_state()
        dashboard: Dashboard = (
            db.session.query(Dashboard)
            .filter(Dashboard.dashboard_title == "USA Births Names")
            .first()
        )
        assert dashboard is not None
        alpha = self.get_user(ALPHA_USERNAME)
        assert alpha not in dashboard.editors

        ver_cls = version_class(Dashboard)
        entity_uuid = dashboard.uuid
        assert entity_uuid is not None
        first_tx = (
            db.session.query(ver_cls.transaction_id)
            .filter(ver_cls.id == dashboard.id, ver_cls.uuid == dashboard.uuid)
            .order_by(ver_cls.transaction_id.asc())
            .limit(1)
            .scalar()
        )
        assert first_tx is not None
        target_uuid = str(derive_version_uuid(entity_uuid, first_tx))

        self.login(ALPHA_USERNAME)
        rv = self._restore(str(dashboard.uuid), target_uuid)
        assert rv.status_code == 403, rv.data
        db.session.refresh(dashboard)
        assert dashboard.dashboard_title == "USA Births Names"

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
        # Pin to (id, uuid), as the API's version lookup does. A shared test
        # database recycles integer ids across the suite, so an id-only count
        # picks up shadow rows belonging to hard-deleted predecessors and
        # over-states this dashboard's history.
        count_before = (
            db.session.query(ver_cls)
            .filter(ver_cls.id == dashboard_id, ver_cls.uuid == dashboard.uuid)
            .count()
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
