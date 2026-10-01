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
The dashboard canvas and the operations that change it.

A canvas is where a dashboard's widgets sit: a flat ``nodes`` map keyed by
UUID node ids, with the tree expressed through ``children`` id lists.
A node references a widget by id and holds only its placement; widget
configuration lives with the widget. The root is not a node: it always
exists, is always a grid, and is addressed as ``"root"`` in operations.
"""

from __future__ import annotations

from enum import Enum
from typing import Annotated, Any, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel

DEFINITION_VERSION = 1
ROOT_ID = "root"
# Caller-chosen node ids must be canonical lowercase UUIDs, like the ones the
# server generates, so every reference to a node spells it the same way.
NODE_ID_PATTERN = r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"


class _Model(BaseModel):
    model_config = ConfigDict(
        extra="forbid", alias_generator=to_camel, populate_by_name=True
    )


class RootLayout(_Model):
    columns: int = Field(default=24, ge=1, le=48)
    gap: int = Field(default=16, ge=0, le=64)
    row_unit: int = Field(default=40, ge=8, le=400)


class Root(_Model):
    layout: RootLayout = Field(default_factory=RootLayout)
    children: list[str] = Field(default_factory=list)


class Node(_Model):
    # Id of the placed widget.
    widget: str = Field(min_length=1, max_length=64)
    # Placement within the parent, validated against the parent's rules.
    layout: dict[str, Any] = Field(default_factory=dict)
    # Present only when the widget is a container.
    children: list[str] | None = None


class FilterScopeMode(str, Enum):
    # Filterable widgets under the filter's nearest scoping container.
    AUTO = "auto"
    # Every filterable widget on the canvas.
    GLOBAL = "global"
    # Exactly the listed nodes.
    CUSTOM = "custom"


class FilterScope(_Model):
    mode: FilterScopeMode = FilterScopeMode.AUTO
    # Nodes a custom scope drives.
    targets: list[str] = Field(default_factory=list)
    # Nodes left out of an auto or global scope.
    exclude: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def _targets_match_mode(self) -> FilterScope:
        # A custom scope may end up with no targets once they are removed; the
        # filter then drives nothing rather than silently falling back to auto.
        if self.mode == FilterScopeMode.CUSTOM:
            if self.exclude:
                raise ValueError("a custom scope takes targets, not exclude")
        elif self.targets:
            raise ValueError(f"an {self.mode.value} scope takes exclude, not targets")
        return self


class Interactions(_Model):
    # Scope overrides, by filter node id. Filters without one use auto scope.
    filters: dict[str, FilterScope] = Field(default_factory=dict)


class CanvasDefinition(_Model):
    version: Literal[1] = 1
    root: Root = Field(default_factory=Root)
    nodes: dict[str, Node] = Field(default_factory=dict)
    interactions: Interactions = Field(default_factory=Interactions)


def empty_definition() -> dict[str, Any]:
    return CanvasDefinition().model_dump(mode="json", by_alias=True, exclude_none=True)


class AddOp(_Model):
    """
    Place a widget under ``parent``.

    The node id is the caller's ``id`` when given, so later operations in the
    same request can reference the new node; otherwise the server assigns one.
    """

    op: Literal["add"]
    id: str | None = Field(default=None, pattern=NODE_ID_PATTERN)
    widget: str = Field(min_length=1, max_length=64)
    layout: dict[str, Any] = Field(default_factory=dict)
    parent: str = ROOT_ID
    # Position in the parent's children (reading order); appended when omitted.
    index: int | None = Field(default=None, ge=0)


class RemoveOp(_Model):
    """Remove a node and its whole subtree from the canvas."""

    op: Literal["remove"]
    id: str


class MoveOp(_Model):
    """Reparent or reorder a node, optionally with a new layout."""

    op: Literal["move"]
    id: str
    parent: str
    index: int | None = Field(default=None, ge=0)
    # Required when the new parent lays children out differently.
    layout: dict[str, Any] | None = None


class PlaceOp(_Model):
    """Replace a node's layout within its current parent (drag/resize)."""

    op: Literal["place"]
    id: str
    layout: dict[str, Any]


class SetFilterScopeOp(_Model):
    """Override which widgets a filter drives; ``scope: null`` restores auto."""

    op: Literal["set_filter_scope"]
    id: str
    scope: FilterScope | None


Operation = Annotated[
    Union[AddOp, RemoveOp, MoveOp, PlaceOp, SetFilterScopeOp],
    Field(discriminator="op"),
]


class ApplyOperationsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # The revision the caller's view of the canvas is based on.
    base_revision: int = Field(ge=0)
    ops: list[Operation] = Field(min_length=1, max_length=200)
