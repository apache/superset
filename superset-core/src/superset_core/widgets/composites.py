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
Reusable, discoverable building blocks for Dashboard V2 widget control models.

A composite control is a ``BaseModel`` mixin carrying one or more fields
(with their ``x-control`` schema extras already set) that a widget's
``controls_class`` composes in via plain single inheritance — no nesting, so
the composed field renders exactly where a directly-declared field would.
The ``@composite_control`` decorator only registers the class for discovery
(docs generation, MCP tooling); composing one into a widget never touches the
registry.

Composing more than one composite control into the same model (multiple
inheritance across two or more registered mixins) is unsupported for now —
see the design spec's Scope section.
"""

from __future__ import annotations

from dataclasses import dataclass
from types import MappingProxyType
from typing import Any, Callable, Mapping

from pydantic import BaseModel, ConfigDict, Field


@dataclass(frozen=True)
class CompositeControlInfo:
    name: str
    title: str
    description: str
    model: type[BaseModel]


_registry: dict[str, CompositeControlInfo] = {}


def composite_control(
    name: str, title: str, description: str
) -> Callable[[type[BaseModel]], type[BaseModel]]:
    """Register a reusable Pydantic mixin as a discoverable composite control.

    Composing one into a widget's ``controls_class`` is plain inheritance —
    this decorator only makes the class discoverable via
    ``list_composite_controls()``.
    """

    def decorator(cls: type[BaseModel]) -> type[BaseModel]:
        if name in _registry:
            raise ValueError(f"composite control {name!r} already registered")
        _registry[name] = CompositeControlInfo(name, title, description, cls)
        return cls

    return decorator


def list_composite_controls() -> Mapping[str, CompositeControlInfo]:
    """Read-only view of registered composite controls, for docs/MCP
    discovery. An extension-defined composite appears only once its defining
    module has been imported (decorator side effect, same as ``@widget``)."""
    return MappingProxyType(_registry)


@composite_control(
    name="metric",
    title="Metrics",
    description=(
        "Reusable metric-list field (saved-metric names or ad-hoc SIMPLE aggregates)."
    ),
)
class MetricControl(BaseModel):
    """Mixin providing a ``metrics`` field, extracted verbatim from
    ``DataBinding`` for reuse outside it."""

    model_config = ConfigDict(populate_by_name=True)

    metrics: list[Any] = Field(
        title="Metrics",
        description=(
            "Metrics to fetch. Each entry is a string naming a saved metric "
            'on the dataset (e.g. "count"), OR an ad-hoc aggregate object, '
            "either "
            '{"expressionType": "SIMPLE", "column": {"column_name": "<col>"}, '
            '"aggregate": "SUM"|"AVG"|"COUNT"|"COUNT_DISTINCT"|"MIN"|"MAX", '
            '"label": "<optional display label>"} '
            'or {"expressionType": "SQL", "sqlExpression": "<raw SQL '
            'expression, e.g. \\"SUM(sales)\\">", '
            '"label": "<optional display label>"}. Do not pass a raw SQL '
            "string directly in place of an entry — a plain string is always "
            "looked up as a saved-metric name, not evaluated as an "
            "expression; a SQL expression must be wrapped in the "
            '{"expressionType": "SQL", ...} object above.'
        ),
        json_schema_extra={"x-control": "metric-multi", "x-language": "json"},
    )
