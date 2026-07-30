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
"""Pydantic request/response schemas for the canvas MCP tools."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class GetCanvasSchemaRequest(BaseModel):
    """No arguments — returns the static CDL contract."""


class GetCanvasSchemaResponse(BaseModel):
    cdl_schema: dict[str, Any] = Field(
        ..., description="The CDL contract to author a canvas against."
    )


class GenerateCanvasRequest(BaseModel):
    name: str = Field(..., description="Human-readable canvas title.")
    definition: dict[str, Any] = Field(
        ...,
        description=(
            "The full CDL tree ({cdlVersion, variables, tree}). "
            "Call get_canvas_schema first for the contract."
        ),
    )


class CanvasInfo(BaseModel):
    id: int
    name: str
    url: str
    uuid: str | None = None


class GetCanvasRequest(BaseModel):
    identifier: int | str = Field(..., description="Canvas id or uuid.")


class GetCanvasResponse(BaseModel):
    canvas: CanvasInfo | None = None
    definition: dict[str, Any] | None = Field(
        default=None, description="The stored CDL tree — read node ids from here."
    )
    error: str | None = None


class CanvasPatchOp(BaseModel):
    """A single targeted edit addressed by node id."""

    op: Literal[
        "setStyle", "setProps", "setOption", "move", "replace", "insert", "remove"
    ] = Field(..., description="The edit to perform.")
    id: str = Field(
        ...,
        description=(
            "Target node id. For 'insert' this is the PARENT node to insert into."
        ),
    )
    style: dict[str, Any] | None = Field(
        default=None, description="setStyle: style object to apply."
    )
    props: dict[str, Any] | None = Field(
        default=None, description="setProps: props to apply."
    )
    option: dict[str, Any] | None = Field(
        default=None, description="setOption: echarts option to apply (Viz nodes)."
    )
    node: dict[str, Any] | None = Field(
        default=None, description="replace/insert: the full node object."
    )
    parent: str | None = Field(
        default=None,
        description="move: id of the new parent (defaults to the current parent).",
    )
    before: str | None = Field(
        default=None, description="move/insert: place before this sibling id."
    )
    after: str | None = Field(
        default=None, description="move/insert: place after this sibling id."
    )
    index: int | None = Field(
        default=None, description="move/insert: explicit position among children."
    )
    merge: bool = Field(
        default=True,
        description=(
            "setStyle/setProps/setOption: merge into the existing object (True) "
            "or replace it wholesale (False)."
        ),
    )


class UpdateCanvasRequest(BaseModel):
    identifier: int | str = Field(..., description="Canvas id or uuid.")
    ops: list[CanvasPatchOp] = Field(
        ..., description="Ordered patch operations, applied in sequence."
    )
    name: str | None = Field(default=None, description="Optionally rename the canvas.")


class UpdateCanvasResponse(BaseModel):
    canvas: CanvasInfo | None = None
    canvas_url: str | None = None
    applied_ops: int | None = None
    error: str | None = None
    validation_errors: list[str] | None = Field(
        default=None,
        description="Patch or CDL failures — nothing was saved; fix and retry.",
    )


class GenerateCanvasResponse(BaseModel):
    canvas: CanvasInfo | None = None
    canvas_url: str | None = None
    error: str | None = None
    validation_errors: list[str] | None = Field(
        default=None,
        description="CDL validation failures — fix these and retry.",
    )
    warnings: list[str] | None = None
