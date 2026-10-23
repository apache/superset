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
from superset_core.canvas import StoredWidget
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


def canvas_widget_types() -> dict[str, type[Widget]]:
    """Test widgets by id, standing in for the widget registry."""
    widget_types = [
        _widget(
            "group", WidgetBehavior(container=True, grid_columns=12, structural=True)
        ),
        _widget(
            "tabs",
            WidgetBehavior(
                container=True, accepted_children=frozenset({"tab"}), structural=True
            ),
        ),
        _widget(
            "tab",
            WidgetBehavior(
                container=True,
                allowed_parents=frozenset({"tabs"}),
                grid_columns=24,
                structural=True,
            ),
        ),
        # A container with its own, non-grid child layout.
        _widget(
            "board",
            WidgetBehavior(
                container=True, child_layout_model=BoardColumn, structural=True
            ),
        ),
        _widget("markdown", WidgetBehavior(structural=True)),
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
                structural=True,
            ),
        ),
    ]
    return {widget.widget_type: widget for widget in widget_types}


class FakeResolver:
    """
    Widget entities are named ``<widget>`` or ``<widget>-<n>``, so a widget's
    type is readable from its id. Ids in ``hidden`` exist but cannot be placed,
    ids in ``readonly`` cannot be changed, and ids starting with ``missing`` do
    not exist. Each one's props are in ``props``, empty by default.
    """

    def __init__(
        self, hidden: Iterable[str] = (), readonly: Iterable[str] = ()
    ) -> None:
        self.hidden = set(hidden)
        self.readonly = set(readonly)
        self.props: dict[str, dict[str, Any]] = {}

    def widget_types(self, widget_ids: Iterable[str]) -> dict[str, str]:
        return {
            instance_id: instance_id.split("-")[0]
            for instance_id in widget_ids
            if not instance_id.startswith("missing")
        }

    def placeable(self, widget_ids: Iterable[str]) -> set[str]:
        return set(self.widget_types(widget_ids)) - self.hidden

    def widgets(self, widget_ids: Iterable[str]) -> dict[str, StoredWidget]:
        return {
            widget_id: StoredWidget(
                widget_type=widget_type,
                schema_version=1,
                name=widget_id,
                props=dict(self.props.get(widget_id, {})),
                revision=1,
            )
            for widget_id, widget_type in self.widget_types(widget_ids).items()
        }

    def editable(self, widget_ids: Iterable[str]) -> set[str]:
        return set(self.widget_types(widget_ids)) - self.readonly


_ops_adapter = TypeAdapter(list[Operation])


def ops(*raw: dict[str, Any]) -> list[Operation]:
    return _ops_adapter.validate_python(list(raw))


def sequential_ids() -> Callable[[str, Container[str]], str]:
    counter = iter(range(10_000))
    return lambda _base, _taken: f"n{next(counter)}"


def node(widget_id: str, **extra: Any) -> dict[str, Any]:
    """A placement of a persisted instance."""
    return {"widgetId": widget_id, **extra}


def inline(
    widget: str, props: dict[str, Any] | None = None, **extra: Any
) -> dict[str, Any]:
    """A placement holding an inline instance of ``widget``."""
    return {"widgetType": widget, "schemaVersion": 1, "props": props or {}, **extra}


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


def sequential_widget_ids(prefix: str = "w") -> Callable[[], str]:
    """Widget UUIDs ``w0``, ``w1``, ... for widgets operations create."""
    count = iter(range(1_000_000))
    return lambda: f"{prefix}{next(count)}"
