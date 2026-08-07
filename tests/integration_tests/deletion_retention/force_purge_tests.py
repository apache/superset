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
"""Integration coverage for the compliance force-purge."""

from __future__ import annotations

import itertools
from unittest.mock import patch

import pytest

from superset import db
from superset.commands.deletion_retention import audit
from superset.commands.deletion_retention.audit import PurgeAuditLog
from superset.commands.deletion_retention.force_purge import (
    AmbiguousPurgeTargetError,
    ForcePurgeCommand,
)
from superset.connectors.sqla.models import SqlaTable
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.reports.models import ReportSchedule
from superset.tasks.deletion_retention import _purge_impl

from ._base import DeletionRetentionTestBase


class TestForcePurge(DeletionRetentionTestBase):
    def test_force_purge_live_entity(self) -> None:
        """Force-purge removes a *live* entity (never
        soft-deleted) immediately, ignoring the window."""
        chart = self.make_chart("live")
        chart_id, chart_uuid = chart.id, str(chart.uuid)

        result = ForcePurgeCommand(chart_uuid).run()

        assert result["purged"] is True
        assert result["entity_type"] == "chart"
        assert not self.exists(Slice, chart_id)

    def test_force_purge_soft_deleted_entity_and_history(self) -> None:
        """Force-purge a soft-deleted entity removes it and its
        version history; the audit record survives."""
        chart = self.make_chart("softdel")
        chart_id, chart_uuid = chart.id, str(chart.uuid)
        self.forge_version_row(Slice, chart_id, tx_id=990050)
        self.soft_delete(chart, days_ago=1)  # inside the window; force ignores it

        ForcePurgeCommand(chart_uuid).run()

        assert not self.exists(Slice, chart_id)
        assert (
            self.count(
                "SELECT count(*) FROM slices_version WHERE id = :i", {"i": chart_id}
            )
            == 0
        )
        audit = db.session.query(PurgeAuditLog).filter_by(entity_uuid=chart_uuid).all()
        assert [(a.trigger, a.status) for a in audit] == [("force", "confirmed")]

    def test_force_purge_idempotent(self) -> None:
        """Re-running force-purge on a gone UUID is a no-op."""
        chart = self.make_chart("once")
        chart_uuid = str(chart.uuid)
        ForcePurgeCommand(chart_uuid).run()

        result = ForcePurgeCommand(chart_uuid).run()

        assert result["purged"] is False
        assert result["reason"] == "not_found"

    def test_force_purge_dataset_leaves_chart_dangling(self) -> None:
        """Force-purging a dataset referenced by a live
        chart succeeds, leaves the chart's datasource_id dangling (chart row
        unchanged), and records the affected chart in the audit entry."""
        chart = self.make_chart("dep", dataset=self.dataset)
        chart_id, chart_uuid = chart.id, str(chart.uuid)
        ds_id, ds_uuid = self.dataset.id, str(self.dataset.uuid)

        result = ForcePurgeCommand(ds_uuid).run()

        assert result["purged"] is True
        assert not self.exists(SqlaTable, ds_id)
        kept = db.session.query(Slice).filter(Slice.id == chart_id).one()
        assert kept.datasource_id == ds_id  # dangling, unmodified
        assert chart_uuid in result["dangling_chart_uuids"]
        audit = db.session.query(PurgeAuditLog).filter_by(entity_uuid=ds_uuid).one()
        assert audit.affected_referrers
        assert chart_uuid in audit.affected_referrers

    def test_force_purge_counts_removed_dashboard_slices_before_db_cascade(
        self,
    ) -> None:
        """The removed join count is accurate with FK enforcement enabled."""
        chart = self.make_chart("counted")
        dashboard = self.make_dashboard("counted", slices=[chart])
        dashboard_id, chart_uuid = dashboard.id, str(chart.uuid)

        result = ForcePurgeCommand(chart_uuid).run()

        assert result["removed_dashboard_slices"] == 1
        assert self.exists(Dashboard, dashboard_id)
        audit = db.session.query(PurgeAuditLog).filter_by(entity_uuid=chart_uuid).one()
        assert audit.removed_dashboard_slices == 1

    def test_force_purge_preserves_report_reference_blocker(self) -> None:
        """Force bypasses age/state, not ordinary deletion restrictions."""
        chart = self.make_chart("force_reported")
        report = ReportSchedule(
            type="Report",
            name="retention_it_force_report",
            crontab="0 0 * * *",
            chart=chart,
        )
        db.session.add(report)
        db.session.commit()
        chart_id, chart_uuid = chart.id, str(chart.uuid)

        with patch(
            "superset.commands.deletion_retention.force_purge.logger.info"
        ) as log_info:
            result = ForcePurgeCommand(chart_uuid).run()

        assert result["purged"] is False
        assert result["reason"] == "blocked"
        assert self.exists(Slice, chart_id)
        row = db.session.query(PurgeAuditLog).filter_by(entity_uuid=chart_uuid).one()
        assert row.status == "blocked"
        log_info.assert_called_once_with(
            "force_purge: blocked %s uuid=%s reason=%s",
            "chart",
            chart_uuid,
            "associated alerts or reports exist",
        )

    def test_force_block_does_not_change_scheduled_deduplication_stream(self) -> None:
        chart: Slice = self.make_chart("independent_block_streams")
        report: ReportSchedule = ReportSchedule(
            type="Report",
            name="retention_it_independent_block_streams",
            crontab="0 0 * * *",
            chart=chart,
        )
        db.session.add(report)
        db.session.commit()
        chart_uuid: str = str(chart.uuid)
        self.soft_delete(chart, days_ago=90)

        first_scheduled: dict[str, object] = _purge_impl(30, dry_run=False)
        force_result: dict[str, object] = ForcePurgeCommand(chart_uuid).run()
        second_scheduled: dict[str, object] = _purge_impl(30, dry_run=False)

        records: list[PurgeAuditLog] = (
            db.session.query(PurgeAuditLog).filter_by(entity_uuid=chart_uuid).all()
        )
        assert first_scheduled["blocked_by_reference"] == 1
        assert force_result["reason"] == "blocked"
        assert second_scheduled["blocked_by_reference"] == 1
        assert sorted((record.trigger, record.status) for record in records) == sorted(
            [
                (audit.TRIGGER_RETENTION, audit.STATUS_BLOCKED),
                (audit.TRIGGER_FORCE, audit.STATUS_BLOCKED),
            ]
        )

    def test_force_purge_refuses_an_ambiguous_uuid(self) -> None:
        """A UUID matching two entity types is refused, not guessed.

        UUID uniqueness is per table, and the import APIs accept
        caller-supplied UUIDs, so an operator's bare UUID can legitimately
        match more than one row. Purging the first match found would let a
        compliance deletion destroy an entity nobody asked about.
        """
        chart = self.make_chart("ambiguous_chart")
        dashboard = self.make_dashboard("ambiguous_dash")
        shared = chart.uuid
        dashboard.uuid = shared
        db.session.commit()
        chart_id, dashboard_id = chart.id, dashboard.id
        self.soft_delete(chart, days_ago=90)

        with pytest.raises(AmbiguousPurgeTargetError):
            ForcePurgeCommand(str(shared)).run()

        # Neither is touched.
        assert self.exists(Slice, chart_id)
        assert self.exists(Dashboard, dashboard_id)

    def test_force_purge_with_a_model_resolves_only_that_type(self) -> None:
        """Given the type, the same ambiguous UUID purges exactly one row."""
        chart = self.make_chart("scoped_chart")
        dashboard = self.make_dashboard("scoped_dash")
        shared = chart.uuid
        dashboard.uuid = shared
        db.session.commit()
        chart_id, dashboard_id = chart.id, dashboard.id
        self.soft_delete(chart, days_ago=90)

        result = ForcePurgeCommand(str(shared), model_cls=Slice).run()

        assert result["purged"] is True
        assert not self.exists(Slice, chart_id)
        assert self.exists(Dashboard, dashboard_id)

    def test_cli_force_purge_reports_ambiguity_as_an_operator_error(self) -> None:
        """The refusal reaches the operator as a message, not a traceback.

        It surfaces *after* the irreversible confirmation prompt has been
        answered, which is the failure mode the ``type=click.UUID`` validation
        on the same command exists to avoid.
        """
        from click.testing import CliRunner

        from superset.cli.deletion_retention import force_purge

        chart = self.make_chart("cli_ambiguous_chart")
        dashboard = self.make_dashboard("cli_ambiguous_dash")
        shared = chart.uuid
        dashboard.uuid = shared
        db.session.commit()
        chart_id, dashboard_id = chart.id, dashboard.id
        self.soft_delete(chart, days_ago=90)

        result = CliRunner().invoke(force_purge, ["--uuid", str(shared), "--yes"])

        assert result.exit_code != 0
        assert not isinstance(result.exception, AmbiguousPurgeTargetError)
        assert "--type" in result.output
        # The refusal is not a partial purge.
        assert self.exists(Slice, chart_id)
        assert self.exists(Dashboard, dashboard_id)

    def test_cli_force_purge_type_option_disambiguates(self) -> None:
        """The escape hatch the error names actually exists and works."""
        from click.testing import CliRunner

        from superset.cli.deletion_retention import force_purge

        chart = self.make_chart("cli_typed_chart")
        dashboard = self.make_dashboard("cli_typed_dash")
        shared = chart.uuid
        dashboard.uuid = shared
        db.session.commit()
        chart_id, dashboard_id = chart.id, dashboard.id
        self.soft_delete(chart, days_ago=90)

        result = CliRunner().invoke(
            force_purge, ["--uuid", str(shared), "--type", "chart", "--yes"]
        )

        assert result.exit_code == 0, result.output
        assert not self.exists(Slice, chart_id)
        assert self.exists(Dashboard, dashboard_id)

    def test_force_purge_refuses_a_row_restored_after_resolution(self) -> None:
        """A restore committing after the entity is resolved is not overrun.

        Checking archived state only while resolving narrows the race without
        closing it: the cascade runs with ``enforce_window=False``, so unless
        the constraint reaches the locked claim and the conditional delete, a
        restore landing in between destroys a live row.
        """
        chart = self.make_chart("restored_midflight")
        chart_id = chart.id
        chart_uuid = str(chart.uuid)
        self.soft_delete(chart, days_ago=90)

        original_resolve = ForcePurgeCommand._resolve  # noqa: SLF001
        calls = itertools.count(1)

        def resolve_then_restore(self_: ForcePurgeCommand) -> object:
            entity = original_resolve(self_)
            # run() resolves twice: once before the write-ahead audit and once
            # after. Only the second result reaches the cascade, so the restore
            # has to commit after *that* one -- restoring during the first call
            # makes the second resolve return None under require_archived, and
            # the command exits at its not-found guard without ever running the
            # cascade the constraint is meant to protect.
            if next(calls) == 2 and entity is not None:
                db.session.query(Slice).filter(Slice.id == chart_id).update(
                    {"deleted_at": None}
                )
                db.session.commit()
            return entity

        with patch.object(ForcePurgeCommand, "_resolve", resolve_then_restore):
            result = ForcePurgeCommand(
                chart_uuid, model_cls=Slice, require_archived=True
            ).run()

        assert result["purged"] is False
        assert self.exists(Slice, chart_id)

    def test_force_purge_without_require_archived_still_takes_live_rows(
        self,
    ) -> None:
        """The operator path is unchanged: no flag, no archived-only guard.

        The CLI force-purges by UUID regardless of state, which is the
        documented operator capability; only callers acting for an end user
        opt into the stricter behaviour.
        """
        chart = self.make_chart("live_operator_purge")
        chart_id = chart.id

        result = ForcePurgeCommand(str(chart.uuid), model_cls=Slice).run()

        assert result["purged"] is True
        assert not self.exists(Slice, chart_id)
