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

import pytest
from pytest_mock import MockerFixture

from superset.coordination.base import _SIGNAL_STREAM_MAXLEN, CoordinationService
from superset.coordination.exceptions import CoordinationBackendUnavailableError
from superset.coordination.types import SignalListener


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


def test_get_backend_none_when_distributed_coordination_unset(
    app_context: None, mocker: MockerFixture
) -> None:
    _patch_distributed_coordination(mocker, None)

    assert CoordinationService.get_backend() is None
    assert CoordinationService.is_backend_defined() is False


def test_backend_only_ops_raise_when_backend_unavailable(
    app_context: None, mocker: MockerFixture
) -> None:
    _patch_distributed_coordination(mocker, None)

    for op in (
        lambda: CoordinationService.publish("channel", "msg"),
        lambda: CoordinationService.notify("channel", "msg"),
        lambda: CoordinationService.get_value("key"),
        lambda: CoordinationService.set_value("key", "value"),
        lambda: CoordinationService.delete_value("key"),
        lambda: CoordinationService.stream_add("stream", {"data": "x"}),
        lambda: CoordinationService.stream_range("stream"),
    ):
        with pytest.raises(CoordinationBackendUnavailableError):
            op()


def test_ops_use_explicit_backend_without_resolving_coordinator(
    app_context: None, mocker: MockerFixture
) -> None:
    # An explicit backend (e.g. GAQ's own) is used directly; the shared coordinator
    # is never consulted.
    get_backend = mocker.patch.object(
        CoordinationService, "get_backend", side_effect=AssertionError("resolved")
    )
    backend = mocker.MagicMock(name="explicit_backend")
    backend.xadd.return_value = "1-0"

    assert (
        CoordinationService.stream_add("stream", {"data": "x"}, backend=backend)
        == "1-0"
    )
    backend.xadd.assert_called_once_with("stream", {"data": "x"}, "*", None)
    get_backend.assert_not_called()


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


def test_kv_ops_accept_a_callable_key(app_context: None, mocker: MockerFixture) -> None:
    """A key may be a ``() -> str`` generator, resolved at call time."""
    backend = mocker.MagicMock(name="coordination_backend")
    backend.get.return_value = b"v"
    backend.set.return_value = True
    backend.delete.return_value = 2
    _patch_distributed_coordination(mocker, backend)

    calls = {"n": 0}

    def key_gen() -> str:
        calls["n"] += 1
        return "generated-key"

    CoordinationService.get_value(key_gen)
    CoordinationService.set_value(key_gen, "v")
    # A mix of literal and callable keys resolves each independently.
    CoordinationService.delete_value("literal-key", key_gen)

    backend.get.assert_called_once_with("generated-key")
    backend.set.assert_called_once_with(
        "generated-key", "v", ex=None, nx=False, xx=False
    )
    backend.delete.assert_called_once_with("literal-key", "generated-key")
    # The generator was invoked once per op (resolved lazily, not cached).
    assert calls["n"] == 3


def test_kv_key_generator_returning_non_string_raises(
    app_context: None, mocker: MockerFixture
) -> None:
    backend = mocker.MagicMock(name="coordination_backend")
    _patch_distributed_coordination(mocker, backend)

    with pytest.raises(TypeError):
        CoordinationService.get_value(lambda: 123)  # type: ignore[arg-type, return-value]
    backend.get.assert_not_called()


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


def test_notify_appends_to_stream_with_ttl(
    app_context: None, mocker: MockerFixture
) -> None:
    backend = mocker.MagicMock(name="backend")
    _patch_distributed_coordination(mocker, backend)

    CoordinationService.notify("ch", "done", ttl=60)

    backend.xadd.assert_called_once_with(
        "ch", {"m": "done"}, "*", _SIGNAL_STREAM_MAXLEN
    )
    backend.expire.assert_called_once_with("ch", 60)


def test_notify_uses_config_ttl_by_default(
    app_context: None, mocker: MockerFixture
) -> None:
    backend = mocker.MagicMock(name="backend")
    _patch_distributed_coordination(mocker, backend)
    mocker.patch.dict(
        "flask.current_app.config", {"DISTRIBUTED_COORDINATION_SIGNAL_TTL": 123}
    )

    CoordinationService.notify("ch")

    backend.expire.assert_called_once_with("ch", 123)


def test_wait_for_signal_wakes_via_stream(
    app_context: None, mocker: MockerFixture
) -> None:
    backend = mocker.MagicMock(name="backend")
    backend.stream_last_id.return_value = "0-0"
    # A blocking xread returns a new entry, waking the predicate re-check.
    backend.xread.return_value = [["ch", [("1-0", {"m": "done"})]]]
    mocker.patch.object(CoordinationService, "get_backend", return_value=backend)
    # fast-path None, post-baseline re-check None, then "done" after the stream read.
    results = iter([None, None, "done"])

    result = CoordinationService.wait_for_signal(
        "ch", lambda: next(results), timeout=5.0
    )
    assert result == "done"
    backend.stream_last_id.assert_called_once_with("ch")
    backend.xread.assert_called_once()


def test_wait_for_signal_stream_socket_timeout_is_retried(
    app_context: None, mocker: MockerFixture
) -> None:
    from redis.exceptions import TimeoutError as RedisTimeoutError

    backend = mocker.MagicMock(name="backend")
    backend.stream_last_id.return_value = "0-0"
    # A socket timeout mid-block is treated as "nothing yet": the loop re-checks and
    # reads again rather than erroring.
    backend.xread.side_effect = [RedisTimeoutError("blocked"), [["ch", [("1-0", {})]]]]
    mocker.patch.object(CoordinationService, "get_backend", return_value=backend)
    results = iter([None, None, None, "done"])

    result = CoordinationService.wait_for_signal(
        "ch", lambda: next(results), timeout=5.0
    )
    assert result == "done"
    assert backend.xread.call_count == 2


def test_wait_for_signal_stream_connection_error_degrades_not_dies(
    app_context: None, mocker: MockerFixture
) -> None:
    """A transient backend error (connection drop/failover) must not propagate out
    of the blocking read; the waiter degrades to re-checking the DB predicate."""
    from redis.exceptions import ConnectionError as RedisConnectionError

    backend = mocker.MagicMock(name="backend")
    backend.stream_last_id.return_value = "0-0"
    # First read raises a connection error (not a socket timeout); the loop must
    # swallow it, back off, and re-check rather than crashing.
    backend.xread.side_effect = [
        RedisConnectionError("connection lost"),
        [["ch", [("1-0", {})]]],
    ]
    mocker.patch.object(CoordinationService, "get_backend", return_value=backend)
    sleep = mocker.patch("superset.coordination.base.time.sleep")
    results = iter([None, None, None, "done"])

    result = CoordinationService.wait_for_signal(
        "ch", lambda: next(results), timeout=5.0
    )
    assert result == "done"
    assert backend.xread.call_count == 2
    sleep.assert_called()  # backed off on the connection error rather than spinning


def test_wait_for_signal_already_satisfied_skips_backend(
    app_context: None, mocker: MockerFixture
) -> None:
    # An already-satisfied predicate returns straight from the source of truth,
    # without resolving or subscribing to a backend — so an already-terminal task
    # does not require Redis to be reachable.
    backend = mocker.MagicMock(name="backend")
    get_backend = mocker.patch.object(
        CoordinationService, "get_backend", return_value=backend
    )

    assert CoordinationService.wait_for_signal("ch", lambda: "done") == "done"
    get_backend.assert_not_called()
    backend.pubsub.assert_not_called()


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


def test_listen_fires_via_stream(app_context: None, mocker: MockerFixture) -> None:
    backend = mocker.MagicMock(name="backend")
    backend.stream_last_id.return_value = "0-0"
    backend.xread.return_value = [["ch", [("1-0", {"m": "abort"})]]]
    mocker.patch.object(CoordinationService, "get_backend", return_value=backend)
    fired = threading.Event()
    # First check is False (so the loop reads the stream), then True after the signal.
    checks = iter([False, True])

    listener = CoordinationService.listen_for_signal(
        "ch", check=lambda: next(checks), on_signal=fired.set, poll_interval=0.01
    )
    assert fired.wait(timeout=2.0) is True
    listener.stop()
    backend.stream_last_id.assert_called_once_with("ch")
    backend.xread.assert_called()


def test_baseline_stream_id_degrades_on_backend_error(
    app_context: None, mocker: MockerFixture
) -> None:
    """A transient error capturing the baseline must not propagate (it would kill a
    listener thread or abort a lock acquisition); it degrades to reading from 0-0."""
    from redis.exceptions import ConnectionError as RedisConnectionError

    backend = mocker.MagicMock(name="backend")
    backend.stream_last_id.side_effect = RedisConnectionError("down")
    assert CoordinationService._baseline_stream_id(backend, "ch") == "0-0"


def test_listen_survives_transient_check_error(
    app_context: None, mocker: MockerFixture
) -> None:
    """A transient predicate error must not permanently kill the one-shot listener
    (that would drop the awaited cancel/abort signal); it retries and still fires."""
    mocker.patch.object(CoordinationService, "get_backend", return_value=None)
    # First check raises (metastore blip), then it recovers and reports satisfied.
    calls = iter([RuntimeError("db blip")])

    def check() -> bool:
        for exc in calls:
            raise exc
        return True

    fired = threading.Event()
    listener = CoordinationService.listen_for_signal(
        "ch", check=check, on_signal=fired.set, poll_interval=0.01, name="t"
    )
    assert fired.wait(timeout=2.0) is True
    listener.stop()


def test_signal_listener_stop_signals_and_joins(mocker: MockerFixture) -> None:
    thread = mocker.MagicMock(name="thread")
    thread.is_alive.side_effect = [True, False]
    stop_event = threading.Event()

    SignalListener(thread, stop_event).stop()

    assert stop_event.is_set()
    thread.join.assert_called_once_with(timeout=2.0)


def test_signal_listener_stop_wakes_before_join(mocker: MockerFixture) -> None:
    """stop() fires the wake nudge (so a blocked read returns) and still joins.

    The nudge runs on a daemon thread so a degraded backend can't make stop()
    block past the bounded join, so wait briefly for it to be invoked.
    """
    thread = mocker.MagicMock(name="thread")
    thread.is_alive.side_effect = [True, False]
    stop_event = threading.Event()
    woken = threading.Event()
    wake = mocker.MagicMock(name="wake", side_effect=lambda: woken.set())

    SignalListener(thread, stop_event, wake=wake).stop()

    assert stop_event.is_set()
    assert woken.wait(timeout=2.0)  # wake was invoked (off-thread)
    thread.join.assert_called_once_with(timeout=2.0)


def test_signal_listener_stop_bounded_when_wake_hangs(mocker: MockerFixture) -> None:
    """A wake that blocks (degraded backend) must not stall stop(): the nudge is
    off-thread, so stop() still returns via the bounded join."""
    thread = mocker.MagicMock(name="thread")
    thread.is_alive.side_effect = [True, False]
    stop_event = threading.Event()
    release = threading.Event()
    # A wake that never returns until released — simulates a hung Redis write.
    wake = mocker.MagicMock(name="wake", side_effect=lambda: release.wait(timeout=5.0))

    SignalListener(thread, stop_event, wake=wake).stop()

    # stop() returned despite the still-blocked wake.
    thread.join.assert_called_once_with(timeout=2.0)
    release.set()  # let the daemon wake thread unwind


def test_listen_stop_wakes_blocked_backend_read(
    app_context: None, mocker: MockerFixture
) -> None:
    """A listener parked in a blocking XREAD terminates promptly on stop() because
    the wake nudge (a stream write) makes the read return."""
    backend = mocker.MagicMock(name="backend")
    backend.stream_last_id.return_value = "0-0"
    entered = threading.Event()
    woken = threading.Event()

    def blocking_xread(*_args: object, **_kwargs: object) -> list[object]:
        # Park like a real blocking XREAD until the wake write lands.
        entered.set()
        woken.wait(timeout=2.0)
        return []

    backend.xread.side_effect = blocking_xread
    # notify() -> backend.xadd is the wake nudge; unblock the read when it fires.
    backend.xadd.side_effect = lambda *a, **k: woken.set()
    mocker.patch.object(CoordinationService, "get_backend", return_value=backend)

    listener = CoordinationService.listen_for_signal(
        "ch", check=lambda: False, on_signal=mocker.MagicMock(), poll_interval=0.01
    )
    assert entered.wait(timeout=2.0)  # listener is parked in the blocking read

    listener.stop()

    assert woken.is_set()  # the wake nudge was actually issued
    assert not listener._thread.is_alive()  # and it made the listener terminate

    # The wake nudge is a stream write (via notify) carrying the wake marker.
    assert any(
        call.args[:2] == ("ch", {"m": "__wake__"})
        for call in backend.xadd.call_args_list
    )
