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

import logging
import time
from collections.abc import Iterator
from contextlib import contextmanager
from functools import wraps
from typing import Any, Callable, TYPE_CHECKING
from uuid import UUID

from flask import current_app, g, Response
from sqlalchemy.exc import SQLAlchemyError

from superset.utils import core as utils
from superset.utils.dates import now_as_float

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from superset.stats_logger import BaseStatsLogger


def statsd_gauge(metric_prefix: str | None = None) -> Callable[..., Any]:
    def decorate(f: Callable[..., Any]) -> Callable[..., Any]:
        """
        Handle sending statsd gauge metric from any method or function
        """

        def wrapped(*args: Any, **kwargs: Any) -> Any:
            metric_prefix_ = metric_prefix or f.__name__
            try:
                result = f(*args, **kwargs)
                current_app.config["STATS_LOGGER"].gauge(f"{metric_prefix_}.ok", 1)
                return result
            except Exception as ex:
                if (
                    hasattr(ex, "status") and ex.status < 500  # pylint: disable=no-member
                ):
                    current_app.config["STATS_LOGGER"].gauge(
                        f"{metric_prefix_}.warning", 1
                    )
                else:
                    current_app.config["STATS_LOGGER"].gauge(
                        f"{metric_prefix_}.error", 1
                    )
                raise

        return wrapped

    return decorate


def logs_context(
    context_func: Callable[..., dict[Any, Any]] | None = None,
    **ctx_kwargs: int | str | UUID | None,
) -> Callable[..., Any]:
    """
    Takes arguments and adds them to the global logs_context.
    This is for logging purposes only and values should not be relied on or mutated
    """

    def decorate(f: Callable[..., Any]) -> Callable[..., Any]:
        def wrapped(*args: Any, **kwargs: Any) -> Any:
            if not hasattr(g, "logs_context"):
                g.logs_context = {}

            # limit data that can be saved to logs_context
            # in order to prevent antipatterns
            available_logs_context_keys = [
                "slice_id",
                "dashboard_id",
                "dataset_id",
                "execution_id",
                "report_schedule_id",
            ]
            # set value from kwargs from
            # wrapper function if it exists
            # e.g. @logs_context()
            #      def my_func(slice_id=None, **kwargs)
            #
            #      my_func(slice_id=2)
            logs_context_data = {
                key: val
                for key, val in kwargs.items()
                if key in available_logs_context_keys
                if val is not None
            }

            try:
                # if keys are passed in to decorator directly, add them to logs_context
                # by overriding values from kwargs
                # e.g. @logs_context(slice_id=1, dashboard_id=1)
                logs_context_data.update(
                    {
                        key: ctx_kwargs.get(key)
                        for key in available_logs_context_keys
                        if ctx_kwargs.get(key) is not None
                    }
                )

                if context_func is not None:
                    # if a context function is passed in, call it and add the
                    # returned values to logs_context
                    # context_func=lambda *args, **kwargs: {
                    # "slice_id": 1, "dashboard_id": 1
                    # }
                    logs_context_data.update(
                        {
                            key: value
                            for key, value in context_func(*args, **kwargs).items()
                            if key in available_logs_context_keys
                            if value is not None
                        }
                    )

            except (TypeError, KeyError, AttributeError):
                # do nothing if the key doesn't exist
                # or context is not callable
                logger.warning("Invalid data was passed to the logs context decorator")

            g.logs_context.update(logs_context_data)
            return f(*args, **kwargs)

        return wrapped

    return decorate


@contextmanager
def stats_timing(stats_key: str, stats_logger: BaseStatsLogger) -> Iterator[float]:
    """Provide a transactional scope around a series of operations."""
    start_ts = now_as_float()
    try:
        yield start_ts
    finally:
        stats_logger.timing(stats_key, now_as_float() - start_ts)


def arghash(args: Any, kwargs: Any) -> int:
    """Simple argument hash with kwargs sorted."""
    sorted_args = tuple(
        x if hasattr(x, "__repr__") else x for x in [*args, *sorted(kwargs.items())]
    )
    return hash(sorted_args)


def debounce(duration: float | int = 0.1) -> Callable[..., Any]:
    """Ensure a function called with the same arguments executes only once
    per `duration` (default: 100ms).
    """

    def decorate(f: Callable[..., Any]) -> Callable[..., Any]:
        last: dict[str, Any] = {"t": None, "input": None, "output": None}

        def wrapped(*args: Any, **kwargs: Any) -> Any:
            now = time.time()
            updated_hash = arghash(args, kwargs)
            if (
                last["t"] is None
                or now - last["t"] >= duration
                or last["input"] != updated_hash
            ):
                result = f(*args, **kwargs)
                last["t"] = time.time()
                last["input"] = updated_hash
                last["output"] = result
                return result
            return last["output"]

        return wrapped

    return decorate


def on_security_exception(self: Any, ex: Exception) -> Response:
    return self.response(403, **{"message": utils.error_msg_from_exception(ex)})


@contextmanager
def suppress_logging(
    logger_name: str | None = None,
    new_level: int = logging.CRITICAL,
) -> Iterator[None]:
    """
    Context manager to suppress logging during the execution of code block.

    Use with caution and make sure you have the least amount of code inside it.
    """
    target_logger = logging.getLogger(logger_name)
    original_level = target_logger.getEffectiveLevel()
    target_logger.setLevel(new_level)
    try:
        yield
    finally:
        target_logger.setLevel(original_level)


def on_error(
    ex: Exception,
    catches: tuple[type[Exception], ...] = (SQLAlchemyError,),
    reraise: type[Exception] | None = SQLAlchemyError,
) -> None:
    """
    Default error handler whenever any exception is caught during a SQLAlchemy nested
    transaction.

    :param ex: The source exception
    :param catches: The exception types the handler catches
    :param reraise: The exception type the handler raises after catching
    :raises Exception: If the exception is not swallowed
    """

    if isinstance(ex, catches):
        if hasattr(ex, "exception"):
            logger.exception(ex.exception)

        if reraise:
            raise reraise() from ex
    else:
        raise ex


def transaction(  # pylint: disable=redefined-outer-name
    on_error: Callable[..., Any] | None = on_error,
) -> Callable[..., Any]:
    """
    Perform a "unit of work".

    Note ideally this would leverage SQLAlchemy's nested transaction, however this
    proved rather complicated, likely due to many architectural facets, and thus has
    been left for a follow up exercise.

    :param on_error: Callback invoked when an exception is caught
    :see: https://github.com/apache/superset/issues/25108
    """

    def decorate(func: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(func)
        def wrapped(*args: Any, **kwargs: Any) -> Any:
            from superset import db  # pylint: disable=import-outside-toplevel

            try:
                result = func(*args, **kwargs)
                db.session.commit()  # pylint: disable=consider-using-transaction
                return result
            except Exception as ex:
                db.session.rollback()  # pylint: disable=consider-using-transaction

                if on_error:
                    return on_error(ex)

                raise

        return wrapped

    return decorate
