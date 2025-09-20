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
Retry utilities for handling transient failures in MCP service operations.
"""

import asyncio
import functools
import logging
import random
import time
from typing import Any, Callable, Optional, Type, TypeVar

from sqlalchemy.exc import OperationalError, TimeoutError
from starlette.exceptions import HTTPException

logger = logging.getLogger(__name__)

T = TypeVar("T")

# Default retryable exceptions
DEFAULT_RETRYABLE_EXCEPTIONS = (
    OperationalError,  # Database connection issues
    TimeoutError,  # Database timeouts
    ConnectionError,  # Network issues
    OSError,  # File system issues (for screenshots)
)


def exponential_backoff(
    attempt: int, base_delay: float = 1.0, max_delay: float = 60.0, jitter: bool = True
) -> float:
    """
    Calculate exponential backoff delay with optional jitter.

    Args:
        attempt: Current attempt number (0-based)
        base_delay: Base delay in seconds
        max_delay: Maximum delay in seconds
        jitter: Whether to add random jitter to avoid thundering herd

    Returns:
        Delay in seconds
    """
    delay = base_delay * (2**attempt)
    delay = min(delay, max_delay)

    if jitter:
        # Add up to 25% jitter
        jitter_amount = delay * 0.25
        delay += random.uniform(-jitter_amount, jitter_amount)  # noqa: S311

    return max(0, delay)


def retry_on_exception(
    max_attempts: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    exceptions: tuple[Type[Exception], ...] = DEFAULT_RETRYABLE_EXCEPTIONS,
    jitter: bool = True,
) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """
    Decorator to retry function calls on specific exceptions with exponential backoff.

    Args:
        max_attempts: Maximum number of attempts (including initial attempt)
        base_delay: Base delay in seconds for exponential backoff
        max_delay: Maximum delay in seconds between retries
        exceptions: Tuple of exception types to retry on
        jitter: Whether to add random jitter to backoff delays

    Returns:
        Decorated function
    """

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> T:
            last_exception = None

            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:  # noqa: PERF203
                    last_exception = e

                    if attempt == max_attempts - 1:
                        # Last attempt, don't wait
                        break

                    delay = exponential_backoff(attempt, base_delay, max_delay, jitter)

                    logger.warning(
                        "Attempt %s/%s failed for %s: %s. Retrying in %.2fs...",
                        attempt + 1,
                        max_attempts,
                        func.__name__,
                        e,
                        delay,
                    )

                    time.sleep(delay)
                except Exception as e:
                    # Non-retryable exception, fail immediately
                    logger.error("Non-retryable exception in %s: %s", func.__name__, e)
                    raise

            # All attempts failed
            if last_exception is not None:
                logger.error(
                    "All %s attempts failed for %s: %s",
                    max_attempts,
                    func.__name__,
                    last_exception,
                )
                raise last_exception
            logger.error("All %s attempts failed for %s", max_attempts, func.__name__)
            raise RuntimeError(
                f"All {max_attempts} attempts failed for {func.__name__}"
            )

        return wrapper

    return decorator


def async_retry_on_exception(
    max_attempts: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    exceptions: tuple[Type[Exception], ...] = DEFAULT_RETRYABLE_EXCEPTIONS,
    jitter: bool = True,
) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """
    Async version of retry_on_exception decorator.
    """

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        @functools.wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            last_exception = None

            for attempt in range(max_attempts):
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:  # noqa: PERF203
                    last_exception = e

                    if attempt == max_attempts - 1:
                        # Last attempt, don't wait
                        break

                    delay = exponential_backoff(attempt, base_delay, max_delay, jitter)

                    logger.warning(
                        "Attempt %s/%s failed for %s: %s. Retrying in %.2fs...",
                        attempt + 1,
                        max_attempts,
                        func.__name__,
                        e,
                        delay,
                    )

                    await asyncio.sleep(delay)
                except Exception as e:
                    # Non-retryable exception, fail immediately
                    logger.error("Non-retryable exception in %s: %s", func.__name__, e)
                    raise

            # All attempts failed
            if last_exception is not None:
                logger.error(
                    "All %s attempts failed for %s: %s",
                    max_attempts,
                    func.__name__,
                    last_exception,
                )
                raise last_exception
            logger.error("All %s attempts failed for %s", max_attempts, func.__name__)
            raise RuntimeError(
                f"All {max_attempts} attempts failed for {func.__name__}"
            )

        return wrapper

    return decorator


class RetryableOperation:
    """
    Context manager for retryable operations with custom logic.
    """

    def __init__(
        self,
        operation_name: str,
        max_attempts: int = 3,
        base_delay: float = 1.0,
        max_delay: float = 60.0,
        exceptions: tuple[Type[Exception], ...] = DEFAULT_RETRYABLE_EXCEPTIONS,
        jitter: bool = True,
    ) -> None:
        self.operation_name = operation_name
        self.max_attempts = max_attempts
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.exceptions = exceptions
        self.jitter = jitter
        self.current_attempt = 0
        self.last_exception: Optional[Exception] = None

    def __enter__(self) -> "RetryableOperation":
        return self

    def __exit__(
        self,
        exc_type: Optional[Type[Exception]],
        exc_val: Optional[Exception],
        exc_tb: Any,
    ) -> bool:
        if exc_type is None:
            # No exception, operation succeeded
            return False

        if not issubclass(exc_type, self.exceptions):
            # Non-retryable exception
            logger.error(
                "Non-retryable exception in %s: %s", self.operation_name, exc_val
            )
            return False

        self.last_exception = exc_val
        self.current_attempt += 1

        if self.current_attempt >= self.max_attempts:
            # Max attempts reached
            logger.error(
                "All %s attempts failed for %s. ",
                self.max_attempts,
                self.operation_name,
            )
            return False

        # Calculate delay and wait
        delay = exponential_backoff(
            self.current_attempt - 1, self.base_delay, self.max_delay, self.jitter
        )

        logger.warning(
            "Attempt %s/%s failed for %s: %s. Retrying in %.2fs...",
            self.current_attempt,
            self.max_attempts,
            self.operation_name,
            exc_val,
            delay,
        )

        time.sleep(delay)
        return True  # Suppress the exception and continue

    def should_retry(self) -> bool:
        """Check if we should continue retrying"""
        return self.current_attempt < self.max_attempts


# Convenience functions for common operations
def retry_database_operation(
    func: Callable[..., T], *args: Any, max_attempts: int = 3, **kwargs: Any
) -> T:
    """
    Execute a database operation with retry logic.
    """

    @retry_on_exception(
        max_attempts=max_attempts,
        exceptions=(OperationalError, TimeoutError),
        base_delay=0.5,
        max_delay=30.0,
    )
    def _wrapped() -> T:
        return func(*args, **kwargs)

    return _wrapped()


async def async_retry_database_operation(
    func: Callable[..., Any], *args: Any, max_attempts: int = 3, **kwargs: Any
) -> Any:
    """
    Execute an async database operation with retry logic.
    """

    @async_retry_on_exception(
        max_attempts=max_attempts,
        exceptions=(OperationalError, TimeoutError),
        base_delay=0.5,
        max_delay=30.0,
    )
    async def _wrapped() -> Any:
        return await func(*args, **kwargs)

    return await _wrapped()


def retry_screenshot_operation(
    func: Callable[..., T],
    *args: Any,
    max_attempts: int = 2,  # Screenshots are expensive, fewer retries
    **kwargs: Any,
) -> T:
    """
    Execute a screenshot operation with retry logic.
    """

    @retry_on_exception(
        max_attempts=max_attempts,
        exceptions=(OSError, ConnectionError, HTTPException),
        base_delay=2.0,  # Longer initial delay for screenshots
        max_delay=30.0,
    )
    def _wrapped() -> T:
        return func(*args, **kwargs)

    return _wrapped()
