# Composite Control Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract `DataBinding.metrics` into a standalone, reusable `MetricControl` Pydantic mixin registered in a new `superset_core` composite-control registry, so it can be composed into other widgets' control models via plain inheritance — with zero change to the schema `DataBinding` currently serves.

**Architecture:** A new `superset_core/widgets/composites.py` module holds `MetricControl` (a `BaseModel` mixin carrying exactly today's `metrics` field) plus a `@composite_control` decorator that registers it — and any future composite — into a discoverable registry, mirroring the existing `@widget`/`superset/widgets/registry.py` pattern already in this codebase. `DataBinding` in `superset/widgets/controls.py` becomes `class DataBinding(MetricControl)`. Because Pydantic always orders inherited fields ahead of a subclass's own fields regardless of redeclaration position, `build_configuration_schema` (`superset_core/semantic_layers/config.py`) gains an additive, opt-in `field_order` override so `DataBinding` can pin its rendered field order back to today's exact sequence.

**Tech Stack:** Python/Pydantic (backend control models), pytest.

**Spec:** [docs/superpowers/specs/2026-08-26-composite-control-registry-design.md](../specs/2026-08-26-composite-control-registry-design.md)

## Global Constraints

- New Python code needs full type hints and must be mypy-clean (per CLAUDE.md).
- New files need the standard ASF license header (`.rat-excludes` doesn't cover these).
- Run `pre-commit run --all-files` before pushing (non-negotiable per CLAUDE.md).
- No new metric capability — `MetricControl.metrics` is moved verbatim from `DataBinding`, not extended (per spec Scope).
- No frontend changes — the served schema for every existing widget is provably unchanged (per spec Scope).
- `build_configuration_schema`'s `field_order` override must be additive: every existing caller that doesn't set `field_order` must behave exactly as before.

---

## File Structure

**Backend — new:**
- `superset-core/src/superset_core/widgets/composites.py` — `CompositeControlInfo`, `composite_control` decorator, `list_composite_controls()`, `MetricControl`.
- `tests/unit_tests/widgets/test_composites.py` — registry unit tests.
- `tests/unit_tests/semantic_layers/config_test.py` — `field_order` override unit tests (naming matches this directory's existing `*_test.py` convention, e.g. `schemas_test.py`).

**Backend — modified:**
- `superset-core/src/superset_core/semantic_layers/config.py` — add the `field_order` override to `build_configuration_schema`.
- `superset-core/src/superset_core/widgets/__init__.py` — re-export `MetricControl`, `composite_control`, `list_composite_controls`.
- `superset/widgets/controls.py` — `DataBinding` drops its inline `metrics` field, inherits `MetricControl`, declares `field_order`.
- `tests/unit_tests/widgets/test_registry.py` — add the schema-identity golden-fixture test (this file already tests `DataBinding`'s served schema via `_block("metric-tile")`/`_block("balloons")`, so the new test belongs alongside them).

---

## Task 1: `field_order` override on `build_configuration_schema`

**Files:**
- Modify: `superset-core/src/superset_core/semantic_layers/config.py:25-59` (the `build_configuration_schema` function)
- Test: `tests/unit_tests/semantic_layers/config_test.py` (new)

**Interfaces:**
- Consumes: nothing new — pure extension of the existing `build_configuration_schema(config_class: type[BaseModel], configuration: BaseModel | None = None) -> dict[str, Any]` signature.
- Produces: `build_configuration_schema` now honors an optional `field_order: ClassVar[list[str]]` attribute on `config_class`, used by Task 3.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit_tests/semantic_layers/config_test.py`:

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

from typing import ClassVar

import pytest
from pydantic import BaseModel

from superset_core.semantic_layers.config import build_configuration_schema


class _NoOverride(BaseModel):
    b: int = 0
    a: int = 0


class _WithOverride(BaseModel):
    field_order: ClassVar[list[str]] = ["a", "b"]

    b: int = 0
    a: int = 0


class _WithBadOverride(BaseModel):
    field_order: ClassVar[list[str]] = ["a", "c"]

    b: int = 0
    a: int = 0


class _Nested(BaseModel):
    field_order: ClassVar[list[str]] = ["y", "x"]

    x: int = 0
    y: int = 0


class _NestedBase(BaseModel):
    y: int


class _NestedComposed(_NestedBase):
    field_order: ClassVar[list[str]] = ["y", "x"]

    x: int


class _Outer(BaseModel):
    nested: _Nested


class _OuterComposed(BaseModel):
    nested: _NestedComposed


def test_no_field_order_behaves_as_today() -> None:
    # Unchanged behavior: model-field declaration order (b, a), not alphabetical.
    schema = build_configuration_schema(_NoOverride)
    assert list(schema["properties"]) == ["b", "a"]


def test_field_order_override_reorders_properties() -> None:
    schema = build_configuration_schema(_WithOverride)
    assert list(schema["properties"]) == ["a", "b"]


def test_field_order_override_must_be_exact_permutation() -> None:
    with pytest.raises(ValueError, match="field_order"):
        build_configuration_schema(_WithBadOverride)


def test_field_order_applies_to_nested_defs_models() -> None:
    # `_Nested` only ever appears inside `$defs`, never as the top-level
    # `config_class` -- this is the DataBinding-inside-MetricTileControls shape.
    schema = build_configuration_schema(_Outer)
    assert list(schema["$defs"]["_Nested"]["properties"]) == ["y", "x"]


def test_field_order_on_nested_model_with_inherited_field() -> None:
    # `x` is inherited from `_NestedBase` (like DataBinding inheriting
    # `metrics` from MetricControl), so Pydantic's natural field order would
    # put `x` first; the override pins it back.
    schema = build_configuration_schema(_OuterComposed)
    assert list(schema["$defs"]["_NestedComposed"]["properties"]) == ["y", "x"]
    assert schema["$defs"]["_NestedComposed"]["required"] == ["y", "x"]
```

- [x] **Step 2: Run tests to verify they fail**

Run: `venv/bin/python3 -m pytest tests/unit_tests/semantic_layers/config_test.py -v`
Expected: everything except `test_no_field_order_behaves_as_today` FAILS
before implementation. Confirmed directly: the first version of this step
(before the nested cases were added) showed exactly
`test_field_order_override_reorders_properties` and
`test_field_order_override_must_be_exact_permutation` failing, matching this
prediction.

- [x] **Step 3: Implement the override**

Replace the body of `build_configuration_schema` in
`superset-core/src/superset_core/semantic_layers/config.py`. **Important — a
top-level-only reorder is not enough.** `DataBinding` (Task 3) is never
itself the `config_class` passed to `build_configuration_schema`; it only
ever appears nested inside another model (e.g.
`MetricTileControls.data_binding: DataBinding`), and Pydantic generates each
nested model's `$defs` entry using that model's own `model_fields` order,
independent of any reordering done to the outer schema. This was verified
directly by running a top-level-only version against the real widget
registry: `$defs.DataBinding` still came back with `metrics` before
`datasetId`. The override below walks every `BaseModel` reachable from
`config_class` and applies the same declared-or-derived ordering to each one
that has a `$defs` entry:

```python
from __future__ import annotations

from typing import Any, get_args, get_origin, Iterator

from pydantic import BaseModel


def _iter_nested_models(
    annotation: Any, seen: set[type[BaseModel]]
) -> Iterator[type[BaseModel]]:
    """Yield every ``BaseModel`` subclass reachable from ``annotation``
    (through generics like ``list[...]``/``... | None``, and recursively
    through each found model's own fields), each at most once."""
    origin = get_origin(annotation)
    if origin is not None:
        for arg in get_args(annotation):
            yield from _iter_nested_models(arg, seen)
        return
    if isinstance(annotation, type) and issubclass(annotation, BaseModel):
        model_cls: type[BaseModel] = annotation
        if model_cls not in seen:
            seen.add(model_cls)
            yield model_cls
            for field in model_cls.model_fields.values():
                yield from _iter_nested_models(field.annotation, seen)


def _resolve_field_order(
    model_cls: type[BaseModel], schema_node: dict[str, Any]
) -> list[str]:
    """The order ``schema_node["properties"]`` should render in: an explicit
    ``field_order: ClassVar[list[str]]`` on ``model_cls`` when declared
    (validated as an exact permutation of its own properties), else the
    model's field declaration order (by alias)."""
    declared_order = getattr(model_cls, "field_order", None)
    if declared_order is None:
        return [field.alias or name for name, field in model_cls.model_fields.items()]
    declared = set(declared_order)
    if declared != (actual := set(schema_node.get("properties", {}))):
        raise ValueError(
            f"{model_cls.__name__}.field_order must be a permutation of its "
            f"schema properties; declared={sorted(declared)} actual={sorted(actual)}"
        )
    return declared_order


def _reorder(schema_node: dict[str, Any], field_order: list[str]) -> None:
    """Reorder ``schema_node``'s ``properties`` (and, for determinism,
    ``required``) to match ``field_order``. Mutates in place."""
    if (properties := schema_node.get("properties")) is not None:
        schema_node["properties"] = {
            key: properties[key] for key in field_order if key in properties
        }
    if (required := schema_node.get("required")) is not None:
        index = {key: position for position, key in enumerate(field_order)}
        schema_node["required"] = sorted(
            required, key=lambda key: index.get(key, len(field_order))
        )


def build_configuration_schema(
    config_class: type[BaseModel],
    configuration: BaseModel | None = None,
) -> dict[str, Any]:
    """
    Build a JSON schema from a Pydantic configuration class.

    Handles generic boilerplate that any semantic layer with dynamic fields needs:

    - Reorders properties to match model field order (Pydantic sorts alphabetically),
      or an explicit ``field_order: ClassVar[list[str]]`` on a model when declared —
      needed because Pydantic always places an inherited field ahead of a
      subclass's own fields in ``model_fields``, regardless of where the subclass
      redeclares it, so composed models can't rely on declaration order alone.
      Applied to ``config_class`` itself *and* to every nested model that lands in
      the schema's ``$defs`` — a model's declared/inherited field order isn't only
      relevant when it's the top-level schema, and Pydantic emits ``$defs`` entries
      in each nested model's own (potentially inheritance-skewed) field order too.
    - When ``configuration`` is None, sets ``enum: []`` on all ``x-dynamic`` properties
      so the frontend renders them as empty dropdowns

    Semantic layer implementations call this instead of
    ``model_json_schema()`` directly,
    then only need to add their own dynamic population logic.
    """
    schema = config_class.model_json_schema()

    _reorder(schema, _resolve_field_order(config_class, schema))

    defs = schema.get("$defs", {})
    for nested_cls in _iter_nested_models(config_class, seen=set()):
        if nested_cls is config_class:
            continue
        def_entry = defs.get(nested_cls.__name__)
        if def_entry is None:
            continue
        _reorder(def_entry, _resolve_field_order(nested_cls, def_entry))

    if configuration is None:
        for prop_schema in schema["properties"].values():
            if prop_schema.get("x-dynamic"):
                prop_schema["enum"] = []

    return schema
```

Note: `Any`/`get_args`/`get_origin`/`Iterator` replace the file's original
`from typing import Any` import.

- [x] **Step 4: Run tests to verify they pass**

Run: `venv/bin/python3 -m pytest tests/unit_tests/semantic_layers/config_test.py -v`
Expected: all 5 PASS. Confirmed.

- [x] **Step 5: Run the full existing widgets suite to confirm no regression**

Run: `venv/bin/python3 -m pytest tests/unit_tests/widgets/ tests/unit_tests/mcp_service/widgets/ -v`
Expected: all PASS unchanged (no model in this codebase sets `field_order` yet, so every existing call falls into the `else` branch, byte-identical to before). Confirmed: 29 passed.

- [x] **Step 5b: mypy**

`isinstance(annotation, type) and issubclass(annotation, BaseModel)` alone
did not narrow `annotation`'s type enough for mypy to allow
`annotation.model_fields` (`error: "type" has no attribute "model_fields"
[attr-defined]`) — fixed by binding to an explicitly-annotated local,
`model_cls: type[BaseModel] = annotation`, before using it. Confirmed
`pre-commit run mypy` passes after this fix.

- [x] **Step 6: Commit**

```bash
git add superset-core/src/superset_core/semantic_layers/config.py tests/unit_tests/semantic_layers/config_test.py
git commit -m "feat(dashboard-v2): add field_order override to build_configuration_schema"
```

---

## Task 2: `MetricControl` composite-control registry

**Files:**
- Create: `superset-core/src/superset_core/widgets/composites.py`
- Modify: `superset-core/src/superset_core/widgets/__init__.py`
- Test: `tests/unit_tests/widgets/test_composites.py` (new)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `superset_core.widgets.MetricControl` (a `BaseModel` subclass with a single `metrics: list[Any]` field, `x-control: "metric-multi"`), `superset_core.widgets.composite_control` (decorator), `superset_core.widgets.list_composite_controls() -> Mapping[str, CompositeControlInfo]`. Task 3 imports `MetricControl` from `superset_core.widgets`.

- [x] **Step 1: Write the failing tests**

Create `tests/unit_tests/widgets/test_composites.py`:

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

from types import MappingProxyType

import pytest
from pydantic import BaseModel
from superset_core.widgets import (
    composite_control,
    list_composite_controls,
    MetricControl,
)
from superset_core.widgets.composites import _registry


def test_metric_control_is_registered() -> None:
    info = list_composite_controls()["metric"]
    assert info.name == "metric"
    assert info.model is MetricControl


def test_metric_control_declares_metric_multi_field() -> None:
    schema = MetricControl.model_json_schema()
    assert schema["properties"]["metrics"]["x-control"] == "metric-multi"


def test_list_composite_controls_is_read_only() -> None:
    result = list_composite_controls()
    assert isinstance(result, MappingProxyType)
    with pytest.raises(TypeError):
        result["metric"] = None  # type: ignore[index]


def test_composite_control_registers_new_entry() -> None:
    @composite_control(name="test-only", title="Test Only", description="...")
    class _TestOnly(BaseModel):
        value: int = 0

    try:
        info = list_composite_controls()["test-only"]
        assert info.title == "Test Only"
        assert info.model is _TestOnly
    finally:
        _registry.pop("test-only", None)


def test_composite_control_duplicate_name_raises() -> None:
    @composite_control(name="dup-test", title="Dup", description="...")
    class _First(BaseModel):
        value: int = 0

    try:
        with pytest.raises(ValueError, match="already registered"):

            @composite_control(name="dup-test", title="Dup2", description="...")
            class _Second(BaseModel):
                value: int = 0

    finally:
        _registry.pop("dup-test", None)
```

- [x] **Step 2: Run tests to verify they fail**

Run: `venv/bin/python3 -m pytest tests/unit_tests/widgets/test_composites.py -v`
Expected: FAIL with `ModuleNotFoundError` / `ImportError` (`superset_core.widgets.composites` doesn't exist yet).

- [x] **Step 3: Create `superset-core/src/superset_core/widgets/composites.py`**

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
        "Reusable metric-list field (saved-metric names or ad-hoc SIMPLE "
        "aggregates)."
    ),
)
class MetricControl(BaseModel):
    """Mixin providing a ``metrics`` field, extracted verbatim from
    ``DataBinding`` for reuse outside it."""

    model_config = ConfigDict(populate_by_name=True)

    metrics: list[Any] = Field(
        title="Metrics",
        description=(
            "Metrics to fetch. Each entry is EITHER a string naming a saved "
            'metric on the dataset (e.g. "count"), OR an ad-hoc aggregate '
            "object of the shape "
            '{"expressionType": "SIMPLE", "column": {"column_name": "<col>"}, '
            '"aggregate": "SUM"|"AVG"|"COUNT"|"COUNT_DISTINCT"|"MIN"|"MAX", '
            '"label": "<optional display label>"}. Do not pass a raw SQL string '
            'like "SUM(sales)" — a plain string is looked up as a saved-metric '
            "name, not evaluated as an expression."
        ),
        json_schema_extra={"x-control": "metric-multi", "x-language": "json"},
    )
```

- [x] **Step 4: Re-export from `superset-core/src/superset_core/widgets/__init__.py`**

```python
from superset_core.widgets.base import Widget as Widget
from superset_core.widgets.composites import (
    composite_control as composite_control,
    list_composite_controls as list_composite_controls,
    MetricControl as MetricControl,
)
from superset_core.widgets.decorators import widget as widget
```

- [x] **Step 5: Run tests to verify they pass**

Run: `venv/bin/python3 -m pytest tests/unit_tests/widgets/test_composites.py -v`
Expected: all 5 PASS. Confirmed.

- [x] **Step 6: Commit**

```bash
git add superset-core/src/superset_core/widgets/composites.py superset-core/src/superset_core/widgets/__init__.py tests/unit_tests/widgets/test_composites.py
git commit -m "feat(dashboard-v2): add composite control registry with MetricControl"
```

---

## Task 3: `DataBinding` composes `MetricControl`

**Files:**
- Modify: `superset/widgets/controls.py:33-77` (the `DataBinding` class)
- Modify: `tests/unit_tests/widgets/test_registry.py` (add the golden-fixture test)

**Interfaces:**
- Consumes: `superset_core.widgets.MetricControl` (Task 2), `build_configuration_schema`'s `field_order` support (Task 1).
- Produces: nothing new — `DataBinding`'s public shape (the served schema) is unchanged by definition; this task's entire purpose is proving that.

- [x] **Step 1: Write the failing golden-fixture test**

Append to `tests/unit_tests/widgets/test_registry.py` (uses the `_block` helper already defined at the top of that file):

```python
def test_data_binding_schema_is_unchanged_after_metric_control_extraction() -> None:
    # Golden fixture captured from `main` before DataBinding composed
    # MetricControl, via `registry.get("metric-tile").get_control_schema(None, None)`.
    # Guards against both the extraction itself and the field_order fix
    # regressing the served schema — checked at the same boundary the
    # Inspector and MCP tools consume, not just raw model_json_schema().
    schema = _block("metric-tile").get_control_schema(None, None)
    data_binding = schema["$defs"]["DataBinding"]

    assert list(data_binding["properties"]) == [
        "datasetId",
        "metrics",
        "dimensions",
        "rowLimit",
    ]
    assert data_binding["required"] == ["datasetId", "metrics"]
    assert data_binding["properties"]["metrics"] == {
        "description": (
            "Metrics to fetch. Each entry is EITHER a string naming a saved "
            'metric on the dataset (e.g. "count"), OR an ad-hoc aggregate '
            "object of the shape "
            '{"expressionType": "SIMPLE", "column": {"column_name": "<col>"}, '
            '"aggregate": "SUM"|"AVG"|"COUNT"|"COUNT_DISTINCT"|"MIN"|"MAX", '
            '"label": "<optional display label>"}. Do not pass a raw SQL string '
            'like "SUM(sales)" — a plain string is looked up as a saved-metric '
            "name, not evaluated as an expression."
        ),
        "items": {},
        "title": "Metrics",
        "type": "array",
        "x-control": "metric-multi",
        "x-language": "json",
    }
    assert data_binding["properties"]["datasetId"] == {
        "description": "Numeric id of the dataset to query.",
        "title": "Dataset ID",
        "type": "integer",
    }
    assert data_binding["properties"]["dimensions"] == {
        "description": "Columns to group by (the categories / series).",
        "items": {"type": "string"},
        "title": "Dimensions",
        "type": "array",
        "x-control": "column-multi",
    }
    assert data_binding["properties"]["rowLimit"] == {
        "default": 1000,
        "description": "Maximum number of rows to fetch.",
        "minimum": 1,
        "title": "Row limit",
        "type": "integer",
    }
```

Also add the MCP-boundary variant, exercising the other consumer of the same
schema — **note this is not a `$defs` lookup**: verified directly that the
MCP tool's minimal-viable pruning (`schema_tools.py`) inlines a *mandatory*
nested object (like `dataBinding`) recursively rather than leaving a `$ref`
into `$defs`, so all four properties land under
`result["properties"]["dataBinding"]["properties"]` instead:

```python
def test_data_binding_schema_unchanged_via_mcp_boundary() -> None:
    from superset.mcp_service.widgets.tool.get_widget_control_schema import (
        _get_widget_control_schema_impl,
    )

    # dataBinding is mandatory, so the minimal-viable pruning inlines it
    # (recursing into its own mandatory leaves) rather than leaving a $ref
    # into $defs -- a different code path through schema_tools.py than the
    # REST/get_control_schema boundary above, so this exercises the field
    # order fix against progressive disclosure too.
    result = _get_widget_control_schema_impl("metric-tile")
    data_binding = result["properties"]["dataBinding"]
    assert list(data_binding["properties"]) == [
        "datasetId",
        "metrics",
        "dimensions",
        "rowLimit",
    ]
```

- [x] **Step 2: Run tests to verify they fail**

Run: `venv/bin/python3 -m pytest tests/unit_tests/widgets/test_registry.py -v -k data_binding_schema`
Expected: PASS actually — `DataBinding` hasn't changed yet, so this documents
current behavior. This is expected; the point of Step 1 here is to capture
the golden fixture *before* touching `DataBinding`, not to see it fail. Confirm
both new tests pass before proceeding to Step 3.

- [x] **Step 3: Refactor `DataBinding` in `superset/widgets/controls.py`**

Change the imports at the top of the file to add:

```python
from typing import Any, ClassVar

from superset_core.widgets import MetricControl
```

Replace the `DataBinding` class body:

```python
class DataBinding(MetricControl):
    """Query binding for a data-backed widget (mirrors the frontend
    ``DataBindingSpec``). ``datasetId`` and ``metrics`` are mandatory; the rest
    are optional."""

    model_config = ConfigDict(populate_by_name=True)

    # Pydantic places an inherited field (``metrics``, from ``MetricControl``)
    # ahead of this class's own fields in ``model_fields`` regardless of
    # declaration order, so the rendered field order needs to be pinned
    # explicitly to match what this class served before the extraction.
    field_order: ClassVar[list[str]] = [
        "datasetId",
        "metrics",
        "dimensions",
        "rowLimit",
    ]

    dataset_id: int = Field(
        alias="datasetId",
        title="Dataset ID",
        description="Numeric id of the dataset to query.",
    )
    dimensions: list[str] = Field(
        default_factory=list,
        title="Dimensions",
        description="Columns to group by (the categories / series).",
        json_schema_extra={"x-control": "column-multi"},
    )
    row_limit: int = Field(
        default=1000,
        ge=1,
        alias="rowLimit",
        title="Row limit",
        description="Maximum number of rows to fetch.",
    )
```

Remove the now-unused `metrics` field declaration that previously lived on
`DataBinding` (it's inherited from `MetricControl` instead).

- [x] **Step 4: Run tests to verify they pass**

Run: `venv/bin/python3 -m pytest tests/unit_tests/widgets/test_registry.py -v -k data_binding_schema`
Expected: both tests still PASS — now proving the *post-refactor* schema
matches the golden fixture, not just documenting the pre-refactor one.
Confirmed — including after fixing the MCP-boundary test's assertion path
(see the note above the test).

- [x] **Step 5: Run the full widgets + MCP widget-tool test suites**

Run: `venv/bin/python3 -m pytest tests/unit_tests/widgets/ tests/unit_tests/mcp_service/widgets/ tests/unit_tests/semantic_layers/ -v`
Expected: all PASS, no fixture or assertion needed updating anywhere else
(per spec, this is the non-breaking proof). Confirmed: 431 passed.

- [x] **Step 6: Run mypy on the touched files**

Run: `pre-commit run mypy --files superset/widgets/controls.py superset-core/src/superset_core/widgets/composites.py superset-core/src/superset_core/widgets/__init__.py superset-core/src/superset_core/semantic_layers/config.py`
(No standalone `mypy` module is installed in any local venv — `pre-commit run
mypy` is the only working invocation; it runs mypy in its own managed
environment.)
Expected: no errors. Confirmed, after the Task 1 narrowing fix.

- [x] **Step 7: Commit**

```bash
git add superset/widgets/controls.py tests/unit_tests/widgets/test_registry.py
git commit -m "refactor(dashboard-v2): compose DataBinding.metrics from MetricControl"
```

---

## Final Verification

- [x] Run `pre-commit run --files <all touched files>` and fix anything it flags. Confirmed clean (auto-walrus, mypy, ruff-format, ruff, pylint all pass; ruff/ruff-format auto-fixed import order and a walrus-operator simplification in `config.py` along the way — re-verify tests after any auto-fix, since files change on disk).
- [x] Run the full backend unit suite once more: `venv/bin/python3 -m pytest tests/unit_tests/widgets/ tests/unit_tests/mcp_service/widgets/ tests/unit_tests/semantic_layers/ -v` — 431 passed.
- [x] Confirm no frontend files were touched: `git status --porcelain -- superset-frontend/` — empty. Confirmed.
