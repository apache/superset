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
"""Task manager for the Global Task Framework (GTF)"""

from __future__ import annotations

import logging
import threading
from typing import Any, Callable, TYPE_CHECKING

import redis
from redis.sentinel import Sentinel
from superset_core.api.tasks import TaskProperties, TaskScope, TaskStatus

from superset.commands.tasks.exceptions import TaskCreateFailedError
from superset.tasks.utils import generate_random_task_key

if TYPE_CHECKING:
    from flask import Flask

    from superset.models.tasks import Task

logger = logging.getLogger(__name__)


class AbortListener:
    """
    Handle for a background abort listener.

    Returned by TaskManager.listen_for_abort() to allow stopping the listener.
    """

    def __init__(
        self,
        task_uuid: str,
        thread: threading.Thread,
        stop_event: threading.Event,
        pubsub: redis.client.PubSub | None = None,
    ) -> None:
        self._task_uuid = task_uuid
        self._thread = thread
        self._stop_event = stop_event
        self._pubsub = pubsub

    def stop(self) -> None:
        """Stop the abort listener."""
        self._stop_event.set()

        # Close pub/sub subscription if active
        if self._pubsub is not None:
            try:
                self._pubsub.unsubscribe()
                self._pubsub.close()
            except Exception as ex:
                logger.debug("Error closing pub/sub during stop: %s", ex)

        # Wait for thread to finish
        if self._thread.is_alive():
            self._thread.join(timeout=2.0)

        logger.debug("Stopped abort listener for task %s", self._task_uuid)


class TaskManager:
    """
    Handles task creation, scheduling, and abort notifications.

    The TaskManager is responsible for:
    1. Creating task entries in the metastore (Task model)
    2. Scheduling task execution via Celery
    3. Handling deduplication (returning existing active task if duplicate)
    4. Managing real-time abort notifications (optional)

    Redis pub/sub is opt-in via TASKS_BACKEND configuration. When not configured,
    tasks fall back to database polling for abort detection.
    """

    # Class-level Redis state (initialized once via init_app)
    _redis: redis.Redis[Any] | None = None
    _channel_prefix: str = "gtf:abort:"
    _config: dict[str, Any] | None = None
    _initialized: bool = False

    @classmethod
    def init_app(cls, app: Flask) -> None:
        """
        Initialize the TaskManager with Flask app config.

        Sets up Redis connection for pub/sub abort notifications if configured.

        :param app: Flask application instance
        """
        if cls._initialized:
            return

        cls._config = app.config.get("TASKS_BACKEND")
        cls._channel_prefix = app.config.get("TASKS_ABORT_CHANNEL_PREFIX", "gtf:abort:")

        if cls._config is None:
            logger.info(
                "TASKS_BACKEND not configured, using database polling for abort"
            )
            cls._initialized = True
            return

        cache_type = cls._config.get("CACHE_TYPE")

        if cache_type == "RedisCache":
            cls._init_redis()
        elif cache_type == "RedisSentinelCache":
            cls._init_redis_sentinel()
        else:
            logger.warning(
                "Unsupported TASKS_BACKEND cache type: %s, falling back to polling",
                cache_type,
            )

        cls._initialized = True

    @classmethod
    def _init_redis(cls) -> None:
        """Initialize standard Redis connection."""
        if cls._config is None:
            return

        kwargs: dict[str, Any] = {
            "host": cls._config.get("CACHE_REDIS_HOST", "localhost"),
            "port": cls._config.get("CACHE_REDIS_PORT", 6379),
            "db": cls._config.get("CACHE_REDIS_DB", 0),
            "password": cls._config.get("CACHE_REDIS_PASSWORD"),
            "decode_responses": True,
        }

        # Add username if provided
        if configured_username := cls._config.get("CACHE_REDIS_USER"):
            kwargs["username"] = configured_username

        # Add SSL options if configured
        if cls._config.get("CACHE_REDIS_SSL"):
            kwargs["ssl"] = True
            if ssl_certfile := cls._config.get("CACHE_REDIS_SSL_CERTFILE"):
                kwargs["ssl_certfile"] = ssl_certfile
            if ssl_keyfile := cls._config.get("CACHE_REDIS_SSL_KEYFILE"):
                kwargs["ssl_keyfile"] = ssl_keyfile
            if ssl_cert_reqs := cls._config.get("CACHE_REDIS_SSL_CERT_REQS"):
                kwargs["ssl_cert_reqs"] = ssl_cert_reqs
            if ssl_ca_certs := cls._config.get("CACHE_REDIS_SSL_CA_CERTS"):
                kwargs["ssl_ca_certs"] = ssl_ca_certs

        try:
            cls._redis = redis.Redis(**kwargs)
            # Test connection
            cls._redis.ping()
            logger.info("Initialized Redis backend for GTF abort pub/sub")
        except redis.ConnectionError as ex:
            logger.warning(
                "Failed to connect to Redis for GTF pub/sub: %s. "
                "Falling back to database polling.",
                ex,
            )
            cls._redis = None

    @classmethod
    def _init_redis_sentinel(cls) -> None:
        """Initialize Redis Sentinel connection."""
        if cls._config is None:
            return

        sentinels = cls._config.get("CACHE_REDIS_SENTINELS", [("localhost", 26379)])
        master_name = cls._config.get("CACHE_REDIS_SENTINEL_MASTER", "mymaster")

        try:
            sentinel = Sentinel(
                sentinels,
                sentinel_kwargs={
                    "password": cls._config.get("CACHE_REDIS_SENTINEL_PASSWORD"),
                },
            )

            # Prepare master connection kwargs
            master_kwargs: dict[str, Any] = {
                "password": cls._config.get("CACHE_REDIS_PASSWORD"),
                "db": cls._config.get("CACHE_REDIS_DB", 0),
                "decode_responses": True,
            }

            # Add SSL options if configured
            if cls._config.get("CACHE_REDIS_SSL"):
                master_kwargs["ssl"] = True
                if ssl_certfile := cls._config.get("CACHE_REDIS_SSL_CERTFILE"):
                    master_kwargs["ssl_certfile"] = ssl_certfile
                if ssl_keyfile := cls._config.get("CACHE_REDIS_SSL_KEYFILE"):
                    master_kwargs["ssl_keyfile"] = ssl_keyfile
                if ssl_cert_reqs := cls._config.get("CACHE_REDIS_SSL_CERT_REQS"):
                    master_kwargs["ssl_cert_reqs"] = ssl_cert_reqs
                if ssl_ca_certs := cls._config.get("CACHE_REDIS_SSL_CA_CERTS"):
                    master_kwargs["ssl_ca_certs"] = ssl_ca_certs

            cls._redis = sentinel.master_for(master_name, **master_kwargs)
            # Test connection
            if cls._redis is not None:
                cls._redis.ping()
            logger.info("Initialized Redis Sentinel backend for GTF abort pub/sub")
        except (redis.ConnectionError, redis.sentinel.MasterNotFoundError) as ex:
            logger.warning(
                "Failed to connect to Redis Sentinel for GTF pub/sub: %s. "
                "Falling back to database polling.",
                ex,
            )
            cls._redis = None

    @classmethod
    def is_pubsub_available(cls) -> bool:
        """
        Check if Redis pub/sub backend is configured and available.

        :returns: True if Redis is available for pub/sub, False otherwise
        """
        return cls._redis is not None

    @classmethod
    def get_abort_channel(cls, task_uuid: str) -> str:
        """
        Get the abort channel name for a task.

        :param task_uuid: UUID of the task
        :returns: Channel name for the task's abort notifications
        """
        return f"{cls._channel_prefix}{task_uuid}"

    @classmethod
    def publish_abort(cls, task_uuid: str) -> bool:
        """
        Publish an abort message to the task's channel.

        :param task_uuid: UUID of the task to abort
        :returns: True if message was published, False if Redis unavailable
        """
        if not cls._redis:
            return False

        try:
            channel = cls.get_abort_channel(task_uuid)
            subscriber_count = cls._redis.publish(channel, "abort")
            logger.debug(
                "Published abort to channel %s (%d subscribers)",
                channel,
                subscriber_count,
            )
            return True
        except redis.RedisError as ex:
            logger.error("Failed to publish abort for task %s: %s", task_uuid, ex)
            return False

    @classmethod
    def listen_for_abort(
        cls,
        task_uuid: str,
        callback: Callable[[], None],
        poll_interval: float,
        app: Any = None,
    ) -> AbortListener:
        """
        Start listening for abort notifications for a task.

        Uses Redis pub/sub if available, otherwise falls back to database polling.
        The callback is invoked when an abort is detected.

        :param task_uuid: UUID of the task to monitor
        :param callback: Function to call when abort is detected
        :param poll_interval: Interval for database polling (fallback mode)
        :param app: Flask app for database access in background thread
        :returns: AbortListener handle to stop listening
        """
        stop_event = threading.Event()
        pubsub: redis.client.PubSub | None = None

        # Try to set up Redis pub/sub
        if cls._redis is not None:
            try:
                pubsub = cls._redis.pubsub()
                channel = cls.get_abort_channel(task_uuid)
                pubsub.subscribe(channel)
                logger.debug("Subscribed to abort channel: %s", channel)
            except redis.RedisError as ex:
                logger.warning(
                    "Failed to subscribe to Redis for task %s: %s. Using polling.",
                    task_uuid,
                    ex,
                )
                pubsub = None

        if pubsub is not None:
            # Start pub/sub listener thread
            thread = threading.Thread(
                target=cls._listen_pubsub,
                args=(task_uuid, pubsub, callback, stop_event, poll_interval, app),
                daemon=True,
                name=f"abort-listener-{task_uuid[:8]}",
            )
            logger.info("Started pub/sub abort listener for task %s", task_uuid)
        else:
            # Start polling thread (fallback)
            thread = threading.Thread(
                target=cls._poll_for_abort,
                args=(task_uuid, callback, stop_event, poll_interval, app),
                daemon=True,
                name=f"abort-poller-{task_uuid[:8]}",
            )
            logger.info(
                "Started database abort polling for task %s (interval=%ss)",
                task_uuid,
                poll_interval,
            )

        thread.start()
        return AbortListener(task_uuid, thread, stop_event, pubsub)

    @classmethod
    def _listen_pubsub(  # noqa: C901
        cls,
        task_uuid: str,
        pubsub: redis.client.PubSub,
        callback: Callable[[], None],
        stop_event: threading.Event,
        fallback_interval: float,
        app: Any,
    ) -> None:
        """
        Listen for abort via Redis pub/sub.

        If pub/sub connection fails, falls back to database polling.
        """
        try:
            while not stop_event.is_set():
                message = pubsub.get_message(
                    ignore_subscribe_messages=True, timeout=1.0
                )

                if message is not None and message.get("type") == "message":
                    # Abort message received
                    logger.info(
                        "Abort received via pub/sub for task %s",
                        task_uuid,
                    )
                    # Invoke callback with app context if provided
                    if app:
                        with app.app_context():
                            callback()
                    else:
                        callback()
                    break

        except redis.RedisError as ex:
            # Check if we were asked to stop - if so, this is expected
            if stop_event.is_set():
                logger.debug(
                    "Abort listener for task %s stopped (Redis error: %s)",
                    task_uuid,
                    ex,
                )
            else:
                logger.warning(
                    "Redis pub/sub error for task %s: %s. Falling back to polling.",
                    task_uuid,
                    ex,
                )
                # Fall back to database polling on pub/sub failure
                cls._poll_for_abort(
                    task_uuid, callback, stop_event, fallback_interval, app
                )

        except (ValueError, OSError) as ex:
            # ValueError: "I/O operation on closed file" - expected when stop() closes
            # OSError: Similar connection-closed errors
            if stop_event.is_set():
                # Clean shutdown, expected behavior
                logger.debug(
                    "Abort listener for task %s stopped cleanly",
                    task_uuid,
                )
            else:
                # Unexpected error while running
                logger.error(
                    "Error in abort listener for task %s: %s",
                    task_uuid,
                    str(ex),
                    exc_info=True,
                )

        except Exception as ex:
            # Only log as error if we weren't asked to stop
            if stop_event.is_set():
                logger.debug(
                    "Abort listener for task %s stopped with exception: %s",
                    task_uuid,
                    ex,
                )
            else:
                logger.error(
                    "Error in abort listener for task %s: %s",
                    task_uuid,
                    str(ex),
                    exc_info=True,
                )

        finally:
            # Clean up pub/sub subscription
            try:
                pubsub.unsubscribe()
                pubsub.close()
            except Exception as ex:
                logger.debug("Error closing pub/sub during cleanup: %s", ex)

    @classmethod
    def _poll_for_abort(
        cls,
        task_uuid: str,
        callback: Callable[[], None],
        stop_event: threading.Event,
        interval: float,
        app: Any,
    ) -> None:
        """Background polling loop - fallback when pub/sub is unavailable."""
        # Lazy import to avoid circular dependencies
        from superset.daos.tasks import TaskDAO

        while not stop_event.is_set():
            try:
                # Wrap database access in Flask app context
                if app:
                    with app.app_context():
                        task = TaskDAO.find_one_or_none(uuid=task_uuid)
                        if task and task.status in [
                            TaskStatus.ABORTING.value,
                            TaskStatus.ABORTED.value,
                        ]:
                            logger.info(
                                "Abort detected via polling for task %s (status=%s)",
                                task_uuid,
                                task.status,
                            )
                            callback()
                            break
                else:
                    # Fallback without app context (e.g., in tests)
                    task = TaskDAO.find_one_or_none(uuid=task_uuid)
                    if task and task.status in [
                        TaskStatus.ABORTING.value,
                        TaskStatus.ABORTED.value,
                    ]:
                        logger.info(
                            "Abort detected via polling for task %s (status=%s)",
                            task_uuid,
                            task.status,
                        )
                        callback()
                        break

                # Wait for interval or until stop is requested
                stop_event.wait(timeout=interval)

            except Exception as ex:
                logger.error(
                    "Error in abort polling for task %s: %s",
                    task_uuid,
                    str(ex),
                    exc_info=True,
                )
                break

    @staticmethod
    def submit_task(
        task_type: str,
        task_key: str | None,
        task_name: str | None,
        scope: TaskScope,
        timeout: int | None,
        args: tuple[Any, ...],
        kwargs: dict[str, Any],
    ) -> "Task":
        """
        Create task entry and schedule for async execution.

        Flow:
        1. Generate task_id if not provided (random UUID)
        2. Create Task record in metastore (with PENDING status)
        3. If duplicate active task exists, return it instead
        4. Submit to Celery for background execution
        5. Return Task model to caller

        :param task_type: Task type identifier (e.g., "superset.generate_thumbnail")
        :param task_key: Optional deduplication key (None for random UUID)
        :param task_name: Human readable task name
        :param scope: Task scope (TaskScope.PRIVATE, SHARED, or SYSTEM)
        :param timeout: Optional timeout in seconds
        :param args: Positional arguments for the task function
        :param kwargs: Keyword arguments for the task function
        :returns: Task model representing the scheduled task
        """
        if task_key is None:
            task_key = generate_random_task_key()

        # Build properties with execution_mode and timeout
        properties: TaskProperties = {"execution_mode": "async"}
        if timeout:
            properties["timeout"] = timeout

        try:
            # Create task entry in metastore
            # Command automatically extracts current user for subscription
            # Lazy import to avoid circular dependency
            from superset.commands.tasks.create import CreateTaskCommand

            task = CreateTaskCommand(
                {
                    "task_key": task_key,
                    "task_type": task_type,
                    "task_name": task_name,
                    "scope": scope.value,
                    "properties": properties,
                }
            ).run()

            # Import here to avoid circular dependency
            from superset.tasks.scheduler import execute_task

            # Schedule Celery task for async execution
            execute_task.delay(
                task_uuid=task.uuid,
                task_type=task_type,
                args=args,
                kwargs=kwargs,
            )

            logger.info(
                "Scheduled task %s (uuid=%s) for async execution",
                task_type,
                task.uuid,
            )

            return task

        except TaskCreateFailedError:
            # Task with same task_key already exists and is active
            # Return existing task instead of creating duplicate
            # Lazy import to avoid circular dependency
            from superset.daos.tasks import TaskDAO

            existing = TaskDAO.find_by_task_key(task_type, task_key, scope.value)
            if existing:
                logger.info(
                    "Task %s with key '%s' and scope '%s' already exists (uuid=%s), "
                    "returning existing task",
                    task_type,
                    task_key,
                    scope.value,
                    existing.uuid,
                )
                return existing

            # Race condition: task completed between check and here
            # Try again to create new task
            logger.warning(
                "Race condition detected for task %s with key '%s' and "
                "scope '%s', retrying",
                task_type,
                task_key,
                scope.value,
            )
            return TaskManager.submit_task(
                task_type, task_key, task_name, scope, timeout, args, kwargs
            )
