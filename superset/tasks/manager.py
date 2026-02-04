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
import time
from typing import Any, Callable, TYPE_CHECKING

import redis
from superset_core.api.tasks import TaskProperties, TaskScope

from superset.async_events.cache_backend import (
    RedisCacheBackend,
    RedisSentinelCacheBackend,
)
from superset.extensions import cache_manager
from superset.tasks.constants import ABORT_STATES, TERMINAL_STATES
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

        # Wait for thread to finish (with timeout to avoid blocking indefinitely)
        if self._thread.is_alive():
            self._thread.join(timeout=2.0)

            # Check if thread is still running after timeout
            if self._thread.is_alive():
                # Thread is a daemon, so it will be killed when process exits.
                # Log warning but continue - cleanup will still proceed.
                logger.warning(
                    "Abort listener thread for task %s did not terminate within "
                    "2 seconds. Thread will be terminated when process exits.",
                    self._task_uuid,
                )
            else:
                logger.debug("Stopped abort listener for task %s", self._task_uuid)
        else:
            logger.debug("Stopped abort listener for task %s", self._task_uuid)


class TaskManager:
    """
    Handles task creation, scheduling, and abort notifications.

    The TaskManager is responsible for:
    1. Creating task entries in the metastore (Task model)
    2. Scheduling task execution via Celery
    3. Handling deduplication (returning existing active task if duplicate)
    4. Managing real-time abort notifications (optional)

    Redis pub/sub is opt-in via COORDINATION_CACHE_CONFIG configuration. When not
    configured, tasks use database polling for abort detection.
    """

    # Class-level state (initialized once via init_app)
    _channel_prefix: str = "gtf:abort:"
    _completion_channel_prefix: str = "gtf:complete:"
    _initialized: bool = False

    # Backward compatibility alias - prefer importing from superset.tasks.constants
    TERMINAL_STATES = TERMINAL_STATES

    @classmethod
    def init_app(cls, app: Flask) -> None:
        """
        Initialize the TaskManager with Flask app config.

        Redis connection is managed by CacheManager - this just reads channel prefixes.

        :param app: Flask application instance
        """
        if cls._initialized:
            return

        cls._channel_prefix = app.config.get("TASKS_ABORT_CHANNEL_PREFIX", "gtf:abort:")
        cls._completion_channel_prefix = app.config.get(
            "TASKS_COMPLETION_CHANNEL_PREFIX", "gtf:complete:"
        )

        cls._initialized = True

    @classmethod
    def _get_cache(cls) -> RedisCacheBackend | RedisSentinelCacheBackend | None:
        """
        Get the coordination cache backend.

        :returns: The coordination cache backend, or None if not configured
        """
        return cache_manager.coordination_cache

    @classmethod
    def is_pubsub_available(cls) -> bool:
        """
        Check if Redis pub/sub backend is configured and available.

        :returns: True if Redis is available for pub/sub, False otherwise
        """
        return cls._get_cache() is not None

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
        cache = cls._get_cache()
        if not cache:
            return False

        try:
            channel = cls.get_abort_channel(task_uuid)
            subscriber_count = cache.publish(channel, "abort")
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
    def get_completion_channel(cls, task_uuid: str) -> str:
        """
        Get the completion channel name for a task.

        :param task_uuid: UUID of the task
        :returns: Channel name for the task's completion notifications
        """
        return f"{cls._completion_channel_prefix}{task_uuid}"

    @classmethod
    def publish_completion(cls, task_uuid: str, status: str) -> bool:
        """
        Publish a completion message to the task's channel.

        Called when task reaches terminal state (SUCCESS, FAILURE, ABORTED, TIMED_OUT).
        This notifies any waiters (e.g., sync callers waiting for an existing task).

        :param task_uuid: UUID of the completed task
        :param status: Final status of the task
        :returns: True if message was published, False if Redis unavailable
        """
        cache = cls._get_cache()
        if not cache:
            return False

        try:
            channel = cls.get_completion_channel(task_uuid)
            subscriber_count = cache.publish(channel, status)
            logger.debug(
                "Published completion to channel %s (status=%s, %d subscribers)",
                channel,
                status,
                subscriber_count,
            )
            return True
        except redis.RedisError as ex:
            logger.error("Failed to publish completion for task %s: %s", task_uuid, ex)
            return False

    @classmethod
    def wait_for_completion(
        cls,
        task_uuid: str,
        timeout: float | None = None,
        poll_interval: float = 1.0,
        app: Any = None,
    ) -> "Task":
        """
        Block until task reaches terminal state.

        Uses Redis pub/sub if configured for low-latency, low-CPU waiting.
        Uses database polling if Redis is not configured.

        :param task_uuid: UUID of the task to wait for
        :param timeout: Maximum time to wait in seconds (None = no limit)
        :param poll_interval: Interval for database polling (seconds)
        :param app: Flask app for database access
        :returns: Task in terminal state
        :raises TimeoutError: If timeout expires before task completes
        :raises ValueError: If task not found
        """
        from superset.daos.tasks import TaskDAO

        start_time = time.monotonic()

        def time_remaining() -> float | None:
            if timeout is None:
                return None
            elapsed = time.monotonic() - start_time
            remaining = timeout - elapsed
            return remaining if remaining > 0 else 0

        def get_task() -> "Task | None":
            if app:
                with app.app_context():
                    return TaskDAO.find_one_or_none(uuid=task_uuid)
            return TaskDAO.find_one_or_none(uuid=task_uuid)

        # Check current state first
        task = get_task()
        if not task:
            raise ValueError(f"Task {task_uuid} not found")

        if task.status in cls.TERMINAL_STATES:
            return task

        logger.info(
            "Waiting for task %s to complete (current status=%s, timeout=%s)",
            task_uuid,
            task.status,
            timeout,
        )

        # Use Redis pub/sub if configured
        if (cache := cls._get_cache()) is not None:
            task = cls._wait_via_pubsub(
                task_uuid,
                cache.pubsub(),
                timeout,
                poll_interval,
                get_task,
                time_remaining,
            )
            if task:
                return task
            # Should not reach here - _wait_via_pubsub returns task or raises
            raise RuntimeError(f"Unexpected state waiting for task {task_uuid}")

        # Use database polling when Redis is not configured
        return cls._wait_via_polling(task_uuid, poll_interval, get_task, time_remaining)

    @classmethod
    def _wait_via_pubsub(
        cls,
        task_uuid: str,
        pubsub: redis.client.PubSub,
        timeout: float | None,
        poll_interval: float,
        get_task: Callable[[], "Task | None"],
        time_remaining: Callable[[], float | None],
    ) -> "Task | None":
        """
        Wait for task completion using Redis pub/sub.

        :returns: Task when completed
        :raises TimeoutError: If timeout expires
        :raises redis.RedisError: If Redis connection fails
        """
        channel = cls.get_completion_channel(task_uuid)
        pubsub.subscribe(channel)

        try:
            while True:
                remaining = time_remaining()
                if remaining is not None and remaining <= 0:
                    raise TimeoutError(
                        f"Timeout waiting for task {task_uuid} to complete"
                    )

                # Wait for message with short timeout for responsive checking
                wait_time = min(1.0, remaining) if remaining else 1.0
                message = pubsub.get_message(
                    ignore_subscribe_messages=True,
                    timeout=wait_time,
                )

                if message and message.get("type") == "message":
                    # Completion received - fetch fresh task state
                    logger.debug(
                        "Received completion message for task %s: %s",
                        task_uuid,
                        message.get("data"),
                    )
                    task = get_task()
                    if task and task.status in cls.TERMINAL_STATES:
                        return task

                # Also check database periodically in case we missed the message
                # (e.g., task completed before we subscribed)
                task = get_task()
                if task and task.status in cls.TERMINAL_STATES:
                    logger.debug(
                        "Task %s completed (detected via db check): status=%s",
                        task_uuid,
                        task.status,
                    )
                    return task

        finally:
            pubsub.unsubscribe()
            pubsub.close()

    @classmethod
    def _wait_via_polling(
        cls,
        task_uuid: str,
        poll_interval: float,
        get_task: Callable[[], "Task | None"],
        time_remaining: Callable[[], float | None],
    ) -> "Task":
        """
        Wait for task completion using database polling.

        :returns: Task when completed
        :raises TimeoutError: If timeout expires
        :raises ValueError: If task not found
        """
        while True:
            remaining = time_remaining()
            if remaining is not None and remaining <= 0:
                raise TimeoutError(f"Timeout waiting for task {task_uuid} to complete")

            task = get_task()
            if not task:
                raise ValueError(f"Task {task_uuid} not found")

            if task.status in cls.TERMINAL_STATES:
                logger.debug(
                    "Task %s completed (detected via polling): status=%s",
                    task_uuid,
                    task.status,
                )
                return task

            # Sleep with timeout awareness
            sleep_time = min(poll_interval, remaining) if remaining else poll_interval
            time.sleep(sleep_time)

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

        Uses Redis pub/sub if configured, otherwise uses database polling.
        The callback is invoked when an abort is detected.

        :param task_uuid: UUID of the task to monitor
        :param callback: Function to call when abort is detected
        :param poll_interval: Interval for database polling (when Redis not configured)
        :param app: Flask app for database access in background thread
        :returns: AbortListener handle to stop listening
        """
        stop_event = threading.Event()
        pubsub: redis.client.PubSub | None = None

        # Use Redis pub/sub if configured
        if (cache := cls._get_cache()) is not None:
            pubsub = cache.pubsub()
            channel = cls.get_abort_channel(task_uuid)
            pubsub.subscribe(channel)
            logger.debug("Subscribed to abort channel: %s", channel)

            # Start pub/sub listener thread
            thread = threading.Thread(
                target=cls._listen_pubsub,
                args=(task_uuid, pubsub, callback, stop_event, app),
                daemon=True,
                name=f"abort-listener-{task_uuid[:8]}",
            )
            logger.info("Started pub/sub abort listener for task %s", task_uuid)
        else:
            # Use polling when Redis is not configured
            pubsub = None
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

    @staticmethod
    def _invoke_callback_with_context(
        callback: Callable[[], None],
        app: Any,
    ) -> None:
        """
        Invoke callback with Flask app context if provided.

        :param callback: Function to invoke
        :param app: Flask app for context, or None
        """
        if app:
            with app.app_context():
                callback()
        else:
            callback()

    @classmethod
    def _check_abort_status(cls, task_uuid: str) -> bool:
        """
        Check if task has been aborted via database query.

        :param task_uuid: UUID of the task to check
        :returns: True if task is in ABORTING or ABORTED state
        """
        from superset.daos.tasks import TaskDAO

        task = TaskDAO.find_one_or_none(uuid=task_uuid)
        return task is not None and task.status in ABORT_STATES

    @classmethod
    def _run_abort_listener_loop(
        cls,
        task_uuid: str,
        callback: Callable[[], None],
        stop_event: threading.Event,
        interval: float,
        app: Any,
        check_fn: Callable[[], bool],
        source: str,
    ) -> None:
        """
        Common abort listener loop used by both pub/sub and polling modes.

        :param task_uuid: UUID of the task to monitor
        :param callback: Function to call when abort is detected
        :param stop_event: Event to signal loop termination
        :param interval: Wait interval between checks
        :param app: Flask app for context
        :param check_fn: Function that returns True if abort was detected
        :param source: Source identifier for logging ("pub/sub" or "polling")
        """
        while not stop_event.is_set():
            try:
                if check_fn():
                    logger.info(
                        "Abort detected via %s for task %s",
                        source,
                        task_uuid,
                    )
                    cls._invoke_callback_with_context(callback, app)
                    break

                # Wait for interval or until stop is requested
                stop_event.wait(timeout=interval)

            except (ValueError, OSError) as ex:
                # ValueError/OSError with "I/O operation on closed file" or
                # "Bad file descriptor" typically means the connection was closed
                # during shutdown. Check if stop was requested.
                if stop_event.is_set():
                    logger.debug(
                        "Abort %s for task %s stopped cleanly (connection closed)",
                        source,
                        task_uuid,
                    )
                else:
                    logger.error(
                        "Error in abort %s for task %s: %s",
                        source,
                        task_uuid,
                        str(ex),
                        exc_info=True,
                    )
                break

            except Exception as ex:
                # Check if stop was requested - if so, this may be expected
                if stop_event.is_set():
                    logger.debug(
                        "Abort %s for task %s stopped with exception: %s",
                        source,
                        task_uuid,
                        ex,
                    )
                else:
                    logger.error(
                        "Error in abort %s for task %s: %s",
                        source,
                        task_uuid,
                        str(ex),
                        exc_info=True,
                    )
                break

    @classmethod
    def _listen_pubsub(
        cls,
        task_uuid: str,
        pubsub: redis.client.PubSub,
        callback: Callable[[], None],
        stop_event: threading.Event,
        app: Any,
    ) -> None:
        """Listen for abort via Redis pub/sub."""
        # Track if abort was received to avoid double-callback
        abort_received = False

        def check_pubsub() -> bool:
            nonlocal abort_received
            message = pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message is not None and message.get("type") == "message":
                abort_received = True
                return True
            return False

        try:
            cls._run_abort_listener_loop(
                task_uuid=task_uuid,
                callback=callback,
                stop_event=stop_event,
                interval=0,  # pub/sub has its own timeout in get_message
                app=app,
                check_fn=check_pubsub,
                source="pub/sub",
            )

        except redis.RedisError as ex:
            # Check if we were asked to stop - if so, this is expected
            if stop_event.is_set():
                logger.debug(
                    "Abort listener for task %s stopped (Redis error: %s)",
                    task_uuid,
                    ex,
                )
            else:
                # Log error but don't fall back - let the failure be visible
                logger.error(
                    "Redis coordination backend failed for task %s abort listener: %s. "
                    "Task may not receive abort signal.",
                    task_uuid,
                    ex,
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
        """Background polling loop - used when Redis pub/sub is not configured."""

        def check_database() -> bool:
            # Need app context for database access
            if app:
                with app.app_context():
                    return cls._check_abort_status(task_uuid)
            else:
                return cls._check_abort_status(task_uuid)

        cls._run_abort_listener_loop(
            task_uuid=task_uuid,
            callback=callback,
            stop_event=stop_event,
            interval=interval,
            app=app,
            check_fn=check_database,
            source="polling",
        )

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
        1. Generate task_key if not provided (random UUID)
        2. Submit to SubmitTaskCommand which handles locking and create-vs-join
        3. Schedule Celery task ONLY for new tasks (not deduplicated ones)
        4. Return Task model to caller

        The SubmitTaskCommand uses a distributed lock to prevent race conditions,
        returning either a new task or an existing active task with the same key.

        :param task_type: Task type identifier (e.g., "superset.generate_thumbnail")
        :param task_key: Optional deduplication key (None for random UUID)
        :param task_name: Human readable task name
        :param scope: Task scope (TaskScope.PRIVATE, SHARED, or SYSTEM)
        :param timeout: Optional timeout in seconds
        :param args: Positional arguments for the task function
        :param kwargs: Keyword arguments for the task function
        :returns: Task model representing the scheduled task
        """
        from superset.commands.tasks.submit import SubmitTaskCommand

        if task_key is None:
            task_key = generate_random_task_key()

        # Build properties with execution_mode and timeout
        properties: TaskProperties = {"execution_mode": "async"}
        if timeout:
            properties["timeout"] = timeout

        # Create or join task entry in metastore
        # SubmitTaskCommand handles locking and create-vs-join logic:
        # - Acquires distributed lock on dedup_key
        # - If active task exists: adds subscriber and returns existing task
        #   (is_new=False)
        # - If no active task: creates new task (is_new=True)
        task, is_new = SubmitTaskCommand(
            {
                "task_key": task_key,
                "task_type": task_type,
                "task_name": task_name,
                "scope": scope.value,
                "properties": properties,
            }
        ).run_with_info()

        # Only schedule Celery task for NEW tasks, not deduplicated ones
        # Deduplicated tasks are already pending or running
        if is_new:
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
        else:
            logger.info(
                "Joined existing task %s (uuid=%s) - no new Celery task scheduled",
                task_type,
                task.uuid,
            )

        return task
