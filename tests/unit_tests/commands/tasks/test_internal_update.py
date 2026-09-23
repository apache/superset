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
"""Unit tests for GTF internal status-transition observability."""

from unittest.mock import MagicMock, patch
from uuid import uuid4

from superset_core.tasks.types import TaskStatus

from superset.commands.tasks.internal_update import InternalStatusTransitionCommand


def _run_transition(new_status, *, committed: bool):
    """Run a transition with the DB write forced to ``committed`` and capture the
    STATS_LOGGER the command emitted to. Returns the stats logger mock."""
    stats_logger = MagicMock()
    app = MagicMock()
    app.config = {"STATS_LOGGER": stats_logger}
    cmd = InternalStatusTransitionCommand(
        task_uuid=uuid4(),
        new_status=new_status,
        expected_status=TaskStatus.PENDING,
    )
    with (
        patch.object(cmd, "_run_in_transaction", return_value=committed),
        patch("superset.commands.tasks.internal_update.current_app", app),
        patch(
            "superset.commands.tasks.internal_update.TaskManager"
        ),  # silence realtime nudges
    ):
        cmd.run()
    return stats_logger


def test_transition_emits_status_scoped_metric_on_commit():
    """A committed transition emits gtf.task.transition.<status> so completion/
    abort/timeout/failure rates are observable."""
    stats_logger = _run_transition(TaskStatus.SUCCESS, committed=True)
    stats_logger.incr.assert_called_once_with("gtf.task.transition.success")


def test_transition_accepts_raw_string_status():
    """new_status may be a raw string (not the enum) — metric still resolves."""
    stats_logger = _run_transition("failure", committed=True)
    stats_logger.incr.assert_called_once_with("gtf.task.transition.failure")


def test_no_metric_when_transition_is_noop():
    """A no-op transition (expected status didn't match) emits no metric."""
    stats_logger = _run_transition(TaskStatus.SUCCESS, committed=False)
    stats_logger.incr.assert_not_called()
