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
from tests.integration_tests.constants import ADMIN_USERNAME


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

    def test_restore_blocked_by_active_logical_duplicate(self) -> None:
        """Restore returns 422 when another active dataset already references
        the same physical table.

        Without the duplicate check, the soft-deleted dataset's logical slot
        could be claimed by a new active row and restore would silently
        produce two live ``SqlaTable`` entries for one physical table.
        """
        dataset = self._get_example_dataset()
        original_id = dataset.id
        original_uuid = str(dataset.uuid)
        database_id = dataset.database_id
        catalog = dataset.catalog
        schema = dataset.schema
        table_name = dataset.table_name

        self.login(ADMIN_USERNAME)

        # Soft-delete the original.
        rv = self.client.delete(f"/api/v1/dataset/{original_id}")
        assert rv.status_code == 200

        # Claim the logical slot with a new active dataset pointing at the
        # same physical table.
        twin = SqlaTable(
            table_name=table_name,
            database_id=database_id,
            catalog=catalog,
            schema=schema,
        )
        db.session.add(twin)
        db.session.commit()
        twin_id = twin.id

        try:
            rv = self.client.post(f"/api/v1/dataset/{original_uuid}/restore")
            assert rv.status_code == 422, (
                f"Expected 422 for logical-duplicate restore, "
                f"got {rv.status_code}: {rv.data!r}"
            )

            # The original is still soft-deleted; restore did not mutate it.
            row = (
                db.session.query(SqlaTable)
                .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {SqlaTable}})
                .filter(SqlaTable.id == original_id)
                .one()
            )
            assert row.deleted_at is not None, (
                "Original dataset should remain soft-deleted after blocked restore"
            )
        finally:
            # Cleanup: remove the twin and clear deleted_at on the original
            # so the example dataset is available to other tests.
            db.session.delete(twin)
            row = (
                db.session.query(SqlaTable)
                .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {SqlaTable}})
                .filter(SqlaTable.id == original_id)
                .one()
            )
            row.restore()
            db.session.commit()
            # Ensure twin is fully gone before next test runs
            assert (
                db.session.query(SqlaTable).filter(SqlaTable.id == twin_id).first()
                is None
            )

    def test_create_blocked_by_soft_deleted_logical_duplicate(self) -> None:
        """Create returns 422 when a soft-deleted dataset references the same
        physical table.

        Defense-in-depth complement to
        ``test_restore_blocked_by_active_logical_duplicate``: if the create
        path enforces logical uniqueness against soft-deleted rows too, the
        restore-conflict scenario can no longer arise from normal API use
        (it can still arise from importer / admin paths, which restore
        covers separately).
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
