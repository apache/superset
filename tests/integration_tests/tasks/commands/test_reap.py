# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file to you under
# the Apache License, Version 2.0 (the "License"); you may not
# use this file except in compliance with the License.  You may obtain
# a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

from datetime import timedelta
from unittest.mock import patch

from superset_core.tasks.types import TaskScope, TaskStatus

from superset import db
from superset.commands.tasks.reap import ORPHAN_ERROR_MESSAGE, ReapOrphanedTasksCommand
from superset.daos.tasks import TaskDAO
from superset.models.tasks import Task
from superset.tasks.utils import naive_utcnow


def _make_task(
    admin,
    key,
    status,
    *,
    heartbeat_offset=None,
    celery_task_id=None,
    cancel_handle=None,
):
    """Create a task in a given state with an optional heartbeat age (seconds)."""
    task = TaskDAO.create_task(
        task_type="test_type",
        task_key=key,
        scope=TaskScope.PRIVATE,
        user_id=admin.id,
    )
    task.created_by = admin
    task.set_status(status)
    if heartbeat_offset is not None:
        task.last_heartbeat = naive_utcnow() - timedelta(seconds=heartbeat_offset)
    if celery_task_id is not None:
        task.update_framework_private({"celery_task_id": celery_task_id})
    if cancel_handle is not None:
        database_id, cancel_query_id = cancel_handle
        # The engine cancel handle lives in the task-owned ``private["task"]``
        # namespace (where the executor's ``set_cancellation`` writes it and the
        # reaper reads it), not at the top level of ``properties``.
        task.update_task_private(
            {"cancel_database_id": database_id, "cancel_query_id": cancel_query_id}
        )
    db.session.commit()
    return task


def _cleanup(*tasks):
    for task in tasks:
        existing = db.session.get(Task, task.id)
        if existing:
            db.session.delete(existing)
    db.session.commit()


def test_touch_heartbeat_does_not_advance_changed_on(
    app_context, get_user, login_as
) -> None:
    """A heartbeat write must not bump changed_on (would reset polling backoff)."""
    login_as("admin")
    admin = get_user("admin")
    task = _make_task(admin, "hb_task", TaskStatus.IN_PROGRESS)
    # Read changed_on back from the DB first so the baseline is at the column's
    # storage precision (MySQL DATETIME truncates to whole seconds), otherwise the
    # post-refresh comparison below spuriously differs from the in-memory value.
    db.session.refresh(task)
    original_changed_on = task.changed_on
    try:
        TaskDAO.touch_heartbeat(task.id)
        db.session.refresh(task)
        assert task.last_heartbeat is not None
        assert task.changed_on == original_changed_on
    finally:
        _cleanup(task)


def test_find_orphaned_selects_only_stale_active_tasks(
    app_context, get_user, login_as
) -> None:
    """Orphans = ACTIVE tasks with a stale, non-null heartbeat; nothing else."""
    login_as("admin")
    admin = get_user("admin")

    stale = _make_task(admin, "stale", TaskStatus.IN_PROGRESS, heartbeat_offset=600)
    fresh = _make_task(admin, "fresh", TaskStatus.IN_PROGRESS, heartbeat_offset=0)
    never_started = _make_task(admin, "queued", TaskStatus.PENDING)  # null heartbeat
    finished = _make_task(admin, "done", TaskStatus.SUCCESS, heartbeat_offset=600)
    try:
        found = set(TaskDAO.find_orphaned(60))
        assert stale.uuid in found
        assert fresh.uuid not in found
        assert never_started.uuid not in found
        assert finished.uuid not in found
    finally:
        _cleanup(stale, fresh, never_started, finished)


def test_reap_marks_orphan_failed_and_revokes(app_context, get_user, login_as) -> None:
    """End-to-end: the reaper forces a stale in-progress task to FAILURE."""
    login_as("admin")
    admin = get_user("admin")
    orphan = _make_task(
        admin,
        "orphan",
        TaskStatus.IN_PROGRESS,
        heartbeat_offset=600,
        celery_task_id="celery-xyz",
    )
    try:
        with patch("superset.commands.tasks.reap.celery_app") as celery:
            reaped = ReapOrphanedTasksCommand().run()

        assert reaped == 1
        celery.control.revoke.assert_called_once_with("celery-xyz")
        db.session.refresh(orphan)
        assert orphan.status == TaskStatus.FAILURE.value
        assert orphan.ended_at is not None
        assert orphan.properties_dict["error_message"] == ORPHAN_ERROR_MESSAGE
    finally:
        _cleanup(orphan)


def test_reap_cancels_orphaned_query_when_handle_present(
    app_context, get_user, login_as
) -> None:
    """A reaped orphan with a persisted cancel handle → the query is cancelled."""
    from superset.models.core import Database

    login_as("admin")
    admin = get_user("admin")
    database = db.session.query(Database).first()
    assert database is not None
    orphan = _make_task(
        admin,
        "orphan_with_query",
        TaskStatus.IN_PROGRESS,
        heartbeat_offset=600,
        cancel_handle=(database.id, "backend-pid-42"),
    )
    try:
        with (
            patch("superset.commands.tasks.reap.celery_app"),
            patch("superset.tasks.query_cancel.cancel_chart_query") as cancel,
        ):
            ReapOrphanedTasksCommand().run()

        cancel.assert_called_once()
        called_db, called_id = cancel.call_args.args
        assert called_db.id == database.id
        assert called_id == "backend-pid-42"
        db.session.refresh(orphan)
        assert orphan.status == TaskStatus.FAILURE.value
    finally:
        _cleanup(orphan)
