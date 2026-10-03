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
"""Integration tests for chart soft-delete and restore."""

from datetime import datetime, timedelta
from typing import Any
from unittest.mock import patch

from sqlalchemy.exc import SQLAlchemyError

from superset import security_manager
from superset.commands.deletion_retention.force_purge import ForcePurgeCommand
from superset.connectors.sqla.models import SqlaTable
from superset.constants import SKIP_VISIBILITY_FILTER_CLASSES
from superset.extensions import db
from superset.models.core import Database
from superset.models.dashboard import Dashboard, dashboard_slices
from superset.models.slice import Slice
from superset.reports.models import (
    ReportCreationMethod,
    ReportSchedule,
    ReportScheduleType,
)
from superset.utils import json
from tests.integration_tests.base_tests import subjects_from_users, SupersetTestCase
from tests.integration_tests.conftest import with_feature_flags
from tests.integration_tests.constants import (
    ADMIN_USERNAME,
    ALPHA_USERNAME,
    GAMMA_USERNAME,
)
from tests.integration_tests.insert_chart_mixin import InsertChartMixin


def _hard_delete_chart(chart_id: int) -> None:
    """Hard-delete a chart row regardless of soft-delete state."""
    row = (
        db.session.query(Slice)
        .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {Slice}})
        .filter(Slice.id == chart_id)
        .one_or_none()
    )
    if row:
        db.session.delete(row)
        db.session.commit()


def _hard_delete_dashboard_for_charts_test(dashboard_id: int) -> None:
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


class TestChartSoftDelete(InsertChartMixin, SupersetTestCase):
    """Tests for chart soft-delete behaviour (T013, T016)."""

    @with_feature_flags(SOFT_DELETE=True)
    def test_delete_chart_soft_deletes(self) -> None:
        """DELETE /api/v1/chart/<pk> sets deleted_at instead of removing."""
        admin_id = self.get_user("admin").id
        chart = self.insert_chart("soft_delete_test", [admin_id], 1)
        chart_id = chart.id
        self.login(ADMIN_USERNAME)

        rv = self.client.delete(f"/api/v1/chart/{chart_id}")
        assert rv.status_code == 200

        # Row still exists in DB with deleted_at set
        row = (
            db.session.query(Slice)
            .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {Slice}})
            .filter(Slice.id == chart_id)
            .one_or_none()
        )
        assert row is not None
        assert row.deleted_at is not None

        # Cleanup
        _hard_delete_chart(chart_id)

    @with_feature_flags(SOFT_DELETE=True)
    def test_soft_deleted_chart_excluded_from_get(self) -> None:
        """GET /api/v1/chart/<pk> returns 404 for a soft-deleted chart."""
        admin_id = self.get_user("admin").id
        chart = self.insert_chart("invisible_chart", [admin_id], 1)
        chart_id = chart.id
        self.login(ADMIN_USERNAME)

        self.client.delete(f"/api/v1/chart/{chart_id}")
        rv = self.client.get(f"/api/v1/chart/{chart_id}")
        assert rv.status_code == 404

        # Cleanup
        _hard_delete_chart(chart_id)

    @with_feature_flags(SOFT_DELETE=True)
    def test_soft_deleted_chart_excluded_from_list(self) -> None:
        """GET /api/v1/chart/ should not include soft-deleted charts."""
        admin_id = self.get_user("admin").id
        chart = self.insert_chart("listed_then_deleted", [admin_id], 1)
        chart_id = chart.id
        self.login(ADMIN_USERNAME)

        self.client.delete(f"/api/v1/chart/{chart_id}")
        rv = self.client.get("/api/v1/chart/")
        data = json.loads(rv.data)
        chart_ids = [c["id"] for c in data["result"]]
        assert chart_id not in chart_ids

        # Cleanup
        _hard_delete_chart(chart_id)

    @with_feature_flags(SOFT_DELETE=True)
    def test_soft_deleted_chart_included_in_list_when_requested(self) -> None:
        """GET /api/v1/chart/ with chart_deleted_state=include returns deleted charts."""  # noqa: E501
        admin_id = self.get_user("admin").id
        chart = self.insert_chart("listed_with_deleted", [admin_id], 1)
        chart_id = chart.id
        self.login(ADMIN_USERNAME)

        self.client.delete(f"/api/v1/chart/{chart_id}")

        rison_query = "(filters:!((col:id,opr:chart_deleted_state,value:include)))"
        rv = self.client.get(f"/api/v1/chart/?q={rison_query}")
        assert rv.status_code == 200

        data = json.loads(rv.data)
        deleted_row = next(
            (row for row in data["result"] if row["id"] == chart_id),
            None,
        )
        assert deleted_row is not None
        assert deleted_row["deleted_at"] is not None

        # Cleanup
        _hard_delete_chart(chart_id)

    @with_feature_flags(SOFT_DELETE=True)
    def test_only_filter_returns_only_soft_deleted_charts(self) -> None:
        """chart_deleted_state=only excludes live rows and returns only deleted ones."""
        admin_id = self.get_user("admin").id
        live_chart = self.insert_chart("only_live", [admin_id], 1)
        deleted_chart = self.insert_chart("only_deleted", [admin_id], 1)
        live_id = live_chart.id
        deleted_id = deleted_chart.id
        self.login(ADMIN_USERNAME)

        self.client.delete(f"/api/v1/chart/{deleted_id}")

        rison_query = "(filters:!((col:id,opr:chart_deleted_state,value:only)))"
        rv = self.client.get(f"/api/v1/chart/?q={rison_query}")
        assert rv.status_code == 200

        data = json.loads(rv.data)
        returned_ids = {row["id"] for row in data["result"]}
        assert deleted_id in returned_ids
        assert live_id not in returned_ids

        # Cleanup
        _hard_delete_chart(live_id)
        _hard_delete_chart(deleted_id)

    @with_feature_flags(SOFT_DELETE=True)
    def test_deleted_state_list_shows_editor_their_deleted(self) -> None:
        """A non-admin editor can still enumerate their soft-deleted charts.
        Deleted-state scoping mirrors the restore audience, so it must not lock
        editors out of their deleted charts."""
        alpha_id = self.get_user(ALPHA_USERNAME).id
        chart = self.insert_chart("sd_editor_chart", [alpha_id], 1)
        chart_id = chart.id

        chart.deleted_at = datetime(2026, 1, 1, 12, 0, 0)
        db.session.commit()

        self.login(ALPHA_USERNAME)
        rison_query = (
            "(filters:!((col:id,opr:chart_deleted_state,value:only)),page_size:200)"
        )
        rv = self.client.get(f"/api/v1/chart/?q={rison_query}")
        assert rv.status_code == 200
        ids = [c["id"] for c in json.loads(rv.data)["result"]]
        assert chart_id in ids

        # Cleanup
        _hard_delete_chart(chart_id)

    @with_feature_flags(SOFT_DELETE=True)
    def test_deleted_state_list_hides_non_editor_from_read_access_user(self) -> None:
        """A read-access non-editor must not enumerate a chart once it is
        soft-deleted.

        Gamma is granted ``datasource_access`` to the chart's dataset, so
        ``ChartFilter`` makes the chart visible to gamma while it is live. After
        soft-delete, the deleted-state list is scoped to the restore audience
        (editors/admins), so gamma — who could never restore it — must not see it
        via ``include`` or ``only``.
        """
        admin_id = self.get_user(ADMIN_USERNAME).id
        chart = self.insert_chart("sd_acl_chart", [admin_id], 1)
        chart_id = chart.id

        table = db.session.query(SqlaTable).get(1)
        gamma_role = security_manager.find_role("Gamma")
        pvm = security_manager.add_permission_view_menu("datasource_access", table.perm)
        gamma_role.permissions.append(pvm)
        db.session.commit()

        try:
            # Precondition: gamma can see the chart while it is live.
            self.login(GAMMA_USERNAME)
            rv = self.client.get("/api/v1/chart/?q=(page_size:200)")
            assert chart_id in [c["id"] for c in json.loads(rv.data)["result"]], (
                "precondition: gamma should see the live chart via datasource access"
            )

            # Soft-delete directly (avoids a mid-test re-login to admin).
            reloaded = (
                db.session.query(Slice)
                .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {Slice}})
                .filter(Slice.id == chart_id)
                .one()
            )
            reloaded.deleted_at = datetime(2026, 1, 1, 12, 0, 0)
            db.session.commit()

            # Gamma must not see the soft-deleted chart in either mode.
            for value in ("include", "only"):
                rison_query = (
                    f"(filters:!((col:id,opr:chart_deleted_state,value:{value})),"
                    "page_size:200)"
                )
                rv = self.client.get(f"/api/v1/chart/?q={rison_query}")
                assert rv.status_code == 200
                ids = [c["id"] for c in json.loads(rv.data)["result"]]
                assert chart_id not in ids, (
                    "read-access non-editor must not enumerate a soft-deleted "
                    f"chart via chart_deleted_state={value}"
                )
        finally:
            pvm = security_manager.find_permission_view_menu(
                "datasource_access", table.perm
            )
            if pvm:
                security_manager.del_permission_role(gamma_role, pvm)
            db.session.commit()
            _hard_delete_chart(chart_id)

    @with_feature_flags(SOFT_DELETE=True)
    def test_delete_already_soft_deleted_chart_returns_404(self) -> None:
        """DELETE on an already soft-deleted chart returns 404 (FR-008)."""
        admin_id = self.get_user("admin").id
        chart = self.insert_chart("double_delete_test", [admin_id], 1)
        chart_id = chart.id
        self.login(ADMIN_USERNAME)

        rv = self.client.delete(f"/api/v1/chart/{chart_id}")
        assert rv.status_code == 200
        rv = self.client.delete(f"/api/v1/chart/{chart_id}")
        assert rv.status_code == 404

        # Cleanup
        _hard_delete_chart(chart_id)

    @with_feature_flags(SOFT_DELETE=True)
    def test_delete_chart_blocked_when_report_references_it(self) -> None:
        """DELETE /api/v1/chart/<id> returns 422 when a report references it.

        Pins down the existing API protection in `DeleteChartCommand.validate()`:
        when *any* `report_schedule` row references the chart — active or
        paused; `ReportScheduleDAO.find_by_chart_ids` has no active-only
        predicate — the validation raises `ChartDeleteFailedReportsExistError`
        *before* `ChartDAO.delete()` is invoked, so no soft-delete routing
        happens. This is the contract soft-delete inherits from the
        pre-existing API; the validate/commit race and flag-toggle windows it
        cannot close are handled by the defensive guard in
        `commands/report/execute.py:_get_url`.
        """
        admin_id = self.get_user("admin").id
        chart = self.insert_chart("blocked_by_report_test", [admin_id], 1)
        chart_id = chart.id

        report = ReportSchedule(
            type=ReportScheduleType.REPORT,
            name="blocking_report_for_chart_delete",
            description="Report that should block chart deletion",
            crontab="0 9 * * *",
            chart=chart,
            creation_method=ReportCreationMethod.ALERTS_REPORTS,
        )
        db.session.add(report)
        db.session.commit()
        report_id = report.id

        self.login(ADMIN_USERNAME)

        rv = self.client.delete(f"/api/v1/chart/{chart_id}")
        assert rv.status_code == 422
        body = json.loads(rv.data)
        assert "is used by alerts or reports" in body.get("message", "")
        assert "blocking_report_for_chart_delete" in body.get("message", "")

        # Confirm the chart was NOT soft-deleted (deleted_at remains NULL).
        row = (
            db.session.query(Slice)
            .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {Slice}})
            .filter(Slice.id == chart_id)
            .one()
        )
        assert row.deleted_at is None

        # Cleanup
        db.session.delete(
            db.session.query(ReportSchedule)
            .filter(ReportSchedule.id == report_id)
            .one()
        )
        db.session.commit()
        _hard_delete_chart(chart_id)


class TestChartRestore(InsertChartMixin, SupersetTestCase):
    """Tests for chart restore behaviour (T025)."""

    @with_feature_flags(SOFT_DELETE=True)
    def test_restore_soft_deleted_chart(self) -> None:
        """POST /api/v1/chart/<uuid>/restore makes the chart visible again."""
        admin_id = self.get_user("admin").id
        chart = self.insert_chart("restore_test", [admin_id], 1)
        chart_id = chart.id
        chart_uuid = str(chart.uuid)
        self.login(ADMIN_USERNAME)

        self.client.delete(f"/api/v1/chart/{chart_id}")
        rv = self.client.post(f"/api/v1/chart/{chart_uuid}/restore")
        assert rv.status_code == 200

        rv = self.client.get(f"/api/v1/chart/{chart_id}")
        assert rv.status_code == 200

        # Cleanup
        _hard_delete_chart(chart_id)

    @with_feature_flags(SOFT_DELETE=True)
    def test_restore_failure_returns_422(self) -> None:
        """A failure during restore surfaces as a clean 422 via the
        ``ChartRestoreFailedError`` handler rather than an unhandled 500.

        ``RestoreChartCommand.run`` wraps the restore in ``@transaction``
        and rethrows ``ChartRestoreFailedError`` on any underlying
        SQLAlchemy error; this pins that the endpoint maps it to 422.
        """
        from unittest.mock import patch

        from superset.commands.chart.exceptions import (
            ChartRestoreFailedError,
        )

        admin_id = self.get_user("admin").id
        chart = self.insert_chart("restore_fail_test", [admin_id], 1)
        chart_id = chart.id
        chart_uuid = str(chart.uuid)
        self.login(ADMIN_USERNAME)
        self.client.delete(f"/api/v1/chart/{chart_id}")

        with patch(
            "superset.commands.chart.restore.RestoreChartCommand.run",
            side_effect=ChartRestoreFailedError(),
        ):
            rv = self.client.post(f"/api/v1/chart/{chart_uuid}/restore")
        assert rv.status_code == 422

        # Cleanup
        _hard_delete_chart(chart_id)

    @with_feature_flags(SOFT_DELETE=True)
    def test_restore_nonexistent_chart_returns_404(self) -> None:
        """POST /api/v1/chart/<uuid>/restore returns 404 for unknown UUID."""
        self.login(ADMIN_USERNAME)
        rv = self.client.post(
            "/api/v1/chart/00000000-0000-0000-0000-000000000000/restore"
        )
        assert rv.status_code == 404

    @with_feature_flags(SOFT_DELETE=True)
    def test_restore_active_chart_returns_404(self) -> None:
        """POST /api/v1/chart/<uuid>/restore on active chart returns 404."""
        admin_id = self.get_user("admin").id
        chart = self.insert_chart("active_restore_test", [admin_id], 1)
        chart_id = chart.id
        chart_uuid = str(chart.uuid)
        self.login(ADMIN_USERNAME)

        rv = self.client.post(f"/api/v1/chart/{chart_uuid}/restore")
        assert rv.status_code == 404

        # Cleanup
        _hard_delete_chart(chart_id)

    @with_feature_flags(SOFT_DELETE=True)
    def test_restore_uses_can_write_permission(self) -> None:
        """Non-admin editor with ``can_write_Chart`` can hit the restore
        endpoint.

        Pins the permission contract: ``method_permission_name`` must map
        ``restore`` to ``write`` so FAB's ``@protect`` resolves the gate to
        ``can_write_Chart`` (which Alpha already carries), not the implicit
        fallback ``can_restore_Chart`` (which no standard role carries).

        Without the mapping FAB defaults to ``can_<method>_<class>`` and
        every non-admin would get 403 here — admins bypass FAB permission
        checks entirely, so the admin-authed restore tests above don't
        exercise the mapping.
        """
        alpha = self.get_user(ALPHA_USERNAME)
        chart = self.insert_chart("restore_perm_test", [alpha.id], 1)
        chart_id = chart.id
        chart_uuid = str(chart.uuid)

        self.login(ALPHA_USERNAME)
        rv = self.client.delete(f"/api/v1/chart/{chart_id}")
        assert rv.status_code == 200, (
            f"Alpha editor soft-delete failed: {rv.status_code} {rv.data!r}"
        )

        rv = self.client.post(f"/api/v1/chart/{chart_uuid}/restore")
        assert rv.status_code == 200, (
            f"Expected 200 from Alpha editor restore (can_write_Chart), got "
            f"{rv.status_code}: {rv.data!r}. If 403, "
            "method_permission_name is missing 'restore': 'write'."
        )

        # Cleanup
        _hard_delete_chart(chart_id)

    @with_feature_flags(SOFT_DELETE=True)
    def test_restore_chart_reattaches_to_dashboards(self) -> None:
        """Soft-deleting a chart preserves dashboard_slices junction rows;
        restore makes the chart reappear in its dashboards automatically.

        This is the positive test that pins down the SIP's "no cascade"
        contract and the corrected commit ``feat(soft-delete): preserve
        dashboard_slices on chart soft-delete (MissingChart handles UI)``.
        Soft-delete leaves the junction intact so:

          - dashboards continue to render the chart slot (frontend uses
            ``MissingChart`` placeholder while the chart is hidden via the
            visibility filter)
          - on restore the chart is automatically a member of every
            dashboard it was a member of before, with no manual
            re-attachment step
        """
        admin = self.get_user("admin")
        admin_id = admin.id

        chart = self.insert_chart("reattach_test_chart", [admin_id], 1)
        chart_id = chart.id
        chart_uuid = str(chart.uuid)

        dashboard = Dashboard(
            dashboard_title="reattach_test_dashboard",
            slug="slug_reattach_test",
            editors=subjects_from_users([admin]),
            published=True,
        )
        dashboard.slices = [chart]
        db.session.add(dashboard)
        db.session.commit()
        dashboard_id = dashboard.id

        # Sanity: the junction row exists
        junction_count = (
            db.session.query(dashboard_slices)
            .filter(
                dashboard_slices.c.dashboard_id == dashboard_id,
                dashboard_slices.c.slice_id == chart_id,
            )
            .count()
        )
        assert junction_count == 1, "junction row should exist after dashboard creation"

        self.login(ADMIN_USERNAME)

        # Soft-delete the chart
        rv = self.client.delete(f"/api/v1/chart/{chart_id}")
        assert rv.status_code == 200

        # The junction row is preserved (no cascade)
        junction_count_after_delete = (
            db.session.query(dashboard_slices)
            .filter(
                dashboard_slices.c.dashboard_id == dashboard_id,
                dashboard_slices.c.slice_id == chart_id,
            )
            .count()
        )
        assert junction_count_after_delete == 1, (
            "junction row should remain intact on chart soft-delete; "
            "MissingChart placeholder handles the UI gap"
        )

        # The dashboard's loaded `slices` collection no longer includes the
        # soft-deleted chart (the global visibility filter applies to
        # relationship loads via `with_loader_criteria(..., include_aliases=True)`).
        db.session.expire_all()
        dashboard_after_delete = (
            db.session.query(Dashboard).filter(Dashboard.id == dashboard_id).one()
        )
        assert chart_id not in [s.id for s in dashboard_after_delete.slices], (
            "soft-deleted chart should be filtered out of dashboard.slices "
            "by the visibility-filter listener"
        )

        # Restore the chart
        rv = self.client.post(f"/api/v1/chart/{chart_uuid}/restore")
        assert rv.status_code == 200

        # The chart automatically reappears in the dashboard — junction row
        # was preserved, so no manual reattach was needed.
        db.session.expire_all()
        dashboard_after_restore = (
            db.session.query(Dashboard).filter(Dashboard.id == dashboard_id).one()
        )
        assert chart_id in [s.id for s in dashboard_after_restore.slices], (
            "restored chart should reappear in dashboard.slices automatically; "
            "the junction row was never removed by soft-delete"
        )

        # Cleanup
        _hard_delete_dashboard_for_charts_test(dashboard_id)
        _hard_delete_chart(chart_id)

    @with_feature_flags(SOFT_DELETE=True)
    def test_restore_chart_by_non_admin_editor(self) -> None:
        """Non-admin editors can restore their soft-deleted charts.

        The unit-level restore command tests mock security; this
        integration test exercises the FAB security wiring end-to-end
        so a future change that breaks the editor check on a non-admin
        path can't slip through.
        """
        alpha = self.get_user(ALPHA_USERNAME)
        alpha_id = alpha.id

        chart = self.insert_chart("alpha_editable_chart", [alpha_id], 1)
        chart_id = chart.id
        chart_uuid = str(chart.uuid)

        self.login(ALPHA_USERNAME)
        rv = self.client.delete(f"/api/v1/chart/{chart_id}")
        assert rv.status_code == 200

        rv = self.client.post(f"/api/v1/chart/{chart_uuid}/restore")
        assert rv.status_code == 200, rv.data

        db.session.expire_all()
        restored = db.session.query(Slice).filter(Slice.id == chart_id).one_or_none()
        assert restored is not None
        assert restored.deleted_at is None

        # Cleanup
        _hard_delete_chart(chart_id)


class TestDeletedRecencyAndHumanized(InsertChartMixin, SupersetTestCase):
    """The archive's time filter and displayed age both use the server clock.

    Self-contained: builds its own database + dataset rather than assuming
    the example fixtures, so it runs on a bare schema.
    """

    def setUp(self) -> None:
        super().setUp()
        self._db = Database(
            database_name="recency_probe_db", sqlalchemy_uri="sqlite://"
        )
        db.session.add(self._db)
        db.session.flush()
        self._table = SqlaTable(
            table_name="recency_probe_tbl", database=self._db, schema=None
        )
        db.session.add(self._table)
        db.session.commit()
        self._datasource_id = self._table.id

    def tearDown(self) -> None:
        db.session.query(SqlaTable).filter(SqlaTable.id == self._datasource_id).delete()
        db.session.query(Database).filter(Database.id == self._db.id).delete()
        db.session.commit()
        super().tearDown()

    @with_feature_flags(SOFT_DELETE=True)
    def test_recency_filter_windows_on_the_clock_that_stamped_the_column(
        self,
    ) -> None:
        """chart_deleted_recency keeps rows newer than N days, server-local.

        The preset used to arrive as an absolute client-UTC cutoff compared
        against the naive-local column, which shifted the window by the
        server's UTC offset. Sending a day count and resolving it here, with
        the same datetime.now() that stamped deleted_at, cannot disagree with
        the column no matter the deployment timezone.
        """
        admin_id = self.get_user("admin").id
        recent = self.insert_chart("recency_recent", [admin_id], self._datasource_id)
        old = self.insert_chart("recency_old", [admin_id], self._datasource_id)
        recent_id, old_id = recent.id, old.id
        recent.deleted_at = datetime.now() - timedelta(days=2)
        old.deleted_at = datetime.now() - timedelta(days=45)
        db.session.commit()
        self.login(ADMIN_USERNAME)
        try:
            rison_query = (
                "(filters:!((col:id,opr:chart_deleted_state,value:only),"
                "(col:deleted_at,opr:chart_deleted_recency,value:7)),page_size:200)"
            )
            rv = self.client.get(f"/api/v1/chart/?q={rison_query}")
            assert rv.status_code == 200, rv.data
            ids = {row["id"] for row in json.loads(rv.data)["result"]}
            assert recent_id in ids
            assert old_id not in ids

            wide = rison_query.replace("value:7", "value:90")
            rv = self.client.get(f"/api/v1/chart/?q={wide}")
            ids = {row["id"] for row in json.loads(rv.data)["result"]}
            assert {recent_id, old_id} <= ids
        finally:
            _hard_delete_chart(recent_id)
            _hard_delete_chart(old_id)

    @with_feature_flags(SOFT_DELETE=True)
    def test_recency_filter_survives_an_absurdly_large_day_count(self) -> None:
        """A day count beyond timedelta's ~2.7-million-day bound must answer
        200 unfiltered, not 500.

        int() parses arbitrarily large values, so the malformed-value guard
        around it never fires; the OverflowError comes from timedelta (or the
        datetime subtraction) afterwards. A window wider than the datetime
        range keeps every archived row, so unfiltered is also the correct
        answer, matching what every other malformed FAB filter value produces.
        """
        admin_id = self.get_user("admin").id
        chart = self.insert_chart("recency_overflow", [admin_id], self._datasource_id)
        chart_id = chart.id
        chart.deleted_at = datetime.now() - timedelta(days=2)
        db.session.commit()
        self.login(ADMIN_USERNAME)
        try:
            rison_query = (
                "(filters:!((col:id,opr:chart_deleted_state,value:only),"
                "(col:deleted_at,opr:chart_deleted_recency,"
                "value:999999999999999999999)),page_size:200)"
            )
            rv = self.client.get(f"/api/v1/chart/?q={rison_query}")
            assert rv.status_code == 200, rv.data
            ids = {row["id"] for row in json.loads(rv.data)["result"]}
            assert chart_id in ids
        finally:
            _hard_delete_chart(chart_id)

    @with_feature_flags(SOFT_DELETE=True)
    def test_archived_age_is_humanized_by_the_server(self) -> None:
        """Rows carry deleted_at_delta_humanized so no client parses the raw
        naive-local timestamp (the UI used to parse it as UTC)."""
        admin_id = self.get_user("admin").id
        chart = self.insert_chart("recency_humanized", [admin_id], self._datasource_id)
        chart_id = chart.id
        # An extra hour keeps the assertion off the day boundary: MySQL
        # DATETIME(0) *rounds* fractional seconds (up to +0.5s), so an exact
        # now()-10d stamp can read back a hair under 10 days and humanize
        # floors it to "9 days ago" — a coin-flip dialect flake.
        chart.deleted_at = datetime.now() - timedelta(days=10, hours=1)
        db.session.commit()
        self.login(ADMIN_USERNAME)
        try:
            rison_query = (
                "(filters:!((col:id,opr:chart_deleted_state,value:only)),page_size:200)"
            )
            rv = self.client.get(f"/api/v1/chart/?q={rison_query}")
            row = next(r for r in json.loads(rv.data)["result"] if r["id"] == chart_id)
            assert row["deleted_at_delta_humanized"] == "10 days ago"
            # The raw value stays for API consumers; only the display moved.
            assert row["deleted_at"] is not None
        finally:
            _hard_delete_chart(chart_id)


class TestChartArchiveListing(InsertChartMixin, SupersetTestCase):
    """Recently-Deleted view listing (sc-111760, T017): ``deleted_at``
    ordering and a deletion-time cutoff filter work at the SQL layer and
    compose with the ``chart_deleted_state`` filter; the restore gate holds
    for a non-owner."""

    def setUp(self) -> None:
        super().setUp()
        self._made_charts: list[int] = []

    def insert_chart(self, *args: Any, **kwargs: Any) -> Slice:
        """Track every fixture so tearDown can remove it."""
        chart = super().insert_chart(*args, **kwargs)
        self._made_charts.append(chart.id)
        return chart

    def tearDown(self) -> None:
        """Remove every fixture this class created, however the test ended.

        These fixtures are soft-deleted with ``deleted_at`` values years in the
        past, which makes them eligible for the retention purge. One left
        behind by a failed assertion is picked up and counted by an unrelated
        suite's global purge run, so cleanup cannot depend on a test reaching
        its final line.
        """
        for chart_id in self._made_charts:
            _hard_delete_chart(chart_id)
        super().tearDown()

    @with_feature_flags(SOFT_DELETE=True)
    def test_archive_list_orders_by_deleted_at(self) -> None:
        """``order_column:deleted_at`` sorts archived charts by deletion time
        (SQL-layer ordering, not merely field presence)."""
        admin_id = self.get_user("admin").id
        older = self.insert_chart("arch_order_older", [admin_id], 1)
        newer = self.insert_chart("arch_order_newer", [admin_id], 1)
        older_id, newer_id = older.id, newer.id
        older.deleted_at = datetime(2026, 1, 1, 12, 0, 0)
        newer.deleted_at = datetime(2026, 3, 1, 12, 0, 0)
        db.session.commit()
        self.login(ADMIN_USERNAME)

        rison_query = (
            "(filters:!((col:id,opr:chart_deleted_state,value:only)),"
            "order_column:deleted_at,order_direction:desc,page_size:200)"
        )
        rv = self.client.get(f"/api/v1/chart/?q={rison_query}")
        assert rv.status_code == 200
        ids = [c["id"] for c in json.loads(rv.data)["result"]]
        assert older_id in ids
        assert newer_id in ids
        # The more-recently-deleted chart sorts ahead of the older one.
        assert ids.index(newer_id) < ids.index(older_id)

        # Cleanup
        _hard_delete_chart(older_id)
        _hard_delete_chart(newer_id)

    @with_feature_flags(SOFT_DELETE=True)
    def test_archive_list_filters_by_deleted_at_cutoff(self) -> None:
        """A ``deleted_at`` ``gt`` cutoff narrows the archive and composes with
        the deleted-state filter."""
        admin_id = self.get_user("admin").id
        old = self.insert_chart("arch_cut_old", [admin_id], 1)
        recent = self.insert_chart("arch_cut_recent", [admin_id], 1)
        old_id, recent_id = old.id, recent.id
        old.deleted_at = datetime(2026, 1, 1, 12, 0, 0)
        recent.deleted_at = datetime(2026, 6, 1, 12, 0, 0)
        db.session.commit()
        self.login(ADMIN_USERNAME)

        rison_query = (
            "(filters:!("
            "(col:id,opr:chart_deleted_state,value:only),"
            "(col:deleted_at,opr:gt,value:'2026-03-01T00:00:00')"
            "),page_size:200)"
        )
        rv = self.client.get(f"/api/v1/chart/?q={rison_query}")
        assert rv.status_code == 200
        ids = [c["id"] for c in json.loads(rv.data)["result"]]
        assert recent_id in ids
        assert old_id not in ids

        # Cleanup
        _hard_delete_chart(old_id)
        _hard_delete_chart(recent_id)

    @with_feature_flags(SOFT_DELETE=True)
    def test_archive_restore_blocked_for_non_owner(self) -> None:
        """A non-owner (Gamma) cannot restore another user's archived chart —
        the restore gate is owner/admin only (SC-003)."""
        admin_id = self.get_user(ADMIN_USERNAME).id
        chart = self.insert_chart("arch_rbac_chart", [admin_id], 1)
        chart_id = chart.id
        chart_uuid = str(chart.uuid)
        chart.deleted_at = datetime(2026, 1, 1, 12, 0, 0)
        db.session.commit()

        self.login(GAMMA_USERNAME)
        rv = self.client.post(f"/api/v1/chart/{chart_uuid}/restore")
        assert rv.status_code in (403, 404), rv.data

        # Cleanup
        _hard_delete_chart(chart_id)

    @with_feature_flags(SOFT_DELETE=True)
    def test_purge_by_owner_permanently_deletes(self) -> None:
        """POST /api/v1/chart/<uuid>/purge hard-deletes an archived chart."""
        admin_id = self.get_user("admin").id
        chart = self.insert_chart("arch_purge_chart", [admin_id], 1)
        chart_id = chart.id
        chart_uuid = str(chart.uuid)
        chart.deleted_at = datetime(2026, 1, 1, 12, 0, 0)
        db.session.commit()

        self.login(ADMIN_USERNAME)
        rv = self.client.post(f"/api/v1/chart/{chart_uuid}/purge")
        assert rv.status_code == 200, rv.data

        # Permanently gone — not even visible with the visibility filter bypassed.
        row = (
            db.session.query(Slice)
            .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {Slice}})
            .filter(Slice.id == chart_id)
            .one_or_none()
        )
        assert row is None

    @with_feature_flags(SOFT_DELETE=True)
    def test_purge_cannot_reach_another_entity_type_sharing_the_uuid(self) -> None:
        """The chart purge route must not delete a dashboard that happens to
        carry the same UUID.

        UUIDs are unique per table but not across them, and the import APIs
        accept caller-supplied UUIDs. The route authorizes a chart, so a purge
        that resolved by UUID alone across every soft-delete model could
        irreversibly delete a dashboard the caller was never checked against.
        """
        admin_id = self.get_user(ADMIN_USERNAME).id
        chart = self.insert_chart("arch_uuid_collision", [admin_id], 1)
        chart_id = chart.id
        shared_uuid = str(chart.uuid)
        chart.deleted_at = datetime(2026, 1, 1, 12, 0, 0)

        # A live dashboard of a different type carrying the same UUID.
        dashboard = Dashboard(
            dashboard_title="arch_uuid_collision_dash",
            slug="arch_uuid_collision_dash",
            editors=subjects_from_users([self.get_user(ADMIN_USERNAME)]),
            published=True,
        )
        dashboard.uuid = chart.uuid
        db.session.add(dashboard)
        db.session.commit()
        dashboard_id = dashboard.id

        try:
            self.login(ADMIN_USERNAME)
            rv = self.client.post(f"/api/v1/chart/{shared_uuid}/purge")
            assert rv.status_code == 200, rv.data

            # The chart is gone...
            assert (
                db.session.query(Slice)
                .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {Slice}})
                .filter(Slice.id == chart_id)
                .one_or_none()
            ) is None
            # ...and the same-UUID dashboard is untouched.
            survivor = (
                db.session.query(Dashboard)
                .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {Dashboard}})
                .filter(Dashboard.id == dashboard_id)
                .one_or_none()
            )
            assert survivor is not None
            assert survivor.deleted_at is None
        finally:
            _hard_delete_chart(chart_id)
            row = (
                db.session.query(Dashboard)
                .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {Dashboard}})
                .filter(Dashboard.id == dashboard_id)
                .one_or_none()
            )
            if row:
                db.session.delete(row)
                db.session.commit()

    @with_feature_flags(SOFT_DELETE=True)
    def test_purge_of_restored_chart_reports_not_found(self) -> None:
        """A chart restored between authorization and purge is not deleted.

        The cascade runs with ``enforce_window=False``, which skips its own
        ``deleted_at`` check, so resolution has to re-assert archived state or
        a live row could be hard-deleted by a purge the caller began while it
        was still in the archive.
        """
        admin_id = self.get_user(ADMIN_USERNAME).id
        chart = self.insert_chart("arch_purge_raced", [admin_id], 1)
        chart_id = chart.id
        chart_uuid = str(chart.uuid)
        chart.deleted_at = datetime(2026, 1, 1, 12, 0, 0)
        db.session.commit()

        self.login(ADMIN_USERNAME)
        try:
            # Stand in for the concurrent restore: the row is archived when
            # validate() authorizes it and live by the time the purge resolves
            # it. Hooking _resolve rather than validate is deliberate --
            # validate() reports through self._model, so a patched validate
            # leaves it None and run() exits at its "cannot happen" guard
            # without ever constructing ForcePurgeCommand, which would make
            # this test green no matter what the purge path did.
            original_resolve = ForcePurgeCommand._resolve  # noqa: SLF001

            def restore_then_resolve(self_: ForcePurgeCommand) -> object:
                db.session.query(Slice).filter(Slice.id == chart_id).update(
                    {"deleted_at": None}
                )
                db.session.commit()
                return original_resolve(self_)

            with patch.object(ForcePurgeCommand, "_resolve", restore_then_resolve):
                rv = self.client.post(f"/api/v1/chart/{chart_uuid}/purge")

            assert rv.status_code == 404, rv.data
            survivor = (
                db.session.query(Slice)
                .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {Slice}})
                .filter(Slice.id == chart_id)
                .one_or_none()
            )
            assert survivor is not None
        finally:
            _hard_delete_chart(chart_id)

    @with_feature_flags(SOFT_DELETE=False)
    def test_purge_is_unreachable_while_soft_delete_is_disabled(self) -> None:
        """An irreversible operation must not outlive the feature it belongs to.

        With the flag off the archive page, the Settings entry and the
        retention task all stand down, so a live purge route would be the one
        way to permanently destroy an object through a feature nobody can see.
        """
        admin_id = self.get_user(ADMIN_USERNAME).id
        chart = self.insert_chart("arch_purge_flagoff", [admin_id], 1)
        chart_id = chart.id
        chart_uuid = str(chart.uuid)
        chart.deleted_at = datetime(2026, 1, 1, 12, 0, 0)
        db.session.commit()

        self.login(ADMIN_USERNAME)
        rv = self.client.post(f"/api/v1/chart/{chart_uuid}/purge")
        assert rv.status_code == 404, rv.data

        survivor = (
            db.session.query(Slice)
            .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {Slice}})
            .filter(Slice.id == chart_id)
            .one_or_none()
        )
        assert survivor is not None

    @with_feature_flags(SOFT_DELETE=False)
    def test_restore_stays_reachable_while_soft_delete_is_disabled(self) -> None:
        """Recovery survives the flag going off, unlike destruction.

        Rows soft-deleted while the flag was on are still soft-deleted after it
        goes off; clearing that state is reversible, so it stays available.
        """
        admin_id = self.get_user(ADMIN_USERNAME).id
        chart = self.insert_chart("arch_restore_flagoff", [admin_id], 1)
        chart_uuid = str(chart.uuid)
        chart.deleted_at = datetime(2026, 1, 1, 12, 0, 0)
        db.session.commit()

        self.login(ADMIN_USERNAME)
        rv = self.client.post(f"/api/v1/chart/{chart_uuid}/restore")
        assert rv.status_code == 200, rv.data

    @with_feature_flags(SOFT_DELETE=True)
    def test_purge_blocked_by_report_does_not_report_success(self) -> None:
        """A purge the cascade refuses must not answer 200 "OK".

        ``ForcePurgeCommand`` reports a refusal in its result rather than
        raising, so a caller told "permanently deleted" while the row is still
        there would be actively misinformed — and the UI drops the row from
        the archive on that answer.
        """
        admin_id = self.get_user(ADMIN_USERNAME).id
        chart = self.insert_chart("arch_purge_blocked", [admin_id], 1)
        chart_id = chart.id
        chart_uuid = str(chart.uuid)
        report = ReportSchedule(
            type=ReportScheduleType.REPORT,
            name="report_blocking_arch_purge",
            crontab="0 9 * * *",
            chart=chart,
            creation_method=ReportCreationMethod.ALERTS_REPORTS,
        )
        db.session.add(report)
        chart.deleted_at = datetime(2026, 1, 1, 12, 0, 0)
        db.session.commit()
        report_id = report.id

        self.login(ADMIN_USERNAME)
        try:
            rv = self.client.post(f"/api/v1/chart/{chart_uuid}/purge")
            assert rv.status_code != 200, rv.data

            # And the chart really is still there, still archived.
            survivor = (
                db.session.query(Slice)
                .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {Slice}})
                .filter(Slice.id == chart_id)
                .one_or_none()
            )
            assert survivor is not None
            assert survivor.deleted_at is not None
        finally:
            row = (
                db.session.query(ReportSchedule)
                .filter(ReportSchedule.id == report_id)
                .one_or_none()
            )
            if row:
                db.session.delete(row)
                db.session.commit()

    @with_feature_flags(SOFT_DELETE=True)
    def test_purge_blocked_for_non_owner(self) -> None:
        """A non-owner (Gamma) cannot permanently delete another user's archived
        chart — purge is owner/admin only, mirroring restore (SC-003)."""
        admin_id = self.get_user(ADMIN_USERNAME).id
        chart = self.insert_chart("arch_purge_rbac", [admin_id], 1)
        chart_id = chart.id
        chart_uuid = str(chart.uuid)
        chart.deleted_at = datetime(2026, 1, 1, 12, 0, 0)
        db.session.commit()

        self.login(GAMMA_USERNAME)
        rv = self.client.post(f"/api/v1/chart/{chart_uuid}/purge")
        assert rv.status_code in (403, 404), rv.data

        # Cleanup
        _hard_delete_chart(chart_id)

    @with_feature_flags(SOFT_DELETE=True)
    def test_purge_live_chart_returns_404(self) -> None:
        """The purge endpoint only operates on soft-deleted rows; a live chart
        returns 404 (use DELETE to archive first)."""
        admin_id = self.get_user("admin").id
        chart = self.insert_chart("arch_purge_live", [admin_id], 1)
        chart_id = chart.id
        chart_uuid = str(chart.uuid)

        self.login(ADMIN_USERNAME)
        rv = self.client.post(f"/api/v1/chart/{chart_uuid}/purge")
        assert rv.status_code == 404

        # Cleanup
        _hard_delete_chart(chart_id)

    @with_feature_flags(SOFT_DELETE=True)
    def test_purge_database_failure_returns_422(self) -> None:
        """A database failure during the cascade surfaces as a clean 422 (via
        the ``ChartDeleteFailedError`` handler) rather than an unhandled 500 —
        mirroring the restore failure path."""
        admin_id = self.get_user("admin").id
        chart = self.insert_chart("arch_purge_fail", [admin_id], 1)
        chart_id = chart.id
        chart_uuid = str(chart.uuid)
        chart.deleted_at = datetime(2026, 1, 1, 12, 0, 0)
        db.session.commit()
        self.login(ADMIN_USERNAME)

        with patch(
            "superset.commands.deletion_retention.force_purge.ForcePurgeCommand.run",
            side_effect=SQLAlchemyError("boom"),
        ):
            rv = self.client.post(f"/api/v1/chart/{chart_uuid}/purge")
        assert rv.status_code == 422
        # The cause is logged but must NOT reach the client: str(ex) on a
        # driver error carries the failing SQL and bind parameters, and this
        # message travels into a user-facing toast. A stable sentence is the
        # whole answer the caller gets.
        assert b"boom" not in rv.data
        assert b"could not complete the delete" in rv.data

        # Cleanup — the row is still soft-deleted (purge never completed).
        _hard_delete_chart(chart_id)

    @with_feature_flags(SOFT_DELETE=True)
    def test_purge_unexpected_error_is_not_disguised_as_a_422(self) -> None:
        """An unexpected error is not laundered into a client-facing 422.

        The handler catches database and DAO failures, which are real "could
        not delete" answers. A programming error is not the caller's fault and
        must stay a 500, or a bug in the cascade reads to an operator as a
        deliberate refusal.
        """
        admin_id = self.get_user("admin").id
        chart = self.insert_chart("arch_purge_bug", [admin_id], 1)
        chart_id = chart.id
        chart_uuid = str(chart.uuid)
        chart.deleted_at = datetime(2026, 1, 1, 12, 0, 0)
        db.session.commit()
        self.login(ADMIN_USERNAME)

        with patch(
            "superset.commands.deletion_retention.force_purge.ForcePurgeCommand.run",
            side_effect=TypeError("a genuine bug"),
        ):
            rv = self.client.post(f"/api/v1/chart/{chart_uuid}/purge")
        assert rv.status_code == 500, rv.data

        _hard_delete_chart(chart_id)


class TestAuditRequiredOnRestPurge(InsertChartMixin, SupersetTestCase):
    """An end user's irreversible purge must never execute unrecorded."""

    @with_feature_flags(SOFT_DELETE=True)
    def test_rest_purge_refuses_when_the_audit_cannot_be_written(self) -> None:
        """The CLI fails open on audit failure because a shell operator is
        present to see it; a REST principal is not, so the route fails closed
        -- 422, entity untouched, nothing destroyed off the record."""
        admin_id = self.get_user("admin").id
        chart = self.insert_chart("audit_required", [admin_id], 1)
        chart_id = chart.id
        chart_uuid = str(chart.uuid)
        chart.deleted_at = datetime(2026, 1, 1, 12, 0, 0)
        db.session.commit()
        self.login(ADMIN_USERNAME)
        try:
            with patch(
                "superset.commands.deletion_retention.force_purge.audit.write_ahead",
                return_value=None,
            ):
                rv = self.client.post(f"/api/v1/chart/{chart_uuid}/purge")

            assert rv.status_code == 422, rv.data
            assert b"audit" in rv.data
            survivor = (
                db.session.query(Slice)
                .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {Slice}})
                .filter(Slice.id == chart_id)
                .one_or_none()
            )
            assert survivor is not None
        finally:
            _hard_delete_chart(chart_id)
