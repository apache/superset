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

from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, Event
from unittest.mock import Mock, patch
from uuid import UUID

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


@pytest.fixture
def entity_changed() -> Callable[..., bool]:
    """The host's ``superset_core.realtime.publish_entity_changed``."""
    import superset_core.realtime as core_realtime

    from superset.core.api.core_api_injection import inject_realtime_implementations

    inject_realtime_implementations()
    return core_realtime.publish_entity_changed


def test_entity_changed_stub_raises_until_injected() -> None:
    """Outside a host, the extension API is a stub."""
    import importlib

    import superset_core.realtime as core_realtime

    from superset.core.api.core_api_injection import inject_realtime_implementations

    importlib.reload(core_realtime)
    try:
        with pytest.raises(NotImplementedError):
            core_realtime.publish_entity_changed("widget", 1)
    finally:
        inject_realtime_implementations()


@pytest.mark.parametrize(
    ("entity_id", "sent"),
    [
        (7, 7),
        ("a-key", "a-key"),
        (
            UUID("0b6c4a52-7e1f-4f0e-9d55-3c0f0e5b9a11"),
            "0b6c4a52-7e1f-4f0e-9d55-3c0f0e5b9a11",
        ),
    ],
)
def test_entity_changed_broadcasts_type_and_id(
    entity_changed: Callable[..., bool], entity_id: object, sent: object
) -> None:
    """An extension's nudge is the broadcast core's own entity nudges are."""
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
        assert entity_changed("widget", entity_id) is True
    channel, message = publish.call_args.args
    assert channel == "tenant:realtime"
    assert json.loads(message) == {
        "topic": "entity.changed",
        "scope": "authenticated_global",
        "payload": {"entity_type": "widget", "id": sent},
    }


def test_entity_changed_without_backend_sends_nothing(
    entity_changed: Callable[..., bool],
) -> None:
    """A deployment without a realtime backend answers False."""
    with (
        patch(
            "superset.coordination.base.CoordinationService.is_backend_defined",
            return_value=False,
        ),
        patch("superset.coordination.base.CoordinationService.publish") as publish,
    ):
        assert entity_changed("widget", 7) is False
    publish.assert_not_called()


def test_entity_changed_swallows_a_failed_send(
    entity_changed: Callable[..., bool], caplog: pytest.LogCaptureFixture
) -> None:
    """A failed send is logged and answered False, never raised."""
    app = Flask(__name__)
    with (
        app.app_context(),
        patch(
            "superset.coordination.base.CoordinationService.is_backend_defined",
            return_value=True,
        ),
        patch(
            "superset.coordination.base.CoordinationService.publish",
            side_effect=ConnectionError("redis is down"),
        ),
    ):
        assert entity_changed("widget", 7) is False
    assert "Failed to publish a change of widget 7" in caplog.text


@pytest.mark.parametrize(
    ("entity_type", "entity_id"),
    [("", 7), ("widget", ""), ("widget", True), ("widget", 1.5), ("widget", None)],
)
def test_entity_changed_refuses_what_names_no_entity(
    entity_changed: Callable[..., bool], entity_type: str, entity_id: object
) -> None:
    """A malformed type or id is the caller's bug, so it raises."""
    with (
        patch("superset.coordination.base.CoordinationService.publish") as publish,
        pytest.raises(ValueError, match="entity_"),
    ):
        entity_changed(entity_type, entity_id)
    publish.assert_not_called()
