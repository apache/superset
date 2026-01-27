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
Semantic layer registry.

This module provides a registry for semantic layer implementations that can be
populated from:
1. Standard Python entry points (for pip-installed packages)
2. Superset extensions (for .supx bundles)
"""

from __future__ import annotations

import logging
from importlib.metadata import entry_points
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from superset.semantic_layers.types import SemanticLayerImplementation

logger = logging.getLogger(__name__)

ENTRY_POINT_GROUP = "superset.semantic_layers"

# Registry mapping semantic layer type names to implementation classes
_semantic_layer_registry: dict[str, type[SemanticLayerImplementation]] = {}
_initialized_from_entry_points = False


def _init_from_entry_points() -> None:
    """
    Pre-populate the registry from installed packages' entry points.

    This is called lazily on first access to ensure all packages are loaded.
    """
    global _initialized_from_entry_points
    if _initialized_from_entry_points:
        return

    for ep in entry_points(group=ENTRY_POINT_GROUP):
        if ep.name not in _semantic_layer_registry:
            try:
                _semantic_layer_registry[ep.name] = ep.load()
                logger.info(
                    "Registered semantic layer '%s' from entry point %s",
                    ep.name,
                    ep.value,
                )
            except Exception:
                logger.exception(
                    "Failed to load semantic layer '%s' from entry point %s",
                    ep.name,
                    ep.value,
                )

    _initialized_from_entry_points = True


def register_semantic_layer(
    name: str,
    cls: type[SemanticLayerImplementation],
) -> None:
    """
    Register a semantic layer implementation.

    This is called by extensions to register their semantic layer implementations.

    Args:
        name: The type name for the semantic layer (e.g., "snowflake")
        cls: The implementation class
    """
    if name in _semantic_layer_registry:
        logger.warning(
            "Semantic layer '%s' already registered, overwriting with %s",
            name,
            cls,
        )
    _semantic_layer_registry[name] = cls
    logger.info("Registered semantic layer '%s' from extension: %s", name, cls)


def get_semantic_layer(name: str) -> type[SemanticLayerImplementation]:
    """
    Get a semantic layer implementation by name.

    Args:
        name: The type name for the semantic layer (e.g., "snowflake")

    Returns:
        The implementation class

    Raises:
        KeyError: If no implementation is registered for the given name
    """
    _init_from_entry_points()

    if name not in _semantic_layer_registry:
        available = ", ".join(_semantic_layer_registry.keys()) or "(none)"
        raise KeyError(
            f"No semantic layer implementation registered for type '{name}'. "
            f"Available types: {available}"
        )

    return _semantic_layer_registry[name]


def get_registered_semantic_layers() -> dict[str, type[SemanticLayerImplementation]]:
    """
    Get all registered semantic layer implementations.

    Returns:
        A dictionary mapping type names to implementation classes
    """
    _init_from_entry_points()
    return dict(_semantic_layer_registry)
