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
Where the widget side plugs into the canvas.

Widget providers register layout rules for their container types and one
resolver for widget references. Until a resolver is set, no widget exists,
so a canvas can hold no nodes.
"""

from __future__ import annotations

from collections.abc import Iterable, Iterator

from superset_core.canvas import CanvasLayoutRules, WidgetResolver


class LayoutRulesRegistry:
    def __init__(self) -> None:
        self._rules: dict[str, type[CanvasLayoutRules]] = {}

    def register(self, rules: type[CanvasLayoutRules]) -> None:
        if rules.widget_type in self._rules:
            raise ValueError(f"widget type {rules.widget_type!r} already registered")
        self._rules[rules.widget_type] = rules

    def unregister(self, widget_type: str) -> None:
        self._rules.pop(widget_type, None)

    def __iter__(self) -> Iterator[type[CanvasLayoutRules]]:
        return iter(self._rules.values())

    def get(self, widget_type: str) -> type[CanvasLayoutRules]:
        """Rules for ``widget_type``; types without rules are leaves."""
        return self._rules.get(widget_type, CanvasLayoutRules)


class _NoWidgets:
    def widget_types(self, widget_ids: Iterable[str]) -> dict[str, str]:
        return {}

    def placeable(self, widget_ids: Iterable[str]) -> set[str]:
        return set()


layout_rules = LayoutRulesRegistry()
_resolver: WidgetResolver = _NoWidgets()


def set_widget_resolver(resolver: WidgetResolver) -> None:
    global _resolver
    _resolver = resolver


def get_widget_resolver() -> WidgetResolver:
    return _resolver
