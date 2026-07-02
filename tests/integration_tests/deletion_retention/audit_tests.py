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
"""Integration coverage for the write-ahead purge audit record (FR-PURGE-012 /
C19, SC-PURGE-007)."""

from __future__ import annotations

from unittest.mock import patch

from superset import db
from superset.commands.deletion_retention import audit
from superset.commands.deletion_retention.audit import PurgeAuditLog
from superset.models.slice import Slice
from superset.tasks.deletion_retention import _purge_impl

from ._base import DeletionRetentionTestBase


class TestPurgeAudit(DeletionRetentionTestBase):
    def test_write_ahead_then_confirm(self) -> None:
        """A purge writes a pending audit row up front and flips it to
        confirmed after the delete commits."""
        chart = self.make_chart("audited")
        chart_uuid = str(chart.uuid)
        self.soft_delete(chart, days_ago=90)

        _purge_impl(30, dry_run=False)

        row = db.session.query(PurgeAuditLog).filter_by(entity_uuid=chart_uuid).one()
        assert row.status == audit.STATUS_CONFIRMED
        assert row.trigger == audit.TRIGGER_RETENTION
        assert row.actor == audit.ACTOR_SYSTEM
        assert row.confirmed_on is not None

    def test_crash_between_pending_and_confirm_leaves_pending_row(self) -> None:
        """SC-PURGE-007 / C19: if the purge fails after the write-ahead row,
        a pending row survives (never a missing record) — the audit row is on
        its own session, so the purge's rollback does not erase it."""
        chart = self.make_chart("crash")
        chart_id, chart_uuid = chart.id, str(chart.uuid)
        self.soft_delete(chart, days_ago=90)

        # Make the cascade blow up after the write-ahead row is committed.
        with patch(
            "superset.tasks.deletion_retention.cascade_hard_delete",
            side_effect=RuntimeError("boom"),
        ):
            result = _purge_impl(30, dry_run=False)

        # the run records the failure and does not purge
        assert result["cascade_failures"] == 1
        assert self.exists(Slice, chart_id)
        # but a pending audit row survives the rolled-back purge
        row = db.session.query(PurgeAuditLog).filter_by(entity_uuid=chart_uuid).one()
        assert row.status == audit.STATUS_PENDING
        assert row.confirmed_on is None
