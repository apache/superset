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
Scope control for engine-level fetch memory caps.

Some engine specs (e.g. BigQuery, see ``BQ_FETCH_MAX_MB``) stop fetching rows
once an estimated memory budget is reached, to keep results that are rendered
in the browser small. Downloads such as CSV/XLSX exports are not rendered, so
they run inside :func:`fetch_memory_cap_disabled` to fetch every row up to the
query's own row limit.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar

_fetch_memory_cap_disabled: ContextVar[bool] = ContextVar(
    "fetch_memory_cap_disabled", default=False
)


@contextmanager
def fetch_memory_cap_disabled() -> Iterator[None]:
    """Skip engine fetch memory caps for fetches run inside this block."""
    token = _fetch_memory_cap_disabled.set(True)
    try:
        yield
    finally:
        _fetch_memory_cap_disabled.reset(token)


def is_fetch_memory_cap_disabled() -> bool:
    """Whether the current fetch runs inside :func:`fetch_memory_cap_disabled`."""
    return _fetch_memory_cap_disabled.get()
