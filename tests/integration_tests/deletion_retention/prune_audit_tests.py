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
"""Integration tests for purge-audit pruning against the real metadata DB.

Rows are seeded directly (pruning reads only ``purge_audit_log``); every
test's rows carry a distinctive ``entity_uuid`` prefix and are removed in
teardown, so no other suite ever sees them.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from unittest.mock import patch
from uuid import uuid4

import sqlalchemy as sa
from flask import current_app

from superset import db
from superset.commands.deletion_retention import audit, prune_audit
from superset.models.purge_audit_log import (
    PurgeAuditLog,
    STATUS_BLOCKED,
    STATUS_CONFIRMED,
    STATUS_FAILED,
    STATUS_PENDING,
    STATUS_TARGET_ABSENT,
)
from tests.integration_tests.base_tests import SupersetTestCase

_PREFIX = "prune_audit_it_"


def _utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class TestPruneAudit(SupersetTestCase):
    """Behavioral coverage for ``prune_audit.run_prune``."""

    _seq: int

    def setUp(self) -> None:
        super().setUp()
        self._seq = 0
        self._cleanup()

    def tearDown(self) -> None:
        self._cleanup()
        super().tearDown()

    def _cleanup(self) -> None:
        db.session.rollback()
        db.session.execute(
            sa.delete(PurgeAuditLog.__table__).where(
                PurgeAuditLog.__table__.c.entity_uuid.like(f"{_PREFIX}%")
            )
        )
        db.session.commit()

    def add_row(
        self,
        status: str,
        entity: str = "e1",
        age_days: float = 0,
        trigger: str = audit.TRIGGER_RETENTION,
        entity_type: str = "slices",
    ) -> PurgeAuditLog:
        """Seed one audit row. ``age_days`` may be fractional; a strictly
        increasing microsecond sequence keeps every ``created_on`` unique so
        streak ordering is deterministic."""
        self._seq += 1
        row = PurgeAuditLog(
            id=uuid4(),
            status=status,
            trigger=trigger,
            actor=audit.ACTOR_SYSTEM,
            entity_type=entity_type,
            entity_uuid=f"{_PREFIX}{entity}",
            created_on=_utc_now()
            - timedelta(days=age_days)
            + timedelta(microseconds=self._seq),
        )
        db.session.add(row)
        db.session.commit()
        return row

    def remaining(self, entity: str | None = None) -> list[PurgeAuditLog]:
        query = db.session.query(PurgeAuditLog).filter(
            PurgeAuditLog.entity_uuid.like(f"{_PREFIX}%")
        )
        if entity is not None:
            query = query.filter(PurgeAuditLog.entity_uuid == f"{_PREFIX}{entity}")
        return query.order_by(PurgeAuditLog.created_on).all()

    def run_prune(self, **config: Any) -> prune_audit.PruneRunResult:
        with patch.dict(current_app.config, config):
            return prune_audit.run_prune()

    # -- US1: bounded blockage history -------------------------------------

    def test_duplicates_reduce_to_the_earliest_survivor_regardless_of_age(self):
        """The dedup rule is age-independent: recent duplicates die too, and
        the streak's earliest row (blocked-since) is the sole survivor."""
        rows = [self.add_row(STATUS_BLOCKED, age_days=5 - i / 100) for i in range(50)]
        survivor_id = rows[0].id  # oldest: largest age offset is rows[0]

        result = self.run_prune()

        assert result.blocked_duplicates == 49
        assert result.carried_over is False
        left = self.remaining("e1")
        assert [r.id for r in left] == [survivor_id]
        assert left[0].status == STATUS_BLOCKED

    def test_backlog_converges_over_bounded_runs(self):
        """A backlog larger than one run's budget drains across successive
        runs (FR-004/SC-004): each run removes at most
        BATCH_SIZE * MAX_BATCHES_PER_RUN rows and reports carryover."""
        for i in range(56):
            self.add_row(STATUS_BLOCKED, age_days=3 - i / 1000)

        removed_per_run: list[int] = []
        with (
            patch.object(prune_audit, "BATCH_SIZE", 10),
            patch.object(prune_audit, "MAX_BATCHES_PER_RUN", 2),
        ):
            while True:
                result = self.run_prune()
                removed_per_run.append(result.blocked_duplicates)
                if not result.carried_over:
                    break

        # A run that exhausts its budget reports carryover conservatively —
        # the remaining categories were never examined — so convergence ends
        # with one confirming zero-removal run that finds everything drained.
        assert removed_per_run == [20, 20, 15, 0]
        assert len(self.remaining("e1")) == 1  # the survivor

    def test_dedup_never_crosses_entities(self):
        a_rows = [
            self.add_row(STATUS_BLOCKED, entity="a", age_days=2) for _ in range(3)
        ]
        b_rows = [
            self.add_row(STATUS_BLOCKED, entity="b", age_days=2) for _ in range(4)
        ]

        result = self.run_prune()

        assert result.blocked_duplicates == 5
        assert [r.id for r in self.remaining("a")] == [a_rows[0].id]
        assert [r.id for r in self.remaining("b")] == [b_rows[0].id]

    def test_resolved_streak_has_no_survivor_and_ages_out(self):
        """Once a newer confirmed exists, the old blocked rows are a resolved
        streak: none is a survivor, all age out under the operational window,
        and the confirmed row itself is protected evidence."""
        for _ in range(3):
            self.add_row(STATUS_BLOCKED, age_days=200)
        confirmed = self.add_row(STATUS_CONFIRMED, age_days=100)
        new_streak_survivor = self.add_row(STATUS_BLOCKED, age_days=50)
        self.add_row(STATUS_BLOCKED, age_days=40)  # duplicate in the new streak

        result = self.run_prune()

        # New-streak duplicate via dedup; the three resolved-streak rows via
        # operational expiry (all older than 90 days).
        assert result.blocked_duplicates == 1
        assert result.operational_expired == 3
        assert {r.id for r in self.remaining("e1")} == {
            confirmed.id,
            new_streak_survivor.id,
        }

    # -- US2: evidence survives by default ----------------------------------

    def test_defaults_leave_completed_destruction_evidence_untouched(self):
        evidence = [
            self.add_row(STATUS_CONFIRMED, entity="ev", age_days=3650),
            self.add_row(STATUS_TARGET_ABSENT, entity="ev", age_days=1000),
            self.add_row(STATUS_CONFIRMED, entity="ev", age_days=1),
        ]
        self.add_row(STATUS_FAILED, entity="ev", age_days=365)  # ages out

        for _ in range(3):  # any sequence of runs (SC-002)
            result = self.run_prune()

        assert result.evidence_expired == 0
        assert {r.id for r in self.remaining("ev")} == {row.id for row in evidence}

    def test_evidence_opt_in_expires_only_rows_older_than_its_window(self):
        # Capture ids up front: the ORM instance of a pruned row cannot be
        # read afterwards (ObjectDeletedError on refresh).
        old_id = self.add_row(STATUS_CONFIRMED, entity="ev", age_days=400).id
        young_id = self.add_row(STATUS_TARGET_ABSENT, entity="ev", age_days=300).id

        result = self.run_prune(PURGE_AUDIT_EVIDENCE_RETENTION_DAYS=365)

        assert result.evidence_expired == 1
        left_ids = [r.id for r in self.remaining("ev")]
        assert left_ids == [young_id]
        assert old_id not in left_ids

    def test_opt_in_disabled_again_removes_no_further_evidence(self):
        self.add_row(STATUS_CONFIRMED, entity="ev", age_days=400)
        survivor_after_expiry = self.add_row(
            STATUS_CONFIRMED, entity="ev", age_days=390
        )

        first = self.run_prune(PURGE_AUDIT_EVIDENCE_RETENTION_DAYS=395)
        assert first.evidence_expired == 1

        second = self.run_prune(PURGE_AUDIT_EVIDENCE_RETENTION_DAYS=None)
        assert second.evidence_expired == 0
        assert [r.id for r in self.remaining("ev")] == [survivor_after_expiry.id]

    def test_pending_and_future_rows_survive_every_configuration(self):
        pending = self.add_row(STATUS_PENDING, entity="px", age_days=3650)
        future_blocked = self.add_row(STATUS_BLOCKED, entity="px", age_days=-1)
        future_confirmed = self.add_row(STATUS_CONFIRMED, entity="px", age_days=-2)

        result = self.run_prune(
            PURGE_AUDIT_RETENTION_DAYS=1,
            PURGE_AUDIT_EVIDENCE_RETENTION_DAYS=1,
        )

        assert result.total_removed == 0
        assert {r.id for r in self.remaining("px")} == {
            pending.id,
            future_blocked.id,
            future_confirmed.id,
        }

    # -- US3: operator controls and observability ---------------------------

    def test_configured_retention_window_is_honored(self):
        kept = self.add_row(STATUS_FAILED, entity="w", age_days=5)
        self.add_row(STATUS_FAILED, entity="w", age_days=15)

        result = self.run_prune(PURGE_AUDIT_RETENTION_DAYS=10)

        assert result.operational_expired == 1
        assert [r.id for r in self.remaining("w")] == [kept.id]

    def test_invalid_operational_window_skips_the_category_not_widens(self):
        """FR-005/SC-005: a zero window disables age-out (fail closed) while
        the age-independent dedup rule keeps working, and the invalid key is
        reported on the result."""
        old_failed = self.add_row(STATUS_FAILED, entity="iv", age_days=1000)
        self.add_row(STATUS_BLOCKED, entity="iv", age_days=3)
        self.add_row(STATUS_BLOCKED, entity="iv", age_days=2)

        result = self.run_prune(PURGE_AUDIT_RETENTION_DAYS=0)

        assert result.operational_expired == 0
        assert result.blocked_duplicates == 1
        assert result.invalid_config_keys == ["PURGE_AUDIT_RETENTION_DAYS"]
        assert old_failed.id in {r.id for r in self.remaining("iv")}

    def test_second_run_over_the_same_candidates_removes_and_reports_zero(self):
        """FR-010: deletes are conditional and counted from rowcounts, so a
        rerun over an already-pruned set can neither double-remove nor
        double-report."""
        for _ in range(4):
            self.add_row(STATUS_BLOCKED, entity="cc", age_days=2)
        self.add_row(STATUS_FAILED, entity="cc", age_days=100)

        first = self.run_prune()
        assert first.blocked_duplicates == 3
        assert first.operational_expired == 1

        second = self.run_prune()
        assert second.blocked_duplicates == 0
        assert second.operational_expired == 0
        assert second.total_removed == 0
        assert len(self.remaining("cc")) == 1
