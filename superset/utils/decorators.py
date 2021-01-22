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
import time
from typing import Any, Callable, Dict, Iterator, Union

from contextlib2 import contextmanager

from superset.stats_logger import BaseStatsLogger
from superset.utils.dates import now_as_float


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


def arghash(args: Any, kwargs: Dict[str, Any]) -> int:
    """Simple argument hash with kwargs sorted."""
    sorted_args = tuple(
        x if hasattr(x, "__repr__") else x for x in [*args, *sorted(kwargs.items())]
    )
    return hash(sorted_args)


def debounce(duration: Union[float, int] = 0.1) -> Callable[..., Any]:
    """Ensure a function called with the same arguments executes only once
    per `duration` (default: 100ms).
    """

    def decorate(f: Callable[..., Any]) -> Callable[..., Any]:
        last: Dict[str, Any] = {"t": None, "input": None, "output": None}

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
