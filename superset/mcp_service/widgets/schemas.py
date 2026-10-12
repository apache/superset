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

"""Response models for the widget MCP tools."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class WidgetTypeInfo(BaseModel):
    id: str
    name: str
    description: str
    canvas: dict[str, Any] | None = Field(
        default=None,
        description=(
            "How the type takes part in a canvas: whether it is a container, "
            "which children and parents it allows, its filter roles and its "
            "default size in grid columns and rows. Only non-default facts "
            "are listed."
        ),
    )


class ListWidgetTypesResponse(BaseModel):
    widget_types: list[WidgetTypeInfo]


class WidgetControlSchemaResponse(BaseModel):
    control_schema: dict[str, Any] | None = Field(
        default=None,
        description="The minimum viable root schema, when no paths were given.",
    )
    subtrees: dict[str, Any] | None = Field(
        default=None, description="The requested branches, keyed by path."
    )
    error: dict[str, Any] | None = None
    valid_widget_types: list[str] | None = None
