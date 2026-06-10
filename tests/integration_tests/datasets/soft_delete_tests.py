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

from datetime import datetime

from superset import security_manager
from superset.connectors.sqla.models import SqlaTable
from superset.constants import SKIP_VISIBILITY_FILTER_CLASSES
from superset.extensions import db
from superset.models.core import Database
from superset.models.slice import Slice
from superset.utils import json
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import (
    ADMIN_USERNAME,
    ALPHA_USERNAME,
    GAMMA_USERNAME,
)


class TestDatasetSoftDelete(SupersetTestCase):
    """Tests for dataset soft-delete behaviour (T015, T018)."""

    def _get_example_dataset_id(self) -> int:
        """Get an existing example dataset ID for testing."""
        dataset = db.session.query(SqlaTable).first()
        assert dataset is not None, "No datasets found — load examples first"
        return dataset.id

    def _restore_dataset(self, dataset_id: int) -> None:
        """Restore a soft-deleted dataset (cleanup helper).

        Used in ``finally`` blocks so a failed assertion can't strand a
        soft-deleted row and leak it into later tests; re-queries with the
        visibility-filter bypass and only restores if still soft-deleted.
        """
        row = (
            db.session.query(SqlaTable)
            .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {SqlaTable}})
            .filter(SqlaTable.id == dataset_id)
            .one_or_none()
        )
        if row is not None and row.deleted_at is not None:
            row.restore()
            db.session.commit()

    def test_delete_dataset_soft_deletes(self) -> None:
        """DELETE should set deleted_at instead of removing the row."""
        dataset_id = self._get_example_dataset_id()
        self.login(ADMIN_USERNAME)

        try:
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
        finally:
            self._restore_dataset(dataset_id)

    def test_soft_deleted_dataset_excluded_from_list(self) -> None:
        """GET /api/v1/dataset/ should not include soft-deleted datasets."""
        dataset_id = self._get_example_dataset_id()
        self.login(ADMIN_USERNAME)

        try:
            rv = self.client.delete(f"/api/v1/dataset/{dataset_id}")
            assert rv.status_code == 200

            rv = self.client.get("/api/v1/dataset/")
            data = json.loads(rv.data)
            ids = [d["id"] for d in data["result"]]
            assert dataset_id not in ids
        finally:
            self._restore_dataset(dataset_id)

    def test_soft_deleted_dataset_included_in_list_when_requested(self) -> None:
        """GET /api/v1/dataset/ with dataset_deleted_state=include returns deleted datasets."""  # noqa: E501
        dataset_id = self._get_example_dataset_id()
        self.login(ADMIN_USERNAME)

        try:
            rv = self.client.delete(f"/api/v1/dataset/{dataset_id}")
            assert rv.status_code == 200

            rison_query = (
                "(filters:!((col:id,opr:dataset_deleted_state,value:include)))"
            )
            rv = self.client.get(f"/api/v1/dataset/?q={rison_query}")
            assert rv.status_code == 200

            data = json.loads(rv.data)
            deleted_row = next(
                (row for row in data["result"] if row["id"] == dataset_id),
                None,
            )
            assert deleted_row is not None
            assert deleted_row["deleted_at"] is not None
        finally:
            self._restore_dataset(dataset_id)

    def test_only_filter_returns_only_soft_deleted_datasets(self) -> None:
        """dataset_deleted_state=only excludes live rows and returns only deleted ones."""  # noqa: E501
        ids = [row.id for row in db.session.query(SqlaTable).limit(2).all()]
        assert len(ids) >= 2, "Need at least two example datasets for this test"
        live_id, deleted_id = ids[0], ids[1]
        self.login(ADMIN_USERNAME)

        try:
            rv = self.client.delete(f"/api/v1/dataset/{deleted_id}")
            assert rv.status_code == 200

            rison_query = "(filters:!((col:id,opr:dataset_deleted_state,value:only)))"
            rv = self.client.get(f"/api/v1/dataset/?q={rison_query}")
            assert rv.status_code == 200

            data = json.loads(rv.data)
            returned_ids = {row["id"] for row in data["result"]}
            assert deleted_id in returned_ids
            assert live_id not in returned_ids
        finally:
            self._restore_dataset(deleted_id)

    def _hard_delete_created(self, dataset_id: int, database: Database) -> None:
        """Remove a test-created dataset + its database (visibility bypassed)."""
        row = (
            db.session.query(SqlaTable)
            .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {SqlaTable}})
            .filter(SqlaTable.id == dataset_id)
            .one_or_none()
        )
        if row:
            db.session.delete(row)
        db.session.delete(database)
        db.session.commit()

    def test_deleted_state_list_shows_owner_their_own_deleted(self) -> None:
        """A non-admin owner can still enumerate their own soft-deleted datasets.
        Deleted-state scoping mirrors the restore audience, so it must not lock
        owners out of their own trash."""
        alpha = self.get_user(ALPHA_USERNAME)
        database = Database(database_name="sd_owner_db", sqlalchemy_uri="sqlite://")
        db.session.add(database)
        db.session.flush()
        dataset = SqlaTable(
            table_name="sd_owner_tbl", database=database, owners=[alpha]
        )
        db.session.add(dataset)
        db.session.commit()
        dataset_id = dataset.id

        dataset.deleted_at = datetime(2026, 1, 1, 12, 0, 0)
        db.session.commit()

        self.login(ALPHA_USERNAME)
        rison_query = (
            "(filters:!((col:id,opr:dataset_deleted_state,value:only)),page_size:200)"
        )
        rv = self.client.get(f"/api/v1/dataset/?q={rison_query}")
        assert rv.status_code == 200
        ids = [r["id"] for r in json.loads(rv.data)["result"]]
        assert dataset_id in ids

        self._hard_delete_created(dataset_id, database)

    def test_deleted_state_list_hides_non_owned_from_read_access_user(self) -> None:
        """A read-access non-owner must not enumerate a dataset once it is
        soft-deleted.

        Gamma is granted ``datasource_access`` to the dataset, so
        ``DatasourceFilter`` makes it visible to gamma while live. After
        soft-delete, the deleted-state list is scoped to the restore audience
        (owners/admins), so gamma — who could never restore it — must not see it
        via ``include`` or ``only``.
        """
        admin = self.get_user(ADMIN_USERNAME)
        database = Database(database_name="sd_acl_db", sqlalchemy_uri="sqlite://")
        db.session.add(database)
        db.session.flush()
        dataset = SqlaTable(table_name="sd_acl_tbl", database=database, owners=[admin])
        db.session.add(dataset)
        db.session.commit()
        dataset_id = dataset.id

        gamma_role = security_manager.find_role("Gamma")
        pvm = security_manager.add_permission_view_menu(
            "datasource_access", dataset.perm
        )
        gamma_role.permissions.append(pvm)
        db.session.commit()

        try:
            # Precondition: gamma can see the dataset while it is live.
            self.login(GAMMA_USERNAME)
            rv = self.client.get("/api/v1/dataset/?q=(page_size:200)")
            assert dataset_id in [r["id"] for r in json.loads(rv.data)["result"]], (
                "precondition: gamma should see the live dataset via datasource access"
            )

            reloaded = (
                db.session.query(SqlaTable)
                .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {SqlaTable}})
                .filter(SqlaTable.id == dataset_id)
                .one()
            )
            reloaded.deleted_at = datetime(2026, 1, 1, 12, 0, 0)
            db.session.commit()

            for value in ("include", "only"):
                rison_query = (
                    f"(filters:!((col:id,opr:dataset_deleted_state,value:{value})),"
                    "page_size:200)"
                )
                rv = self.client.get(f"/api/v1/dataset/?q={rison_query}")
                assert rv.status_code == 200
                ids = [r["id"] for r in json.loads(rv.data)["result"]]
                assert dataset_id not in ids, (
                    "read-access non-owner must not enumerate a soft-deleted "
                    f"dataset via dataset_deleted_state={value}"
                )
        finally:
            pvm = security_manager.find_permission_view_menu(
                "datasource_access", dataset.perm
            )
            if pvm:
                security_manager.del_permission_role(gamma_role, pvm)
            db.session.commit()
            self._hard_delete_created(dataset_id, database)

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

        try:
            # Soft-delete the dataset
            rv = self.client.delete(f"/api/v1/dataset/{dataset_id}")
            assert rv.status_code == 200

            # Dependent charts should still be active (no cascade). On this
            # branch ``Slice`` does not yet carry ``deleted_at`` (added by the
            # charts soft-delete PR), so we only verify the row is still
            # loadable through the default visibility-filtered query — which
            # would return None if the chart had been soft-deleted.
            for chart_id in dependent_chart_ids:
                chart = (
                    db.session.query(Slice).filter(Slice.id == chart_id).one_or_none()
                )
                assert chart is not None, f"Chart {chart_id} should still be active"
        finally:
            self._restore_dataset(dataset_id)


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

    def test_restore_failure_returns_422(self) -> None:
        """A failure during restore surfaces as a clean 422 via the
        ``DatasetRestoreFailedError`` handler rather than an unhandled 500.

        ``RestoreDatasetCommand.run`` wraps the restore in ``@transaction``
        and rethrows ``DatasetRestoreFailedError`` on any underlying
        SQLAlchemy error; this pins that the endpoint maps it to 422.
        """
        from unittest.mock import patch

        from superset.commands.dataset.exceptions import (
            DatasetRestoreFailedError,
        )

        dataset = self._get_example_dataset()
        dataset_id = dataset.id
        dataset_uuid = str(dataset.uuid)
        self.login(ADMIN_USERNAME)
        self.client.delete(f"/api/v1/dataset/{dataset_id}")

        with patch(
            "superset.commands.dataset.restore.RestoreDatasetCommand.run",
            side_effect=DatasetRestoreFailedError(),
        ):
            rv = self.client.post(f"/api/v1/dataset/{dataset_uuid}/restore")
        assert rv.status_code == 422

        # Cleanup: the mocked restore left the example dataset soft-deleted.
        self._restore_dataset(dataset_id)

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
    # application-level restore check can be exercised. The restore-side check
    # ``DatasetDAO.has_active_logical_duplicate`` (called from
    # ``RestoreDatasetCommand.validate`` and the v1 importer) is kept as
    # defensive code (cleaner 422 if the DB constraint is ever relaxed) and is
    # covered by ``tests/unit_tests/commands/dataset/restore_test.py::
    # test_restore_dataset_logical_duplicate_raises`` plus the catalog-
    # normalization tests in ``tests/unit_tests/dao/dataset_test.py`` at
    # the mocked level. The create-side defense is covered end-to-end by
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
