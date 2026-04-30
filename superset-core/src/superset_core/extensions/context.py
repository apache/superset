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
Extension Context API for superset-core extensions.

Provides access to the current extension's context, including metadata
and scoped resources like storage. Extensions call `get_context()` to
access their context during execution.

The context is set by the host (Superset) during extension loading and
is only available within extension code.

Usage:
    from superset_core.extensions.context import get_context

    def setup():
        ctx = get_context()

        # Access extension metadata
        print(f"Running {ctx.extension.displayName} v{ctx.extension.version}")

        # Access extension-scoped storage
        ctx.storage.ephemeral.set("lastRun", time.time())
        data = ctx.storage.ephemeral.get("cachedData")
"""

from __future__ import annotations

from typing import Any, Protocol, TYPE_CHECKING

if TYPE_CHECKING:
    from superset_core.extensions.types import Manifest


class StorageAccessor(Protocol):
    """Protocol for storage access with user-scoped and shared modes."""

    def get(self, key: str) -> Any:
        """Get a value from storage."""
        ...

    def set(self, key: str, value: Any, ttl: int = 3600) -> None:
        """Set a value in storage with optional TTL."""
        ...

    def remove(self, key: str) -> None:
        """Remove a value from storage."""
        ...

    @property
    def shared(self) -> "StorageAccessor":
        """Shared (cross-user) storage accessor."""
        ...


class ExtensionStorage(Protocol):
    """Extension-scoped storage accessor for all available tiers."""

    @property
    def ephemeral(self) -> StorageAccessor:
        """Server-side cache (Redis/Memcached) with TTL."""
        ...

    # Future tiers:
    # @property
    # def persistent(self) -> StorageAccessor:
    #     """Database-backed persistent storage."""
    #     ...


class ExtensionContext(Protocol):
    """
    Context object providing extension-specific resources.

    This context is only available during extension execution.
    Calling `get_context()` outside of an extension will raise an error.
    """

    @property
    def extension(self) -> "Manifest":
        """Metadata about the current extension."""
        ...

    @property
    def storage(self) -> ExtensionStorage:
        """Extension-scoped storage across all available tiers."""
        ...


def get_context() -> ExtensionContext:
    """
    Get the current extension's context.

    This function returns the context for the currently executing extension,
    providing access to extension metadata and scoped resources like storage.

    Host implementations will replace this function during initialization
    with a concrete implementation providing actual functionality.

    :returns: The current extension's context.
    :raises RuntimeError: If called outside of an extension context.

    Example:
        from superset_core.extensions.context import get_context

        ctx = get_context()

        # Access extension metadata
        print(f"Extension: {ctx.extension.id}")
        print(f"Version: {ctx.extension.version}")

        # Access extension-scoped storage
        ctx.storage.ephemeral.set("tempData", data, ttl=3600)
        value = ctx.storage.ephemeral.get("tempData")

        # Access shared (cross-user) storage
        ctx.storage.ephemeral.shared.set("globalCounter", count)
    """
    raise NotImplementedError(
        "get_context() must be called within an extension context. "
        "This function is replaced by the host during extension loading."
    )
