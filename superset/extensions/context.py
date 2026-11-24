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
Extension Context Management - provides ambient context for extensions.

This module provides a context system using Python's contextvars that allows
extensions to access their context (metadata and scoped resources) via get_context().

The context is set during extension loading, and again whenever the host later
calls code an extension registered while loading (see ``bind_context``). Uses
ContextVar for thread-safe and async-safe context management with automatic
save/restore for nested contexts.
"""

from __future__ import annotations

import functools
import typing
from contextlib import contextmanager
from contextvars import ContextVar
from typing import Any, Callable, Iterator

from superset_core.extensions.types import BaseExtension, Manifest


class ExtensionStorage:
    """Extension storage with all available tiers."""

    @property
    def ephemeral(self) -> Any:
        from superset.extensions.storage.ephemeral import EphemeralState

        return EphemeralState

    @property
    def persistent(self) -> Any:
        from superset.extensions.storage.persistent import PersistentState

        return PersistentState


class ConcreteExtensionContext:
    """Concrete implementation of ExtensionContext for the host."""

    def __init__(
        self,
        manifest: Manifest,
        user_id: int | None | Callable[[], int | None] = None,
    ) -> None:
        self._manifest = manifest
        self._user_id = user_id
        self._storage = ExtensionStorage()

    @property
    def extension(self) -> BaseExtension:
        """Extension metadata."""
        return self._manifest

    @property
    def manifest(self) -> Manifest:
        """The manifest the context was created from."""
        return self._manifest

    @property
    def storage(self) -> ExtensionStorage:
        return self._storage

    @property
    def user_id(self) -> int | None:
        """Resolve request principals after authentication, or use a fixed worker ID."""
        return self._user_id() if callable(self._user_id) else self._user_id


# Context variable for ambient extension context pattern.
# Thread-safe and async-safe via Python's contextvars.
_current_context: ContextVar[ConcreteExtensionContext | None] = ContextVar(
    "extension_context", default=None
)


def get_context() -> ConcreteExtensionContext:
    """
    Get the current extension's context.

    This is the host implementation that replaces the stub in superset_core.

    :returns: The current extension's context.
    :raises RuntimeError: If called outside of an extension context.
    """
    context = _current_context.get()
    if context is None:
        raise RuntimeError(
            "get_context() must be called within an extension context. "
            "Ensure this code is being executed during extension loading or "
            "within an extension callback."
        )
    return context


def get_current_extension_context() -> ConcreteExtensionContext | None:
    """Get the currently active extension context, or None if in host code."""
    return _current_context.get()


@contextmanager
def use_context(ctx: ConcreteExtensionContext) -> Iterator[None]:
    """
    Context manager to set ambient context for extension execution.

    Used to establish the ambient context before executing extension code.
    The context is automatically restored after execution, supporting nested
    context switches.

    :param ctx: ExtensionContext to set as the current context
    :yields: None
    """
    token = _current_context.set(ctx)
    try:
        yield
    finally:
        _current_context.reset(token)


@contextmanager
def extension_context(
    manifest: Manifest,
    user_id: int | None | Callable[[], int | None] = None,
) -> Iterator[ConcreteExtensionContext]:
    """
    Context manager for setting extension context during loading.

    Creates a new ExtensionContext for the given manifest and sets it as
    the current context. Supports nested contexts via ContextVar tokens.

    :param manifest: The extension manifest
    :param user_id: A fixed principal or a resolver called when the ID is accessed
    :yields: The created ExtensionContext
    """
    ctx = ConcreteExtensionContext(manifest, user_id=user_id)
    with use_context(ctx):
        yield ctx


_P = typing.ParamSpec("_P")
_R = typing.TypeVar("_R")


@contextmanager
def restore_context(ctx: ConcreteExtensionContext | None) -> Iterator[None]:
    """
    Run in the context of the extension ``ctx`` belongs to, or as is for the
    host's own code (``None``).

    The host calls what an extension registered while loading long after it
    loaded, when no context is set, so ``get_context()`` and extension storage
    would not find the extension. Each call gets a context of its own, made
    from the extension's manifest, whose user is whoever the call runs for:
    the request's user, resolved when the context is asked, or a task's.
    """
    if ctx is None:
        yield
        return
    # Imported here, as importing superset.utils.core imports this module.
    from superset.utils.core import get_user_id

    with extension_context(ctx.manifest, user_id=get_user_id):
        yield


def bind_context(
    func: Callable[_P, _R], ctx: ConcreteExtensionContext | None
) -> Callable[_P, _R]:
    """``func``, run in ``restore_context(ctx)``; ``func`` itself for ``None``."""
    if ctx is None:
        return func

    @functools.wraps(func)
    def bound(*args: _P.args, **kwargs: _P.kwargs) -> _R:
        with restore_context(ctx):
            return func(*args, **kwargs)

    return bound
