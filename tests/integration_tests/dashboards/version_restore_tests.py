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
from unittest.mock import patch
from uuid import UUID

import pytest
import sqlalchemy as sa
from flask_appbuilder.security.sqla.models import User
from parameterized import parameterized
from sqlalchemy_continuum import version_class
from werkzeug.test import TestResponse

from superset.extensions import db
from superset.models.dashboard import Dashboard
from superset.utils import json as _json
from superset.versioning.activity.windows import M2M_OP_DELETE
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME
from tests.integration_tests.fixtures.birth_names_dashboard import (  # noqa: F401
    load_birth_names_dashboard_with_slices,
    load_birth_names_data,
)
from tests.integration_tests.insert_chart_mixin import InsertChartMixin


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

    def test_restore_to_tx_after_removal_does_not_reattach_chart(self) -> None:
        """The inverse of the re-attach case (sc-119907): restoring to a
        snapshot captured *after* a chart was removed must NOT bring it back.

        Continuum never closes an association shadow row's
        ``end_transaction_id``, so the removed chart's INSERT row still looks
        "valid at" any later tx under a naive validity filter — it would be
        wrongly re-attached. Membership must be derived from paired
        attach/detach windows: the window ``[attach, remove)`` does not contain
        the post-removal target tx, so the chart stays off.
        """
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

        # Remove the chart and commit — the detach is recorded in history.
        dashboard.slices.remove(slice_to_drop)
        db.session.commit()

        # Touch the dashboard AFTER the removal so the restore target snapshot
        # post-dates the detach.
        dashboard.dashboard_title = "USA Births Names — post-removal snapshot"
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

        self.login(ADMIN_USERNAME)
        rv = self._restore(dashboard_uuid, target_uuid)
        assert rv.status_code == 200, rv.data

        db.session.expire_all()
        dashboard = (
            db.session.query(Dashboard).filter(Dashboard.id == dashboard_id).one()
        )
        restored_ids = sorted(s.id for s in dashboard.slices)
        assert drop_id not in restored_ids, (
            "restore re-attached a chart that was removed before the target "
            f"snapshot: {drop_id} in {restored_ids}"
        )
        survivors = sorted(set(original_slice_ids) - {drop_id})
        assert restored_ids == survivors, (
            f"expected the surviving members {survivors}, got {restored_ids}"
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

    @parameterized.expand([(True, False), (False, True), (True, True)])
    def test_restore_sets_archived_chart_membership(
        self, in_snapshot: bool, member_when_archived: bool
    ) -> None:
        """An archived chart's membership follows the restored version.

        An archived chart is still a recoverable member: restoring the chart
        later puts it back on the dashboards it belongs to. So a restored
        version that had the chart links it again, and one that didn't
        unlinks it.
        """
        from superset.daos.version import derive_version_uuid
        from superset.models.slice import Slice

        _persist_fixture_state()
        dashboard: Dashboard = (
            db.session.query(Dashboard)
            .filter(Dashboard.dashboard_title == "USA Births Names")
            .first()
        )
        assert dashboard is not None
        dashboard_id: int = dashboard.id
        original_ids: list[int] = sorted(s.id for s in dashboard.slices)
        assert len(original_ids) >= 2
        archived: Slice = dashboard.slices[0]
        archived_id: int = archived.id
        if not in_snapshot:
            dashboard.slices.remove(archived)
            db.session.commit()

        # Snapshot point.
        dashboard.dashboard_title = "USA Births Names — archived snapshot"
        db.session.commit()
        ver_cls: Any = version_class(Dashboard)
        entity_uuid: UUID | None = dashboard.uuid
        assert entity_uuid is not None
        target_tx: int = (
            db.session.query(ver_cls.transaction_id)
            .filter(ver_cls.id == dashboard_id, ver_cls.uuid == entity_uuid)
            .order_by(ver_cls.transaction_id.desc())
            .limit(1)
            .scalar()
        )
        target_uuid: str = str(derive_version_uuid(entity_uuid, target_tx))

        # Set the membership the chart has when it is archived.
        if in_snapshot and not member_when_archived:
            dashboard.slices.remove(archived)
        elif member_when_archived and not in_snapshot:
            dashboard.slices.append(archived)
        db.session.commit()
        self.login(ADMIN_USERNAME)
        assert self.client.delete(f"/api/v1/chart/{archived_id}").status_code == 200
        chart_restored: bool = False
        try:
            rv: Any = self._restore(str(dashboard.uuid), target_uuid)
            assert rv.status_code == 200, rv.data
            message: str = _json.loads(rv.data.decode("utf-8")).get("message", "")
            assert "no longer exist" not in message, message

            db.session.expire_all()
            members: set[int] = {
                row[0]
                for row in db.session.execute(
                    sa.text(
                        "SELECT slice_id FROM dashboard_slices "
                        "WHERE dashboard_id = :dashboard_id"
                    ),
                    {"dashboard_id": dashboard_id},
                )
            }
            others: set[int] = set(original_ids) - {archived_id}
            assert members == (others | {archived_id} if in_snapshot else others)
            # The archived chart's newest association history row agrees.
            latest_operation: int = db.session.execute(
                sa.text(
                    "SELECT operation_type FROM dashboard_slices_version "
                    "WHERE dashboard_id = :dashboard_id AND slice_id = :slice_id "
                    "ORDER BY transaction_id DESC, operation_type DESC LIMIT 1"
                ),
                {"dashboard_id": dashboard_id, "slice_id": archived_id},
            ).scalar_one()
            assert (latest_operation != M2M_OP_DELETE) is in_snapshot

            # Restoring the chart brings it back only where the version had it.
            rv = self.client.post(f"/api/v1/chart/{archived.uuid}/restore")
            assert rv.status_code == 200, rv.data
            chart_restored = True
            db.session.expire_all()
            dashboard = db.session.get(Dashboard, dashboard_id)
            assert (archived_id in {s.id for s in dashboard.slices}) is in_snapshot
        finally:
            db.session.rollback()
            if not chart_restored:
                self.client.post(f"/api/v1/chart/{archived.uuid}/restore")
            # Leave the fixture's dashboard with all of its charts.
            db.session.expire_all()
            dashboard = db.session.get(Dashboard, dashboard_id)
            if archived_id not in {s.id for s in dashboard.slices}:
                dashboard.slices.append(db.session.get(Slice, archived_id))
                db.session.commit()

    def test_restore_unlinks_archived_chart_from_empty_version(self) -> None:
        """A version with no charts unlinks a chart archived since then."""
        from superset.daos.version import derive_version_uuid
        from superset.models.slice import Slice

        _persist_fixture_state()
        source: Dashboard = (
            db.session.query(Dashboard)
            .filter(Dashboard.dashboard_title == "USA Births Names")
            .first()
        )
        assert source is not None
        archived: Slice = source.slices[0]
        archived_id: int = archived.id
        admin_id: int = self.get_user(ADMIN_USERNAME).id
        dashboard: Dashboard = self.insert_dashboard(
            "empty version restore", "empty-version-restore", [admin_id]
        )
        dashboard_id: int = dashboard.id

        # Snapshot point: no charts.
        dashboard.dashboard_title = "empty version restore — snapshot"
        db.session.commit()
        ver_cls: Any = version_class(Dashboard)
        entity_uuid: UUID | None = dashboard.uuid
        assert entity_uuid is not None
        target_tx: int = (
            db.session.query(ver_cls.transaction_id)
            .filter(ver_cls.id == dashboard_id, ver_cls.uuid == entity_uuid)
            .order_by(ver_cls.transaction_id.desc())
            .limit(1)
            .scalar()
        )
        target_uuid: str = str(derive_version_uuid(entity_uuid, target_tx))

        dashboard.slices.append(archived)
        db.session.commit()
        self.login(ADMIN_USERNAME)
        assert self.client.delete(f"/api/v1/chart/{archived_id}").status_code == 200
        try:
            rv: Any = self._restore(str(entity_uuid), target_uuid)
            assert rv.status_code == 200, rv.data

            db.session.expire_all()
            members: list[Any] = db.session.execute(
                sa.text(
                    "SELECT slice_id FROM dashboard_slices "
                    "WHERE dashboard_id = :dashboard_id"
                ),
                {"dashboard_id": dashboard_id},
            ).fetchall()
            assert members == []
        finally:
            db.session.rollback()
            self.client.post(f"/api/v1/chart/{archived.uuid}/restore")
            db.session.expire_all()
            db.session.delete(db.session.get(Dashboard, dashboard_id))
            db.session.commit()

    def test_restore_membership_refuses_unflushed_slices_change(self) -> None:
        """Installing the membership baseline would silently drop a pending
        change to ``dashboard.slices``, so the restore refuses instead."""
        from superset.versioning.restore import _restore_dashboard_membership

        _persist_fixture_state()
        dashboard: Dashboard = (
            db.session.query(Dashboard)
            .filter(Dashboard.dashboard_title == "USA Births Names")
            .first()
        )
        assert dashboard is not None
        try:
            with db.session.no_autoflush:
                dashboard.slices.remove(dashboard.slices[0])
                with pytest.raises(RuntimeError, match="unflushed changes"):
                    _restore_dashboard_membership(dashboard, 0)
        finally:
            db.session.rollback()

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


def _chart_layout(chart_ids: list[int]) -> dict[str, Any]:
    """Return a one-row dashboard layout holding *chart_ids* in order."""
    keys: list[str] = [f"CHART-{chart_id}" for chart_id in chart_ids]
    positions: dict[str, Any] = {
        "DASHBOARD_VERSION_KEY": "v2",
        "ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["GRID_ID"]},
        "GRID_ID": {
            "id": "GRID_ID",
            "type": "GRID",
            "children": ["ROW-1"],
            "parents": ["ROOT_ID"],
        },
        "ROW-1": {
            "id": "ROW-1",
            "type": "ROW",
            "children": keys,
            "parents": ["ROOT_ID", "GRID_ID"],
        },
    }
    chart_id: int
    key: str
    for chart_id, key in zip(chart_ids, keys, strict=True):
        positions[key] = {
            "id": key,
            "type": "CHART",
            "children": [],
            "parents": ["ROOT_ID", "GRID_ID", "ROW-1"],
            "meta": {"chartId": chart_id, "width": 4, "height": 50},
        }
    return positions


class TestDashboardRestoreLayoutMembership(SupersetTestCase, InsertChartMixin):
    """Restoring a version saved from a layout links exactly that layout's charts.

    Each version is saved through ``PUT`` with a layout, as the dashboard
    editor saves it, so the restore has to remove charts the dashboard gained
    since the version and reattach charts it lost.
    """

    @parameterized.expand(
        [
            # A chart gained since the version, one lost, both, and the baseline.
            ([["a"], ["a", "b"]], 1),
            ([["a", "b"], ["a"]], 1),
            ([["a", "b"], ["a", "c"]], 1),
            ([["a", "b"]], 0),
        ]
    )
    def test_restore_layout_version(
        self, layouts: list[list[str]], version_number: int
    ) -> None:
        from superset.connectors.sqla.models import SqlaTable
        from superset.models.core import Database
        from superset.models.slice import Slice

        admin: User = self.get_user(ADMIN_USERNAME)
        # Integer ids can be reused across cases, so only read history written
        # by this case.
        first_transaction: int = db.session.execute(
            sa.text("SELECT COALESCE(MAX(id), 0) FROM version_transaction")
        ).scalar_one()
        dataset: SqlaTable = SqlaTable(
            table_name="restore_layout_membership",
            database=Database(
                database_name="restore_layout_membership", sqlalchemy_uri="sqlite://"
            ),
        )
        db.session.add(dataset)
        db.session.commit()
        charts: dict[str, Slice] = {}
        dashboard_id: int | None = None
        try:
            names: list[str] = sorted({name for layout in layouts for name in layout})
            name: str
            for name in names:
                charts[name] = self.insert_chart(
                    f"restore-layout-{name}", [admin.id], dataset.id
                )
            self.login(ADMIN_USERNAME)
            dashboard_id = self.client.post(
                "/api/v1/dashboard/", json={"dashboard_title": "restore-layout"}
            ).json["id"]
            dashboard: Dashboard = db.session.get(Dashboard, dashboard_id)
            dashboard_uuid: str = str(dashboard.uuid)
            layout: list[str]
            for layout in layouts:
                rv: TestResponse = self.client.put(
                    f"/api/v1/dashboard/{dashboard_id}",
                    json={
                        "json_metadata": _json.dumps(
                            {"positions": _chart_layout([charts[n].id for n in layout])}
                        )
                    },
                )
                assert rv.status_code == 200, rv.data
            versions: list[dict[str, Any]] = self.client.get(
                f"/api/v1/dashboard/{dashboard_uuid}/versions/"
            ).json["result"]
            version_uuid: str | None = next(
                (
                    version["version_uuid"]
                    for version in versions
                    if version["version_number"] == version_number
                ),
                None,
            )
            assert version_uuid is not None, versions

            rv = self.client.post(
                f"/api/v1/dashboard/{dashboard_uuid}/versions/{version_uuid}/restore"
            )
            assert rv.status_code == 200, rv.data

            db.session.expire_all()
            expected: set[int] = (
                {charts[name].id for name in layouts[version_number - 1]}
                if version_number
                else set()
            )
            members: set[int] = {
                row[0]
                for row in db.session.execute(
                    sa.text(
                        "SELECT slice_id FROM dashboard_slices "
                        "WHERE dashboard_id = :dashboard_id"
                    ),
                    {"dashboard_id": dashboard_id},
                )
            }
            assert members == expected
            restored: Dashboard = db.session.get(Dashboard, dashboard_id)
            assert {
                node["meta"]["chartId"]
                for node in restored.position.values()
                if isinstance(node, dict) and node.get("type") == "CHART"
            } == expected
            # The newest association history row of each chart agrees with
            # the live membership: an insert for members, a delete otherwise.
            latest: dict[int, int] = {}
            slice_id: int
            operation_type: int
            for slice_id, operation_type in db.session.execute(
                sa.text(
                    "SELECT slice_id, operation_type FROM dashboard_slices_version "
                    "WHERE dashboard_id = :dashboard_id "
                    "AND transaction_id > :first_transaction "
                    "ORDER BY transaction_id, operation_type"
                ),
                {"dashboard_id": dashboard_id, "first_transaction": first_transaction},
            ):
                latest[slice_id] = operation_type
            assert {
                slice_id
                for slice_id, operation_type in latest.items()
                if operation_type != M2M_OP_DELETE
            } == expected
        finally:
            db.session.rollback()
            if dashboard_id is not None:
                db.session.delete(db.session.get(Dashboard, dashboard_id))
            chart: Slice
            for chart in charts.values():
                db.session.delete(db.session.get(Slice, chart.id))
            table: SqlaTable = db.session.get(SqlaTable, dataset.id)
            database: Database = table.database
            db.session.delete(table)
            db.session.delete(database)
            db.session.commit()


class TestDashboardRestoreConcurrentPurge(SupersetTestCase, InsertChartMixin):
    """A restore racing a purge of a chart it reattaches fails cleanly.

    The purge commits on its own connection after the restore has read the
    charts it will reattach and before it writes them, the window a real
    concurrent purge can land in.
    """

    @parameterized.expand(
        [
            ("reattach_purged", False, True),
            ("unlink_purged", True, True),
            ("unrelated_foreign_key_failure", False, False),
        ]
    )
    def test_restore_conflicts_with_concurrent_chart_purge(
        self, case: str, unlink: bool, purge: bool
    ) -> None:
        """Purging a chart the restore links or unlinks makes the restore a
        retryable 409. A foreign key failure while no such chart is missing
        stays the ordinary 422, because retrying would not help."""
        import sqlite3

        from sqlalchemy.exc import IntegrityError
        from sqlalchemy.orm import Session

        from superset.commands.deletion_retention.purge_cascade import (
            cascade_hard_delete,
            suppress_purge_association_versions,
        )
        from superset.connectors.sqla.models import SqlaTable
        from superset.models.core import Database
        from superset.models.helpers import skip_visibility_filter
        from superset.models.slice import Slice
        from superset.versioning import restore as restore_module

        admin: User = self.get_user(ADMIN_USERNAME)
        dataset: SqlaTable = SqlaTable(
            table_name="restore_concurrent_purge",
            database=Database(
                database_name="restore_concurrent_purge", sqlalchemy_uri="sqlite://"
            ),
        )
        db.session.add(dataset)
        db.session.commit()
        kept: Slice = self.insert_chart("restore-purge-kept", [admin.id], dataset.id)
        purged: Slice = self.insert_chart(
            "restore-purge-purged", [admin.id], dataset.id
        )
        kept_id: int = kept.id
        purged_id: int = purged.id
        dashboard_id: int | None = None
        try:
            self.login(ADMIN_USERNAME)
            dashboard_id = self.client.post(
                "/api/v1/dashboard/", json={"dashboard_title": "restore-purge"}
            ).json["id"]
            dashboard: Dashboard = db.session.get(Dashboard, dashboard_id)
            dashboard_uuid: str = str(dashboard.uuid)
            # The restore to version 1 reattaches the purged chart, or with
            # ``unlink`` removes it from the live dashboard.
            layouts: list[list[int]] = [[kept_id, purged_id], [kept_id]]
            if unlink:
                layouts.reverse()
            chart_ids: list[int]
            for chart_ids in layouts:
                rv: TestResponse = self.client.put(
                    f"/api/v1/dashboard/{dashboard_id}",
                    json={
                        "json_metadata": _json.dumps(
                            {"positions": _chart_layout(chart_ids)}
                        )
                    },
                )
                assert rv.status_code == 200, rv.data
            versions: list[dict[str, Any]] = self.client.get(
                f"/api/v1/dashboard/{dashboard_uuid}/versions/"
            ).json["result"]
            version_uuid: str = next(
                version["version_uuid"]
                for version in versions
                if version["version_number"] == 1
            )
            # Only an archived chart can be purged.
            rv = self.client.delete(f"/api/v1/chart/{purged_id}")
            assert rv.status_code == 200, rv.data
            db.session.expire_all()
            position_before: str = db.session.get(Dashboard, dashboard_id).position_json
            version_rows_before: int = len(
                _get_version_rows(db.session.get(Dashboard, dashboard_id))
            )

            stamp_audit_fields: Any = restore_module._stamp_audit_fields_for_restore

            def purge_then_stamp(entity: Any) -> None:
                if not purge:
                    raise IntegrityError(
                        "INSERT INTO dashboard_slices",
                        None,
                        sqlite3.IntegrityError("FOREIGN KEY constraint failed"),
                    )
                other: Session
                with Session(bind=db.engine) as other:
                    with skip_visibility_filter(other, Slice):
                        chart: Slice = other.get(Slice, purged_id)
                    with suppress_purge_association_versions(other):
                        assert cascade_hard_delete(
                            other, chart, enforce_window=False, require_archived=True
                        ).purged
                    other.commit()
                stamp_audit_fields(entity)

            restore_url: str = (
                f"/api/v1/dashboard/{dashboard_uuid}/versions/{version_uuid}/restore"
            )
            with patch.object(
                restore_module,
                "_stamp_audit_fields_for_restore",
                side_effect=purge_then_stamp,
            ):
                rv = self.client.post(restore_url)
            if purge:
                assert rv.status_code == 409, rv.data
                assert "try again" in rv.json["message"], rv.json
            else:
                assert rv.status_code == 422, rv.data

            # Nothing was restored.
            db.session.expire_all()
            dashboard = db.session.get(Dashboard, dashboard_id)
            assert dashboard.position_json == position_before
            assert {s.id for s in dashboard.slices} == {kept_id}
            assert len(_get_version_rows(dashboard)) == version_rows_before

            # Retrying restores the version: its layout comes back, without
            # the purged chart as a member. The purge also removed the
            # chart's history, so the version no longer lists it at all.
            if purge:
                rv = self.client.post(restore_url)
                assert rv.status_code == 200, rv.data
                db.session.expire_all()
                dashboard = db.session.get(Dashboard, dashboard_id)
                assert dashboard.position_json != position_before
                assert {
                    node["meta"]["chartId"]
                    for node in dashboard.position.values()
                    if isinstance(node, dict) and node.get("type") == "CHART"
                } == set(layouts[0])
                assert {s.id for s in dashboard.slices} == {kept_id}
        finally:
            db.session.rollback()
            if dashboard_id is not None:
                db.session.delete(db.session.get(Dashboard, dashboard_id))
            chart_id: int
            leftover: Slice | None
            with skip_visibility_filter(db.session, Slice):
                for chart_id in (kept_id, purged_id):
                    if (leftover := db.session.get(Slice, chart_id)) is not None:
                        db.session.delete(leftover)
            table: SqlaTable = db.session.get(SqlaTable, dataset.id)
            database: Database = table.database
            db.session.delete(table)
            db.session.delete(database)
            db.session.commit()
