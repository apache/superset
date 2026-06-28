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
Pydantic schemas for explore-related MCP tool outputs.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from superset.mcp_service.common.error_schemas import ChartGenerationError


class GenerateExploreLinkResponse(BaseModel):
    """
    Output schema for the generate_explore_link tool.

    On success, ``url`` is a fully-qualified Superset Explore URL that the
    user can open immediately, and ``form_data_key`` can be used to
    reconstruct or share the same configuration. On failure, ``url`` is
    empty and ``error`` is a ``ChartGenerationError``; its ``error_type``
    distinguishes ``dataset_not_found``, ``permission_denied``,
    ``validation_error``, and ``generation_failed`` so callers can branch
    on failure mode without parsing free-text messages.
    """

    url: str = Field(
        ...,
        description=(
            "Explore URL — open in a browser to view the interactive chart. "
            "Empty string on failure."
        ),
    )
    form_data: dict[str, Any] = Field(
        default_factory=dict,
        description="Raw Superset form_data dict that was encoded into the URL.",
    )
    permalink_key: str | None = Field(
        None,
        description=(
            "Durable permalink key for the generated Explore URL, when one "
            "was created. Prefer this over ``form_data_key`` for sharing; it "
            "survives cache eviction. Null on failure or when only an "
            "ephemeral form_data key is available."
        ),
    )
    form_data_key: str | None = Field(
        None,
        description=(
            "Short, ephemeral cache key that represents this form_data "
            "configuration. Populated only when no ``permalink_key`` is "
            "available. Can be passed to the Explore UI as ?form_data_key=<key>."
        ),
    )
    chart_type_label: str | None = Field(
        None,
        description=(
            "Human-readable label for the resulting chart type "
            "(e.g. 'table chart', 'interactive table chart'). "
            "Null on failure or when the viz_type has no specific label."
        ),
    )
    error: ChartGenerationError | None = Field(
        None,
        description=(
            "Structured ChartGenerationError when generation fails, else "
            "null. Branch on error.error_type to handle specific failure "
            "modes (dataset_not_found, permission_denied, validation_error, "
            "generation_failed)."
        ),
    )
    success: bool = Field(
        True,
        description="True when a valid URL was produced, False on any error.",
    )
