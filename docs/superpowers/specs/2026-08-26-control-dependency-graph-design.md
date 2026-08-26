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

### `superset_core/widgets/enrichment.py` (new)

```python
from __future__ import annotations

from typing import Any, Callable

from pydantic import BaseModel

# (schema_node_to_mutate, parsed, series, upstream_results) -> None.
# Mutates schema_node (the dynamic field's own schema fragment) in place.
# upstream_results holds whatever each already-run upstream enricher chose to
# record, keyed by its own field path — how a downstream enricher reads an
# upstream one's *computed* output rather than re-deriving it from parsed.
EnricherFn = Callable[
    [dict[str, Any], "BaseModel | None", list[str], dict[str, Any]], Any
]


def dynamic_field_paths(schema: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Walk a built (pre-enrichment) control schema and return
    ``{path: schema_node}`` for every field carrying ``x-dynamic: true``,
    using ``schema_tools.py``'s ``a/b`` path convention. Resolves ``$ref``
    along the way so each returned node is the field's own fragment."""


def build_dependency_graph(
    schema: dict[str, Any], fields: dict[str, dict[str, Any]]
) -> dict[str, list[str]]:
    """``{path: [ordering-edge paths]}`` for every dynamic field in
    ``fields`` — only ``x-dependsOn`` entries that name another key of
    ``fields`` become edges; every other entry is a gate, not an edge, and is
    left for ``check_dependencies`` to evaluate at run time."""


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
    one whose gate(s) aren't satisfied (``check_dependencies``), and
    threading each enricher's return value forward as
    ``upstream_results[path]`` for anything ordered after it."""
```

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

`inject_widget_implementations`'s `widget_impl` (the concrete `@widget`
decorator body), after registering a widget class into the host registry,
additionally calls `get_control_schema(None, None)` on it and runs
`dynamic_field_paths` → `build_dependency_graph` → `toposort_or_raise`
against the result, letting `ValueError` propagate — a cyclic widget fails
import exactly like a duplicate `widget_type` does today. The static
(`control_values=None`) schema is sufficient: `x-dynamic`/`x-dependsOn` are
schema-level declarations, not value-dependent, so the graph is identical
regardless of what control values a real request would carry.

### `superset/widgets/builtin.py` (changed)

`Balloons.enrich_schema` becomes:
```python
class Balloons(Widget):
    controls_class = BalloonsControls
    PALETTE = [...]  # unchanged
    MAX_SERIES = 100  # unchanged

    @staticmethod
    def _populate_series(node, parsed, series, upstream):
        # identical body to today's enrich_schema, minus the
        # `if not dimensions or not series: return` guard — that
        # precondition is now expressed by Customization.series's existing
        # x-dependsOn: ["dataBinding"] gate, enforced by run_enrichers
        # before this is ever called.
        ...

    enrichers: ClassVar[dict[str, EnricherFn]] = {"customize/series": _populate_series}
```
`Customization.series`'s existing `x-dependsOn: ["dataBinding"]`
(`superset/widgets/controls.py`) is unchanged — `dataBinding` doesn't name
another dynamic-field path, so it resolves to a gate exactly as it does
conceptually today, just now actually enforced by `check_dependencies`
instead of hand-rolled in `enrich_schema`.

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
