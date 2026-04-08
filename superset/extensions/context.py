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

The context is set during extension loading and when extension callbacks are invoked.
Uses ContextVar for thread-safe and async-safe context management with automatic
save/restore for nested contexts.
"""

from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar
from typing import Any, Iterator

from superset_core.extensions.types import Manifest


class ExtensionStorage:
    """Extension storage with all available tiers."""

    @property
    def ephemeral(self) -> Any:
        from superset.extensions.storage.ephemeral_state import EphemeralStateImpl

        return EphemeralStateImpl


class ConcreteExtensionContext:
    """Concrete implementation of ExtensionContext for the host."""

    def __init__(self, manifest: Manifest):
        self._manifest = manifest
        self._storage = ExtensionStorage()

    @property
    def extension(self) -> Manifest:
        """Extension metadata (new API)."""
        return self._manifest

    @property
    def manifest(self) -> Manifest:
        """Extension manifest (for backward compatibility)."""
        return self._manifest

    @property
    def storage(self) -> ExtensionStorage:
        return self._storage


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
def extension_context(manifest: Manifest) -> Iterator[ConcreteExtensionContext]:
    """
    Context manager for setting extension context during loading.

    Creates a new ExtensionContext for the given manifest and sets it as
    the current context. Supports nested contexts via ContextVar tokens.

    :param manifest: The extension manifest
    :yields: The created ExtensionContext
    """
    ctx = ConcreteExtensionContext(manifest)
    with use_context(ctx):
        yield ctx
