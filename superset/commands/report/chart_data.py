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
"""Bounded, privacy-preserving transport handling for report attachments."""

import errno
import logging
import socket
import time
from collections.abc import Callable
from http.client import HTTPException, IncompleteRead
from urllib.error import HTTPError, URLError

from superset.errors import SupersetErrorType
from superset.utils import json

logger = logging.getLogger(__name__)
_ERROR_BODY_LIMIT = 4096
_BACKOFF_SECONDS = 0.5
_RETRYABLE_STATUS = {429, 500, 502, 503, 504}
_TRANSIENT_ERRNOS = {
    errno.ECONNREFUSED,
    errno.ECONNRESET,
    errno.ECONNABORTED,
    errno.ETIMEDOUT,
    errno.EHOSTUNREACH,
    errno.ENETUNREACH,
    errno.EPIPE,
}


class ChartDataRequestError(Exception):
    """A transport error whose message contains no remote-controlled text."""

    def __init__(self, category: str, status: int | None = None) -> None:
        """Store the category used to select the normalized report exception."""
        self.category = category
        super().__init__(
            f"Chart data request failed: category={category} status={status}"
        )


def _error_body(error: HTTPError) -> str:
    """Project a bounded JSON body onto known error types, never free-form text.

    Messages, SQL, validation values and arbitrary extra fields may contain
    credentials or query data. Redaction by keyword cannot safely retain them.
    """
    try:
        body = error.read(_ERROR_BODY_LIMIT + 1)
        if len(body) > _ERROR_BODY_LIMIT:
            return "[omitted: oversized body]"
        payload = json.loads(body)
    except (ValueError, OSError, HTTPException, RecursionError):
        return "[omitted: unreadable or non-JSON body]"
    if not isinstance(payload, dict) or not isinstance(payload.get("errors"), list):
        return "[redacted]"
    known_types = {member.value for member in SupersetErrorType}
    errors = []
    for item in payload["errors"][:4]:
        error_type = item.get("error_type") if isinstance(item, dict) else None
        errors.append(
            {
                "error_type": error_type
                if isinstance(error_type, str) and error_type in known_types
                else "[redacted]",
                "message": "[redacted]",
            }
        )
    return json.dumps({"errors": errors})


def _retry_delay(error: HTTPError) -> float | None:
    """Respect numeric Retry-After; defer date-based delays to the scheduler."""
    retry_after = error.headers.get("Retry-After") if error.headers else None
    if retry_after is None:
        return _BACKOFF_SECONDS
    try:
        seconds = float(retry_after)
    except ValueError:
        return None
    return max(_BACKOFF_SECONDS, seconds) if 0 <= seconds <= 2 else None


def request_chart_data(
    fetch: Callable[[float | None], bytes | None],
    get_timeout: Callable[[], float | None],
    *,
    retry: bool,
    endpoint: str,
    log_context: str,
) -> bytes | None:
    """Optionally retry once, sharing the initial timeout and execution budget.

    The caller supplies a fixed endpoint path, never a URL or query payload.
    The deadline callback also preserves the report's delivery/cleanup reserves.
    Socket timeouts are not wall-clock cancellation; the report task's existing
    execution limits remain responsible for interrupting in-flight work.
    """
    started = time.monotonic()
    timeout = get_timeout()
    deadline = started + timeout if timeout is not None else None
    for attempt in (1, 2):
        if attempt == 2:
            phase_timeout = get_timeout()
            remaining = deadline - time.monotonic() if deadline is not None else 0
            if remaining <= 0:
                raise ChartDataRequestError("timeout")
            timeout = (
                min(remaining, phase_timeout)
                if phase_timeout is not None
                else remaining
            )
        status = None
        body = "[not applicable]"
        delay = _BACKOFF_SECONDS
        try:
            content = fetch(timeout)
            logger.info(
                "Chart data request completed %s endpoint=%s "
                "elapsed_seconds=%.2f attempt=%s timeout_seconds=%s",
                log_context,
                endpoint,
                time.monotonic() - started,
                attempt,
                timeout,
            )
            return content
        except HTTPError as error:
            status = error.code
            category = "http"
            transient = status in _RETRYABLE_STATUS
            # A server requesting a longer or date-based delay should be left
            # to the scheduler, rather than retried earlier than requested.
            retry_delay = _retry_delay(error)
            if retry_delay is None:
                transient = False
            else:
                delay = retry_delay
            try:
                body = _error_body(error)
            finally:
                error.close()
        except (OSError, HTTPException) as error:
            reason = error.reason if isinstance(error, URLError) else error
            is_timeout = isinstance(reason, TimeoutError) or (
                isinstance(reason, OSError) and reason.errno == errno.ETIMEDOUT
            )
            category = "timeout" if is_timeout else "network"
            transient = (
                is_timeout
                or isinstance(reason, IncompleteRead)
                or (isinstance(reason, OSError) and reason.errno in _TRANSIENT_ERRNOS)
                or (
                    isinstance(reason, socket.gaierror)
                    and reason.errno == socket.EAI_AGAIN
                )
            )
        logger.warning(
            "Chart data request failed %s endpoint=%s category=%s status=%s "
            "elapsed_seconds=%.2f attempt=%s timeout_seconds=%s body=%s",
            log_context,
            endpoint,
            category,
            status,
            time.monotonic() - started,
            attempt,
            timeout,
            body,
        )
        # Never retry an unbounded request, or renew the original timeout.
        if not retry or not transient or attempt == 2 or deadline is None:
            raise ChartDataRequestError(category, status) from None
        phase_timeout = get_timeout()
        remaining = deadline - time.monotonic()
        if phase_timeout is not None:
            remaining = min(remaining, phase_timeout)
        if remaining <= delay:
            raise ChartDataRequestError(category, status) from None
        time.sleep(delay)
    return None  # pragma: no cover
