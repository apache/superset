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
`x-control: "metric-multi"` — which preserves today's existing behavior
(saved-metric names, ad-hoc SIMPLE aggregates, JSON fallback for anything
richer) but is locked inside `DataBinding` with no way to reuse just the
metric-picking piece in a widget that doesn't want the rest of `DataBinding`'s
shape. It does not give a headless consumer a structured description of what
a valid ad-hoc metric object looks like (that's still `Any` under the hood);
typed ad-hoc metric schemas are a possible future improvement, not part of
this extraction.

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
- Composing *multiple* composite controls into one model (multiple
  inheritance across two or more registered mixins). This slice only
  exercises one composite (`MetricControl`) composed into one widget model
  (`DataBinding`) via single inheritance. Field-name collision detection,
  `model_config` merge rules, and validator-ordering across composites are
  real open questions once a second composite exists to motivate them —
  solving them speculatively now, with only one composite in existence,
  would be guessing at a contract with no real case to validate it against.
  Composing two registered composites together is unsupported until a
  follow-up spec defines that contract.

This slice establishes reusable schema composition and discovery. It does
not, on its own, solve dynamic headless control behavior (dependent-control
propagation, cycle detection) — that remains fully deferred, below.

## Approach

**Mixin composition, not nested-object composition.** `DataBinding.metrics` is
read as a *flat* field in several places — `SchemaControlPanel.tsx:122`
(`binding.metrics?.length`), `chartData.ts:67` (`binding.metrics`), and the
`DataBindingSpec` TypeScript type — so wrapping `metrics` in a new nested
object (e.g. `dataBinding.metricControl.metrics`) would be a breaking
schema-shape change requiring frontend updates. Pydantic supports composing a
model by inheriting from a `BaseModel` subclass and flattens the parent's
fields into the subclass's schema with no nesting, which avoids this
entirely: `DataBinding` becomes
```python
class DataBinding(MetricControl):
    ...  # dataset_id, dimensions, row_limit — metrics no longer declared here
```
(single inheritance from `MetricControl`, which itself already subclasses
`BaseModel` — inheriting from both `BaseModel` and `MetricControl` at once
raises `TypeError: Cannot create a consistent method resolution order`,
confirmed against pydantic directly; `MetricControl` alone is both necessary
and sufficient as the base) and `model_json_schema()`'s property *set* and
`x-control` extras for `DataBinding` are unchanged.

**Field order needs an explicit override — inheritance order is not enough.**
Pydantic always collects a base class's fields into `model_fields` ahead of
the subclass's own fields, regardless of where the subclass redeclares them —
confirmed directly: a subclass inheriting `metrics` from `MetricControl` gets
field order `metrics, dataset_id, dimensions, row_limit`, not today's
`dataset_id, metrics, dimensions, row_limit`, even when `metrics` is
redeclared at its original position in the subclass body. This isn't
cosmetic: `build_configuration_schema` restores model-field order specifically
so JsonForms renders fields in the author's intended order, so an
uncorrected reorder would visibly move the Metrics control ahead of the
Dataset picker in the Inspector form.

So `build_configuration_schema` gains an explicit, opt-in override: a model
may declare `field_order: ClassVar[list[str]]` naming its properties (by
alias) in the order they should render; when present,
`build_configuration_schema` uses that list instead of deriving order from
`model_fields`, and raises `ValueError` if it isn't an exact permutation of
the schema's property names (a declared order that's missing or misnames a
property is a bug worth failing loudly on, not silently dropping fields from
the rendered form). When absent, behavior is unchanged from today
(derive order from `model_fields`) — every other consumer of
`build_configuration_schema` (there are none today outside
`Widget.get_control_schema`, confirmed by repo-wide search, so this is
low-risk) keeps working exactly as before. `DataBinding` declares
```python
field_order: ClassVar[list[str]] = ["datasetId", "metrics", "dimensions", "rowLimit"]
```
— deliberately preserving today's exact order, so this remains a
strictly non-breaking refactor and not an incidental UX change.

**Registry for discovery, not for composition.** Composing a composite
control into a widget is plain Python inheritance/import — no runtime lookup
is involved. A `@composite_control(name, title, description)` decorator
(mirroring the existing `@widget` → `superset/widgets/registry.py` pattern)
registers each composite class, *with* its `name`/`title`/`description`, into
a module-level store purely so tooling (docs generation, an MCP "list
composite controls" tool, future extension-author documentation) can
enumerate what's available without grepping source — discovery needs the
metadata, not just the class object. This mirrors how `@widget` registration
and widget discovery already work in this codebase, so it's a familiar idiom
rather than a new one.

Registration is a decorator side effect, exactly like `@widget`: a composite
control is only in the registry once its defining module has been imported
(see `superset/widgets/builtin.py`'s "Importing this registers them"). This
applies equally to extension-defined composites — an extension's composite
won't appear in MCP/docs discovery until something imports that extension's
module, the same constraint `inject_widget_implementations` already handles
for widgets.

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

### `superset_core/semantic_layers/config.py` (changed)

`build_configuration_schema` gains an explicit field-order override:

```python
def build_configuration_schema(
    config_class: type[BaseModel],
    configuration: BaseModel | None = None,
) -> dict[str, Any]:
    schema = config_class.model_json_schema()

    declared_order = getattr(config_class, "field_order", None)
    if declared_order is not None:
        declared = set(declared_order)
        actual = set(schema["properties"])
        if declared != actual:
            raise ValueError(
                f"{config_class.__name__}.field_order must be a permutation "
                f"of its schema properties; declared={sorted(declared)} "
                f"actual={sorted(actual)}"
            )
        field_order = declared_order
    else:
        # Unchanged from today: Pydantic sorts properties alphabetically,
        # so restore model field declaration order absent an override.
        field_order = [
            field.alias or name for name, field in config_class.model_fields.items()
        ]

    schema["properties"] = {
        key: schema["properties"][key]
        for key in field_order
        if key in schema["properties"]
    }

    if configuration is None:
        for prop_schema in schema["properties"].values():
            if prop_schema.get("x-dynamic"):
                prop_schema["enum"] = []

    return schema
```

`field_order` is looked up with `getattr`, not a required base-class field, so
every existing model without it is unaffected — this is additive, not a
signature change.

### `superset_core/widgets/composites.py` (new)

```python
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

    Composing one into a widget's controls_class is plain inheritance —
    this decorator only makes the class discoverable via
    `list_composite_controls()`."""
    def decorator(cls: type[BaseModel]) -> type[BaseModel]:
        if name in _registry:
            raise ValueError(f"composite control {name!r} already registered")
        _registry[name] = CompositeControlInfo(name, title, description, cls)
        return cls
    return decorator


def list_composite_controls() -> Mapping[str, CompositeControlInfo]:
    """Read-only view of registered composite controls, for docs/MCP
    discovery. Extension-defined composites appear only once their
    defining module has been imported (decorator side effect, same as
    `@widget`)."""
    return MappingProxyType(_registry)


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
Superset's own built-ins. `superset_core/widgets/__init__.py` re-exports
`MetricControl`, `composite_control`, and `list_composite_controls` using the
codebase's existing redundant-alias re-export idiom (`X as X`, e.g.
`from superset_core.widgets.composites import MetricControl as MetricControl`),
matching how `Widget`/`@widget` are already exposed, so consumers write
`from superset_core.widgets import MetricControl` rather than reaching into
the `composites` submodule directly. The underlying `_registry` dict is not
exported; `list_composite_controls()` is the public discovery surface, so
extension authors can't accidentally mutate the shared store.

### `superset/widgets/controls.py` (changed)

`DataBinding` drops its inline `metrics: list[Any] = Field(...)` declaration
and instead:
```python
from typing import ClassVar

from superset_core.widgets import MetricControl

class DataBinding(MetricControl):
    model_config = ConfigDict(populate_by_name=True)

    field_order: ClassVar[list[str]] = ["datasetId", "metrics", "dimensions", "rowLimit"]

    dataset_id: int = Field(alias="datasetId", ...)
    dimensions: list[str] = Field(default_factory=list, ...)
    row_limit: int = Field(default=1000, alias="rowLimit", ...)
```

No other file in `superset/widgets/` or `superset-frontend/` changes.

## Testing

- **Schema-identity test**: a golden fixture — the literal JSON Schema dict
  for `DataBinding`, captured from `main` before this refactor lands — checked
  into the test file and asserted equal (properties, order, `required`,
  defaults, aliases, and `x-control`/`x-language` extras on `metrics`)
  against the post-refactor output. "Before vs. after in the same PR" isn't
  enough on its own since both sides would be written by the same change;
  the frozen fixture is what makes the comparison meaningful. Assert this at
  the actual API/MCP boundary — the served
  `/api/v1/widgets/type/metric-tile/control-schema` response and
  `get_widget_control_schema`'s output — not just the raw
  `model_json_schema()` call, so a regression introduced by
  `schema_tools.py`'s progressive-disclosure layer would also be caught, not
  just one in the raw Pydantic schema.
- **Registry unit tests**: registering a composite control, duplicate-name
  registration raises, `MetricControl` is present in
  `list_composite_controls()["metric"]` with the expected `title`/
  `description`, and the returned mapping is not mutable by callers.
- **`build_configuration_schema` field-order tests**: a model with no
  `field_order` behaves exactly as today (regression coverage for the
  existing behavior this change extends); a model with `field_order` set
  gets properties in exactly that order; a model with `field_order` missing
  or misnaming a property raises `ValueError` naming the mismatch. Directly
  exercises the mechanism that makes the `DataBinding` order fix correct,
  independent of `DataBinding` itself.
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
