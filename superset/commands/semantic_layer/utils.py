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
"""Shared validation for semantic layer configuration commands."""

from __future__ import annotations

import logging
from typing import Any

from pydantic import ValidationError
from superset_core.semantic_layers.layer import SemanticLayer

from superset.commands.semantic_layer.exceptions import SemanticLayerInvalidError

logger: logging.Logger = logging.getLogger(__name__)


def validate_configuration(
    layer_class: type[SemanticLayer[Any, Any]], configuration: dict[str, Any]
) -> None:
    """Validate provider configuration without exposing values in error traces."""
    try:
        layer_class.from_configuration(configuration)
    except ValidationError as ex:
        # Messages and context can contain credentials even when input is omitted.
        # Retain only structural paths and error codes, never the original cause.
        details: str = "; ".join(
            f"{'.'.join(map(str, error['loc'])) or '<root>'}: {error['type']}"
            for error in ex.errors(
                include_input=False, include_url=False, include_context=False
            )
        )
        raise SemanticLayerInvalidError(f"Invalid configuration: {details}") from None
    except Exception as ex:  # pylint: disable=broad-except
        # A provider may interpolate the restored credential into a
        # non-pydantic error; never let one reach an exc_info log sink.
        logger.warning(
            "Semantic layer provider %s rejected configuration: %s",
            getattr(layer_class, "__name__", "unknown"),
            type(ex).__name__,
        )
        raise SemanticLayerInvalidError("Provider rejected the configuration") from None
