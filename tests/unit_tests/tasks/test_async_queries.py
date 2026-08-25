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

import pytest
from pytest_mock import MockerFixture

from superset.common.query_serialization import SerializedQuery


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


def _serialized_query() -> SerializedQuery:
    return SerializedQuery(
        datasource={"id": 1, "type": "table"},
        query={"metrics": ["count"], "columns": ["name"], "time_range": "No filter"},
        form_data=None,
        result_type="full",
        result_format="json",
        force=False,
        custom_cache_timeout=None,
    )


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
    # ...plus a status-poll cursor captured before the tasks were scheduled.
    assert isinstance(result["cursor"], str)
    # Independent queries carry no dependency and do not read dependency payloads.
    for call in scheduled:
        assert call["kwargs"]["options"].depends_on is None
        assert call["args"][3] is False  # requires_totals


def test_contribution_query_depends_on_totals(mocker: MockerFixture) -> None:
    from superset.tasks.async_queries import submit_chart_data_query_tasks

    scheduled = _patch_schedule(mocker)
    # query 1 is a contribution query; query 0 is the totals query.
    ctx = _fake_query_context(2, contribution_idx=1)

    submit_chart_data_query_tasks(ctx, user_id=7)

    # Totals query (index 0) is scheduled first with no dependency.
    totals_call = scheduled[0]
    assert totals_call["kwargs"]["options"].depends_on is None
    assert totals_call["args"][3] is False  # requires_totals

    # The contribution query depends on the totals task and reads its payload.
    dep_call = next(c for c in scheduled if c["args"][0] == {"query": 1})
    assert dep_call["kwargs"]["options"].depends_on == [totals_call["task"]]
    assert dep_call["args"][3] is True  # requires_totals


def test_execute_chart_query_publishes_cache_key_payload(
    mocker: MockerFixture,
) -> None:
    from superset.tasks.async_queries import execute_chart_query

    query_obj = mocker.MagicMock()
    query_context = mocker.MagicMock()
    query_context.queries = [query_obj]
    query_context.get_df_payload_result.return_value.payload = {
        "cache_key": "chart-cache-key"
    }
    task_context = mocker.MagicMock()

    mocker.patch(
        "superset.tasks.async_queries._resolve_user",
        return_value=mocker.MagicMock(),
    )
    mocker.patch("superset.tasks.async_queries.override_user")
    mocker.patch(
        "superset.tasks.async_queries.load_serialized_query",
        return_value=query_context,
    )
    mocker.patch(
        "superset.tasks.async_queries.get_context",
        return_value=task_context,
    )

    execute_chart_query.func(_serialized_query(), user_id=7)

    query_context.get_df_payload_result.assert_called_once_with(query_obj)
    task_context.update_task.assert_called_once_with(
        payload={"cache_key": "chart-cache-key"}
    )


def test_execute_chart_query_reads_totals_key_from_dependency_payload(
    mocker: MockerFixture,
) -> None:
    from superset.tasks.async_queries import execute_chart_query

    query_obj = mocker.MagicMock()
    query_context = mocker.MagicMock()
    query_context.queries = [query_obj]
    query_context.get_df_payload_result.return_value.payload = {
        "cache_key": "main-cache-key"
    }
    task_context = mocker.MagicMock()
    task_context.get_dependency_payloads.return_value = [
        {"cache_key": "totals-cache-key"}
    ]
    inject = mocker.patch("superset.tasks.async_queries._inject_contribution_totals")

    mocker.patch(
        "superset.tasks.async_queries._resolve_user",
        return_value=mocker.MagicMock(),
    )
    mocker.patch("superset.tasks.async_queries.override_user")
    mocker.patch(
        "superset.tasks.async_queries.load_serialized_query",
        return_value=query_context,
    )
    mocker.patch(
        "superset.tasks.async_queries.get_context",
        return_value=task_context,
    )

    execute_chart_query.func(_serialized_query(), user_id=7, requires_totals=True)

    inject.assert_called_once_with(query_obj, "totals-cache-key")
    task_context.update_task.assert_called_once_with(
        payload={"cache_key": "main-cache-key"}
    )


def test_get_dependency_cache_key_requires_payload(mocker: MockerFixture) -> None:
    from superset.exceptions import SupersetException
    from superset.tasks.async_queries import _get_dependency_cache_key

    task_context = mocker.MagicMock()
    task_context.get_dependency_payloads.return_value = [{}]
    mocker.patch(
        "superset.tasks.async_queries.get_context",
        return_value=task_context,
    )

    with pytest.raises(SupersetException):
        _get_dependency_cache_key()


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


def test_task_name_prefers_slice_name(mocker: MockerFixture) -> None:
    from superset.tasks.async_queries import submit_chart_data_query_tasks

    scheduled = _patch_schedule(mocker)
    ctx = _fake_query_context(1)
    ctx.slice_.slice_name = "Sales by Region"

    submit_chart_data_query_tasks(ctx, user_id=1)

    assert scheduled[0]["kwargs"]["options"].task_name == "Sales by Region"


def test_task_name_falls_back_to_dataset_name(mocker: MockerFixture) -> None:
    from superset.tasks.async_queries import submit_chart_data_query_tasks

    scheduled = _patch_schedule(mocker)
    ctx = _fake_query_context(1)
    ctx.slice_ = None  # ad-hoc / unsaved chart → no slice name
    ctx.datasource.name = "cleaned_sales_data"

    submit_chart_data_query_tasks(ctx, user_id=1)

    assert scheduled[0]["kwargs"]["options"].task_name == "cleaned_sales_data"


def test_task_name_disambiguates_multiple_queries(mocker: MockerFixture) -> None:
    from superset.tasks.async_queries import submit_chart_data_query_tasks

    scheduled = _patch_schedule(mocker)
    ctx = _fake_query_context(2)
    ctx.slice_ = None
    ctx.datasource.name = "births"

    submit_chart_data_query_tasks(ctx, user_id=1)

    names = [s["kwargs"]["options"].task_name for s in scheduled]
    assert names == ["births (1)", "births (2)"]
