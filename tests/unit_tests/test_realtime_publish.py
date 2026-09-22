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

"""Tests for the neutral realtime publisher."""

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, Event
from unittest.mock import Mock, patch

import pytest
from flask import Flask

from superset.realtime.publish import get_realtime_channel, publish_realtime
from superset.utils import json


def test_channel_resolves_callable_once() -> None:
    """A callable prefix is stable and shared by subsequent publishers."""
    app = Flask(__name__)
    prefix = Mock(side_effect=["tenant:", "wrong:"])
    app.config["REALTIME_CHANNEL_PREFIX"] = prefix
    with app.app_context():
        assert get_realtime_channel(app) == "tenant:realtime"
        assert get_realtime_channel() == "tenant:realtime"
    prefix.assert_called_once_with()


@pytest.mark.parametrize("routes", [None, ["user:7"]])
def test_publish_envelope(routes: list[str] | None) -> None:
    """Preserve broadcast omission and targeted routes on the deployment channel."""
    app = Flask(__name__)
    app.config["REALTIME_CHANNEL_PREFIX"] = "tenant:"
    with (
        app.app_context(),
        patch(
            "superset.coordination.base.CoordinationService.is_backend_defined",
            return_value=True,
        ),
        patch("superset.coordination.base.CoordinationService.publish") as publish,
    ):
        assert publish_realtime("test.topic", "principal", {"id": 1}, routes)
    channel, message = publish.call_args.args
    assert channel == "tenant:realtime"
    envelope = json.loads(message)
    assert envelope == {
        "topic": "test.topic",
        "scope": "principal",
        "payload": {"id": 1},
        **({"routes": routes} if routes is not None else {}),
    }


def test_no_backend_needs_no_app_context() -> None:
    """Unconfigured deployments do not resolve channels or contact the backend."""
    with (
        patch(
            "superset.coordination.base.CoordinationService.is_backend_defined",
            return_value=False,
        ),
        patch("superset.coordination.base.CoordinationService.publish") as publish,
    ):
        assert publish_realtime("test.topic", "principal", {}) is False
    publish.assert_not_called()


def test_task_manager_shares_resolved_channel() -> None:
    """Task and non-task publishers resolve a callable prefix only once."""
    from superset.tasks.manager import TaskManager

    app = Flask(__name__)
    prefix = Mock(side_effect=["shared:", "wrong:"])
    app.config["REALTIME_CHANNEL_PREFIX"] = prefix
    with (
        app.app_context(),
        patch.object(TaskManager, "_initialized", False),
        patch.object(TaskManager, "_realtime_channel_prefix", ""),
        patch.object(TaskManager, "_channel_prefix", "gtf:abort:"),
        patch.object(TaskManager, "_completion_channel_prefix", "gtf:complete:"),
    ):
        TaskManager.init_app(app)
        assert TaskManager.get_realtime_channel() == get_realtime_channel()
        assert get_realtime_channel() == "shared:realtime"
    prefix.assert_called_once_with()


def test_channel_resolves_callable_once_under_concurrency() -> None:
    """Concurrent cache misses must publish on the same resolved channel."""
    app = Flask(__name__)
    initial_reads = Barrier(2)
    prefix_entered = Event()

    class ConcurrentExtensions(dict[str, object]):
        """Synchronize both initial cache misses before either can populate it."""

        def get(self, key: str, default: object = None) -> object:
            """Allow later reads through after both initial misses have arrived."""
            value = super().get(key, default)
            if key == "realtime_channel" and not prefix_entered.is_set():
                initial_reads.wait(timeout=5)
                prefix_entered.set()
            return value

    app.extensions = ConcurrentExtensions()
    prefix = Mock(side_effect=["shared:", "wrong:"])
    app.config["REALTIME_CHANNEL_PREFIX"] = prefix
    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(get_realtime_channel, [app, app]))
    assert results == ["shared:realtime", "shared:realtime"]
    assert get_realtime_channel(app) == "shared:realtime"
    prefix.assert_called_once_with()
