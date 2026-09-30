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
from __future__ import annotations

from collections.abc import Callable, Iterable
from typing import Any

from pydantic import BaseModel, ConfigDict, TypeAdapter
from superset_core.canvas import CanvasLayoutRules

from superset.canvas.definition.registry import LayoutRulesRegistry
from superset.canvas.definition.schemas import Operation


class GroupRules(CanvasLayoutRules):
    widget_type = "group"
    is_container = True
    grid_columns = 12


class TabsRules(CanvasLayoutRules):
    widget_type = "tabs"
    is_container = True
    accepted_children = frozenset({"tab"})


class TabRules(CanvasLayoutRules):
    widget_type = "tab"
    is_container = True
    allowed_parents = frozenset({"tabs"})
    grid_columns = 24


class BoardColumn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    lane: str


class BoardRules(CanvasLayoutRules):
    """A container with its own, non-grid child layout."""

    widget_type = "board"
    is_container = True
    child_layout_model = BoardColumn


class ChartRules(CanvasLayoutRules):
    widget_type = "chart"
    is_filterable = True


class FilterRules(CanvasLayoutRules):
    widget_type = "filter"
    is_filter = True


class FilterBarRules(CanvasLayoutRules):
    """Holds filters without containing their scope."""

    widget_type = "filterbar"
    is_container = True
    grid_columns = 24
    accepted_children = frozenset({"filter"})
    bounds_filter_scope = False


def canvas_rules() -> LayoutRulesRegistry:
    rules = LayoutRulesRegistry()
    for registered in (
        GroupRules,
        TabsRules,
        TabRules,
        BoardRules,
        ChartRules,
        FilterRules,
        FilterBarRules,
    ):
        rules.register(registered)
    return rules


class FakeResolver:
    """
    Widgets are named ``<type>`` or ``<type>-<n>``, so a widget's type is
    readable from its id. Ids in ``hidden`` exist but cannot be placed, and
    ids starting with ``missing`` do not exist.
    """

    def __init__(self, hidden: Iterable[str] = ()) -> None:
        self.hidden = set(hidden)

    def widget_types(self, widget_ids: Iterable[str]) -> dict[str, str]:
        return {
            widget_id: widget_id.split("-")[0]
            for widget_id in widget_ids
            if not widget_id.startswith("missing")
        }

    def placeable(self, widget_ids: Iterable[str]) -> set[str]:
        return set(self.widget_types(widget_ids)) - self.hidden


_ops_adapter = TypeAdapter(list[Operation])


def ops(*raw: dict[str, Any]) -> list[Operation]:
    return _ops_adapter.validate_python(list(raw))


def sequential_ids() -> Callable[[], str]:
    counter = iter(range(10_000))
    return lambda: f"n{next(counter)}"


def node(widget: str, **extra: Any) -> dict[str, Any]:
    return {"widget": widget, **extra}


def canvas(
    nodes: dict[str, dict[str, Any]], children: list[str] | None = None
) -> dict[str, Any]:
    """A canvas whose root holds ``children`` (default: every node)."""
    return {
        "version": 1,
        "root": {
            "layout": {"columns": 24},
            "children": list(nodes) if children is None else children,
        },
        "nodes": nodes,
    }
