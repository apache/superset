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
"""Integration tests for dataset soft-delete and restore."""

from superset.connectors.sqla.models import SqlaTable
from superset.constants import SKIP_VISIBILITY_FILTER_CLASSES
from superset.extensions import db
from superset.models.slice import Slice
from superset.utils import json
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME, ALPHA_USERNAME


class TestDatasetSoftDelete(SupersetTestCase):
    """Tests for dataset soft-delete behaviour (T015, T018)."""

    def _get_example_dataset_id(self) -> int:
        """Get an existing example dataset ID for testing."""
        dataset = db.session.query(SqlaTable).first()
        assert dataset is not None, "No datasets found — load examples first"
        return dataset.id

    def test_delete_dataset_soft_deletes(self) -> None:
        """DELETE should set deleted_at instead of removing the row."""
        dataset_id = self._get_example_dataset_id()
        self.login(ADMIN_USERNAME)

        rv = self.client.delete(f"/api/v1/dataset/{dataset_id}")
        assert rv.status_code == 200

        row = (
            db.session.query(SqlaTable)
            .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {SqlaTable}})
            .filter(SqlaTable.id == dataset_id)
            .one_or_none()
        )
        assert row is not None
        assert row.deleted_at is not None

        # Cleanup: restore for other tests
        row.restore()
        db.session.commit()

    def test_soft_deleted_dataset_excluded_from_list(self) -> None:
        """GET /api/v1/dataset/ should not include soft-deleted datasets."""
        dataset_id = self._get_example_dataset_id()
        self.login(ADMIN_USERNAME)

        self.client.delete(f"/api/v1/dataset/{dataset_id}")

        rv = self.client.get("/api/v1/dataset/")
        data = json.loads(rv.data)
        ids = [d["id"] for d in data["result"]]
        assert dataset_id not in ids

        # Cleanup
        row = (
            db.session.query(SqlaTable)
            .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {SqlaTable}})
            .filter(SqlaTable.id == dataset_id)
            .one_or_none()
        )
        if row:
            row.restore()
            db.session.commit()

    def test_soft_deleted_dataset_included_in_list_when_requested(self) -> None:
        """GET /api/v1/dataset/ with dataset_deleted_state=include returns deleted datasets."""  # noqa: E501
        dataset_id = self._get_example_dataset_id()
        self.login(ADMIN_USERNAME)

        self.client.delete(f"/api/v1/dataset/{dataset_id}")

        rison_query = "(filters:!((col:id,opr:dataset_deleted_state,value:include)))"
        rv = self.client.get(f"/api/v1/dataset/?q={rison_query}")
        assert rv.status_code == 200

        data = json.loads(rv.data)
        deleted_row = next(
            (row for row in data["result"] if row["id"] == dataset_id),
            None,
        )
        assert deleted_row is not None
        assert deleted_row["deleted_at"] is not None

        # Cleanup
        row = (
            db.session.query(SqlaTable)
            .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {SqlaTable}})
            .filter(SqlaTable.id == dataset_id)
            .one_or_none()
        )
        if row:
            row.restore()
            db.session.commit()

    def test_only_filter_returns_only_soft_deleted_datasets(self) -> None:
        """dataset_deleted_state=only excludes live rows and returns only deleted ones."""  # noqa: E501
        ids = [row.id for row in db.session.query(SqlaTable).limit(2).all()]
        assert len(ids) >= 2, "Need at least two example datasets for this test"
        live_id, deleted_id = ids[0], ids[1]
        self.login(ADMIN_USERNAME)

        self.client.delete(f"/api/v1/dataset/{deleted_id}")

        rison_query = "(filters:!((col:id,opr:dataset_deleted_state,value:only)))"
        rv = self.client.get(f"/api/v1/dataset/?q={rison_query}")
        assert rv.status_code == 200

        data = json.loads(rv.data)
        returned_ids = {row["id"] for row in data["result"]}
        assert deleted_id in returned_ids
        assert live_id not in returned_ids

        # Cleanup
        row = (
            db.session.query(SqlaTable)
            .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {SqlaTable}})
            .filter(SqlaTable.id == deleted_id)
            .one_or_none()
        )
        if row:
            row.restore()
            db.session.commit()

    def test_no_cascade_to_dependent_charts(self) -> None:
        """Soft-deleting a dataset should NOT cascade to its charts (FR-009, T018)."""
        dataset_id = self._get_example_dataset_id()
        self.login(ADMIN_USERNAME)

        # Find charts that depend on this dataset
        dependent_charts = (
            db.session.query(Slice)
            .filter(Slice.datasource_id == dataset_id, Slice.datasource_type == "table")
            .all()
        )
        dependent_chart_ids = [c.id for c in dependent_charts]

        # Soft-delete the dataset
        self.client.delete(f"/api/v1/dataset/{dataset_id}")

        # Dependent charts should still be active (no cascade). On this
        # branch ``Slice`` does not yet carry ``deleted_at`` (added by the
        # charts soft-delete PR), so we only verify the row is still
        # loadable through the default visibility-filtered query — which
        # would return None if the chart had been soft-deleted.
        for chart_id in dependent_chart_ids:
            chart = db.session.query(Slice).filter(Slice.id == chart_id).one_or_none()
            assert chart is not None, f"Chart {chart_id} should still be active"

        # Cleanup
        row = (
            db.session.query(SqlaTable)
            .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {SqlaTable}})
            .filter(SqlaTable.id == dataset_id)
            .one_or_none()
        )
        if row:
            row.restore()
            db.session.commit()


class TestDatasetRestore(SupersetTestCase):
    """Tests for dataset restore behaviour (T027)."""

    def _get_example_dataset(self) -> SqlaTable:
        dataset = db.session.query(SqlaTable).first()
        assert dataset is not None
        return dataset

    def test_restore_soft_deleted_dataset(self) -> None:
        """POST /api/v1/dataset/<uuid>/restore should make it visible again."""
        dataset = self._get_example_dataset()
        dataset_id = dataset.id
        dataset_uuid = str(dataset.uuid)
        self.login(ADMIN_USERNAME)

        self.client.delete(f"/api/v1/dataset/{dataset_id}")

        rv = self.client.post(f"/api/v1/dataset/{dataset_uuid}/restore")
        assert rv.status_code == 200

        rv = self.client.get(f"/api/v1/dataset/{dataset_id}")
        assert rv.status_code == 200

    def test_restore_uses_can_write_permission(self) -> None:
        """Non-admin owner with ``can_write_Dataset`` can hit the restore
        endpoint.

        Pins the permission contract: ``method_permission_name`` must map
        ``restore`` to ``write`` so FAB's ``@protect`` resolves the gate to
        ``can_write_Dataset`` (which Alpha already carries), not the
        implicit fallback ``can_restore_Dataset`` (which no standard role
        carries).

        Without the mapping FAB defaults to ``can_<method>_<class>`` and
        every non-admin would get 403 here — admins bypass FAB permission
        checks entirely, so the admin-authed restore test above doesn't
        exercise the mapping.
        """
        dataset = self._get_example_dataset()
        dataset_id = dataset.id
        dataset_uuid = str(dataset.uuid)
        alpha = self.get_user(ALPHA_USERNAME)

        # Make Alpha an owner so raise_for_ownership passes.
        dataset.owners = list(dataset.owners) + [alpha]
        db.session.commit()

        try:
            self.login(ALPHA_USERNAME)
            rv = self.client.delete(f"/api/v1/dataset/{dataset_id}")
            assert rv.status_code == 200, (
                f"Alpha owner soft-delete failed: {rv.status_code} {rv.data!r}"
            )

            rv = self.client.post(f"/api/v1/dataset/{dataset_uuid}/restore")
            assert rv.status_code == 200, (
                f"Expected 200 from Alpha owner restore (can_write_Dataset), "
                f"got {rv.status_code}: {rv.data!r}. If 403, "
                "method_permission_name is missing 'restore': 'write'."
            )
        finally:
            # Restore example dataset state: remove Alpha from owners and
            # ensure deleted_at is cleared in case the restore attempt failed.
            row = (
                db.session.query(SqlaTable)
                .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {SqlaTable}})
                .filter(SqlaTable.id == dataset_id)
                .one()
            )
            row.owners = [o for o in row.owners if o.id != alpha.id]
            if row.deleted_at is not None:
                row.restore()
            db.session.commit()

    # Note: a ``test_restore_blocked_by_active_logical_duplicate`` integration
    # test was attempted here but is unreachable. The ``tables`` table carries
    # two DB-level unique constraints on the logical identity (the newer
    # ``UniqueConstraint("database_id", "catalog", "schema", "table_name")``
    # in the model plus the legacy ``_customer_location_uc`` from the 2016
    # ``b4456560d4f3`` migration), so the "delete -> seed twin -> restore"
    # setup cannot satisfy step 2 — the DB rejects the twin insert before the
    # application-level restore check can be exercised. The restore-side
    # ``_has_active_logical_duplicate`` override in ``RestoreDatasetCommand``
    # is kept as defensive code (cleaner 422 if the DB constraint is ever
    # relaxed) and is covered by ``tests/unit_tests/commands/dataset/
    # restore_test.py::test_restore_dataset_logical_duplicate_raises`` at the
    # mocked level. The create-side defense is covered end-to-end by
    # ``test_create_blocked_by_soft_deleted_logical_duplicate`` below.

    def test_create_blocked_by_soft_deleted_logical_duplicate(self) -> None:
        """Create returns 422 when a soft-deleted dataset references the same
        physical table.

        Pins the contract that ``DatasetDAO.validate_uniqueness`` bypasses
        the soft-delete visibility filter, so a soft-deleted row blocks
        creation of a new dataset at the same logical identity at the
        application layer (clean 422 instead of an opaque 500
        IntegrityError from the DB-level unique constraint).
        """
        dataset = self._get_example_dataset()
        original_id = dataset.id
        database_id = dataset.database_id
        catalog = dataset.catalog
        schema = dataset.schema
        table_name = dataset.table_name

        self.login(ADMIN_USERNAME)

        rv = self.client.delete(f"/api/v1/dataset/{original_id}")
        assert rv.status_code == 200

        try:
            rv = self.client.post(
                "/api/v1/dataset/",
                json={
                    "database": database_id,
                    "catalog": catalog,
                    "schema": schema,
                    "table_name": table_name,
                },
            )
            assert rv.status_code == 422, (
                f"Expected 422 for create-blocked-by-soft-deleted, "
                f"got {rv.status_code}: {rv.data!r}"
            )
        finally:
            row = (
                db.session.query(SqlaTable)
                .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {SqlaTable}})
                .filter(SqlaTable.id == original_id)
                .one()
            )
            row.restore()
            db.session.commit()
