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
"""Celery beat task: purge soft-deleted entities past the retention window.

The deletion-domain analog of ``version_history.prune_old_versions``: where
that ages out version rows while keeping the live entity, this removes
entities that are already soft-deleted. For each
``SoftDeleteMixin`` model with a purge policy it selects rows whose
``deleted_at`` is older than the per-workspace window and runs the shared
cascade per entity, in bounded id-ordered batches. Convergent, not strictly
idempotent: a re-run with the same clock and data removes nothing, but rows
that have since crossed the cutoff are purged on a later run.
"""

from __future__ import annotations

import logging
from collections.abc import Iterator
from datetime import datetime, timedelta
from typing import Any, cast, NamedTuple
from uuid import UUID

import sqlalchemy as sa
from flask import current_app
from sqlalchemy.exc import DBAPIError

from superset import db
from superset.commands.deletion_retention import audit, prune_audit
from superset.commands.deletion_retention.purge_cascade import (
    cascade_hard_delete,
    CascadeResult,
    dashboard_slice_count,
    entity_uuid,
    suppress_purge_association_versions,
)
from superset.commands.deletion_retention.purge_policy import (
    BlockerReason,
    purge_policy_registry,
)
from superset.commands.deletion_retention.window import resolve_retention_window
from superset.extensions import celery_app, feature_flag_manager, stats_logger_manager
from superset.models.helpers import (
    skip_visibility_filter,
    SoftDeleteMixin,
)
from superset.tasks.retention_cap import validate_retention_cap

logger: logging.Logger = logging.getLogger(__name__)

_METRIC_PREFIX: str = "deletion_retention"
# Batch window for the eligible-id scan (SELECT ... LIMIT): bounds how many
# entities one iteration holds eligible before purging them one at a time.
_BATCH: int = 500


def _soft_delete_models() -> list[type[SoftDeleteMixin]]:
    """Return all registered soft-delete models in a stable order."""
    return list(SoftDeleteMixin._registered_subclasses)  # noqa: SLF001


def _ordered_purge_models(cutoff: datetime) -> list[type[SoftDeleteMixin]]:
    """Rotate daily priority so one busy model cannot starve later models."""
    models: list[type[SoftDeleteMixin]] = _soft_delete_models()
    if not models:
        return models
    start: int = cutoff.toordinal() % len(models)
    return models[start:] + models[:start]


def _model_table(model: type[SoftDeleteMixin]) -> sa.Table:
    """Return SQLAlchemy table metadata for a registered soft-delete model."""
    return cast(sa.Table, cast(Any, model).__table__)


def _model_table_name(model: type[SoftDeleteMixin]) -> str:
    """Return the table name for a registered soft-delete model."""
    return str(cast(Any, model).__tablename__)


def _iter_eligible_ids(
    model: type[SoftDeleteMixin], cutoff: datetime, batch: int
) -> Iterator[list[int]]:
    """Yield id-ordered batches of eligible row ids — ``deleted_at IS NOT NULL
    AND deleted_at < cutoff`` — querying with the visibility-filter bypass so
    soft-deleted rows are visible. Windowed by an ``id`` watermark so memory
    and lock-hold stay bounded on a large first run."""
    table = _model_table(model)
    after_id = 0
    while True:
        with skip_visibility_filter(db.session, model):
            ids = [
                row[0]
                for row in db.session.execute(
                    sa.select(table.c.id)
                    .where(table.c.deleted_at.is_not(None))
                    .where(table.c.deleted_at < cutoff)
                    .where(table.c.id > after_id)
                    .order_by(table.c.id)
                    .limit(batch)
                )
            ]
        if not ids:
            return
        yield ids
        if len(ids) < batch:
            return
        after_id = ids[-1]


def _reconcile_unless_dry_run(dry_run: bool) -> None:
    """Finalize stale pending audit rows, except during a dry run.

    Reconciliation is a durable write. A dry run is documented as reporting
    what *would* happen, so it must not resolve another run's audit attempts
    as a side effect — an operator sizing up a rollout would otherwise change
    the very record they are inspecting.
    """
    if not dry_run:
        audit.reconcile_pending()


def _report_model_counts(outcome: str, counts: dict[str, int]) -> None:
    """Emit the per-model row counts for a purge outcome."""
    entity_type: str
    count: int
    for entity_type, count in counts.items():
        stats_logger_manager.instance.gauge(
            f"{_METRIC_PREFIX}.{outcome}.{entity_type}", count
        )


def _count_eligible(model: type[SoftDeleteMixin], cutoff: datetime) -> int:
    """Count aged roots, including roots that a later cascade may block."""
    table: sa.Table = _model_table(model)
    with skip_visibility_filter(db.session, model):
        return int(
            db.session.scalar(
                sa.select(sa.func.count())
                .select_from(table)
                .where(table.c.deleted_at.is_not(None), table.c.deleted_at < cutoff)
            )
            or 0
        )


class _PurgeScan(NamedTuple):
    """Counts and supported models collected across one purge invocation."""

    purged: dict[str, int]
    would_purge: dict[str, int]
    unsupported_models: dict[str, int]
    failures: int
    blocked: int
    remaining_budget: int | None
    supported_models: list[type[SoftDeleteMixin]]
    scan_failures: int = 0
    attempted: int = 0
    commit_uncertain: bool = False


class _PurgeModelResult(NamedTuple):
    """Named per-root counts, including an indeterminate commit attempt."""

    purged: int
    would_purge: int
    failures: int
    blocked: int
    scan_failures: int
    commit_uncertain: bool = False


class _PurgeCommitUncertainError(RuntimeError):
    """The database did not acknowledge whether a root purge committed."""


def _scan_purge_models(
    cutoff: datetime, dry_run: bool, max_per_run: int | None
) -> _PurgeScan:
    """Apply one shared root budget across every supported model."""
    purged: dict[str, int] = {}
    would_purge: dict[str, int] = {}
    unsupported_models: dict[str, int] = {}
    failures: int = 0
    blocked: int = 0
    scan_failures: int = 0
    attempted: int = 0
    commit_uncertain: bool = False
    remaining_budget: int | None = max_per_run
    supported_models: list[type[SoftDeleteMixin]] = []

    for model in _ordered_purge_models(cutoff):
        attempted += 1
        entity_type: str = model.__name__
        try:
            entity_type = _model_table_name(model)
            if model not in purge_policy_registry():
                attempted -= 1
                unsupported_models[entity_type] = 1
                logger.warning(
                    "deletion_retention: skipping %s: no purge policy", entity_type
                )
                stats_logger_manager.instance.incr(
                    f"{_METRIC_PREFIX}.unsupported_models.{entity_type}"
                )
                continue
            supported_models.append(model)
            if remaining_budget == 0 and not dry_run:
                attempted -= 1
                continue
            counts: _PurgeModelResult = _purge_model(
                model,
                cutoff,
                dry_run,
                max_per_run=None if dry_run else remaining_budget,
            )
        except Exception:  # pylint: disable=broad-except
            db.session.rollback()  # pylint: disable=consider-using-transaction
            scan_failures += 1
            stats_logger_manager.instance.incr(
                f"{_METRIC_PREFIX}.scan_failures.{entity_type}"
            )
            logger.exception(
                "deletion_retention: %s could not be processed", entity_type
            )
            continue
        if remaining_budget is not None and not dry_run:
            # Reserve the possible commit even though it is not confirmed.
            remaining_budget -= counts.purged + int(counts.commit_uncertain)
        if counts.would_purge:
            would_purge[entity_type] = counts.would_purge
        if counts.purged:
            purged[entity_type] = counts.purged
        failures += counts.failures
        blocked += counts.blocked
        scan_failures += counts.scan_failures
        if counts.scan_failures:
            stats_logger_manager.instance.incr(
                f"{_METRIC_PREFIX}.scan_failures.{entity_type}"
            )
        if counts.commit_uncertain:
            commit_uncertain = True
            break

    return _PurgeScan(
        purged=purged,
        would_purge=would_purge,
        unsupported_models=unsupported_models,
        failures=failures,
        blocked=blocked,
        remaining_budget=remaining_budget,
        supported_models=supported_models,
        scan_failures=scan_failures,
        attempted=attempted,
        commit_uncertain=commit_uncertain,
    )


def _add_purge_cap_stats(
    stats: dict[str, Any],
    cutoff: datetime,
    scan: _PurgeScan,
    max_per_run: int | None,
) -> None:
    """Count remaining roots without masking a committed purge on failure."""
    if max_per_run is None:
        return
    remaining_eligible: int | None
    count_complete: bool = scan.scan_failures == 0 and not scan.commit_uncertain
    if count_complete:
        try:
            remaining_eligible = sum(
                _count_eligible(model, cutoff) for model in scan.supported_models
            )
        except Exception:  # pylint: disable=broad-except
            db.session.rollback()  # pylint: disable=consider-using-transaction
            logger.warning(
                "deletion_retention: remainder count failed after purge",
                exc_info=True,
            )
            stats_logger_manager.instance.incr(
                f"{_METRIC_PREFIX}.remainder_count_failed"
            )
            remaining_eligible = None
            count_complete = False
    else:
        remaining_eligible = None
    cap_reached: bool = scan.remaining_budget == 0
    stats.update(
        max_per_run=max_per_run,
        cap_reached=cap_reached,
        remaining_eligible=remaining_eligible,
        remaining_count_complete=count_complete,
    )
    if remaining_eligible is not None:
        stats_logger_manager.instance.gauge(
            f"{_METRIC_PREFIX}.remaining_eligible", remaining_eligible
        )
    stats_logger_manager.instance.gauge(
        f"{_METRIC_PREFIX}.remaining_count_complete", int(count_complete)
    )
    stats_logger_manager.instance.gauge(
        f"{_METRIC_PREFIX}.cap_reached", int(cap_reached)
    )


def _report_total_outage(every_root_failed: bool) -> None:
    """Trip the task-failure signal when no root could be scanned at all.

    Isolating one root's failure from the others is the point of that
    handling, but a pass in which *every* root failed is an outage rather
    than isolation -- and before the isolation existed it raised and
    incremented ``failed``. Keeping that increment preserves the alert for
    the case that still means what it used to.
    """
    if not every_root_failed:
        return
    logger.error(
        "deletion_retention: every root failed to scan; reporting the pass as failed"
    )
    stats_logger_manager.instance.incr(f"{_METRIC_PREFIX}.failed")


def _purge_impl(
    window_days: int, dry_run: bool, max_per_run: int | None = None
) -> dict[str, Any]:
    """Run one purge pass across all soft-delete models."""
    max_per_run = validate_retention_cap(max_per_run, "SOFT_DELETE_PURGE_MAX_PER_RUN")
    if window_days == 0 or window_days < -1:
        logger.info("deletion_retention: window is disabled or invalid; skipping")
        stats_logger_manager.instance.incr(f"{_METRIC_PREFIX}.skipped")
        return {"skipped": 1}

    # Same clock as SoftDeleteMixin.soft_delete(): deleted_at is stamped
    # with naive-local datetime.now() (mirroring changed_on per the
    # PR #33693 UTC revert), so the cutoff must be naive-local too — a
    # UTC-derived cutoff would shift the retention window by the server's
    # timezone offset, purging early west of UTC. If deleted_at ever moves
    # to UTC-aware, this must move with it.
    cutoff: datetime = (
        datetime.now()
        if window_days == -1
        else datetime.now() - timedelta(days=window_days)
    )
    _reconcile_unless_dry_run(dry_run)
    scan: _PurgeScan = _scan_purge_models(cutoff, dry_run, max_per_run)
    every_root_failed: bool = (
        scan.attempted > 0 and scan.scan_failures == scan.attempted
    )

    if dry_run:
        _report_model_counts("would_purge", scan.would_purge)
        logger.info("deletion_retention: DRY RUN would_purge=%s", scan.would_purge)
        backlog: int | None = (
            sum(scan.would_purge.values()) if scan.scan_failures == 0 else None
        )
        estimated_runs: int | None = None
        if backlog is not None:
            estimated_runs = (
                (backlog + max_per_run - 1) // max_per_run
                if max_per_run is not None
                else int(backlog > 0)
            )
        dry_stats: dict[str, Any] = {
            "dry_run": 1,
            "would_purge": scan.would_purge,
            "unsupported_models": scan.unsupported_models,
            "scan_failures": scan.scan_failures,
            "eligible_backlog": backlog,
            "backlog_count_complete": backlog is not None,
            "max_per_run": max_per_run,
            "estimated_capped_runs": estimated_runs,
        }
        if scan.scan_failures:
            stats_logger_manager.instance.gauge(
                f"{_METRIC_PREFIX}.scan_failures", scan.scan_failures
            )
        _report_total_outage(every_root_failed)
        return dry_stats

    _report_model_counts("purged", scan.purged)
    if scan.failures:
        stats_logger_manager.instance.incr(f"{_METRIC_PREFIX}.cascade_failures")
    if scan.blocked:
        stats_logger_manager.instance.gauge(
            f"{_METRIC_PREFIX}.blocked_by_reference", scan.blocked
        )
    if scan.scan_failures:
        stats_logger_manager.instance.gauge(
            f"{_METRIC_PREFIX}.scan_failures", scan.scan_failures
        )
    if scan.commit_uncertain:
        stats_logger_manager.instance.incr(f"{_METRIC_PREFIX}.commit_uncertain")
        stats_logger_manager.instance.incr(f"{_METRIC_PREFIX}.failed")
    _report_total_outage(every_root_failed)
    stats: dict[str, Any] = {
        "purged": scan.purged,
        "cascade_failures": scan.failures,
        "blocked_by_reference": scan.blocked,
        "unsupported_models": scan.unsupported_models,
        "scan_failures": scan.scan_failures,
        "commit_uncertain": scan.commit_uncertain,
    }
    _add_purge_cap_stats(stats, cutoff, scan, max_per_run)
    logger.info("deletion_retention: %s", stats)
    return stats


def _purge_model(  # noqa: C901
    model: type[SoftDeleteMixin],
    cutoff: datetime,
    dry_run: bool,
    max_per_run: int | None = None,
) -> _PurgeModelResult:
    """Process one model's eligible rows. A single entity's blocked/failed
    cascade never aborts the batch.

    A failure in the eligible-id scan itself -- a column it cannot read, a
    transient database error between pages -- ends this model's pass and is
    reported, but the counts earned before it are kept: by then those rows are
    committed deletions, and a summary that omitted them would understate what
    the run actually removed.
    """
    entity_type = _model_table_name(model)
    purged = would = failures = blocked = scan_failures = 0
    commit_uncertain: bool = False
    try:
        for id_batch in _iter_eligible_ids(model, cutoff, _BATCH):
            if dry_run:
                would += len(id_batch)
                continue
            for entity_id in id_batch:
                if max_per_run is not None and purged >= max_per_run:
                    break
                try:
                    result = _purge_one(model, entity_id, cutoff)
                    if result is not None and result.purged:
                        purged += 1
                    elif result is not None and result.blocked_reason is not None:
                        blocked += 1
                except _PurgeCommitUncertainError:
                    commit_uncertain = True
                    logger.exception(
                        "deletion_retention: commit outcome unknown for %s id=%s; "
                        "deferring remaining roots",
                        entity_type,
                        entity_id,
                    )
                    break
                except Exception:  # pylint: disable=broad-except
                    db.session.rollback()  # pylint: disable=consider-using-transaction
                    failures += 1
                    logger.exception(
                        "deletion_retention: cascade failed for %s id=%s",
                        entity_type,
                        entity_id,
                    )
            if commit_uncertain or (max_per_run is not None and purged >= max_per_run):
                break
    except Exception:  # pylint: disable=broad-except
        db.session.rollback()  # pylint: disable=consider-using-transaction
        scan_failures = 1
        logger.exception("deletion_retention: scan failed for %s", entity_type)
    return _PurgeModelResult(
        purged, would, failures, blocked, scan_failures, commit_uncertain
    )


def _finalize_blocked(record_id: UUID | None, blocker: BlockerReason) -> None:
    """Finalize a blocked retention outcome and count suppression metrics."""
    disposition: audit.RetentionBlockedDisposition = audit.finalize_retention_blocked(
        record_id, blocker.code
    )
    if disposition == "suppressed":
        stats_logger_manager.instance.incr(f"{_METRIC_PREFIX}.blocked_audit_suppressed")
    elif disposition == "fallback":
        stats_logger_manager.instance.incr(
            f"{_METRIC_PREFIX}.blocked_audit_dedupe_fallback"
        )


def _confirm_committed_purge(record_id: UUID | None, result: CascadeResult) -> None:
    """Keep a committed root counted even if audit finalization fails."""
    try:
        audit.confirm(
            record_id,
            affected_referrers=result.dangling_chart_uuids,
            removed_dashboard_slices=result.removed_dashboard_slices,
        )
    except Exception:  # pylint: disable=broad-except
        # The audit remains pending for its normal reconciliation path.
        logger.exception(
            "deletion_retention: audit finalization failed after committed purge"
        )


def _commit_purge_root(record_id: UUID | None) -> None:
    """Commit a purge, keeping uncertain outcomes pending for reconciliation."""
    try:
        db.session.commit()  # pylint: disable=consider-using-transaction
    except Exception as exc:
        try:
            db.session.rollback()  # pylint: disable=consider-using-transaction
        except Exception:  # pylint: disable=broad-except
            logger.exception("deletion_retention: rollback after commit error failed")
            raise _PurgeCommitUncertainError(
                "root purge rollback outcome unknown"
            ) from exc
        if isinstance(exc, DBAPIError) and not exc.connection_invalidated:
            # The valid connection rejected the commit; the root can be
            # recorded as failed without consuming the confirmed purge cap.
            logger.warning(
                "deletion_retention: definitive root purge commit failure (%s): %s",
                type(exc).__name__,
                exc.orig,
            )
            audit.fail(record_id)
            raise
        # A lost acknowledgement can follow a successful commit. Keep the
        # audit pending and defer remaining roots for reconciliation.
        raise _PurgeCommitUncertainError("root purge commit outcome unknown") from exc


def _purge_one(
    model: type[SoftDeleteMixin], entity_id: int, cutoff: datetime
) -> CascadeResult | None:
    """Purge a single entity in its own transaction with a write-ahead audit."""
    with skip_visibility_filter(db.session, model):
        entity = db.session.get(model, entity_id)
    if entity is None:
        return None
    entity_uuid_value = entity_uuid(entity)
    removed_dashboard_slices = dashboard_slice_count(db.session, entity)
    # The audit row commits on a separate connection. End the read transaction
    # before that write so SQLite can later promote this session to a writer.
    # Re-resolving below also ensures the cascade acts on post-audit state.
    db.session.rollback()  # pylint: disable=consider-using-transaction
    record_id = audit.write_ahead(
        trigger=audit.TRIGGER_RETENTION,
        actor=audit.ACTOR_SYSTEM,
        entity_type=_model_table_name(model),
        entity_uuid=entity_uuid_value,
        removed_dashboard_slices=removed_dashboard_slices,
    )
    if record_id is None:
        # Fail closed: the scheduled purge must not delete unauditably.
        # The entity stays soft-deleted and is retried next run; the
        # operator-invoked force-purge makes the opposite call (deletion
        # outranks audit when a human is present).
        raise RuntimeError(
            f"deletion_retention: write-ahead audit failed for "
            f"{_model_table_name(model)} id={entity_id}; skipping purge"
        )
    with skip_visibility_filter(db.session, model):
        entity = db.session.get(model, entity_id)
    if entity is None:
        audit.fail(record_id)
        return None
    if entity_uuid(entity) != entity_uuid_value:
        # The row under this id is not the row the audit describes. The
        # cascade's conditional claim would still refuse to purge anything
        # live, so this is an attribution guard rather than a destructive
        # one: without it, an id reused between the snapshot and here (SQLite
        # recycles rowids; sequences do not) could purge a genuinely eligible
        # entity while the audit names a different one. An audit row that
        # identifies the wrong object is worse than a skipped purge.
        logger.warning(
            "deletion_retention: %s id=%s changed identity before purge "
            "(expected uuid=%s); skipping",
            _model_table_name(model),
            entity_id,
            entity_uuid_value,
        )
        audit.fail(record_id)
        return None
    try:
        with suppress_purge_association_versions(db.session):
            result = cascade_hard_delete(
                db.session, entity, enforce_window=True, cutoff=cutoff
            )
        # Commit AFTER the suppression block: Continuum executes its
        # pending association statements during flush/commit, so the
        # block's exit-time trim must run first or a session carrying
        # versioned state would write the purge-queued shadows anyway.
        # Commit/rollback are managed manually so audit.fail() can record a
        # definitive pre-commit failure after the purge transaction resolves.
        db.session.flush()
    except Exception:
        db.session.rollback()  # pylint: disable=consider-using-transaction
        audit.fail(record_id)
        raise
    _commit_purge_root(record_id)
    if result.purged:
        _confirm_committed_purge(record_id, result)
    elif result.blocker is not None:
        _finalize_blocked(record_id, result.blocker)
    else:
        audit.fail(record_id)
    return result


#: Metric family for the prune task. The leaf matches the task name so an
#: operator grepping dashboards for ``prune_purge_audit`` finds its metrics.
_PRUNE_METRIC_PREFIX: str = "deletion_retention.prune_purge_audit"


@celery_app.task(name="deletion_retention.prune_purge_audit")
def prune_purge_audit() -> dict[str, Any]:
    """Beat entry point: apply the purge-audit retention policy once.

    Honors the master switch (a disabled run reports itself rather than
    silently doing nothing), isolates failures so one bad run does not
    poison the schedule, and mirrors the per-category removal counts into
    metrics plus one structured completion log line. Deliberately not gated
    on the SOFT_DELETE flag: audit rows persist even after the flag is
    turned off, and pruning an empty table is a no-op.
    """
    enabled: Any = current_app.config.get("PURGE_AUDIT_PRUNING_ENABLED", False)
    if enabled is not True:
        if enabled is not False:
            logger.warning(
                "prune_audit: invalid PURGE_AUDIT_PRUNING_ENABLED=%r; removing nothing",
                enabled,
            )
            stats_logger_manager.instance.incr(
                f"{_PRUNE_METRIC_PREFIX}.skipped_invalid_config"
            )
            return {"skipped_invalid_config": 1}
        logger.info(
            "prune_audit: disabled by PURGE_AUDIT_PRUNING_ENABLED; removing nothing"
        )
        stats_logger_manager.instance.incr(f"{_PRUNE_METRIC_PREFIX}.skipped_disabled")
        return {"skipped_disabled": 1}
    try:
        result: prune_audit.PruneRunResult = prune_audit.run_prune()
    except Exception:  # pylint: disable=broad-except
        # The session may be mid-transaction after a failed DELETE; leaving it
        # dirty would fail the next statement on a reused session rather than
        # here, where the traceback is.
        db.session.rollback()  # pylint: disable=consider-using-transaction
        logger.exception("deletion_retention.prune_purge_audit: task failed")
        stats_logger_manager.instance.incr(f"{_PRUNE_METRIC_PREFIX}.failed")
        return {"error": 1}
    if result.invalid_config_keys:
        stats_logger_manager.instance.incr(f"{_PRUNE_METRIC_PREFIX}.invalid_config")
    else:
        stats_logger_manager.instance.incr(f"{_PRUNE_METRIC_PREFIX}.success")
    result_dict: dict[str, Any] = result.as_dict()
    removed_counts: dict[str, int] = result_dict["removed"]
    for category, count in removed_counts.items():
        stats_logger_manager.instance.gauge(
            f"{_PRUNE_METRIC_PREFIX}.removed.{category}", count
        )
    # Backlog convergence (SC-004) is only observable if "the budget ran out
    # and rows remain" is a metric — a deployment producing prunable rows
    # faster than one run removes them otherwise shows healthy success
    # counters forever.
    stats_logger_manager.instance.gauge(
        f"{_PRUNE_METRIC_PREFIX}.carried_over", int(result.carried_over)
    )
    logger.info(
        "prune_audit: removed blocked_duplicates=%d operational_expired=%d "
        "evidence_expired=%d carried_over=%s invalid_config_keys=%s",
        result.blocked_duplicates,
        result.operational_expired,
        result.evidence_expired,
        result.carried_over,
        result.invalid_config_keys,
    )
    return result_dict


@celery_app.task(name="deletion_retention.purge_soft_deleted")
def purge_soft_deleted() -> dict[str, Any]:
    """Beat entry point. Resolves the window live, honors the SOFT_DELETE
    rollout gate and dry-run flag, and isolates failures so one bad run does
    not poison the schedule. The cap bounds committed root deletions, not
    candidate evaluations; blocked roots are re-evaluated on every run."""
    # While the temporary SOFT_DELETE rollout gate is off the delete path
    # writes no ``deleted_at`` rows, so the task already no-ops; check the gate
    # explicitly for clarity (the check is removed when the gate is).
    if not feature_flag_manager.is_feature_enabled("SOFT_DELETE"):
        logger.info("deletion_retention: SOFT_DELETE gate off; skipping")
        return {"skipped": 1}
    window_days = resolve_retention_window()
    dry_run = bool(current_app.config.get("SOFT_DELETE_PURGE_DRY_RUN", True))
    try:
        max_per_run: int | None = validate_retention_cap(
            current_app.config.get("SOFT_DELETE_PURGE_MAX_PER_RUN", 1000),
            "SOFT_DELETE_PURGE_MAX_PER_RUN",
        )
    except ValueError:
        logger.warning("deletion_retention: invalid purge cap; skipping")
        stats_logger_manager.instance.incr(f"{_METRIC_PREFIX}.skipped_invalid_cap")
        return {"skipped_invalid_cap": 1}
    try:
        return _purge_impl(window_days, dry_run, max_per_run=max_per_run)
    except Exception:  # pylint: disable=broad-except
        logger.exception("deletion_retention.purge_soft_deleted: task failed")
        stats_logger_manager.instance.incr(f"{_METRIC_PREFIX}.failed")
        return {"error": 1}
