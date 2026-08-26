# Composite Control Registry — Design

**Status:** Approved for planning
**Branch:** `enxdev/poc/dashboard-v2-editing-ui-flow`
**Date:** 2026-08-26

## Problem

Dashboard V2's widget control panels are schema-driven end to end: a backend
`Widget.controls_class` (a Pydantic model) becomes a JSON Schema served at
`/api/v1/widgets/type/<widget_type>/control-schema`, rendered generically by
JsonForms in the Inspector's Form tab
([SchemaControlPanel.tsx](../../../superset-frontend/src/pages/DashboardBuilderV2/SchemaControlPanel.tsx))
and consumed identically by MCP tools
([get_widget_control_schema.py](../../../superset/mcp_service/widgets/tool/get_widget_control_schema.py)).

Today, reuse across widget control models is achieved only by importing a
`BaseModel` subclass and nesting it as a field — e.g.
[`DataBinding`](../../../superset/widgets/controls.py) is imported and nested
under `data_binding` in `MetricTileControls`, `AgGridTableControls`,
`BalloonsControls`, and `EchartsControls`. This works, but:

- There's no way to reuse a *field-level* building block (like the `metrics`
  picker) without pulling in everything else nested alongside it in whatever
  model first defined it.
- There's no registry of what reusable building blocks exist, so an extension
  author (or an agent) has no way to discover "what composable controls does
  Superset ship" short of reading `controls.py` source.

The immediate driver is `DataBinding.metrics` — a `list[Any]` field tagged
`x-control: "metric-multi"` — which is functionally complete (saved-metric
names, ad-hoc SIMPLE aggregates, JSON fallback for anything richer) but is
locked inside `DataBinding` with no way to reuse just the metric-picking piece
in a widget that doesn't want the rest of `DataBinding`'s shape.

## Scope

In scope: a general mechanism for defining and registering a **composite
control** (a reusable Pydantic field-bearing mixin), and using it to extract
`metrics` into a standalone `MetricControl` as the first (and for this slice,
only) instance.

Explicitly out of scope, deferred to follow-up specs:
- A dependency graph between controls with circular-dependency detection
  (today's `x-dependsOn` / `check_dependencies` only checks truthiness of
  named attributes — no graph, no ordering, no cycle detection).
- A formal contract for how provided values, defaults, and control-generated
  values (like `BalloonsControls.enrich_schema`'s per-series population) are
  propagated and validated.
- Any new metric capability (SQL-expression ad-hoc metrics, etc.) — this is a
  refactor for reusability, not a capability change. `MetricControl`'s
  `metrics` field is moved verbatim from `DataBinding`, not extended.
- Any frontend change. The rendering path
  (`MetricMultiControl` / `ReferenceMultiList` in
  [schemaControlRenderers.tsx](../../../superset-frontend/src/pages/DashboardBuilderV2/schemaControlRenderers.tsx))
  keys off the `x-control` value and field name, both unchanged by this
  refactor.

## Approach

**Mixin composition, not nested-object composition.** `DataBinding.metrics` is
read as a *flat* field in several places — `SchemaControlPanel.tsx:122`
(`binding.metrics?.length`), `chartData.ts:67` (`binding.metrics`), and the
`DataBindingSpec` TypeScript type — so wrapping `metrics` in a new nested
object (e.g. `dataBinding.metricControl.metrics`) would be a breaking
schema-shape change requiring frontend updates. Pydantic supports composing a
model from multiple `BaseModel` base classes and flattens their fields into
one schema with no nesting, which avoids this entirely: `DataBinding` becomes
```python
class DataBinding(BaseModel, MetricControl):
    ...  # dataset_id, dimensions, row_limit — metrics no longer declared here
```
and `model_json_schema()`'s output for `DataBinding` is unchanged — same
property set, same order (once reordered by
`build_configuration_schema`), same `x-control` extras.

**Registry for discovery, not for composition.** Composing a composite
control into a widget is plain Python inheritance/import — no runtime lookup
is involved. A `@composite_control(name, title, description)` decorator
(mirroring the existing `@widget` → `superset/widgets/registry.py` pattern)
registers each composite class into a module-level dict purely so tooling
(docs generation, an MCP "list composite controls" tool, future
extension-author documentation) can enumerate what's available without
grepping source. This mirrors how `@widget` registration and widget discovery
already work in this codebase, so it's a familiar idiom rather than a new one.

Two alternatives were considered and rejected:
- **Reusable `Annotated` field type** (e.g. `MetricList = Annotated[list[Any],
  Field(...)]`) — avoids nesting equally well, but isn't a `BaseModel`
  subclass, so it can't hold validators or be registered/discovered the same
  way `Widget` subclasses are; inconsistent with the codebase's established
  class+registry idiom.
- **Registry of field-factories** (a decorator on a function returning
  `(type, FieldInfo)`, looked up by name at model-definition time) — more
  machinery than this slice needs; the "simple import" requirement is better
  served by importing a class and inheriting from it directly.

## Design

### `superset_core/widgets/composites.py` (new)

```python
registry: dict[str, type[BaseModel]] = {}

def composite_control(
    name: str, title: str, description: str
) -> Callable[[type[BaseModel]], type[BaseModel]]:
    """Register a reusable Pydantic mixin as a discoverable composite control.

    Composing one into a widget's controls_class is plain inheritance —
    this decorator only makes the class discoverable via `registry`."""
    def decorator(cls: type[BaseModel]) -> type[BaseModel]:
        if name in registry:
            raise ValueError(f"composite control {name!r} already registered")
        registry[name] = cls
        return cls
    return decorator


@composite_control(
    name="metric",
    title="Metrics",
    description="Reusable metric-list field (saved-metric names or ad-hoc "
    "SIMPLE aggregates).",
)
class MetricControl(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    metrics: list[Any] = Field(
        title="Metrics",
        description="...",  # moved verbatim from DataBinding
        json_schema_extra={"x-control": "metric-multi", "x-language": "json"},
    )
```

This lives in `superset_core` (not `superset/widgets/`) because it's meant for
extension authors composing their own widget control models, the same
audience `superset_core.widgets.Widget`/`@widget` already serve — not just
Superset's own built-ins.

### `superset/widgets/controls.py` (changed)

`DataBinding` drops its inline `metrics: list[Any] = Field(...)` declaration
and instead:
```python
from superset_core.widgets.composites import MetricControl

class DataBinding(BaseModel, MetricControl):
    model_config = ConfigDict(populate_by_name=True)

    dataset_id: int = Field(alias="datasetId", ...)
    dimensions: list[str] = Field(default_factory=list, ...)
    row_limit: int = Field(default=1000, alias="rowLimit", ...)
```

No other file in `superset/widgets/` or `superset-frontend/` changes.

## Testing

- **Schema-identity test**: assert `DataBinding.model_json_schema()` (post
  `build_configuration_schema` reordering) is unchanged before/after —
  same properties, same order, same `required`, same `x-control` extras on
  `metrics`. This is the load-bearing test: it's what proves the refactor is
  non-breaking rather than merely "looks equivalent."
- **Registry unit tests**: registering a composite control, duplicate-name
  registration raises, `MetricControl` is present in `registry["metric"]`.
- **Existing widget tests** (`MetricTile`, `AgGridTable`, `Balloons`,
  `Echarts`, and their control-schema API/MCP tests) run unchanged — no
  fixture or assertion should need updating, since the served schema doesn't
  move.
- No frontend test changes expected.

## Follow-ups (separate specs)

- Dependency graph between controls: propagation ordering when one control's
  change should update another, plus circular-dependency detection. Builds on
  `x-dependsOn` but needs an actual graph, not per-field truthiness checks.
- A propagation/validation contract: how a provided value, a schema default,
  and a control-generated value (`enrich_schema`-style) interact and validate
  against each other.
- Whether other existing nested models (`Customization`, or future ones)
  should be retrofitted as registered composite controls, once there's a
  second real consumer beyond `MetricControl`.
