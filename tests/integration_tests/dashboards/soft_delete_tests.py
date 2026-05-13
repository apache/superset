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
from superset.models.helpers import SKIP_VISIBILITY_FILTER_CLASSES
from superset.utils import json
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME


def _hard_delete_dashboard(dashboard_id: int) -> None:
    """Hard-delete a dashboard row regardless of soft-delete state."""
    row = (
        db.session.query(Dashboard)
        .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {Dashboard}})
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
            .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {Dashboard}})
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

    def test_soft_deleted_dashboard_included_in_list_when_requested(self):
        """GET /api/v1/dashboard/ with dashboard_deleted_state=include returns deleted dashboards."""  # noqa: E501
        dashboard = self._create_dashboard("sd_list_with_deleted")
        dashboard_id = dashboard.id
        self.login(ADMIN_USERNAME)

        self.client.delete(f"/api/v1/dashboard/{dashboard_id}")

        rison_query = "(filters:!((col:id,opr:dashboard_deleted_state,value:include)))"
        rv = self.client.get(f"/api/v1/dashboard/?q={rison_query}")
        assert rv.status_code == 200

        data = json.loads(rv.data)
        deleted_row = next(
            (row for row in data["result"] if row["id"] == dashboard_id),
            None,
        )
        assert deleted_row is not None
        assert deleted_row["deleted_at"] is not None

        # Cleanup
        _hard_delete_dashboard(dashboard_id)

    def test_only_filter_returns_only_soft_deleted_dashboards(self):
        """dashboard_deleted_state=only excludes live rows and returns only deleted ones."""  # noqa: E501
        live_dashboard = self._create_dashboard("only_live_dash")
        deleted_dashboard = self._create_dashboard("only_deleted_dash")
        live_id = live_dashboard.id
        deleted_id = deleted_dashboard.id
        self.login(ADMIN_USERNAME)

        self.client.delete(f"/api/v1/dashboard/{deleted_id}")

        rison_query = "(filters:!((col:id,opr:dashboard_deleted_state,value:only)))"
        rv = self.client.get(f"/api/v1/dashboard/?q={rison_query}")
        assert rv.status_code == 200

        data = json.loads(rv.data)
        returned_ids = {row["id"] for row in data["result"]}
        assert deleted_id in returned_ids
        assert live_id not in returned_ids

        # Cleanup
        _hard_delete_dashboard(live_id)
        _hard_delete_dashboard(deleted_id)

    def test_embedded_dashboard_with_soft_deleted_parent(self):
        """Embedded URL keeps loading after the parent dashboard is soft-deleted.

        The embedded view (`embedded/view.py:embedded`) only reads
        `embedded.allowed_domains` and `embedded.dashboard_id` (FK column,
        not relationship), so it never dereferences the soft-deleted
        Dashboard via `embedded.dashboard`. Iframe still returns 200; the
        frontend's subsequent `/api/v1/dashboard/<id>` fetch returns 404
        cleanly via the visibility filter, and the user sees the standard
        "dashboard not found" UI rather than a 500.

        This pins down the contract documented in pr-readiness.md #8 and
        prevents future changes to either the embedded view or the schema
        from regressing it into a 500.
        """
        from unittest import mock

        from superset.daos.dashboard import EmbeddedDashboardDAO

        dashboard = self._create_dashboard("embedded_soft_delete_test")
        dashboard_id = dashboard.id
        embedded = EmbeddedDashboardDAO.upsert(dashboard, [])
        db.session.flush()
        embedded_uuid = str(embedded.uuid)
        self.login(ADMIN_USERNAME)

        # Soft-delete the parent
        self.client.delete(f"/api/v1/dashboard/{dashboard_id}")

        # The dashboard fetch returns 404 cleanly (visibility filter applies).
        rv = self.client.get(f"/api/v1/dashboard/{dashboard_id}")
        assert rv.status_code == 404, (
            "Soft-deleted dashboard should fetch 404, not 500; got "
            f"{rv.status_code}. Body: {rv.data[:200]!r}"
        )

        # The embedded iframe URL still loads (200) — embedded.dashboard is
        # never dereferenced by the view. Done last because the embedded
        # handler clears the session in CI, which would 401 any follow-up
        # API call.
        with mock.patch.dict(
            "superset.extensions.feature_flag_manager._feature_flags",
            EMBEDDED_SUPERSET=True,
        ):
            rv = self.client.get(f"/embedded/{embedded_uuid}")
        assert rv.status_code == 200, (
            "Embedded view should still load 200 with a soft-deleted parent; "
            f"got {rv.status_code}. Body: {rv.data[:200]!r}"
        )

        # Cleanup: hard-deleting the dashboard cascades to the embedded
        # row via the FK ondelete=CASCADE.
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
        """POST /api/v1/dashboard/<uuid>/restore makes it visible again."""
        dashboard = self._create_dashboard("restore_sd_test")
        dashboard_id = dashboard.id
        dashboard_uuid = str(dashboard.uuid)
        self.login(ADMIN_USERNAME)

        self.client.delete(f"/api/v1/dashboard/{dashboard_id}")
        rv = self.client.post(f"/api/v1/dashboard/{dashboard_uuid}/restore")
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
        dashboard_uuid = str(dashboard.uuid)
        chart_id = chart.id
        self.login(ADMIN_USERNAME)

        self.client.delete(f"/api/v1/dashboard/{dashboard_id}")
        rv = self.client.post(f"/api/v1/dashboard/{dashboard_uuid}/restore")
        assert rv.status_code == 200

        restored = (
            db.session.query(Dashboard).filter(Dashboard.id == dashboard_id).one()
        )
        chart_ids = [s.id for s in restored.slices]
        assert chart_id in chart_ids

        # Cleanup
        db.session.delete(chart)
        _hard_delete_dashboard(dashboard_id)
