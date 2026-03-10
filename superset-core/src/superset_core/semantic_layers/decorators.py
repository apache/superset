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
Semantic layer registration decorator for Superset.

This module provides a decorator interface to register semantic layer
implementations with the host application, enabling automatic discovery
by the extensions framework.

Usage:
    from superset_core.semantic_layers.decorators import semantic_layer

    @semantic_layer(
        id="snowflake",
        name="Snowflake Cortex",
        description="Snowflake semantic layer via Cortex Analyst",
    )
    class SnowflakeSemanticLayer(SemanticLayer[SnowflakeConfig, SnowflakeView]):
        ...

    # Or with minimal arguments:
    @semantic_layer(id="dbt", name="dbt Semantic Layer")
    class DbtSemanticLayer(SemanticLayer[DbtConfig, DbtView]):
        ...
"""

from __future__ import annotations

from typing import Any, Callable, TypeVar

from superset_core.semantic_layers.layer import SemanticLayer

# Type variable for decorated semantic layer classes
T = TypeVar("T", bound=type[SemanticLayer[Any, Any]])


def semantic_layer(
    id: str,
    name: str,
    description: str | None = None,
) -> Callable[[T], T]:
    """
    Decorator to register a semantic layer implementation.

    Automatically detects extension context and applies appropriate
    namespacing to prevent ID conflicts between host and extension
    semantic layers.

    Host implementations will replace this function during initialization
    with a concrete implementation providing actual functionality.

    Args:
        id: Unique semantic layer type identifier (e.g., "snowflake",
            "dbt"). Used as the key in the semantic layers registry and
            stored in the ``type`` column of the ``SemanticLayer`` model.
        name: Human-readable display name (e.g., "Snowflake Cortex").
            Shown in the UI when listing available semantic layer types.
        description: Optional description for documentation and UI
            tooltips.

    Returns:
        Decorated semantic layer class registered with the host
        application.

    Raises:
        NotImplementedError: If called before host implementation is
            initialized.

    Example:
        from superset_core.semantic_layers.decorators import semantic_layer
        from superset_core.semantic_layers.layer import SemanticLayer

        @semantic_layer(
            id="snowflake",
            name="Snowflake Cortex",
            description="Connect to Snowflake Cortex Analyst",
        )
        class SnowflakeSemanticLayer(
            SemanticLayer[SnowflakeConfig, SnowflakeView]
        ):
            ...
    """
    raise NotImplementedError(
        "Semantic layer decorator not initialized. "
        "This decorator should be replaced during Superset startup."
    )


__all__ = ["semantic_layer"]
