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

from dataclasses import replace
from datetime import datetime, timedelta
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
import sqlalchemy as sa
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import set_committed_value
from sqlalchemy.sql.dml import Delete

from superset import db, security_manager
from superset.commands.deletion_retention import audit
from superset.commands.deletion_retention.purge_cascade import (
    cascade_hard_delete,
    suppress_purge_association_versions,
)
from superset.commands.deletion_retention.purge_policy import (
    get_purge_policy,
    PurgeEntityPolicy,
)
from superset.connectors.sqla.models import (
    RLSFilterTables,
    RowLevelSecurityFilter,
    SqlaTable,
)
from superset.constants import SKIP_VISIBILITY_FILTER_CLASSES
from superset.models.dashboard import Dashboard, dashboard_slices
from superset.models.slice import Slice
from superset.models.user_attributes import UserAttribute
from superset.reports.models import ReportSchedule
from superset.tags.models import ObjectType, Tag, TaggedObject
from superset.tasks import deletion_retention as deletion_retention_task
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

    def test_dry_run_does_not_finalize_pending_audit_rows(self) -> None:
        """A dry run reports; it does not resolve another run's audit state.

        Reconciliation finalizes stale pending rows, which is a durable write.
        An operator sizing up a rollout would otherwise alter the very record
        they are inspecting.
        """
        with patch(
            "superset.tasks.deletion_retention.audit.reconcile_pending"
        ) as reconcile:
            _purge(window=30, dry_run=True)
            assert reconcile.call_count == 0

            # ...and a real run still reconciles.
            _purge(window=30, dry_run=False)
            assert reconcile.call_count == 1

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

    def test_repeated_report_blocker_preserves_counts_and_suppresses_noise(
        self,
    ) -> None:
        chart: Slice = self.make_chart("reported_repeatedly")
        report: ReportSchedule = ReportSchedule(
            type="Report",
            name="retention_it_repeated_report",
            crontab="0 0 * * *",
            chart=chart,
        )
        db.session.add(report)
        db.session.commit()
        chart_uuid: str = str(chart.uuid)
        self.soft_delete(chart, days_ago=90)

        incr: MagicMock
        gauge: MagicMock
        with (
            patch.object(
                deletion_retention_task.stats_logger_manager.instance, "incr"
            ) as incr,
            patch.object(
                deletion_retention_task.stats_logger_manager.instance, "gauge"
            ) as gauge,
        ):
            first_result: dict[str, Any] = _purge(window=30)
            second_result: dict[str, Any] = _purge(window=30)

        assert first_result["blocked_by_reference"] == 1
        assert second_result["blocked_by_reference"] == 1
        assert (
            db.session.query(audit.PurgeAuditLog)
            .filter_by(
                entity_uuid=chart_uuid,
                trigger=audit.TRIGGER_RETENTION,
                status=audit.STATUS_BLOCKED,
            )
            .count()
            == 1
        )
        incr.assert_called_once_with("deletion_retention.blocked_audit_suppressed")
        assert gauge.call_count == 2
        gauge.assert_called_with("deletion_retention.blocked_by_reference", 1)

    def test_blocked_audit_fallback_is_counted_without_changing_task_result(
        self,
    ) -> None:
        chart: Slice = self.make_chart("reported_fallback")
        report: ReportSchedule = ReportSchedule(
            type="Report",
            name="retention_it_fallback_report",
            crontab="0 0 * * *",
            chart=chart,
        )
        db.session.add(report)
        db.session.commit()
        self.soft_delete(chart, days_ago=90)

        incr: MagicMock
        with (
            patch.object(
                audit,
                "finalize_retention_blocked",
                return_value="fallback",
            ),
            patch.object(
                deletion_retention_task.stats_logger_manager.instance, "incr"
            ) as incr,
        ):
            result: dict[str, Any] = _purge(window=30)

        assert result["blocked_by_reference"] == 1
        incr.assert_called_once_with("deletion_retention.blocked_audit_dedupe_fallback")

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
        dashboard = self.make_dashboard("fkoffdash", slices=[chart])
        dashboard_id = dashboard.id
        # Embedded config is a delete-orphan child whose removal must not
        # depend on the DB cascade either.
        from superset.models.embedded_dashboard import EmbeddedDashboard

        db.session.add(EmbeddedDashboard(dashboard_id=dashboard_id))
        db.session.commit()
        self.soft_delete(chart, days_ago=90)
        self.soft_delete(dashboard, days_ago=90)

        db.session.execute(sa.text("PRAGMA foreign_keys=OFF"))
        try:
            _purge(window=30)
        finally:
            # The connection is pooled; a later test must not inherit
            # disabled FK enforcement.
            db.session.execute(sa.text("PRAGMA foreign_keys=ON"))

        assert not self.exists(Slice, chart_id)
        assert (
            self.count(
                "SELECT count(*) FROM dashboard_slices WHERE slice_id = :i",
                {"i": chart_id},
            )
            == 0
        )
        assert (
            self.count(
                "SELECT count(*) FROM embedded_dashboards WHERE dashboard_id = :i",
                {"i": dashboard_id},
            )
            == 0
        )

    def test_purge_writes_no_association_shadows_with_capture_on(self) -> None:
        """A purge must not create association version shadows: the
        Core deletes on dashboard_slices queue Continuum statements that the
        suppression context discards before commit. After purging the
        dashboard, no dashboard_slices_version rows for it remain — neither
        pre-existing (its history is cascaded) nor purge-queued."""
        chart = self.make_chart("noshadow_chart")
        dashboard = self.make_dashboard("noshadow_dash", slices=[chart])
        dashboard_id = dashboard.id
        self.soft_delete(dashboard, days_ago=90)

        _purge(window=30)

        assert not self.exists(Dashboard, dashboard_id)
        assert (
            self.count(
                "SELECT count(*) FROM dashboard_slices_version WHERE dashboard_id = :i",
                {"i": dashboard_id},
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

    def test_transaction_closing_a_survivor_row_is_not_swept(self) -> None:
        """A transaction referenced only through a survivor's
        ``end_transaction_id`` is still referenced, so it must survive the
        orphan sweep.

        A shadow row points at two transactions: the one that created it and,
        once a later edit closes it, the one that ended it. Both are foreign
        keys. Sweeping on the created-at side alone judges the closing
        transaction orphaned while the survivor's row still points at it, and
        the delete fails the foreign key — surfacing to the operator as
        "blocked by existing deletion rules" rather than as the incomplete
        cascade it is.
        """
        purged = self.make_chart("endtx_purged")
        survivor = self.make_chart("endtx_survivor")
        purged_id, survivor_id = purged.id, survivor.id
        # The purged chart is the only entity *created* at 990004.
        self.forge_version_row(Slice, purged_id, tx_id=990004)
        # The survivor's earlier row was *closed* at that same transaction, so
        # nothing surviving references 990004 through transaction_id alone.
        self.forge_version_row(Slice, survivor_id, tx_id=990003, end_tx_id=990004)
        self.soft_delete(purged, days_ago=90)

        _purge(window=30)

        # The purge completed rather than reporting itself blocked.
        assert not self.exists(Slice, purged_id)
        # The closing transaction is retained because the survivor still
        # points at it.
        assert (
            self.count("SELECT count(*) FROM version_transaction WHERE id = 990004", {})
            == 1
        )
        assert (
            self.count(
                "SELECT count(*) FROM slices_version WHERE id = :i "
                "AND end_transaction_id = 990004",
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


class TestPurgeIdentityGuard(DeletionRetentionTestBase):
    """The audit row must name the entity that was actually purged."""

    def test_identity_drift_between_audit_and_purge_skips_the_entity(self) -> None:
        """A row whose identity changed after the audit write is not purged.

        ``_purge_one`` snapshots the uuid, writes the write-ahead audit row,
        then re-reads the entity by id. Ids can be recycled -- SQLite reuses
        rowids -- so the row under that id may no longer be the one the audit
        describes. The cascade's conditional claim would still refuse to
        destroy anything ineligible, making this an attribution guard rather
        than a destructive one: an audit row identifying the wrong object is
        worse than a skipped purge.
        """
        chart = self.make_chart("identity_drift")
        chart_id = chart.id
        self.soft_delete(chart, days_ago=90)

        real_uuid = str(chart.uuid)
        # First call feeds the audit row; the second is the post-audit
        # re-check, where the identity is made to differ.
        uuids = iter([real_uuid, "00000000-0000-0000-0000-0000deadbeef"])

        with (
            patch(
                "superset.tasks.deletion_retention.entity_uuid",
                side_effect=lambda _entity: next(uuids),
            ),
            patch("superset.tasks.deletion_retention.cascade_hard_delete") as cascade,
        ):
            stats = _purge()

        cascade.assert_not_called()
        assert self.exists(Slice, chart_id)
        assert stats["purged"] == {}

        row = (
            db.session.query(audit.PurgeAuditLog)
            .filter(audit.PurgeAuditLog.entity_uuid == real_uuid)
            .one()
        )
        assert row.status == audit.STATUS_FAILED

    def test_cascade_refuses_a_row_whose_uuid_no_longer_matches(self) -> None:
        """A reused id does not let the cascade purge a stranger.

        The id alone is not an identity: callers snapshot the entity well
        before the cascade runs -- the retention task writes an audit row in
        between -- and an id freed and reissued in that gap would otherwise be
        purged under the snapshot's name. Re-checking the uuid before the lock
        narrows that window; the predicate on the locked claim closes it.
        """
        chart = self.make_chart("uuid_drift")
        chart_id = chart.id
        self.soft_delete(chart, days_ago=90)
        snapshot_uuid = str(chart.uuid)

        # Stand in for the id being reissued: the stored row is now a different
        # entity, while the caller still holds the snapshot it resolved.
        db.session.execute(
            sa.update(Slice.__table__)
            .where(Slice.__table__.c.id == chart_id)
            .values(uuid="00000000-0000-0000-0000-00000000beef")
        )
        db.session.commit()
        db.session.refresh(chart)
        # Restore the snapshot's view without marking the attribute dirty, so
        # the cascade sees the uuid its caller resolved rather than the row's.
        set_committed_value(chart, "uuid", snapshot_uuid)

        result = cascade_hard_delete(
            db.session,
            chart,
            enforce_window=True,
            cutoff=datetime.now() - timedelta(days=30),
        )
        db.session.commit()

        assert result.purged is False
        assert self.exists(Slice, chart_id)


class TestExplicitBlockerGuards(DeletionRetentionTestBase):
    """Blockers must be policy checks, not side effects of FK enforcement."""

    def _set_welcome(self, dashboard_id: int) -> tuple[UserAttribute, bool, int | None]:
        user = self.get_user("admin")
        attribute = (
            db.session.query(UserAttribute).filter_by(user_id=user.id).one_or_none()
        )
        created = attribute is None
        if attribute is None:
            attribute = UserAttribute(user_id=user.id)
            db.session.add(attribute)
        previous = attribute.welcome_dashboard_id
        attribute.welcome_dashboard_id = dashboard_id
        db.session.commit()
        return attribute, created, previous

    def _restore_welcome(
        self, attribute: UserAttribute, created: bool, previous: int | None
    ) -> None:
        if created:
            db.session.delete(attribute)
        else:
            attribute.welcome_dashboard_id = previous
        db.session.commit()

    def test_welcome_dashboard_blocks_even_without_fk_enforcement(self) -> None:
        """The guard must hold where the database will not.

        SQLite runs with foreign keys unenforced, which is exactly the
        configuration where relying on the FK let the dashboard purge
        "successfully" -- stranding user_attributes.welcome_dashboard_id as a
        broken homepage pointer while the audit row said confirmed.
        """
        dashboard = self.make_dashboard("welcome_fkoff")
        dashboard_id = dashboard.id
        self.soft_delete(dashboard, days_ago=90)
        attribute, created, previous = self._set_welcome(dashboard_id)
        try:
            result = cascade_hard_delete(
                db.session,
                dashboard,
                enforce_window=True,
                cutoff=datetime.now() - timedelta(days=30),
            )
            db.session.commit()

            assert result.purged is False
            assert result.blocked_reason is not None
            assert "welcome page" in result.blocked_reason
            assert self.exists(Dashboard, dashboard_id)
        finally:
            self._restore_welcome(attribute, created, previous)

    def test_unhandled_fk_failure_reports_a_curated_reason(self) -> None:
        """Raw driver text must not become the blocked reason.

        An IntegrityError from a restrictive FK the cascade does not handle
        carries the failing SQL and bind parameters; the blocked_reason
        travels to a 422 and from there into a user-facing toast. The caller
        gets a curated sentence; the constraint detail belongs in the log,
        at WARNING, where a cascade-coverage bug can actually be diagnosed.
        """
        chart = self.make_chart("fk_surprise")
        chart_id = chart.id
        self.soft_delete(chart, days_ago=90)

        driver_text = (
            "(sqlite3.IntegrityError) FOREIGN KEY constraint failed "
            "[SQL: DELETE FROM slices WHERE slices.id = ?] [parameters: (1,)]"
        )

        def fail_association_cleanup(
            _session: Session, _policy: PurgeEntityPolicy, _entity_id: int
        ) -> None:
            raise IntegrityError(driver_text, None, Exception("fk"))

        policy: PurgeEntityPolicy = replace(
            get_purge_policy(Slice),
            delete_associations=fail_association_cleanup,
        )
        with patch(
            "superset.commands.deletion_retention.purge_cascade.get_purge_policy",
            return_value=policy,
        ):
            result = cascade_hard_delete(
                db.session,
                chart,
                enforce_window=True,
                cutoff=datetime.now() - timedelta(days=30),
            )
            db.session.commit()

        assert result.purged is False
        assert result.blocked_reason == "blocked by database references"
        assert "SQL:" not in result.blocked_reason
        assert self.exists(Slice, chart_id)

    def test_policy_action_failure_rolls_back_prior_phases(self) -> None:
        """A later policy-action failure restores earlier association cleanup."""
        chart: Slice = self.make_chart("action_rollback")
        chart_id: int = chart.id
        dashboard: Dashboard = self.make_dashboard("action_rollback", slices=[chart])
        dashboard_id: int = dashboard.id
        self.soft_delete(chart, days_ago=90)

        def fail_owned_cleanup(
            _session: Session, _policy: PurgeEntityPolicy, _entity_id: int
        ) -> None:
            raise RuntimeError("injected owned cleanup failure")

        policy: PurgeEntityPolicy = replace(
            get_purge_policy(Slice),
            delete_owned_children=fail_owned_cleanup,
        )
        with (
            patch(
                "superset.commands.deletion_retention.purge_cascade.get_purge_policy",
                return_value=policy,
            ),
            pytest.raises(RuntimeError, match="injected owned cleanup failure"),
        ):
            with suppress_purge_association_versions(db.session):
                cascade_hard_delete(
                    db.session,
                    chart,
                    enforce_window=True,
                    cutoff=datetime.now() - timedelta(days=30),
                )

        membership_count: int = int(
            db.session.execute(
                sa.select(sa.func.count())
                .select_from(dashboard_slices)
                .where(
                    dashboard_slices.c.dashboard_id == dashboard_id,
                    dashboard_slices.c.slice_id == chart_id,
                )
            ).scalar_one()
        )
        assert membership_count == 1
        assert self.exists(Slice, chart_id)

    def test_history_cleanup_failure_rolls_back_prior_phases(self) -> None:
        """A history-phase failure restores association cleanup and the root."""
        chart: Slice = self.make_chart("history_rollback")
        chart_id: int = chart.id
        dashboard: Dashboard = self.make_dashboard("history_rollback", slices=[chart])
        dashboard_id: int = dashboard.id
        self.soft_delete(chart, days_ago=90)

        with (
            patch(
                "superset.commands.deletion_retention.purge_cascade."
                "_delete_version_history",
                side_effect=RuntimeError("injected history cleanup failure"),
            ),
            pytest.raises(RuntimeError, match="injected history cleanup failure"),
        ):
            with suppress_purge_association_versions(db.session):
                cascade_hard_delete(
                    db.session,
                    chart,
                    enforce_window=True,
                    cutoff=datetime.now() - timedelta(days=30),
                )

        membership_count: int = int(
            db.session.execute(
                sa.select(sa.func.count())
                .select_from(dashboard_slices)
                .where(
                    dashboard_slices.c.dashboard_id == dashboard_id,
                    dashboard_slices.c.slice_id == chart_id,
                )
            ).scalar_one()
        )
        assert membership_count == 1
        assert self.exists(Slice, chart_id)


class TestFailClosedAudienceDefault(DeletionRetentionTestBase):
    """A soft-delete model without editors must not enumerate to everyone."""

    def test_editorless_model_enumerates_nothing_to_non_admins(self) -> None:
        """_scope_to_restore_audience fails CLOSED for a model without an
        editors relationship. All three shipped models have one, so this
        pins the default the next SoftDeleteMixin adopter inherits: no
        audience to scope to means nothing enumerable, not everything.
        """
        from superset.views.filters import BaseDeletedStateFilter

        chart = self.make_chart("failclosed")
        self.soft_delete(chart, days_ago=1)

        class ProbeFilter(BaseDeletedStateFilter):
            arg_name = "probe_deleted_state"
            model = Slice

        instance = ProbeFilter.__new__(ProbeFilter)
        base_query = db.session.query(Slice).execution_options(
            **{SKIP_VISIBILITY_FILTER_CLASSES: {Slice}}
        )
        with (
            patch(
                "superset.views.filters.security_manager.is_admin",
                return_value=False,
            ),
            patch.object(Slice, "editors", None),
        ):
            scoped = instance._scope_to_restore_audience(  # noqa: SLF001
                base_query.filter(Slice.deleted_at.is_not(None)), "only"
            )
            assert scoped.count() == 0
