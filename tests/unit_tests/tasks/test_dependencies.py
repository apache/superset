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
"""Unit tests for GTF task dependencies (DAG): scheduler gate + cycle guard."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from superset_core.tasks.types import TaskStatus

from superset.commands.tasks.exceptions import (
    TaskCyclicDependencyError,
    TaskInvalidError,
)
from superset.commands.tasks.submit import SubmitTaskCommand


def _task(status: str = TaskStatus.PENDING.value, **kwargs):
    return SimpleNamespace(uuid=uuid4(), status=status, task_name=None, **kwargs)


class TestResolveFailedPrerequisite:
    """Tests for the scheduler's all_success prerequisite gate."""

    def test_no_dependencies_returns_none(self):
        from superset.tasks.scheduler import _resolve_failed_prerequisite

        assert _resolve_failed_prerequisite(SimpleNamespace(dependencies=[])) is None

    @patch("superset.tasks.scheduler.TaskManager.wait_for_completion")
    def test_all_success_returns_none(self, mock_wait):
        from superset.tasks.scheduler import _resolve_failed_prerequisite

        task = SimpleNamespace(dependencies=[_task(), _task()])
        mock_wait.return_value = SimpleNamespace(status=TaskStatus.SUCCESS.value)

        assert _resolve_failed_prerequisite(task) is None
        assert mock_wait.call_count == 2

    @patch("superset.tasks.scheduler.TaskManager.wait_for_completion")
    def test_already_terminal_prerequisites_skip_wait(self, mock_wait):
        """Prerequisites already terminal in the loaded snapshot need no DB wait."""
        from superset.tasks.scheduler import _resolve_failed_prerequisite

        # One already succeeded, one already failed → decided from the snapshot
        succeeded = _task(status=TaskStatus.SUCCESS.value)
        failed = _task(status=TaskStatus.FAILURE.value)
        assert (
            _resolve_failed_prerequisite(
                SimpleNamespace(dependencies=[succeeded, failed])
            )
            is failed
        )
        # All-terminal snapshot → wait_for_completion is never called
        assert (
            _resolve_failed_prerequisite(SimpleNamespace(dependencies=[succeeded]))
            is None
        )
        mock_wait.assert_not_called()

    @patch("superset.tasks.scheduler.TaskManager.wait_for_completion")
    def test_first_non_success_is_returned(self, mock_wait):
        from superset.tasks.scheduler import _resolve_failed_prerequisite

        task = SimpleNamespace(dependencies=[_task(), _task()])
        failed = SimpleNamespace(uuid=uuid4(), status=TaskStatus.FAILURE.value)
        mock_wait.side_effect = [
            SimpleNamespace(status=TaskStatus.SUCCESS.value),
            failed,
        ]

        assert _resolve_failed_prerequisite(task) is failed

    @patch("superset.tasks.scheduler.TaskManager.wait_for_completion")
    def test_missing_prerequisite_treated_as_failed(self, mock_wait):
        from superset.tasks.scheduler import _resolve_failed_prerequisite

        prerequisite = _task()
        task = SimpleNamespace(dependencies=[prerequisite])
        mock_wait.side_effect = ValueError("gone")

        # The (stale) prerequisite is returned rather than blocking/raising.
        assert _resolve_failed_prerequisite(task) is prerequisite


class TestExecuteTaskFailedPrerequisite:
    """execute_task's handling when a prerequisite did not succeed."""

    @staticmethod
    def _run_with_transition(*, transitioned: bool, refreshed_status: str):
        """Drive execute_task through the failed-prerequisite branch.

        Returns ``(result, publish_completion_mock)`` with the status transition
        forced to ``transitioned`` and the post-transition re-read reporting
        ``refreshed_status``.
        """
        native = uuid4()
        pending = SimpleNamespace(uuid=native, status=TaskStatus.PENDING.value)
        refreshed = SimpleNamespace(uuid=native, status=refreshed_status)
        failed_prereq = _task(status=TaskStatus.FAILURE.value)

        transition = MagicMock()
        transition.return_value.run.return_value = transitioned

        with (
            patch(
                "superset.tasks.scheduler.TaskDAO.find_one_or_none",
                side_effect=[pending, refreshed],
            ),
            patch(
                "superset.tasks.scheduler._resolve_failed_prerequisite",
                return_value=failed_prereq,
            ),
            patch("superset.tasks.scheduler.TaskManager") as task_manager,
            patch(
                "superset.commands.tasks.internal_update."
                "InternalStatusTransitionCommand",
                transition,
            ),
        ):
            from superset.tasks.scheduler import execute_task

            result = execute_task.run(str(native), "some.task", (), {})
            return result, task_manager.publish_completion

    def test_failure_published_when_transition_commits(self):
        result, publish_completion = self._run_with_transition(
            transitioned=True, refreshed_status=TaskStatus.PENDING.value
        )
        assert result["status"] == TaskStatus.FAILURE.value
        publish_completion.assert_called_once()

    def test_no_failure_published_when_task_already_terminal(self):
        # The task was aborted while waiting on prerequisites, so the FAILURE
        # transition is a no-op — report the committed status, publish no FAILURE.
        result, publish_completion = self._run_with_transition(
            transitioned=False, refreshed_status=TaskStatus.ABORTED.value
        )
        assert result["status"] == TaskStatus.ABORTED.value
        publish_completion.assert_not_called()


class TestPersistDependencies:
    """Tests for SubmitTaskCommand._persist_dependencies."""

    def test_no_depends_on_is_noop(self):
        dao = MagicMock()
        SubmitTaskCommand({})._persist_dependencies(_task(id=1), dao)
        dao.add_dependencies.assert_not_called()

    def test_self_dependency_by_uuid_raises(self):
        dao = MagicMock()
        task = _task(id=1)
        cmd = SubmitTaskCommand({"depends_on": [task.uuid]})
        with pytest.raises(TaskCyclicDependencyError):
            cmd._persist_dependencies(task, dao)

    def test_unknown_prerequisite_raises(self):
        dao = MagicMock()
        dao.find_by_uuids.return_value = []  # nothing resolves
        cmd = SubmitTaskCommand({"depends_on": [uuid4()]})
        with pytest.raises(TaskInvalidError):
            cmd._persist_dependencies(_task(id=1), dao)

    def test_happy_path_bulk_inserts_edges(self):
        u1, u2 = uuid4(), uuid4()
        dao = MagicMock()
        dao.find_by_uuids.return_value = [
            SimpleNamespace(uuid=u1, id=101),
            SimpleNamespace(uuid=u2, id=102),
        ]

        cmd = SubmitTaskCommand({"depends_on": [u1, u2]})
        cmd._persist_dependencies(_task(id=1), dao)

        # One bulk insert of all prerequisite ids (no per-edge round trips)
        dao.add_dependencies.assert_called_once_with(1, [101, 102])

    def test_duplicate_uuids_deduped(self):
        u1 = uuid4()
        dao = MagicMock()
        dao.find_by_uuids.return_value = [SimpleNamespace(uuid=u1, id=101)]

        cmd = SubmitTaskCommand({"depends_on": [u1, u1]})
        cmd._persist_dependencies(_task(id=1), dao)

        dao.add_dependencies.assert_called_once_with(1, [101])

    def test_accepts_task_entities_and_uuids(self):
        """depends_on accepts Task entities, UUIDs, and UUID strings."""
        u1, u2, u3 = uuid4(), uuid4(), uuid4()
        dao = MagicMock()
        dao.find_by_uuids.return_value = [
            SimpleNamespace(uuid=u1, id=101),  # referenced by entity
            SimpleNamespace(uuid=u2, id=102),  # referenced by UUID
            SimpleNamespace(uuid=u3, id=103),  # referenced by str
        ]

        # A Task-like entity (has .uuid), a raw UUID, and a UUID string.
        entity = SimpleNamespace(uuid=u1, id=101)
        cmd = SubmitTaskCommand({"depends_on": [entity, u2, str(u3)]})
        cmd._persist_dependencies(_task(id=1), dao)

        dao.add_dependencies.assert_called_once_with(1, [101, 102, 103])
        # find_by_uuids received normalized UUIDs, not entities/strings
        (resolved,), _ = dao.find_by_uuids.call_args
        assert set(resolved) == {u1, u2, u3}


def test_task_context_get_dependency_payloads_uses_dao() -> None:
    from superset.tasks.context import TaskContext

    task = _task()
    task.properties_dict = {}
    task.payload_dict = {}
    with patch("superset.tasks.context.current_app") as current_app:
        current_app.config = {"TASK_PROGRESS_UPDATE_THROTTLE_INTERVAL": 0}
        current_app._get_current_object.side_effect = RuntimeError()
        ctx = TaskContext(task)

    with patch("superset.daos.tasks.TaskDAO.get_dependency_payloads") as get_payloads:
        get_payloads.return_value = [{"cache_key": "parent-cache-key"}]

        assert ctx.get_dependency_payloads() == [{"cache_key": "parent-cache-key"}]

    get_payloads.assert_called_once_with(task.uuid)


def test_task_dao_get_dependency_payloads(app_context) -> None:
    from superset.daos.tasks import TaskDAO
    from superset.extensions import db
    from superset.models.task_dependencies import TaskDependency
    from superset.models.task_subscribers import TaskSubscriber
    from superset.models.tasks import Task

    parent_one = TaskDAO.create_task(
        task_type="test.parent",
        task_key=str(uuid4()),
        scope="shared",
        payload={"cache_key": "first"},
    )
    parent_two = TaskDAO.create_task(
        task_type="test.parent",
        task_key=str(uuid4()),
        scope="shared",
        payload={"cache_key": "second"},
    )
    child = TaskDAO.create_task(
        task_type="test.child",
        task_key=str(uuid4()),
        scope="shared",
    )
    db.session.flush()
    TaskDAO.add_dependencies(child.id, [parent_one.id, parent_two.id])
    db.session.commit()

    try:
        assert TaskDAO.get_dependency_payloads(child.uuid) == [
            {"cache_key": "first"},
            {"cache_key": "second"},
        ]

        parent_two.payload = "{not-json"
        db.session.commit()

        assert TaskDAO.get_dependency_payloads(child.uuid) == [
            {"cache_key": "first"},
            {},
        ]
    finally:
        db.session.query(TaskDependency).filter(
            TaskDependency.task_id == child.id
        ).delete(synchronize_session=False)
        db.session.query(TaskSubscriber).filter(
            TaskSubscriber.task_id.in_([parent_one.id, parent_two.id, child.id])
        ).delete(synchronize_session=False)
        db.session.query(Task).filter(
            Task.id.in_([parent_one.id, parent_two.id, child.id])
        ).delete(synchronize_session=False)
        db.session.commit()
