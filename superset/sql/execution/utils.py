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
"""Shared SQL execution error, result cleanup, and stop finalization helpers."""

from __future__ import annotations

import logging
from collections.abc import Callable
from typing import TYPE_CHECKING

import sqlalchemy as sa

from superset import db
from superset.common.db_query_status import QueryStatus
from superset.constants import QUERY_EARLY_CANCEL_KEY, QUERY_TARGET_COMMITTED_KEY
from superset.errors import SupersetError
from superset.exceptions import SupersetErrorException, SupersetErrorsException
from superset.models.sql_lab import Query
from superset.utils import json
from superset.utils.dates import now_as_float

if TYPE_CHECKING:
    from flask_caching.backends.base import BaseCache

logger = logging.getLogger(__name__)


def _extract_errors(ex: Exception, query: Query) -> list[SupersetError]:
    """Extract DB-specific errors."""
    if isinstance(ex, SupersetErrorException):
        return [ex.error]
    if isinstance(ex, SupersetErrorsException):
        return ex.errors
    return query.database.db_engine_spec.extract_errors(
        str(ex), database_name=query.database.unique_name
    )


def _discard_stored_results(
    query_id: int, key: str | None, results_backend: BaseCache | None
) -> None:
    """
    Delete stored results whose key no committed query row will reference.

    That happens when a stop wins, or when the task cannot record its failure.
    The blob would only occupy the results backend until it expires. A failed
    delete is logged and does not change the query's outcome.
    """
    if not key or not results_backend:
        return
    try:
        deleted = results_backend.delete(key)
    except Exception:  # pylint: disable=broad-except
        logger.warning(
            "Query %s: Failed to delete unpublished results, key: %s",
            str(query_id),
            key,
            exc_info=True,
        )
        return
    if not deleted:
        logger.warning(
            "Query %s: Unpublished results were not deleted, key: %s",
            str(query_id),
            key,
        )


def _discard_unreferenced_results(
    query_id: int, key: str | None, results_backend: BaseCache | None
) -> None:
    """
    Delete stored results after a failure the task could not record, or after
    a stop wins the error path, unless the query row references them.

    A metadata commit can apply and still raise, for example when its
    acknowledgement is lost, and a stop can then land on the row that commit
    published. Uncommitted metadata is rolled back and the row is read again
    in a new transaction. If that read fails, the results are kept until they
    expire: an orphaned blob is safer than a committed row that references
    deleted results.
    """
    if not key or not results_backend:
        return
    try:
        db.session.rollback()  # pylint: disable=consider-using-transaction
        referenced_key = (
            db.session.query(Query.results_key).filter(Query.id == query_id).scalar()
        )
    except Exception:  # pylint: disable=broad-except
        logger.warning(
            "Query %s: Kept results that may be referenced, key: %s",
            str(query_id),
            key,
            exc_info=True,
        )
        return
    if referenced_key != key:
        _discard_stored_results(query_id, key, results_backend)


def stop_seen_during_execution(query: Query) -> bool:
    """
    Whether the session's copy of the query held a stop when execution returned.

    Engines that cancel a running statement on a stop (Hive, Impala, Presto) do
    so after loading the stop into this session, as do the checks between
    statements. Attributes expired by a commit count as unseen. This local
    observation cannot rule out a stop committed by another session; callers
    must also check the recorded state before publishing results.
    """
    attrs = sa.inspect(query).attrs
    if attrs.status.loaded_value == QueryStatus.STOPPED:
        return True
    extra_json = attrs.extra_json.loaded_value
    return bool(
        isinstance(extra_json, str)
        and extra_json
        and json.loads(extra_json).get(QUERY_EARLY_CANCEL_KEY)
    )


def set_query_stopped(query: Query, end_time: float) -> bool:
    """Stage a stop only if no completed outcome won the row's write lock.

    The caller commits the stop and any staged early-cancel flag together.
    A winning stop merges only that flag into freshly locked extra metadata.
    A losing stop discards its pending metadata with a locking refresh, which
    also sees the winning row under MySQL's REPEATABLE READ isolation.
    """
    with db.session.no_autoflush:
        early_cancel = query.extra.get(QUERY_EARLY_CANCEL_KEY)
        updated = (
            db.session.query(Query)
            .filter(
                Query.id == query.id,
                ~Query.status.in_(
                    [QueryStatus.SUCCESS, QueryStatus.FAILED, QueryStatus.TIMED_OUT]
                ),
            )
            .update(
                {Query.status: Query.status},
                synchronize_session=False,
            )
        )
        if not updated:
            db.session.refresh(query, with_for_update=True)
            return False
        # The update holds the write lock through commit. Discard stale ORM
        # metadata and merge only stop intent into the worker's latest extra.
        db.session.refresh(query, with_for_update=True)
        if query.extra.get(QUERY_TARGET_COMMITTED_KEY) is True:
            return False
        if query.status != QueryStatus.STOPPED:
            query.status = QueryStatus.STOPPED
            query.end_time = end_time
        elif query.end_time is None:
            query.end_time = end_time
        if early_cancel:
            query.set_extra_json_key(QUERY_EARLY_CANCEL_KEY, True)
    return True


def commit_query_unless_stopped(query: Query) -> bool:
    """Atomically guard execution metadata writes against a concurrent stop."""
    with db.session.no_autoflush:
        # The conditional write acquires the row's write lock until commit.
        # A separate status read cannot protect the subsequent ORM flush.
        updated = (
            db.session.query(Query)
            .filter(Query.id == query.id, Query.status != QueryStatus.STOPPED)
            .update({Query.status: query.status}, synchronize_session=False)
        )
        if not updated:
            # A locking read also sees the latest row under REPEATABLE READ.
            db.session.refresh(query, with_for_update=True)
            return False
    db.session.commit()  # pylint: disable=consider-using-transaction
    return True


def commit_target_transaction(query: Query, commit: Callable[[], None]) -> bool:
    """Serialize the last Stop check and target commit on the metadata row.

    Postgres/MySQL hold the row lock until the target-committed marker is
    durable. A Stop's guarded update waits, then declines that marker even
    while result serialization is still running. SQLite ignores FOR UPDATE;
    it retains a check-to-commit window. Neither database can make the two
    commits atomic in the face of a metadata commit failure.
    """
    with db.session.no_autoflush:
        db.session.refresh(query, attribute_names=["status"], with_for_update=True)
        if query.status == QueryStatus.STOPPED:
            db.session.refresh(query)
            return False
        commit()
        query.set_extra_json_key(QUERY_TARGET_COMMITTED_KEY, True)
        return commit_query_unless_stopped(query)


def finish_query_stop(query: Query, cancel: Callable[[], bool]) -> bool:
    """Publish Stop before cancellation; later failures cannot reject acceptance.

    The caller has staged a guarded Stop. Only the first commit determines
    acceptance. Cancellation and its optional early-cancel metadata are
    best-effort after that point. An already-stopped row stays accepted without
    retrying engine cancellation.
    """
    query_id = query.id
    end_time = query.end_time
    # The guarded locking refresh makes this history reflect the durable row.
    # Reusing a stored cancel handle after Stop could cancel an unrelated session.
    first_stop = sa.inspect(query).attrs.status.history.has_changes()
    db.session.commit()  # pylint: disable=consider-using-transaction
    if not first_stop:
        return True
    try:
        try:
            engine_cancelled = cancel()
        except Exception:  # pylint: disable=broad-except
            logger.warning(
                "Query %s: Stop accepted; engine cancellation not confirmed",
                query_id,
                exc_info=True,
            )
        else:
            if not engine_cancelled:
                logger.warning(
                    "Query %s: Stop accepted; engine cancellation not confirmed",
                    query_id,
                )
        stopped = set_query_stopped(query, end_time or now_as_float())
        db.session.commit()  # pylint: disable=consider-using-transaction
        return stopped
    except Exception:  # pylint: disable=broad-except
        logger.warning(
            "Query %s: Stop accepted; cancellation metadata was not recorded",
            query_id,
            exc_info=True,
        )
        db.session.rollback()  # pylint: disable=consider-using-transaction
        # Keep acceptance readable even if the metadata database is unavailable
        # after the first commit. These are committed values, not staged writes.
        sa.orm.attributes.set_committed_value(query, "status", QueryStatus.STOPPED)
        sa.orm.attributes.set_committed_value(query, "end_time", end_time)
        return True
