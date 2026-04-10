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
"""Integration tests for chart soft-delete and restore (sc-103157)."""

import json

from superset.extensions import db
from superset.models.helpers import SKIP_VISIBILITY_FILTER
from superset.models.slice import Slice
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME
from tests.integration_tests.insert_chart_mixin import InsertChartMixin


class TestChartSoftDelete(InsertChartMixin, SupersetTestCase):
    """Tests for chart soft-delete behaviour (T013, T016)."""

    def test_delete_chart_soft_deletes(self):
        """DELETE /api/v1/chart/<pk> should set deleted_at instead of removing the row."""
        admin_id = self.get_user("admin").id
        chart = self.insert_chart("soft_delete_test", [admin_id], 1)
        chart_id = chart.id
        self.login(ADMIN_USERNAME)

        rv = self.client.delete(f"/api/v1/chart/{chart_id}")
        assert rv.status_code == 200

        # Row still exists in DB with deleted_at set
        row = (
            db.session.query(Slice)
            .execution_options(**{SKIP_VISIBILITY_FILTER: True})
            .filter(Slice.id == chart_id)
            .one_or_none()
        )
        assert row is not None
        assert row.deleted_at is not None

    def test_soft_deleted_chart_excluded_from_get(self):
        """GET /api/v1/chart/<pk> should return 404 for a soft-deleted chart."""
        admin_id = self.get_user("admin").id
        chart = self.insert_chart("invisible_chart", [admin_id], 1)
        chart_id = chart.id
        self.login(ADMIN_USERNAME)

        # Soft-delete it
        self.client.delete(f"/api/v1/chart/{chart_id}")

        # GET should return 404
        rv = self.client.get(f"/api/v1/chart/{chart_id}")
        assert rv.status_code == 404

    def test_soft_deleted_chart_excluded_from_list(self):
        """GET /api/v1/chart/ should not include soft-deleted charts."""
        admin_id = self.get_user("admin").id
        chart = self.insert_chart("listed_then_deleted", [admin_id], 1)
        chart_id = chart.id
        self.login(ADMIN_USERNAME)

        # Soft-delete it
        self.client.delete(f"/api/v1/chart/{chart_id}")

        # List should not include it
        rv = self.client.get("/api/v1/chart/")
        data = json.loads(rv.data)
        chart_ids = [c["id"] for c in data["result"]]
        assert chart_id not in chart_ids

    def test_delete_already_soft_deleted_chart_returns_404(self):
        """DELETE on an already soft-deleted chart should return 404 (FR-008)."""
        admin_id = self.get_user("admin").id
        chart = self.insert_chart("double_delete_test", [admin_id], 1)
        chart_id = chart.id
        self.login(ADMIN_USERNAME)

        # First delete succeeds
        rv = self.client.delete(f"/api/v1/chart/{chart_id}")
        assert rv.status_code == 200

        # Second delete returns 404
        rv = self.client.delete(f"/api/v1/chart/{chart_id}")
        assert rv.status_code == 404


class TestChartRestore(InsertChartMixin, SupersetTestCase):
    """Tests for chart restore behaviour (T025)."""

    def test_restore_soft_deleted_chart(self):
        """POST /api/v1/chart/<pk>/restore should make the chart visible again."""
        admin_id = self.get_user("admin").id
        chart = self.insert_chart("restore_test", [admin_id], 1)
        chart_id = chart.id
        self.login(ADMIN_USERNAME)

        # Soft-delete
        self.client.delete(f"/api/v1/chart/{chart_id}")

        # Restore
        rv = self.client.post(f"/api/v1/chart/{chart_id}/restore")
        assert rv.status_code == 200

        # Chart is visible again
        rv = self.client.get(f"/api/v1/chart/{chart_id}")
        assert rv.status_code == 200

    def test_restore_nonexistent_chart_returns_404(self):
        """POST /api/v1/chart/99999/restore should return 404."""
        self.login(ADMIN_USERNAME)
        rv = self.client.post("/api/v1/chart/99999/restore")
        assert rv.status_code == 404

    def test_restore_active_chart_returns_404(self):
        """POST /api/v1/chart/<pk>/restore on an active chart should return 404."""
        admin_id = self.get_user("admin").id
        chart = self.insert_chart("active_restore_test", [admin_id], 1)
        chart_id = chart.id
        self.login(ADMIN_USERNAME)

        # Restore without deleting first — should 404
        rv = self.client.post(f"/api/v1/chart/{chart_id}/restore")
        assert rv.status_code == 404
