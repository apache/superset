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
"""Integration tests for Dataset (SqlaTable) version history capture.

T016 — dataset column and metric version rows are created via ORM (not bulk) ops
T028 — dataset version list endpoint
"""

from __future__ import annotations

from typing import Any

import pytest
import sqlalchemy as sa
from sqlalchemy_continuum import version_class

from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.extensions import db
from superset.utils import json as _json
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import (
    ADMIN_USERNAME,
    ALPHA_USERNAME,
    GAMMA_USERNAME,
)
from tests.integration_tests.fixtures.birth_names_dashboard import (  # noqa: F401
    load_birth_names_dashboard_with_slices,
    load_birth_names_data,
)


def _get_table_column_version_rows(column: TableColumn) -> list[Any]:
    ver_cls = version_class(TableColumn)
    return (
        db.session.query(ver_cls)
        .filter(ver_cls.id == column.id)
        .order_by(ver_cls.transaction_id.asc())
        .all()
    )


def _get_sql_metric_version_rows(metric: SqlMetric) -> list[Any]:
    ver_cls = version_class(SqlMetric)
    return (
        db.session.query(ver_cls)
        .filter(ver_cls.id == metric.id)
        .order_by(ver_cls.transaction_id.asc())
        .all()
    )


def _get_table_version_rows(table: SqlaTable) -> list[Any]:
    ver_cls = version_class(SqlaTable)
    return (
        db.session.query(ver_cls)
        .filter(ver_cls.id == table.id)
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


class TestDatasetVersionListApi(SupersetTestCase):
    """T028 — GET /api/v1/dataset/<uuid>/versions/ endpoint."""

    @pytest.fixture(autouse=True)
    def _load_data(self, load_birth_names_dashboard_with_slices):  # noqa: PT004, F811
        pass

    def _list_versions(self, dataset_uuid: str) -> Any:
        return self.client.get(f"/api/v1/dataset/{dataset_uuid}/versions/")

    def test_list_versions_returns_ordered_sequence(self) -> None:
        """Editing a dataset produces ascending version_number entries."""
        _persist_fixture_state()
        table: SqlaTable = (
            db.session.query(SqlaTable)
            .filter(SqlaTable.table_name == "birth_names")
            .first()
        )
        assert table is not None
        original_description = table.description
        table_uuid = str(table.uuid)
        table_id = table.id

        try:
            for i in range(3):
                table.description = f"Test description v{i}"
                db.session.commit()

            self.login(ADMIN_USERNAME)
            rv = self._list_versions(table_uuid)
            assert rv.status_code == 200
            body = _json.loads(rv.data.decode("utf-8"))
            assert body["count"] == len(body["result"])
            for idx, entry in enumerate(body["result"]):
                assert entry["version_number"] == idx
                assert entry["issued_at"] is not None
            # issued_at is ISO-8601 (dumped through VersionListItemSchema —
            # previously the raw dict hit Flask's jsonify and rendered as an
            # RFC-1123 http-date). Parse before checking monotonic order
            # rather than comparing strings. (Note: fromisoformat on the
            # supported Python floor, 3.10, rejects a trailing 'Z'; the
            # schema emits naive/offset forms, not 'Z'.)
            from datetime import datetime

            parsed = [datetime.fromisoformat(e["issued_at"]) for e in body["result"]]
            assert parsed == sorted(parsed)
        finally:
            # Restore fixture state even if an assertion above failed (otherwise
            # the polluted description cascades to later tests in the suite).
            db.session.rollback()
            table = db.session.query(SqlaTable).filter(SqlaTable.id == table_id).one()
            table.description = original_description
            db.session.commit()

    def test_list_versions_empty_for_untouched_entity(self) -> None:
        """A dataset with no version rows returns [] (not 404)."""
        _persist_fixture_state()
        table = SqlaTable(
            table_name="__untouched_table_for_version_list__",
            database_id=1,
        )
        db.session.add(table)
        db.session.commit()
        table_uuid = str(table.uuid)
        table_id = table.id

        try:
            ver_cls = version_class(SqlaTable)
            db.session.query(ver_cls).filter(ver_cls.id == table_id).delete(
                synchronize_session=False
            )
            db.session.commit()

            self.login(ADMIN_USERNAME)
            rv = self._list_versions(table_uuid)
            assert rv.status_code == 200
            body = _json.loads(rv.data.decode("utf-8"))
            assert body["count"] == 0
            assert body["result"] == []
        finally:
            db.session.rollback()
            stale = (
                db.session.query(SqlaTable)
                .filter(SqlaTable.id == table_id)
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

    def test_list_versions_denies_without_write_permission(self) -> None:
        """Gamma is read-only on Dataset — 403 on list_versions."""
        _persist_fixture_state()
        table: SqlaTable = (
            db.session.query(SqlaTable)
            .filter(SqlaTable.table_name == "birth_names")
            .first()
        )
        assert table is not None
        table_uuid = str(table.uuid)

        self.login(GAMMA_USERNAME)
        rv = self._list_versions(table_uuid)
        assert rv.status_code == 403

    def test_list_versions_allows_can_write_non_owner(self) -> None:
        """T056 — viewing version history requires ``can_write`` (FR-013),
        not ownership. Alpha has ``can_write`` on Dataset and
        ``all_datasource_access``, so ``raise_for_access`` admits it even
        though Alpha doesn't own the admin-owned fixture. Model-level
        denial for a no-access principal is covered by the Gamma test
        above (``@protect()``)."""
        _persist_fixture_state()
        table: SqlaTable = (
            db.session.query(SqlaTable)
            .filter(SqlaTable.table_name == "birth_names")
            .first()
        )
        assert table is not None
        table_uuid = str(table.uuid)

        self.login(ALPHA_USERNAME)
        rv = self._list_versions(table_uuid)
        assert rv.status_code == 200

    def test_list_versions_admin_sees_all_entities(self) -> None:
        """FR-013: workspace admin can list versions for any entity."""
        _persist_fixture_state()
        table: SqlaTable = (
            db.session.query(SqlaTable)
            .filter(SqlaTable.table_name == "birth_names")
            .first()
        )
        assert table is not None
        table_uuid = str(table.uuid)

        self.login(ADMIN_USERNAME)
        rv = self._list_versions(table_uuid)
        assert rv.status_code == 200


class TestDatasetRestoreApi(SupersetTestCase):
    """T039 — POST /api/v1/dataset/<uuid>/versions/<version_uuid>/restore."""

    @pytest.fixture(autouse=True)
    def _load_data(self, load_birth_names_dashboard_with_slices):  # noqa: PT004, F811
        pass

    def setUp(self) -> None:
        # Reset session state before each test in this class so the restore
        # path is exercised against a clean identity map rather than whatever
        # half-flushed state a previous test in the full-suite run may have
        # left behind. Specifically: a Postgres-only multi-test cascade (see
        # the sc-103156 follow-up note) can leave Continuum's shadow-table
        # session attributes in a state where the restore command's
        # ``@transaction`` boundary unexpectedly raises and surfaces as 422
        # "Dataset could not be updated." Rolling back + expiring all clears
        # the cascade for this class' tests without modifying the upstream
        # tests that cause it.
        super().setUp()
        db.session.rollback()
        db.session.expire_all()

    def tearDown(self) -> None:
        db.session.rollback()
        db.session.expire_all()
        super().tearDown()

    def _restore(self, dataset_uuid: str, version_uuid: str) -> Any:
        return self.client.post(
            f"/api/v1/dataset/{dataset_uuid}/versions/{version_uuid}/restore"
        )

    def test_restore_applies_scalar_field(self) -> None:
        """Restore a dataset's description edit."""
        from superset.daos.version import derive_version_uuid

        _persist_fixture_state()
        table: SqlaTable = (
            db.session.query(SqlaTable)
            .filter(SqlaTable.table_name == "birth_names")
            .first()
        )
        assert table is not None
        table_uuid = str(table.uuid)
        entity_uuid = table.uuid
        table_id = table.id
        original_description = table.description

        try:
            # Two more edits to produce a non-trivial history.
            table.description = "restore-test v1"
            db.session.commit()
            table.description = "restore-test v2"
            db.session.commit()

            ver_cls = version_class(SqlaTable)
            rows = (
                db.session.query(
                    ver_cls.transaction_id,
                    ver_cls.operation_type,
                    ver_cls.description,
                )
                .filter(ver_cls.id == table_id)
                .order_by(ver_cls.transaction_id.asc())
                .all()
            )
            # Skip DELETE rows (operation_type=2) — the integration DB may carry
            # shadow rows from prior fixture teardown cycles, and restoring to a
            # DELETE state would re-delete the live entity (same fix as the
            # dashboard restore test).
            target_row = next(
                (
                    row
                    for row in rows
                    if row.description == original_description
                    and row.operation_type != 2
                ),
                None,
            )
            assert target_row is not None, (
                f"No version with original description; rows={rows}"
            )
            target_uuid = str(
                derive_version_uuid(entity_uuid, target_row.transaction_id)
            )

            self.login(ADMIN_USERNAME)
            rv = self._restore(table_uuid, target_uuid)
            assert rv.status_code == 200, rv.data

            db.session.expire_all()
            table = db.session.query(SqlaTable).filter(SqlaTable.id == table_id).one()
            assert table.description == original_description
        finally:
            # Cleanup — guard fixture state against assertion failures cascading
            # to later tests in the suite (saw this manifest on Postgres CI's
            # full-suite ordering: a failure here left ``description="restore-test
            # v2"`` on birth_names and polluted downstream tests).
            db.session.rollback()
            table = db.session.query(SqlaTable).filter(SqlaTable.id == table_id).one()
            table.description = original_description
            db.session.commit()

    def test_restore_with_column_edits_reverts_columns(self) -> None:
        """After editing a column's description, restoring an earlier version
        reverts the column."""
        from superset.daos.version import derive_version_uuid

        _persist_fixture_state()
        table: SqlaTable = (
            db.session.query(SqlaTable)
            .filter(SqlaTable.table_name == "birth_names")
            .first()
        )
        assert table is not None
        table_uuid = str(table.uuid)
        entity_uuid = table.uuid
        table_id = table.id

        col = table.columns[0]
        col_name = col.column_name
        original_col_description = col.description

        try:
            # Snapshot target version before our column edit.
            ver_cls = version_class(SqlaTable)
            last_tx = (
                db.session.query(ver_cls.transaction_id)
                .filter(ver_cls.id == table_id)
                .order_by(ver_cls.transaction_id.desc())
                .limit(1)
                .scalar()
            )
            assert last_tx is not None
            target_uuid = str(derive_version_uuid(entity_uuid, last_tx))

            col.description = "restore-test column edit"
            db.session.commit()

            self.login(ADMIN_USERNAME)
            rv = self._restore(table_uuid, target_uuid)
            assert rv.status_code == 200, rv.data

            # JSON-snapshot restore reassigns child PKs, so look up by natural
            # key (column_name) rather than the old id.
            db.session.expire_all()
            col = (
                db.session.query(TableColumn)
                .filter(TableColumn.table_id == table_id)
                .filter(TableColumn.column_name == col_name)
                .one()
            )
            assert col.description == original_col_description
        finally:
            db.session.rollback()
            col = (
                db.session.query(TableColumn)
                .filter(TableColumn.table_id == table_id)
                .filter(TableColumn.column_name == col_name)
                .one_or_none()
            )
            if col is not None:
                col.description = original_col_description
                db.session.commit()

    def test_restore_adds_back_removed_column_and_drops_added_one(self) -> None:
        """After a snapshot is taken, removing an existing column and adding
        a new one, restoring the snapshot must undo both operations."""
        from superset.daos.version import derive_version_uuid

        _persist_fixture_state()
        table: SqlaTable = (
            db.session.query(SqlaTable)
            .filter(SqlaTable.table_name == "birth_names")
            .first()
        )
        assert table is not None
        table_id = table.id
        table_uuid = str(table.uuid)
        entity_uuid = table.uuid

        original_col_names = sorted(c.column_name for c in table.columns)
        removed_name = table.columns[0].column_name

        # Capture a snapshot tx point by touching the dataset.
        table.description = "snapshot before column-swap"
        db.session.commit()

        ver_cls = version_class(SqlaTable)
        target_tx = (
            db.session.query(ver_cls.transaction_id)
            .filter(ver_cls.id == table_id)
            .order_by(ver_cls.transaction_id.desc())
            .limit(1)
            .scalar()
        )
        assert target_tx is not None
        target_uuid = str(derive_version_uuid(entity_uuid, target_tx))

        # Remove a column, add a new one, commit (moves history forward).
        db.session.delete(table.columns[0])
        db.session.add(
            TableColumn(
                table_id=table_id,
                column_name="__restore_test_calc__",
                expression="1",
            )
        )
        db.session.commit()

        assert removed_name not in {c.column_name for c in table.columns}
        assert "__restore_test_calc__" in {c.column_name for c in table.columns}

        self.login(ADMIN_USERNAME)
        rv = self._restore(table_uuid, target_uuid)
        assert rv.status_code == 200, rv.data

        db.session.expire_all()
        table = db.session.query(SqlaTable).filter(SqlaTable.id == table_id).one()
        restored_names = sorted(c.column_name for c in table.columns)
        assert restored_names == original_col_names

    def test_restore_emits_full_child_diff_in_one_transaction(self) -> None:
        """A restore that re-adds one column and drops another MUST write
        *both* change records under the same transaction. Under the prior
        per-relation flush loop the first flush emitted only the
        easier-to-detect change (the modification of a surviving
        column), the listener's tx-dedup guard then suppressed the
        second pass, and the addition record was silently lost from
        ``version_changes`` — the dropdown rendered the restore as an
        empty "Baseline" entry. Locks in the single-flush restore
        behavior in ``VersionDAO.restore_version``.
        """
        from superset.daos.version import derive_version_uuid
        from superset.versioning.changes import version_changes_table

        _persist_fixture_state()
        table: SqlaTable = (
            db.session.query(SqlaTable)
            .filter(SqlaTable.table_name == "birth_names")
            .first()
        )
        assert table is not None
        table_id = table.id
        table_uuid = str(table.uuid)
        entity_uuid = table.uuid
        removed_name = table.columns[0].column_name
        added_name = "__restore_full_diff_test__"

        # Snapshot point captures the baseline.
        table.description = "snapshot before full-diff column swap"
        db.session.commit()

        ver_cls = version_class(SqlaTable)
        target_tx = (
            db.session.query(ver_cls.transaction_id)
            .filter(ver_cls.id == table_id)
            .order_by(ver_cls.transaction_id.desc())
            .limit(1)
            .scalar()
        )
        assert target_tx is not None
        target_uuid = str(derive_version_uuid(entity_uuid, target_tx))

        db.session.delete(table.columns[0])
        db.session.add(
            TableColumn(table_id=table_id, column_name=added_name, expression="1")
        )
        db.session.commit()

        self.login(ADMIN_USERNAME)
        rv = self._restore(table_uuid, target_uuid)
        assert rv.status_code == 200, rv.data
        db.session.expire_all()

        restore_tx = (
            db.session.query(ver_cls.transaction_id)
            .filter(ver_cls.id == table_id)
            .order_by(ver_cls.transaction_id.desc())
            .limit(1)
            .scalar()
        )
        rows = (
            db.session.connection()
            .execute(
                sa.select(
                    version_changes_table.c.kind,
                    version_changes_table.c.path,
                ).where(
                    version_changes_table.c.transaction_id == restore_tx,
                    version_changes_table.c.entity_kind == "dataset",
                    version_changes_table.c.entity_id == table_id,
                )
            )
            .all()
        )
        paths = {tuple(row.path) for row in rows}
        assert ("columns", added_name) in paths, (
            f"restore tx {restore_tx} did not emit removal record for "
            f"the added-then-restored-away column {added_name!r}; "
            f"observed paths={paths}"
        )
        assert ("columns", removed_name) in paths, (
            f"restore tx {restore_tx} did not emit addition record for "
            f"the deleted-then-restored column {removed_name!r}; "
            f"observed paths={paths}"
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
        table: SqlaTable = (
            db.session.query(SqlaTable)
            .filter(SqlaTable.table_name == "birth_names")
            .first()
        )
        assert table is not None
        self.login(ADMIN_USERNAME)
        rv = self._restore(str(table.uuid), "00000000-0000-0000-0000-000000000099")
        assert rv.status_code == 404

    def test_restore_returns_400_for_invalid_entity_uuid(self) -> None:
        self.login(ADMIN_USERNAME)
        rv = self._restore("not-a-uuid", "00000000-0000-0000-0000-000000000001")
        assert rv.status_code == 400

    def test_restore_returns_400_for_invalid_version_uuid(self) -> None:
        _persist_fixture_state()
        table: SqlaTable = (
            db.session.query(SqlaTable)
            .filter(SqlaTable.table_name == "birth_names")
            .first()
        )
        assert table is not None
        self.login(ADMIN_USERNAME)
        rv = self._restore(str(table.uuid), "not-a-uuid")
        assert rv.status_code == 400

    def test_get_version_returns_historical_snapshot_with_children(self) -> None:
        """GET /versions/<uuid>/ on a dataset returns scalar fields and
        reconstructed columns/metrics, without modifying live state."""
        from superset.daos.version import derive_version_uuid

        _persist_fixture_state()
        table: SqlaTable = (
            db.session.query(SqlaTable)
            .filter(SqlaTable.table_name == "birth_names")
            .first()
        )
        assert table is not None
        table_id = table.id
        table_uuid = str(table.uuid)
        entity_uuid = table.uuid
        original_description = table.description
        original_col_names = sorted(c.column_name for c in table.columns)

        try:
            # Capture a snapshot point now; make a change after.
            ver_cls = version_class(SqlaTable)
            target_tx = (
                db.session.query(ver_cls.transaction_id)
                .filter(ver_cls.id == table_id)
                .order_by(ver_cls.transaction_id.desc())
                .limit(1)
                .scalar()
            )
            assert target_tx is not None
            target_uuid = str(derive_version_uuid(entity_uuid, target_tx))

            table.description = "edited after snapshot"
            db.session.commit()

            self.login(ADMIN_USERNAME)
            rv = self.client.get(
                f"/api/v1/dataset/{table_uuid}/versions/{target_uuid}/"
            )
            assert rv.status_code == 200, rv.data
            body = _json.loads(rv.data.decode("utf-8"))["result"]

            # Scalar fields reflect the snapshot, not the live edit.
            assert body["description"] == original_description
            assert body["_version"]["version_uuid"] == target_uuid

            # Columns list matches original set.
            snapshot_col_names = sorted(c["column_name"] for c in body["columns"])
            assert snapshot_col_names == original_col_names

            # Metrics reconstructed.
            assert isinstance(body["metrics"], list)
            assert all("metric_name" in m for m in body["metrics"])

            # Live row remains in its edited state.
            db.session.expire_all()
            live = db.session.query(SqlaTable).filter(SqlaTable.id == table_id).one()
            assert live.description == "edited after snapshot"
        finally:
            db.session.rollback()
            live = db.session.query(SqlaTable).filter(SqlaTable.id == table_id).one()
            live.description = original_description
            db.session.commit()

    def test_put_response_returns_old_and_new_version_numbers(self) -> None:
        """PUT /api/v1/dataset/<id> should include old_version and new_version
        fields that match the list-versions endpoint's version_number values."""
        _persist_fixture_state()
        table: SqlaTable = (
            db.session.query(SqlaTable)
            .filter(SqlaTable.table_name == "birth_names")
            .first()
        )
        assert table is not None
        table_id = table.id
        original_description = table.description

        try:
            ver_cls = version_class(SqlaTable)
            count_before = (
                db.session.query(ver_cls).filter(ver_cls.id == table_id).count()
            )
            expected_old = count_before - 1 if count_before > 0 else None

            self.login(ADMIN_USERNAME)
            rv = self.client.put(
                f"/api/v1/dataset/{table_id}",
                json={"description": "version-number response test"},
            )
            assert rv.status_code == 200, rv.data
            body = _json.loads(rv.data.decode("utf-8"))
            assert body["id"] == table_id
            assert "old_version" in body
            assert "new_version" in body
            assert "old_transaction_id" in body
            assert "new_transaction_id" in body
            assert body["old_version"] == expected_old
            # new_version points to the live row post-commit. It is usually
            # old_version + 1, but can equal old_version when retention pruning
            # removed an older closed row in the same commit.
            assert body["new_version"] is not None
            assert body["new_version"] >= 0
            # Transaction ids are stable identifiers, so a successful update
            # always produces a new_transaction_id distinct from the previous
            # one (when old_transaction_id is known).
            if body["old_transaction_id"] is not None:
                assert body["new_transaction_id"] != body["old_transaction_id"]
        finally:
            db.session.rollback()
            table = db.session.query(SqlaTable).filter(SqlaTable.id == table_id).one()
            table.description = original_description
            db.session.commit()

    def test_restore_denies_without_write_permission(self) -> None:
        """Gamma is read-only on Dataset — 403 on restore."""
        _persist_fixture_state()
        table: SqlaTable = (
            db.session.query(SqlaTable)
            .filter(SqlaTable.table_name == "birth_names")
            .first()
        )
        assert table is not None
        table_uuid = str(table.uuid)

        self.login(GAMMA_USERNAME)
        rv = self._restore(table_uuid, "00000000-0000-0000-0000-000000000001")
        assert rv.status_code == 403
