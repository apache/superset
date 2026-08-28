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
from superset.daos.tasks import OrphanCandidate
from superset.utils import json

TEST_UUID = UUID("b8b61b7b-1cd3-4a31-a74a-0a95341afc06")


def _candidate(
    *, is_orphan: bool, celery_task_id: str | None = "celery-1"
) -> OrphanCandidate:
    properties = json.dumps(
        {"celery_task_id": celery_task_id} if celery_task_id else {}
    )
    return OrphanCandidate(
        id=1,
        uuid=TEST_UUID,
        status=TaskStatus.IN_PROGRESS.value,
        properties=properties,
        is_orphan=is_orphan,
    )


@contextmanager
def _patched(candidates, cas_result=True):
    """Patch the reaper's collaborators and yield the mocks it interacts with."""
    stats = MagicMock()
    app = MagicMock()
    app.config = {"STATS_LOGGER": stats, "GTF_ORPHAN_TASK_TIMEOUT": 60}
    with (
        patch("superset.commands.tasks.reap.current_app", app),
        patch("superset.commands.tasks.reap.db") as db,
        patch("superset.daos.tasks.TaskDAO.find_orphaned", return_value=candidates),
        patch(
            "superset.daos.tasks.TaskDAO.conditional_status_update",
            return_value=cas_result,
        ) as cas,
        patch("superset.commands.tasks.reap.celery_app") as celery,
        patch("superset.tasks.manager.TaskManager.publish_completion") as publish,
        patch("superset.tasks.manager.TaskManager.publish_entity_change"),
    ):
        # The fresh pre-CAS properties re-read returns the candidate's properties.
        properties = candidates[0].properties if candidates else "{}"
        db.session.query.return_value.filter.return_value.scalar.return_value = (
            properties
        )
        yield stats, cas, celery, publish


def test_orphan_is_revoked_failed_and_published() -> None:
    """A dead-worker orphan is revoked, forced to FAILURE, and completion published."""
    with _patched([_candidate(is_orphan=True)]) as (stats, cas, celery, publish):
        reaped = ReapOrphanedTasksCommand().run()

    assert reaped == 1
    celery.control.revoke.assert_called_once_with(
        "celery-1", terminate=True, signal="SIGUSR1"
    )
    # Forced to FAILURE, preserving the orphan error in properties.
    _args, kwargs = cas.call_args
    assert kwargs["properties"]["error_message"] == ORPHAN_ERROR_MESSAGE
    publish.assert_called_once_with(TEST_UUID, TaskStatus.FAILURE.value)
    stats.incr.assert_any_call("gtf.task.orphan_reaped")
    stats.incr.assert_any_call("gtf.task.revoke")


def test_wedged_abort_is_only_escalated() -> None:
    """A live wedged-ABORTING worker is force-revoked but not marked itself."""
    with _patched([_candidate(is_orphan=False)]) as (stats, cas, celery, publish):
        reaped = ReapOrphanedTasksCommand().run()

    assert reaped == 0
    celery.control.revoke.assert_called_once()
    cas.assert_not_called()  # the worker finalizes its own status
    publish.assert_not_called()
    stats.incr.assert_any_call("gtf.task.abort_escalated")


def test_cas_noop_does_not_publish() -> None:
    """A revived worker that already committed a terminal status wins the CAS race."""
    with _patched([_candidate(is_orphan=True)], cas_result=False) as (
        _stats,
        _cas,
        celery,
        publish,
    ):
        reaped = ReapOrphanedTasksCommand().run()

    assert reaped == 0
    celery.control.revoke.assert_called_once()
    publish.assert_not_called()


def test_missing_celery_id_skips_revoke_but_still_reaps() -> None:
    """A task with no stored Celery id is still reaped; revoke is simply skipped."""
    with _patched([_candidate(is_orphan=True, celery_task_id=None)]) as (
        _stats,
        _cas,
        celery,
        publish,
    ):
        reaped = ReapOrphanedTasksCommand().run()

    assert reaped == 1
    celery.control.revoke.assert_not_called()
    publish.assert_called_once_with(TEST_UUID, TaskStatus.FAILURE.value)
