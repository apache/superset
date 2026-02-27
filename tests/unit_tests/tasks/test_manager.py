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
"""Unit tests for TaskManager pub/sub functionality"""

import threading
import time
from unittest.mock import MagicMock, patch

import redis

from superset.tasks.manager import AbortListener, TaskManager


class TestAbortListener:
    """Tests for AbortListener class"""

    def test_stop_sets_event(self):
        """Test that stop() sets the stop event"""
        stop_event = threading.Event()
        thread = MagicMock(spec=threading.Thread)
        thread.is_alive.return_value = False

        listener = AbortListener("test-uuid", thread, stop_event)

        assert not stop_event.is_set()
        listener.stop()
        assert stop_event.is_set()

    def test_stop_closes_pubsub(self):
        """Test that stop() closes the pub/sub connection"""
        stop_event = threading.Event()
        thread = MagicMock(spec=threading.Thread)
        thread.is_alive.return_value = False
        pubsub = MagicMock()

        listener = AbortListener("test-uuid", thread, stop_event, pubsub)
        listener.stop()

        pubsub.unsubscribe.assert_called_once()
        pubsub.close.assert_called_once()

    def test_stop_joins_thread(self):
        """Test that stop() joins the listener thread"""
        stop_event = threading.Event()
        thread = MagicMock(spec=threading.Thread)
        thread.is_alive.return_value = True

        listener = AbortListener("test-uuid", thread, stop_event)
        listener.stop()

        thread.join.assert_called_once_with(timeout=2.0)


class TestTaskManagerInitApp:
    """Tests for TaskManager.init_app()"""

    def setup_method(self):
        """Reset TaskManager state before each test"""
        TaskManager._initialized = False
        TaskManager._channel_prefix = "gtf:abort:"
        TaskManager._completion_channel_prefix = "gtf:complete:"

    def teardown_method(self):
        """Reset TaskManager state after each test"""
        TaskManager._initialized = False
        TaskManager._channel_prefix = "gtf:abort:"
        TaskManager._completion_channel_prefix = "gtf:complete:"

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

        # Should not call app.config.get since already initialized
        app.config.get.assert_not_called()


class TestTaskManagerPubSub:
    """Tests for TaskManager pub/sub methods"""

    def setup_method(self):
        """Reset TaskManager state before each test"""
        TaskManager._initialized = False
        TaskManager._channel_prefix = "gtf:abort:"
        TaskManager._completion_channel_prefix = "gtf:complete:"

    def teardown_method(self):
        """Reset TaskManager state after each test"""
        TaskManager._initialized = False
        TaskManager._channel_prefix = "gtf:abort:"
        TaskManager._completion_channel_prefix = "gtf:complete:"

    @patch("superset.tasks.manager.cache_manager")
    def test_is_pubsub_available_no_redis(self, mock_cache_manager):
        """Test is_pubsub_available returns False when Redis not configured"""
        mock_cache_manager.signal_cache = None
        assert TaskManager.is_pubsub_available() is False

    @patch("superset.tasks.manager.cache_manager")
    def test_is_pubsub_available_with_redis(self, mock_cache_manager):
        """Test is_pubsub_available returns True when Redis is configured"""
        mock_cache_manager.signal_cache = MagicMock()
        assert TaskManager.is_pubsub_available() is True

    def test_get_abort_channel(self):
        """Test get_abort_channel returns correct channel name"""
        task_uuid = "abc-123-def-456"
        channel = TaskManager.get_abort_channel(task_uuid)
        assert channel == "gtf:abort:abc-123-def-456"

    def test_get_abort_channel_custom_prefix(self):
        """Test get_abort_channel with custom prefix"""
        TaskManager._channel_prefix = "custom:prefix:"
        task_uuid = "test-uuid"
        channel = TaskManager.get_abort_channel(task_uuid)
        assert channel == "custom:prefix:test-uuid"

    @patch("superset.tasks.manager.cache_manager")
    def test_publish_abort_no_redis(self, mock_cache_manager):
        """Test publish_abort returns False when Redis not available"""
        mock_cache_manager.signal_cache = None
        result = TaskManager.publish_abort("test-uuid")
        assert result is False

    @patch("superset.tasks.manager.cache_manager")
    def test_publish_abort_success(self, mock_cache_manager):
        """Test publish_abort publishes message successfully"""
        mock_redis = MagicMock()
        mock_redis.publish.return_value = 1  # One subscriber
        mock_cache_manager.signal_cache = mock_redis

        result = TaskManager.publish_abort("test-uuid")

        assert result is True
        mock_redis.publish.assert_called_once_with("gtf:abort:test-uuid", "abort")

    @patch("superset.tasks.manager.cache_manager")
    def test_publish_abort_redis_error(self, mock_cache_manager):
        """Test publish_abort handles Redis errors gracefully"""
        mock_redis = MagicMock()
        mock_redis.publish.side_effect = redis.RedisError("Connection lost")
        mock_cache_manager.signal_cache = mock_redis

        result = TaskManager.publish_abort("test-uuid")

        assert result is False


class TestTaskManagerListenForAbort:
    """Tests for TaskManager.listen_for_abort()"""

    def setup_method(self):
        """Reset TaskManager state before each test"""
        TaskManager._initialized = False
        TaskManager._channel_prefix = "gtf:abort:"
        TaskManager._completion_channel_prefix = "gtf:complete:"

    def teardown_method(self):
        """Reset TaskManager state after each test"""
        TaskManager._initialized = False
        TaskManager._channel_prefix = "gtf:abort:"
        TaskManager._completion_channel_prefix = "gtf:complete:"

    @patch("superset.tasks.manager.cache_manager")
    def test_listen_for_abort_no_redis_uses_polling(self, mock_cache_manager):
        """Test listen_for_abort falls back to polling when Redis unavailable"""
        mock_cache_manager.signal_cache = None
        callback = MagicMock()

        with patch.object(TaskManager, "_poll_for_abort", return_value=None):
            listener = TaskManager.listen_for_abort(
                task_uuid="test-uuid",
                callback=callback,
                poll_interval=1.0,
                app=None,
            )

            # Give thread time to start
            time.sleep(0.1)
            listener.stop()

            # Should use polling since no Redis
            assert listener._pubsub is None

    @patch("superset.tasks.manager.cache_manager")
    def test_listen_for_abort_with_redis_uses_pubsub(self, mock_cache_manager):
        """Test listen_for_abort uses pub/sub when Redis available"""
        mock_redis = MagicMock()
        mock_pubsub = MagicMock()
        mock_redis.pubsub.return_value = mock_pubsub
        mock_cache_manager.signal_cache = mock_redis

        callback = MagicMock()

        with patch.object(TaskManager, "_listen_pubsub", return_value=None):
            listener = TaskManager.listen_for_abort(
                task_uuid="test-uuid",
                callback=callback,
                poll_interval=1.0,
                app=None,
            )

            # Give thread time to start
            time.sleep(0.1)
            listener.stop()

            # Should subscribe to channel
            mock_pubsub.subscribe.assert_called_once_with("gtf:abort:test-uuid")

    @patch("superset.tasks.manager.cache_manager")
    def test_listen_for_abort_redis_subscribe_failure_raises(self, mock_cache_manager):
        """Test listen_for_abort raises exception on subscribe failure
        when Redis configured"""
        import pytest

        mock_redis = MagicMock()
        mock_redis.pubsub.side_effect = redis.RedisError("Connection failed")
        mock_cache_manager.signal_cache = mock_redis

        callback = MagicMock()

        # With fail-fast behavior, Redis subscribe failure raises exception
        with pytest.raises(redis.RedisError, match="Connection failed"):
            TaskManager.listen_for_abort(
                task_uuid="test-uuid",
                callback=callback,
                poll_interval=1.0,
                app=None,
            )


class TestTaskManagerCompletion:
    """Tests for TaskManager completion pub/sub and wait_for_completion"""

    def setup_method(self):
        """Reset TaskManager state before each test"""
        TaskManager._initialized = False
        TaskManager._channel_prefix = "gtf:abort:"
        TaskManager._completion_channel_prefix = "gtf:complete:"

    def teardown_method(self):
        """Reset TaskManager state after each test"""
        TaskManager._initialized = False
        TaskManager._channel_prefix = "gtf:abort:"
        TaskManager._completion_channel_prefix = "gtf:complete:"

    def test_get_completion_channel(self):
        """Test get_completion_channel returns correct channel name"""
        task_uuid = "abc-123-def-456"
        channel = TaskManager.get_completion_channel(task_uuid)
        assert channel == "gtf:complete:abc-123-def-456"

    def test_get_completion_channel_custom_prefix(self):
        """Test get_completion_channel with custom prefix"""
        TaskManager._completion_channel_prefix = "custom:complete:"
        task_uuid = "test-uuid"
        channel = TaskManager.get_completion_channel(task_uuid)
        assert channel == "custom:complete:test-uuid"

    @patch("superset.tasks.manager.cache_manager")
    def test_publish_completion_no_redis(self, mock_cache_manager):
        """Test publish_completion returns False when Redis not available"""
        mock_cache_manager.signal_cache = None
        result = TaskManager.publish_completion("test-uuid", "success")
        assert result is False

    @patch("superset.tasks.manager.cache_manager")
    def test_publish_completion_success(self, mock_cache_manager):
        """Test publish_completion publishes message successfully"""
        mock_redis = MagicMock()
        mock_redis.publish.return_value = 1  # One subscriber
        mock_cache_manager.signal_cache = mock_redis

        result = TaskManager.publish_completion("test-uuid", "success")

        assert result is True
        mock_redis.publish.assert_called_once_with("gtf:complete:test-uuid", "success")

    @patch("superset.tasks.manager.cache_manager")
    def test_publish_completion_redis_error(self, mock_cache_manager):
        """Test publish_completion handles Redis errors gracefully"""
        mock_redis = MagicMock()
        mock_redis.publish.side_effect = redis.RedisError("Connection lost")
        mock_cache_manager.signal_cache = mock_redis

        result = TaskManager.publish_completion("test-uuid", "success")

        assert result is False

    @patch("superset.tasks.manager.cache_manager")
    @patch("superset.daos.tasks.TaskDAO")
    def test_wait_for_completion_task_not_found(self, mock_dao, mock_cache_manager):
        """Test wait_for_completion raises ValueError for missing task"""
        import pytest

        mock_cache_manager.signal_cache = None
        mock_dao.find_one_or_none.return_value = None

        with pytest.raises(ValueError, match="not found"):
            TaskManager.wait_for_completion("nonexistent-uuid")

    @patch("superset.tasks.manager.cache_manager")
    @patch("superset.daos.tasks.TaskDAO")
    def test_wait_for_completion_already_complete(self, mock_dao, mock_cache_manager):
        """Test wait_for_completion returns immediately for terminal state"""
        mock_cache_manager.signal_cache = None
        mock_task = MagicMock()
        mock_task.uuid = "test-uuid"
        mock_task.status = "success"
        mock_dao.find_one_or_none.return_value = mock_task

        result = TaskManager.wait_for_completion("test-uuid")

        assert result == mock_task
        # Should only call find_one_or_none once (initial check)
        mock_dao.find_one_or_none.assert_called_once()

    @patch("superset.tasks.manager.cache_manager")
    @patch("superset.daos.tasks.TaskDAO")
    def test_wait_for_completion_timeout(self, mock_dao, mock_cache_manager):
        """Test wait_for_completion raises TimeoutError when timeout expires"""
        import pytest

        mock_cache_manager.signal_cache = None
        mock_task = MagicMock()
        mock_task.uuid = "test-uuid"
        mock_task.status = "in_progress"  # Never completes
        mock_dao.find_one_or_none.return_value = mock_task

        with pytest.raises(TimeoutError, match="Timeout waiting"):
            TaskManager.wait_for_completion("test-uuid", timeout=0.1)

    @patch("superset.tasks.manager.cache_manager")
    @patch("superset.daos.tasks.TaskDAO")
    def test_wait_for_completion_polling_success(self, mock_dao, mock_cache_manager):
        """Test wait_for_completion returns when task completes via polling"""
        mock_cache_manager.signal_cache = None
        mock_task_pending = MagicMock()
        mock_task_pending.uuid = "test-uuid"
        mock_task_pending.status = "pending"

        mock_task_complete = MagicMock()
        mock_task_complete.uuid = "test-uuid"
        mock_task_complete.status = "success"

        # First call returns pending, second returns complete
        mock_dao.find_one_or_none.side_effect = [
            mock_task_pending,
            mock_task_complete,
        ]

        result = TaskManager.wait_for_completion(
            "test-uuid",
            timeout=5.0,
            poll_interval=0.1,
        )

        assert result.status == "success"

    @patch("superset.tasks.manager.cache_manager")
    @patch("superset.daos.tasks.TaskDAO")
    def test_wait_for_completion_with_pubsub(self, mock_dao, mock_cache_manager):
        """Test wait_for_completion uses pub/sub when Redis available"""
        mock_task_pending = MagicMock()
        mock_task_pending.uuid = "test-uuid"
        mock_task_pending.status = "pending"

        mock_task_complete = MagicMock()
        mock_task_complete.uuid = "test-uuid"
        mock_task_complete.status = "success"

        # First call returns pending, second returns complete
        mock_dao.find_one_or_none.side_effect = [
            mock_task_pending,
            mock_task_complete,
        ]

        # Set up mock Redis with pub/sub
        mock_redis = MagicMock()
        mock_pubsub = MagicMock()
        # Simulate receiving a completion message
        mock_pubsub.get_message.return_value = {
            "type": "message",
            "data": "success",
        }
        mock_redis.pubsub.return_value = mock_pubsub
        mock_cache_manager.signal_cache = mock_redis

        result = TaskManager.wait_for_completion(
            "test-uuid",
            timeout=5.0,
        )

        assert result.status == "success"
        # Should have subscribed to completion channel
        mock_pubsub.subscribe.assert_called_once_with("gtf:complete:test-uuid")
        # Should have cleaned up
        mock_pubsub.unsubscribe.assert_called_once()
        mock_pubsub.close.assert_called_once()

    @patch("superset.tasks.manager.cache_manager")
    @patch("superset.daos.tasks.TaskDAO")
    def test_wait_for_completion_pubsub_error_raises(
        self, mock_dao, mock_cache_manager
    ):
        """Test wait_for_completion raises exception on Redis error when
        Redis configured"""
        import pytest

        mock_task_pending = MagicMock()
        mock_task_pending.uuid = "test-uuid"
        mock_task_pending.status = "pending"

        mock_dao.find_one_or_none.return_value = mock_task_pending

        # Set up mock Redis that fails
        mock_redis = MagicMock()
        mock_redis.pubsub.side_effect = redis.RedisError("Connection failed")
        mock_cache_manager.signal_cache = mock_redis

        # With fail-fast behavior, Redis error is raised instead of falling back
        with pytest.raises(redis.RedisError, match="Connection failed"):
            TaskManager.wait_for_completion(
                "test-uuid",
                timeout=5.0,
                poll_interval=0.1,
            )
