# RCA: Duplicate cross-filter chips in the dashboard FilterBar

## What Happened

Reported behavior: on a dashboard with multiple charts, applying a cross-filter by
interacting with one chart (e.g. clicking a bar/point) sometimes adds more than one
entry to the dashboard's FilterBar for that single cross-filter, instead of exactly
one.

I was not able to trigger the duplicate visually through slow, manual/scripted
browser interaction. I drove a real, non-mocked Superset instance (both a plain
dashboard and a full embedded-iframe + guest-token setup) through Playwright and
tried: table and canvas (bar/donut) chart context-menu and direct left-click
cross-filtering, vertical and horizontal FilterBar orientation, viewport
resize/overflow stress, dashboard tab switching, and rapid double-clicks. Every one
of these, checked via precise DOM element counts (not just screenshots), settled to
exactly one chip. That is expected given the mechanism below: it only manifests
during a specific single-render transient, and each of my interactions was followed
by a `waitForTimeout` before checking the DOM, which reliably lands *after* the
transient has already resolved.

I then reproduced the underlying mechanism directly with a Jest/React Testing
Library regression test that mounts the real
`FilterControls` component (the code that builds the horizontal FilterBar's
chip list) with one chart-emitted cross-filter present, and drives its real
`DropdownContainer.onOverflowingStateChange` callback the same way `DropdownContainer`
does in production:

```
cd superset-frontend
npx jest src/dashboard/components/nativeFilters/FilterBar/FilterControls/FilterControls.overflow.test.tsx
```

New test: `an overflowed cross-filter chip stays in the items array handed to
DropdownContainer` (RED before any fix): the identical chip (chart name "Products
Sold By Product Line" + tag "product_line: Classic Cars") renders **twice** in the
DOM at once — once in `DropdownContainer`'s main-row content and once in
`FilterControls`'s own overflow-popover content — when both are asked to render in
the same commit. Expected: exactly one combined occurrence; actual: two.

## Root Cause

`superset-frontend/src/dashboard/components/nativeFilters/FilterBar/FilterControls/FilterControls.tsx`
(horizontal orientation) keeps its own mirror of "which items are currently
overflowed" as plain React state (`overflowedIds`, line ~170), populated only via
an async callback:

```tsx
onOverflowingStateChange={({ overflowed: nextOverflowedIds }) => {
  if (/* changed */) setOverflowedIds(nextOverflowedIds);
}}
```

`overflowedIds` feeds `overflowedCrossFilters` (line ~435-441), which is what the
"More filters" popover renders via `<FiltersDropdownContent overflowedCrossFilters={overflowedCrossFilters} />`
(line ~610-636).

Independently, `packages/superset-ui-core/src/components/DropdownContainer/DropdownContainer.tsx`
decides what to show in the **visible main row** purely by slicing its own `items`
prop by array index — `items.slice(0, overflowingIndex)` — where `overflowingIndex`
is computed synchronously in a `useLayoutEffect` (lines 166-234) based on real DOM
measurements. `DropdownContainer` has no awareness of, and does not consult,
whatever `overflowedIds` value it last reported to its parent.

Crucially, `FilterControls`'s `items` memo (lines 470-575) — the array
`DropdownContainer` renders the main row from — unconditionally includes every
cross filter from `selectedCrossFilters`. **Verified**: nothing in that memo's body
or dependency array references `overflowedIds`; an "overflowed" cross filter is
never removed from `items`.

React runs a component's `useLayoutEffect`s (and any state updates they schedule)
before that same commit's `useEffect`s. So there is at least one render in which:

- The main row, rendered directly by `DropdownContainer` from its own **fresh**
  `overflowingIndex` computed *this* render, already shows a cross filter as
  fitting (visible).
- `FilterControls`'s `overflowedCrossFilters`, built from the **one-render-stale**
  `overflowedIds` state (the previous `onOverflowingStateChange` callback hasn't
  fired yet for this render), still lists that same cross filter as overflowed —
  so the popover renders it too.

**Verified** end-to-end for this exact desync with the new Jest/RTL test: it mounts
the real `FilterControls`, drives its real `onOverflowingStateChange` callback, and
shows the identical chip rendered in both places in the same commit.

Any event that shifts which items fit — a window/sidebar resize, a
`chartLayoutItems` update that changes a cross filter's label width (e.g. the
emitting chart's name populating after chart layout data loads), or adding/removing
a filter — opens this one-render desync window. If the "More filters" popover is
already open, or is force-rendered (`forceRender={hasRequiredFirst}`, true whenever
the dashboard has a required-first native filter, `FilterControls.tsx` line ~637),
its content is mounted in the DOM regardless of visibility, so the duplicate chip is
not just a single animation-frame flicker but a real, DOM-visible duplicate for that
render. **Inferred**: I did not independently verify against antd's Popover source
that `forceRender` keeps content DOM-mounted while visually hidden; this is a
standard reading of that prop's documented purpose but wasn't traced further given
the Phase 3 time budget.

A prior, merged fix to this exact file —
`55bb75efe6 fix(dashboard): prevent filter dropdown button from disappearing during
layout recalculations (#38193)` — explicitly documents and patches a *different*
symptom of this same transient window:

> When the item set changes, the overflow index is briefly reset while the new
> widths are measured ... During that window the dropdown content momentarily
> becomes empty, which would hide and then re-show the trigger, causing a flicker.

**Verified** by reading the commit diff: it adds `recalculating`/`hadPopoverContent`
bookkeeping so the "More filters" *trigger button* stays visually mounted during the
transient. It does not reconcile `overflowedIds` with `DropdownContainer`'s
same-render `overflowingIndex`, so it fixes the button-disappearing symptom of the
race without addressing the underlying two-source-of-truth desync that also causes
the duplicate-chip symptom.

## Why It Wasn't Caught

- No existing test exercises the *transition* of a single item across two different
  `overflowedIds`/`overflowingIndex` values — the pre-existing
  `FilterControls.overflow.test.tsx` suite (which already mocks `DropdownContainer`
  and drives `onOverflowingStateChange` directly, so this transition is testable
  cheaply) only ever asserts on `dropdownTriggerCount` / `dropdownContent` presence
  at rest, never on whether an item is simultaneously present in `items` (main row)
  and in the popover content.
- That same test file had zero cross-filter coverage before this change — every
  existing case exercises native filters only, so cross-filter chip duplication was
  entirely untested.
- The prior `#38193` fix added specific handling for this transient window for the
  trigger *button's* visibility — direct evidence the window is real and reachable —
  but added no assertion about `dropdownContent`'s item-level consistency during
  that same window.
- The bug requires an in-flight resize/relayout to manifest; a static screenshot
  taken after an interaction has fully settled (the natural way to manually or
  script-test "does clicking a chart add a filter chip") will never show it, and no
  existing Cypress/Playwright test drives a resize *during* a cross-filter
  interaction.

## The Fix

TBD, Phase 5 — not implemented in this phase (Phase 3 scope is reproduce +
root-cause + regression guard only). Two candidate directions to weigh in the fix
phase (not decided here):

1. `DropdownContainer` already passes its current-render `overflowedItems` into
   `dropdownContent(overflowedItems)` (`DropdownContainer.tsx` line ~262).
   `FilterControls`'s `dropdownContent` closure currently ignores that argument and
   uses its own stale `overflowedCrossFilters`/`overflowedIds` state instead —
   having it consume the argument it's given would remove the second, independently
   mirrored source of truth entirely.
2. Alternatively, exclude items already known to be overflowed from `items` before
   handing them to `DropdownContainer`, so `items` and `overflowedCrossFilters` are
   mutually exclusive by construction. This still requires care: deriving the
   exclusion from the same one-render-stale `overflowedIds` would not fully close
   the window on its own.

## Latent Bugs Found

- `superset-frontend/src/dashboard/components/nativeFilters/FilterBar/FiltersDropdownContent/index.tsx`
  lines 56-62: `overflowedCrossFilters.map(crossFilter => rendererCrossFilter(...))`
  has no `key` prop at all (confirmed via React's "Each child in a list should have
  a unique key prop" console warning, reproduced by the new regression test).
  Independent of the root cause above; worth fixing regardless, keyed by
  `${crossFilter.name}${crossFilter.emitterId}` to match the convention used
  elsewhere in this directory.
- `superset-frontend/src/dashboard/components/nativeFilters/FilterBar/CrossFilters/VerticalCollapse.tsx`
  line 113 keys the vertical orientation's cross-filter list by `filter.emitterId`
  alone, while every other cross-filter list in this directory
  (`FilterControls.tsx` line ~474, `CrossFilter.tsx` line 64) keys by
  `${name}${emitterId}`. Not currently reachable as a live bug — `crossFiltersSelector`
  cannot yet emit two indicators sharing one `emitterId` — but it's an inconsistent
  convention worth aligning, especially given `FilterControls.tsx`'s own comment
  anticipating "multiple cross filters from the same chart" as a future case.
- `DropdownContainer.tsx`'s `onOverflowingStateChange` effect (lines 236-243) gives
  consumers no signal that the values it reports can be one render stale relative to
  what was just painted. Any other consumer of this callback is exposed to the same
  class of race, not just `FilterControls`'s cross-filter/native-filter bookkeeping.

## Prevention

Add an invariant check (in `DropdownContainer.test.tsx`, or a small shared test
utility) asserting that `notOverflowedItems` (what gets rendered as the main row)
and whatever is exposed via `dropdownContent(overflowedItems)` /
`onOverflowingStateChange` are always a strict partition of `items` *within the same
render* — and require any consumer that keeps its own mirrored copy of that overflow
state (as `FilterControls` does) to be tested specifically for the one-render-stale
window, not just the settled end state. More generally, a component that receives
list-partition information via an async (`useEffect`-driven) callback prop, then
uses it to decide what to render alongside sibling state that updates synchronously
in the same parent, is a structural risk for this exact class of bug — worth a
review checklist item on any future PR touching `DropdownContainer` consumers.
