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


class TestCheckNoCycle:
    """Tests for SubmitTaskCommand._check_no_cycle."""

    def test_no_cycle_passes(self):
        dao = MagicMock()
        dao.get_prerequisite_ids.return_value = []
        # Should not raise.
        SubmitTaskCommand._check_no_cycle(10, [1, 2], dao)

    def test_direct_self_reference_raises(self):
        dao = MagicMock()
        dao.get_prerequisite_ids.return_value = []
        with pytest.raises(TaskCyclicDependencyError):
            SubmitTaskCommand._check_no_cycle(10, [10], dao)

    def test_transitive_cycle_raises(self):
        dao = MagicMock()
        # Prerequisite 1 depends on 2, which depends back on the new task (10).
        dao.get_prerequisite_ids.side_effect = lambda tid: {1: [2], 2: [10]}.get(
            tid, []
        )
        with pytest.raises(TaskCyclicDependencyError):
            SubmitTaskCommand._check_no_cycle(10, [1], dao)


class TestPersistDependencies:
    """Tests for SubmitTaskCommand._persist_dependencies."""

    def test_no_depends_on_is_noop(self):
        dao = MagicMock()
        SubmitTaskCommand({})._persist_dependencies(_task(id=1), dao)
        dao.add_dependency.assert_not_called()

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

    def test_happy_path_inserts_edges(self):
        u1, u2 = uuid4(), uuid4()
        prereq1 = SimpleNamespace(uuid=u1, id=101)
        prereq2 = SimpleNamespace(uuid=u2, id=102)
        dao = MagicMock()
        dao.find_by_uuids.return_value = [prereq1, prereq2]
        dao.get_prerequisite_ids.return_value = []

        cmd = SubmitTaskCommand({"depends_on": [u1, u2]})
        cmd._persist_dependencies(_task(id=1), dao)

        assert dao.add_dependency.call_count == 2
        dao.add_dependency.assert_any_call(1, 101)
        dao.add_dependency.assert_any_call(1, 102)

    def test_duplicate_uuids_deduped(self):
        u1 = uuid4()
        prereq1 = SimpleNamespace(uuid=u1, id=101)
        dao = MagicMock()
        dao.find_by_uuids.return_value = [prereq1]
        dao.get_prerequisite_ids.return_value = []

        cmd = SubmitTaskCommand({"depends_on": [u1, u1]})
        cmd._persist_dependencies(_task(id=1), dao)

        dao.add_dependency.assert_called_once_with(1, 101)

    def test_accepts_task_entities_and_uuids(self):
        """depends_on accepts Task entities, UUIDs, and UUID strings."""
        u1, u2, u3 = uuid4(), uuid4(), uuid4()
        prereq1 = SimpleNamespace(uuid=u1, id=101)  # referenced by entity
        prereq2 = SimpleNamespace(uuid=u2, id=102)  # referenced by UUID
        prereq3 = SimpleNamespace(uuid=u3, id=103)  # referenced by str
        dao = MagicMock()
        dao.find_by_uuids.return_value = [prereq1, prereq2, prereq3]
        dao.get_prerequisite_ids.return_value = []

        # A Task-like entity (has .uuid), a raw UUID, and a UUID string.
        entity = SimpleNamespace(uuid=u1, id=101)
        cmd = SubmitTaskCommand({"depends_on": [entity, u2, str(u3)]})
        cmd._persist_dependencies(_task(id=1), dao)

        assert dao.add_dependency.call_count == 3
        # find_by_uuids received normalized UUIDs, not entities/strings
        (resolved,), _ = dao.find_by_uuids.call_args
        assert set(resolved) == {u1, u2, u3}
