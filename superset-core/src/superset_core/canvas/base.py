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

A canvas places widget instances. An inline instance is stored on its
placement, as a widget id, schema version and props; a persisted instance is
its own entity, referenced by UUID. The registry (``superset_core.widgets``)
describes each widget's behavior; ``InstanceResolver`` looks up persisted
instances.
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Protocol

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


class InstanceResolver(Protocol):
    """Looks up the persisted widget instances a canvas references."""

    def widget_types(self, instance_ids: Iterable[str]) -> dict[str, str]:
        """
        Return ``{instance UUID: widget id}`` for the instances that exist.

        Needed to validate nesting and layout for every placement, including
        instances the current user cannot see, so this is not filtered by
        access.
        """
        ...

    def placeable(self, instance_ids: Iterable[str]) -> set[str]:
        """The instances the current user may place on a canvas."""
        ...
