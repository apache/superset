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
    TaskManager._realtime_channel_prefix = ""


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
            "REALTIME_CHANNEL_PREFIX": "custom:",
        }.get(key, default)

        TaskManager.init_app(app)

        assert TaskManager._initialized is True
        assert TaskManager._channel_prefix == "custom:abort:"
        assert TaskManager._completion_channel_prefix == "custom:complete:"
        assert TaskManager._realtime_channel_prefix == "custom:"

    def test_init_app_resolves_callable_realtime_prefix(self):
        """A callable REALTIME_CHANNEL_PREFIX is resolved once to a string."""
        app = MagicMock()
        app.config.get.side_effect = lambda key, default=None: {
            "REALTIME_CHANNEL_PREFIX": lambda: "tenant-b:",
        }.get(key, default)

        TaskManager.init_app(app)

        assert TaskManager._realtime_channel_prefix == "tenant-b:"

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

    def test_get_realtime_channel(self):
        assert TaskManager.get_realtime_channel() == "realtime"

    def test_get_realtime_channel_custom_prefix(self):
        TaskManager._realtime_channel_prefix = "tenant-a:"
        assert TaskManager.get_realtime_channel() == "tenant-a:realtime"


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
    """publish_entity_change emits one opaque broadcast nudge on ``realtime``."""

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
    def test_publishes_opaque_broadcast_nudge(
        self, mock_defined, mock_publish, mock_get_id
    ):
        assert TaskManager.publish_entity_change(uuid.uuid4()) is True

        # One publish on the single realtime channel, an entity.changed broadcast
        # envelope carrying ONLY opaque ids (the integer primary key) - no status
        # (the contract is general across all entity types).
        mock_publish.assert_called_once()
        channel, message = mock_publish.call_args.args[:2]
        assert channel == "realtime"
        assert json.loads(message) == {
            "topic": "entity.changed",
            "scope": "authenticated_global",
            "payload": {"entity_type": "task", "id": 42},
        }

    @patch(GET_ID, return_value=42)
    @patch(PUBLISH)
    @patch(IS_DEFINED, return_value=True)
    def test_publishes_on_configured_prefixed_channel(
        self, mock_defined, mock_publish, mock_get_id
    ):
        """A configured REALTIME_CHANNEL_PREFIX reaches the published channel.

        Drives init_app and the public publisher end to end, so it guards the
        _publish_realtime wiring (not just the get_realtime_channel helper): were
        the publish to revert to the literal ``realtime``, the producer would
        diverge from a websocket server subscribed to ``tenant-a:realtime``.
        """
        app = MagicMock()
        app.config.get.side_effect = lambda key, default=None: {
            "REALTIME_CHANNEL_PREFIX": "tenant-a:",
        }.get(key, default)
        TaskManager.init_app(app)

        assert TaskManager.publish_entity_change(uuid.uuid4()) is True

        channel = mock_publish.call_args.args[0]
        assert channel == "tenant-a:realtime"

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


class TestTaskManagerPublishRequiredByChanged:
    """publish_required_by_changed nudges each task that depends on the given task."""

    IS_DEFINED = "superset.coordination.base.CoordinationService.is_backend_defined"
    GET_DEPENDENTS = "superset.daos.tasks.TaskDAO.get_required_by_uuids"
    PUBLISH_ENTITY = "superset.tasks.manager.TaskManager.publish_entity_change"

    @patch(GET_DEPENDENTS)
    @patch(IS_DEFINED, return_value=False)
    def test_no_backend_skips_lookup(self, mock_defined, mock_get_dependents):
        TaskManager.publish_required_by_changed(uuid.uuid4())
        mock_get_dependents.assert_not_called()

    @patch(PUBLISH_ENTITY)
    @patch(IS_DEFINED, return_value=True)
    def test_nudges_each_dependent(self, mock_defined, mock_publish_entity):
        dependents = [uuid.uuid4(), uuid.uuid4()]
        with patch(self.GET_DEPENDENTS, return_value=dependents):
            TaskManager.publish_required_by_changed(uuid.uuid4())
        assert mock_publish_entity.call_count == 2
        assert {c.args[0] for c in mock_publish_entity.call_args_list} == set(
            dependents
        )

    @patch(PUBLISH_ENTITY)
    @patch(IS_DEFINED, return_value=True)
    def test_no_dependents_is_noop(self, mock_defined, mock_publish_entity):
        with patch(self.GET_DEPENDENTS, return_value=[]):
            TaskManager.publish_required_by_changed(uuid.uuid4())
        mock_publish_entity.assert_not_called()


class TestTaskManagerPublishTaskStatus:
    """publish_task_status emits one task.status envelope carrying routing keys."""

    def setup_method(self):
        _reset_prefixes()

    def teardown_method(self):
        _reset_prefixes()

    IS_DEFINED = "superset.coordination.base.CoordinationService.is_backend_defined"
    PUBLISH = "superset.coordination.base.CoordinationService.publish"
    DAO = "superset.daos.tasks.TaskDAO"
    POLICY = "superset.tasks.registry.TaskRegistry.get_subscription_policy"

    @patch(IS_DEFINED, return_value=False)
    def test_no_backend(self, mock_defined):
        assert TaskManager.publish_task_status(uuid.uuid4(), "success") is False

    @patch(POLICY, return_value=None)
    @patch(DAO)
    @patch(PUBLISH)
    @patch(IS_DEFINED, return_value=True)
    def test_publishes_principal_routes_without_policy(
        self, mock_defined, mock_publish, mock_dao, mock_policy
    ):
        """No policy -> principal-grain routes derived from subscribers."""
        task_uuid = uuid.uuid4()
        mock_dao.find_one_or_none.return_value = MagicMock(id=7, task_type="some_type")
        mock_dao.get_subscriber_principals.return_value = [
            {"principal_type": "user", "sub": "1"},
            {"principal_type": "guest", "sub": "guest:abc"},
        ]

        assert TaskManager.publish_task_status(task_uuid, "success") is True

        mock_dao.get_subscriber_principals.assert_called_once_with(7)
        mock_publish.assert_called_once()
        channel, message = mock_publish.call_args.args[:2]
        assert channel == "realtime"
        assert json.loads(message) == {
            "topic": "task.status",
            "scope": "principal",
            "payload": {"task_id": str(task_uuid), "status": "success"},
            "routes": ["user:1", "guest:abc"],
        }

    @patch(DAO)
    @patch(PUBLISH)
    @patch(IS_DEFINED, return_value=True)
    def test_uses_policy_routing_channels(self, mock_defined, mock_publish, mock_dao):
        """A task type's policy narrows delivery to its per-tab channels."""
        task_uuid = uuid.uuid4()
        mock_dao.find_one_or_none.return_value = MagicMock(id=7, task_type="chart")
        # The per-tab keys are within the task's subscriber principal (user:5), so
        # they survive validation.
        mock_dao.get_subscriber_principals.return_value = [
            {"principal_type": "user", "sub": "5"},
        ]
        policy = MagicMock()
        policy.routing_channels.return_value = ["user:5:tabA", "user:5:tabB"]

        with patch(self.POLICY, return_value=policy):
            assert TaskManager.publish_task_status(task_uuid, "success") is True

        _, message = mock_publish.call_args.args[:2]
        body = json.loads(message)
        assert body["scope"] == "tab"
        assert body["routes"] == ["user:5:tabA", "user:5:tabB"]

    @patch(DAO)
    @patch(PUBLISH)
    @patch(IS_DEFINED, return_value=True)
    def test_drops_policy_routes_outside_subscriber_principals(
        self, mock_defined, mock_publish, mock_dao
    ):
        """A policy key outside the task's principals is dropped (Finding 5)."""
        task_uuid = uuid.uuid4()
        mock_dao.find_one_or_none.return_value = MagicMock(id=7, task_type="chart")
        mock_dao.get_subscriber_principals.return_value = [
            {"principal_type": "user", "sub": "5"},
        ]
        policy = MagicMock()
        # user:5:tabA is valid; user:999 belongs to another principal → dropped.
        policy.routing_channels.return_value = ["user:5:tabA", "user:999"]

        with patch(self.POLICY, return_value=policy):
            assert TaskManager.publish_task_status(task_uuid, "success") is True

        _, message = mock_publish.call_args.args[:2]
        assert json.loads(message)["routes"] == ["user:5:tabA"]

    @patch(DAO)
    @patch(PUBLISH)
    @patch(IS_DEFINED, return_value=True)
    def test_all_policy_routes_invalid_publishes_nothing(
        self, mock_defined, mock_publish, mock_dao
    ):
        """When a policy scoped delivery but every key is rejected, publish nothing.

        Broadening to every tab of the principal would break the policy's intended
        isolation; the interval poll remains the correctness path.
        """
        task_uuid = uuid.uuid4()
        mock_dao.find_one_or_none.return_value = MagicMock(id=7, task_type="chart")
        mock_dao.get_subscriber_principals.return_value = [
            {"principal_type": "user", "sub": "5"},
        ]
        policy = MagicMock()
        policy.routing_channels.return_value = ["user:999:tabX"]

        with patch(self.POLICY, return_value=policy):
            assert TaskManager.publish_task_status(task_uuid, "success") is False

        mock_publish.assert_not_called()

    @patch(POLICY)
    @patch(DAO)
    @patch(PUBLISH)
    @patch(IS_DEFINED, return_value=True)
    def test_policy_none_result_falls_back_to_principal(
        self, mock_defined, mock_publish, mock_dao, mock_policy
    ):
        """A policy returning None defers to principal-grain channels."""
        mock_dao.find_one_or_none.return_value = MagicMock(id=7, task_type="chart")
        mock_policy.return_value.routing_channels.return_value = None
        mock_dao.get_subscriber_principals.return_value = [
            {"principal_type": "user", "sub": "1"},
        ]

        assert TaskManager.publish_task_status(uuid.uuid4(), "success") is True
        _, message = mock_publish.call_args.args[:2]
        body = json.loads(message)
        assert body["scope"] == "principal"
        assert body["routes"] == ["user:1"]

    @patch(POLICY, return_value=None)
    @patch(DAO)
    @patch(PUBLISH)
    @patch(IS_DEFINED, return_value=True)
    def test_no_channels_is_noop(
        self, mock_defined, mock_publish, mock_dao, mock_policy
    ):
        mock_dao.find_one_or_none.return_value = MagicMock(id=7, task_type="some_type")
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

    @patch(POLICY, return_value=None)
    @patch(DAO)
    @patch(PUBLISH, side_effect=redis.RedisError("boom"))
    @patch(IS_DEFINED, return_value=True)
    def test_redis_error_is_swallowed(
        self, mock_defined, mock_publish, mock_dao, mock_policy
    ):
        mock_dao.find_one_or_none.return_value = MagicMock(id=7, task_type="some_type")
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


class TestSubmitTaskEnqueueFailure:
    """submit_task must not leave a task PENDING if the Celery enqueue fails.

    A committed-but-unenqueued PENDING task would poison the dedup key: future
    identical submits would join a task that never runs. So an enqueue failure
    fails the task (freeing the key) and re-raises to the caller.
    """

    SUBMIT = "superset.commands.tasks.submit.SubmitTaskCommand"
    EXECUTE = "superset.tasks.scheduler.execute_task"
    TRANSITION = (
        "superset.commands.tasks.internal_update.InternalStatusTransitionCommand"
    )
    PUBLISH = "superset.tasks.manager.TaskManager.publish_completion"

    def test_enqueue_failure_fails_task_and_reraises(self):
        from superset_core.tasks.types import TaskScope, TaskStatus

        task = MagicMock()
        task.uuid = uuid.uuid4()

        transition = MagicMock()
        transition.return_value.run.return_value = True

        with (
            patch(self.SUBMIT) as submit_cmd,
            patch(self.EXECUTE) as execute_task,
            patch(self.TRANSITION, transition),
            patch(self.PUBLISH) as publish_completion,
        ):
            submit_cmd.return_value.run_with_info.return_value = (task, True)
            execute_task.delay.side_effect = redis.exceptions.ConnectionError("down")

            with pytest.raises(redis.exceptions.ConnectionError):
                TaskManager.submit_task(
                    task_type="test.task",
                    task_key="k",
                    task_name="n",
                    scope=TaskScope.SHARED,
                    timeout=None,
                    args=(),
                    kwargs={},
                )

        # Failed PENDING→FAILURE to free the dedup key, and told waiters/clients.
        _, kwargs = transition.call_args
        assert kwargs["new_status"] == TaskStatus.FAILURE
        assert kwargs["expected_status"] == TaskStatus.PENDING
        publish_completion.assert_called_once_with(task.uuid, TaskStatus.FAILURE.value)

    def test_cleanup_failure_is_swallowed_and_original_error_reraised(self):
        """If the FAILURE cleanup itself throws, the original enqueue error still
        surfaces. The task is left PENDING with no heartbeat and is NOT auto-reaped
        (the reaper only reclaims started tasks); its dedup key stays occupied
        until manually cleared or pruned."""
        from superset_core.tasks.types import TaskScope

        task = MagicMock()
        task.uuid = uuid.uuid4()

        transition = MagicMock()
        transition.return_value.run.side_effect = RuntimeError("metastore down")

        with (
            patch(self.SUBMIT) as submit_cmd,
            patch(self.EXECUTE) as execute_task,
            patch(self.TRANSITION, transition),
            patch(self.PUBLISH) as publish_completion,
        ):
            submit_cmd.return_value.run_with_info.return_value = (task, True)
            execute_task.delay.side_effect = redis.exceptions.ConnectionError("down")

            with pytest.raises(redis.exceptions.ConnectionError):
                TaskManager.submit_task(
                    task_type="test.task",
                    task_key="k",
                    task_name="n",
                    scope=TaskScope.SHARED,
                    timeout=None,
                    args=(),
                    kwargs={},
                )

        publish_completion.assert_not_called()

    def test_joined_task_is_not_enqueued(self):
        """A deduped (joined) task must not be enqueued a second time."""
        from superset_core.tasks.types import TaskScope

        task = MagicMock()
        task.uuid = uuid.uuid4()

        with (
            patch(self.SUBMIT) as submit_cmd,
            patch(self.EXECUTE) as execute_task,
        ):
            submit_cmd.return_value.run_with_info.return_value = (task, False)

            result = TaskManager.submit_task(
                task_type="test.task",
                task_key="k",
                task_name="n",
                scope=TaskScope.SHARED,
                timeout=None,
                args=(),
                kwargs={},
            )

        assert result is task
        execute_task.delay.assert_not_called()
