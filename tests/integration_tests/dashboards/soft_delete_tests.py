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
"""Integration tests for dashboard soft-delete and restore (sc-103157)."""

from superset.extensions import db
from superset.models.dashboard import Dashboard
from superset.models.helpers import SKIP_VISIBILITY_FILTER
from superset.utils import json
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME


def _hard_delete_dashboard(dashboard_id: int) -> None:
    """Hard-delete a dashboard row regardless of soft-delete state."""
    row = (
        db.session.query(Dashboard)
        .execution_options(**{SKIP_VISIBILITY_FILTER: True})
        .filter(Dashboard.id == dashboard_id)
        .one_or_none()
    )
    if row:
        db.session.delete(row)
        db.session.commit()


class TestDashboardSoftDelete(SupersetTestCase):
    """Tests for dashboard soft-delete behaviour (T014, T017)."""

    def _create_dashboard(self, title: str = "soft_delete_test") -> Dashboard:
        admin = self.get_user("admin")
        dashboard = Dashboard(
            dashboard_title=title,
            slug=f"slug_{title}",
            owners=[admin],
            published=True,
        )
        db.session.add(dashboard)
        db.session.commit()
        return dashboard

    def test_delete_dashboard_soft_deletes(self):
        """DELETE should set deleted_at instead of removing the row."""
        dashboard = self._create_dashboard("sd_test_1")
        dashboard_id = dashboard.id
        self.login(ADMIN_USERNAME)

        rv = self.client.delete(f"/api/v1/dashboard/{dashboard_id}")
        assert rv.status_code == 200

        row = (
            db.session.query(Dashboard)
            .execution_options(**{SKIP_VISIBILITY_FILTER: True})
            .filter(Dashboard.id == dashboard_id)
            .one_or_none()
        )
        assert row is not None
        assert row.deleted_at is not None

        # Cleanup
        _hard_delete_dashboard(dashboard_id)

    def test_soft_deleted_dashboard_excluded_from_list(self):
        """GET /api/v1/dashboard/ should not include soft-deleted."""
        dashboard = self._create_dashboard("sd_list_test")
        dashboard_id = dashboard.id
        self.login(ADMIN_USERNAME)

        self.client.delete(f"/api/v1/dashboard/{dashboard_id}")

        rv = self.client.get("/api/v1/dashboard/")
        data = json.loads(rv.data)
        ids = [d["id"] for d in data["result"]]
        assert dashboard_id not in ids

        # Cleanup
        _hard_delete_dashboard(dashboard_id)


class TestDashboardRestore(SupersetTestCase):
    """Tests for dashboard restore behaviour (T026, T028)."""

    def _create_dashboard(self, title: str = "restore_test") -> Dashboard:
        admin = self.get_user("admin")
        dashboard = Dashboard(
            dashboard_title=title,
            slug=f"slug_{title}",
            owners=[admin],
            published=True,
        )
        db.session.add(dashboard)
        db.session.commit()
        return dashboard

    def test_restore_soft_deleted_dashboard(self):
        """POST /api/v1/dashboard/<pk>/restore makes it visible again."""
        dashboard = self._create_dashboard("restore_sd_test")
        dashboard_id = dashboard.id
        self.login(ADMIN_USERNAME)

        self.client.delete(f"/api/v1/dashboard/{dashboard_id}")
        rv = self.client.post(f"/api/v1/dashboard/{dashboard_id}/restore")
        assert rv.status_code == 200

        rv = self.client.get(f"/api/v1/dashboard/{dashboard_id}")
        assert rv.status_code == 200

        # Cleanup
        _hard_delete_dashboard(dashboard_id)

    def test_restore_preserves_chart_associations(self):
        """Restoring a dashboard reconnects to its charts (T028)."""
        from superset.models.slice import Slice

        admin = self.get_user("admin")
        dashboard = self._create_dashboard("assoc_test")

        chart = Slice(
            slice_name="assoc_chart",
            viz_type="table",
            datasource_type="table",
            datasource_id=1,
            owners=[admin],
        )
        db.session.add(chart)
        db.session.commit()
        dashboard.slices.append(chart)
        db.session.commit()

        dashboard_id = dashboard.id
        chart_id = chart.id
        self.login(ADMIN_USERNAME)

        self.client.delete(f"/api/v1/dashboard/{dashboard_id}")
        rv = self.client.post(f"/api/v1/dashboard/{dashboard_id}/restore")
        assert rv.status_code == 200

        restored = (
            db.session.query(Dashboard).filter(Dashboard.id == dashboard_id).one()
        )
        chart_ids = [s.id for s in restored.slices]
        assert chart_id in chart_ids

        # Cleanup
        db.session.delete(chart)
        _hard_delete_dashboard(dashboard_id)
