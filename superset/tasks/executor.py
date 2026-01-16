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
"""Generic task executor for the Global Task Framework (GTF)"""

import logging
from datetime import datetime, timezone
from typing import Any

from superset_core.api.tasks import TaskStatus

from superset.daos.tasks import TaskDAO
from superset.extensions import celery_app
from superset.tasks.ambient_context import use_context
from superset.tasks.context import TaskContext
from superset.tasks.registry import TaskRegistry

logger = logging.getLogger(__name__)


@celery_app.task(name="tasks.execute", bind=True)
def execute_task(  # noqa: C901
    self: Any,  # Celery task instance
    task_uuid: str,
    task_type: str,
    args: tuple[Any, ...],
    kwargs: dict[str, Any],
) -> dict[str, Any]:
    """
    Generic task executor for GTF tasks.

    This executor:
    1. Checks if task was aborted before execution starts
    2. Fetches task from metastore
    3. Builds context (task + user) and sets ambient context via contextvars
    4. Executes the task function (which accesses context via get_context())
    5. Updates task status throughout lifecycle
    6. Runs cleanup handlers on task end (success/failure/abortion)
    7. Resets context after execution

    :param task_uuid: UUID of the task to execute
    :param task_type: Type of the task (for registry lookup)
    :param args: Positional arguments for the task function
    :param kwargs: Keyword arguments for the task function
    :returns: Dict with status and task_uuid
    """
    task = TaskDAO.find_one_or_none(uuid=task_uuid)
    if not task:
        logger.error("Task %s not found in metastore", task_uuid)
        return {"status": "error", "message": "Task not found"}

    # Build context from task (includes user who created the task)
    ctx = TaskContext(task_uuid=task_uuid)

    # AUTOMATIC PRE-EXECUTION CHECK: Don't execute if already aborted/aborting
    if ctx.is_aborted():
        logger.info(
            "Task %s (uuid=%s) was aborted before execution started",
            task_type,
            task_uuid,
        )
        task = ctx._task
        # Ensure status is ABORTED (not just ABORTING)
        if task.status != TaskStatus.ABORTED.value:
            task.set_status(TaskStatus.ABORTED)
        task.ended_at = datetime.now(timezone.utc)
        from superset.extensions import db

        db.session.merge(task)
        db.session.commit()
        return {"status": TaskStatus.ABORTED.value, "task_uuid": task_uuid}

    # Update status to IN_PROGRESS
    task = ctx._task
    task.set_status(TaskStatus.IN_PROGRESS)
    from superset.extensions import db

    db.session.merge(task)
    db.session.commit()

    try:
        # Get registered executor function
        executor_fn = TaskRegistry.get_executor(task_type)

        logger.info(
            "Executing task %s (uuid=%s) with function %s.%s",
            task_type,
            task_uuid,
            executor_fn.__module__,
            executor_fn.__name__,
        )

        # Execute with ambient context (no ctx parameter!)
        with use_context(ctx):
            executor_fn(*args, **kwargs)

        # Set success status if not already set by task
        task = ctx._task
        if task.status == TaskStatus.IN_PROGRESS.value:
            task.set_status(TaskStatus.SUCCESS)
            from superset.extensions import db

            db.session.merge(task)
            db.session.commit()

        logger.info("Task %s (uuid=%s) completed successfully", task_type, task_uuid)

    except Exception as ex:
        task = ctx._task
        task.set_status(TaskStatus.FAILURE)
        task.set_error_from_exception(ex)
        logger.error(
            "Task %s (uuid=%s) failed with error: %s",
            task_type,
            task_uuid,
            str(ex),
            exc_info=True,
        )
        from superset.extensions import db

        db.session.merge(task)
        db.session.commit()

    finally:
        # ALWAYS run cleanup handlers
        ctx._run_cleanup()

        # Check if task was aborting and needs to transition to aborted
        task = ctx._task
        if task.status == TaskStatus.ABORTING.value:
            if ctx.abort_handlers_completed:
                # All handlers succeeded, transition to ABORTED
                task.set_status(TaskStatus.ABORTED)
                logger.info(
                    "Task %s (uuid=%s) transitioned from ABORTING to ABORTED",
                    task_type,
                    task_uuid,
                )
            else:
                # Handlers didn't complete successfully
                # If status is still ABORTING, something went wrong
                if task.status == TaskStatus.ABORTING.value:
                    task.set_status(TaskStatus.FAILURE)
                    if not task.error_message:
                        task.error_message = "Abort handlers did not complete"
                    logger.warning(
                        "Task %s (uuid=%s) stuck in ABORTING - marking as FAILURE",
                        task_type,
                        task_uuid,
                    )

        # Always set end time if not already set
        if not task.ended_at:
            task.ended_at = datetime.now(timezone.utc)

        from superset.extensions import db

        db.session.merge(task)
        db.session.commit()

    return {"status": task.status, "task_uuid": task_uuid}
