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

A canvas is a tree of placements: a flat ``nodes`` map keyed by placement id,
with the tree expressed through ``children`` id lists. A placement shows one
widget instance, either persisted (referenced by UUID) or inline (its widget,
schema version and props stored on the placement), and holds its layout; its
filter scope lives in ``interactions``. The root is not a node: it always
exists, is always a grid, and is addressed as ``"root"`` in operations.
"""

from __future__ import annotations

from enum import Enum
from typing import Annotated, Any, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel

DEFINITION_VERSION = 1
ROOT_ID = "root"
# Stands in for the settings in the operation log; never a placement id.
SETTINGS_ID = "settings"
# Placement ids are readable slugs, unique within a canvas, e.g.
# ``revenue-trend``; agents read and write them far more cheaply than UUIDs.
NODE_ID_PATTERN = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"
NODE_ID_MAX_LENGTH = 64
RESERVED_IDS = frozenset({ROOT_ID, SETTINGS_ID})

NodeId = Annotated[str, Field(pattern=NODE_ID_PATTERN, max_length=NODE_ID_MAX_LENGTH)]


class _Model(BaseModel):
    model_config = ConfigDict(
        extra="forbid", alias_generator=to_camel, populate_by_name=True
    )


class RootLayout(_Model):
    columns: int = Field(default=24, ge=1)
    gap: int = Field(default=16, ge=0)
    row_unit: int = Field(default=40, ge=1)


class Root(_Model):
    layout: RootLayout = Field(default_factory=RootLayout)
    children: list[str] = Field(default_factory=list)


class Node(_Model):
    """
    A placement: a persisted widget by UUID (``widgetId``), or an inline
    instance of a widget type (``widgetType``, ``schemaVersion``, ``props``).
    """

    widget_id: str | None = Field(default=None, min_length=1)
    widget_type: str | None = Field(default=None, min_length=1)
    # The widget type's schema version ``props`` conform to.
    schema_version: int | None = Field(default=None, ge=1)
    # Explicitly set values only; defaults come from the widget's schema.
    props: dict[str, Any] | None = None
    # Placement within the parent, validated against the parent's rules.
    layout: dict[str, Any] = Field(default_factory=dict)
    # Present only when the widget is a container.
    children: list[str] | None = None

    @model_validator(mode="after")
    def _one_instance(self) -> Node:
        if (self.widget_id is None) == (self.widget_type is None):
            raise ValueError("a placement takes either widgetId or widgetType")
        if self.widget_id is not None:
            if self.schema_version is not None or self.props is not None:
                raise ValueError(
                    "a persisted widget's schemaVersion and props live with the widget"
                )
        elif self.schema_version is None:
            raise ValueError("an inline instance needs its schemaVersion")
        elif self.props is None:
            self.props = {}
        return self


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


ScopeKind = Literal["filter", "crossFilter", "customization"]

# Where each kind's scope overrides live in ``interactions``.
SCOPE_FIELDS: dict[str, str] = {
    "filter": "filters",
    "crossFilter": "crossFilters",
    "customization": "customizations",
}


class Interactions(_Model):
    # Scope overrides by node id, per kind. Nodes without one use auto scope.
    filters: dict[str, FilterScope] = Field(default_factory=dict)
    cross_filters: dict[str, FilterScope] = Field(default_factory=dict)
    customizations: dict[str, FilterScope] = Field(default_factory=dict)


class RefreshSettings(_Model):
    # Seconds between automatic refreshes of every widget's data; 0 is off.
    interval: int = Field(default=0, ge=0)
    # Milliseconds a refresh is spread over across widgets; 0 refreshes all at
    # once.
    stagger: int = Field(default=0, ge=0)
    # Nodes left out of automatic refresh.
    exempt: list[str] = Field(default_factory=list)


class ColorSettings(_Model):
    # Categorical color scheme shared by every widget; the default when unset.
    scheme: str | None = Field(default=None, min_length=1, max_length=255)
    # Fixed colors for series labels across widgets, e.g. {"France": "#1f77b4"}.
    label_colors: dict[str, str] = Field(default_factory=dict)


class DisplaySettings(_Model):
    # Show when each widget's data was last refreshed.
    show_timestamps: bool = False


class CrossFilterSettings(_Model):
    # Whether clicking a cross-filter source filters other widgets.
    enabled: bool = True


class Settings(_Model):
    refresh: RefreshSettings = Field(default_factory=RefreshSettings)
    colors: ColorSettings = Field(default_factory=ColorSettings)
    display: DisplaySettings = Field(default_factory=DisplaySettings)
    cross_filters: CrossFilterSettings = Field(default_factory=CrossFilterSettings)


SettingsKey = Literal["refresh", "colors", "display", "crossFilters"]


class CanvasDefinition(_Model):
    version: Literal[1] = 1
    root: Root = Field(default_factory=Root)
    nodes: dict[NodeId, Node] = Field(default_factory=dict)
    interactions: Interactions = Field(default_factory=Interactions)
    settings: Settings = Field(default_factory=Settings)

    @model_validator(mode="after")
    def _no_reserved_ids(self) -> CanvasDefinition:
        if reserved := RESERVED_IDS.intersection(self.nodes):
            raise ValueError(f"reserved placement ids: {sorted(reserved)}")
        return self


def empty_definition() -> dict[str, Any]:
    return CanvasDefinition().model_dump(mode="json", by_alias=True, exclude_none=True)


class AddOp(_Model):
    """
    Place a persisted widget (``widgetId``) or a new inline instance
    (``widgetType`` and ``props``) under ``parent``; how a committed draft of a
    new inline instance lands on a canvas.

    The placement id is the caller's ``id`` when given, so later operations in
    the same request can reference it; otherwise the server derives one from
    the widget's name. Inline props are stored at the widget's current schema
    version.
    """

    op: Literal["add"]
    id: NodeId | None = None
    widget_id: str | None = Field(default=None, min_length=1)
    widget_type: str | None = Field(default=None, min_length=1)
    props: dict[str, Any] | None = None
    # The schema version ``props`` were written at, e.g. by a draft; older
    # props are migrated. Defaults to the widget's current version.
    schema_version: int | None = Field(default=None, ge=1)
    layout: dict[str, Any] = Field(default_factory=dict)
    parent: str = ROOT_ID
    # Position in the parent's children (reading order); appended when omitted.
    index: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def _one_instance(self) -> AddOp:
        if (self.widget_id is None) == (self.widget_type is None):
            raise ValueError("add takes either widgetId or widgetType")
        if self.widget_id is not None and (
            self.props is not None or self.schema_version is not None
        ):
            raise ValueError("props are only for an inline widget type")
        if self.id in RESERVED_IDS:
            raise ValueError(f"{self.id!r} is reserved")
        return self


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


class SetPropsOp(_Model):
    """
    Replace an inline instance's props, stored at its widget's current schema
    version; how a committed draft of an inline instance is written back.
    """

    op: Literal["set_props"]
    id: str
    props: dict[str, Any]
    # As on ``add``: older props are migrated to the current version.
    schema_version: int | None = Field(default=None, ge=1)


class SetScopeOp(_Model):
    """
    Override which widgets a filter, cross-filter source or customization
    drives; ``scope: null`` restores auto.
    """

    op: Literal["set_scope"]
    kind: ScopeKind
    id: str
    scope: FilterScope | None


class SetSettingsOp(_Model):
    """Replace one section of the canvas settings; ``value: null`` resets it."""

    op: Literal["set_settings"]
    key: SettingsKey
    value: dict[str, Any] | None


Operation = Annotated[
    Union[AddOp, RemoveOp, MoveOp, PlaceOp, SetPropsOp, SetScopeOp, SetSettingsOp],
    Field(discriminator="op"),
]


class ApplyOperationsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # The revision the caller's view of the canvas is based on.
    base_revision: int = Field(ge=0)
    ops: list[Operation] = Field(min_length=1)
