# Dashboard V2 Mockup Alignment — Design

**Status:** Approved for planning (PR 1 only; PRs 2-4 scoped, not yet detailed)
**Branch:** `enxdev/poc/dashboard-v2-editing-ui-flow`
**Date:** 2026-08-25

## Problem

A reference mockup ("Dashboard V2 – Dynamic Panels") shows a target look for
the Dashboard V2 prototype: a left rail with four contextual tabs (Data,
Outline, Building Blocks, Properties), a card-styled canvas, and a docked
Assistant panel. Comparing it against the current implementation in
[DashboardBuilderV2](../../../superset-frontend/src/pages/DashboardBuilderV2)
surfaces four independent, real gaps:

1. The left rail ([EditorPanel.tsx](../../../superset-frontend/src/pages/DashboardBuilderV2/EditorPanel.tsx))
   has three tabs (Widgets, Properties, Outline) — no standalone tab for
   browsing datasets independent of a selected widget.
2. Setting a widget's dataset today means typing a raw numeric
   `dataBinding.datasetId` — [SchemaControlPanel.tsx](../../../superset-frontend/src/pages/DashboardBuilderV2/SchemaControlPanel.tsx)
   and [schemaControlRenderers.tsx](../../../superset-frontend/src/pages/DashboardBuilderV2/schemaControlRenderers.tsx)
   have picker renderers for columns/metrics *within* an already-bound
   dataset, but nothing for choosing the dataset itself. The mockup's
   Properties tab also shows a "Show filters" link next to the Dataset field
   that has no equivalent today.
3. Canvas widgets render plainly; the mockup gives each a card with a title
   and a "⋮" overflow menu.
4. There is no per-widget filter configuration concept in Dashboard V2 at
   all (confirmed by grep — the only "filter" hits in this code are unrelated
   `.filter()` array calls).

Explicitly **not** in scope: the Assistant/chat panel
([ChatHost.tsx](../../../superset-frontend/src/core/chat/ChatHost.tsx)) stays
exactly as it is. The mockup's docked-assistant styling is not being pursued —
the user asked directly not to touch the chatbot.

## Decomposition

Four independent PRs, in build order:

1. **Data tab (this design)** — a new left-rail tab for browsing datasets,
   shipped first as a static/mock UI shell (see Scope below).
2. **Properties panel polish** — a real dataset picker for
   `dataBinding.datasetId` (replacing the raw numeric input) plus the
   mockup's "Show filters" link. Will revisit reusing
   [DatasetSelect.tsx](../../../superset-frontend/src/dashboard/components/nativeFilters/FiltersConfigModal/FiltersConfigForm/DatasetSelect.tsx)'s
   `loadDatasetOptions` (or extracting it) once this PR needs a real dataset
   search — deferred, not decided, by PR 1's mock-only scope.
3. **Canvas card styling** — visual-only pass: title + "⋮" menu chrome on
   canvas widgets, no new state.
4. **Per-widget filters** — the functionality behind PR 2's "Show filters"
   link.

Each gets its own brainstorm/design/plan when its turn comes; only PR 1 is
detailed below.

## PR 1: Data tab — Scope

Ship the left-rail shape and the tab's visual shell now; wire it to real
dataset data in a later PR. Concretely:

- Rename the existing "Widgets" tab to "Building Blocks" (label change only —
  it already holds the Structure/Content shelves the mockup's Building
  Blocks tab shows).
- Add a new "Data" tab, first in tab order, ahead of Building Blocks.
- The Data tab renders a new `DataPanel.tsx` component:
  - A search input, filtering a **hardcoded** in-memory list of mock
    datasets client-side (no network calls this PR).
  - Each mock dataset row is expandable (chevron, local component state) to
    reveal a **hardcoded** list of mock columns, each with a `ColumnTypeLabel`
    icon (`@superset-ui/chart-controls`, already used the same way in
    `schemaControlRenderers.tsx`) so the visual language matches the
    Properties tab's existing column pickers.
  - Rows are not clickable/draggable — no `dataBinding` wiring, no
    interaction with canvas or selection state. Purely a browsing shell.
- No new API calls, no new backend work, no changes to `DashboardProvider`
  or any widget's props.

### Out of scope for PR 1 (explicit, not silent)

- Real dataset search/listing (deferred to PR 2, alongside the Properties
  dataset picker — same underlying need, one decision).
- Real column/metric metadata per dataset (deferred with the above).
- Clicking a dataset to bind it to a selected widget.
- Dragging a column onto the canvas to create a chart.

### Components touched

- `EditorPanel.tsx`: tab list — rename `widgets` tab label, add `data` tab,
  reorder so Data is first.
- New `DataPanel.tsx` (sibling to `Palette.tsx`/`Outline.tsx`): the mock
  search + expandable list.
- New `DataPanel.test.tsx`, following the existing `Palette.test.tsx` /
  `Outline.test.tsx` pattern.

### Testing

Jest + RTL: tab renders in the right position with the right label; search
filters the mock list; a row expands/collapses to show its mock columns with
type icons. No integration/E2E needed — nothing here talks to the backend.

## Spec self-review

- No placeholders or TBDs remain — PR 1's scope is fully concrete; PRs 2-4
  are intentionally one-line pointers, not commitments to a specific design.
- Consistent: the "mock only" boundary is stated once and every "out of
  scope" item traces back to it.
- Focused: this document covers one implementable PR in full plus a map of
  what comes after it, which is what was asked (split the work into
  several PRs, spec the first one).
