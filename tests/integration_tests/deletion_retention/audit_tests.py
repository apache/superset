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
"""Integration coverage for the write-ahead purge audit record."""

from __future__ import annotations

from datetime import datetime, timedelta
from unittest.mock import patch
from uuid import UUID

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
        assert isinstance(row.id, UUID)

    def test_known_failure_finalizes_audit_row(self) -> None:
        """A known cascade failure is durable but does not remain pending."""
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
        # the write-ahead row survives and is finalized as failed
        row = db.session.query(PurgeAuditLog).filter_by(entity_uuid=chart_uuid).one()
        assert row.status == audit.STATUS_FAILED
        assert row.confirmed_on is None

    def test_reconcile_confirms_pending_after_entity_commit(self) -> None:
        """A crash after entity commit is reconciled to confirmed."""
        chart = self.make_chart("committed_crash")
        chart_uuid = str(chart.uuid)
        self.soft_delete(chart, days_ago=90)

        with patch("superset.tasks.deletion_retention.audit.confirm"):
            _purge_impl(30, dry_run=False)

        row = db.session.query(PurgeAuditLog).filter_by(entity_uuid=chart_uuid).one()
        assert row.status == audit.STATUS_PENDING

        result = audit.reconcile_pending(
            stale_before=datetime.utcnow() + timedelta(seconds=1)
        )
        db.session.expire_all()

        assert result == {"reconciled": 1, "confirmed": 1, "failed": 0}
        assert row.status == audit.STATUS_CONFIRMED
        assert row.confirmed_on is not None

    def test_reconcile_fails_pending_when_entity_survives(self) -> None:
        """A stale attempt with a surviving entity is closed as failed."""
        chart = self.make_chart("surviving_pending")
        record_id = audit.write_ahead(
            trigger=audit.TRIGGER_RETENTION,
            actor=audit.ACTOR_SYSTEM,
            entity_type="slices",
            entity_uuid=str(chart.uuid),
        )

        result = audit.reconcile_pending(
            stale_before=datetime.utcnow() + timedelta(seconds=1)
        )
        db.session.expire_all()

        assert result == {"reconciled": 1, "confirmed": 0, "failed": 1}
        assert db.session.get(PurgeAuditLog, record_id).status == audit.STATUS_FAILED
