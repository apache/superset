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
from sqlalchemy_continuum import version_class

from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.extensions import db
from superset.utils import json as _json
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME, GAMMA_USERNAME
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


class TestDatasetSnapshotCapture(SupersetTestCase):
    """Dataset commits write a JSON snapshot of columns + metrics into
    ``dataset_snapshots`` keyed on the Continuum transaction_id.
    """

    @pytest.fixture(autouse=True)
    def _load_data(self, load_birth_names_dashboard_with_slices):  # noqa: PT004, F811
        pass

    def test_snapshot_captured_on_commit(self) -> None:
        """A dataset save produces exactly one dataset_snapshots row for
        that tx, containing every column + metric."""
        import sqlalchemy as sa

        _persist_fixture_state()
        table: SqlaTable = (
            db.session.query(SqlaTable)
            .filter(SqlaTable.table_name == "birth_names")
            .first()
        )
        assert table is not None
        table_id = table.id
        expected_column_names = sorted(c.column_name for c in table.columns)
        expected_metric_names = sorted(m.metric_name for m in table.metrics)

        original_description = table.description
        table.description = "snapshot-capture-test"
        db.session.commit()

        # Find the snapshot for the most recent tx for this dataset.
        ver_cls = version_class(SqlaTable)
        latest_tx = (
            db.session.query(ver_cls.transaction_id)
            .filter(ver_cls.id == table_id)
            .order_by(ver_cls.transaction_id.desc())
            .limit(1)
            .scalar()
        )
        assert latest_tx is not None

        snap = db.session.execute(
            sa.text(
                "SELECT columns_json, metrics_json "
                "FROM dataset_snapshots "
                "WHERE dataset_id = :id AND transaction_id = :tx"
            ),
            {"id": table_id, "tx": latest_tx},
        ).first()
        assert snap is not None, "Expected a dataset_snapshots row for this save"

        # pylint: disable=import-outside-toplevel
        from superset.daos.version import _coerce_snapshot_list

        columns = _coerce_snapshot_list(snap[0])
        metrics = _coerce_snapshot_list(snap[1])
        assert sorted(c["column_name"] for c in columns) == expected_column_names
        assert sorted(m["metric_name"] for m in metrics) == expected_metric_names

        # Cleanup
        table.description = original_description
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
        # issued_at is an RFC-1123 HTTP date ("Wed, 22 Apr 2026 …"); parse
        # before checking monotonic order rather than sorting strings,
        # which would reorder incorrectly across day-of-week boundaries.
        from email.utils import parsedate_to_datetime

        parsed = [parsedate_to_datetime(e["issued_at"]) for e in body["result"]]
        assert parsed == sorted(parsed)

        # Cleanup
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

        ver_cls = version_class(SqlaTable)
        db.session.query(ver_cls).filter(ver_cls.id == table.id).delete(
            synchronize_session=False
        )
        db.session.commit()

        self.login(ADMIN_USERNAME)
        rv = self._list_versions(table_uuid)
        assert rv.status_code == 200
        body = _json.loads(rv.data.decode("utf-8"))
        assert body["count"] == 0
        assert body["result"] == []

        # Cleanup
        db.session.delete(table)
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
        target_row = next(
            (row for row in rows if row.description == original_description),
            None,
        )
        assert target_row is not None, (
            f"No version with original description; rows={rows}"
        )
        target_uuid = str(derive_version_uuid(entity_uuid, target_row.transaction_id))

        self.login(ADMIN_USERNAME)
        rv = self._restore(table_uuid, target_uuid)
        assert rv.status_code == 200, rv.data

        db.session.expire_all()
        table = db.session.query(SqlaTable).filter(SqlaTable.id == table_id).one()
        assert table.description == original_description

        # Cleanup
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

        # Cleanup
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
        rv = self.client.get(f"/api/v1/dataset/{table_uuid}/versions/{target_uuid}/")
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

        # Cleanup
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

        ver_cls = version_class(SqlaTable)
        count_before = db.session.query(ver_cls).filter(ver_cls.id == table_id).count()
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

        # Cleanup
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
