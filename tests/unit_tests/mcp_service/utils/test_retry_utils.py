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

"""
Unit tests for MCP service retry utilities.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.exc import OperationalError

from superset.mcp_service.utils.retry_utils import (
    async_retry_database_operation,
    async_retry_on_exception,
    exponential_backoff,
    retry_database_operation,
    retry_on_exception,
    retry_screenshot_operation,
    RetryableOperation,
)

SLEEP: str = "superset.mcp_service.utils.retry_utils.time.sleep"
ASYNC_SLEEP: str = "superset.mcp_service.utils.retry_utils.asyncio.sleep"


# ---------------------------------------------------------------------------
# exponential_backoff
# ---------------------------------------------------------------------------


def test_exponential_backoff_without_jitter_doubles_each_attempt() -> None:
    """Should double the delay for each subsequent attempt when jitter is off."""
    assert exponential_backoff(0, base_delay=1.0, jitter=False) == 1.0
    assert exponential_backoff(1, base_delay=1.0, jitter=False) == 2.0
    assert exponential_backoff(2, base_delay=1.0, jitter=False) == 4.0


def test_exponential_backoff_caps_at_max_delay() -> None:
    """Should never return a delay larger than max_delay."""
    delay = exponential_backoff(10, base_delay=1.0, max_delay=5.0, jitter=False)
    assert delay == 5.0


def test_exponential_backoff_jitter_stays_within_twenty_five_percent() -> None:
    """Should keep jittered delays within +/-25% of the base delay."""
    for _ in range(50):
        delay = exponential_backoff(2, base_delay=1.0, jitter=True)
        # Unjittered delay for attempt=2, base_delay=1.0 is 4.0.
        assert 3.0 <= delay <= 5.0


def test_exponential_backoff_never_negative() -> None:
    """Should clamp the delay to be non-negative even with jitter applied."""
    for _ in range(50):
        delay = exponential_backoff(0, base_delay=0.001, jitter=True)
        assert delay >= 0


# ---------------------------------------------------------------------------
# retry_on_exception (sync)
# ---------------------------------------------------------------------------


def test_retry_on_exception_succeeds_first_try() -> None:
    """Should call the wrapped function once when it succeeds immediately."""
    mock_func = MagicMock(return_value="ok")
    wrapped = retry_on_exception(max_attempts=3)(mock_func)

    result = wrapped()

    assert result == "ok"
    assert mock_func.call_count == 1


def test_retry_on_exception_retries_then_succeeds() -> None:
    """Should retry on retryable exceptions and return the eventual success."""
    mock_func = MagicMock(
        side_effect=[ConnectionError("fail"), ConnectionError("fail"), "ok"]
    )
    mock_func.__name__ = "mock_func"

    with patch(SLEEP) as mock_sleep:
        wrapped = retry_on_exception(max_attempts=3, base_delay=0.01, jitter=False)(
            mock_func
        )
        result = wrapped()

    assert result == "ok"
    assert mock_func.call_count == 3
    assert mock_sleep.call_count == 2


def test_retry_on_exception_exhausts_retries_and_raises_last_exception() -> None:
    """Should raise the last retryable exception once max_attempts is reached."""
    mock_func = MagicMock(side_effect=ConnectionError("always fails"))
    mock_func.__name__ = "mock_func"

    with patch(SLEEP) as mock_sleep:
        wrapped = retry_on_exception(max_attempts=3, base_delay=0.01, jitter=False)(
            mock_func
        )
        with pytest.raises(ConnectionError, match="always fails"):
            wrapped()

    assert mock_func.call_count == 3
    # No sleep after the final (failed) attempt.
    assert mock_sleep.call_count == 2


def test_retry_on_exception_non_retryable_exception_fails_immediately() -> None:
    """Should not retry exceptions outside the configured retryable tuple."""
    mock_func = MagicMock(side_effect=ValueError("bad input"))
    mock_func.__name__ = "mock_func"

    with patch(SLEEP) as mock_sleep:
        wrapped = retry_on_exception(max_attempts=3, exceptions=(ConnectionError,))(
            mock_func
        )
        with pytest.raises(ValueError, match="bad input"):
            wrapped()

    assert mock_func.call_count == 1
    mock_sleep.assert_not_called()


def test_retry_on_exception_respects_custom_exceptions_tuple() -> None:
    """Should retry only on the exception types passed via `exceptions`."""
    mock_func = MagicMock(side_effect=[TimeoutError("timed out"), "ok"])
    mock_func.__name__ = "mock_func"

    with patch(SLEEP):
        wrapped = retry_on_exception(
            max_attempts=2, base_delay=0.01, jitter=False, exceptions=(TimeoutError,)
        )(mock_func)
        result = wrapped()

    assert result == "ok"
    assert mock_func.call_count == 2


def test_retry_on_exception_max_attempts_zero_raises_runtime_error() -> None:
    """Should raise RuntimeError when max_attempts leaves no attempt to run."""
    mock_func = MagicMock(return_value="ok")
    mock_func.__name__ = "mock_func"
    wrapped = retry_on_exception(max_attempts=0)(mock_func)

    with pytest.raises(RuntimeError, match="All 0 attempts failed"):
        wrapped()

    mock_func.assert_not_called()


# ---------------------------------------------------------------------------
# async_retry_on_exception
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_async_retry_on_exception_succeeds_first_try() -> None:
    """Should await the wrapped coroutine once when it succeeds immediately."""
    mock_func = AsyncMock(return_value="ok")
    wrapped = async_retry_on_exception(max_attempts=3)(mock_func)

    result = await wrapped()

    assert result == "ok"
    assert mock_func.await_count == 1


@pytest.mark.asyncio
async def test_async_retry_on_exception_retries_then_succeeds() -> None:
    """Should retry a failing coroutine on retryable exceptions until success."""
    mock_func = AsyncMock(side_effect=[ConnectionError("fail"), "ok"])

    with patch(ASYNC_SLEEP, new_callable=AsyncMock) as mock_sleep:
        wrapped = async_retry_on_exception(
            max_attempts=3, base_delay=0.01, jitter=False
        )(mock_func)
        result = await wrapped()

    assert result == "ok"
    assert mock_func.await_count == 2
    mock_sleep.assert_awaited_once()


@pytest.mark.asyncio
async def test_async_retry_on_exception_exhausts_retries_and_raises() -> None:
    """Should raise the last retryable exception once max_attempts is reached."""
    mock_func = AsyncMock(side_effect=ConnectionError("nope"))

    with patch(ASYNC_SLEEP, new_callable=AsyncMock):
        wrapped = async_retry_on_exception(
            max_attempts=2, base_delay=0.01, jitter=False
        )(mock_func)
        with pytest.raises(ConnectionError, match="nope"):
            await wrapped()

    assert mock_func.await_count == 2


@pytest.mark.asyncio
async def test_async_retry_on_exception_non_retryable_fails_immediately() -> None:
    """Should not retry exceptions outside the configured retryable tuple."""
    mock_func = AsyncMock(side_effect=ValueError("bad"))

    with patch(ASYNC_SLEEP, new_callable=AsyncMock) as mock_sleep:
        wrapped = async_retry_on_exception(
            max_attempts=3, exceptions=(ConnectionError,)
        )(mock_func)
        with pytest.raises(ValueError, match="bad"):
            await wrapped()

    assert mock_func.await_count == 1
    mock_sleep.assert_not_awaited()


# ---------------------------------------------------------------------------
# RetryableOperation
# ---------------------------------------------------------------------------


def test_retryable_operation_success_does_not_suppress_or_retry() -> None:
    """Should leave attempt count untouched when the block succeeds."""
    op = RetryableOperation("test_op", max_attempts=3)

    with op:
        pass

    assert op.current_attempt == 0
    assert op.last_exception is None


def test_retryable_operation_retries_until_success() -> None:
    """Should suppress retryable exceptions and allow the loop to retry."""
    op = RetryableOperation("test_op", max_attempts=3, base_delay=0.01, jitter=False)
    attempts: int = 0
    result: str | None = None

    with patch(SLEEP) as mock_sleep:
        while op.should_retry():
            with op:
                attempts += 1
                if attempts < 3:
                    raise ConnectionError("fail")
                result = "success"
                break

    assert result == "success"
    assert attempts == 3
    assert mock_sleep.call_count == 2


def _run_always_failing_operation(op: RetryableOperation) -> None:
    while op.should_retry():
        with op:
            raise ConnectionError("boom")


def test_retryable_operation_propagates_after_max_attempts() -> None:
    """Should stop suppressing once max_attempts retryable failures occur."""
    op = RetryableOperation("test_op", max_attempts=2, base_delay=0.01, jitter=False)

    with patch(SLEEP), pytest.raises(ConnectionError, match="boom"):
        _run_always_failing_operation(op)

    assert op.current_attempt == 2
    assert isinstance(op.last_exception, ConnectionError)


def test_retryable_operation_non_retryable_exception_propagates_immediately() -> None:
    """Should not suppress exceptions outside the configured retryable tuple."""
    op = RetryableOperation("test_op", max_attempts=3)

    with pytest.raises(ValueError, match="bad"):
        with op:
            raise ValueError("bad")

    # Non-retryable exceptions don't count as a tracked attempt.
    assert op.current_attempt == 0


def test_retryable_operation_should_retry_reflects_attempt_count() -> None:
    """Should report should_retry() based on current_attempt vs max_attempts."""
    op = RetryableOperation("test_op", max_attempts=3)
    assert op.should_retry() is True

    op.current_attempt = 3
    assert op.should_retry() is False


# ---------------------------------------------------------------------------
# Convenience functions
# ---------------------------------------------------------------------------


def test_retry_database_operation_success() -> None:
    """Should pass through args/kwargs and return the function's result."""
    func = MagicMock(return_value=42)

    result = retry_database_operation(func, "a", max_attempts=2, b=1)

    assert result == 42
    func.assert_called_once_with("a", b=1)


def test_retry_database_operation_retries_on_operational_error() -> None:
    """Should retry on sqlalchemy OperationalError and return eventual success."""
    func = MagicMock(
        side_effect=[OperationalError("stmt", {}, Exception("orig")), "ok"]
    )

    with patch(SLEEP):
        result = retry_database_operation(func, max_attempts=2)

    assert result == "ok"
    assert func.call_count == 2


def test_retry_database_operation_does_not_retry_non_retryable_exceptions() -> None:
    """Should fail immediately for exceptions outside the retryable set."""
    func = MagicMock(side_effect=ValueError("bad"))

    with pytest.raises(ValueError, match="bad"):
        retry_database_operation(func, max_attempts=3)

    assert func.call_count == 1


@pytest.mark.asyncio
async def test_async_retry_database_operation_success() -> None:
    """Should await the coroutine and return its result."""
    func = AsyncMock(return_value="ok")

    result = await async_retry_database_operation(func, max_attempts=2)

    assert result == "ok"
    func.assert_awaited_once()


@pytest.mark.asyncio
async def test_async_retry_database_operation_retries_on_timeout_error() -> None:
    """Should retry an async database operation on sqlalchemy TimeoutError."""
    from sqlalchemy.exc import TimeoutError as SATimeoutError

    func = AsyncMock(side_effect=[SATimeoutError("timed out"), "ok"])

    with patch(ASYNC_SLEEP, new_callable=AsyncMock):
        result = await async_retry_database_operation(func, max_attempts=2)

    assert result == "ok"
    assert func.await_count == 2


def test_retry_screenshot_operation_success() -> None:
    """Should return the screenshot function's result on success."""
    func = MagicMock(return_value=b"png-bytes")

    result = retry_screenshot_operation(func)

    assert result == b"png-bytes"


def test_retry_screenshot_operation_retries_on_os_error() -> None:
    """Should retry a screenshot operation on OSError."""
    func = MagicMock(side_effect=[OSError("disk full"), b"png-bytes"])

    with patch(SLEEP):
        result = retry_screenshot_operation(func, max_attempts=2)

    assert result == b"png-bytes"
    assert func.call_count == 2


def test_retry_screenshot_operation_does_not_retry_non_retryable_exceptions() -> None:
    """Should fail immediately for exceptions outside the screenshot retry set."""
    func = MagicMock(side_effect=ValueError("bad"))

    with pytest.raises(ValueError, match="bad"):
        retry_screenshot_operation(func, max_attempts=2)

    assert func.call_count == 1
