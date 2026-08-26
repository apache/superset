# Control Dependency Graph — Design

**Status:** Approved for planning
**Branch:** `enxdev/poc/dashboard-v2-editing-ui-flow`
**Date:** 2026-08-26

## Problem

Dashboard V2's control schemas support a single dynamic field today:
`BalloonsControls.Customization.series`
([superset/widgets/controls.py](../../../superset/widgets/controls.py)),
tagged `x-dynamic: true` and `x-dependsOn: ["dataBinding"]`. It's populated by
`Balloons.enrich_schema`
([superset/widgets/builtin.py](../../../superset/widgets/builtin.py)), a
single classmethod hook every `Widget` subclass may override
([superset_core/widgets/base.py](../../../superset-core/src/superset_core/widgets/base.py)).
That hook hand-checks its own preconditions (`if not dimensions or not
series: return`) rather than using the schema's declared `x-dependsOn`.

`check_dependencies`
([superset_core/semantic_layers/config.py](../../../superset-core/src/superset_core/semantic_layers/config.py))
already exists to read an `x-dependsOn` list and check truthiness against the
parsed control values — but it is dead code, never called anywhere in the
codebase (confirmed by repo-wide search). There is exactly one dynamic field
in the entire codebase, so nothing today exercises multiple interdependent
dynamic fields, an evaluation order between them, or a cycle.

There is no concrete second use case driving this yet — this is groundwork
for the next widget that has multiple interdependent dynamic fields, so a
future widget author has a declarative mechanism to reach for instead of
reinventing `enrich_schema`'s ad hoc pattern, and so a cyclic mistake is
caught at import time rather than shipped.

## Scope

In scope: a mechanism for a widget to register more than one dynamic-field
enricher, each keyed to the schema field path it populates; deriving an
execution order and a dependency graph from the fields' existing
`x-dependsOn` declarations (no new declaration syntax); cycle detection at
widget-registration time; retiring `Widget.enrich_schema` in favor of this
mechanism, with `Balloons` retrofitted as the (only) proof case.

Out of scope:
- Any new dynamic field or widget capability — this is infrastructure,
  validated against Balloons' existing single dynamic field with no behavior
  change.
- Frontend changes. The served schema for `balloons` is unchanged by this
  work (same discipline as the composite-control-registry slice: golden
  fixture proves it).
- Incremental/partial recomputation. Every control-value change already
  triggers a full `get_control_schema(control_values, series)` recompute on
  the frontend
  ([SchemaControlPanel.tsx](../../../superset-frontend/src/pages/DashboardBuilderV2/SchemaControlPanel.tsx)) —
  "changing one control updates its dependents" already happens for free via
  full statelessness recompute. What this slice adds is strictly about
  *multiple dynamic fields within one recompute* needing to run in the right
  order and see each other's computed output, and about catching a
  self-referential mistake in that graph.
- A value-propagation/validation contract (how a provided value, a default,
  and a control-generated value interact) — still deferred to its own spec,
  per the composite-control-registry spec's Follow-ups section.

## Approach

**Derive the graph from the schema itself — one declaration, not two.**
`x-dependsOn` already exists on every dynamic field. The alternative —
a separate Python-level `enrichment_steps: ClassVar[list[EnrichmentStep]]`
declaration with its own `depends_on` list — was considered and rejected: it
would require a widget author to declare the same dependency twice (once in
the field's `x-dependsOn` for frontend/MCP visibility, once again in Python
for backend ordering), a duplication that drifts the moment one is updated
without the other. Deriving the graph from the schema means there is exactly
one place a dependency is ever written down.

This does mean `x-dependsOn` entries carry two possible meanings, disambiguated
by what they name:
- Names another **dynamic field's path** → an **ordering edge**: that field's
  enricher must run first, and this field's enricher receives its result.
- Names anything else (a plain field on the parsed control model) → a
  **gate**, exactly `check_dependencies`'s existing (currently unused)
  semantics: this field's enricher only runs once that named attribute is
  truthy on `parsed`.

Field paths use the `a/b` dot-path convention `schema_tools.py` already
established for drill-in paths
([get_subtree](../../../superset/widgets/schema_tools.py)), so there is one
path vocabulary across the widget-schema codebase, not two.

**Cycle detection at registration time, not request time.** The dependency
graph for a widget type is fully static — it's derived from the Pydantic
model's schema, which doesn't change between requests — so it can and should
be checked once, when the widget registers, exactly like `@widget`'s existing
duplicate-`widget_type` check
([superset/core/api/core_api_injection.py](../../../superset/core/api/core_api_injection.py)).
A cyclic dependency is an authoring mistake; it should fail the import, not
surface lazily on some future request with a stack overflow or silent
non-termination.

**Retire `Widget.enrich_schema` outright.** It has exactly one override in
the entire codebase (`Balloons`). Keeping it as a parallel escape hatch
alongside the new mechanism would mean documenting and maintaining two
patterns for one real use case; retiring it keeps the contract to one
pattern. (This framework is explicitly labeled experimental throughout its
own docstrings, so there is no external-extension compatibility promise being
broken here.)

## Design

Three corrections surfaced during implementation, verified directly rather
than assumed — the code below reflects what was actually built and shipped,
not the original draft:

1. **`EnricherFn` needs the whole schema, not just its own field's fragment.**
   Balloons' real enricher reads `schema["$defs"]["SeriesStyle"]`, a *sibling*
   `$defs` entry — unreachable from `Customization.series`'s own node alone.
   The signature is `(schema, node, parsed, series, upstream_results) -> Any`,
   not `(node, parsed, series, upstream_results) -> Any`.
2. **`check_dependencies` never actually worked.** It resolved an
   `x-dependsOn` entry (e.g. `"dataBinding"`, the schema-facing alias)
   directly as a `getattr` name against the parsed model — but Pydantic
   attribute access always uses the Python field name (`data_binding`), never
   the alias, even under `populate_by_name=True`. Confirmed directly:
   `getattr(parsed, "dataBinding", "MISSING")` returns `"MISSING"` on a real
   parsed instance. It had zero callers before this slice, so this was never
   exercised. Fixed to resolve alias → field name via `model_fields` first.
3. **The `x-dependsOn` gate is coarser than Balloons' actual guard, and stays
   that way.** `dataBinding` is a required field, so it's truthy whenever
   `parsed` exists at all — the gate can't express "`dimensions` is
   non-empty" (a nested attribute) or "`series` is non-empty" (a runtime
   parameter, not a field on `parsed`, so no `x-dependsOn` entry could ever
   name it). Balloons' enricher keeps its original fine-grained
   `if not dimensions or not series: return` guard unchanged; the schema-level
   gate is an additional coarse pre-filter that matters for the *new*
   multi-hop-ordering feature, not a replacement for a field's own logic.

### `superset_core/widgets/enrichment.py` (new)

```python
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


def dynamic_field_paths(schema: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Walk a built (pre-enrichment) control schema and return
    ``{path: schema_node}`` for every field carrying ``x-dynamic: true``,
    using ``a/b`` dot-path notation (``schema_tools.py``'s drill-in
    convention). Descends into ``properties`` and resolves ``$ref`` against
    ``$defs`` along the way."""


def build_dependency_graph(fields: dict[str, dict[str, Any]]) -> dict[str, list[str]]:
    """``{path: [ordering-edge paths]}`` for every dynamic field in
    ``fields`` — only ``x-dependsOn`` entries that name another key of
    ``fields`` become edges; every other entry is left as a gate for
    ``check_dependencies`` to evaluate at run time, not an edge here."""


def toposort_or_raise(graph: dict[str, list[str]], widget_type: str) -> list[str]:
    """Kahn's algorithm over ``graph``. Raises ``ValueError`` naming every
    field on the cycle when the graph isn't a DAG."""


def run_enrichers(
    schema: dict[str, Any],
    fields: dict[str, dict[str, Any]],
    order: list[str],
    enrichers: dict[str, EnricherFn],
    parsed: BaseModel | None,
    series: list[str],
) -> None:
    """Run each path's registered enricher (if any) in ``order``, skipping
    one whose non-edge ``x-dependsOn`` gate(s) aren't satisfied
    (``check_dependencies``), and threading each enricher's return value
    forward as ``upstream_results[path]`` for anything ordered after it."""
```

### `superset_core/semantic_layers/config.py` (changed)

`check_dependencies` resolves each `x-dependsOn` entry to its Pydantic field
name (via `model_fields`'s alias mapping) before `getattr`, instead of trying
the raw alias string directly — see correction 2 above. This is the first
real caller `check_dependencies` has ever had.

### `superset_core/widgets/base.py` (changed)

`Widget` gains:
```python
enrichers: ClassVar[dict[str, EnricherFn]] = {}
```
and `get_control_schema` replaces its `cls.enrich_schema(schema, parsed,
series or [])` call with the `dynamic_field_paths` → `build_dependency_graph`
→ `toposort_or_raise` → `run_enrichers` pipeline above. The `enrich_schema`
classmethod is removed from the base class entirely (not deprecated —
retired, per the Approach section).

### `superset/core/api/core_api_injection.py` (changed)

`inject_widget_implementations`'s `widget_impl` decorator, right after
`registry[key] = cls`, eagerly calls `cls.get_control_schema(None, None)` —
that call's own internal `toposort_or_raise` is what detects a cycle, so no
separate graph-building code is needed here; a `ValueError` propagates and
the widget is popped back out of the registry rather than left
half-registered. The static (`control_values=None`) schema is sufficient:
`x-dynamic`/`x-dependsOn` are schema-level declarations, not value-dependent,
so the graph is identical regardless of what control values a real request
would carry.

### `superset/widgets/builtin.py` (changed)

`Balloons.enrich_schema` becomes:
```python
class Balloons(Widget):
    controls_class = BalloonsControls
    PALETTE = [...]  # unchanged
    MAX_SERIES = 100  # unchanged

    @staticmethod
    def _populate_series(schema, node, parsed, series, upstream):
        style_def = schema.get("$defs", {}).get("SeriesStyle")
        if style_def is None:
            return
        # Gate (x-dependsOn: ["dataBinding"]) only confirms dataBinding was
        # parsed at all -- dimensions/series non-emptiness stay checked here,
        # unchanged from the original enrich_schema body (see correction 3).
        dimensions = None
        if parsed is not None:
            data_binding = getattr(parsed, "data_binding", None)
            dimensions = getattr(data_binding, "dimensions", None)
        if not dimensions or not series:
            return
        ...  # dedupe/cap/palette body, otherwise identical to before

    enrichers: ClassVar[dict[str, EnricherFn]] = {"customize/series": _populate_series}
```
`Customization.series`'s existing `x-dependsOn: ["dataBinding"]`
(`superset/widgets/controls.py`) is unchanged — `dataBinding` doesn't name
another dynamic-field path, so it resolves to a gate, now actually enforced
by the fixed `check_dependencies` rather than being dead code.

## Testing

- **`enrichment.py` unit tests** (new `tests/unit_tests/widgets/test_enrichment.py`):
  `dynamic_field_paths` against a schema with nested `x-dynamic` fields (including
  one inside `$defs`, mirroring `Customization.series`'s actual shape);
  `build_dependency_graph`'s path-vs-gate disambiguation (an entry naming a
  known dynamic path becomes an edge, an entry naming anything else doesn't);
  `toposort_or_raise` on a synthetic 3-node chain (correct order) and a
  synthetic 2-node cycle (raises, names both members); `run_enrichers`
  threading a synthetic upstream enricher's return value into a downstream
  one's `upstream_results` argument, proving the "sees already-computed
  values" claim isn't just asserted but actually exercised.
- **Registration-time cycle test**: two dynamic fields on a throwaway test
  widget whose `x-dependsOn` name each other raises at `@widget`-application
  time (import time), not on a later `get_control_schema` call — asserted by
  catching the exception around the class definition itself, not around a
  later method call.
- **Balloons regression, golden-fixture discipline**: existing
  `test_builtin.py`/`test_registry.py` Balloons tests (series population
  across the empty/dimension-only/series-only/both states, `x-control`
  extras, base schema shape) pass unchanged after the retrofit — proving the
  new mechanism reproduces `enrich_schema`'s exact prior behavior for the one
  real case, not just that it runs without erroring.

## Follow-ups (separate specs)

- A value-propagation/validation contract (provided value vs. default vs.
  control-generated value) — unchanged from the composite-control-registry
  spec's Follow-ups, still not addressed by this slice.
- Whether a second real widget with genuinely interdependent dynamic fields
  ever arrives to validate this mechanism beyond the single-field Balloons
  retrofit — this spec is deliberately built and tested against synthetic
  multi-field cases in `test_enrichment.py` precisely because no real
  second case exists yet.
