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
"""Integration tests for TaskContext update_task throttling.

Tests verify:
1. Final state is persisted correctly via cleanup flush
2. Throttled updates are deferred, timer writes latest pending update
"""

from __future__ import annotations

import time
import uuid

from superset_core.api.tasks import TaskScope, TaskStatus

from superset.daos.tasks import TaskDAO
from superset.extensions import db
from superset.models.tasks import Task
from superset.tasks.ambient_context import get_context
from superset.tasks.registry import TaskRegistry
from superset.tasks.scheduler import execute_task
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME


def task_with_throttled_updates() -> None:
    """Task with rapid progress and payload updates (exercises throttling)."""
    ctx = get_context()

    # Rapid-fire updates within throttle window
    for i in range(10):
        ctx.update_task(progress=(i + 1, 10), payload={"step": i + 1})


def _register_test_tasks() -> None:
    """Register test task functions if not already registered.

    Called in setUp() to ensure tasks are registered regardless of
    whether other tests have cleared the registry.
    """
    if not TaskRegistry.is_registered("test_throttle_combined"):
        TaskRegistry.register("test_throttle_combined", task_with_throttled_updates)


class TestUpdateTaskThrottling(SupersetTestCase):
    """Integration test for update_task() throttling behavior."""

    def setUp(self) -> None:
        super().setUp()
        self.login(ADMIN_USERNAME)
        _register_test_tasks()

    def test_throttled_updates_persisted_on_cleanup(self) -> None:
        """Final state should be persisted regardless of throttling.

        Verifies the core invariant: cleanup flush ensures final state is persisted.
        """
        task_obj = TaskDAO.create_task(
            task_type="test_throttle_combined",
            task_key=f"test_key_{uuid.uuid4().hex[:8]}",
            task_name="Test Throttled Updates",
            scope=TaskScope.SYSTEM,
        )

        # Use str(uuid) since Celery serializes args as JSON strings
        result = execute_task.apply(
            args=[str(task_obj.uuid), "test_throttle_combined", (), {}]
        )

        assert result.successful()
        assert result.result["status"] == TaskStatus.SUCCESS.value

        # Verify final state is persisted
        db.session.expire_all()
        task_obj = db.session.query(Task).filter_by(uuid=task_obj.uuid).first()

        # Progress: 10/10 = 100%
        props = task_obj.properties_dict
        assert props.get("progress_current") == 10
        assert props.get("progress_total") == 10
        assert props.get("progress_percent") == 1.0

        # Payload: final step
        payload = task_obj.payload_dict
        assert payload.get("step") == 10

    def test_throttle_behavior(self) -> None:
        """Test complete throttle behavior: immediate write, deferral, and timer.

        Verifies:
        1. First update writes immediately
        2. Second and third updates within throttle window are deferred
        3. Deferred timer fires and writes the LATEST pending update (third)
        """
        from flask import current_app

        from superset.commands.tasks.submit import SubmitTaskCommand
        from superset.tasks.context import TaskContext

        # Get throttle interval from config (default: 2 seconds)
        throttle_interval = current_app.config["TASK_PROGRESS_UPDATE_THROTTLE_INTERVAL"]

        # Create task
        task_obj = SubmitTaskCommand(
            data={
                "task_type": "test_throttle_behavior",
                "task_key": f"test_key_{uuid.uuid4().hex[:8]}",
                "task_name": "Test Throttle Behavior",
                "scope": TaskScope.SYSTEM,
            }
        ).run()
        task_uuid = task_obj.uuid

        # Get fresh task for context
        fresh_task = TaskDAO.find_one_or_none(uuid=task_uuid, skip_base_filter=True)
        assert fresh_task is not None
        ctx = TaskContext(fresh_task)

        try:
            # === Step 1: First update - writes immediately ===
            ctx.update_task(progress=0.1, payload={"step": 1})

            db.session.expire_all()
            task_step1 = TaskDAO.find_one_or_none(uuid=task_uuid, skip_base_filter=True)
            assert task_step1 is not None
            assert task_step1.properties_dict.get("progress_percent") == 0.1
            assert task_step1.payload_dict.get("step") == 1

            # === Step 2: Second update - deferred (within throttle window) ===
            ctx.update_task(progress=0.5, payload={"step": 2})

            # === Step 3: Third update - also deferred, overwrites second in cache ===
            ctx.update_task(progress=0.7, payload={"step": 3})

            # Verify in-memory cache has LATEST update (third)
            assert ctx._properties_cache.get("progress_percent") == 0.7
            assert ctx._payload_cache.get("step") == 3

            # Verify DB still has first update (both second and third deferred)
            db.session.expire_all()
            task_step2 = TaskDAO.find_one_or_none(uuid=task_uuid, skip_base_filter=True)
            assert task_step2 is not None
            assert task_step2.properties_dict.get("progress_percent") == 0.1
            assert task_step2.payload_dict.get("step") == 1

            # === Step 4: Wait for deferred timer to fire ===
            time.sleep(throttle_interval + 0.5)

            # Verify timer fired and wrote the LATEST update (third, not second)
            db.session.expire_all()
            task_step3 = TaskDAO.find_one_or_none(uuid=task_uuid, skip_base_filter=True)
            assert task_step3 is not None
            assert task_step3.properties_dict.get("progress_percent") == 0.7
            assert task_step3.payload_dict.get("step") == 3

        finally:
            ctx._cancel_deferred_flush_timer()
