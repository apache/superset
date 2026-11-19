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
"""Report transport retries must be bounded and must not disclose request data."""

import errno
import io
import socket
from email.message import Message
from http.client import IncompleteRead
from unittest.mock import Mock
from urllib.error import HTTPError, URLError

import pytest
from pytest_mock import MockerFixture

from superset.commands.report.chart_data import (
    ChartDataRequestError,
    request_chart_data,
)
from superset.utils import json
from superset.utils.report_execution import (
    ReportExecutionBudgetExceededError,
    ReportExecutionDeadline,
)


@pytest.fixture
def clock(mocker: MockerFixture) -> list[float]:
    """Advance a deterministic monotonic clock when the retry sleeps."""
    now = [0.0]
    mocker.patch(
        "superset.commands.report.chart_data.time.monotonic", side_effect=lambda: now[0]
    )
    mocker.patch(
        "superset.commands.report.chart_data.time.sleep",
        side_effect=lambda delay: now.__setitem__(0, now[0] + delay),
    )
    return now


def request(
    fetch: Mock, timeout: float | None = 10, retry: bool = True
) -> bytes | None:
    """Invoke the helper using only safe, static diagnostic context."""
    return request_chart_data(
        fetch,
        lambda: timeout,
        retry=retry,
        endpoint="/api/v1/chart/data",
        log_context="report_schedule_id=1 chart_id=2",
    )


def http_error(
    status: int, body: bytes = b"", retry_after: str | None = None
) -> HTTPError:
    """Build an error with sensitive URL, reason and headers that must not leak."""
    headers = Message()
    headers["Set-Cookie"] = "session=HEADER_SECRET"
    if retry_after is not None:
        headers["Retry-After"] = retry_after
    return HTTPError(
        "https://user:URL_SECRET@localhost/path?form_data=QUERY_SECRET",
        status,
        "REASON_SECRET",
        headers,
        io.BytesIO(body),
    )


@pytest.mark.parametrize("status", [400, 401, 403, 404, 422, 501, 505])
def test_http_deterministic_error_is_sanitized(
    status: int,
    clock: list[float],
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Preserve known error types but no arbitrary messages, extras or credentials."""
    body = json.dumps(
        {
            "errors": [
                {
                    "error_type": "INVALID_PAYLOAD_SCHEMA_ERROR",
                    "message": "MESSAGE_SECRET",
                    "extra": {"sql": "PAYLOAD_SECRET"},
                },
                {"error_type": "TYPE_SECRET", "message": "SECOND_SECRET"},
            ],
            "token": "TOKEN_SECRET",
        }
    ).encode()
    error = http_error(status, body)
    fetch = Mock(side_effect=error)
    with pytest.raises(
        ChartDataRequestError, match=f"category=http status={status}"
    ) as exc:
        request(fetch)
    fetch.assert_called_once_with(10)
    assert clock == [0]
    assert error.closed
    output = caplog.text + str(exc.value)
    assert "SECRET" not in output
    assert "INVALID_PAYLOAD_SCHEMA_ERROR" in output
    assert "[redacted]" in output
    assert "report_schedule_id=1 chart_id=2" in output
    assert "endpoint=/api/v1/chart/data" in output
    assert "attempt=1" in output
    assert "elapsed_seconds=0.00" in output
    assert len(caplog.messages[0]) < 1024
    assert exc.value.__cause__ is None


@pytest.mark.parametrize(
    "body",
    [b"x" * 10000, b"<html>BODY_SECRET</html>", b'{"message":"BODY_SECRET"}', b"\xff"],
)
def test_error_body_is_bounded(
    body: bytes,
    clock: list[float],
    caplog: pytest.LogCaptureFixture,
    mocker: MockerFixture,
) -> None:
    """Read at most the fixed limit plus one sentinel byte and log no raw text."""
    error = http_error(400, body)
    read = mocker.patch.object(error, "read", wraps=error.read)
    with pytest.raises(ChartDataRequestError):
        request(Mock(side_effect=error))
    read.assert_called_once_with(4097)
    assert "SECRET" not in caplog.text
    assert len(caplog.messages[0]) < 1024


@pytest.mark.parametrize("status", [429, 500, 502, 503, 504])
def test_retryable_http_success(status: int, clock: list[float]) -> None:
    """Transient HTTP responses may retry once using the remaining timeout."""
    fetch = Mock(side_effect=[http_error(status), b"csv"])
    assert request(fetch) == b"csv"
    assert [call.args[0] for call in fetch.call_args_list] == [10, 9.5]
    assert clock == [0.5]


@pytest.mark.parametrize(
    "error",
    [
        IncompleteRead(b"PAYLOAD_SECRET"),
        socket.timeout("TIMEOUT_SECRET"),
        URLError(TimeoutError("TIMEOUT_SECRET")),
        URLError(ConnectionRefusedError(errno.ECONNREFUSED, "NETWORK_SECRET")),
        ConnectionResetError(errno.ECONNRESET, "NETWORK_SECRET"),
        URLError(socket.gaierror(socket.EAI_AGAIN, "DNS_SECRET")),
    ],
)
def test_transient_network_retry(
    error: Exception, clock: list[float], caplog: pytest.LogCaptureFixture
) -> None:
    """Direct read errors and wrapped connection errors share the bounded retry."""
    fetch = Mock(side_effect=[error, b"csv"])
    assert request(fetch) == b"csv"
    assert fetch.call_count == 2
    assert "SECRET" not in caplog.text


@pytest.mark.parametrize(
    "error,category",
    [(TimeoutError("TIMEOUT_SECRET"), "timeout"), (http_error(503), "http")],
)
def test_retry_exhaustion(error: OSError, category: str, clock: list[float]) -> None:
    """An opt-in retry never becomes an unbounded loop."""
    # Each HTTP failure needs its own response stream.
    fetch = Mock(side_effect=[error, http_error(503) if category == "http" else error])
    with pytest.raises(ChartDataRequestError, match=f"category={category}"):
        request(fetch)
    assert fetch.call_count == 2
    assert clock == [0.5]


@pytest.mark.parametrize("timeout,retry", [(10, False), (None, True), (0.5, True)])
def test_retry_disabled_or_no_budget(
    timeout: float | None, retry: bool, clock: list[float]
) -> None:
    """Defaults, unbounded requests and insufficient budgets do not retry."""
    fetch = Mock(side_effect=TimeoutError())
    with pytest.raises(ChartDataRequestError, match="category=timeout"):
        request(fetch, timeout, retry)
    fetch.assert_called_once()
    assert clock == [0]


def test_read_timeout_consumes_original_budget(clock: list[float]) -> None:
    """A full-length read timeout does not get another full request budget."""

    def fail(timeout: float | None) -> bytes:
        """Simulate a request using all its allowed time."""
        clock[0] += 10
        raise TimeoutError()

    fetch = Mock(side_effect=fail)
    with pytest.raises(ChartDataRequestError, match="category=timeout"):
        request(fetch)
    fetch.assert_called_once()
    assert clock == [10]


def test_report_deadline_prevents_retry(clock: list[float]) -> None:
    """Respect the execution deadline and preserve its phase reserves."""
    deadline = ReportExecutionDeadline(
        total_seconds=10, started_at=0, _clock=lambda: clock[0]
    )

    def fail(timeout: float | None) -> bytes:
        """Consume the work allowance without consuming the cleanup reserve."""
        clock[0] = 8
        raise TimeoutError()

    fetch = Mock(side_effect=fail)
    with pytest.raises(ReportExecutionBudgetExceededError):
        request_chart_data(
            fetch,
            lambda: deadline.timeout_seconds(
                "data_generation", requested_seconds=60, reserve_seconds=2
            ),
            retry=True,
            endpoint="/api/v1/chart/data",
            log_context="chart_id=2",
        )
    fetch.assert_called_once_with(8)
    assert clock == [8]


@pytest.mark.parametrize(
    "retry_after, calls",
    [("2", 2), ("20", 1), ("Wed, 01 Jan 2030 00:00:00 GMT", 1), ("nan", 1)],
)
def test_retry_after(retry_after: str, calls: int, clock: list[float]) -> None:
    """Never retry earlier than Retry-After or sleep beyond the budget."""
    fetch = Mock(side_effect=[http_error(429, retry_after=retry_after), b"csv"])
    if calls == 1:
        with pytest.raises(ChartDataRequestError):
            request(fetch)
        assert clock == [0]
    else:
        assert request(fetch) == b"csv"
        assert clock == [2]
    assert fetch.call_count == calls


def test_non_transient_url_error(
    clock: list[float], caplog: pytest.LogCaptureFixture
) -> None:
    """String reasons, including TLS errors, must not be blindly retried or logged."""
    fetch = Mock(side_effect=URLError("URL_SECRET"))
    with pytest.raises(ChartDataRequestError, match="category=network"):
        request(fetch)
    fetch.assert_called_once()
    assert "SECRET" not in caplog.text


@pytest.mark.parametrize("read_error", [TimeoutError(), IncompleteRead(b"BODY_SECRET")])
def test_http_error_body_read_failure(
    read_error: Exception,
    clock: list[float],
    caplog: pytest.LogCaptureFixture,
    mocker: MockerFixture,
) -> None:
    """An unreadable diagnostic body must not replace the original HTTP failure."""
    error = http_error(400)
    mocker.patch.object(error, "read", side_effect=read_error)
    with pytest.raises(ChartDataRequestError, match="category=http status=400"):
        request(Mock(side_effect=error))
    assert error.closed
    assert "SECRET" not in caplog.text


def test_deadline_is_rechecked_after_backoff(
    clock: list[float], mocker: MockerFixture
) -> None:
    """An oversleep cannot start another request after the shared budget expires."""
    mocker.patch(
        "superset.commands.report.chart_data.time.sleep",
        side_effect=lambda _: clock.__setitem__(0, 11),
    )
    fetch = Mock(side_effect=TimeoutError())
    with pytest.raises(ChartDataRequestError, match="category=timeout"):
        request(fetch)
    fetch.assert_called_once()
