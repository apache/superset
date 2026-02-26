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
Registration context for contribution discovery and security.

Controls how decorators behave based on the current execution context:
- host: Register immediately (for host application components)
- extension: Store metadata only, defer to ExtensionManager (security boundary)
- build: Store metadata only, for CLI discovery

The manifest.json serves as the security allowlist for extensions.
Only contributions declared in the manifest will be registered.
"""

from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Iterator, Literal, TYPE_CHECKING

if TYPE_CHECKING:
    from superset_core.api.rest_api import RestApiMetadata
    from superset_core.mcp import PromptMetadata, ToolMetadata


# Type alias for contribution types
ContributionType = Literal["tool", "prompt", "restApi"]


class RegistrationMode(Enum):
    """Registration modes for decorator behavior."""

    HOST = "host"  # Register immediately (host application)
    EXTENSION = "extension"  # Defer registration (manifest validation)
    BUILD = "build"  # Metadata only (CLI discovery)


@dataclass
class PendingContribution:
    """A contribution waiting for registration after manifest validation."""

    func: Callable[..., Any]
    metadata: ToolMetadata | PromptMetadata | RestApiMetadata
    contrib_type: ContributionType


@dataclass
class RegistrationContext:
    """
    Global context controlling decorator registration behavior.

    In host mode, decorators register immediately with MCP.
    In extension mode, decorators store metadata and the ExtensionManager
    validates against the manifest before completing registration.
    In build mode, decorators only store metadata for discovery.
    """

    _mode: RegistrationMode = RegistrationMode.HOST
    _current_extension_id: str | None = None
    _pending_contributions: dict[str, list[PendingContribution]] = field(
        default_factory=dict
    )

    def set_mode(self, mode: RegistrationMode) -> None:
        """Set the global registration mode."""
        self._mode = mode

    @property
    def mode(self) -> RegistrationMode:
        """Get the current registration mode."""
        return self._mode

    @property
    def is_host_mode(self) -> bool:
        """True if in host mode (immediate registration)."""
        return self._mode == RegistrationMode.HOST

    @property
    def is_extension_mode(self) -> bool:
        """True if in extension mode (deferred registration)."""
        return self._mode == RegistrationMode.EXTENSION

    @property
    def is_build_mode(self) -> bool:
        """True if in build mode (metadata only)."""
        return self._mode == RegistrationMode.BUILD

    @property
    def current_extension_id(self) -> str | None:
        """Get the current extension ID being loaded."""
        return self._current_extension_id

    @contextmanager
    def extension_context(self, extension_id: str) -> Iterator[None]:
        """
        Context manager for loading an extension.

        While in this context, decorators defer registration and store
        contributions for manifest validation.

        Args:
            extension_id: The extension being loaded

        Yields:
            None
        """
        old_mode = self._mode
        old_ext = self._current_extension_id

        self._mode = RegistrationMode.EXTENSION
        self._current_extension_id = extension_id
        self._pending_contributions[extension_id] = []

        try:
            yield
        finally:
            self._mode = old_mode
            self._current_extension_id = old_ext

    def add_pending_contribution(
        self,
        func: Callable[..., Any],
        metadata: ToolMetadata | PromptMetadata | RestApiMetadata,
        contrib_type: ContributionType,
    ) -> None:
        """
        Add a contribution pending manifest validation.

        Called by decorators in extension mode.

        Args:
            func: The decorated function
            metadata: The contribution metadata
            contrib_type: Type of contribution ("tool", "prompt", "restApi")
        """
        if self._current_extension_id is None:
            raise RuntimeError(
                "Cannot add pending contribution outside extension context"
            )

        self._pending_contributions[self._current_extension_id].append(
            PendingContribution(
                func=func,
                metadata=metadata,
                contrib_type=contrib_type,
            )
        )

    def get_pending_contributions(self, extension_id: str) -> list[PendingContribution]:
        """
        Get pending contributions for an extension.

        Called by ExtensionManager during manifest validation.

        Args:
            extension_id: The extension to get contributions for

        Returns:
            List of pending contributions
        """
        return self._pending_contributions.get(extension_id, [])

    def clear_pending_contributions(self, extension_id: str) -> None:
        """
        Clear pending contributions after registration.

        Called by ExtensionManager after successful registration.

        Args:
            extension_id: The extension to clear contributions for
        """
        self._pending_contributions.pop(extension_id, None)


# Global singleton instance
_context = RegistrationContext()


def get_context() -> RegistrationContext:
    """Get the global registration context."""
    return _context
