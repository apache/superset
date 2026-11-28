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
"""Capture net chart archives without creating restorable content versions."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from time import perf_counter
from typing import Any
from uuid import UUID, uuid4

import sqlalchemy as sa
from sqlalchemy.engine import Connection, NestedTransaction, Transaction
from sqlalchemy.exc import DBAPIError, SQLAlchemyError
from sqlalchemy.orm import Session

from superset.utils.dates import naive_utcnow
from superset.versioning.changes.table import version_changes_table
from superset.versioning.db_errors import (
    is_lost_transaction_error,
    is_missing_table_error,
)
from superset.versioning.factory import transaction_actor_args
from superset.versioning.lifecycle_table import version_chart_archive_scope_table
from superset.versioning.metrics import emit_capture_timing, incr_capture_error

CHART_ARCHIVE_KIND = "__archive__"
_BATCH_SIZE = 500
logger = logging.getLogger(__name__)


class LifecycleCaptureFatalError(SQLAlchemyError):
    """Optional capture cannot prove the caller's transaction survived."""


def _check_transaction(connection: Connection, outer_transaction: Transaction) -> None:
    """Reject invalidated, replaced, or ended application transactions."""
    if (
        connection.invalidated
        or connection.closed
        or not outer_transaction.is_active
        or connection.get_transaction() is not outer_transaction
    ):
        raise LifecycleCaptureFatalError(
            "Archive capture lost its application transaction"
        )


def begin_capture_savepoint(
    connection: Connection, outer_transaction: Transaction
) -> NestedTransaction:
    """Establish an isolation boundary, propagating uncertain transaction state."""
    _check_transaction(connection, outer_transaction)
    try:
        return connection.begin_nested()
    except Exception as error:
        raise LifecycleCaptureFatalError(
            "Could not establish archive capture savepoint"
        ) from error


def release_capture_savepoint(
    connection: Connection, savepoint: NestedTransaction, outer_transaction: Transaction
) -> None:
    """Release successful work without swallowing lost savepoints."""
    _check_transaction(connection, outer_transaction)
    try:
        # This connection savepoint belongs to optional metadata, not the ORM unit.
        savepoint.commit()  # pylint: disable=consider-using-transaction
    except Exception as error:
        raise LifecycleCaptureFatalError(
            "Could not release archive capture savepoint"
        ) from error
    _check_transaction(connection, outer_transaction)


def rollback_capture_savepoint(
    connection: Connection,
    savepoint: NestedTransaction,
    outer_transaction: Transaction,
    error: Exception,
) -> None:
    """Prove a failed optional statement was isolated before allowing more SQL."""
    if isinstance(error, LifecycleCaptureFatalError):
        raise error
    if connection.invalidated or getattr(error, "connection_invalidated", False):
        raise LifecycleCaptureFatalError(
            "Archive capture connection was invalidated"
        ) from error
    if not savepoint.is_active:
        raise LifecycleCaptureFatalError(
            "Archive capture savepoint is no longer active"
        ) from error
    try:
        # Explicit recovery preserves both the statement and rollback failures.
        savepoint.rollback()  # pylint: disable=consider-using-transaction
    except Exception as rollback_error:
        # Keep both the original failure and failed recovery in the exception chain.
        try:
            raise rollback_error from error
        except Exception as chained_error:
            raise LifecycleCaptureFatalError(
                "Could not roll back archive capture savepoint"
            ) from chained_error
    _check_transaction(connection, outer_transaction)
    if is_lost_transaction_error(error):
        raise LifecycleCaptureFatalError(
            "Database reported lost archive capture transaction state"
        ) from error


@dataclass(frozen=True)
class ChartArchive:
    """The final identity and name of one observed active-to-archived transition."""

    chart_id: int
    chart_uuid: UUID
    chart_name: str | None


def collect_chart_archives(
    session: Session, initial_states: dict[tuple[str, int], tuple[Any, dict[str, Any]]]
) -> list[ChartArchive]:
    """Retain persisted net transitions, including an active insert flushed earlier."""
    archives = []
    for (kind, entity_id), (obj, before) in initial_states.items():
        if (
            kind != "chart"
            or "deleted_at" not in before
            or before["deleted_at"] is not None
        ):
            continue
        state = sa.inspect(obj)
        if (
            not state.persistent
            or state.session is not session
            or obj.deleted_at is None
            or obj.uuid is None
        ):
            continue
        archives.append(ChartArchive(entity_id, UUID(str(obj.uuid)), obj.slice_name))
    return archives


def _memberships(
    connection: Connection, chart_ids: list[int]
) -> dict[int, list[tuple[int, UUID]]]:
    """Read post-flush membership with Core, including archived dashboards."""
    from superset.models.dashboard import Dashboard, dashboard_slices

    dashboard = Dashboard.__table__
    memberships: dict[int, list[tuple[int, UUID]]] = {
        chart_id: [] for chart_id in chart_ids
    }
    result = connection.execute(
        sa.select(dashboard_slices.c.slice_id, dashboard.c.id, dashboard.c.uuid)
        .select_from(
            dashboard_slices.join(
                dashboard, dashboard_slices.c.dashboard_id == dashboard.c.id
            )
        )
        .where(dashboard_slices.c.slice_id.in_(chart_ids))
        .execution_options(stream_results=True)
    )
    try:
        for row in result:
            if row.uuid is not None:
                memberships[row.slice_id].append((row.id, row.uuid))
    finally:
        result.close()
    return memberships


def _write_archive(
    connection: Connection,
    transaction_id: int,
    archive: ChartArchive,
    memberships: list[tuple[int, UUID]],
) -> int:
    """Write one canonical event and every destination in bounded insert batches."""
    connection.execute(
        version_changes_table.insert().values(
            transaction_id=transaction_id,
            entity_kind="chart",
            entity_id=archive.chart_id,
            sequence=0,
            kind=CHART_ARCHIVE_KIND,
            operation="announce",
            path=["deleted_at"],
            from_value=None,
            to_value={
                "entity_uuid": str(archive.chart_uuid),
                "entity_name": archive.chart_name,
            },
        )
    )
    for offset in range(0, len(memberships), _BATCH_SIZE):
        connection.execute(
            version_chart_archive_scope_table.insert(),
            [
                {
                    "id": uuid4(),
                    "transaction_id": transaction_id,
                    "chart_id": archive.chart_id,
                    "chart_uuid": archive.chart_uuid,
                    "dashboard_id": dashboard_id,
                    "dashboard_uuid": dashboard_uuid,
                }
                for dashboard_id, dashboard_uuid in memberships[
                    offset : offset + _BATCH_SIZE
                ]
            ],
        )
    return len(memberships)


def _emit_counts(events: int, scopes: int) -> None:
    """Report captured volumes without entity identifiers."""
    try:
        from superset.extensions import stats_logger_manager

        stats_logger_manager.instance.gauge(
            "superset.versioning.capture.lifecycle.events", events
        )
        stats_logger_manager.instance.gauge(
            "superset.versioning.capture.lifecycle.scopes", scopes
        )
    except Exception:  # pylint: disable=broad-except
        logger.warning("versioning: failed to emit lifecycle counts")


def _capture_chunk(
    connection: Connection,
    outer_transaction: Transaction,
    transaction_id: int,
    chunk: list[ChartArchive],
) -> tuple[int, int]:
    """Isolate a membership query and each complete chart's metadata."""
    event_count = scope_count = 0
    membership_savepoint = begin_capture_savepoint(connection, outer_transaction)
    try:
        memberships = _memberships(connection, [archive.chart_id for archive in chunk])
    except Exception as error:  # pylint: disable=broad-except
        rollback_capture_savepoint(
            connection, membership_savepoint, outer_transaction, error
        )
        logger.exception("versioning: archive membership capture failed")
        incr_capture_error("lifecycle_membership")
        return 0, 0
    release_capture_savepoint(connection, membership_savepoint, outer_transaction)
    for archive in chunk:
        chart_savepoint = begin_capture_savepoint(connection, outer_transaction)
        try:
            scopes = _write_archive(
                connection,
                transaction_id,
                archive,
                memberships[archive.chart_id],
            )
        except Exception as error:  # pylint: disable=broad-except
            rollback_capture_savepoint(
                connection, chart_savepoint, outer_transaction, error
            )
            if not isinstance(error, DBAPIError) or not is_missing_table_error(error):
                logger.exception("versioning: chart archive capture failed")
            incr_capture_error("lifecycle_chart")
            continue
        release_capture_savepoint(connection, chart_savepoint, outer_transaction)
        event_count += 1
        scope_count += scopes
    return event_count, scope_count


def capture_chart_archives(session: Session, archives: list[ChartArchive]) -> None:
    """Capture optional metadata atomically per chart on the caller's connection."""
    if not archives:
        return
    from sqlalchemy_continuum import versioning_manager

    start = perf_counter()
    connection = session.connection()
    outer_transaction = connection.get_transaction()
    if outer_transaction is None:
        raise LifecycleCaptureFatalError(
            "Archive capture requires an application transaction"
        )
    outer_savepoint = begin_capture_savepoint(connection, outer_transaction)
    event_count = scope_count = 0
    try:
        transaction_table = versioning_manager.transaction_cls.__table__
        inserted = connection.execute(
            transaction_table.insert().values(
                issued_at=naive_utcnow(), action_kind=None, **transaction_actor_args()
            )
        )
        transaction_id = inserted.inserted_primary_key[0]
        for offset in range(0, len(archives), _BATCH_SIZE):
            chunk = archives[offset : offset + _BATCH_SIZE]
            events, scopes = _capture_chunk(
                connection, outer_transaction, transaction_id, chunk
            )
            event_count += events
            scope_count += scopes
        if event_count:
            release_capture_savepoint(connection, outer_savepoint, outer_transaction)
        else:
            rollback_capture_savepoint(
                connection,
                outer_savepoint,
                outer_transaction,
                RuntimeError("No archive events survived"),
            )
    except LifecycleCaptureFatalError:
        raise
    except Exception as error:  # pylint: disable=broad-except
        rollback_capture_savepoint(
            connection, outer_savepoint, outer_transaction, error
        )
        if not isinstance(error, DBAPIError) or not is_missing_table_error(error):
            logger.exception("versioning: archive transaction capture failed")
            incr_capture_error("lifecycle")
    finally:
        emit_capture_timing("lifecycle", (perf_counter() - start) * 1000)
        _emit_counts(event_count, scope_count)
