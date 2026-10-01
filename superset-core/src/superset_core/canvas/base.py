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
What the dashboard canvas needs to know about widgets.

The canvas places widgets; it never stores or reads their configuration.
Widgets are their own entities, referenced from canvas nodes by id. The canvas
asks two things of the widget side:

- ``CanvasLayoutRules``, declared per widget type: whether the type holds
  child nodes, which types may nest where, and how its children are laid out.
  Types without registered rules are leaves.
- ``WidgetResolver``: the type of each referenced widget, so nesting and
  layout can be validated, and which widgets the current user may place.
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import ClassVar, Protocol

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


class CanvasLayoutRules:
    """
    How a widget type behaves on the canvas.

    A container sets ``is_container`` and either ``grid_columns`` (children
    are placed with ``GridPlacement`` on a grid of that many columns) or
    ``child_layout_model`` (children's layout is validated against that model
    and arranged by the container's renderer).
    """

    widget_type: ClassVar[str]
    is_container: ClassVar[bool] = False
    # Child widget types this container accepts; ``None`` accepts any.
    accepted_children: ClassVar[frozenset[str] | None] = None
    # Container types this widget may live under; ``None`` allows any
    # container that accepts it, including the root.
    allowed_parents: ClassVar[frozenset[str] | None] = None
    grid_columns: ClassVar[int | None] = None
    child_layout_model: ClassVar[type[BaseModel] | None] = None

    # Filters, cross-filter sources and customizations (e.g. dynamic group-by)
    # drive filterable widgets. By default each drives every filterable widget
    # under its nearest container that bounds filter scope (or the whole canvas
    # at the root), never itself; the canvas can override that per node. A
    # container that does not bound scope, e.g. a filter bar, lets its
    # children reach further up.
    is_filter: ClassVar[bool] = False
    is_cross_filter_source: ClassVar[bool] = False
    is_customization: ClassVar[bool] = False
    is_filterable: ClassVar[bool] = False
    bounds_filter_scope: ClassVar[bool] = True

    # Size limits, in grid units, for this widget when its parent is a grid.
    min_col_span: ClassVar[int | None] = None
    max_col_span: ClassVar[int | None] = None
    min_row_span: ClassVar[int | None] = None
    max_row_span: ClassVar[int | None] = None


class WidgetResolver(Protocol):
    """Looks up the widgets a canvas references."""

    def widget_types(self, widget_ids: Iterable[str]) -> dict[str, str]:
        """
        Return ``{widget id: widget type}`` for the widgets that exist.

        Types are needed to validate nesting and layout for every node,
        including widgets the current user cannot see, so this is not
        filtered by access.
        """
        ...

    def placeable(self, widget_ids: Iterable[str]) -> set[str]:
        """The widgets the current user may place on a canvas."""
        ...
