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
"""Integration tests for dashboard soft-delete and restore."""

from superset.constants import SKIP_VISIBILITY_FILTER_CLASSES
from superset.extensions import db
from superset.models.dashboard import Dashboard
from superset.utils import json
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME, ALPHA_USERNAME


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

    def test_delete_dashboard_soft_deletes(self) -> None:
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

    def test_soft_deleted_dashboard_excluded_from_list(self) -> None:
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

    def test_soft_deleted_dashboard_included_in_list_when_requested(self) -> None:
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

    def test_only_filter_returns_only_soft_deleted_dashboards(self) -> None:
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

    def test_embedded_dashboard_with_soft_deleted_parent(self) -> None:
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

    def _skip_if_no_partial_index(self) -> None:
        """Skip the test on dialects that fall back to the full unique slug
        constraint.

        The 9e1f3b8c4d2a migration installs a partial unique index on
        ``slug WHERE deleted_at IS NULL`` on PostgreSQL and MySQL 8.0+
        (excluding MariaDB). SQLite and MySQL <8 / MariaDB keep the
        original full constraint, so tests that exercise slug reuse
        across the soft-delete boundary are not meaningful on those
        backends.
        """
        dialect = db.session.bind.dialect.name
        is_mariadb = getattr(db.session.bind.dialect, "is_mariadb", False)
        server_version = db.session.bind.dialect.server_version_info or ()
        partial_index_supported = dialect == "postgresql" or (
            dialect == "mysql" and not is_mariadb and server_version >= (8, 0)
        )
        if not partial_index_supported:
            self.skipTest(
                f"Partial-index slug reuse not supported on {dialect} "
                f"{'(MariaDB)' if is_mariadb else server_version}"
            )

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

    def test_restore_soft_deleted_dashboard(self) -> None:
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

    def test_restore_uses_can_write_permission(self) -> None:
        """Non-admin owner with ``can_write_Dashboard`` can hit the restore
        endpoint.

        Pins the permission contract: ``method_permission_name`` must map
        ``restore`` to ``write`` so FAB's ``@protect`` resolves the gate to
        ``can_write_Dashboard`` (which Alpha already carries), not the
        implicit fallback ``can_restore_Dashboard`` (which no standard role
        carries).

        Without the mapping FAB defaults to ``can_<method>_<class>`` and
        every non-admin would get 403 here — admins bypass FAB permission
        checks entirely, so the admin-authed restore tests above don't
        exercise the mapping.
        """
        alpha = self.get_user(ALPHA_USERNAME)
        dashboard = Dashboard(
            dashboard_title="restore_perm_test",
            slug="slug_restore_perm_test",
            owners=[alpha],
            published=True,
        )
        db.session.add(dashboard)
        db.session.commit()
        dashboard_id = dashboard.id
        dashboard_uuid = str(dashboard.uuid)

        self.login(ALPHA_USERNAME)
        rv = self.client.delete(f"/api/v1/dashboard/{dashboard_id}")
        assert rv.status_code == 200, (
            f"Alpha owner soft-delete failed: {rv.status_code} {rv.data!r}"
        )

        rv = self.client.post(f"/api/v1/dashboard/{dashboard_uuid}/restore")
        assert rv.status_code == 200, (
            f"Expected 200 from Alpha owner restore (can_write_Dashboard), "
            f"got {rv.status_code}: {rv.data!r}. If 403, "
            "method_permission_name is missing 'restore': 'write'."
        )

        # Cleanup
        _hard_delete_dashboard(dashboard_id)

    def test_restore_preserves_chart_associations(self) -> None:
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

    def test_restore_blocked_by_active_slug_twin(self) -> None:
        """Restore returns 422 when another active dashboard now owns the slug.

        With the partial unique index allowing slug reuse during the
        soft-deleted window, a new active dashboard can claim the slug
        of a soft-deleted one. Restoring the original then has to fail
        cleanly rather than producing a unique-index violation at flush
        time. This pins the API contract end-to-end (command → endpoint
        → 422 response).

        The conflict guard runs in application code, so the test exercises
        every dialect — not just those with a partial index.
        """
        shared_slug = "slug_conflict_test"
        admin = self.get_user("admin")

        # First dashboard: created, soft-deleted, awaiting restore.
        first = Dashboard(
            dashboard_title="conflict_first",
            slug=shared_slug,
            owners=[admin],
            published=True,
        )
        db.session.add(first)
        db.session.commit()
        first_id = first.id
        first_uuid = str(first.uuid)

        self.login(ADMIN_USERNAME)
        self.client.delete(f"/api/v1/dashboard/{first_id}")

        # Second dashboard claims the same slug while the first is soft-deleted.
        # This only succeeds on Postgres / MySQL 8+ where the partial index
        # frees the slug; on SQLite / MySQL <8 / MariaDB the full unique
        # constraint would still block this insert.
        self._skip_if_no_partial_index()

        second = Dashboard(
            dashboard_title="conflict_second",
            slug=shared_slug,
            owners=[admin],
            published=True,
        )
        db.session.add(second)
        db.session.commit()
        second_id = second.id

        # Restore of the first dashboard must now fail with a clean 422.
        rv = self.client.post(f"/api/v1/dashboard/{first_uuid}/restore")
        assert rv.status_code == 422
        body = json.loads(rv.data)
        # Surfaces the domain error message, not a database-driver leak.
        assert "slug" in body.get("message", "").lower()

        # First dashboard is still soft-deleted; second is unchanged.
        first_row = (
            db.session.query(Dashboard)
            .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {Dashboard}})
            .filter(Dashboard.id == first_id)
            .one()
        )
        assert first_row.deleted_at is not None

        # Cleanup
        _hard_delete_dashboard(first_id)
        _hard_delete_dashboard(second_id)

    def test_partial_index_allows_multiple_soft_deleted_with_same_slug(self) -> None:
        """On dialects with the partial index, two soft-deleted dashboards can share a slug.

        Verifies the schema-level behaviour: ``CREATE UNIQUE INDEX ...
        WHERE deleted_at IS NULL`` lets soft-deleted rows accumulate
        without colliding. Skipped on SQLite and MySQL <8.0 / MariaDB,
        which keep the original full unique constraint per the migration.
        """  # noqa: E501
        self._skip_if_no_partial_index()

        shared_slug = "slug_partial_index_test"
        admin = self.get_user("admin")

        first = Dashboard(
            dashboard_title="partial_first",
            slug=shared_slug,
            owners=[admin],
            published=True,
        )
        db.session.add(first)
        db.session.commit()
        first_id = first.id

        self.login(ADMIN_USERNAME)
        response = self.client.delete(f"/api/v1/dashboard/{first_id}")
        assert response.status_code == 200, (
            f"Initial soft-delete failed: {response.status_code} {response.data!r}"
        )

        # Second soft-deleted row with the same slug: this is the
        # behaviour the partial index enables.
        second = Dashboard(
            dashboard_title="partial_second",
            slug=shared_slug,
            owners=[admin],
            published=True,
        )
        db.session.add(second)
        db.session.commit()
        second_id = second.id
        self.client.delete(f"/api/v1/dashboard/{second_id}")

        # Both rows exist and both are soft-deleted; the partial index
        # tolerates this state.
        soft_deleted_count = (
            db.session.query(Dashboard)
            .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {Dashboard}})
            .filter(Dashboard.slug == shared_slug, Dashboard.deleted_at.is_not(None))
            .count()
        )
        assert soft_deleted_count == 2

        # Cleanup
        _hard_delete_dashboard(first_id)
        _hard_delete_dashboard(second_id)
