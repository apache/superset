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
"""Unit tests for the GTF chart-data fan-out orchestrator."""

from unittest import mock
from uuid import uuid4

from pytest_mock import MockerFixture


def _fake_query_context(num_queries: int, contribution_idx: int | None = None):
    """Build a MagicMock QueryContext with ``num_queries`` queries.

    When ``contribution_idx`` is set, ``prepare_contribution_totals`` reports that
    query as contribution-coupled with query 0 as the totals query.
    """
    ctx = mock.MagicMock()
    ctx.queries = [mock.MagicMock(name=f"q{i}") for i in range(num_queries)]
    ctx.cache_values = {"queries": [{"i": i} for i in range(num_queries)]}
    ctx.query_cache_key.side_effect = lambda q: f"key-{ctx.queries.index(q)}"
    if contribution_idx is not None:
        ctx.prepare_contribution_totals.return_value = ([contribution_idx], 0)
    else:
        ctx.prepare_contribution_totals.return_value = ([], None)
    return ctx


def _patch_schedule(mocker: MockerFixture):
    """Patch execute_chart_query.schedule to return Tasks with unique uuids."""
    scheduled = []

    def _schedule(*args, **kwargs):
        task = mock.MagicMock()
        task.uuid = uuid4()
        scheduled.append({"args": args, "kwargs": kwargs, "task": task})
        return task

    mocker.patch(
        "superset.tasks.async_queries.execute_chart_query.schedule",
        side_effect=_schedule,
    )
    mocker.patch(
        "superset.tasks.async_queries.serialize_query",
        side_effect=lambda ctx, index: {"query": index},
    )
    guest = mocker.patch("superset.tasks.async_queries.security_manager")
    # Force a sync return (a bare patched method resolves to an AsyncMock whose
    # call is a truthy coroutine here); see the GAQ→GTF testing notes.
    guest.get_current_guest_user_if_guest = mock.MagicMock(return_value=None)
    return scheduled


def test_fan_out_schedules_one_task_per_query(mocker: MockerFixture) -> None:
    from superset.tasks.async_queries import submit_chart_data_query_tasks

    scheduled = _patch_schedule(mocker)
    ctx = _fake_query_context(3)

    result = submit_chart_data_query_tasks(ctx, user_id=7)

    assert len(scheduled) == 3
    # The 202 body carries the query tasks' uuids, in query order.
    assert result["task_ids"] == [str(s["task"].uuid) for s in scheduled]
    # Independent queries carry no dependency and no totals key.
    for call in scheduled:
        assert call["kwargs"]["options"].depends_on is None
        assert call["args"][3] is None  # totals_cache_key


def test_contribution_query_depends_on_totals(mocker: MockerFixture) -> None:
    from superset.tasks.async_queries import submit_chart_data_query_tasks

    scheduled = _patch_schedule(mocker)
    # query 1 is a contribution query; query 0 is the totals query.
    ctx = _fake_query_context(2, contribution_idx=1)

    submit_chart_data_query_tasks(ctx, user_id=7)

    # Totals query (index 0) is scheduled first with no dependency.
    totals_call = scheduled[0]
    assert totals_call["kwargs"]["options"].depends_on is None
    # The totals query's row_limit is normalized so its key matches the entry
    # its dependents read.
    assert ctx.cache_values["queries"][0]["row_limit"] is None

    # The contribution query depends on the totals task and receives its key.
    dep_call = next(c for c in scheduled if c["args"][0] == {"query": 1})
    assert dep_call["kwargs"]["options"].depends_on == [totals_call["task"]]
    assert dep_call["args"][3] == "key-0"  # totals_cache_key


def test_guest_token_forwarded(mocker: MockerFixture) -> None:
    from superset.tasks.async_queries import submit_chart_data_query_tasks

    scheduled = _patch_schedule(mocker)
    guest = mock.MagicMock()
    guest.guest_token = {"user": {"username": "guest"}}
    sm = mocker.patch("superset.tasks.async_queries.security_manager")
    sm.get_current_guest_user_if_guest = mock.MagicMock(return_value=guest)
    ctx = _fake_query_context(1)

    submit_chart_data_query_tasks(ctx, user_id=None)

    # The guest token is passed to the task so the worker can impersonate.
    assert scheduled[0]["args"][2] == guest.guest_token
