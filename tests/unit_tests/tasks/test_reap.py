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
"""Unit tests for ReapOrphanedTasksCommand."""

from contextlib import contextmanager
from unittest.mock import MagicMock, patch
from uuid import UUID

from superset_core.tasks.types import TaskStatus

from superset.commands.tasks.reap import ORPHAN_ERROR_MESSAGE, ReapOrphanedTasksCommand
from superset.utils import json

TEST_UUID = UUID("b8b61b7b-1cd3-4a31-a74a-0a95341afc06")
_UNSET = object()


@contextmanager
def _patched(*, celery_task_id="celery-1", cas_result=True):
    """Patch the reaper's collaborators; yield the mocks it interacts with."""
    stats = MagicMock()
    app = MagicMock()
    app.config = {"STATS_LOGGER": stats, "GTF_ORPHAN_TASK_TIMEOUT": 60}
    properties = json.dumps(
        {"private": {"framework": {"celery_task_id": celery_task_id}}}
        if celery_task_id
        else {}
    )
    with (
        patch("superset.commands.tasks.reap.current_app", app),
        patch("superset.commands.tasks.reap.db") as db,
        patch("superset.daos.tasks.TaskDAO.find_orphaned", return_value=[TEST_UUID]),
        patch(
            "superset.daos.tasks.TaskDAO.conditional_status_update",
            return_value=cas_result,
        ) as cas,
        patch("superset.commands.tasks.reap.celery_app") as celery,
        patch("superset.tasks.manager.TaskManager.publish_completion") as publish,
        patch("superset.tasks.manager.TaskManager.publish_entity_change"),
    ):
        # The pre-CAS properties re-read returns the orphan's current properties.
        db.session.query.return_value.filter.return_value.scalar.return_value = (
            properties
        )
        yield stats, cas, celery, publish


def test_orphan_is_failed_published_and_revoked() -> None:
    """A dead-worker orphan is forced to FAILURE, published, and its job revoked."""
    with _patched() as (stats, cas, celery, publish):
        reaped = ReapOrphanedTasksCommand().run()

    assert reaped == 1
    # Revoke is non-terminating: no forced signal into a (possibly healthy) process.
    celery.control.revoke.assert_called_once_with("celery-1")
    _args, kwargs = cas.call_args
    assert kwargs["properties"]["error_message"] == ORPHAN_ERROR_MESSAGE
    publish.assert_called_once_with(TEST_UUID, TaskStatus.FAILURE.value)
    stats.incr.assert_any_call("gtf.task.orphan_reaped")
    stats.incr.assert_any_call("gtf.task.revoke")


def test_cas_noop_leaves_revived_worker_untouched() -> None:
    """A revived worker that already committed a terminal status wins the CAS race.

    The reaper must not publish — and, critically, must not revoke the job or
    cancel the query, since the worker is healthy (destructive cleanup is gated
    on winning the CAS).
    """
    with _patched(cas_result=False) as (_stats, _cas, celery, publish):
        reaped = ReapOrphanedTasksCommand().run()

    assert reaped == 0
    celery.control.revoke.assert_not_called()
    publish.assert_not_called()


def test_missing_celery_id_skips_revoke_but_still_reaps() -> None:
    """A task with no stored Celery id is still reaped; revoke is simply skipped."""
    with _patched(celery_task_id=None) as (_stats, _cas, celery, publish):
        reaped = ReapOrphanedTasksCommand().run()

    assert reaped == 1
    celery.control.revoke.assert_not_called()
    publish.assert_called_once_with(TEST_UUID, TaskStatus.FAILURE.value)


@contextmanager
def _patched_with_handle(
    properties: str, database: object = _UNSET, *, cas_result: bool = True
):
    """Patch collaborators with a specific serialized `properties` blob."""
    stats = MagicMock()
    app = MagicMock()
    app.config = {"STATS_LOGGER": stats, "GTF_ORPHAN_TASK_TIMEOUT": 60}
    resolved_db = MagicMock() if database is _UNSET else database
    with (
        patch("superset.commands.tasks.reap.current_app", app),
        patch("superset.commands.tasks.reap.db") as db,
        patch("superset.daos.tasks.TaskDAO.find_orphaned", return_value=[TEST_UUID]),
        patch(
            "superset.daos.tasks.TaskDAO.conditional_status_update",
            return_value=cas_result,
        ),
        patch("superset.commands.tasks.reap.celery_app"),
        patch("superset.tasks.manager.TaskManager.publish_completion"),
        patch("superset.tasks.manager.TaskManager.publish_entity_change"),
        patch("superset.tasks.query_cancel.cancel_chart_query") as cancel,
    ):
        db.session.query.return_value.filter.return_value.scalar.return_value = (
            properties
        )
        db.session.get.return_value = resolved_db
        yield cancel, resolved_db


def test_orphaned_query_is_cancelled_when_handle_present() -> None:
    """A persisted cancel handle → the reaper cancels the abandoned query."""
    properties = json.dumps(
        {
            "private": {
                "framework": {"celery_task_id": "c1"},
                "task": {"cancel_query_id": "42", "cancel_database_id": 7},
            }
        }
    )
    with _patched_with_handle(properties) as (cancel, database):
        assert ReapOrphanedTasksCommand().run() == 1

    cancel.assert_called_once_with(database, "42")


def test_no_cancel_when_handle_absent() -> None:
    """No cancel handle in properties → no query cancellation attempted."""
    properties = json.dumps({"private": {"framework": {"celery_task_id": "c1"}}})
    with _patched_with_handle(properties) as (cancel, _db):
        assert ReapOrphanedTasksCommand().run() == 1

    cancel.assert_not_called()


def test_no_cancel_when_database_missing() -> None:
    """Handle present but the database is gone → skip cancel, still reap."""
    properties = json.dumps(
        {"private": {"task": {"cancel_query_id": "42", "cancel_database_id": 7}}}
    )
    with _patched_with_handle(properties, database=None) as (cancel, _db):
        assert ReapOrphanedTasksCommand().run() == 1

    cancel.assert_not_called()


def test_no_cancel_when_worker_wins_cas() -> None:
    """R1: destructive cleanup is gated on winning the CAS.

    A stalled-but-healthy worker that revives and commits its own terminal status
    beats the reaper's CAS; the reaper must then leave its warehouse query alone.
    """
    properties = json.dumps(
        {"private": {"task": {"cancel_query_id": "42", "cancel_database_id": 7}}}
    )
    with _patched_with_handle(properties, cas_result=False) as (cancel, _db):
        assert ReapOrphanedTasksCommand().run() == 0

    cancel.assert_not_called()


def test_reap_orphaned_tasks_beat_task_delegates_to_command() -> None:
    """The reap_orphaned_tasks beat task runs the reaper (its own schedule)."""
    from superset.tasks.scheduler import reap_orphaned_tasks

    with (
        patch("superset.tasks.scheduler.current_app") as app,
        patch("superset.tasks.scheduler.ReapOrphanedTasksCommand") as cmd,
    ):
        app.config = {"STATS_LOGGER": MagicMock()}
        reap_orphaned_tasks()

    cmd.return_value.run.assert_called_once()
