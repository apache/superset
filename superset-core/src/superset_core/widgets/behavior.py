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
How a widget takes part in a canvas, and how the UI presents it.

Declared once per widget as ``behavior`` and ``ui`` class attributes; the
canvas reads them to validate nesting and child layout, and to resolve which
widgets each filter, cross-filter source and customization drives.
"""

from __future__ import annotations

from dataclasses import dataclass

from pydantic import BaseModel


@dataclass(frozen=True)
class WidgetBehavior:
    """
    A container sets ``container`` and either ``grid_columns`` (children are
    placed on a grid of that many columns) or ``child_layout_model`` (each
    child's layout is validated against that model and arranged by the
    container's renderer).

    By default a filter, cross-filter source or customization drives every
    filterable widget under its nearest container that bounds filter scope (or
    the whole canvas), never itself; a canvas can override that per placement.
    A container that doesn't bound scope, such as a filter bar, lets its
    children reach further up.
    """

    container: bool = False
    # Child widget ids this container accepts; ``None`` accepts any.
    accepted_children: frozenset[str] | None = None
    # Container widget ids this widget may live under; ``None`` allows any
    # container that accepts it, including the canvas root.
    allowed_parents: frozenset[str] | None = None
    grid_columns: int | None = None
    child_layout_model: type[BaseModel] | None = None
    bounds_filter_scope: bool = True

    # Sets runtime filters for the widgets in its scope.
    filter: bool = False
    # Emits cross-filters when clicked (a cross-filter source).
    emits_filters: bool = False
    # Changes how the widgets in its scope query, e.g. a dynamic group-by.
    customization: bool = False
    # Receives runtime filters.
    filterable: bool = False
    drill: bool = False

    def errors(self) -> list[str]:
        """Inconsistencies in this declaration, checked at registration."""
        errors = []
        if not self.container:
            if self.accepted_children is not None:
                errors.append("only a container can declare accepted_children")
            if self.grid_columns is not None or self.child_layout_model is not None:
                errors.append("only a container can declare a child layout")
        elif self.grid_columns is not None and self.child_layout_model is not None:
            errors.append("declare grid_columns or child_layout_model, not both")
        if self.grid_columns is not None and self.grid_columns < 1:
            errors.append("grid_columns must be at least 1")
        return errors


@dataclass(frozen=True)
class WidgetUi:
    """Presentation metadata; sizes are in grid units of the parent grid."""

    # (colSpan, rowSpan) for a new placement.
    default_size: tuple[int, int] | None = None
    min_col_span: int | None = None
    max_col_span: int | None = None
    min_row_span: int | None = None
    max_row_span: int | None = None
