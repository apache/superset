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
"""Integration tests for dataset soft-delete and restore (sc-103157)."""

from superset.connectors.sqla.models import SqlaTable
from superset.extensions import db
from superset.models.helpers import SKIP_VISIBILITY_FILTER
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

    def test_delete_dataset_soft_deletes(self):
        """DELETE should set deleted_at instead of removing the row."""
        dataset_id = self._get_example_dataset_id()
        self.login(ADMIN_USERNAME)

        rv = self.client.delete(f"/api/v1/dataset/{dataset_id}")
        assert rv.status_code == 200

        row = (
            db.session.query(SqlaTable)
            .execution_options(**{SKIP_VISIBILITY_FILTER: True})
            .filter(SqlaTable.id == dataset_id)
            .one_or_none()
        )
        assert row is not None
        assert row.deleted_at is not None

        # Cleanup: restore for other tests
        row.restore()
        db.session.commit()

    def test_soft_deleted_dataset_excluded_from_list(self):
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
            .execution_options(**{SKIP_VISIBILITY_FILTER: True})
            .filter(SqlaTable.id == dataset_id)
            .one_or_none()
        )
        if row:
            row.restore()
            db.session.commit()

    def test_soft_deleted_dataset_included_in_list_when_requested(self):
        """GET /api/v1/dataset/?include_deleted=true includes deleted datasets."""
        dataset_id = self._get_example_dataset_id()
        self.login(ADMIN_USERNAME)

        self.client.delete(f"/api/v1/dataset/{dataset_id}")

        rv = self.client.get("/api/v1/dataset/?include_deleted=true")
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
            .execution_options(**{SKIP_VISIBILITY_FILTER: True})
            .filter(SqlaTable.id == dataset_id)
            .one_or_none()
        )
        if row:
            row.restore()
            db.session.commit()

    def test_no_cascade_to_dependent_charts(self):
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

        # Dependent charts should still be active (no cascade)
        for chart_id in dependent_chart_ids:
            chart = db.session.query(Slice).filter(Slice.id == chart_id).one_or_none()
            assert chart is not None, f"Chart {chart_id} should still be active"
            assert chart.deleted_at is None, (
                f"Chart {chart_id} should not be soft-deleted"
            )

        # Cleanup
        row = (
            db.session.query(SqlaTable)
            .execution_options(**{SKIP_VISIBILITY_FILTER: True})
            .filter(SqlaTable.id == dataset_id)
            .one_or_none()
        )
        if row:
            row.restore()
            db.session.commit()


class TestDatasetRestore(SupersetTestCase):
    """Tests for dataset restore behaviour (T027)."""

    def _get_example_dataset_id(self) -> int:
        dataset = db.session.query(SqlaTable).first()
        assert dataset is not None
        return dataset.id

    def test_restore_soft_deleted_dataset(self):
        """POST /api/v1/dataset/<pk>/restore should make it visible again."""
        dataset_id = self._get_example_dataset_id()
        self.login(ADMIN_USERNAME)

        self.client.delete(f"/api/v1/dataset/{dataset_id}")

        rv = self.client.post(f"/api/v1/dataset/{dataset_id}/restore")
        assert rv.status_code == 200

        rv = self.client.get(f"/api/v1/dataset/{dataset_id}")
        assert rv.status_code == 200
