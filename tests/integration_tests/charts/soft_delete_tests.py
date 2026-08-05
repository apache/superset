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

from datetime import datetime

from superset import security_manager
from superset.connectors.sqla.models import SqlaTable
from superset.constants import SKIP_VISIBILITY_FILTER_CLASSES
from superset.extensions import db
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
        assert "associated alerts or reports" in body.get("message", "").lower() or (
            "associated" in body.get("message", "").lower()
            and "report" in body.get("message", "").lower()
        )
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
