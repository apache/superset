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

"""Bound outstanding system DNS calls independently of request cancellation."""

from __future__ import annotations

import asyncio
import os
import socket
from _thread import LockType
from importlib import import_module
from typing import Any, TypeAlias
from weakref import WeakValueDictionary

# System DNS cannot be cancelled. Timed-out requests must not replenish capacity.
_RESOLVER_LIMIT: int = 4
_AddressInfo: TypeAlias = tuple[
    socket.AddressFamily,
    socket.SocketKind,
    int,
    str,
    tuple[str, int] | tuple[str, int, int, int],
]


def _original(module: str, name: str) -> Any:
    """Use native primitives even in a monkey-patched worker."""
    try:
        from gevent.monkey import get_original
    except ImportError:
        return getattr(import_module(module), name)
    return get_original(module, name)


class _ResolverAdmission:
    """Track real lookup lifetimes across private loops and native workers."""

    def __init__(self) -> None:
        self.lock: LockType = _original("_thread", "allocate_lock")()
        self.active: int = 0

    def acquire(self) -> bool:
        """Reserve one lookup without blocking an event loop."""
        with self.lock:
            if self.active >= _RESOLVER_LIMIT:
                return False
            self.active += 1
            return True

    def release(self) -> None:
        """Release only when the native lookup has actually returned."""
        with self.lock:
            self.active -= 1


_admission: _ResolverAdmission = _ResolverAdmission()


def _after_fork() -> None:
    """Reset before child threads start, without acquiring inherited locks."""
    global _admission  # pylint: disable=global-statement
    _admission = _ResolverAdmission()


if hasattr(os, "register_at_fork"):
    os.register_at_fork(after_in_child=_after_fork)


class MetadataEventLoop(asyncio.SelectorEventLoop):
    """Keep command cancellation separate from bounded native DNS lifetimes."""

    # SelectorEventLoop initializes this registry; typeshed omits it.
    _transports: WeakValueDictionary[int, asyncio.Transport]

    def close(self) -> None:
        """Release private sockets even when graceful TLS shutdown was cancelled."""
        if self.is_closed() or self.is_running():
            # Preserve the base loop's idempotence and running-loop error.
            super().close()
            return
        try:
            pending: asyncio.Task[Any]
            for pending in asyncio.all_tasks(self):
                pending.cancel()
            # SelectorEventLoop owns the raw transports beneath TLS, including
            # those whose Redis writer reference was cleared by cancellation.
            transport: asyncio.Transport
            for transport in list(self._transports.values()):
                transport.abort()
            # abort() schedules connection_lost(), which closes the descriptor.
            # Drain ready callbacks without awaiting a peer or a cancelled task.
            self.run_until_complete(asyncio.sleep(0))
        finally:
            super().close()

    async def getaddrinfo(
        self,
        host: str | bytes | None,
        port: str | bytes | int | None,
        *,
        family: int = 0,
        type: int = 0,  # noqa: A002
        proto: int = 0,
        flags: int = 0,
    ) -> list[_AddressInfo]:
        """Resolve with process-wide admission held beyond caller cancellation."""
        admission: _ResolverAdmission = _admission
        while not admission.acquire():
            # The enclosing command deadline also covers waiting for capacity.
            await asyncio.sleep(0.01)
        future: asyncio.Future[list[_AddressInfo]] = self.create_future()

        def deliver(result: list[_AddressInfo], error: Exception | None) -> None:
            """Discard results for a cancelled caller without resuming it."""
            if not future.done():
                if error is not None:
                    future.set_exception(error)
                else:
                    future.set_result(result)

        def resolve() -> None:
            """Hold admission for the complete system call, independent of the loop."""
            result: list[_AddressInfo] = []
            error: Exception | None = None
            try:
                result = _original("socket", "getaddrinfo")(
                    host, port, family, type, proto, flags
                )
            except Exception as ex:  # pylint: disable=broad-except
                error = ex
            finally:
                admission.release()
            try:
                self.call_soon_threadsafe(deliver, result, error)
            except RuntimeError:
                # The timed-out private loop may have closed during resolution.
                pass

        try:
            # Native daemon threads cannot hold process shutdown hostage. Their
            # count stays bounded until the uninterruptible system call finishes.
            _original("_thread", "start_new_thread")(resolve, ())
        except Exception:
            admission.release()
            raise
        return await future
