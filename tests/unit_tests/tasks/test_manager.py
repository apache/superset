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
        TaskManager._redis = None
        TaskManager._config = None
        TaskManager._initialized = False
        TaskManager._channel_prefix = "gtf:abort:"

    def teardown_method(self):
        """Reset TaskManager state after each test"""
        TaskManager._redis = None
        TaskManager._config = None
        TaskManager._initialized = False
        TaskManager._channel_prefix = "gtf:abort:"

    def test_init_app_without_config(self):
        """Test init_app with no TASKS_BACKEND configured"""
        app = MagicMock()
        app.config.get.side_effect = lambda key, default=None: {
            "TASKS_BACKEND": None,
            "TASKS_ABORT_CHANNEL_PREFIX": "gtf:abort:",
        }.get(key, default)

        TaskManager.init_app(app)

        assert TaskManager._initialized is True
        assert TaskManager._redis is None
        assert TaskManager._config is None

    def test_init_app_skips_if_already_initialized(self):
        """Test init_app is idempotent"""
        TaskManager._initialized = True

        app = MagicMock()
        TaskManager.init_app(app)

        # Should not call app.config.get since already initialized
        app.config.get.assert_not_called()

    @patch("superset.tasks.manager.redis.Redis")
    def test_init_app_with_redis_config(self, mock_redis_class):
        """Test init_app with standard Redis configuration"""
        mock_redis = MagicMock()
        mock_redis_class.return_value = mock_redis

        app = MagicMock()
        app.config.get.side_effect = lambda key, default=None: {
            "TASKS_BACKEND": {
                "CACHE_TYPE": "RedisCache",
                "CACHE_REDIS_HOST": "localhost",
                "CACHE_REDIS_PORT": 6379,
                "CACHE_REDIS_DB": 0,
            },
            "TASKS_ABORT_CHANNEL_PREFIX": "custom:abort:",
        }.get(key, default)

        TaskManager.init_app(app)

        assert TaskManager._initialized is True
        assert TaskManager._redis is mock_redis
        assert TaskManager._channel_prefix == "custom:abort:"
        mock_redis.ping.assert_called_once()

    @patch("superset.tasks.manager.redis.Redis")
    def test_init_app_redis_connection_failure(self, mock_redis_class):
        """Test init_app handles Redis connection failure gracefully"""
        mock_redis = MagicMock()
        mock_redis.ping.side_effect = redis.ConnectionError("Connection refused")
        mock_redis_class.return_value = mock_redis

        app = MagicMock()
        app.config.get.side_effect = lambda key, default=None: {
            "TASKS_BACKEND": {
                "CACHE_TYPE": "RedisCache",
                "CACHE_REDIS_HOST": "localhost",
            },
            "TASKS_ABORT_CHANNEL_PREFIX": "gtf:abort:",
        }.get(key, default)

        TaskManager.init_app(app)

        assert TaskManager._initialized is True
        assert TaskManager._redis is None  # Falls back to None

    @patch("superset.tasks.manager.Sentinel")
    def test_init_app_with_sentinel_config(self, mock_sentinel_class):
        """Test init_app with Redis Sentinel configuration"""
        mock_master = MagicMock()
        mock_sentinel = MagicMock()
        mock_sentinel.master_for.return_value = mock_master
        mock_sentinel_class.return_value = mock_sentinel

        app = MagicMock()
        app.config.get.side_effect = lambda key, default=None: {
            "TASKS_BACKEND": {
                "CACHE_TYPE": "RedisSentinelCache",
                "CACHE_REDIS_SENTINELS": [("sentinel1", 26379)],
                "CACHE_REDIS_SENTINEL_MASTER": "mymaster",
            },
            "TASKS_ABORT_CHANNEL_PREFIX": "gtf:abort:",
        }.get(key, default)

        TaskManager.init_app(app)

        assert TaskManager._initialized is True
        assert TaskManager._redis is mock_master
        mock_master.ping.assert_called_once()

    def test_init_app_unsupported_cache_type(self):
        """Test init_app with unsupported cache type falls back gracefully"""
        app = MagicMock()
        app.config.get.side_effect = lambda key, default=None: {
            "TASKS_BACKEND": {
                "CACHE_TYPE": "MemcachedCache",  # Unsupported
            },
            "TASKS_ABORT_CHANNEL_PREFIX": "gtf:abort:",
        }.get(key, default)

        TaskManager.init_app(app)

        assert TaskManager._initialized is True
        assert TaskManager._redis is None


class TestTaskManagerPubSub:
    """Tests for TaskManager pub/sub methods"""

    def setup_method(self):
        """Reset TaskManager state before each test"""
        TaskManager._redis = None
        TaskManager._config = None
        TaskManager._initialized = False
        TaskManager._channel_prefix = "gtf:abort:"

    def teardown_method(self):
        """Reset TaskManager state after each test"""
        TaskManager._redis = None
        TaskManager._config = None
        TaskManager._initialized = False
        TaskManager._channel_prefix = "gtf:abort:"

    def test_is_pubsub_available_no_redis(self):
        """Test is_pubsub_available returns False when Redis not configured"""
        assert TaskManager.is_pubsub_available() is False

    def test_is_pubsub_available_with_redis(self):
        """Test is_pubsub_available returns True when Redis is configured"""
        TaskManager._redis = MagicMock()
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

    def test_publish_abort_no_redis(self):
        """Test publish_abort returns False when Redis not available"""
        result = TaskManager.publish_abort("test-uuid")
        assert result is False

    def test_publish_abort_success(self):
        """Test publish_abort publishes message successfully"""
        mock_redis = MagicMock()
        mock_redis.publish.return_value = 1  # One subscriber
        TaskManager._redis = mock_redis

        result = TaskManager.publish_abort("test-uuid")

        assert result is True
        mock_redis.publish.assert_called_once_with("gtf:abort:test-uuid", "abort")

    def test_publish_abort_redis_error(self):
        """Test publish_abort handles Redis errors gracefully"""
        mock_redis = MagicMock()
        mock_redis.publish.side_effect = redis.RedisError("Connection lost")
        TaskManager._redis = mock_redis

        result = TaskManager.publish_abort("test-uuid")

        assert result is False


class TestTaskManagerListenForAbort:
    """Tests for TaskManager.listen_for_abort()"""

    def setup_method(self):
        """Reset TaskManager state before each test"""
        TaskManager._redis = None
        TaskManager._config = None
        TaskManager._initialized = False
        TaskManager._channel_prefix = "gtf:abort:"

    def teardown_method(self):
        """Reset TaskManager state after each test"""
        TaskManager._redis = None
        TaskManager._config = None
        TaskManager._initialized = False
        TaskManager._channel_prefix = "gtf:abort:"

    def test_listen_for_abort_no_redis_uses_polling(self):
        """Test listen_for_abort falls back to polling when Redis unavailable"""
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

    def test_listen_for_abort_with_redis_uses_pubsub(self):
        """Test listen_for_abort uses pub/sub when Redis available"""
        mock_redis = MagicMock()
        mock_pubsub = MagicMock()
        mock_redis.pubsub.return_value = mock_pubsub
        TaskManager._redis = mock_redis

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

    def test_listen_for_abort_redis_subscribe_failure_falls_back(self):
        """Test listen_for_abort falls back to polling on subscribe failure"""
        mock_redis = MagicMock()
        mock_redis.pubsub.side_effect = redis.RedisError("Connection failed")
        TaskManager._redis = mock_redis

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

            # Should fall back to polling
            assert listener._pubsub is None


class TestTaskManagerCompletion:
    """Tests for TaskManager completion pub/sub and wait_for_completion"""

    def setup_method(self):
        """Reset TaskManager state before each test"""
        TaskManager._redis = None
        TaskManager._config = None
        TaskManager._initialized = False
        TaskManager._channel_prefix = "gtf:abort:"
        TaskManager._completion_channel_prefix = "gtf:complete:"

    def teardown_method(self):
        """Reset TaskManager state after each test"""
        TaskManager._redis = None
        TaskManager._config = None
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

    def test_publish_completion_no_redis(self):
        """Test publish_completion returns False when Redis not available"""
        result = TaskManager.publish_completion("test-uuid", "success")
        assert result is False

    def test_publish_completion_success(self):
        """Test publish_completion publishes message successfully"""
        mock_redis = MagicMock()
        mock_redis.publish.return_value = 1  # One subscriber
        TaskManager._redis = mock_redis

        result = TaskManager.publish_completion("test-uuid", "success")

        assert result is True
        mock_redis.publish.assert_called_once_with("gtf:complete:test-uuid", "success")

    def test_publish_completion_redis_error(self):
        """Test publish_completion handles Redis errors gracefully"""
        mock_redis = MagicMock()
        mock_redis.publish.side_effect = redis.RedisError("Connection lost")
        TaskManager._redis = mock_redis

        result = TaskManager.publish_completion("test-uuid", "success")

        assert result is False

    @patch("superset.tasks.manager.TaskDAO")
    def test_wait_for_completion_task_not_found(self, mock_dao):
        """Test wait_for_completion raises ValueError for missing task"""
        import pytest

        mock_dao.find_one_or_none.return_value = None

        with pytest.raises(ValueError, match="not found"):
            TaskManager.wait_for_completion("nonexistent-uuid")

    @patch("superset.tasks.manager.TaskDAO")
    def test_wait_for_completion_already_complete(self, mock_dao):
        """Test wait_for_completion returns immediately for terminal state"""
        mock_task = MagicMock()
        mock_task.uuid = "test-uuid"
        mock_task.status = "success"
        mock_dao.find_one_or_none.return_value = mock_task

        result = TaskManager.wait_for_completion("test-uuid")

        assert result == mock_task
        # Should only call find_one_or_none once (initial check)
        mock_dao.find_one_or_none.assert_called_once()

    @patch("superset.tasks.manager.TaskDAO")
    def test_wait_for_completion_timeout(self, mock_dao):
        """Test wait_for_completion raises TimeoutError when timeout expires"""
        import pytest

        mock_task = MagicMock()
        mock_task.uuid = "test-uuid"
        mock_task.status = "in_progress"  # Never completes
        mock_dao.find_one_or_none.return_value = mock_task

        with pytest.raises(TimeoutError, match="Timeout waiting"):
            TaskManager.wait_for_completion("test-uuid", timeout=0.1)

    @patch("superset.tasks.manager.TaskDAO")
    def test_wait_for_completion_polling_success(self, mock_dao):
        """Test wait_for_completion returns when task completes via polling"""
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

    @patch("superset.tasks.manager.TaskDAO")
    def test_wait_for_completion_with_pubsub(self, mock_dao):
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
        TaskManager._redis = mock_redis

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

    @patch("superset.tasks.manager.TaskDAO")
    def test_wait_for_completion_pubsub_fallback_on_error(self, mock_dao):
        """Test wait_for_completion falls back to polling on Redis error"""
        mock_task_pending = MagicMock()
        mock_task_pending.uuid = "test-uuid"
        mock_task_pending.status = "pending"

        mock_task_complete = MagicMock()
        mock_task_complete.uuid = "test-uuid"
        mock_task_complete.status = "success"

        mock_dao.find_one_or_none.side_effect = [
            mock_task_pending,
            mock_task_complete,
        ]

        # Set up mock Redis that fails
        mock_redis = MagicMock()
        mock_redis.pubsub.side_effect = redis.RedisError("Connection failed")
        TaskManager._redis = mock_redis

        result = TaskManager.wait_for_completion(
            "test-uuid",
            timeout=5.0,
            poll_interval=0.1,
        )

        # Should still complete via polling fallback
        assert result.status == "success"

    def test_terminal_states_constant(self):
        """Test TERMINAL_STATES contains expected values"""
        expected = {"success", "failure", "aborted", "timed_out"}
        assert TaskManager.TERMINAL_STATES == expected
