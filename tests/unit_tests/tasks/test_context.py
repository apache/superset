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
"""Unit tests for TaskContext.update_task throttling behavior."""

from unittest.mock import MagicMock, Mock, patch
from uuid import UUID

import pytest
from superset_core.tasks.types import TaskStatus

from superset.tasks.context import TaskContext

TEST_UUID = UUID("b8b61b7b-1cd3-4a31-a74a-0a95341afc06")


@pytest.fixture
def context():
    """Build a TaskContext with DB writes and app config mocked out.

    Throttling is set to a long interval so that, absent an explicit override,
    updates after the first are deferred rather than written.
    """
    task = MagicMock()
    task.uuid = TEST_UUID
    task.status = TaskStatus.PENDING.value
    task.properties_dict = {}
    task.payload_dict = {}

    with (
        patch("superset.tasks.context.current_app") as mock_current_app,
        patch("superset.daos.tasks.TaskDAO"),
    ):
        mock_current_app.config = {
            "TASK_PROGRESS_UPDATE_THROTTLE_INTERVAL": 100,
            "STATS_LOGGER": MagicMock(),
        }
        mock_current_app._get_current_object = Mock(return_value=MagicMock())
        ctx = TaskContext(task)
        with patch.object(ctx, "_write_to_db") as write:
            yield ctx, write
        ctx._cancel_deferred_flush_timer()


def test_first_update_writes_then_throttles(context) -> None:
    ctx, write = context

    ctx.update_task(payload={"a": 1})
    assert write.call_count == 1

    # Second update inside the throttle window is deferred, not written.
    ctx.update_task(payload={"b": 2})
    assert write.call_count == 1
    assert ctx._has_pending_updates is True


def test_immediate_write_bypasses_throttle_window(context) -> None:
    ctx, write = context

    # Prime the throttle window with a first (immediate) write.
    ctx.update_task(payload={"a": 1})
    assert write.call_count == 1

    # A subsequent immediate=True update writes synchronously even though the
    # throttle window has not elapsed, and clears any pending deferred state.
    ctx.update_task(payload={"b": 2})  # deferred
    assert write.call_count == 1
    ctx.update_task(payload={"cache_key": "abc"}, immediate=True)
    assert write.call_count == 2
    assert ctx._has_pending_updates is False
    assert ctx._deferred_flush_timer is None


def test_immediate_write_on_first_update(context) -> None:
    ctx, write = context

    ctx.update_task(payload={"cache_key": "abc"}, immediate=True)
    assert write.call_count == 1
    assert ctx._last_db_write_time is not None
