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
from typing import Callable
from unittest.mock import MagicMock, patch
from uuid import UUID

import pytest
from sqlalchemy.orm import Session

from superset import db
from superset.commands.deletion_retention import audit
from superset.commands.deletion_retention.audit import PurgeAuditLog
from superset.models.slice import Slice
from superset.tasks.deletion_retention import _purge_impl

from ._base import DeletionRetentionTestBase


class TestPurgeAudit(DeletionRetentionTestBase):
    def _get_audit_record(self, record_id: UUID) -> PurgeAuditLog:
        record: PurgeAuditLog | None = db.session.get(PurgeAuditLog, record_id)
        assert record is not None
        return record

    def _write_retention_record(
        self,
        *,
        entity_uuid: str | None,
        entity_type: str = "slices",
        created_on: datetime | None = None,
    ) -> UUID:
        record_id: UUID | None = audit.write_ahead(
            trigger=audit.TRIGGER_RETENTION,
            actor=audit.ACTOR_SYSTEM,
            entity_type=entity_type,
            entity_uuid=entity_uuid,
        )
        assert record_id is not None
        if created_on is not None:
            record: PurgeAuditLog = self._get_audit_record(record_id)
            record.created_on = created_on
            db.session.commit()
        return record_id

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

        assert result == {"reconciled": 1, "absent": 1, "failed": 0}
        # target_absent, NOT confirmed: the entity being gone proves some
        # purge committed, but a concurrent attempt or unrelated deletion fits
        # the evidence equally well -- the compliance record must not
        # attribute a success it did not witness.
        assert row.status == audit.STATUS_TARGET_ABSENT
        # No confirmed_on: nothing was confirmed -- only inferred absent.
        assert row.confirmed_on is None

    def test_reconcile_fails_pending_when_entity_survives(self) -> None:
        """A stale attempt with a surviving entity is closed as failed."""
        chart = self.make_chart("surviving_pending")
        record_id = audit.write_ahead(
            trigger=audit.TRIGGER_RETENTION,
            actor=audit.ACTOR_SYSTEM,
            entity_type="slices",
            entity_uuid=str(chart.uuid),
            removed_dashboard_slices=7,
        )

        result = audit.reconcile_pending(
            stale_before=datetime.utcnow() + timedelta(seconds=1)
        )
        db.session.expire_all()

        assert result == {"reconciled": 1, "absent": 0, "failed": 1}
        row = db.session.get(PurgeAuditLog, record_id)
        assert row.status == audit.STATUS_FAILED
        # The intended-removal count is zeroed, same as finalize() on a
        # failed attempt: the rollback means those removals never happened.
        assert row.removed_dashboard_slices == 0

    def test_reconcile_zeroes_count_when_target_absent(self) -> None:
        """The intended-removal count is not attributable on target_absent.

        The entity being gone proves *some* purge committed, but not that it
        was this attempt -- so the write-ahead count must not survive into
        the immutable record as if witnessed (mirrors finalize() zeroing on
        failed/blocked).
        """
        record_id = audit.write_ahead(
            trigger=audit.TRIGGER_RETENTION,
            actor=audit.ACTOR_SYSTEM,
            entity_type="slices",
            entity_uuid="00000000-0000-0000-0000-00000000feed",
            removed_dashboard_slices=7,
        )

        result = audit.reconcile_pending(
            stale_before=datetime.utcnow() + timedelta(seconds=1)
        )
        db.session.expire_all()

        assert result == {"reconciled": 1, "absent": 1, "failed": 0}
        row = db.session.get(PurgeAuditLog, record_id)
        assert row.status == audit.STATUS_TARGET_ABSENT
        assert row.removed_dashboard_slices == 0

    def test_blocked_attempt_does_not_keep_the_intended_removal_count(self) -> None:
        """The write-ahead row records what the purge INTENDED to remove;
        a blocked attempt rolled that work back, so keeping the count would
        assert removals that never happened."""
        record_id = audit.write_ahead(
            trigger=audit.TRIGGER_RETENTION,
            actor=audit.ACTOR_SYSTEM,
            entity_type="dashboards",
            entity_uuid="00000000-0000-0000-0000-00000000cafe",
            removed_dashboard_slices=7,
        )
        audit.block(record_id)

        row = db.session.query(PurgeAuditLog).filter_by(id=record_id).one()
        assert row.status == audit.STATUS_BLOCKED
        assert row.removed_dashboard_slices == 0

    def test_first_retention_block_is_retained(self) -> None:
        record_id: UUID = self._write_retention_record(entity_uuid="first-block")

        disposition: audit.RetentionBlockedDisposition = (
            audit.finalize_retention_blocked(record_id)
        )

        record: PurgeAuditLog = self._get_audit_record(record_id)
        assert disposition == "retained"
        assert record.status == audit.STATUS_BLOCKED

    def test_repeated_retention_block_suppresses_current_provisional(self) -> None:
        first_id: UUID = self._write_retention_record(entity_uuid="repeat-block")
        audit.finalize_retention_blocked(first_id)
        second_id: UUID = self._write_retention_record(entity_uuid="repeat-block")

        disposition: audit.RetentionBlockedDisposition = (
            audit.finalize_retention_blocked(second_id)
        )

        assert disposition == "suppressed"
        first: PurgeAuditLog = self._get_audit_record(first_id)
        assert first.status == audit.STATUS_BLOCKED
        assert db.session.get(PurgeAuditLog, second_id) is None

    def test_equal_timestamp_is_ambiguous_and_retains_current(self) -> None:
        timestamp: datetime = datetime.utcnow()
        first_id: UUID = self._write_retention_record(
            entity_uuid="equal-time", created_on=timestamp
        )
        audit.finalize_retention_blocked(first_id)
        second_id: UUID = self._write_retention_record(
            entity_uuid="equal-time", created_on=timestamp
        )

        disposition: audit.RetentionBlockedDisposition = (
            audit.finalize_retention_blocked(second_id)
        )

        assert disposition == "retained"
        second: PurgeAuditLog = self._get_audit_record(second_id)
        assert second.status == audit.STATUS_BLOCKED

    def test_tied_mixed_predecessors_are_ambiguous_and_retain_current(self) -> None:
        timestamp: datetime = datetime.utcnow()
        blocked_id: UUID = self._write_retention_record(
            entity_uuid="mixed-tie", created_on=timestamp
        )
        audit.finalize(blocked_id, audit.STATUS_BLOCKED)
        failed_id: UUID = self._write_retention_record(
            entity_uuid="mixed-tie", created_on=timestamp
        )
        audit.finalize(failed_id, audit.STATUS_FAILED)
        current_id: UUID = self._write_retention_record(
            entity_uuid="mixed-tie", created_on=timestamp + timedelta(seconds=1)
        )
        session: Session = audit._dedicated_session()
        try:
            current: PurgeAuditLog | None = session.get(PurgeAuditLog, current_id)
            assert current is not None
            predecessor: PurgeAuditLog | None = audit._retention_predecessor(
                session, current
            )
        finally:
            session.close()

        disposition: audit.RetentionBlockedDisposition = (
            audit.finalize_retention_blocked(current_id)
        )

        assert predecessor is None
        assert disposition == "retained"
        retained: PurgeAuditLog = self._get_audit_record(current_id)
        assert retained.status == audit.STATUS_BLOCKED

    def test_newer_concurrent_row_does_not_become_a_predecessor(self) -> None:
        current_time: datetime = datetime.utcnow()
        current_id: UUID = self._write_retention_record(
            entity_uuid="overlap", created_on=current_time
        )
        newer_id: UUID = self._write_retention_record(
            entity_uuid="overlap", created_on=current_time + timedelta(seconds=1)
        )
        audit.finalize_retention_blocked(newer_id)

        disposition: audit.RetentionBlockedDisposition = (
            audit.finalize_retention_blocked(current_id)
        )

        assert disposition == "retained"
        current: PurgeAuditLog = self._get_audit_record(current_id)
        assert current.status == audit.STATUS_BLOCKED

    def test_pending_predecessor_retains_current_block(self) -> None:
        timestamp: datetime = datetime.utcnow()
        self._write_retention_record(entity_uuid="pending-prior", created_on=timestamp)
        current_id: UUID = self._write_retention_record(
            entity_uuid="pending-prior", created_on=timestamp + timedelta(seconds=1)
        )

        disposition: audit.RetentionBlockedDisposition = (
            audit.finalize_retention_blocked(current_id)
        )

        assert disposition == "retained"

    def test_null_uuid_retains_blocked_evidence(self) -> None:
        null_id: UUID = self._write_retention_record(entity_uuid=None)

        disposition: audit.RetentionBlockedDisposition = (
            audit.finalize_retention_blocked(null_id)
        )

        record: PurgeAuditLog = self._get_audit_record(null_id)
        assert disposition == "retained"
        assert record.status == audit.STATUS_BLOCKED
        assert record.removed_dashboard_slices == 0

    def test_same_uuid_across_entity_types_does_not_suppress(self) -> None:
        chart_id: UUID = self._write_retention_record(
            entity_uuid="shared-type", entity_type="slices"
        )
        audit.finalize_retention_blocked(chart_id)
        dashboard_id: UUID = self._write_retention_record(
            entity_uuid="shared-type", entity_type="dashboards"
        )

        dashboard_disposition: audit.RetentionBlockedDisposition = (
            audit.finalize_retention_blocked(dashboard_id)
        )

        assert dashboard_disposition == "retained"

    def test_completed_current_record_is_immutable(self) -> None:
        record_id: UUID = self._write_retention_record(entity_uuid="completed")
        audit.fail(record_id)

        disposition: audit.RetentionBlockedDisposition = (
            audit.finalize_retention_blocked(record_id)
        )

        record: PurgeAuditLog = self._get_audit_record(record_id)
        assert disposition == "retained"
        assert record.status == audit.STATUS_FAILED

    def test_predecessor_lookup_failure_recovers_blocked_evidence(self) -> None:
        record_id: UUID = self._write_retention_record(entity_uuid="lookup-failure")

        with patch(
            "superset.commands.deletion_retention.audit._retention_predecessor",
            side_effect=audit.SQLAlchemyError("lookup failed"),
        ):
            disposition: audit.RetentionBlockedDisposition = (
                audit.finalize_retention_blocked(record_id)
            )

        record: PurgeAuditLog = self._get_audit_record(record_id)
        assert disposition == "fallback"
        assert record.status == audit.STATUS_BLOCKED

    def test_suppression_delete_failure_recovers_blocked_evidence(self) -> None:
        first_id: UUID = self._write_retention_record(entity_uuid="delete-failure")
        audit.finalize_retention_blocked(first_id)
        current_id: UUID = self._write_retention_record(entity_uuid="delete-failure")

        with patch(
            "superset.commands.deletion_retention.audit._suppress_redundant_block",
            side_effect=audit.SQLAlchemyError("delete failed"),
        ):
            disposition: audit.RetentionBlockedDisposition = (
                audit.finalize_retention_blocked(current_id)
            )

        record: PurgeAuditLog = self._get_audit_record(current_id)
        assert disposition == "fallback"
        assert record.status == audit.STATUS_BLOCKED

    def test_commit_failure_recovers_blocked_evidence(self) -> None:
        record_id: UUID = self._write_retention_record(entity_uuid="commit-failure")
        primary_session: Session = audit._dedicated_session()
        recovery_session: Session = audit._dedicated_session()
        with (
            patch.object(
                primary_session,
                "commit",
                side_effect=audit.SQLAlchemyError("commit failed"),
            ),
            patch(
                "superset.commands.deletion_retention.audit._dedicated_session",
                side_effect=[primary_session, recovery_session],
            ),
        ):
            disposition: audit.RetentionBlockedDisposition = (
                audit.finalize_retention_blocked(record_id)
            )

        record: PurgeAuditLog = self._get_audit_record(record_id)
        assert disposition == "fallback"
        assert record.status == audit.STATUS_BLOCKED

    def test_uncertain_suppression_commit_recreates_absent_evidence(self) -> None:
        first_id: UUID = self._write_retention_record(entity_uuid="absent-current")
        audit.finalize_retention_blocked(first_id)
        current_id: UUID = self._write_retention_record(entity_uuid="absent-current")
        primary_session: Session = audit._dedicated_session()
        recovery_session: Session = audit._dedicated_session()
        primary_commit: Callable[[], None] = primary_session.commit

        def commit_then_raise() -> None:
            primary_commit()
            raise audit.SQLAlchemyError("commit acknowledgement lost")

        with (
            patch.object(primary_session, "commit", side_effect=commit_then_raise),
            patch(
                "superset.commands.deletion_retention.audit._dedicated_session",
                side_effect=[primary_session, recovery_session],
            ),
        ):
            disposition: audit.RetentionBlockedDisposition = (
                audit.finalize_retention_blocked(current_id)
            )

        record: PurgeAuditLog = self._get_audit_record(current_id)
        assert disposition == "fallback"
        assert record.status == audit.STATUS_BLOCKED

    def test_failed_fallback_leaves_pending_evidence_for_reconciliation(self) -> None:
        record_id: UUID = self._write_retention_record(entity_uuid="fallback-failure")
        primary_session: Session = audit._dedicated_session()
        recovery_session: Session = audit._dedicated_session()
        with (
            patch.object(
                primary_session,
                "commit",
                side_effect=audit.SQLAlchemyError("primary commit failed"),
            ),
            patch.object(
                recovery_session,
                "commit",
                side_effect=audit.SQLAlchemyError("recovery commit failed"),
            ),
            patch(
                "superset.commands.deletion_retention.audit._dedicated_session",
                side_effect=[primary_session, recovery_session],
            ),
        ):
            disposition: audit.RetentionBlockedDisposition = (
                audit.finalize_retention_blocked(record_id)
            )

        record: PurgeAuditLog = self._get_audit_record(record_id)
        assert disposition == "fallback"
        assert record.status == audit.STATUS_PENDING

    def test_indeterminate_delete_rowcount_forces_persistence_recovery(self) -> None:
        timestamp: datetime = datetime.utcnow()
        current: PurgeAuditLog = PurgeAuditLog(
            id=UUID("00000000-0000-0000-0000-000000000002"),
            status=audit.STATUS_PENDING,
            trigger=audit.TRIGGER_RETENTION,
            actor=audit.ACTOR_SYSTEM,
            entity_type="slices",
            entity_uuid="indeterminate-rowcount",
            created_on=timestamp,
        )
        predecessor: PurgeAuditLog = PurgeAuditLog(
            id=UUID("00000000-0000-0000-0000-000000000001"),
            status=audit.STATUS_BLOCKED,
            trigger=audit.TRIGGER_RETENTION,
            actor=audit.ACTOR_SYSTEM,
            entity_type="slices",
            entity_uuid="indeterminate-rowcount",
            created_on=timestamp - timedelta(seconds=1),
        )
        result: MagicMock = MagicMock(rowcount=-1)
        session: MagicMock = MagicMock()
        session.execute.return_value = result

        with pytest.raises(audit.SQLAlchemyError, match="indeterminate"):
            audit._suppress_redundant_block(session, current, predecessor)

    def test_overlap_duplicates_do_not_cause_unbounded_sequential_growth(self) -> None:
        timestamp: datetime = datetime.utcnow()
        first_id: UUID = self._write_retention_record(
            entity_uuid="bounded-overlap", created_on=timestamp
        )
        audit.finalize_retention_blocked(first_id)
        overlap_id: UUID = self._write_retention_record(
            entity_uuid="bounded-overlap", created_on=timestamp
        )
        audit.finalize_retention_blocked(overlap_id)
        later_id: UUID = self._write_retention_record(
            entity_uuid="bounded-overlap",
            created_on=timestamp + timedelta(seconds=1),
        )

        disposition: audit.RetentionBlockedDisposition = (
            audit.finalize_retention_blocked(later_id)
        )

        retained_count: int = (
            db.session.query(PurgeAuditLog)
            .filter_by(entity_uuid="bounded-overlap")
            .count()
        )
        assert disposition == "suppressed"
        assert retained_count == 2

    def test_meaningful_outcome_transitions_start_new_blocked_periods(self) -> None:
        transition: tuple[int, str]
        for transition in enumerate(
            (
                audit.STATUS_FAILED,
                audit.STATUS_CONFIRMED,
                audit.STATUS_TARGET_ABSENT,
            )
        ):
            index: int = transition[0]
            status: str = transition[1]
            entity_uuid: str = f"transition-{index}"
            prior_id: UUID = self._write_retention_record(entity_uuid=entity_uuid)
            audit.finalize(prior_id, status)
            current_id: UUID = self._write_retention_record(entity_uuid=entity_uuid)

            disposition: audit.RetentionBlockedDisposition = (
                audit.finalize_retention_blocked(current_id)
            )

            current: PurgeAuditLog = self._get_audit_record(current_id)
            assert disposition == "retained"
            assert current.status == audit.STATUS_BLOCKED
