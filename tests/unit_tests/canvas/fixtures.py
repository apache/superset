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

from collections.abc import Callable, Container, Iterable
from typing import Any

from pydantic import BaseModel, ConfigDict, TypeAdapter
from superset_core.widgets import Widget, WidgetBehavior

from superset.canvas.definition.schemas import Operation


class Props(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = ""


class ChartProps(Props):
    metric: str = "count"


def _widget(
    widget_type: str,
    behavior: WidgetBehavior | None = None,
    controls: type[BaseModel] = Props,
    **attrs: Any,
) -> type[Widget]:
    return type(
        f"{widget_type.title()}Widget",
        (Widget,),
        {
            "widget_type": widget_type,
            "name": widget_type.title(),
            "controls_class": controls,
            "behavior": behavior or WidgetBehavior(),
            **attrs,
        },
    )


class BoardColumn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    lane: str


def canvas_widgets() -> dict[str, type[Widget]]:
    """Test widgets by id, standing in for the widget registry."""
    widgets = [
        _widget("group", WidgetBehavior(container=True, grid_columns=12)),
        _widget(
            "tabs",
            WidgetBehavior(container=True, accepted_children=frozenset({"tab"})),
        ),
        _widget(
            "tab",
            WidgetBehavior(
                container=True, allowed_parents=frozenset({"tabs"}), grid_columns=24
            ),
        ),
        # A container with its own, non-grid child layout.
        _widget(
            "board", WidgetBehavior(container=True, child_layout_model=BoardColumn)
        ),
        _widget("markdown"),
        _widget("chart", WidgetBehavior(filterable=True), ChartProps),
        # A chart that can also cross-filter others.
        _widget("xchart", WidgetBehavior(filterable=True, emits_filters=True)),
        # A customization, e.g. a dynamic group-by control.
        _widget("groupby", WidgetBehavior(customization=True)),
        _widget("filter", WidgetBehavior(filter=True)),
        # Holds filters without containing their scope.
        _widget(
            "filterbar",
            WidgetBehavior(
                container=True,
                grid_columns=24,
                accepted_children=frozenset({"filter"}),
                bounds_filter_scope=False,
            ),
        ),
    ]
    return {widget.widget_type: widget for widget in widgets}


class FakeResolver:
    """
    Persisted instances are named ``<widget>`` or ``<widget>-<n>``, so an
    instance's widget is readable from its id. Ids in ``hidden`` exist but
    cannot be placed, and ids starting with ``missing`` do not exist.
    """

    def __init__(self, hidden: Iterable[str] = ()) -> None:
        self.hidden = set(hidden)

    def widget_types(self, instance_ids: Iterable[str]) -> dict[str, str]:
        return {
            instance_id: instance_id.split("-")[0]
            for instance_id in instance_ids
            if not instance_id.startswith("missing")
        }

    def placeable(self, instance_ids: Iterable[str]) -> set[str]:
        return set(self.widget_types(instance_ids)) - self.hidden


_ops_adapter = TypeAdapter(list[Operation])


def ops(*raw: dict[str, Any]) -> list[Operation]:
    return _ops_adapter.validate_python(list(raw))


def sequential_ids() -> Callable[[str, Container[str]], str]:
    counter = iter(range(10_000))
    return lambda _base, _taken: f"n{next(counter)}"


def node(instance: str, **extra: Any) -> dict[str, Any]:
    """A placement of a persisted instance."""
    return {"instance": instance, **extra}


def inline(
    widget: str, props: dict[str, Any] | None = None, **extra: Any
) -> dict[str, Any]:
    """A placement holding an inline instance of ``widget``."""
    return {"widget": widget, "schemaVersion": 1, "props": props or {}, **extra}


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
