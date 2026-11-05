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

"""Input and response models for the canvas MCP tools."""

from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import (
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    model_serializer,
    SerializationInfo,
    SerializerFunctionWrapHandler,
)

from superset.canvas.definition.schemas import DraftOperationsRequest, Operation


def _keep_raw_ops(value: Any) -> Any:
    """Keep operation validation and its error response inside Canvas helpers."""
    return value


DraftOpsInput = Annotated[
    list[dict[str, Any]],
    BeforeValidator(
        _keep_raw_ops,
        json_schema_input_type=DraftOperationsRequest.model_fields[
            "ops"
        ].rebuild_annotation(),
    ),
]
InitialOpsInput = Annotated[
    list[dict[str, Any]],
    BeforeValidator(_keep_raw_ops, json_schema_input_type=list[Operation]),
]

CanvasErrorType = Literal[
    "ValidationError",
    "DraftUnavailable",
    "DraftRevisionConflict",
    "CanvasRevisionConflict",
    "WidgetRevisionConflict",
]


class _Compact(BaseModel):
    """Leaves unset (``None``) fields out of the result, so agents don't pay
    for a dozen empty keys on every call."""

    @model_serializer(mode="wrap")
    def _drop_none(
        self, handler: SerializerFunctionWrapHandler, info: SerializationInfo
    ) -> dict[str, Any]:
        return {key: value for key, value in handler(self).items() if value is not None}


class GetCanvasResponse(_Compact):
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
    widgets: dict[str, dict[str, Any]] | None = Field(
        default=None, description="The saved widgets placements hold, by UUID."
    )
    error: str | None = None


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


class CanvasWriteResponse(_Compact):
    """The result of creating or updating a canvas."""

    id: int | None = None
    url: str | None = None
    revision: int | None = None
    ops: list[dict[str, Any]] | None = Field(
        default=None, description="The initial operations applied, with their ids."
    )
    error: str | None = None
    error_type: CanvasErrorType | None = None
    current_canvas_revision: int | None = Field(
        default=None,
        description="The published canvas revision observed at a conflict.",
    )
    errors: Any | None = None
    operation: int | None = Field(
        default=None, description="Index of the initial operation that failed."
    )


class PreviewWidgetResponse(_Compact):
    placement_id: str | None = None
    widget_type: str | None = None
    row_count: int | None = Field(
        default=None, description="Rows the widget's query returned."
    )
    columns: list[str] | None = None
    sample_rows: list[dict[str, Any]] | None = Field(
        default=None, description="The first rows of the widget's query."
    )
    query: str | None = Field(
        default=None,
        description="The query that ran, as the datasource ran it; only for "
        "users who can view queries.",
    )
    query_language: str | None = None
    option: dict[str, Any] | None = Field(
        default=None,
        description=(
            "The ECharts option as rendered: bindings resolved, theme applied. "
            "Only with a renderer configured; long data arrays are shortened."
        ),
    )
    warnings: list[str] = Field(
        default_factory=list,
        description="Problems found without looking: unbound fields, empty "
        "data, tooltips or labels that would print raw objects.",
    )
    image: str | None = Field(
        default=None,
        description="Whether an image was attached, and its size.",
    )
    rendered: bool | None = Field(
        default=None, description="False when the renderer failed: not checked."
    )
    error: str | None = None


class CanvasDraftResponse(_Compact):
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
        default=None,
        description="Legacy revision: the draft revision on draft responses and "
        "draft conflicts, but the published canvas revision on canvas/widget "
        "conflicts. Prefer draft_revision and current_canvas_revision.",
    )
    draft_revision: int | None = Field(
        default=None,
        description="The draft revision observed by the command; send it with "
        "the next draft write. Omitted when the command did not load a draft.",
    )
    current_canvas_revision: int | None = Field(
        default=None,
        description="The published canvas revision observed at a conflict check; "
        "not a widget revision or a later read of the canvas.",
    )
    definition: dict[str, Any] | None = None
    ops: list[dict[str, Any]] | None = Field(
        default=None, description="The operations just applied, with ids, no props."
    )
    filter_scopes: dict[str, list[str]] | None = Field(
        default=None, alias="filterScopes"
    )
    placements: dict[str, dict[str, int]] | None = None
    grid_columns: dict[str, int] | None = None
    displaced: list[str] | None = Field(
        default=None, description="Placements pushed down without being named."
    )
    widget_types: dict[str, str] | None = Field(default=None, alias="widgetTypes")
    widgets: dict[str, dict[str, Any]] | None = Field(
        default=None, description="The saved widgets placements hold, by UUID."
    )
    changed_widgets: list[str] | None = Field(
        default=None,
        description="Commit was rejected because these widgets changed meanwhile.",
    )
    canvas_revision: int | None = Field(
        default=None,
        description="The published revision returned by a successful commit "
        "command, including an empty draft close without a published write.",
    )
    canvas_changed: bool | None = Field(
        default=None,
        description="Commit was rejected because the canvas changed meanwhile.",
    )
    error: str | None = None
    error_type: CanvasErrorType | None = None
    errors: list[dict[str, Any]] | None = None
    operation: int | None = Field(
        default=None, description="Index of the operation that failed."
    )
