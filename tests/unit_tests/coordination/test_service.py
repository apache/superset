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
from __future__ import annotations

import threading
from collections.abc import Iterator

import pytest
from pytest_mock import MockerFixture

from superset.coordination.base import CoordinationService
from superset.coordination.exceptions import CoordinationBackendUnavailableError
from superset.coordination.types import SignalListener


@pytest.fixture(autouse=True)
def _reset_legacy_state() -> Iterator[None]:
    # The legacy backend + warning flag are class-level caches; reset around each
    # test so fallback behavior is exercised deterministically.
    CoordinationService._legacy_backend = None
    CoordinationService._legacy_warning_emitted = False
    yield
    CoordinationService._legacy_backend = None
    CoordinationService._legacy_warning_emitted = False


def _patch_distributed_coordination(mocker: MockerFixture, backend: object) -> None:
    mocker.patch(
        "superset.utils.cache_manager.CacheManager.distributed_coordination",
        new_callable=mocker.PropertyMock,
        return_value=backend,
    )


def test_get_backend_prefers_distributed_coordination(
    app_context: None, mocker: MockerFixture
) -> None:
    backend = mocker.MagicMock(name="coordination_backend")
    _patch_distributed_coordination(mocker, backend)

    assert CoordinationService.get_backend() is backend
    assert CoordinationService.is_backend_defined() is True


def test_get_backend_none_when_nothing_configured(
    app_context: None, mocker: MockerFixture
) -> None:
    _patch_distributed_coordination(mocker, None)
    mocker.patch.dict(
        "flask.current_app.config", {"GLOBAL_ASYNC_QUERIES_CACHE_BACKEND": {}}
    )

    assert CoordinationService.get_backend() is None
    assert CoordinationService.is_backend_defined() is False


def test_get_backend_falls_back_to_legacy_gaq_backend_with_warning(
    app_context: None, mocker: MockerFixture
) -> None:
    _patch_distributed_coordination(mocker, None)
    mocker.patch("superset.is_feature_enabled", return_value=True)
    mocker.patch.dict(
        "flask.current_app.config",
        {"GLOBAL_ASYNC_QUERIES_CACHE_BACKEND": {"CACHE_TYPE": "RedisCache"}},
    )
    legacy_backend = mocker.MagicMock(name="legacy_backend")
    get_cache_backend = mocker.patch(
        "superset.async_events.async_query_manager.get_cache_backend",
        return_value=legacy_backend,
    )
    warning = mocker.patch("superset.coordination.base.logger.warning")

    assert CoordinationService.get_backend() is legacy_backend
    # The legacy backend is memoized and the deprecation warning emitted once.
    assert CoordinationService.get_backend() is legacy_backend
    get_cache_backend.assert_called_once()
    warning.assert_called_once()


def test_backend_only_ops_raise_when_backend_unavailable(
    app_context: None, mocker: MockerFixture
) -> None:
    _patch_distributed_coordination(mocker, None)
    mocker.patch.dict(
        "flask.current_app.config", {"GLOBAL_ASYNC_QUERIES_CACHE_BACKEND": {}}
    )

    for op in (
        lambda: CoordinationService.publish("channel", "msg"),
        lambda: CoordinationService.get_value("key"),
        lambda: CoordinationService.set_value("key", "value"),
        lambda: CoordinationService.delete_value("key"),
        lambda: CoordinationService.stream_add("stream", {"data": "x"}),
        lambda: CoordinationService.stream_range("stream"),
    ):
        with pytest.raises(CoordinationBackendUnavailableError):
            op()


def test_ops_delegate_to_backend(app_context: None, mocker: MockerFixture) -> None:
    backend = mocker.MagicMock(name="coordination_backend")
    backend.publish.return_value = 3
    backend.get.return_value = b"v"
    backend.set.return_value = True
    backend.delete.return_value = 1
    backend.xadd.return_value = "1-0"
    backend.xrange.return_value = [("1-0", {"data": "x"})]
    _patch_distributed_coordination(mocker, backend)

    assert CoordinationService.publish("chan", "msg") == 3
    assert CoordinationService.get_value("k") == b"v"
    assert CoordinationService.set_value("k", "v", ttl=10, if_present=True) is True
    assert CoordinationService.delete_value("k") == 1
    assert CoordinationService.stream_add("stream", {"data": "x"}, "*", 100) == "1-0"
    assert CoordinationService.stream_range("stream", "-", "+", 10) == [
        ("1-0", {"data": "x"})
    ]
    backend.publish.assert_called_once_with("chan", "msg")
    # The generalized set() flags map onto the backend's Redis-native kwargs.
    backend.set.assert_called_once_with("k", "v", ex=10, nx=False, xx=True)
    backend.delete.assert_called_once_with("k")
    backend.xadd.assert_called_once_with("stream", {"data": "x"}, "*", 100)
    backend.xrange.assert_called_once_with("stream", "-", "+", 10)


# -- wait_for_signal / listen --------------------------------------------------


def test_wait_for_signal_returns_when_check_satisfied(
    app_context: None, mocker: MockerFixture
) -> None:
    mocker.patch.object(CoordinationService, "get_backend", return_value=None)
    assert CoordinationService.wait_for_signal("ch", lambda: "done") == "done"


def test_wait_for_signal_polls_until_satisfied_without_backend(
    app_context: None, mocker: MockerFixture
) -> None:
    mocker.patch.object(CoordinationService, "get_backend", return_value=None)
    results = iter([None, "done"])

    result = CoordinationService.wait_for_signal(
        "ch", lambda: next(results), poll_interval=0.01
    )
    assert result == "done"


def test_wait_for_signal_times_out(app_context: None, mocker: MockerFixture) -> None:
    mocker.patch.object(CoordinationService, "get_backend", return_value=None)
    with pytest.raises(TimeoutError):
        CoordinationService.wait_for_signal(
            "ch", lambda: None, timeout=0.05, poll_interval=0.01
        )


def test_wait_for_signal_wakes_via_pubsub_and_cleans_up(
    app_context: None, mocker: MockerFixture
) -> None:
    backend = mocker.MagicMock(name="backend")
    pubsub = mocker.MagicMock(name="pubsub")
    backend.pubsub.return_value = pubsub
    mocker.patch.object(CoordinationService, "get_backend", return_value=backend)
    results = iter([None, "done"])

    result = CoordinationService.wait_for_signal(
        "ch", lambda: next(results), timeout=5.0
    )
    assert result == "done"
    pubsub.subscribe.assert_called_once_with("ch")
    # One wake-up nudge between the first (None) and second (done) check.
    pubsub.get_message.assert_called_once()
    pubsub.unsubscribe.assert_called_once()
    pubsub.close.assert_called_once()


def test_listen_invokes_on_signal_then_stops(
    app_context: None, mocker: MockerFixture
) -> None:
    mocker.patch.object(CoordinationService, "get_backend", return_value=None)
    fired = threading.Event()

    listener = CoordinationService.listen_for_signal(
        "ch", check=lambda: True, on_signal=fired.set, poll_interval=0.01, name="t"
    )
    assert fired.wait(timeout=2.0) is True
    listener.stop()


def test_listen_does_not_fire_when_condition_never_met(
    app_context: None, mocker: MockerFixture
) -> None:
    mocker.patch.object(CoordinationService, "get_backend", return_value=None)
    on_signal = mocker.MagicMock()

    listener = CoordinationService.listen_for_signal(
        "ch", check=lambda: False, on_signal=on_signal, poll_interval=0.01
    )
    listener.stop()
    on_signal.assert_not_called()


def test_signal_listener_stop_signals_and_joins(mocker: MockerFixture) -> None:
    thread = mocker.MagicMock(name="thread")
    thread.is_alive.side_effect = [True, False]
    stop_event = threading.Event()

    SignalListener(thread, stop_event).stop()

    assert stop_event.is_set()
    thread.join.assert_called_once_with(timeout=2.0)
