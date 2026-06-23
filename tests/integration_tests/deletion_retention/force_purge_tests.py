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

from unittest.mock import patch

from superset import db
from superset.commands.deletion_retention.audit import PurgeAuditLog
from superset.commands.deletion_retention.force_purge import ForcePurgeCommand
from superset.connectors.sqla.models import SqlaTable
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.reports.models import ReportSchedule

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

    def test_force_purge_reports_relationship_count_before_db_cascade(self) -> None:
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
