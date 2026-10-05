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
Where the canvas looks up widgets and persisted widget instances.

Widgets come from the widget registry, which built-ins and extensions register
into with ``@widget``; persisted instances through an ``InstanceResolver``.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping

from superset_core.canvas import InstanceResolver
from superset_core.widgets import Widget

WidgetRegistry = Mapping[str, type[Widget]]


def get_widgets() -> WidgetRegistry:
    from superset.widgets.registry import registry

    return registry


class _NoInstances:
    def widget_types(self, instance_ids: Iterable[str]) -> dict[str, str]:
        return {}

    def placeable(self, instance_ids: Iterable[str]) -> set[str]:
        return set()


_resolver: InstanceResolver = _NoInstances()


def set_instance_resolver(resolver: InstanceResolver) -> None:
    global _resolver
    _resolver = resolver


def get_instance_resolver() -> InstanceResolver:
    return _resolver
