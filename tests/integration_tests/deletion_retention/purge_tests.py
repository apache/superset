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
"""Integration coverage for the time-based soft-delete purge.

Exercises ``superset.tasks.deletion_retention`` against a real database:
the cascade (M:N joins, owned children, datasource permission, version
shadows), preservation of surviving entities, dry-run, the explicit-delete
guarantee under FK enforcement OFF, and the version-tables-absent no-op.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any
from unittest.mock import MagicMock, patch

import sqlalchemy as sa
from sqlalchemy.sql.dml import Delete

from superset import db, security_manager
from superset.commands.deletion_retention import audit
from superset.commands.deletion_retention.purge_cascade import cascade_hard_delete
from superset.connectors.sqla.models import (
    RLSFilterTables,
    RowLevelSecurityFilter,
    SqlaTable,
)
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.models.user_attributes import UserAttribute
from superset.reports.models import ReportSchedule
from superset.tags.models import ObjectType, Tag, TaggedObject
from superset.tasks.deletion_retention import _purge_impl

from ._base import DeletionRetentionTestBase


def _purge(window: int = 30, dry_run: bool = False) -> dict[str, Any]:
    return _purge_impl(window, dry_run)


class TestSoftDeletePurge(DeletionRetentionTestBase):
    def test_aged_out_purged_in_window_and_active_preserved(self) -> None:
        """Rows past the window are purged; in-window
        soft-deleted and active rows are preserved."""
        aged = self.make_chart("aged")
        recent = self.make_chart("recent")
        active = self.make_chart("active")
        aged_id, recent_id, active_id = aged.id, recent.id, active.id
        self.soft_delete(aged, days_ago=90)
        self.soft_delete(recent, days_ago=5)

        result = _purge(window=30)

        assert result["purged"].get("slices") == 1, result
        assert not self.exists(Slice, aged_id)
        assert self.exists(Slice, recent_id)
        assert self.exists(Slice, active_id)

    def test_window_zero_disables(self) -> None:
        """Window 0 disables the time-based purge."""
        aged = self.make_chart("aged")
        aged_id = aged.id
        self.soft_delete(aged, days_ago=90)

        assert _purge(window=0) == {"skipped": 1}
        assert self.exists(Slice, aged_id)

    def test_dry_run_removes_nothing(self) -> None:
        """Dry-run reports would_purge but deletes nothing."""
        aged = self.make_chart("aged")
        aged_id = aged.id
        self.soft_delete(aged, days_ago=90)

        result = _purge(window=30, dry_run=True)

        assert result["would_purge"].get("slices") == 1, result
        assert self.exists(Slice, aged_id)

    def test_purging_chart_unlinks_live_dashboard_but_keeps_it(self) -> None:
        """Purging a chart removes its dashboard_slices
        rows — including one on a *live* dashboard — but the dashboard and
        other charts survive."""
        chart = self.make_chart("c")
        other = self.make_chart("other")
        chart_id, other_id = chart.id, other.id
        dash = self.make_dashboard("live", slices=[chart, other])
        dash_id = dash.id
        self.soft_delete(chart, days_ago=90)

        _purge(window=30)

        assert not self.exists(Slice, chart_id)
        assert self.exists(Slice, other_id)
        assert self.exists(Dashboard, dash_id)
        remaining = self.count(
            "SELECT count(*) FROM dashboard_slices WHERE slice_id = :i",
            {"i": chart_id},
        )
        assert remaining == 0
        # the live dashboard keeps its link to the surviving chart
        assert (
            self.count(
                "SELECT count(*) FROM dashboard_slices WHERE dashboard_id = :d",
                {"d": dash_id},
            )
            == 1
        )

    def test_purging_dashboard_preserves_its_charts(self) -> None:
        """Purging a dashboard does not remove the
        independently-owned charts it referenced."""
        chart = self.make_chart("kept")
        chart_id = chart.id
        dash = self.make_dashboard("doomed", slices=[chart])
        dash_id = dash.id
        self.soft_delete(dash, days_ago=90)

        _purge(window=30)

        assert not self.exists(Dashboard, dash_id)
        assert self.exists(Slice, chart_id)
        assert (
            self.count(
                "SELECT count(*) FROM dashboard_slices WHERE dashboard_id = :d",
                {"d": dash_id},
            )
            == 0
        )

    def test_purging_dataset_removes_children_and_permission(self) -> None:
        """A dataset's owned columns, metrics, and datasource
        permission are removed with it."""
        dataset = self.make_dataset("withchildren", with_children=True)
        ds_id = dataset.id
        vm_name = security_manager.get_dataset_perm(
            dataset.id, dataset.table_name, dataset.database.database_name
        )
        assert security_manager.find_permission_view_menu(
            "datasource_access", vm_name
        ), "fixture should have created the datasource PVM"
        self.soft_delete(dataset, days_ago=90)

        _purge(window=30)

        assert not self.exists(SqlaTable, ds_id)
        assert (
            self.count(
                "SELECT count(*) FROM table_columns WHERE table_id = :i", {"i": ds_id}
            )
            == 0
        )
        assert (
            self.count(
                "SELECT count(*) FROM sql_metrics WHERE table_id = :i", {"i": ds_id}
            )
            == 0
        )
        assert not security_manager.find_permission_view_menu(
            "datasource_access", vm_name
        )

    def test_restore_race_does_not_remove_dataset_permission(self) -> None:
        """A zero-row conditional parent delete leaves its permission intact."""
        dataset = self.make_dataset("restore_race")
        vm_name = security_manager.get_dataset_perm(
            dataset.id, dataset.table_name, dataset.database.database_name
        )
        self.soft_delete(dataset, days_ago=90)
        session = db.session()
        execute = session.execute

        def lose_parent_delete(statement: Any, *args: Any, **kwargs: Any) -> Any:
            if isinstance(statement, Delete) and statement.table.name == "tables":
                return MagicMock(rowcount=0)
            return execute(statement, *args, **kwargs)

        with patch.object(session, "execute", side_effect=lose_parent_delete):
            result = cascade_hard_delete(
                session,
                dataset,
                enforce_window=True,
                cutoff=datetime.now() - timedelta(days=30),
            )
        session.commit()

        assert result.purged is False
        assert self.exists(SqlaTable, dataset.id)
        assert security_manager.find_permission_view_menu("datasource_access", vm_name)

    def test_dataset_purge_removes_rls_join_but_preserves_rule(self) -> None:
        """RLS M:N rows follow ordinary ORM cleanup; the rule survives."""
        dataset = self.make_dataset("rls")
        rule = RowLevelSecurityFilter(
            name="retention_it_rls",
            clause="1=1",
            filter_type="Regular",
            tables=[dataset],
        )
        db.session.add(rule)
        db.session.commit()
        rule_id, dataset_id = rule.id, dataset.id
        self.soft_delete(dataset, days_ago=90)

        result = _purge(window=30)

        assert result["purged"].get("tables") == 1
        assert db.session.get(RowLevelSecurityFilter, rule_id) is not None
        assert (
            db.session.execute(
                sa.select(sa.func.count())
                .select_from(RLSFilterTables)
                .where(RLSFilterTables.c.table_id == dataset_id)
            ).scalar_one()
            == 0
        )

    def test_report_reference_blocks_chart_purge(self) -> None:
        """Retention preserves the ordinary chart/report deletion guard."""
        chart = self.make_chart("reported")
        report = ReportSchedule(
            type="Report",
            name="retention_it_report",
            crontab="0 0 * * *",
            chart=chart,
        )
        db.session.add(report)
        db.session.commit()
        chart_id, chart_uuid = chart.id, str(chart.uuid)
        self.soft_delete(chart, days_ago=90)

        result = _purge(window=30)

        assert result["blocked_by_reference"] == 1
        assert result["purged"].get("slices", 0) == 0
        assert self.exists(Slice, chart_id)
        assert db.session.get(ReportSchedule, report.id) is not None
        row = (
            db.session.query(audit.PurgeAuditLog)
            .filter_by(entity_uuid=chart_uuid)
            .one()
        )
        assert row.status == audit.STATUS_BLOCKED

    def test_restrictive_fk_blocks_dashboard_without_rewriting_referrer(self) -> None:
        """A welcome-dashboard FK remains authoritative during retention."""
        dashboard = self.make_dashboard("welcome")
        dashboard_id = dashboard.id
        user = self.get_user("admin")
        attribute = (
            db.session.query(UserAttribute).filter_by(user_id=user.id).one_or_none()
        )
        created = attribute is None
        if attribute is None:
            attribute = UserAttribute(user_id=user.id)
            db.session.add(attribute)
        previous_dashboard_id = attribute.welcome_dashboard_id
        attribute.welcome_dashboard_id = dashboard_id
        db.session.commit()
        self.soft_delete(dashboard, days_ago=90)

        try:
            result = _purge(window=30)

            assert result["blocked_by_reference"] == 1
            assert self.exists(Dashboard, dashboard_id)
            db.session.refresh(attribute)
            assert attribute.welcome_dashboard_id == dashboard_id
        finally:
            if created:
                db.session.delete(attribute)
            else:
                attribute.welcome_dashboard_id = previous_dashboard_id
            db.session.commit()

    def test_purging_dataset_leaves_referencing_chart_dangling(self) -> None:
        """A soft-deleted dataset is purged without a dependent guard even
        with a live chart referencing it; the chart is left
        dangling (unchanged), not blocked or rewritten."""
        chart = self.make_chart("dangling", dataset=self.dataset)
        chart_id, ds_id = chart.id, self.dataset.id
        self.soft_delete(self.dataset, days_ago=90)

        _purge(window=30)

        assert not self.exists(SqlaTable, ds_id)
        assert self.exists(Slice, chart_id)
        kept = db.session.query(Slice).filter(Slice.id == chart_id).one()
        assert kept.datasource_id == ds_id  # dangling, unmodified

    def test_tags_removed_on_purge(self) -> None:
        """The entity's tagged_object rows are removed (the
        after_delete tag-cleanup Core bulk-delete skips)."""
        chart = self.make_chart("tagged")
        chart_id = chart.id
        tag = Tag(name="retention_it_tag")
        db.session.add(tag)
        db.session.commit()
        db.session.add(
            TaggedObject(
                tag_id=tag.id, object_id=chart_id, object_type=ObjectType.chart
            )
        )
        db.session.commit()
        self.soft_delete(chart, days_ago=90)

        _purge(window=30)

        assert (
            self.count(
                "SELECT count(*) FROM tagged_object WHERE object_id = :i "
                "AND object_type = 'chart'",
                {"i": chart_id},
            )
            == 0
        )

    def test_soft_delete_and_restore_create_no_version_rows(self) -> None:
        """deleted_at is excluded from versioning: soft-delete and restore are
        state changes, not edits, so (with capture ON) they add no version
        rows. Versioning and deletion are orthogonal — restore is a separate
        state flip, never a version-shadow operation."""
        chart = self.make_chart("orthogonal")
        cid = chart.id
        baseline = self.count(
            "SELECT count(*) FROM slices_version WHERE id = :i", {"i": cid}
        )

        chart.soft_delete()  # state change, not an edit
        db.session.commit()
        after_delete = self.count(
            "SELECT count(*) FROM slices_version WHERE id = :i", {"i": cid}
        )

        chart.restore()  # state flip back, not an edit
        db.session.commit()
        after_restore = self.count(
            "SELECT count(*) FROM slices_version WHERE id = :i", {"i": cid}
        )

        assert after_delete == baseline, "soft-delete must not create a version row"
        assert after_restore == baseline, "restore must not create a version row"

    def test_cascade_with_fk_enforcement_off(self) -> None:
        """The explicit sa.delete cascade, not the database FK cascade,
        does the work. With SQLite FK enforcement OFF, no junction rows are
        orphaned."""
        if db.engine.dialect.name != "sqlite":
            self.skipTest("FK-off probe is SQLite-specific")
        chart = self.make_chart("fkoff")
        chart_id = chart.id
        self.make_dashboard("fkoffdash", slices=[chart])
        self.soft_delete(chart, days_ago=90)

        db.session.execute(sa.text("PRAGMA foreign_keys=OFF"))
        _purge(window=30)

        assert not self.exists(Slice, chart_id)
        assert (
            self.count(
                "SELECT count(*) FROM dashboard_slices WHERE slice_id = :i",
                {"i": chart_id},
            )
            == 0
        )

    def test_version_history_removed_and_shared_tx_preserved(self) -> None:
        """A purged entity's version shadows and scoped
        version_changes are removed and a sole-owner transaction swept, while a
        transaction shared with a surviving entity is preserved."""
        purged = self.make_chart("hist_purged")
        survivor = self.make_chart("hist_survivor")
        purged_id, survivor_id = purged.id, survivor.id
        # shared transaction owns shadow rows for both charts
        self.forge_version_row(Slice, purged_id, tx_id=990001)
        self.forge_version_row(Slice, survivor_id, tx_id=990001)
        # sole-owner transaction for the purged chart
        self.forge_version_row(Slice, purged_id, tx_id=990002)
        self.soft_delete(purged, days_ago=90)

        _purge(window=30)

        # purged entity's history gone
        assert (
            self.count(
                "SELECT count(*) FROM slices_version WHERE id = :i", {"i": purged_id}
            )
            == 0
        )
        assert (
            self.count(
                "SELECT count(*) FROM version_changes WHERE entity_id = :i "
                "AND entity_kind = 'chart'",
                {"i": purged_id},
            )
            == 0
        )
        # sole-owner transaction swept; shared transaction kept (survivor)
        assert (
            self.count("SELECT count(*) FROM version_transaction WHERE id = 990002", {})
            == 0
        )
        assert (
            self.count("SELECT count(*) FROM version_transaction WHERE id = 990001", {})
            == 1
        )
        # the survivor's shadow row on the shared transaction is preserved
        # (capture-on may add a baseline row too, so assert on the forged one)
        assert (
            self.count(
                "SELECT count(*) FROM slices_version WHERE id = :i "
                "AND transaction_id = 990001",
                {"i": survivor_id},
            )
            == 1
        )

    def test_version_tables_absent_noop(self) -> None:
        """When the version tables are absent the
        version cascade no-ops cleanly and the entity is still purged."""
        chart = self.make_chart("noversion")
        chart_id = chart.id
        self.soft_delete(chart, days_ago=90)

        with patch(
            "superset.commands.deletion_retention.purge_cascade."
            "_version_tables_present",
            return_value=False,
        ):
            result = _purge(window=30)

        assert result["purged"].get("slices") == 1
        assert not self.exists(Slice, chart_id)
