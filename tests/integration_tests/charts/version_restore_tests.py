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
"""Integration tests for chart (Slice) version restore.

Covers POST /api/v1/chart/<uuid>/versions/<version_uuid>/restore: the
non-destructive revert applies the target snapshot, appends a new
version row, attributes the change to the restoring user, and returns
the documented 400/404 errors for malformed or unknown UUIDs.
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
        .filter(ver_cls.id == chart.id, ver_cls.uuid == chart.uuid)
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
        assert entity_uuid is not None
        original_name = chart.slice_name
        original_created_by = chart.created_by_fk
        before_changed_on = chart.changed_on

        # Produce a second version to restore to.
        chart.slice_name = "Girls v1"
        db.session.commit()

        ver_cls = version_class(Slice)
        first_tx = (
            db.session.query(ver_cls.transaction_id)
            .filter(ver_cls.id == chart_id, ver_cls.uuid == entity_uuid)
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
        # Pin to (id, uuid), as the API's version lookup does. A shared test
        # database recycles integer ids across the suite, so an id-only count
        # picks up shadow rows belonging to hard-deleted predecessors and
        # over-states this chart's history.
        count_before = (
            db.session.query(ver_cls)
            .filter(ver_cls.id == chart_id, ver_cls.uuid == chart.uuid)
            .count()
        )
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

    def test_restore_denies_non_editor_with_write_permission(self) -> None:
        """A user holding can_write on Chart but who is not an editor of
        THIS chart gets 403 from the command's ``raise_for_editorship``
        branch — the interesting case route-level ``@protect()`` cannot
        catch."""
        from superset.daos.version import derive_version_uuid
        from tests.integration_tests.constants import ALPHA_USERNAME

        _persist_fixture_state()
        chart: Slice = (
            db.session.query(Slice).filter(Slice.slice_name == "Girls").first()
        )
        assert chart is not None
        # Ensure alpha is not an editor of the fixture chart.
        alpha = self.get_user(ALPHA_USERNAME)
        assert alpha not in chart.editors

        ver_cls = version_class(Slice)
        entity_uuid = chart.uuid
        assert entity_uuid is not None
        first_tx = (
            db.session.query(ver_cls.transaction_id)
            .filter(ver_cls.id == chart.id, ver_cls.uuid == chart.uuid)
            .order_by(ver_cls.transaction_id.asc())
            .limit(1)
            .scalar()
        )
        assert first_tx is not None
        target_uuid = str(derive_version_uuid(entity_uuid, first_tx))

        self.login(ALPHA_USERNAME)
        rv = self._restore(str(chart.uuid), target_uuid)
        assert rv.status_code == 403, rv.data
        db.session.refresh(chart)
        assert chart.slice_name == "Girls"

    def test_restore_returns_404_when_capture_disabled(self) -> None:
        """With ENABLE_VERSIONING_CAPTURE off, the restore route is inert:
        Continuum's write listeners are detached, so a revert would mutate
        the live entity with no new version row — a destructive, untracked
        write. The command refuses with 404 before touching anything."""
        _persist_fixture_state()
        chart: Slice = (
            db.session.query(Slice).filter(Slice.slice_name == "Girls").first()
        )
        assert chart is not None
        original_name = chart.slice_name

        self.login(ADMIN_USERNAME)
        listing = _json.loads(self._list(str(chart.uuid)).data.decode("utf-8"))
        target_uuid = listing["result"][0]["version_uuid"]

        self.app.config["ENABLE_VERSIONING_CAPTURE"] = False
        try:
            rv = self._restore(str(chart.uuid), target_uuid)
        finally:
            self.app.config["ENABLE_VERSIONING_CAPTURE"] = True
        assert rv.status_code == 404, rv.data

        db.session.expire_all()
        live = db.session.query(Slice).filter(Slice.id == chart.id).one()
        assert live.slice_name == original_name

    def test_restore_returns_404_for_other_entitys_version_uuid(self) -> None:
        """A version_uuid belonging to a DIFFERENT chart must not resolve:
        version identity is (entity_uuid, transaction), so entity A's
        version_uuid presented under entity B's path is a 404."""
        from superset.daos.version import derive_version_uuid

        _persist_fixture_state()
        girls: Slice = (
            db.session.query(Slice).filter(Slice.slice_name == "Girls").first()
        )
        boys: Slice = db.session.query(Slice).filter(Slice.slice_name == "Boys").first()
        assert girls is not None
        assert boys is not None

        ver_cls = version_class(Slice)
        boys_uuid = boys.uuid
        assert boys_uuid is not None
        boys_tx = (
            db.session.query(ver_cls.transaction_id)
            .filter(ver_cls.id == boys.id, ver_cls.uuid == boys_uuid)
            .order_by(ver_cls.transaction_id.asc())
            .limit(1)
            .scalar()
        )
        assert boys_tx is not None
        boys_version_uuid = str(derive_version_uuid(boys_uuid, boys_tx))

        self.login(ADMIN_USERNAME)
        rv = self._restore(str(girls.uuid), boys_version_uuid)
        assert rv.status_code == 404, rv.data

    def test_restore_stamps_action_kind_restore_on_transaction(self) -> None:
        """The restoring commit's version_transaction row must carry
        ``action_kind='restore'`` so the activity feed renders it as a
        restore, not an ordinary save (contract in versioning/changes)."""
        from sqlalchemy_continuum import versioning_manager

        from superset.daos.version import derive_version_uuid

        _persist_fixture_state()
        chart: Slice = (
            db.session.query(Slice).filter(Slice.slice_name == "Girls").first()
        )
        assert chart is not None
        chart_id = chart.id
        original_name = chart.slice_name

        chart.slice_name = "Girls action-kind v1"
        db.session.commit()

        ver_cls = version_class(Slice)
        entity_uuid = chart.uuid
        assert entity_uuid is not None
        first_tx = (
            db.session.query(ver_cls.transaction_id)
            .filter(ver_cls.id == chart_id, ver_cls.uuid == entity_uuid)
            .order_by(ver_cls.transaction_id.asc())
            .limit(1)
            .scalar()
        )
        target_uuid = str(derive_version_uuid(entity_uuid, first_tx))

        self.login(ADMIN_USERNAME)
        rv = self._restore(str(chart.uuid), target_uuid)
        assert rv.status_code == 200, rv.data

        latest_tx = (
            db.session.query(ver_cls.transaction_id)
            .filter(ver_cls.id == chart_id, ver_cls.uuid == entity_uuid)
            .order_by(ver_cls.transaction_id.desc())
            .limit(1)
            .scalar()
        )
        tx_tbl = versioning_manager.transaction_cls.__table__
        action_kind = (
            db.session.execute(tx_tbl.select().where(tx_tbl.c.id == latest_tx))
            .mappings()
            .one()["action_kind"]
        )
        assert action_kind == "restore"

        # Cleanup
        db.session.expire_all()
        chart = db.session.query(Slice).filter(Slice.id == chart_id).one()
        chart.slice_name = original_name
        db.session.commit()
