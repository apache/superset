# Control Dependency Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a widget register more than one dynamic-field enricher, derive their execution order and a dependency graph from the fields' existing `x-dependsOn` declarations, detect a cyclic graph once at widget-registration time, and retire the single `Widget.enrich_schema` hook in favor of this mechanism — retrofitting `Balloons` (the only current dynamic-field widget) as the proof case with zero behavior change.

**Architecture:** A new `superset_core/widgets/enrichment.py` walks a built (pre-enrichment) control schema to find every `x-dynamic` field, builds a dependency graph from each field's `x-dependsOn` list (an entry naming another dynamic field's path is an ordering edge; anything else is a truthiness gate against the parsed control values), topologically sorts it (raising on a cycle), and runs each field's registered enricher in that order, threading prior enrichers' return values forward. `Widget.get_control_schema` (superset_core) drives this pipeline instead of calling a single `enrich_schema` override; the `@widget` decorator (`inject_widget_implementations`) calls `get_control_schema(None, None)` once at registration so a cyclic graph fails the import instead of surfacing at request time.

**Tech Stack:** Python/Pydantic, pytest.

**Spec:** [docs/superpowers/specs/2026-08-26-control-dependency-graph-design.md](../specs/2026-08-26-control-dependency-graph-design.md)

## Global Constraints

- New Python code needs full type hints and must be mypy-clean (per CLAUDE.md); `pre-commit run mypy` is the only working invocation in this environment (no venv here has a standalone `mypy` module).
- New files need the standard ASF license header.
- Run `pre-commit run --files <touched files>` before considering any task done; re-run tests after any auto-fix since files change on disk.
- No new dynamic-field capability, no frontend changes — Balloons' served schema must remain byte-identical before/after (golden-fixture discipline, same as the composite-control-registry slice).
- Corrections found while writing this plan, not yet reflected in the spec (fold into the spec-reconciliation step at the end, same as last time): (1) `EnricherFn` must receive the **whole schema**, not just its own field's fragment — Balloons' real enricher reads `schema["$defs"]["SeriesStyle"]`, a sibling `$defs` entry, not something reachable from its own node alone. (2) `check_dependencies` (`superset_core/semantic_layers/config.py`) resolves a dependency name via `getattr(configuration, dep, None)` using the *raw* `x-dependsOn` string (e.g. `"dataBinding"`) directly as a Python attribute name — but Pydantic attribute access always uses the Python field name (`data_binding`), never the alias, even under `populate_by_name=True`. Verified directly: `getattr(parsed, "dataBinding", "MISSING")` returns `"MISSING"` on a real parsed `BalloonsControls` instance. `check_dependencies` has zero callers today, so this has never been exercised — it must resolve alias → Python name before `getattr`, since this plan is its first real caller. (3) The `x-dependsOn: ["dataBinding"]` gate is coarser than what Balloons actually needs: `dataBinding` is a required field, so it's truthy whenever `parsed` exists at all — it does not capture "`dimensions` is non-empty" or "the `series` parameter is non-empty" (the latter isn't even a field on `parsed`, so no `x-dependsOn` entry could ever express it). Balloons' enricher body must keep its existing fine-grained `if not dimensions or not series: return` guard; the schema-level gate is an additional coarse pre-filter for the *new* multi-hop-ordering feature, not a replacement for per-field logic.

---

## File Structure

**Backend — new:**
- `superset-core/src/superset_core/widgets/enrichment.py` — `EnricherFn`, `dynamic_field_paths`, `build_dependency_graph`, `toposort_or_raise`, `run_enrichers`.
- `tests/unit_tests/widgets/test_enrichment.py` — unit tests for the module above, using synthetic schemas (no real widget needed).

**Backend — modified:**
- `superset-core/src/superset_core/semantic_layers/config.py` — fix `check_dependencies`'s alias resolution.
- `superset-core/src/superset_core/widgets/base.py` — `Widget` gains `enrichers: ClassVar[dict[str, EnricherFn]]`; `get_control_schema` drives the new pipeline; `enrich_schema` is removed.
- `superset-core/src/superset_core/widgets/__init__.py` — re-export `EnricherFn` (widget authors need the type to annotate their enrichers).
- `superset/core/api/core_api_injection.py` — `widget_impl`'s `decorator` calls `cls.get_control_schema(None, None)` once after registering, so a cyclic graph fails import.
- `superset/widgets/builtin.py` — `Balloons.enrich_schema` becomes `Balloons._populate_series` registered via `enrichers`.
- `tests/unit_tests/widgets/test_builtin.py` — unchanged assertions, but now exercised through the new pipeline (regression proof).
- `tests/unit_tests/widgets/test_registry.py` — add a registration-time cycle-detection test.

---

## Task 1: `enrichment.py` — graph, toposort, and the enricher runner

**Files:**
- Create: `superset-core/src/superset_core/widgets/enrichment.py`
- Test: `tests/unit_tests/widgets/test_enrichment.py` (new)

**Interfaces:**
- Consumes: nothing new.
- Produces: `EnricherFn = Callable[[dict[str, Any], dict[str, Any], BaseModel | None, list[str], dict[str, Any]], Any]` — `(schema, node, parsed, series, upstream_results) -> Any`; `dynamic_field_paths(schema) -> dict[str, dict[str, Any]]`; `build_dependency_graph(fields: dict[str, dict[str, Any]]) -> dict[str, list[str]]`; `toposort_or_raise(graph: dict[str, list[str]], widget_type: str) -> list[str]`; `run_enrichers(schema, fields, order, enrichers, parsed, series) -> None`. Task 2 wires these into `Widget.get_control_schema`.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit_tests/widgets/test_enrichment.py`:

```python
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

import pytest

from superset_core.widgets.enrichment import (
    build_dependency_graph,
    dynamic_field_paths,
    run_enrichers,
    toposort_or_raise,
)


def test_dynamic_field_paths_finds_top_level_field() -> None:
    schema = {
        "properties": {
            "a": {"x-dynamic": True, "x-dependsOn": ["b"]},
            "b": {"type": "string"},
        }
    }
    fields = dynamic_field_paths(schema)
    assert list(fields) == ["a"]
    assert fields["a"] is schema["properties"]["a"]


def test_dynamic_field_paths_finds_nested_defs_field() -> None:
    # Mirrors Customization.series's actual shape: the dynamic field lives
    # inside a $defs entry referenced by $ref, not directly in properties.
    schema = {
        "properties": {"customize": {"$ref": "#/$defs/Customization"}},
        "$defs": {
            "Customization": {
                "properties": {
                    "series": {"x-dynamic": True, "x-dependsOn": ["dataBinding"]}
                }
            }
        },
    }
    fields = dynamic_field_paths(schema)
    assert list(fields) == ["customize/series"]


def test_build_dependency_graph_edge_vs_gate() -> None:
    fields = {
        "a": {"x-dynamic": True, "x-dependsOn": ["b", "staticField"]},
        "b": {"x-dynamic": True},
    }
    graph = build_dependency_graph(fields)
    # "b" is a known dynamic path -> ordering edge; "staticField" isn't -> not an edge.
    assert graph == {"a": ["b"], "b": []}


def test_toposort_orders_a_chain() -> None:
    graph = {"c": ["b"], "b": ["a"], "a": []}
    order = toposort_or_raise(graph, "test-widget")
    assert order.index("a") < order.index("b") < order.index("c")


def test_toposort_raises_on_cycle() -> None:
    graph = {"a": ["b"], "b": ["a"]}
    with pytest.raises(ValueError, match="a") as exc_info:
        toposort_or_raise(graph, "test-widget")
    assert "b" in str(exc_info.value)


def test_run_enrichers_threads_upstream_result_forward() -> None:
    schema = {
        "properties": {
            "a": {"x-dynamic": True},
            "b": {"x-dynamic": True, "x-dependsOn": ["a"]},
        }
    }
    fields = dynamic_field_paths(schema)
    order = toposort_or_raise(build_dependency_graph(fields), "test-widget")

    seen_upstream = {}

    def enrich_a(schema_arg, node, parsed, series, upstream):
        node["computed"] = "from-a"
        return "a-result"

    def enrich_b(schema_arg, node, parsed, series, upstream):
        seen_upstream.update(upstream)

    run_enrichers(schema, fields, order, {"a": enrich_a, "b": enrich_b}, None, [])

    assert schema["properties"]["a"]["computed"] == "from-a"
    assert seen_upstream == {"a": "a-result"}


def test_run_enrichers_skips_ungated_field_without_error() -> None:
    # No enricher registered for a discovered dynamic field: no-op, not an error.
    schema = {"properties": {"a": {"x-dynamic": True}}}
    fields = dynamic_field_paths(schema)
    order = toposort_or_raise(build_dependency_graph(fields), "test-widget")
    run_enrichers(schema, fields, order, {}, None, [])  # must not raise
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `venv/bin/python3 -m pytest tests/unit_tests/widgets/test_enrichment.py -v`
Expected: all FAIL with `ModuleNotFoundError` (`superset_core.widgets.enrichment` doesn't exist yet).

- [ ] **Step 3: Implement `superset-core/src/superset_core/widgets/enrichment.py`**

```python
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
Dependency graph and execution engine for a widget's dynamic (``x-dynamic``)
control-schema fields.

A widget registers one enricher callable per dynamic field path (see
``Widget.enrichers``). Each field's existing ``x-dependsOn`` list (already
used to gate enrichment via ``check_dependencies``) does double duty here:
an entry naming another dynamic field's path becomes an ordering edge (that
field's enricher must run first, and this one receives its result); any
other entry stays a plain truthiness gate against the parsed control values.
Field paths use ``a/b`` dot-path notation, the same convention
``schema_tools.py`` uses for drill-in paths.

This module only computes the graph and runs enrichers in order — it has no
opinion on where the schema or enrichers come from; ``Widget.get_control_schema``
wires it up.
"""

from __future__ import annotations

from typing import Any, Callable

from pydantic import BaseModel

from superset_core.semantic_layers.config import check_dependencies

# (schema, node, parsed, series, upstream_results) -> Any.
# `schema` is the full document (for cross-$defs lookups, e.g. a sibling
# style definition); `node` is this field's own schema fragment, mutated in
# place. The return value is threaded to enrichers ordered after this one, as
# `upstream_results[path]`.
EnricherFn = Callable[
    [dict[str, Any], dict[str, Any], "BaseModel | None", list[str], dict[str, Any]],
    Any,
]


def _defs(schema: dict[str, Any]) -> dict[str, Any]:
    return schema.get("$defs", {}) or {}


def _deref(schema: dict[str, Any], node: dict[str, Any]) -> dict[str, Any]:
    if "$ref" not in node:
        return node
    return _defs(schema).get(node["$ref"].split("/")[-1], {})


def dynamic_field_paths(schema: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Walk a built (pre-enrichment) control schema and return
    ``{path: schema_node}`` for every field carrying ``x-dynamic: true``,
    using ``a/b`` dot-path notation. Descends into ``properties`` and
    resolves ``$ref`` against ``$defs`` along the way; does not descend into
    a discovered dynamic field itself (a dynamic field's own internals are
    the enricher's concern, not the graph's)."""
    fields: dict[str, dict[str, Any]] = {}

    def _walk(node: dict[str, Any], prefix: str) -> None:
        resolved = _deref(schema, node)
        for name, prop in resolved.get("properties", {}).items():
            path = f"{prefix}/{name}" if prefix else name
            prop_resolved = _deref(schema, prop)
            if prop_resolved.get("x-dynamic"):
                fields[path] = prop_resolved
            else:
                _walk(prop, path)

    _walk(schema, "")
    return fields


def build_dependency_graph(fields: dict[str, dict[str, Any]]) -> dict[str, list[str]]:
    """``{path: [ordering-edge paths]}`` for every dynamic field in
    ``fields``. Only ``x-dependsOn`` entries that name another key of
    ``fields`` become edges; every other entry is left as a gate for
    ``check_dependencies`` to evaluate at run time, not an edge here."""
    return {
        path: [dep for dep in node.get("x-dependsOn", []) if dep in fields]
        for path, node in fields.items()
    }


def toposort_or_raise(graph: dict[str, list[str]], widget_type: str) -> list[str]:
    """Kahn's algorithm over ``graph`` (``path -> [paths it depends on]``).
    Raises ``ValueError`` naming every field on a cycle when the graph isn't
    a DAG."""
    in_degree = dict.fromkeys(graph, 0)
    dependents: dict[str, list[str]] = {path: [] for path in graph}
    for path, deps in graph.items():
        in_degree[path] = len(deps)
        for dep in deps:
            dependents[dep].append(path)

    ready = sorted(path for path, degree in in_degree.items() if degree == 0)
    order: list[str] = []
    while ready:
        path = ready.pop(0)
        order.append(path)
        for dependent in sorted(dependents[path]):
            in_degree[dependent] -= 1
            if in_degree[dependent] == 0:
                ready.append(dependent)

    if len(order) != len(graph):
        remaining = sorted(set(graph) - set(order))
        raise ValueError(
            f"Cyclic control dependency in widget {widget_type!r} among: "
            f"{', '.join(remaining)}"
        )
    return order


def run_enrichers(
    schema: dict[str, Any],
    fields: dict[str, dict[str, Any]],
    order: list[str],
    enrichers: dict[str, "EnricherFn"],
    parsed: BaseModel | None,
    series: list[str],
) -> None:
    """Run each path's registered enricher (if any) in ``order``, skipping
    one whose non-edge ``x-dependsOn`` gate(s) aren't satisfied, and
    threading each enricher's return value forward as
    ``upstream_results[path]`` for anything ordered after it."""
    upstream_results: dict[str, Any] = {}
    for path in order:
        enricher = enrichers.get(path)
        if enricher is None:
            continue
        node = fields[path]
        if parsed is not None and not check_dependencies(node, parsed):
            continue
        result = enricher(schema, node, parsed, series, upstream_results)
        upstream_results[path] = result
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `venv/bin/python3 -m pytest tests/unit_tests/widgets/test_enrichment.py -v`
Expected: all 7 PASS.

- [ ] **Step 5: Commit**

```bash
git add superset-core/src/superset_core/widgets/enrichment.py tests/unit_tests/widgets/test_enrichment.py
git commit -m "feat(dashboard-v2): add dependency graph + enricher runner for dynamic control fields"
```

---

## Task 2: Fix `check_dependencies`'s alias resolution

**Files:**
- Modify: `superset-core/src/superset_core/semantic_layers/config.py`
- Test: `tests/unit_tests/semantic_layers/config_test.py` (append)

**Interfaces:**
- Consumes: nothing new.
- Produces: `check_dependencies` now resolves an `x-dependsOn` entry against the parsed model's *alias* (matching what's actually written in the schema) before falling back to the raw name, instead of only ever trying the raw name directly.

- [ ] **Step 1: Write the failing test**

Append to `tests/unit_tests/semantic_layers/config_test.py`:

```python
from pydantic import ConfigDict, Field

from superset_core.semantic_layers.config import check_dependencies


class _Aliased(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data_binding: int = Field(alias="dataBinding")


def test_check_dependencies_resolves_alias() -> None:
    # x-dependsOn is written using the schema-facing alias ("dataBinding"),
    # but Pydantic attribute access always uses the Python field name
    # ("data_binding") -- confirmed directly that getattr(parsed, "dataBinding")
    # misses even under populate_by_name=True.
    configuration = _Aliased(dataBinding=1)
    assert getattr(configuration, "dataBinding", "MISSING") == "MISSING"
    assert check_dependencies({"x-dependsOn": ["dataBinding"]}, configuration)


def test_check_dependencies_false_when_dependency_falsy() -> None:
    configuration = _Aliased(dataBinding=0)
    assert not check_dependencies({"x-dependsOn": ["dataBinding"]}, configuration)


def test_check_dependencies_true_when_no_dependencies_declared() -> None:
    configuration = _Aliased(dataBinding=0)
    assert check_dependencies({}, configuration)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `venv/bin/python3 -m pytest tests/unit_tests/semantic_layers/config_test.py -v -k check_dependencies`
Expected: `test_check_dependencies_resolves_alias` FAILS (`check_dependencies` returns falsy — `getattr(configuration, "dataBinding", None)` is `None`); the other two already pass (they don't exercise the alias bug).

- [ ] **Step 3: Fix `check_dependencies`**

In `superset-core/src/superset_core/semantic_layers/config.py`, replace:

```python
def check_dependencies(
    prop_schema: dict[str, Any],
    configuration: BaseModel,
) -> bool:
    """
    Check whether a dynamic property's dependencies are satisfied.

    Reads the ``x-dependsOn`` list from the property schema and returns ``True``
    when every referenced attribute on ``configuration`` is truthy.
    """
    dependencies = prop_schema.get("x-dependsOn", [])
    return all(getattr(configuration, dep, None) for dep in dependencies)
```

with:

```python
def check_dependencies(
    prop_schema: dict[str, Any],
    configuration: BaseModel,
) -> bool:
    """
    Check whether a dynamic property's dependencies are satisfied.

    Reads the ``x-dependsOn`` list from the property schema and returns ``True``
    when every referenced attribute on ``configuration`` is truthy. Entries are
    written using the schema-facing alias (e.g. ``"dataBinding"``), so each is
    resolved to its Pydantic field name before ``getattr`` -- Pydantic attribute
    access always uses the field name, never the alias, even under
    ``populate_by_name=True``.
    """
    dependencies = prop_schema.get("x-dependsOn", [])
    alias_to_name = {
        (field.alias or name): name
        for name, field in type(configuration).model_fields.items()
    }
    return all(
        getattr(configuration, alias_to_name.get(dep, dep), None)
        for dep in dependencies
    )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `venv/bin/python3 -m pytest tests/unit_tests/semantic_layers/config_test.py -v`
Expected: all PASS (8 total: the 5 from the field-order slice plus these 3).

- [ ] **Step 5: Commit**

```bash
git add superset-core/src/superset_core/semantic_layers/config.py tests/unit_tests/semantic_layers/config_test.py
git commit -m "fix(dashboard-v2): resolve x-dependsOn aliases in check_dependencies"
```

---

## Task 3: Wire the pipeline into `Widget.get_control_schema`, retire `enrich_schema`

**Files:**
- Modify: `superset-core/src/superset_core/widgets/base.py`
- Modify: `superset-core/src/superset_core/widgets/__init__.py`

**Interfaces:**
- Consumes: `enrichment.py`'s four functions (Task 1).
- Produces: `Widget.enrichers: ClassVar[dict[str, EnricherFn]] = {}`; `get_control_schema` runs the full pipeline. `enrich_schema` no longer exists on `Widget`. Task 5 (Balloons retrofit) depends on this.

- [ ] **Step 1: Modify `superset-core/src/superset_core/widgets/base.py`**

Replace the imports and the `get_control_schema`/`enrich_schema` methods:

```python
from __future__ import annotations

import logging
from typing import Any, ClassVar

from pydantic import BaseModel, ValidationError

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
    widget_type: str
    name: str
    description: str = ""
    controls_class: type[BaseModel]
    enrichers: ClassVar[dict[str, EnricherFn]] = {}

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
        this widget has a registered enricher for its path) in dependency
        order -- derived from each field's own ``x-dependsOn``, see
        ``superset_core.widgets.enrichment``. A cyclic dependency raises
        ``ValueError``; for a built-in or registered widget this is caught
        once at registration time (``inject_widget_implementations``), not
        on every request.
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
        if not control_values:
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
```

(Keep the module and class docstrings as they are today — only the imports
and the two methods change.)

- [ ] **Step 2: Re-export `EnricherFn` from `superset-core/src/superset_core/widgets/__init__.py`**

```python
from superset_core.widgets.base import Widget as Widget
from superset_core.widgets.composites import (
    composite_control as composite_control,
    list_composite_controls as list_composite_controls,
    MetricControl as MetricControl,
)
from superset_core.widgets.decorators import widget as widget
from superset_core.widgets.enrichment import EnricherFn as EnricherFn
```

- [ ] **Step 3: Run the existing widgets suite — expect Balloons failures**

Run: `venv/bin/python3 -m pytest tests/unit_tests/widgets/ tests/unit_tests/mcp_service/widgets/ -v`
Expected: `test_builtin.py`'s Balloons tests now FAIL, because `Balloons` still
overrides the now-nonexistent `enrich_schema` (dead code — no longer called)
and has no `enrichers` registered, so `series` stays open-ended in every
case. Every non-Balloons test should still PASS. This is expected — Task 5
fixes it; do not treat this as a regression to chase down within this task.

- [ ] **Step 4: Commit**

```bash
git add superset-core/src/superset_core/widgets/base.py superset-core/src/superset_core/widgets/__init__.py
git commit -m "feat(dashboard-v2): drive get_control_schema through the enricher pipeline"
```

---

## Task 4: Registration-time cycle detection

**Files:**
- Modify: `superset/core/api/core_api_injection.py`
- Test: `tests/unit_tests/widgets/test_registry.py` (append)

**Interfaces:**
- Consumes: Task 3's `get_control_schema` (which now raises `ValueError` internally on a cyclic graph, via `toposort_or_raise`).
- Produces: nothing new — this task only changes *when* that `ValueError` can surface (at `@widget` application, not first request).

- [ ] **Step 1: Write the failing test**

Append to `tests/unit_tests/widgets/test_registry.py`:

```python
def test_widget_registration_raises_on_cyclic_dependency() -> None:
    from typing import Any, ClassVar

    from pydantic import BaseModel, Field
    from superset_core.widgets import widget, Widget

    class _CyclicControls(BaseModel):
        a: dict[str, Any] = Field(
            default_factory=dict,
            json_schema_extra={"x-dynamic": True, "x-dependsOn": ["b"]},
        )
        b: dict[str, Any] = Field(
            default_factory=dict,
            json_schema_extra={"x-dynamic": True, "x-dependsOn": ["a"]},
        )

    with pytest.raises(ValueError, match="Cyclic control dependency"):

        @widget(widget_type="cyclic-test-widget", name="Cyclic")
        class _Cyclic(Widget):
            controls_class = _CyclicControls

    # The widget must not remain half-registered after the failure.
    assert registry.get("cyclic-test-widget") is None
```

(Add `import pytest` at the top of the file if not already present — check
first, since `test_registry.py` may already import it via other tests in
this suite.)

- [ ] **Step 2: Run test to verify it fails**

Run: `venv/bin/python3 -m pytest tests/unit_tests/widgets/test_registry.py -v -k cyclic`
Expected: FAIL — the widget currently registers successfully (no eager
schema build happens at registration), so no `ValueError` is raised, and the
final `assert registry.get(...) is None` also fails since it *did* register.

- [ ] **Step 3: Make registration eager, and roll back on failure**

In `superset/core/api/core_api_injection.py`, inside `inject_widget_implementations`'s
`widget_impl`'s `decorator`, after `registry[key] = cls` and before `return cls`:

```python
            cls.widget_type = key
            cls.name = name
            cls.description = description or ""
            registry[key] = cls
            try:
                # Eagerly build the base (control_values=None) schema once, so
                # a cyclic x-dependsOn graph among this widget's dynamic
                # fields fails at import time -- get_control_schema's
                # toposort_or_raise call is what actually detects the cycle;
                # this just forces that check to run now instead of on the
                # widget's first real request.
                cls.get_control_schema(None, None)
            except Exception:
                registry.pop(key, None)
                raise
            return cls
```

- [ ] **Step 4: Run test to verify it passes**

Run: `venv/bin/python3 -m pytest tests/unit_tests/widgets/test_registry.py -v -k cyclic`
Expected: PASS.

- [ ] **Step 5: Run the full widgets + MCP suite**

Run: `venv/bin/python3 -m pytest tests/unit_tests/widgets/ tests/unit_tests/mcp_service/widgets/ -v`
Expected: same state as Task 3 Step 3 — Balloons tests still failing (Task 5
fixes them), everything else passing, plus the new cyclic test passing.

- [ ] **Step 6: Commit**

```bash
git add superset/core/api/core_api_injection.py tests/unit_tests/widgets/test_registry.py
git commit -m "feat(dashboard-v2): detect cyclic control dependencies at widget registration"
```

---

## Task 5: Retrofit `Balloons` onto the enricher registry

**Files:**
- Modify: `superset/widgets/builtin.py`

**Interfaces:**
- Consumes: `Widget.enrichers` (Task 3).
- Produces: nothing new — `Balloons`'s served schema must be byte-identical to before this whole plan started (golden-fixture proof, `test_builtin.py`/`test_registry.py` already assert this exactly).

- [ ] **Step 1: Replace `Balloons.enrich_schema` with a registered enricher**

In `superset/widgets/builtin.py`, replace the `enrich_schema` classmethod with:

```python
    @staticmethod
    def _populate_series(
        schema: dict[str, Any],
        node: dict[str, Any],
        parsed: BaseModel | None,
        series: list[str],
        upstream: dict[str, Any],
    ) -> None:
        # `node` is Customization.series's own fragment; `SeriesStyle` is a
        # sibling $defs entry, only reachable via the full `schema`.
        style_def = schema.get("$defs", {}).get("SeriesStyle")
        if style_def is None:
            return
        # The x-dependsOn: ["dataBinding"] gate (run_enrichers) only confirms
        # a dataBinding was parsed at all -- it can't express "dimensions is
        # non-empty" (a nested attribute) or "series is non-empty" (a runtime
        # parameter, not a field on parsed), so both stay checked here.
        dimensions = None
        if parsed is not None:
            data_binding = getattr(parsed, "data_binding", None)
            dimensions = getattr(data_binding, "dimensions", None)
        if not dimensions or not series:
            return
        # Dedupe (preserving order) and cap before doing per-series work, so an
        # oversized/duplicate list can't blow up CPU, memory, or response size.
        unique_series = list(dict.fromkeys(series))[: Balloons.MAX_SERIES]
        # Replace the open-ended map with one inlined, pre-colored style per series.
        node.pop("additionalProperties", None)
        properties: dict[str, Any] = {}
        for index, value in enumerate(unique_series):
            style = deepcopy(style_def)
            style["properties"]["color"]["default"] = Balloons.PALETTE[
                index % len(Balloons.PALETTE)
            ]
            # Title each group with the series value so the control panel labels
            # it by series rather than by the shared model name ("SeriesStyle").
            style["title"] = value
            properties[value] = style
        node["properties"] = properties

    enrichers: ClassVar[dict[str, EnricherFn]] = {"customize/series": _populate_series}
```

Add the necessary imports at the top of `superset/widgets/builtin.py`:
```python
from typing import Any, ClassVar

from superset_core.widgets import EnricherFn, Widget, widget
```
(replacing the existing `from typing import Any` and `from superset_core.widgets import Widget, widget` lines).

- [ ] **Step 2: Run the Balloons tests to verify they pass again**

Run: `venv/bin/python3 -m pytest tests/unit_tests/widgets/test_builtin.py -v`
Expected: all PASS, unchanged assertions — proves the retrofit reproduces
`enrich_schema`'s exact prior behavior.

- [ ] **Step 3: Run the full widgets + MCP + semantic_layers suite**

Run: `venv/bin/python3 -m pytest tests/unit_tests/widgets/ tests/unit_tests/mcp_service/widgets/ tests/unit_tests/semantic_layers/ -v`
Expected: all PASS, including the composite-control-registry slice's golden-fixture
tests for `metric-tile`/`balloons` (this plan must not regress those either).

- [ ] **Step 4: mypy**

Run: `pre-commit run mypy --files superset-core/src/superset_core/widgets/enrichment.py superset-core/src/superset_core/widgets/base.py superset-core/src/superset_core/widgets/__init__.py superset-core/src/superset_core/semantic_layers/config.py superset/core/api/core_api_injection.py superset/widgets/builtin.py`
Expected: no errors. Fix inline if any surface (the composite-control-registry
slice hit one narrowing issue mypy flagged that `isinstance`+`issubclass` alone
didn't resolve — bind to an explicitly-annotated local if something similar
comes up here).

- [ ] **Step 5: Commit**

```bash
git add superset/widgets/builtin.py
git commit -m "refactor(dashboard-v2): retrofit Balloons onto the enricher registry"
```

---

## Final Verification

- [ ] Run `pre-commit run --files <every file touched across all 5 tasks>` and fix anything it flags; re-run the affected tests after any auto-fix.
- [ ] Run the full backend unit suite once more: `venv/bin/python3 -m pytest tests/unit_tests/widgets/ tests/unit_tests/mcp_service/widgets/ tests/unit_tests/semantic_layers/ -v`
- [ ] Confirm no frontend files were touched: `git status --porcelain -- superset-frontend/` should be empty.
- [ ] Reconcile the spec (`docs/superpowers/specs/2026-08-26-control-dependency-graph-design.md`) with anything discovered during implementation that diverged from the plan (`EnricherFn`'s signature, `check_dependencies`'s alias fix, the gate-vs-fine-grained-guard nuance) — same discipline as the composite-control-registry slice's post-implementation doc reconciliation.
