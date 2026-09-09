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

from typing import TYPE_CHECKING
from unittest import mock
from uuid import uuid4

import pytest
from pytest_mock import MockerFixture

from superset.common.query_serialization import SerializedQuery

if TYPE_CHECKING:
    from superset_core.tasks.types import TaskProperties


def _fake_query_context(
    num_queries: int,
    contribution_idx: int | None = None,
    totals_idx: int | None = 0,
):
    """Build a MagicMock QueryContext with ``num_queries`` queries.

    When ``contribution_idx`` is set, ``prepare_contribution_totals`` reports that
    query as using contribution post-processing, optionally coupled to ``totals_idx``.
    """
    ctx = mock.MagicMock()
    ctx.queries = [mock.MagicMock(name=f"q{i}") for i in range(num_queries)]
    ctx.cache_values = {"queries": [{"i": i} for i in range(num_queries)]}
    ctx.query_cache_key.side_effect = lambda q: f"key-{ctx.queries.index(q)}"
    if contribution_idx is not None:
        ctx.prepare_contribution_totals.return_value = ([contribution_idx], totals_idx)
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


def test_contribution_query_without_totals_runs_locally(
    mocker: MockerFixture,
) -> None:
    from superset.tasks.async_queries import submit_chart_data_query_tasks

    scheduled = _patch_schedule(mocker)
    ctx = _fake_query_context(1, contribution_idx=0, totals_idx=None)

    submit_chart_data_query_tasks(ctx, user_id=7)

    assert len(scheduled) == 1
    assert scheduled[0]["kwargs"]["options"].depends_on is None
    assert scheduled[0]["args"][3] is False  # requires_totals


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
        payload={"cache_key": "chart-cache-key"}, immediate=True
    )


def test_execute_chart_query_reestablishes_form_data(
    mocker: MockerFixture,
) -> None:
    """The worker has no request context, so g.form_data must be re-established
    from the serialized payload as a *body*-shaped dict (datasource + per-query
    fields) — otherwise ``get_form_data()``'s fallback can't recover query-level
    filters/url_params and templated datasets render empty, diverging the cache
    key from the submit-time task_key."""
    from superset.tasks.async_queries import execute_chart_query

    query_context = mocker.MagicMock()
    query_context.datasource.id = 5
    query_context.datasource.type = "table"
    query_context.queries = [mocker.MagicMock()]
    query_context.get_df_payload_result.return_value.payload = {}
    mocker.patch(
        "superset.tasks.async_queries._resolve_user", return_value=mocker.MagicMock()
    )
    mocker.patch("superset.tasks.async_queries.override_user")
    manager = mocker.MagicMock()
    manager.attach_mock(
        mocker.patch(
            "superset.tasks.async_queries.load_serialized_query",
            return_value=query_context,
        ),
        "load",
    )
    manager.attach_mock(
        mocker.patch("superset.charts.data.form_data.set_query_context_form_data"),
        "set_fd",
    )
    mocker.patch(
        "superset.tasks.async_queries.get_context", return_value=mocker.MagicMock()
    )

    execute_chart_query.func(_serialized_query(), user_id=7)

    # The context is rebuilt first, then the body-shaped form data is set from it
    # (using the canonical helper, not the flat top-level ``form_data``).
    assert [call[0] for call in manager.mock_calls[:2]] == ["load", "set_fd"]
    manager.set_fd.assert_called_once_with(query_context, 5, "table")


def test_execute_chart_query_form_data_has_body_shape(
    mocker: MockerFixture,
) -> None:
    """End-to-end of the worker's form-data reconstruction: the resulting
    ``g.form_data`` is body-shaped and carries query-level fields (filters,
    url_params) that the Jinja fallback reads from ``form_data['queries'][0]``."""
    from flask import g

    from superset.tasks.async_queries import execute_chart_query

    query = mocker.MagicMock()
    query.to_dict.return_value = {"metrics": ["count"], "columns": ["name"]}
    query.filter = [{"col": "region", "op": "==", "val": "EMEA"}]
    query.time_range = "No filter"

    query_context = mocker.MagicMock()
    query_context.datasource.id = 5
    query_context.datasource.type = "table"
    query_context.form_data = {"url_params": {"region": "EMEA"}, "slice_id": 9}
    query_context.queries = [query]
    query_context.get_df_payload_result.return_value.payload = {}
    mocker.patch(
        "superset.tasks.async_queries._resolve_user", return_value=mocker.MagicMock()
    )
    mocker.patch("superset.tasks.async_queries.override_user")
    mocker.patch(
        "superset.tasks.async_queries.load_serialized_query",
        return_value=query_context,
    )
    mocker.patch(
        "superset.tasks.async_queries.get_context", return_value=mocker.MagicMock()
    )

    # set_query_context_form_data is NOT mocked here — assert the real body shape.
    execute_chart_query.func(_serialized_query(), user_id=7)

    assert g.form_data["datasource"] == {"id": 5, "type": "table"}
    assert len(g.form_data["queries"]) == 1
    assert g.form_data["queries"][0]["url_params"] == {"region": "EMEA"}
    assert g.form_data["queries"][0]["filters"] == query.filter


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
        payload={"cache_key": "main-cache-key"}, immediate=True
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


def _make_task(properties: "TaskProperties | None" = None):
    """A real ``Task`` seeded with ``properties`` (no DB — property JSON only)."""
    from superset.models.tasks import Task
    from superset.tasks.utils import serialize_properties

    task = Task()
    task.properties = serialize_properties(properties or {})
    return task


def _consumers(task) -> list[str]:
    return (
        task.properties_dict.get("private", {})
        .get("subscription", {})
        .get("consumers", [])
    )


def test_chart_query_task_registers_subscription_policy() -> None:
    """The chart-data task type wires its per-tab consumer policy at import."""
    from superset.tasks.async_queries import (
        CHART_QUERY_TASK,
        ChartQueryConsumerPolicy,
    )
    from superset.tasks.registry import TaskRegistry

    policy = TaskRegistry.get_subscription_policy(CHART_QUERY_TASK)
    assert isinstance(policy, ChartQueryConsumerPolicy)


def test_consumer_policy_on_subscribe_adds_dedups_and_preserves_framework() -> None:
    from superset.tasks.async_queries import ChartQueryConsumerPolicy

    policy = ChartQueryConsumerPolicy()
    # Seed a framework-owned key to prove the task-namespace write leaves it intact.
    task = _make_task({"private": {"framework": {"celery_task_id": "c1"}}})

    policy.on_subscribe(task, principal="user:5", client_ref="A")
    policy.on_subscribe(task, principal="user:5", client_ref="B")
    policy.on_subscribe(task, principal="user:5", client_ref="A")  # idempotent

    assert _consumers(task) == ["user:5:A", "user:5:B"]
    assert task.properties_dict["private"]["framework"]["celery_task_id"] == "c1"


def test_consumer_policy_detach_then_last_tab_aborts() -> None:
    from superset.tasks.async_queries import ChartQueryConsumerPolicy

    policy = ChartQueryConsumerPolicy()
    task = _make_task()
    policy.on_subscribe(task, principal="user:5", client_ref="A")
    policy.on_subscribe(task, principal="user:5", client_ref="B")

    # First tab leaving -> principal still has another tab -> keep task alive.
    assert policy.on_unsubscribe(task, principal="user:5", client_ref="A") is False
    assert _consumers(task) == ["user:5:B"]

    # Last tab leaving -> principal is done -> proceed to unsubscribe/abort.
    assert policy.on_unsubscribe(task, principal="user:5", client_ref="B") is True
    assert _consumers(task) == []


def test_consumer_policy_scopes_by_principal() -> None:
    from superset.tasks.async_queries import ChartQueryConsumerPolicy

    policy = ChartQueryConsumerPolicy()
    task = _make_task()
    policy.on_subscribe(task, principal="user:5", client_ref="A")
    policy.on_subscribe(task, principal="user:7", client_ref="B")

    # user 5's only tab leaving proceeds (its last tab), but user 7's entry stays.
    assert policy.on_unsubscribe(task, principal="user:5", client_ref="A") is True
    assert _consumers(task) == ["user:7:B"]


def test_consumer_policy_without_client_ref_is_principal_grain() -> None:
    from superset.tasks.async_queries import ChartQueryConsumerPolicy

    policy = ChartQueryConsumerPolicy()
    task = _make_task()
    # No tab id: record nothing and proceed like a plain principal-grain cancel.
    policy.on_subscribe(task, principal="user:5", client_ref=None)
    assert _consumers(task) == []
    assert policy.on_unsubscribe(task, principal="user:5", client_ref=None) is True


def test_consumer_policy_no_client_ref_clears_that_principals_tab_entries() -> None:
    """A principal-grain unsubscribe drops all of that principal's tab entries so
    later status events aren't routed to a principal that has left, while other
    principals' entries are preserved."""
    from superset.tasks.async_queries import ChartQueryConsumerPolicy

    policy = ChartQueryConsumerPolicy()
    task = _make_task()
    policy.on_subscribe(task, principal="user:5", client_ref="A")
    policy.on_subscribe(task, principal="user:5", client_ref="B")
    policy.on_subscribe(task, principal="user:7", client_ref="C")

    assert policy.on_unsubscribe(task, principal="user:5", client_ref=None) is True
    assert _consumers(task) == ["user:7:C"]


def test_consumer_policy_routing_channels_are_the_consumers() -> None:
    """Per-tab realtime routing keys are exactly the recorded consumer entries;
    empty -> None so fanout falls back to principal-grain."""
    from superset.tasks.async_queries import ChartQueryConsumerPolicy

    policy = ChartQueryConsumerPolicy()
    task = _make_task()
    assert policy.routing_channels(task) is None  # no consumers yet

    policy.on_subscribe(task, principal="user:5", client_ref="A")
    policy.on_subscribe(task, principal="user:7", client_ref="B")
    assert policy.routing_channels(task) == ["user:5:A", "user:7:B"]
