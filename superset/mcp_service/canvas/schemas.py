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

"""Response models for the canvas MCP tools."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class GetCanvasResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: int | None = None
    title: str | None = None
    url: str | None = None
    revision: int | None = None
    definition: dict[str, Any] | None = None
    filter_scopes: dict[str, list[str]] | None = Field(
        default=None, alias="filterScopes"
    )
    cross_filter_scopes: dict[str, list[str]] | None = Field(
        default=None, alias="crossFilterScopes"
    )
    customization_scopes: dict[str, list[str]] | None = Field(
        default=None, alias="customizationScopes"
    )
    placements: dict[str, dict[str, int]] | None = None
    widget_types: dict[str, str] | None = Field(default=None, alias="widgetTypes")
    grid_columns: dict[str, int] | None = Field(default=None, alias="gridColumns")
    error: str | None = None


class ApplyCanvasOpsResponse(BaseModel):
    revision: int | None = Field(
        default=None, description="The canvas revision after the write."
    )
    ops: list[dict[str, Any]] | None = Field(
        default=None, description="The applied operations; adds carry their ids."
    )
    error: str | None = None
    errors: list[dict[str, Any]] | None = None
    operation: int | None = Field(
        default=None, description="Index of the operation that failed."
    )
    conflicts: list[str] | None = Field(
        default=None, description="Placements changed by others since base_revision."
    )
    stale: bool | None = Field(
        default=None, description="Reload the canvas: base_revision is too old."
    )


class CanvasSummary(BaseModel):
    id: int
    title: str
    slug: str | None = None
    url: str
    revision: int
    description: str | None = None
    changed_on: str | None = None


class ListCanvasesResponse(BaseModel):
    canvases: list[CanvasSummary] = Field(default_factory=list)
    count: int = 0
    error: str | None = None


class CanvasWriteResponse(BaseModel):
    """The result of creating or updating a canvas."""

    id: int | None = None
    url: str | None = None
    revision: int | None = None
    ops: list[dict[str, Any]] | None = Field(
        default=None, description="The initial operations applied, with their ids."
    )
    error: str | None = None
    errors: Any | None = None
    operation: int | None = Field(
        default=None, description="Index of the initial operation that failed."
    )


class CanvasDraftResponse(BaseModel):
    """A canvas draft, or the result of a write to one."""

    model_config = ConfigDict(populate_by_name=True)

    token: str | None = Field(
        default=None,
        description="The draft's token; pass it to the other draft tools.",
    )
    canvas_id: int | None = None
    url: str | None = Field(
        default=None,
        description="Where the person can open the draft in the browser.",
    )
    base_revision: int | None = Field(
        default=None, description="The canvas revision the draft started from."
    )
    revision: int | None = Field(
        default=None, description="The draft's revision; send it with the next write."
    )
    definition: dict[str, Any] | None = None
    ops: list[dict[str, Any]] | None = Field(
        default=None, description="The operations just applied, with their ids."
    )
    filter_scopes: dict[str, list[str]] | None = Field(
        default=None, alias="filterScopes"
    )
    placements: dict[str, dict[str, int]] | None = None
    widget_types: dict[str, str] | None = Field(default=None, alias="widgetTypes")
    canvas_revision: int | None = Field(
        default=None, description="The canvas revision after a commit."
    )
    canvas_changed: bool | None = Field(
        default=None,
        description="Commit was rejected because the canvas changed meanwhile.",
    )
    error: str | None = None
    errors: list[dict[str, Any]] | None = None
    operation: int | None = Field(
        default=None, description="Index of the operation that failed."
    )
