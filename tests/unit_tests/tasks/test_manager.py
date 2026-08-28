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
"""Unit tests for TaskManager.

Since PR #43316, the pub/sub-wake-else-poll orchestration lives in
``CoordinationService`` (``publish`` / ``wait_for_signal`` / ``listen_for_signal``);
the tests here cover TaskManager's thin GTF-facing layer: channel naming, publishing
task signals through the service, and delegating waits/abort-listens to it.
"""

import uuid
from unittest.mock import MagicMock, patch

import pytest
import redis

from superset.tasks.manager import TaskManager
from superset.utils import json

GET_BACKEND = "superset.coordination.base.CoordinationService.get_backend"


def _reset_prefixes() -> None:
    TaskManager._initialized = False
    TaskManager._channel_prefix = "gtf:abort:"
    TaskManager._completion_channel_prefix = "gtf:complete:"


class TestTaskManagerInitApp:
    """Tests for TaskManager.init_app()"""

    def setup_method(self):
        _reset_prefixes()

    def teardown_method(self):
        _reset_prefixes()

    def test_init_app_sets_channel_prefixes(self):
        """Test init_app reads channel prefixes from config"""
        app = MagicMock()
        app.config.get.side_effect = lambda key, default=None: {
            "TASKS_ABORT_CHANNEL_PREFIX": "custom:abort:",
            "TASKS_COMPLETION_CHANNEL_PREFIX": "custom:complete:",
        }.get(key, default)

        TaskManager.init_app(app)

        assert TaskManager._initialized is True
        assert TaskManager._channel_prefix == "custom:abort:"
        assert TaskManager._completion_channel_prefix == "custom:complete:"

    def test_init_app_skips_if_already_initialized(self):
        """Test init_app is idempotent"""
        TaskManager._initialized = True

        app = MagicMock()
        TaskManager.init_app(app)

        app.config.get.assert_not_called()


class TestTaskManagerChannels:
    """Tests for the abort/completion channel naming."""

    def setup_method(self):
        _reset_prefixes()

    def teardown_method(self):
        _reset_prefixes()

    def test_get_abort_channel(self):
        assert TaskManager.get_abort_channel("abc-123") == "gtf:abort:abc-123"

    def test_get_abort_channel_custom_prefix(self):
        TaskManager._channel_prefix = "custom:prefix:"
        assert TaskManager.get_abort_channel("test-uuid") == "custom:prefix:test-uuid"

    def test_get_completion_channel(self):
        assert TaskManager.get_completion_channel("abc-123") == "gtf:complete:abc-123"

    def test_get_completion_channel_custom_prefix(self):
        TaskManager._completion_channel_prefix = "custom:complete:"
        assert (
            TaskManager.get_completion_channel("test-uuid")
            == "custom:complete:test-uuid"
        )


class TestTaskManagerPublish:
    """publish_abort / publish_completion route through CoordinationService."""

    def setup_method(self):
        _reset_prefixes()

    def teardown_method(self):
        _reset_prefixes()

    @patch(GET_BACKEND, return_value=None)
    def test_publish_abort_no_backend(self, mock_backend):
        assert TaskManager.publish_abort("test-uuid") is False

    @patch(GET_BACKEND)
    def test_publish_abort_success(self, mock_get_backend):
        backend = MagicMock()
        backend.xadd.return_value = "1-0"
        mock_get_backend.return_value = backend

        assert TaskManager.publish_abort("test-uuid") is True
        backend.xadd.assert_called_once_with(
            "gtf:abort:test-uuid", {"m": "abort"}, "*", 1
        )
        backend.expire.assert_called_once()

    @patch(GET_BACKEND)
    def test_publish_abort_redis_error(self, mock_get_backend):
        backend = MagicMock()
        backend.xadd.side_effect = redis.RedisError("Connection lost")
        mock_get_backend.return_value = backend

        assert TaskManager.publish_abort("test-uuid") is False

    @patch(GET_BACKEND, return_value=None)
    def test_publish_completion_no_backend(self, mock_backend):
        assert TaskManager.publish_completion("test-uuid", "success") is False

    @patch(GET_BACKEND)
    def test_publish_completion_success(self, mock_get_backend):
        backend = MagicMock()
        backend.xadd.return_value = "1-0"
        mock_get_backend.return_value = backend

        assert TaskManager.publish_completion("test-uuid", "success") is True
        backend.xadd.assert_called_once_with(
            "gtf:complete:test-uuid", {"m": "success"}, "*", 1
        )
        backend.expire.assert_called_once()

    @patch(GET_BACKEND)
    def test_publish_completion_redis_error(self, mock_get_backend):
        backend = MagicMock()
        backend.xadd.side_effect = redis.RedisError("Connection lost")
        mock_get_backend.return_value = backend

        assert TaskManager.publish_completion("test-uuid", "success") is False


class TestTaskManagerEntityChange:
    """publish_entity_change emits one opaque nudge to the per-type channel."""

    def setup_method(self):
        _reset_prefixes()

    def teardown_method(self):
        _reset_prefixes()

    IS_DEFINED = "superset.coordination.base.CoordinationService.is_backend_defined"
    PUBLISH = "superset.coordination.base.CoordinationService.publish"
    GET_ID = "superset.daos.tasks.TaskDAO.get_id"

    @patch(IS_DEFINED, return_value=False)
    def test_no_backend(self, mock_defined):
        assert TaskManager.publish_entity_change(uuid.uuid4()) is False

    @patch(GET_ID, return_value=42)
    @patch(PUBLISH)
    @patch(IS_DEFINED, return_value=True)
    def test_publishes_opaque_nudge_to_per_type_channel(
        self, mock_defined, mock_publish, mock_get_id
    ):
        assert TaskManager.publish_entity_change(uuid.uuid4()) is True

        # One publish to the task type's channel, carrying ONLY opaque ids (the
        # integer primary key) - no status or payload (the contract is general
        # across all entity types).
        mock_publish.assert_called_once()
        channel, message = mock_publish.call_args.args[:2]
        assert channel == "entity-changes:task"
        assert json.loads(message) == {"entity_type": "task", "id": 42}

    @patch(GET_ID, return_value=None)
    @patch(PUBLISH)
    @patch(IS_DEFINED, return_value=True)
    def test_missing_task_is_noop(self, mock_defined, mock_publish, mock_get_id):
        assert TaskManager.publish_entity_change(uuid.uuid4()) is False
        mock_publish.assert_not_called()

    @patch(GET_ID, return_value=42)
    @patch(PUBLISH, side_effect=redis.RedisError("boom"))
    @patch(IS_DEFINED, return_value=True)
    def test_redis_error_is_swallowed(self, mock_defined, mock_publish, mock_get_id):
        assert TaskManager.publish_entity_change(uuid.uuid4()) is False


class TestTaskManagerPublishDependentsChanged:
    """publish_dependents_changed nudges each task that depends on the given task."""

    IS_DEFINED = "superset.coordination.base.CoordinationService.is_backend_defined"
    GET_DEPENDENTS = "superset.daos.tasks.TaskDAO.get_dependent_uuids"
    PUBLISH_ENTITY = "superset.tasks.manager.TaskManager.publish_entity_change"

    @patch(GET_DEPENDENTS)
    @patch(IS_DEFINED, return_value=False)
    def test_no_backend_skips_lookup(self, mock_defined, mock_get_dependents):
        TaskManager.publish_dependents_changed(uuid.uuid4())
        mock_get_dependents.assert_not_called()

    @patch(PUBLISH_ENTITY)
    @patch(IS_DEFINED, return_value=True)
    def test_nudges_each_dependent(self, mock_defined, mock_publish_entity):
        dependents = [uuid.uuid4(), uuid.uuid4()]
        with patch(self.GET_DEPENDENTS, return_value=dependents):
            TaskManager.publish_dependents_changed(uuid.uuid4())
        assert mock_publish_entity.call_count == 2
        assert {c.args[0] for c in mock_publish_entity.call_args_list} == set(
            dependents
        )

    @patch(PUBLISH_ENTITY)
    @patch(IS_DEFINED, return_value=True)
    def test_no_dependents_is_noop(self, mock_defined, mock_publish_entity):
        with patch(self.GET_DEPENDENTS, return_value=[]):
            TaskManager.publish_dependents_changed(uuid.uuid4())
        mock_publish_entity.assert_not_called()


class TestTaskManagerPublishTaskStatus:
    """publish_task_status emits one fanout message carrying subscribers."""

    def setup_method(self):
        _reset_prefixes()

    def teardown_method(self):
        _reset_prefixes()

    IS_DEFINED = "superset.coordination.base.CoordinationService.is_backend_defined"
    PUBLISH = "superset.coordination.base.CoordinationService.publish"
    DAO = "superset.daos.tasks.TaskDAO"

    @patch(IS_DEFINED, return_value=False)
    def test_no_backend(self, mock_defined):
        assert TaskManager.publish_task_status(uuid.uuid4(), "success") is False

    @patch(DAO)
    @patch(PUBLISH)
    @patch(IS_DEFINED, return_value=True)
    def test_publishes_one_status_message_with_subscribers(
        self, mock_defined, mock_publish, mock_dao
    ):
        task_uuid = uuid.uuid4()
        mock_dao.find_one_or_none.return_value = MagicMock(id=7)
        mock_dao.get_subscriber_principals.return_value = [
            {"principal_type": "user", "sub": "1"},
            {"principal_type": "guest", "sub": "guest:abc"},
        ]

        assert TaskManager.publish_task_status(task_uuid, "success") is True

        mock_dao.get_subscriber_principals.assert_called_once_with(7)
        mock_publish.assert_called_once()
        channel, message = mock_publish.call_args.args[:2]
        assert channel == "task-status"
        assert json.loads(message) == {
            "task_id": str(task_uuid),
            "status": "success",
            "subscribers": [
                {"principal_type": "user", "sub": "1"},
                {"principal_type": "guest", "sub": "guest:abc"},
            ],
        }

    @patch(DAO)
    @patch(PUBLISH)
    @patch(IS_DEFINED, return_value=True)
    def test_no_subscribers_is_noop(self, mock_defined, mock_publish, mock_dao):
        mock_dao.find_one_or_none.return_value = MagicMock(id=7)
        mock_dao.get_subscriber_principals.return_value = []

        assert TaskManager.publish_task_status(uuid.uuid4(), "success") is False
        mock_publish.assert_not_called()

    @patch(DAO)
    @patch(PUBLISH)
    @patch(IS_DEFINED, return_value=True)
    def test_task_not_found_is_noop(self, mock_defined, mock_publish, mock_dao):
        mock_dao.find_one_or_none.return_value = None

        assert TaskManager.publish_task_status(uuid.uuid4(), "success") is False
        mock_publish.assert_not_called()

    @patch(DAO)
    @patch(PUBLISH, side_effect=redis.RedisError("boom"))
    @patch(IS_DEFINED, return_value=True)
    def test_redis_error_is_swallowed(self, mock_defined, mock_publish, mock_dao):
        mock_dao.find_one_or_none.return_value = MagicMock(id=7)
        mock_dao.get_subscriber_principals.return_value = [
            {"principal_type": "user", "sub": "1"}
        ]

        assert TaskManager.publish_task_status(uuid.uuid4(), "success") is False


class TestTaskManagerListenForAbort:
    """listen_for_abort delegates to CoordinationService.listen_for_signal()."""

    def setup_method(self):
        _reset_prefixes()

    def teardown_method(self):
        _reset_prefixes()

    @patch("superset.tasks.manager.TaskManager._check_abort_status")
    @patch("superset.coordination.base.CoordinationService.listen_for_signal")
    def test_listen_for_abort_delegates_channel_and_predicate(
        self, mock_listen, mock_check
    ):
        sentinel = MagicMock(name="listener")
        mock_listen.return_value = sentinel
        callback = MagicMock()

        listener = TaskManager.listen_for_abort(
            task_uuid="test-uuid",
            callback=callback,
            poll_interval=3.0,
            app=None,
        )

        assert listener is sentinel
        args, kwargs = mock_listen.call_args
        assert args[0] == "gtf:abort:test-uuid"
        assert kwargs["poll_interval"] == 3.0

        # The predicate closure checks abort status for this task.
        kwargs["check"]()
        mock_check.assert_called_once_with("test-uuid")

        # The on_signal closure invokes the caller's callback.
        kwargs["on_signal"]()
        callback.assert_called_once()


class TestTaskManagerWaitForCompletion:
    """wait_for_completion delegates the wait to CoordinationService."""

    def setup_method(self):
        _reset_prefixes()

    def teardown_method(self):
        _reset_prefixes()

    @patch(GET_BACKEND, return_value=None)
    @patch("superset.daos.tasks.TaskDAO")
    def test_task_not_found_raises(self, mock_dao, mock_backend):
        mock_dao.find_one_or_none.return_value = None
        with pytest.raises(ValueError, match="not found"):
            TaskManager.wait_for_completion("nonexistent-uuid")

    @patch(GET_BACKEND, return_value=None)
    @patch("superset.daos.tasks.TaskDAO")
    def test_already_complete_returns_immediately(self, mock_dao, mock_backend):
        task = MagicMock()
        task.status = "success"
        mock_dao.find_one_or_none.return_value = task

        assert TaskManager.wait_for_completion("test-uuid") is task

    @patch(GET_BACKEND, return_value=None)
    @patch("superset.daos.tasks.TaskDAO")
    def test_timeout_raises(self, mock_dao, mock_backend):
        task = MagicMock()
        task.status = "in_progress"  # never terminal
        mock_dao.find_one_or_none.return_value = task

        with pytest.raises(TimeoutError, match="Timed out waiting"):
            TaskManager.wait_for_completion(
                "test-uuid", timeout=0.05, poll_interval=0.01
            )

    @patch(GET_BACKEND, return_value=None)
    @patch("superset.daos.tasks.TaskDAO")
    def test_polling_success(self, mock_dao, mock_backend):
        pending = MagicMock()
        pending.status = "pending"
        complete = MagicMock()
        complete.status = "success"
        mock_dao.find_one_or_none.side_effect = [pending, complete]

        result = TaskManager.wait_for_completion(
            "test-uuid", timeout=5.0, poll_interval=0.01
        )
        assert result.status == "success"

    @patch(GET_BACKEND)
    @patch("superset.daos.tasks.TaskDAO")
    def test_stream_success_reads_and_returns(self, mock_dao, mock_get_backend):
        pending = MagicMock()
        pending.status = "pending"
        complete = MagicMock()
        complete.status = "success"
        # find_one_or_none: existence check, fast-path (pending), post-baseline
        # re-check (pending), then after the stream read (success).
        mock_dao.find_one_or_none.side_effect = [
            pending,
            pending,
            pending,
            complete,
        ]

        backend = MagicMock()
        backend.stream_last_id.return_value = "0-0"
        backend.xread.return_value = [
            ["gtf:complete:test-uuid", [("1-0", {"m": "success"})]]
        ]
        mock_get_backend.return_value = backend

        result = TaskManager.wait_for_completion("test-uuid", timeout=5.0)

        assert result.status == "success"
        backend.stream_last_id.assert_called_once_with("gtf:complete:test-uuid")
        backend.xread.assert_called_once()
