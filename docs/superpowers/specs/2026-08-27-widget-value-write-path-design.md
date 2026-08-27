# Widget Value Write Path (`set_widget_control_values`) — Design

**Status:** Approved for planning
**Branch:** `enxdev/poc/dashboard-v2-editing-ui-flow`
**Date:** 2026-08-27

## Problem

The original ask ("define how provided values, defaults, and control-generated
values are propagated and validated") assumed infrastructure that doesn't
exist. Verified directly: Dashboard V2's node tree (`node.props`) lives only
in the frontend's in-memory `DashboardProvider` singleton, whose own docstring
says "No persistence." `Widget.validate_control_values` — the commit-time
strict-validation gate — has exactly one caller in the whole codebase (the
`/type/<widget_type>/validate` REST endpoint's own handler), and nothing in
the traced human edit flow (Inspector → `provider.updateProps`) calls it.
Nothing writes a computed value into `node.props` today — enrichers (e.g.
Balloons') only shape the served *schema*. And `WIDGET_FRAMEWORK.md`, cited as
"the broader proposal" this POC implements half of, doesn't exist in the repo.

Given that, this slice is scoped narrowly to the one concrete, motivating
case: an agent (MCP) writing control values needs its edit validated before
it's accepted, and today no MCP tool writes control values at all —
`mcp_service/widgets/tool/` only had two read-only tools.

## Scope

In scope: one new MCP tool, `set_widget_control_values`, that locates a
widget node, builds a validated candidate without touching the stored node,
and commits only on success — giving `validate_control_values` its first
real caller.

Explicitly out of scope (per direct instruction, not rediscovered mid-build):
- **Persistence.** The node store this tool operates on is new,
  MCP-process-local, in-memory state — not a bridge to the frontend's real
  document (which has no backend-addressable form) and not a database table.
  It does not survive a process restart.
- **Default seeding.** A node with no `dataBinding` set still has no
  `dataBinding` set after this tool runs unless the caller provides one;
  schema defaults are not proactively written into a node's stored values.
- **Generated-value propagation.** Nothing here writes an enricher-computed
  value into a node's stored `props` — enrichment still only shapes the
  served schema, unchanged from the control-dependency-graph slice.
- **Incremental enrichment.** Each call revalidates the full candidate; there
  is no partial/incremental recomputation.
- **A broader value-precedence contract.** This does not define a general
  "provided vs. default vs. generated" policy — it defines exactly one
  operation's behavior (merge, validate, commit-or-reject).

## Design

### `superset/mcp_service/widgets/node_store.py` (new)

A minimal registry — `WidgetNode` (`widget_type: str`, `props: dict[str,
Any]`) and a module-level `nodes: dict[str, WidgetNode]` — mirroring
`superset/widgets/registry.py`'s plain-dict idiom. Tests seed it directly
(`nodes["n1"] = WidgetNode(...)`); this tool does not create nodes, only
writes to ones that already exist (an unknown `node_id` is a structured
error, not an implicit create).

### `superset/mcp_service/widgets/tool/set_widget_control_values.py` (new)

```python
def _set_widget_control_values_impl(node_id, control_values):
    node = nodes.get(node_id)
    if node is None:
        return unknown_node_error(node_id)
    widget = resolve_widget(node.widget_type)
    if widget is None:
        return unknown_widget_type_error(node.widget_type)

    candidate = {**node.props, **control_values}  # shallow merge
    errors = widget.validate_control_values(candidate)
    if errors:
        return {"errors": errors}  # node.props untouched

    normalized = widget.controls_class.model_validate(candidate).model_dump(by_alias=True)
    node.props = normalized  # single reassignment: the only mutation, and only on success
    return {"errors": [], "values": normalized}
```

The merge is shallow — new top-level keys override, everything else is kept
— deliberately matching `DashboardProvider.updateProps`'s existing merge
semantics on the frontend, so this tool's behavior isn't a new, different
merge policy from the one humans already experience.

"Atomic rollback on failure" falls out of the design rather than needing
explicit rollback code: `node.props` is never mutated in place (no `.update()`
on it) — a candidate dict is built separately and only assigned to
`node.props` after validation succeeds. A failed call touches nothing.

`validate_control_values` discards the validated model (it returns only an
error list), so getting back *normalized* values (coerced types, alias keys)
requires a second `model_validate` call on the same already-known-valid
input — cheap and deterministic, not a design compromise, just how the
existing method's return shape works.

Registered via `@tool(tags=["mutate"], class_permission_name="Chart",
annotations=ToolAnnotations(title=..., readOnlyHint=False,
destructiveHint=False))`, matching the sibling read-only widget tools'
`class_permission_name` (reusing the `Chart` permission, no new permission
introduced) and `mcp_service/dashboard/tool/`'s `tags=["mutate"]` convention
for a write tool. Imported in `superset/mcp_service/app.py` alongside the
other two widget tools — a tool exported from `tool/__init__.py` but missing
from `app.py`'s import list is invisible to a real MCP client despite every
direct-call unit test passing; verified this distinction matters by adding a
`Client(mcp)`-based registration test, not just direct `_impl` calls.

### `superset/mcp_service/widgets/utils.py` (changed)

Adds `unknown_node_error(node_id)`, mirroring the existing
`unknown_widget_type_error`'s structured-error shape.

## Testing

- Successful write: merge preserves untouched keys, normalizes to schema
  defaults for fields nobody set, actually updates the stored node (not just
  the return value).
- Invalid values: structured errors returned, stored node byte-identical to
  before the call (the rollback-by-construction proof).
- Missing required field: same failure path, `dataBinding` named in the
  error location.
- Unknown `node_id`: structured `unknown_node` error.
- Node referencing an unregistered `widget_type` (an orphaned-node defensive
  case): structured `invalid_widget_type` error.
- End-to-end registration: a `Client(mcp)`-based test proving the tool is
  reachable through the real MCP surface, not just importable — this is the
  check that would have caught the tool being exported from `tool/__init__.py`
  but never added to `app.py`'s import list, a mistake every direct-call test
  above is blind to.

## Follow-ups (not this slice)

- Whether Dashboard V2 ever gets a real backend-addressable document (a
  genuine bridge between the frontend's `DashboardProvider` and any backend
  process) is an open, larger architectural question this slice deliberately
  does not answer — the node store here is scoped to prove out validation
  wiring, not to be that bridge.
- Default-seeding a freshly placed widget's `props` (currently `undefined`
  until a human or agent touches every field) remains unaddressed.
- The general provided/default/generated value-precedence contract from the
  original ask remains undesigned.
