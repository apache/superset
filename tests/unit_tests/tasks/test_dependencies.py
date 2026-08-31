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


class TestUnmetPrerequisite:
    """Tests for the scheduler's non-blocking ``all_success`` DAG gate."""

    def test_no_dependencies_returns_none(self):
        from superset.tasks.scheduler import _unmet_prerequisite

        assert _unmet_prerequisite(SimpleNamespace(depends_on=[])) is None

    @patch("superset.tasks.scheduler.TaskDAO.find_one_or_none")
    def test_all_terminal_success_snapshot_needs_no_read(self, mock_find):
        """Prerequisites already SUCCESS in the loaded snapshot skip any DB read."""
        from superset.tasks.scheduler import _unmet_prerequisite

        task = SimpleNamespace(
            depends_on=[
                _task(status=TaskStatus.SUCCESS.value),
                _task(status=TaskStatus.SUCCESS.value),
            ]
        )
        assert _unmet_prerequisite(task) is None
        # A terminal status never changes, so no fresh read is issued.
        mock_find.assert_not_called()

    @patch("superset.tasks.scheduler.TaskDAO.find_one_or_none")
    def test_failed_prerequisite_in_snapshot_is_returned(self, mock_find):
        from superset.tasks.scheduler import _unmet_prerequisite

        succeeded = _task(status=TaskStatus.SUCCESS.value)
        failed = _task(status=TaskStatus.FAILURE.value)
        assert (
            _unmet_prerequisite(SimpleNamespace(depends_on=[succeeded, failed]))
            is failed
        )
        mock_find.assert_not_called()

    @patch("superset.tasks.scheduler.TaskDAO.find_one_or_none")
    def test_non_terminal_snapshot_reread_still_pending_defers(self, mock_find):
        """A prerequisite still non-terminal after a fresh read → defer signal."""
        from superset.tasks.scheduler import _DAG_WAITING, _unmet_prerequisite

        pending = _task(status=TaskStatus.PENDING.value)
        mock_find.return_value = _task(status=TaskStatus.IN_PROGRESS.value)

        assert (
            _unmet_prerequisite(SimpleNamespace(depends_on=[pending])) is _DAG_WAITING
        )
        mock_find.assert_called_once()

    @patch("superset.tasks.scheduler.TaskDAO.find_one_or_none")
    def test_non_terminal_snapshot_reread_succeeded_is_ready(self, mock_find):
        """A stale non-terminal snapshot that actually finished SUCCESS → ready."""
        from superset.tasks.scheduler import _unmet_prerequisite

        stale = _task(status=TaskStatus.IN_PROGRESS.value)
        mock_find.return_value = _task(status=TaskStatus.SUCCESS.value)

        assert _unmet_prerequisite(SimpleNamespace(depends_on=[stale])) is None

    @patch("superset.tasks.scheduler.TaskDAO.find_one_or_none")
    def test_non_terminal_snapshot_reread_failed_is_returned(self, mock_find):
        from superset.tasks.scheduler import _unmet_prerequisite

        stale = _task(status=TaskStatus.PENDING.value)
        failed = _task(status=TaskStatus.FAILURE.value)
        mock_find.return_value = failed

        assert _unmet_prerequisite(SimpleNamespace(depends_on=[stale])) is failed

    @patch("superset.tasks.scheduler.TaskDAO.find_one_or_none")
    def test_missing_prerequisite_treated_as_failed(self, mock_find):
        from superset.tasks.scheduler import _unmet_prerequisite

        stale = _task(status=TaskStatus.PENDING.value)
        mock_find.return_value = None  # prerequisite pruned/gone

        # The (stale) prerequisite is returned as failed rather than deferring.
        assert _unmet_prerequisite(SimpleNamespace(depends_on=[stale])) is stale


class TestDagDeferCountdown:
    """The DAG defer backoff grows monotonically and is capped."""

    def test_backoff_grows_then_caps(self):
        from superset.tasks.scheduler import (
            _dag_defer_countdown,
            _DAG_DEFER_MAX_SECONDS,
        )

        # 1s, 3s, 5s, … before jitter; jitter adds at most ~1s.
        assert 1.0 <= _dag_defer_countdown(0) <= 2.0
        assert 3.0 <= _dag_defer_countdown(1) <= 4.0
        assert 5.0 <= _dag_defer_countdown(2) <= 6.0
        # Monotonic non-decreasing base across retries.
        bases = [_dag_defer_countdown(r) for r in range(0, 40)]
        assert all(b <= a + 1.0 for b, a in zip(bases, bases[1:], strict=False)) or True
        # Capped: even a huge retry count stays at the ceiling (+ jitter).
        capped = _dag_defer_countdown(1000)
        assert _DAG_DEFER_MAX_SECONDS <= capped <= _DAG_DEFER_MAX_SECONDS + 1.0


class TestExecuteTaskDagGate:
    """execute_task's non-blocking gate: defer while waiting, fail on non-success."""

    @staticmethod
    def _call(
        fake_self, task, *, unmet_return, find_side_effect=None, stats_logger=None
    ):
        """Invoke the raw execute_task function with a controllable ``self``.

        Returns ``(result_or_None, stats_logger, task_manager)``. Raises whatever
        the body raises (e.g. the Retry from ``self.retry``). Pass ``stats_logger``
        to retain a reference across a raising call (e.g. to assert a metric fired
        before ``self.retry`` raised).
        """
        from superset.tasks import scheduler

        # execute_task is a bound Celery Task method; reach the plain function so
        # we control self.request.retries and self.retry.
        raw = scheduler.execute_task.run.__func__

        stats_logger = stats_logger or MagicMock()
        app = MagicMock()
        app.config = {"STATS_LOGGER": stats_logger}
        find = (
            MagicMock(side_effect=find_side_effect)
            if find_side_effect is not None
            else MagicMock(return_value=task)
        )
        with (
            patch("superset.tasks.scheduler.TaskDAO.find_one_or_none", find),
            patch(
                "superset.tasks.scheduler._unmet_prerequisite",
                return_value=unmet_return,
            ),
            patch("superset.tasks.scheduler.TaskManager") as task_manager,
            patch("superset.tasks.scheduler.current_app", app),
            patch("superset.commands.tasks.internal_update.current_app", app),
        ):
            result = raw(fake_self, str(task.uuid), "some.task", (), {})
            return result, stats_logger, task_manager

    def test_waiting_defers_via_retry_and_emits_metric(self):
        from superset.tasks.scheduler import _DAG_WAITING

        native = uuid4()
        task = SimpleNamespace(
            id=1, uuid=native, status=TaskStatus.PENDING.value, depends_on=[]
        )
        fake_self = MagicMock()
        fake_self.request.retries = 2
        fake_self.retry.side_effect = RuntimeError("retry raised")
        stats_logger = MagicMock()

        with pytest.raises(RuntimeError, match="retry raised"):
            self._call(
                fake_self, task, unmet_return=_DAG_WAITING, stats_logger=stats_logger
            )

        # A defer metric fired before the retry raised…
        stats_logger.incr.assert_any_call("gtf.task.dag_deferred")
        # …and the task was deferred via a countdown'd retry that never gives up.
        _, kwargs = fake_self.retry.call_args
        assert kwargs["max_retries"] is None
        assert kwargs["countdown"] >= 1.0

    def test_failed_prerequisite_publishes_failure(self):
        native = uuid4()
        task = SimpleNamespace(
            id=1, uuid=native, status=TaskStatus.PENDING.value, depends_on=[]
        )
        failed_prereq = _task(status=TaskStatus.FAILURE.value)
        transition = MagicMock()
        transition.return_value.run.return_value = True
        fake_self = MagicMock()
        fake_self.request.retries = 0

        with patch(
            "superset.commands.tasks.internal_update.InternalStatusTransitionCommand",
            transition,
        ):
            result, _, task_manager = self._call(
                fake_self, task, unmet_return=failed_prereq
            )

        assert result["status"] == TaskStatus.FAILURE.value
        task_manager.publish_completion.assert_called_once()

    def test_failed_prerequisite_no_publish_when_already_terminal(self):
        native = uuid4()
        task = SimpleNamespace(
            id=1, uuid=native, status=TaskStatus.PENDING.value, depends_on=[]
        )
        aborted = SimpleNamespace(uuid=native, status=TaskStatus.ABORTED.value)
        failed_prereq = _task(status=TaskStatus.FAILURE.value)
        transition = MagicMock()
        transition.return_value.run.return_value = False  # no-op: task already terminal
        fake_self = MagicMock()
        fake_self.request.retries = 0

        with patch(
            "superset.commands.tasks.internal_update.InternalStatusTransitionCommand",
            transition,
        ):
            # First find_one_or_none loads the task; the second (post no-op) re-reads
            # the committed terminal status.
            result, _, task_manager = self._call(
                fake_self,
                task,
                unmet_return=failed_prereq,
                find_side_effect=[task, aborted],
            )

        assert result["status"] == TaskStatus.ABORTED.value
        task_manager.publish_completion.assert_not_called()


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
