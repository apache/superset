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
Where the canvas looks up widget types and persisted widgets.

Widget types come from the registry, which built-ins and extensions register
into with ``@widget``; persisted widgets through a ``WidgetResolver``.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping

from superset_core.canvas import WidgetResolver
from superset_core.widgets import Widget

WidgetTypes = Mapping[str, type[Widget]]


def get_widget_types() -> WidgetTypes:
    from superset.widgets.registry import registry

    return registry


class _NoWidgets:
    def widget_types(self, widget_ids: Iterable[str]) -> dict[str, str]:
        return {}

    def placeable(self, widget_ids: Iterable[str]) -> set[str]:
        return set()


_resolver: WidgetResolver = _NoWidgets()


def set_widget_resolver(resolver: WidgetResolver) -> None:
    global _resolver
    _resolver = resolver


def get_widget_resolver() -> WidgetResolver:
    return _resolver
