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
Base class for a Dashboard V2 widget's backend behavior.

Lives in ``superset_core`` so extensions can subclass it exactly the way the
host's built-in widgets do — the same contract, no app-internal imports. A
concrete widget registers itself as a whole with the ``@widget`` decorator (see
``superset_core.widgets.decorators``).

``Widget`` is the single registered unit for a widget type. Today it exposes the
**control panel** (the JSON Schema that drives the Inspector and MCP, plus
commit-time validation). It is deliberately the wrapper — not a bare
"controls" object — because a widget type's other backend concerns will hang off
the same class and register together: e.g. building a ``SemanticQuery`` from the
control values, and post-processing the query results before they reach the
viz. Those aren't relevant to the frontend, but they belong in the same registry
entry, so they live here rather than in a parallel registry.
"""

from __future__ import annotations

import logging
from typing import Any, ClassVar

from pydantic import BaseModel, ValidationError

# Reuse the Semantic Layer's schema helper: it turns a Pydantic model into a
# JSON Schema, preserves field order, and blanks ``x-dynamic`` enums when no
# configuration is supplied — the exact machinery the SIP proposes to share.
from superset_core.semantic_layers.config import build_configuration_schema
from superset_core.widgets.enrichment import (
    build_dependency_graph,
    dynamic_field_paths,
    EnricherFn,
    run_enrichers,
    toposort_or_raise,
)

logger = logging.getLogger(__name__)


class Widget:
    """
    Base class for a Dashboard V2 widget's backend behavior (the registered
    unit for a widget type).

    A concrete widget type is declared with the ``@widget`` decorator (which
    sets ``widget_type``/``name``/``description``) and sets a ``controls_class``
    (a Pydantic model). The model's JSON Schema *is* the control panel; it
    describes the widget's ``node.props`` and is served to both the frontend and
    MCP. Future backend concerns for a widget type (e.g. ``build_semantic_query``
    from the control values, or a query-result handler) will be added here as
    sibling methods so a widget is always registered as a whole.
    """

    widget_type: str
    name: str
    description: str = ""
    controls_class: type[BaseModel]
    enrichers: ClassVar[dict[str, EnricherFn]] = {}

    @classmethod
    def validate_control_schema(cls) -> None:
        """Validate the static control schema without running enrichers.

        Widget registration happens during application initialization, before
        there is a request user. Enrichers may perform permission-scoped data
        lookups, so registration must only verify that the schema can be built
        and that its dynamic-field dependency graph is acyclic.
        """
        schema = build_configuration_schema(cls.controls_class)
        fields = dynamic_field_paths(schema)
        toposort_or_raise(build_dependency_graph(fields), cls.widget_type)

    @classmethod
    def get_control_schema(
        cls,
        control_values: dict[str, Any] | None = None,
        series: list[str] | None = None,
    ) -> dict[str, Any]:
        """
        Return the JSON Schema for this widget's controls.

        ``control_values`` (the full current ``node.props``) is accepted so
        dynamic fields can be enriched from it, mirroring the Semantic Layer.
        ``series`` carries the distinct dimension values the frontend
        discovered from the query results (they cannot come from
        ``control_values`` alone, which hold the dimension *name*, not its
        values). Partial or invalid values during editing are tolerated and
        fall back to the base schema; enrichment errors propagate so the caller
        can degrade gracefully.

        Every ``x-dynamic`` field found in the built schema is enriched (if
        this widget has a registered enricher for its path, see ``enrichers``)
        in dependency order — derived from each field's own ``x-dependsOn``,
        see ``superset_core.widgets.enrichment``. A cyclic dependency raises
        ``ValueError``; for a built-in or registered widget this is caught
        once at registration time (``inject_widget_implementations``), not on
        every request.
        """
        parsed: BaseModel | None = None
        if control_values:
            try:
                parsed = cls.controls_class.model_validate(control_values)
            except Exception:  # pylint: disable=broad-except
                # Partial control values during editing are expected; fall back
                # to the base schema.
                logger.debug(
                    "Could not validate control values for %s; using base schema",
                    cls.widget_type,
                    exc_info=True,
                )
        schema = build_configuration_schema(cls.controls_class, parsed)
        fields = dynamic_field_paths(schema)
        order = toposort_or_raise(build_dependency_graph(fields), cls.widget_type)
        run_enrichers(schema, fields, order, cls.enrichers, parsed, series or [])
        return schema

    @classmethod
    def validate_control_values(
        cls,
        control_values: dict[str, Any] | None,
    ) -> list[dict[str, Any]]:
        """
        Strictly validate ``control_values`` against ``controls_class``,
        returning a list of ``{"loc", "message"}`` errors (empty when valid).

        This is the **commit-time** gate, distinct from ``get_control_schema``
        (which tolerates partial/invalid values so a form can be edited without
        erroring). It runs the model's full validation — including cross-field
        rules declared as Pydantic ``@model_validator`` / ``@field_validator``
        on ``controls_class`` — so a caller (or an AI) gets an actionable
        message instead of a silently-broken widget. It is widget-agnostic:
        every rule lives declaratively on the model; this method just surfaces
        whatever the model enforces.
        """
        if control_values is None:
            return []
        try:
            cls.controls_class.model_validate(control_values)
        except ValidationError as ex:
            return [
                {
                    "loc": [str(part) for part in error.get("loc", ())],
                    "message": error.get("msg", ""),
                }
                for error in ex.errors()
            ]
        return []
