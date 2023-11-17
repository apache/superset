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

import time
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any, Callable, TYPE_CHECKING
from uuid import UUID

from flask import current_app, g, Response

from superset.utils import core as utils
from superset.utils.dates import now_as_float

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
                    hasattr(ex, "status")
                    and ex.status < 500  # pylint: disable=no-member
                ):
                    current_app.config["STATS_LOGGER"].gauge(
                        f"{metric_prefix_}.warning", 1
                    )
                else:
                    current_app.config["STATS_LOGGER"].gauge(
                        f"{metric_prefix_}.error", 1
                    )
                raise ex

        return wrapped

    return decorate


@contextmanager
def stats_timing(stats_key: str, stats_logger: BaseStatsLogger) -> Iterator[float]:
    """Provide a transactional scope around a series of operations."""
    start_ts = now_as_float()
    try:
        yield start_ts
    except Exception as ex:
        raise ex
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


def context(
    slice_id: int | None = None,
    dashboard_id: int | None = None,
    execution_id: str | UUID | None = None,
) -> Callable[..., Any]:
    """
    Takes arguments and adds them to the global context.
    This is for logging purposes only and values should not be relied on or mutated
    """

    def decorate(f: Callable[..., Any]) -> Callable[..., Any]:
        def wrapped(*args: Any, **kwargs: Any) -> Any:
            if not hasattr(g, "context"):
                g.context = {}
            available_context_values = ["slice_id", "dashboard_id", "execution_id"]
            context_data = {
                key: val
                for key, val in kwargs.items()
                if key in available_context_values
            }

            # if values are passed in to decorator directly, add them to context
            # by overriding values from kwargs
            for val in available_context_values:
                if locals().get(val) is not None:
                    context_data[val] = locals()[val]

            g.context.update(context_data)
            return f(*args, **kwargs)

        return wrapped

    return decorate
