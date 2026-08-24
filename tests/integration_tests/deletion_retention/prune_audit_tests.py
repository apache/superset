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
test's rows carry a distinctive ``entity_type`` prefix and are removed in
teardown, so no other suite ever sees them. Scoping on ``entity_type``
rather than ``entity_uuid`` matters: some rows deliberately carry a NULL
uuid, which a ``LIKE`` on the uuid column would never match.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any
from unittest.mock import patch
from uuid import UUID, uuid4

import sqlalchemy as sa
from flask import current_app

from superset import db
from superset.commands.deletion_retention import audit, prune_audit
from superset.commands.deletion_retention.prune_audit import (
    EVIDENCE_RETENTION_KEY,
    OPERATIONAL_RETENTION_KEY,
)
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
_ENTITY_TYPE = f"{_PREFIX}slices"


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
                PurgeAuditLog.__table__.c.entity_type == _ENTITY_TYPE
            )
        )
        db.session.commit()

    def add_row(
        self,
        status: str,
        entity: str | None = "e1",
        age_days: float = 0,
        trigger: str = audit.TRIGGER_RETENTION,
    ) -> UUID:
        """Seed one audit row and return its id.

        Ids rather than instances: an instance whose row a later prune
        deletes raises ObjectDeletedError on attribute access. ``age_days``
        may be fractional; a strictly increasing microsecond sequence keeps
        every ``created_on`` unique so streak ordering is deterministic.
        ``entity=None`` seeds a row with no ``entity_uuid``.
        """
        self._seq += 1
        row = PurgeAuditLog(
            id=uuid4(),
            status=status,
            trigger=trigger,
            actor=audit.ACTOR_SYSTEM,
            entity_type=_ENTITY_TYPE,
            entity_uuid=None if entity is None else f"{_PREFIX}{entity}",
            created_on=audit.utc_now()
            - timedelta(days=age_days)
            + timedelta(microseconds=self._seq),
        )
        db.session.add(row)
        db.session.commit()
        return row.id

    def remaining_ids(self, entity: str | None = "__any__") -> list[UUID]:
        """Ids of surviving seeded rows, oldest first."""
        query = db.session.query(PurgeAuditLog).filter(
            PurgeAuditLog.entity_type == _ENTITY_TYPE
        )
        if entity != "__any__":
            query = query.filter(
                PurgeAuditLog.entity_uuid.is_(None)
                if entity is None
                else PurgeAuditLog.entity_uuid == f"{_PREFIX}{entity}"
            )
        return [r.id for r in query.order_by(PurgeAuditLog.created_on).all()]

    def run_prune(self, **config: Any) -> prune_audit.PruneRunResult:
        with patch.dict(current_app.config, config):
            return prune_audit.run_prune()

    # -- US1: bounded blockage history -------------------------------------

    def test_duplicates_reduce_to_the_earliest_survivor_regardless_of_age(self) -> None:
        """The dedup rule is age-independent: recent duplicates die too, and
        the streak's earliest row (blocked-since) is the sole survivor."""
        ids = [self.add_row(STATUS_BLOCKED, age_days=5 - i / 100) for i in range(50)]

        result = self.run_prune()

        assert result.blocked_duplicates == 49
        assert result.carried_over is False
        assert self.remaining_ids("e1") == [ids[0]]

    def test_backlog_converges_over_bounded_runs(self) -> None:
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
        assert len(self.remaining_ids("e1")) == 1  # the survivor

    def test_dedup_never_crosses_entities(self) -> None:
        a_ids = [self.add_row(STATUS_BLOCKED, entity="a", age_days=2) for _ in range(3)]
        b_ids = [self.add_row(STATUS_BLOCKED, entity="b", age_days=2) for _ in range(4)]

        result = self.run_prune()

        assert result.blocked_duplicates == 5
        assert self.remaining_ids("a") == [a_ids[0]]
        assert self.remaining_ids("b") == [b_ids[0]]

    def test_resolved_streak_has_no_survivor_and_ages_out(self) -> None:
        """Once a newer confirmed exists, the old blocked rows are a resolved
        streak: none is a survivor, all age out under the operational window,
        and the confirmed row itself is protected evidence."""
        for _ in range(3):
            self.add_row(STATUS_BLOCKED, age_days=200)
        confirmed = self.add_row(STATUS_CONFIRMED, age_days=100)
        new_survivor = self.add_row(STATUS_BLOCKED, age_days=50)
        self.add_row(STATUS_BLOCKED, age_days=40)  # duplicate in the new streak

        result = self.run_prune()

        assert result.blocked_duplicates == 1
        assert result.operational_expired == 3
        assert set(self.remaining_ids("e1")) == {confirmed, new_survivor}

    def test_a_failed_attempt_does_not_reset_the_blocked_since_survivor(self) -> None:
        """A failed purge is an infrastructure outcome, not proof the block
        cleared: the streak spans it, so the original blocked-since row stays
        the survivor and the later blocked rows remain its duplicates."""
        blocked_since = self.add_row(STATUS_BLOCKED, age_days=200)
        self.add_row(STATUS_FAILED, age_days=150)  # ages out as operational
        self.add_row(STATUS_BLOCKED, age_days=100)
        self.add_row(STATUS_BLOCKED, age_days=50)

        result = self.run_prune()

        assert result.blocked_duplicates == 2
        assert result.operational_expired == 1
        assert self.remaining_ids("e1") == [blocked_since]

    # -- US2: evidence survives by default ----------------------------------

    def test_defaults_leave_completed_destruction_evidence_untouched(self) -> None:
        evidence = [
            self.add_row(STATUS_CONFIRMED, entity="ev", age_days=3650),
            self.add_row(STATUS_TARGET_ABSENT, entity="ev", age_days=1000),
            self.add_row(STATUS_CONFIRMED, entity="ev", age_days=1),
        ]
        self.add_row(STATUS_FAILED, entity="ev", age_days=365)  # ages out

        for _ in range(3):  # any sequence of runs (SC-002)
            result = self.run_prune()

        assert result.evidence_expired == 0
        assert set(self.remaining_ids("ev")) == set(evidence)

    def test_evidence_opt_in_expires_only_rows_older_than_its_window(self) -> None:
        old = self.add_row(STATUS_CONFIRMED, entity="ev", age_days=400)
        young = self.add_row(STATUS_TARGET_ABSENT, entity="ev", age_days=300)

        result = self.run_prune(**{EVIDENCE_RETENTION_KEY: 365})

        assert result.evidence_expired == 1
        assert self.remaining_ids("ev") == [young]
        assert old not in self.remaining_ids("ev")

    def test_opt_in_disabled_again_removes_no_further_evidence(self) -> None:
        self.add_row(STATUS_CONFIRMED, entity="ev", age_days=400)
        survivor = self.add_row(STATUS_CONFIRMED, entity="ev", age_days=390)

        first = self.run_prune(**{EVIDENCE_RETENTION_KEY: 395})
        assert first.evidence_expired == 1

        second = self.run_prune(**{EVIDENCE_RETENTION_KEY: None})
        assert second.evidence_expired == 0
        assert self.remaining_ids("ev") == [survivor]

    def test_pending_and_future_rows_survive_every_configuration(self) -> None:
        pending = self.add_row(STATUS_PENDING, entity="px", age_days=3650)
        future_blocked = self.add_row(STATUS_BLOCKED, entity="px", age_days=-1)
        future_confirmed = self.add_row(STATUS_CONFIRMED, entity="px", age_days=-2)

        result = self.run_prune(
            **{OPERATIONAL_RETENTION_KEY: 1, EVIDENCE_RETENTION_KEY: 1}
        )

        assert result.total_removed == 0
        assert set(self.remaining_ids("px")) == {
            pending,
            future_blocked,
            future_confirmed,
        }

    def test_a_future_dated_outcome_cannot_resolve_a_live_streak(self) -> None:
        """Clock skew must not reclassify: a future-dated confirmed row is
        excluded from streak computation, so the live streak keeps its
        age-exempt survivor instead of ageing out as 'resolved'."""
        blocked_since = self.add_row(STATUS_BLOCKED, entity="sk", age_days=500)
        self.add_row(STATUS_BLOCKED, entity="sk", age_days=400)
        skewed = self.add_row(STATUS_CONFIRMED, entity="sk", age_days=-30)

        result = self.run_prune()

        assert result.blocked_duplicates == 1
        assert result.operational_expired == 0
        assert set(self.remaining_ids("sk")) == {blocked_since, skewed}

    # -- Survivor invariant under boundary removal (the review's HIGH) ------

    def test_evidence_expiry_spares_a_boundary_that_still_bounds_blocked_rows(
        self,
    ) -> None:
        """Deleting the row that resolved a streak while its blocked rows
        survive would let the boundary recede, promoting them to a *current*
        streak whose new survivor is exempt from age-out forever — a
        permanent false 'blocked since' for a destroyed object. The boundary
        is therefore kept until its dependents are gone, which also makes an
        inverted (evidence < operational) window configuration safe."""
        blocked = [
            self.add_row(STATUS_BLOCKED, entity="bd", age_days=30) for _ in range(3)
        ]
        boundary = self.add_row(STATUS_CONFIRMED, entity="bd", age_days=20)

        # Evidence window far shorter than the operational one: the boundary
        # is past its cutoff, the blocked rows it resolved are not.
        first = self.run_prune(
            **{OPERATIONAL_RETENTION_KEY: 90, EVIDENCE_RETENTION_KEY: 1}
        )

        assert first.evidence_expired == 0
        assert set(self.remaining_ids("bd")) == {*blocked, boundary}

        # Once the blocked rows age out, the boundary bounds nothing and
        # becomes expirable — the guard defers, it does not immortalize.
        # Categories drain in order within one run, so the blocked rows go
        # first and the boundary follows in the same pass.
        second = self.run_prune(
            **{OPERATIONAL_RETENTION_KEY: 10, EVIDENCE_RETENTION_KEY: 1}
        )
        assert second.operational_expired == 3
        assert second.evidence_expired == 1
        assert self.remaining_ids("bd") == []

    def test_blocked_rows_without_an_entity_uuid_are_never_aged_out(self) -> None:
        """A uuid-less blocked row belongs to no streak, so it can never be
        proven a duplicate — pruning keeps it rather than deleting the only
        record of that blockage. Uuid-less *failed* rows still age out."""
        anonymous_block = self.add_row(STATUS_BLOCKED, entity=None, age_days=1000)
        self.add_row(STATUS_FAILED, entity=None, age_days=1000)

        result = self.run_prune()

        assert result.operational_expired == 1
        assert self.remaining_ids(None) == [anonymous_block]

    # -- US3: operator controls and observability ---------------------------

    def test_configured_retention_window_is_honored(self) -> None:
        kept = self.add_row(STATUS_FAILED, entity="w", age_days=5)
        self.add_row(STATUS_FAILED, entity="w", age_days=15)

        result = self.run_prune(**{OPERATIONAL_RETENTION_KEY: 10})

        assert result.operational_expired == 1
        assert self.remaining_ids("w") == [kept]

    def test_invalid_operational_window_skips_the_category_not_widens(self) -> None:
        """FR-005/SC-005: a zero window disables age-out (fail closed) while
        the age-independent dedup rule keeps working, and the invalid key is
        reported on the result."""
        old_failed = self.add_row(STATUS_FAILED, entity="iv", age_days=1000)
        self.add_row(STATUS_BLOCKED, entity="iv", age_days=3)
        self.add_row(STATUS_BLOCKED, entity="iv", age_days=2)

        result = self.run_prune(**{OPERATIONAL_RETENTION_KEY: 0})

        assert result.operational_expired == 0
        assert result.blocked_duplicates == 1
        assert result.invalid_config_keys == [OPERATIONAL_RETENTION_KEY]
        assert old_failed in self.remaining_ids("iv")

    def test_second_run_over_the_same_candidates_removes_and_reports_zero(self) -> None:
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
        assert second.total_removed == 0
        assert len(self.remaining_ids("cc")) == 1

    def test_a_status_change_between_selection_and_delete_spares_the_row(self) -> None:
        """The conditional delete's status re-check is the mechanism that
        makes concurrent runs safe: a row that is no longer what we selected
        is not matched, and the count reflects only what was removed."""
        blocked_id = self.add_row(STATUS_BLOCKED, entity="rc", age_days=2)
        other_id = self.add_row(STATUS_BLOCKED, entity="rc", age_days=1)

        # Simulate a racing writer finalizing the row after selection.
        db.session.execute(
            sa.update(PurgeAuditLog.__table__)
            .where(PurgeAuditLog.__table__.c.id == other_id)
            .values(status=STATUS_CONFIRMED)
        )
        db.session.commit()

        removed = prune_audit._delete_batch(
            [blocked_id, other_id], frozenset({STATUS_BLOCKED})
        )

        assert removed == 1
        assert self.remaining_ids("rc") == [other_id]
