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
Extension manager for loading and validating extensions.

The ExtensionManager coordinates extension loading:
1. Discovers extensions from configured paths
2. Validates contributions against manifests
3. Registers only declared contributions

Security model: The manifest.json serves as an allowlist.
Only contributions declared in the manifest are registered.
"""

from __future__ import annotations

import logging
from typing import Any, Callable, TYPE_CHECKING, TypeVar

from superset_core.extensions.context import get_context, PendingContribution
from superset_core.extensions.types import (
    Manifest,
)

from superset.extensions.types import LoadedExtension
from superset.extensions.utils import (
    eager_import,
    install_in_memory_importer,
)

if TYPE_CHECKING:
    from flask import Flask

logger = logging.getLogger(__name__)

T = TypeVar("T")


class ContributionValidationError(Exception):
    """Raised when a contribution is not declared in the manifest."""

    pass


class ExtensionManager:
    """
    Manages extension lifecycle and contribution registration.

    Extensions are loaded and their contributions are validated against
    the manifest before registration. This ensures only declared
    functionality is exposed.
    """

    def __init__(self) -> None:
        self._extensions: dict[str, LoadedExtension] = {}
        self._contribution_registry: dict[str, dict[str, Any]] = {
            "mcpTools": {},
            "mcpPrompts": {},
            "restApis": {},
        }

    def init_app(self, app: Flask) -> None:
        """
        Initialize extension manager with Flask app.

        Loads extensions from configuration and registers contributions.

        Args:
            app: Flask application instance
        """
        from superset.extensions.utils import get_extensions

        with app.app_context():
            extensions = get_extensions()
            for extension_id, extension in extensions.items():
                try:
                    self._load_extension(extension, app)
                except Exception as e:
                    logger.error(
                        "Failed to load extension %s: %s",
                        extension_id,
                        e,
                        exc_info=True,
                    )

    def _load_extension(self, extension: LoadedExtension, app: Flask) -> None:
        """
        Load a single extension and register its contributions.

        Args:
            extension: The loaded extension
            app: Flask application instance
        """
        extension_id = extension.id
        manifest = extension.manifest

        logger.info("Loading extension: %s (%s)", extension.name, extension_id)

        # Store extension reference
        self._extensions[extension_id] = extension

        # Install in-memory importer for backend code
        if extension.backend:
            install_in_memory_importer(extension.backend, extension.source_base_path)

        # Get registration context
        ctx = get_context()

        # Load entry points within extension context
        with ctx.extension_context(extension_id):
            if manifest.backend and manifest.backend.entryPoints:
                for entry_point in manifest.backend.entryPoints:
                    logger.debug(
                        "Loading entry point: %s for extension %s",
                        entry_point,
                        extension_id,
                    )
                    try:
                        eager_import(entry_point)
                    except Exception as e:
                        logger.error(
                            "Failed to load entry point %s: %s",
                            entry_point,
                            e,
                            exc_info=True,
                        )
                        raise

            # Validate and register pending contributions
            self._validate_and_register_contributions(extension_id, manifest)

    def _validate_and_register_contributions(
        self, extension_id: str, manifest: Manifest
    ) -> None:
        """
        Validate pending contributions against manifest and register.

        Args:
            extension_id: Extension being validated
            manifest: Extension manifest

        Raises:
            ContributionValidationError: If undeclared contribution found
        """
        ctx = get_context()
        pending = ctx.get_pending_contributions(extension_id)
        backend_contribs = manifest.backend.contributions if manifest.backend else None

        if not pending:
            return

        # Build allowlists from manifest
        allowed_tools: set[str] = set()
        allowed_prompts: set[str] = set()
        allowed_apis: set[str] = set()

        if backend_contribs:
            allowed_tools = {t.id for t in backend_contribs.mcpTools}
            allowed_prompts = {p.id for p in backend_contribs.mcpPrompts}
            allowed_apis = {a.id for a in backend_contribs.restApis}

        for contrib in pending:
            self._validate_single_contribution(
                extension_id,
                contrib,
                allowed_tools,
                allowed_prompts,
                allowed_apis,
            )
            self._register_contribution(extension_id, contrib)

        # Clear pending after successful registration
        ctx.clear_pending_contributions(extension_id)

        logger.info(
            "Registered %d contributions for extension %s",
            len(pending),
            extension_id,
        )

    def _validate_single_contribution(
        self,
        extension_id: str,
        contrib: PendingContribution,
        allowed_tools: set[str],
        allowed_prompts: set[str],
        allowed_apis: set[str],
    ) -> None:
        """
        Validate a single contribution against the allowlist.

        Args:
            extension_id: Extension owning the contribution
            contrib: The pending contribution
            allowed_tools: Set of allowed tool IDs
            allowed_prompts: Set of allowed prompt IDs
            allowed_apis: Set of allowed API IDs

        Raises:
            ContributionValidationError: If not in allowlist
        """
        contrib_id = contrib.metadata.name
        contrib_type = contrib.contrib_type

        if contrib_type == "tool":
            if contrib_id not in allowed_tools:
                raise ContributionValidationError(
                    f"Extension '{extension_id}' attempted to register undeclared "
                    f"MCP tool '{contrib_id}'. Add it to manifest.json to allow."
                )
        elif contrib_type == "prompt":
            if contrib_id not in allowed_prompts:
                raise ContributionValidationError(
                    f"Extension '{extension_id}' attempted to register undeclared "
                    f"MCP prompt '{contrib_id}'. Add it to manifest.json to allow."
                )
        elif contrib_type == "restApi":
            if contrib_id not in allowed_apis:
                raise ContributionValidationError(
                    f"Extension '{extension_id}' attempted to register undeclared "
                    f"REST API '{contrib_id}'. Add it to manifest.json to allow."
                )

    def _register_contribution(
        self, extension_id: str, contrib: PendingContribution
    ) -> None:
        """
        Register a validated contribution.

        Args:
            extension_id: Extension owning the contribution
            contrib: The contribution to register
        """
        from superset.core.mcp.core_mcp_injection import (
            register_prompt_from_manifest,
            register_tool_from_manifest,
        )

        contrib_type = contrib.contrib_type
        contrib_id = contrib.metadata.name

        if contrib_type == "tool":
            register_tool_from_manifest(contrib.func, contrib.metadata, extension_id)
            self._contribution_registry["mcpTools"][contrib_id] = {
                "extension": extension_id,
                "func": contrib.func,
                "metadata": contrib.metadata,
            }
        elif contrib_type == "prompt":
            register_prompt_from_manifest(contrib.func, contrib.metadata, extension_id)
            self._contribution_registry["mcpPrompts"][contrib_id] = {
                "extension": extension_id,
                "func": contrib.func,
                "metadata": contrib.metadata,
            }
        elif contrib_type == "restApi":
            # REST APIs are registered through Flask-AppBuilder
            # during the extension loading process
            self._contribution_registry["restApis"][contrib_id] = {
                "extension": extension_id,
                "cls": contrib.func,
                "metadata": contrib.metadata,
            }

    def get_extension(self, extension_id: str) -> LoadedExtension | None:
        """
        Get a loaded extension by ID.

        Args:
            extension_id: Extension identifier

        Returns:
            LoadedExtension or None if not found
        """
        return self._extensions.get(extension_id)

    def get_contribution(
        self, contrib_type: str, contrib_id: str
    ) -> Callable[..., Any] | type | None:
        """
        Get a registered contribution by type and ID.

        Args:
            contrib_type: Contribution type (mcpTools, mcpPrompts, restApis)
            contrib_id: Contribution identifier

        Returns:
            The contribution function/class or None if not found
        """
        registry = self._contribution_registry.get(contrib_type, {})
        if entry := registry.get(contrib_id):
            return entry.get("func") or entry.get("cls")
        return None

    def list_contributions(self, contrib_type: str) -> list[str]:
        """
        List all registered contribution IDs of a type.

        Args:
            contrib_type: Contribution type

        Returns:
            List of contribution IDs
        """
        return list(self._contribution_registry.get(contrib_type, {}).keys())

    def list_extensions(self) -> list[str]:
        """
        List all loaded extension IDs.

        Returns:
            List of extension IDs
        """
        return list(self._extensions.keys())


# Global extension manager instance
extension_manager = ExtensionManager()
