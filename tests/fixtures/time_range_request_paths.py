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
"""Shared builders for time range limits tests."""

from __future__ import annotations

from typing import Any
from unittest import mock
from uuid import uuid4

from pytest_mock import MockerFixture


def run_worker_task(mocker: MockerFixture, query_context: Any) -> Any:
    from superset.tasks.async_queries import execute_chart_query
    from superset.tasks.scheduler import _execute_task_body
    from superset.tasks.utils import error_update

    task = mock.MagicMock()
    task.uuid = uuid4()
    task.properties_dict = {}
    task_context = mock.MagicMock()
    task_context.aborting_in_flight = False
    task_context.fence_triggered = False
    task_context._abort_detected = False
    task_context.timeout_triggered = False
    task_context.error_properties.side_effect = error_update

    def transition_status(**kwargs: Any) -> Any:
        task.status = kwargs["new_status"].value
        return mock.MagicMock(run=mock.MagicMock(return_value=True))

    transition = mocker.patch(
        "superset.commands.tasks.internal_update.InternalStatusTransitionCommand",
        side_effect=transition_status,
    )
    mocker.patch("superset.tasks.scheduler.TaskContext", return_value=task_context)
    mocker.patch("superset.tasks.scheduler.TaskDAO.find_one_or_none", return_value=task)
    mocker.patch(
        "superset.tasks.scheduler.TaskRegistry.get_executor",
        return_value=execute_chart_query.func,
    )
    mocker.patch("superset.tasks.scheduler.TaskManager")
    mocker.patch("superset.tasks.async_queries.get_context", return_value=task_context)
    mocker.patch("superset.tasks.async_queries._resolve_user")
    mocker.patch("superset.tasks.async_queries.override_user")
    mocker.patch(
        "superset.tasks.async_queries.load_serialized_query",
        return_value=query_context,
    )
    result = _execute_task_body(
        task,
        task.uuid,
        "superset.query_object_v1",
        ({"datasource": {"id": 7, "type": "table"}},),
        {},
        mock.MagicMock(),
    )
    return result, transition, task_context


__all__ = ["Any", "MockerFixture", "mock", "run_worker_task", "uuid4"]
