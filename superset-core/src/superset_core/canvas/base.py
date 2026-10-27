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
What a canvas needs from the widget side beyond the widget registry.

A canvas places widgets. Structural widgets (containers and text) are part of
the canvas and stored on their placement, as a widget type, schema version and
props; every other widget is its own entity (a ``widgets`` row), referenced by
UUID. The widget type registry (``superset_core.widgets``) describes each
type's behavior; ``WidgetResolver`` looks up the widget entities.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass, field
from typing import Any, Protocol

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel


class GridPlacement(BaseModel):
    """
    A child's placement on a grid, in 1-based grid units.

    ``col``/``row`` are set together for an explicit position, or both omitted
    to auto-place the child in reading order. Spans default to the full grid
    width and one row.
    """

    model_config = ConfigDict(
        extra="forbid", alias_generator=to_camel, populate_by_name=True
    )

    col: int | None = Field(default=None, ge=1)
    row: int | None = Field(default=None, ge=1)
    col_span: int | None = Field(default=None, ge=1)
    row_span: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def _col_and_row_together(self) -> GridPlacement:
        if (self.col is None) != (self.row is None):
            raise ValueError("col and row must be set together or both omitted")
        return self


@dataclass
class StoredWidget:
    """A widget entity's content, as a canvas renders and edits it."""

    widget_type: str
    schema_version: int
    name: str
    props: dict[str, Any] = field(default_factory=dict)
    # The stored revision; ``None`` for a widget not saved yet.
    revision: int | None = None


class WidgetResolver(Protocol):
    """Looks up the widget entities a canvas references."""

    def widget_types(self, widget_ids: Iterable[str]) -> dict[str, str]:
        """
        Return ``{widget UUID: widget type}`` for the widgets that exist.

        Needed to validate nesting and layout for every placement, including
        widgets the current user cannot see, so this is not filtered by
        access.
        """
        ...

    def placeable(self, widget_ids: Iterable[str]) -> set[str]:
        """The widgets the current user may place on a canvas."""
        ...

    def widgets(self, widget_ids: Iterable[str]) -> dict[str, StoredWidget]:
        """
        Return ``{widget UUID: content}`` for the widgets that exist.

        Not filtered by access: a canvas grants read access to the widgets it
        places, as a dashboard does to its charts.
        """
        ...

    def editable(self, widget_ids: Iterable[str]) -> set[str]:
        """The widgets the current user may change."""
        ...
