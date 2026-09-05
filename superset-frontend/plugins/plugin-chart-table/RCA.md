# RCA: Table chart Total gets cut off on the Dashboard after a resize

Tracks apache/superset#21063.

## What Happened

Reported repro (Table chart, `SHOW TOTALS` enabled, metric format set to
"Original value" so the total renders as a long, unformatted number):

1. Create a Table chart with a category dimension and `SUM(metric)`, totals
   on, D3 format "Original value".
2. Save it to a new dashboard.
3. In the dashboard editor, shrink the chart's height until the table body
   shows a vertical scrollbar, then grow it back until the scrollbar goes
   away and all rows are visible again.
4. Save the dashboard.

Expected: the Total row's number is fully visible. Actual: the rightmost
part of the total's digits is invisibly clipped off, and stays clipped even
though the body no longer needs to scroll.

The PR history on this exact file (#21064 in 2022, #26964 in 2024, #36891 and
#42573 earlier in 2026) shows this general area — keeping the sticky header,
scrollable body, and sticky footer column widths in sync when a vertical
scrollbar appears/disappears — has regressed multiple times under different
trigger conditions. This RCA is another iteration on that same mechanism, not
a brand new subsystem.

## Root Cause

**Verified**, via a standalone real-Chromium harness that mounts the actual,
unmodified `useSticky.tsx`/`StickyWrap` through `react-table` (not a
reimplementation — see "How this was verified" below):

In `useSticky.tsx`, the header and footer wrapper `<div>`s (the ones holding
the fixed-layout `<table>` for the sticky header row and the totals row) had
their width computed as:

```tsx
// superset-frontend/plugins/plugin-chart-table/src/DataTable/hooks/useSticky.tsx (pre-fix)
const headerContainerWidth = hasVerticalScroll
  ? maxWidth - scrollBarSize
  : maxWidth;
```

where `scrollBarSize = getCustomScrollBarSize()` is a **JS-measured** pixel
value: it builds a probe `<div>` styled with the same
`::-webkit-scrollbar { width: 8px }` rule used elsewhere in this file, and
measures how much horizontal space that specific, custom-styled scrollbar
occupies (`getScrollBarSize.ts:77-85`).

Meanwhile, the actual scrollable body div — and, critically, the **hidden
"sizer" table that measures the column widths shared by the header, body,
and footer via one `<colgroup>`** — reserve their scroll space using a
completely different, unrelated browser mechanism:

```tsx
// body div (unchanged by this fix)
scrollbarGutter: hasVerticalScroll ? 'stable' : undefined,
```

`scrollbar-gutter: stable` is a CSS layout feature: the browser decides how
much space to reserve for a *potential* scrollbar, independent of whether an
actual scrollbar is showing and independent of any `::-webkit-scrollbar`
cosmetic styling applied to that element. There is no contract anywhere in
the browser or the spec that this reserved amount equals whatever
`getCustomScrollBarSize()`'s probe happens to measure — they are two
unrelated APIs that happen to often be close in value on some
platforms, purely by coincidence.

Measured directly in headless Chromium (the same engine Playwright/CI use):

- `getCustomScrollBarSize()`'s probe → **0px** in this build (its
  `::-webkit-scrollbar` styling has no effect because this environment uses
  overlay scrollbars for a `overflow:scroll` probe element).
- `scrollbar-gutter: stable`'s actual reservation on an equivalent element →
  **~15px**.

Because the column widths (`colWidths`, i.e. the `<colgroup>` used by all of
header/body/footer) are computed via the sizer, whose available width is
narrowed by the `scrollbar-gutter: stable` amount, while the header/footer
wrapper's own width was narrowed by the *separately-measured*
`scrollBarSize`, any divergence between those two numbers means the
fixed-layout `<table>` inside the header/footer wrapper (width = sum of
`colWidths`) can be **wider** than the wrapper `<div>` itself (width =
`maxWidth - scrollBarSize`). The wrapper uses `overflow: hidden` (not
`scroll`), so the excess is silently clipped off the right edge — which is
exactly where the metric/Total column sits.

This only becomes visible once `hasVerticalScroll` flips to `true` — i.e.
only after the user shrinks the chart enough to force the body to actually
need to scroll. On first render (chart created tall enough that everything
fits, `hasVerticalScroll: false`), `headerContainerWidth` was just
`maxWidth`, so nothing was clipped — matching the report that the bug only
appears *after* the manual shrink step, not on initial load. Growing the
chart back up does not fix it because it's not a stale/stuck-state bug: as
long as `hasVerticalScroll` is (still) `true`, the two independent
computations disagree on every render, not just transiently.

**Inferred** (plausible, not independently reproduced on a second real
browser/OS in this sandbox): the specific *direction* of the mismatch
(`scrollBarSize` measuring larger than the actual `scrollbar-gutter`
reservation, which is the direction that clips rather than merely wastes
space) depends on the user's browser/OS scrollbar configuration — e.g.
platforms/zoom levels/DPI settings where the forced custom classic scrollbar
probe reads larger than what `scrollbar-gutter: stable` reserves. This
would explain why the bug is intermittent across environments and has
prompted several independent partial fixes to this same file over the
years rather than one that stuck.

### How this was verified

Reasoning about `table-layout: fixed` + `scrollbar-gutter` + a JS-measured
scrollbar probe interacting across a resize sequence is exactly the kind of
thing that's easy to get subtly wrong by inspection alone, and jsdom (used
by this repo's Jest tests) doesn't implement real CSS layout at all
(`getBoundingClientRect`/`clientWidth` are stubbed to 0), so it can't be used
to observe this mechanism directly. To avoid reasoning-only conclusions:

1. Built a throwaway harness (`.scratch-repro/`, not part of this diff) that
   imports the **real, unmodified** `useSticky.tsx` through `react-table`,
   bundled with esbuild, and drove it with Playwright against a real,
   already-cached Chromium binary (no Docker/Superset server needed).
2. Confirmed `getCustomScrollBarSize()` and `scrollbar-gutter: stable`'s
   actual reservation diverge in this browser (0px vs. ~15px) — a genuine,
   measured fact about this Chromium build, not a guess.
3. Ran the exact shrink → grow sequence against the real code with those
   stock values: no clipping, because in this environment `scrollBarSize`
   (0) is *smaller* than the real reservation (~15), so the header/footer
   div ends up wider than the colgroup needs (wasted space, not clipping —
   matching the "column misalignment" framing of prior fixes to this file).
4. Isolated the single variable: temporarily forced
   `getCustomScrollBarSize()` to return a value larger than the real
   `scrollbar-gutter` reservation (e.g. 70). Re-ran the identical sequence
   against the real code: `footerDiv` width became 190px while the footer
   `<table>`'s actual rendered width was 194px — a **measured, real-browser
   4px overflow of an `overflow: hidden` container**, i.e. real clipping.
5. Applied the fix (below), reran with the same forced 70px value: the
   footer div stayed at the full `maxWidth` (260px) in every step of the
   resize sequence, and the table content (194-205px) always fit inside
   it — no clipping, at any value of the probe, because the probe is no
   longer used for this computation at all.
6. Confirmed the fix doesn't change behavior with the stock (non-forced)
   `getCustomScrollBarSize()` value — same widths, no regression.

This traces the defect through actual DOM state at each step, not just a
prose description of what "should" happen.

## Why It Wasn't Caught

There is no test coverage of the sticky header/footer/body width-sync
mechanism at all. Every existing test that renders `TableChart` or
`DataTable` explicitly passes `sticky={false}`
(`plugins/plugin-chart-table/test/TableChart.test.tsx`), and
`plugins/plugin-chart-table/test/DataTable/` only had a test for
`getScrollBarSize.ts` in isolation — nothing exercises `useSticky.tsx`'s
`StickyWrap` component, so none of the four fixes to this exact mechanism
since 2022 (#21064, #26964, #36891, #42573) added a regression guard for the
underlying invariant (header/footer/body must all agree on how much
scrollbar space is reserved). Each fix addressed the specific manifestation
someone happened to reproduce, without a test pinning the invariant itself,
which is presumably why the area keeps regressing under new trigger
conditions.

Manual QA also wouldn't reliably catch this: it depends on the reporter's
OS/browser scrollbar rendering mode (the bug is invisible on browser/OS
combinations where the two measurements happen to diverge in the
non-clipping direction, e.g. the very headless Chromium this sandbox used).

## The Fix

`superset-frontend/plugins/plugin-chart-table/src/DataTable/hooks/useSticky.tsx`,
in `StickyWrap` (~lines 289-333): removed the `headerContainerWidth =
hasVerticalScroll ? maxWidth - scrollBarSize : maxWidth` computation and the
numeric `width: headerContainerWidth` on the header/footer wrapper divs.
Replaced with `width: maxWidth` plus the exact same
`scrollbarGutter: hasVerticalScroll ? 'stable' : undefined` CSS property the
body div already uses. Header, body, and footer — and the sizer that
computes the shared `<colgroup>` widths — now all derive their available
width from the single, same `scrollbar-gutter` mechanism, so they can no
longer disagree regardless of what any given browser's
`::-webkit-scrollbar`-based probe measures. `getCustomScrollBarSize()` is
untouched and still used for the (separate, legitimate) horizontal-scrollbar
real-height reservation elsewhere in the same effect.

This removes the divergent computation rather than compensating for it (e.g.
no new "add a few px of buffer" fudge factor), because the buffer would
itself be a browser/OS/zoom-dependent number with the exact same class of
bug.

## Latent Bugs Found

- **`needScrollBar` height comparison in the same file's
  `useLayoutEffect`** (`useSticky.tsx` ~lines 199-205): it compares
  `innerHeight: fullTableHeight` (thead + tbody + tfoot) against
  `height: maxHeight - theadHeight - tfootHeight` (the body-only budget). The
  correct comparison is `fullTableHeight > maxHeight` (equivalently,
  `tbodyHeight > maxHeight - theadHeight - tfootHeight`); the current form
  double-counts the header/footer height, so `hasVerticalScroll` reports
  `true` up to `theadHeight + tfootHeight` px earlier than actually
  necessary. Verified by direct computation and by a Playwright measurement
  showing a 400px container reporting `hasVerticalScroll: true` for content
  that only needed 379px. This doesn't clip anything by itself (column
  widths are computed via `scrollbar-gutter`, unaffected by this flag), but
  it does mean charts show an unnecessary scrollbar/reserved gutter more
  often than needed, and makes the flag "stickier" than it should be across
  a resize. Left unfixed — out of scope for the totals-clipping defect, and
  changing it would alter scrollbar-appearance behavior more broadly than
  this bug fix should.
- The `<col width={w} />` values passed to `<colgroup>` are floats (e.g.
  `95.65625`). The legacy HTML `width` attribute on `<col>` may be rounded
  down/truncated by some rendering engines, which could compound with the
  scrollbar-space issue above. Not confirmed to matter on evergreen Chromium
  in this investigation; noted for anyone touching this file again.

## Prevention

Added `plugins/plugin-chart-table/test/DataTable/hooks/useSticky.test.tsx`,
which mounts `useSticky`'s `StickyWrap` for real (via `react-table`) with
mocked DOM measurements that force `hasVerticalScroll: true`, and mocks
`getCustomScrollBarSize()` to return a value distinguishable from any
CSS-computed one. It asserts the header/footer wrapper's `style.width` and
`style.scrollbarGutter` match the body's — i.e. it pins the invariant
("header, body, and footer must derive their available width from the same
mechanism") rather than any specific pixel value, so it would have failed
against every regression this file has had since #26964 introduced
`scrollbar-gutter`, not just this one. It fails against the pre-fix code
(`258px` vs. expected `300px`) and passes after the fix.
