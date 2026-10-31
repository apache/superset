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

"""Fail-closed guards for signal-interrupted HiveServer2 driver calls."""

from __future__ import annotations

import logging
import weakref
from collections.abc import Callable
from functools import wraps
from typing import Any, cast, TypeVar

from superset.db_engine_specs.base import TIME_LIMIT_EXCEPTIONS

logger = logging.getLogger(__name__)
GuardedMethod = TypeVar("GuardedMethod", bound=Callable[..., Any])


class ThriftClientGuard:
    """
    Guard every generated Thrift RPC, not a list of individual RPC methods.

    A signal can leave a reply partially read. Abandon targets before returning
    control to driver exception handlers, which can themselves issue cleanup
    RPCs. Subsequent RPC attempts re-raise the original exception without I/O.
    Only this client's instances are wrapped; driver classes are not patched.
    """

    def __init__(self, client: Any) -> None:
        """Keep the original client and weakly tracked cleanup targets."""
        self._client = client
        self._targets: dict[
            int, tuple[weakref.ReferenceType[Any], Callable[[Any], None]]
        ] = {}
        self._exception: BaseException | None = None

    def register(self, target: Any, abandon: Callable[[Any], None]) -> None:
        """Track a real cursor or connection without extending its lifetime."""
        key = id(target)
        owner = weakref.ref(self)

        def discard(_ref: weakref.ReferenceType[Any]) -> None:
            if (guard := owner()) is not None:
                guard._targets.pop(key, None)

        self._targets[key] = (weakref.ref(target, discard), abandon)

    def __getattr__(self, name: str) -> Any:
        """Forward attributes and wrap all callable driver-client entry points."""
        value = getattr(self._client, name)
        if not callable(value):
            return value

        @wraps(value)
        def call(*args: Any, **kwargs: Any) -> Any:
            if self._exception is not None:
                raise self._exception
            try:
                return value(*args, **kwargs)
            except TIME_LIMIT_EXCEPTIONS as ex:
                self.abandon(ex)
                raise

        return call

    def abandon(self, exception: BaseException) -> None:
        """Disable all further RPCs before attempting best-effort local cleanup."""
        if self._exception is not None:
            return
        self._exception = exception
        for ref, abandon in list(self._targets.values()):
            if (target := ref()) is not None:
                try:
                    abandon(target)
                except (Exception, KeyboardInterrupt):  # pylint: disable=broad-except
                    logger.warning("Abandoning an interrupted Thrift target failed")


def guard_cursor(method: GuardedMethod) -> GuardedMethod:
    """Apply the engine's shared timeout scope to direct spec entry points."""

    @wraps(method)
    def guarded(cls: Any, cursor: Any, *args: Any, **kwargs: Any) -> Any:
        with cls.cursor_context(cursor):
            return method(cls, cursor, *args, **kwargs)

    return cast(GuardedMethod, guarded)


def real_cursor(cursor: Any) -> Any:
    """Unwrap cursor adapters so state and weak references belong to the driver."""
    while "_cursor" in vars(cursor):
        cursor = vars(cursor)["_cursor"]
    return cursor


def guard_cursor_factory(connection: Any, prepare: Callable[[Any], object]) -> None:
    """Register cursors before exposing them to callers, including direct users."""
    if vars(connection).get("_superset_cursor_guard") is True:
        return
    cursor_factory = connection.cursor

    @wraps(cursor_factory)
    def cursor(*args: Any, **kwargs: Any) -> Any:
        result = cursor_factory(*args, **kwargs)
        prepare(result)
        return result

    connection.cursor = cursor
    connection._superset_cursor_guard = True  # pylint: disable=protected-access
