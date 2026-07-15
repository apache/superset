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

from flask_appbuilder.security.sqla.models import User

from superset import security_manager
from superset.connectors.sqla.models import SqlaTable
from superset.constants import SKIP_VISIBILITY_FILTER_CLASSES
from superset.extensions import db
from superset.models.core import Database
from superset.models.slice import Slice
from superset.subjects.models import Subject
from superset.subjects.utils import get_or_create_user_subject
from superset.utils import json
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.conftest import with_feature_flags
from tests.integration_tests.constants import (
    ADMIN_USERNAME,
    ALPHA_USERNAME,
    GAMMA_USERNAME,
)


def _user_subject(user: User) -> Subject:
    subject = get_or_create_user_subject(user.id)
    assert subject is not None
    return subject


def _restore_dataset(dataset_id: int) -> None:
    """Restore a soft-deleted dataset (cleanup helper).

    Module-level so every test class in this file can use it. Used in
    ``finally`` blocks so a failed assertion can't strand a soft-deleted
    row and leak it into later tests; re-queries with the
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


class TestDatasetSoftDelete(SupersetTestCase):
    """Tests for dataset soft-delete behaviour (T015, T018)."""

    def _get_example_dataset_id(self) -> int:
        """Get an existing example dataset ID for testing."""
        dataset = db.session.query(SqlaTable).first()
        assert dataset is not None, "No datasets found — load examples first"
        return dataset.id

    def _restore_dataset(self, dataset_id: int) -> None:
        """Class-method shim over the module-level helper (existing call sites)."""
        _restore_dataset(dataset_id)

    @with_feature_flags(SOFT_DELETE=True)
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

    @with_feature_flags(SOFT_DELETE=True)
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

    @with_feature_flags(SOFT_DELETE=True)
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

    @with_feature_flags(SOFT_DELETE=True)
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

    @with_feature_flags(SOFT_DELETE=True)
    def test_deleted_state_list_shows_editor_their_own_deleted(self) -> None:
        """A non-admin editor can enumerate their own soft-deleted datasets.
        Deleted-state scoping mirrors the restore audience, so it must not lock
        editors out of their own trash."""
        alpha = self.get_user(ALPHA_USERNAME)
        alpha_subject = _user_subject(alpha)
        database = Database(database_name="sd_editor_db", sqlalchemy_uri="sqlite://")
        db.session.add(database)
        db.session.flush()
        dataset = SqlaTable(
            table_name="sd_editor_tbl", database=database, editors=[alpha_subject]
        )
        db.session.add(dataset)
        db.session.commit()
        dataset_id = dataset.id

        dataset.deleted_at = datetime(2026, 1, 1, 12, 0, 0)
        db.session.commit()

        try:
            self.login(ALPHA_USERNAME)
            rison_query = (
                "(filters:!((col:id,opr:dataset_deleted_state,value:only)),"
                "page_size:200)"
            )
            rv = self.client.get(f"/api/v1/dataset/?q={rison_query}")
            assert rv.status_code == 200
            ids = [r["id"] for r in json.loads(rv.data)["result"]]
            assert dataset_id in ids
        finally:
            # Matches the sibling tests: a failed assertion must not strand
            # the soft-deleted dataset/database in the shared test DB.
            self._hard_delete_created(dataset_id, database)

    @with_feature_flags(SOFT_DELETE=True)
    def test_deleted_state_list_hides_non_editor_from_read_access_user(self) -> None:
        """A read-access non-editor must not enumerate a dataset once it is
        soft-deleted.

        Gamma is granted ``datasource_access`` to the dataset, so
        ``DatasourceFilter`` makes it visible to gamma while live. After
        soft-delete, the deleted-state list is scoped to the restore audience
        (editors/admins), so gamma — who could never restore it — must not see it
        via ``include`` or ``only``.
        """
        admin = self.get_user(ADMIN_USERNAME)
        admin_subject = _user_subject(admin)
        database = Database(database_name="sd_acl_db", sqlalchemy_uri="sqlite://")
        db.session.add(database)
        db.session.flush()
        dataset = SqlaTable(
            table_name="sd_acl_tbl", database=database, editors=[admin_subject]
        )
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
                    "read-access non-editor must not enumerate a soft-deleted "
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

    @with_feature_flags(SOFT_DELETE=True)
    def test_deleted_state_list_shows_gamma_editor_without_datasource_grant(
        self,
    ) -> None:
        """An editor keeps sight of their own trash even without a datasource
        grant.

        Gamma can edit the dataset but holds NO ``datasource_access`` on it, so
        every access leg of ``DatasourceFilter`` fails — the editable-soft-deleted
        leg is what makes the row reachable, mirroring ``raise_for_access``
        counting editorship as datasource access. The live-row precondition
        also pins the leg's inertness: while the dataset is live, gamma
        (no grant) must NOT see it, because the leg requires
        ``deleted_at IS NOT NULL``.
        """
        gamma = self.get_user(GAMMA_USERNAME)
        gamma_subject = _user_subject(gamma)
        database = Database(database_name="sd_own_db", sqlalchemy_uri="sqlite://")
        db.session.add(database)
        db.session.flush()
        dataset = SqlaTable(
            table_name="sd_own_tbl", database=database, editors=[gamma_subject]
        )
        db.session.add(dataset)
        db.session.commit()
        dataset_id = dataset.id

        try:
            self.login(GAMMA_USERNAME)
            # Precondition: no grant -> gamma cannot see the LIVE row (the
            # owned-trash leg must not leak live rows).
            rv = self.client.get("/api/v1/dataset/?q=(page_size:200)")
            assert rv.status_code == 200
            assert dataset_id not in [r["id"] for r in json.loads(rv.data)["result"]], (
                "precondition: ungranted gamma must not see the live dataset"
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
                assert dataset_id in ids, (
                    "editor without a datasource grant must still enumerate "
                    f"their own trash via dataset_deleted_state={value}"
                )
        finally:
            self._hard_delete_created(dataset_id, database)

    @with_feature_flags(SOFT_DELETE=False)
    def test_delete_dataset_flag_off_hard_deletes(self) -> None:
        """Default-deployment contract: with SOFT_DELETE off, DELETE
        physically removes the row (even a bypass query finds nothing) and
        the restore endpoint 404s — there is nothing to restore.

        Every other delete-path test in this module runs flag-ON; without
        this test the path every default deployment actually runs would be
        the untested one.
        """
        admin = self.get_user(ADMIN_USERNAME)
        admin_subject = _user_subject(admin)
        database = Database(database_name="sd_off_db", sqlalchemy_uri="sqlite://")
        db.session.add(database)
        db.session.flush()
        dataset = SqlaTable(
            table_name="sd_off_tbl", database=database, editors=[admin_subject]
        )
        db.session.add(dataset)
        db.session.commit()
        dataset_id = dataset.id
        dataset_uuid = str(dataset.uuid)

        try:
            self.login(ADMIN_USERNAME)
            rv = self.client.delete(f"/api/v1/dataset/{dataset_id}")
            assert rv.status_code == 200

            row = (
                db.session.query(SqlaTable)
                .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {SqlaTable}})
                .filter(SqlaTable.id == dataset_id)
                .one_or_none()
            )
            assert row is None, "flag-off DELETE must hard-delete the row"

            rv = self.client.post(f"/api/v1/dataset/{dataset_uuid}/restore")
            assert rv.status_code == 404, "hard-deleted rows are not restorable"
        finally:
            self._hard_delete_created(dataset_id, database)

    @with_feature_flags(SOFT_DELETE=True)
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

    @with_feature_flags(SOFT_DELETE=True)
    def test_restore_soft_deleted_dataset(self) -> None:
        """POST /api/v1/dataset/<uuid>/restore should make it visible again."""
        dataset = self._get_example_dataset()
        dataset_id = dataset.id
        dataset_uuid = str(dataset.uuid)
        self.login(ADMIN_USERNAME)

        try:
            self.client.delete(f"/api/v1/dataset/{dataset_id}")

            rv = self.client.post(f"/api/v1/dataset/{dataset_uuid}/restore")
            assert rv.status_code == 200

            rv = self.client.get(f"/api/v1/dataset/{dataset_id}")
            assert rv.status_code == 200
        finally:
            # This test soft-deletes the SHARED example dataset; a failed
            # assertion must not strand it and cascade failures through
            # every later suite that queries it.
            # TestDatasetRestore has no _restore_dataset method (that lives on
            # TestDatasetSoftDelete); call the module-level helper directly.
            _restore_dataset(dataset_id)

    @with_feature_flags(SOFT_DELETE=True)
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
        try:
            self.client.delete(f"/api/v1/dataset/{dataset_id}")

            with patch(
                "superset.commands.dataset.restore.RestoreDatasetCommand.run",
                side_effect=DatasetRestoreFailedError(),
            ):
                rv = self.client.post(f"/api/v1/dataset/{dataset_uuid}/restore")
                assert rv.status_code == 422
        finally:
            # The mocked restore leaves the example dataset soft-deleted; a
            # failed assertion must not strand it for later tests.
            _restore_dataset(dataset_id)

    @with_feature_flags(SOFT_DELETE=True)
    def test_restore_uses_can_write_permission(self) -> None:
        """Non-admin editor with ``can_write_Dataset`` can hit the restore
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
        alpha_subject = _user_subject(alpha)

        # Make Alpha an editor so raise_for_editorship passes.
        dataset.editors = list(dataset.editors) + [alpha_subject]
        db.session.commit()

        try:
            self.login(ALPHA_USERNAME)
            rv = self.client.delete(f"/api/v1/dataset/{dataset_id}")
            assert rv.status_code == 200, (
                f"Alpha editor soft-delete failed: {rv.status_code} {rv.data!r}"
            )

            rv = self.client.post(f"/api/v1/dataset/{dataset_uuid}/restore")
            assert rv.status_code == 200, (
                f"Expected 200 from Alpha editor restore (can_write_Dataset), "
                f"got {rv.status_code}: {rv.data!r}. If 403, "
                "method_permission_name is missing 'restore': 'write'."
            )
        finally:
            # Restore example dataset state: remove Alpha from editors and
            # ensure deleted_at is cleared in case the restore attempt failed.
            row = (
                db.session.query(SqlaTable)
                .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {SqlaTable}})
                .filter(SqlaTable.id == dataset_id)
                .one()
            )
            row.editors = [s for s in row.editors if s.id != alpha_subject.id]
            if row.deleted_at is not None:
                row.restore()
            db.session.commit()

    # Note: a ``test_restore_blocked_by_active_logical_duplicate`` integration
    # test is deliberately absent: the "delete -> seed twin -> restore" setup
    # is blocked at step 2 by a DB-level constraint, though *which* constraint
    # depends on how the schema was built. ``metadata.create_all`` (unit-test
    # schemas) materializes the model's otherwise metadata-only 4-column
    # ``UniqueConstraint``; migration-built databases instead still carry the
    # legacy 3-column ``_customer_location_uc`` from the 2016 ``b4456560d4f3``
    # migration — the 2024 ``df3d7e2eb9a4`` migration that intends to drop it
    # is a silent no-op (it passes a list to
    # ``generic_find_uq_constraint_name``, which compares it to a set; the
    # comparison never matches). Seeding a NULL-schema twin would dodge the
    # constraint, but a NULL-schema row would not match the application
    # check's identity predicate either. The restore-side check
    # ``DatasetDAO.has_active_logical_duplicate`` (called from
    # ``RestoreDatasetCommand.validate`` and the v1 importer) yields a clean
    # 422 instead of an opaque IntegrityError and guards any schema where the
    # legacy constraint is eventually dropped for real; it is covered by
    # ``tests/unit_tests/commands/dataset/restore_test.py::
    # test_restore_dataset_logical_duplicate_raises`` plus the catalog-
    # normalization tests in ``tests/unit_tests/dao/dataset_test.py``. The
    # create-side defense is covered end-to-end by
    # ``test_create_blocked_by_soft_deleted_logical_duplicate`` below.

    @with_feature_flags(SOFT_DELETE=True)
    def test_create_blocked_by_soft_deleted_logical_duplicate(self) -> None:
        """Create returns 422 when a soft-deleted dataset references the same
        physical table.

        Pins the contract that ``DatasetDAO.validate_uniqueness`` bypasses
        the soft-delete visibility filter, so a soft-deleted row blocks
        creation of a new dataset at the same logical identity at the
        application layer — a clean 422 instead of an opaque
        IntegrityError from whichever DB-level constraint applies (or a
        silent active twin where none does; DB-level enforcement is
        inconsistent across schema builds).
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
