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

from collections.abc import Callable
from datetime import timedelta
from functools import partial
from typing import Any
from unittest.mock import patch
from uuid import UUID, uuid4

import sqlalchemy as sa
from flask import current_app
from sqlalchemy.orm import Query

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
from tests.integration_tests.deletion_retention._base import (
    ensure_purge_audit_coordination,
)

_PREFIX: str = "prune_audit_it_"
_ENTITY_TYPE: str = f"{_PREFIX}slices"


class TestPruneAudit(SupersetTestCase):
    """Behavioral coverage for ``prune_audit.run_prune``."""

    _seq: int

    def setUp(self) -> None:
        super().setUp()
        ensure_purge_audit_coordination()
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
        row: PurgeAuditLog = PurgeAuditLog(
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
        query: Query[PurgeAuditLog] = db.session.query(PurgeAuditLog).filter(
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
        """Keep only the earliest row in a current blockage streak."""
        ids: list[UUID] = [
            self.add_row(STATUS_BLOCKED, age_days=5 - i / 100) for i in range(50)
        ]

        result: prune_audit.PruneRunResult = self.run_prune()

        assert result.blocked_duplicates == 49
        assert result.carried_over is False
        assert self.remaining_ids("e1") == [ids[0]]

    def test_backlog_converges_over_bounded_runs(self) -> None:
        """Drain oversized backlogs across bounded successive runs."""
        for i in range(56):
            self.add_row(STATUS_BLOCKED, age_days=3 - i / 1000)

        removed_per_run: list[int] = []
        with (
            patch.object(prune_audit, "BATCH_SIZE", 10),
            patch.object(prune_audit, "MAX_BATCHES_PER_RUN", 2),
        ):
            while True:
                result: prune_audit.PruneRunResult = self.run_prune()
                removed_per_run.append(result.blocked_duplicates)
                if not result.carried_over:
                    break

        assert sum(removed_per_run) == 55  # every duplicate, none of the survivor
        assert all(n <= 20 for n in removed_per_run)  # never exceeds the budget
        assert removed_per_run[-1] > 0  # carryover is not reported spuriously
        assert len(self.remaining_ids("e1")) == 1  # the survivor

    def test_dedup_never_crosses_entities(self) -> None:
        a_ids: list[UUID] = [
            self.add_row(STATUS_BLOCKED, entity="a", age_days=2) for _ in range(3)
        ]
        b_ids: list[UUID] = [
            self.add_row(STATUS_BLOCKED, entity="b", age_days=2) for _ in range(4)
        ]

        result: prune_audit.PruneRunResult = self.run_prune()

        assert result.blocked_duplicates == 5
        assert self.remaining_ids("a") == [a_ids[0]]
        assert self.remaining_ids("b") == [b_ids[0]]

    def test_resolved_streak_has_no_survivor_and_ages_out(self) -> None:
        """Expire blocked rows after newer evidence resolves their streak."""
        for _ in range(3):
            self.add_row(STATUS_BLOCKED, age_days=200)
        confirmed: UUID = self.add_row(STATUS_CONFIRMED, age_days=100)
        new_survivor: UUID = self.add_row(STATUS_BLOCKED, age_days=50)
        self.add_row(STATUS_BLOCKED, age_days=40)  # duplicate in the new streak

        result: prune_audit.PruneRunResult = self.run_prune()

        assert result.blocked_duplicates == 1
        assert result.operational_expired == 3
        assert set(self.remaining_ids("e1")) == {confirmed, new_survivor}

    def test_a_failed_attempt_does_not_reset_the_blocked_since_survivor(self) -> None:
        """Keep one blockage streak across a failed purge attempt."""
        blocked_since: UUID = self.add_row(STATUS_BLOCKED, age_days=200)
        self.add_row(STATUS_FAILED, age_days=150)  # ages out as operational
        self.add_row(STATUS_BLOCKED, age_days=100)
        self.add_row(STATUS_BLOCKED, age_days=50)

        result: prune_audit.PruneRunResult = self.run_prune()

        assert result.blocked_duplicates == 2
        assert result.operational_expired == 1
        assert self.remaining_ids("e1") == [blocked_since]

    # -- US2: evidence survives by default ----------------------------------

    def test_defaults_leave_completed_destruction_evidence_untouched(self) -> None:
        evidence: list[UUID] = [
            self.add_row(STATUS_CONFIRMED, entity="ev", age_days=3650),
            self.add_row(STATUS_TARGET_ABSENT, entity="ev", age_days=1000),
            self.add_row(STATUS_CONFIRMED, entity="ev", age_days=1),
        ]
        self.add_row(STATUS_FAILED, entity="ev", age_days=365)  # ages out

        for _ in range(3):  # any sequence of runs (SC-002)
            result: prune_audit.PruneRunResult = self.run_prune()

        assert result.evidence_expired == 0
        assert set(self.remaining_ids("ev")) == set(evidence)

    def test_evidence_opt_in_expires_only_rows_older_than_its_window(self) -> None:
        old: UUID = self.add_row(STATUS_CONFIRMED, entity="ev", age_days=400)
        young: UUID = self.add_row(STATUS_TARGET_ABSENT, entity="ev", age_days=300)

        result: prune_audit.PruneRunResult = self.run_prune(
            **{EVIDENCE_RETENTION_KEY: 365}
        )

        assert result.evidence_expired == 1
        assert self.remaining_ids("ev") == [young]
        assert old not in self.remaining_ids("ev")

    def test_opt_in_disabled_again_removes_no_further_evidence(self) -> None:
        self.add_row(STATUS_CONFIRMED, entity="ev", age_days=400)
        survivor: UUID = self.add_row(STATUS_CONFIRMED, entity="ev", age_days=390)

        first: prune_audit.PruneRunResult = self.run_prune(
            **{EVIDENCE_RETENTION_KEY: 395}
        )
        assert first.evidence_expired == 1

        second: prune_audit.PruneRunResult = self.run_prune(
            **{EVIDENCE_RETENTION_KEY: None}
        )
        assert second.evidence_expired == 0
        assert self.remaining_ids("ev") == [survivor]

    def test_pending_and_future_rows_survive_every_configuration(self) -> None:
        pending: UUID = self.add_row(STATUS_PENDING, entity="px", age_days=3650)
        future_blocked: UUID = self.add_row(STATUS_BLOCKED, entity="px", age_days=-1)
        future_confirmed: UUID = self.add_row(
            STATUS_CONFIRMED, entity="px", age_days=-2
        )

        result: prune_audit.PruneRunResult = self.run_prune(
            **{OPERATIONAL_RETENTION_KEY: 1, EVIDENCE_RETENTION_KEY: 1}
        )

        assert result.total_removed == 0
        assert set(self.remaining_ids("px")) == {
            pending,
            future_blocked,
            future_confirmed,
        }

    def test_a_future_dated_outcome_cannot_resolve_a_live_streak(self) -> None:
        """Exclude future-dated evidence from current streak boundaries."""
        blocked_since: UUID = self.add_row(STATUS_BLOCKED, entity="sk", age_days=500)
        self.add_row(STATUS_BLOCKED, entity="sk", age_days=400)
        skewed: UUID = self.add_row(STATUS_CONFIRMED, entity="sk", age_days=-30)

        result: prune_audit.PruneRunResult = self.run_prune()

        assert result.blocked_duplicates == 1
        assert result.operational_expired == 0
        assert set(self.remaining_ids("sk")) == {blocked_since, skewed}

    # -- Survivor invariant under boundary removal (the review's HIGH) ------

    def test_evidence_expiry_spares_a_boundary_that_still_bounds_blocked_rows(
        self,
    ) -> None:
        """Keep evidence while it still bounds surviving blocked rows."""
        blocked: list[UUID] = [
            self.add_row(STATUS_BLOCKED, entity="bd", age_days=30) for _ in range(3)
        ]
        boundary: UUID = self.add_row(STATUS_CONFIRMED, entity="bd", age_days=20)

        # Evidence window far shorter than the operational one: the boundary
        # is past its cutoff, the blocked rows it resolved are not.
        first: prune_audit.PruneRunResult = self.run_prune(
            **{OPERATIONAL_RETENTION_KEY: 90, EVIDENCE_RETENTION_KEY: 1}
        )

        assert first.evidence_expired == 0
        assert set(self.remaining_ids("bd")) == {*blocked, boundary}

        # Once the blocked rows age out, the boundary bounds nothing and
        # becomes expirable — the guard defers, it does not immortalize.
        # Categories drain in order within one run, so the blocked rows go
        # first and the boundary follows in the same pass.
        second: prune_audit.PruneRunResult = self.run_prune(
            **{OPERATIONAL_RETENTION_KEY: 10, EVIDENCE_RETENTION_KEY: 1}
        )
        assert second.operational_expired == 3
        assert second.evidence_expired == 1
        assert self.remaining_ids("bd") == []

    def test_a_block_after_an_unresolved_attempt_is_not_treated_as_a_duplicate(
        self,
    ) -> None:
        """An in-flight attempt is a boundary waiting to happen.

        Finalizing a ``pending`` row resolves it *in place*, keeping its
        original timestamp — the one way a boundary can appear in the middle
        of history. The blocked row after it would become the new streak's
        survivor, so it must not be classified as a duplicate while the
        attempt is unresolved. Deleting it would destroy the only record
        that the entity was still blocked after that attempt.
        """
        blocked_since: UUID = self.add_row(STATUS_BLOCKED, entity="ua", age_days=100)
        attempt: UUID = self.add_row(STATUS_PENDING, entity="ua", age_days=50)
        later_block: UUID = self.add_row(STATUS_BLOCKED, entity="ua", age_days=10)

        result: prune_audit.PruneRunResult = self.run_prune()

        assert result.blocked_duplicates == 0
        assert set(self.remaining_ids("ua")) == {blocked_since, attempt, later_block}

        # Once the attempt finalizes, the boundary is real: the later block
        # is the new streak's survivor and stays; the older block is now a
        # resolved-streak row that ages out on the normal window.
        db.session.execute(
            sa.update(PurgeAuditLog.__table__)
            .where(PurgeAuditLog.__table__.c.id == attempt)
            .values(status=STATUS_CONFIRMED)
        )
        db.session.commit()

        after: prune_audit.PruneRunResult = self.run_prune()

        assert after.blocked_duplicates == 0
        assert after.operational_expired == 1  # the pre-attempt block
        assert set(self.remaining_ids("ua")) == {attempt, later_block}

    def test_age_does_not_make_an_unstable_block_expirable(self) -> None:
        """Keep aged blocked rows whose classification remains unstable.

        Seeded entirely outside the retention window, so only the guard —
        not the cutoff — can save the row.
        """
        blocked_since: UUID = self.add_row(STATUS_BLOCKED, entity="ao", age_days=100)
        attempt: UUID = self.add_row(STATUS_PENDING, entity="ao", age_days=98)
        later_block: UUID = self.add_row(STATUS_BLOCKED, entity="ao", age_days=95)

        result: prune_audit.PruneRunResult = self.run_prune()

        assert result.blocked_duplicates == 0
        assert result.operational_expired == 0
        assert set(self.remaining_ids("ao")) == {blocked_since, attempt, later_block}

        # Resolving the attempt makes the boundary real: the later block is
        # the current streak's survivor and is exempt regardless of age,
        # while the pre-attempt block ages out.
        db.session.execute(
            sa.update(PurgeAuditLog.__table__)
            .where(PurgeAuditLog.__table__.c.id == attempt)
            .values(status=STATUS_TARGET_ABSENT)
        )
        db.session.commit()

        after: prune_audit.PruneRunResult = self.run_prune()

        assert after.operational_expired == 1
        assert set(self.remaining_ids("ao")) == {attempt, later_block}

    def test_evidence_guard_also_defers_to_an_unresolved_older_attempt(self) -> None:
        """Treat an older pending attempt as potential blocked evidence."""
        attempt: UUID = self.add_row(STATUS_PENDING, entity="ug", age_days=400)
        boundary: UUID = self.add_row(STATUS_CONFIRMED, entity="ug", age_days=300)

        result: prune_audit.PruneRunResult = self.run_prune(
            **{EVIDENCE_RETENTION_KEY: 200}
        )

        assert result.evidence_expired == 0
        assert set(self.remaining_ids("ug")) == {attempt, boundary}

    def test_blocked_rows_without_an_entity_uuid_are_never_aged_out(self) -> None:
        """Keep UUID-less blocked rows that cannot be proven redundant."""
        anonymous_block: UUID = self.add_row(STATUS_BLOCKED, entity=None, age_days=1000)
        self.add_row(STATUS_FAILED, entity=None, age_days=1000)

        result: prune_audit.PruneRunResult = self.run_prune()

        assert result.operational_expired == 1
        assert self.remaining_ids(None) == [anonymous_block]

    # -- US3: operator controls and observability ---------------------------

    def test_configured_retention_window_is_honored(self) -> None:
        kept: UUID = self.add_row(STATUS_FAILED, entity="w", age_days=5)
        self.add_row(STATUS_FAILED, entity="w", age_days=15)

        result: prune_audit.PruneRunResult = self.run_prune(
            **{OPERATIONAL_RETENTION_KEY: 10}
        )

        assert result.operational_expired == 1
        assert self.remaining_ids("w") == [kept]

    def test_invalid_operational_window_skips_the_category_not_widens(self) -> None:
        """Fail closed when the operational retention window is invalid."""
        old_failed: UUID = self.add_row(STATUS_FAILED, entity="iv", age_days=1000)
        self.add_row(STATUS_BLOCKED, entity="iv", age_days=3)
        self.add_row(STATUS_BLOCKED, entity="iv", age_days=2)

        result: prune_audit.PruneRunResult = self.run_prune(
            **{OPERATIONAL_RETENTION_KEY: 0}
        )

        assert result.operational_expired == 0
        assert result.blocked_duplicates == 1
        assert result.invalid_config_keys == [OPERATIONAL_RETENTION_KEY]
        assert old_failed in self.remaining_ids("iv")

    def test_second_run_over_the_same_candidates_removes_and_reports_zero(self) -> None:
        """Report zero when rerunning over an already-pruned history."""
        for _ in range(4):
            self.add_row(STATUS_BLOCKED, entity="cc", age_days=2)
        self.add_row(STATUS_FAILED, entity="cc", age_days=100)

        first: prune_audit.PruneRunResult = self.run_prune()
        assert first.blocked_duplicates == 3
        assert first.operational_expired == 1

        second: prune_audit.PruneRunResult = self.run_prune()
        assert second.total_removed == 0
        assert len(self.remaining_ids("cc")) == 1

    def test_a_duplicate_backlog_cannot_starve_the_age_based_categories(self) -> None:
        """Prevent duplicate backlogs from starving age-based categories."""
        for _ in range(20):
            self.add_row(STATUS_BLOCKED, entity="st", age_days=2)
        old_failed: UUID = self.add_row(STATUS_FAILED, entity="st", age_days=1000)

        with (
            patch.object(prune_audit, "BATCH_SIZE", 1),
            patch.object(prune_audit, "MAX_BATCHES_PER_RUN", 2),
        ):
            result: prune_audit.PruneRunResult = self.run_prune()

        assert result.blocked_duplicates == 1  # budget-limited, as expected
        assert result.operational_expired == 1  # but age-out still progressed
        assert result.carried_over is True
        assert old_failed not in self.remaining_ids("st")

    def test_delete_rechecks_survivor_after_a_pending_attempt_appears(self) -> None:
        """Evaluate survivor safety inside the DELETE statement.

        Constructing the candidate query must not freeze its result. A pending
        attempt committed before execution can become a mid-history boundary,
        so the later blocked row must remain available as its future survivor.
        """
        blocked_since: UUID = self.add_row(STATUS_BLOCKED, entity="rc", age_days=3)
        later_block: UUID = self.add_row(STATUS_BLOCKED, entity="rc", age_days=1)
        select_candidates: Callable[[int], sa.sql.Select] = partial(
            prune_audit._duplicate_candidates, audit.utc_now()
        )

        attempt: UUID = self.add_row(STATUS_PENDING, entity="rc", age_days=2)
        removed: int = prune_audit._delete_batch(select_candidates)

        assert removed == 0
        assert set(self.remaining_ids("rc")) == {
            blocked_since,
            attempt,
            later_block,
        }
