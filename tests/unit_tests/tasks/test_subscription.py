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
"""Unit tests for the reusable per-tab task subscription policy."""

from typing import Any, Iterator
from unittest.mock import patch

import pytest

from superset.tasks.subscription import PerTabConsumerPolicy


class _FakeTask:
    """A minimal stand-in exposing ``properties_dict`` for the policy to read."""

    def __init__(self, consumers: list[str] | None = None) -> None:
        self.properties_dict: dict[str, Any] = {
            "private": {"subscription": {"consumers": list(consumers or [])}}
        }


@pytest.fixture
def policy() -> Iterator[PerTabConsumerPolicy]:
    """A policy whose ``merge_subscription_state`` write mutates the fake in place."""

    def _merge(task: _FakeTask, updates: dict[str, Any]) -> None:
        task.properties_dict["private"]["subscription"]["consumers"] = updates[
            "consumers"
        ]

    with patch(
        "superset.daos.tasks.TaskDAO.merge_subscription_state", side_effect=_merge
    ):
        yield PerTabConsumerPolicy()


def test_on_subscribe_records_tab(policy: PerTabConsumerPolicy) -> None:
    task = _FakeTask()
    policy.on_subscribe(task, principal="user:1", client_ref="tabA")
    assert policy.routing_channels(task) == ["user:1:tabA"]


def test_on_subscribe_is_idempotent(policy: PerTabConsumerPolicy) -> None:
    task = _FakeTask(["user:1:tabA"])
    policy.on_subscribe(task, principal="user:1", client_ref="tabA")
    assert policy.routing_channels(task) == ["user:1:tabA"]


def test_on_subscribe_without_tab_is_noop(policy: PerTabConsumerPolicy) -> None:
    task = _FakeTask()
    policy.on_subscribe(task, principal="user:1", client_ref=None)
    assert policy.routing_channels(task) is None


def test_on_unsubscribe_keeps_task_while_a_tab_remains(
    policy: PerTabConsumerPolicy,
) -> None:
    task = _FakeTask(["user:1:tabA", "user:1:tabB"])
    # tabA leaves but tabB is still watching → do not unsubscribe the principal.
    assert policy.on_unsubscribe(task, principal="user:1", client_ref="tabA") is False
    assert policy.routing_channels(task) == ["user:1:tabB"]


def test_on_unsubscribe_last_tab_unsubscribes_principal(
    policy: PerTabConsumerPolicy,
) -> None:
    task = _FakeTask(["user:1:tabA"])
    assert policy.on_unsubscribe(task, principal="user:1", client_ref="tabA") is True
    assert policy.routing_channels(task) is None


def test_on_unsubscribe_without_tab_drops_all_principal_entries(
    policy: PerTabConsumerPolicy,
) -> None:
    task = _FakeTask(["user:1:tabA", "user:1:tabB", "user:2:tabC"])
    # Principal-grain unsubscribe drops every tab of user:1 but leaves user:2.
    assert policy.on_unsubscribe(task, principal="user:1", client_ref=None) is True
    assert policy.routing_channels(task) == ["user:2:tabC"]
