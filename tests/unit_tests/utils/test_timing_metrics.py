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
from collections.abc import Callable, Iterator
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from flask import Flask

from superset.utils.timing_metrics import (
    emit_incr,
    emit_pre_handler_timer,
    emit_timing,
    metric_suffix,
    start_pre_handler_timer,
    timed,
)


@pytest.fixture
def stats_logger() -> Iterator[MagicMock]:
    with patch("superset.utils.timing_metrics.stats_logger_manager") as manager:
        yield manager.instance


def test_timed_emits_milliseconds(stats_logger: MagicMock) -> None:
    with patch(
        "superset.utils.timing_metrics.perf_counter_ns",
        side_effect=[1_000_000, 3_500_000],
    ):
        with timed("chart_data.cache.get"):
            pass

    stats_logger.timing.assert_called_once_with("chart_data.cache.get", 2.5)


def test_timed_emits_when_block_raises(stats_logger: MagicMock) -> None:
    with pytest.raises(ValueError, match="boom"):
        with timed("database.execute.snowflake"):
            raise ValueError("boom")

    stats_logger.timing.assert_called_once()
    assert stats_logger.timing.call_args.args[0] == "database.execute.snowflake"


def test_metrics_backend_failures_are_swallowed(stats_logger: MagicMock) -> None:
    stats_logger.timing.side_effect = OSError("statsd down")
    stats_logger.incr.side_effect = OSError("statsd down")

    emit_timing("chart_data.query.total", 1.0)
    emit_incr("chart_data.cache.hit")
    with timed("chart_data.cache.set"):
        result = 42

    assert result == 42


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("snowflake", "snowflake"),
        ("google.bigquery", "google_bigquery"),
        ("", "unknown"),
        (None, "unknown"),
    ],
)
def test_metric_suffix_keeps_single_key_segment(
    value: str | None, expected: str
) -> None:
    assert metric_suffix(value) == expected


def test_pre_handler_timer_spans_wrapped_decorators(stats_logger: MagicMock) -> None:
    """The timer covers whatever sits between the two markers (e.g. @protect)."""

    def handler() -> str:
        return "ok"

    def fake_protect(func: Callable[..., Any]) -> Callable[..., Any]:
        return func

    route = start_pre_handler_timer(
        fake_protect(emit_pre_handler_timer("chart_data.auth")(handler))
    )

    app = Flask(__name__)
    with (
        app.test_request_context(),
        patch(
            "superset.utils.timing_metrics.perf_counter_ns",
            side_effect=[1_000_000, 5_000_000],
        ),
    ):
        assert route() == "ok"

    stats_logger.timing.assert_called_once_with("chart_data.auth", 4.0)
    assert route.__name__ == "handler"


def test_pre_handler_timer_skips_requests_never_started(
    stats_logger: MagicMock,
) -> None:
    handler = emit_pre_handler_timer("chart_data.auth")(lambda: "ok")

    app = Flask(__name__)
    with app.test_request_context():
        assert handler() == "ok"

    stats_logger.timing.assert_not_called()
