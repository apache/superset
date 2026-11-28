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

"""Classify compatibility failures without exposing provider diagnostics."""

import logging
from typing import Literal

from fastmcp import Context

from superset.mcp_service.semantic_layer.schemas import SemanticLayerError
from superset.semantic_layers.dimension_resolution import (
    AmbiguousDimensionError,
    GrainSelectionError,
)
from superset.semantic_layers.exceptions import (
    configuration_recovery_message,
    SemanticLayerConfigurationError,
)

logger: logging.Logger = logging.getLogger(__name__)


async def compatibility_error_response(
    error: Exception,
    ctx: Context,
    member: Literal["metrics", "dimensions"],
) -> SemanticLayerError:
    """Preserve safe host signals while keeping unknown failure text private."""
    if isinstance(error, SemanticLayerConfigurationError):
        return SemanticLayerError.create(
            error=configuration_recovery_message(),
            error_type="SemanticViewConfigurationError",
        )
    if isinstance(error, AmbiguousDimensionError):
        return SemanticLayerError.create(error=str(error), error_type="ValidationError")
    if isinstance(error, GrainSelectionError):
        return SemanticLayerError.create(
            error="Invalid dimension grain selection.", error_type="ValidationError"
        )
    logger.exception("Unexpected compatibility error: %s", type(error).__name__)
    message: str = f"Unable to retrieve compatible {member}."
    await ctx.error(message)
    return SemanticLayerError.create(error=message, error_type="InternalError")
