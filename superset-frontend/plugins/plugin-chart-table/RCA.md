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

This section has been revised twice after independent review challenged the
evidence, each time by doing more real-browser testing rather than defending
the previous write-up. This third round **retracts a specific claim from
round two** ("clientWidth=190 vs scrollWidth=194 proves real clipping") after
directly falsifying it with hit-testing, and replaces it with a narrower,
structurally-guaranteed argument for why the shipped fix is correct.

**Retracted, this round — the 190px/194px `clientWidth`/`scrollWidth`
comparison from round two is not evidence of clipping, and real hit-testing
shows the content in question stays fully visible.**

Round two's central claim was that converging header/footer onto
`scrollbar-gutter: stable` *without* also giving them `scrollBarStyles`
produces a header/footer wrapper `clientWidth` of 190px against a 194px-wide
`<table>`, and that this constitutes real clipping. An independent reviewer
challenged this directly: a scrollbar gutter reservation sits inside the
padding edge, and `overflow: hidden` clips at the padding edge, not
necessarily at the (gutter-reduced) `clientWidth`. Reproducing the same
205px-wrapper/190px-`clientWidth`/194px-content geometry in real headed
Chromium and testing it with `document.elementFromPoint` hit-testing across
every pixel from the wrapper's left edge to well past its right edge — not
just comparing two numbers — confirms the reviewer was right: the content
remains hit-testable (i.e., actually painted, not clipped) all the way to
its own true right edge, and only stops being hit-testable at the
**wrapper's real, un-reduced border-box edge** (205px), never at the
reduced 190px `clientWidth` `scrollbar-gutter` reports. In other words:

> `scrollbar-gutter: stable` on an `overflow: hidden` box changes what
> `clientWidth` *reports*, but does not move where the box actually clips
> content. `overflow: hidden` clips at the box's real border-box edge,
> whether or not `scrollbar-gutter` has "reserved" (phantom, since
> `overflow: hidden` never renders a scrollbar to occupy that space) room
> inside it.

This was checked with a minimal, isolated repro (a plain `<div>` with the
exact same `width`, `overflow: hidden`, `scrollbar-gutter: stable`, and
`::-webkit-scrollbar` styling as the header/footer wrapper, containing a
child sized to reproduce the exact 190/194 numbers from round two) so the
result isn't an artifact of `react-table` or this specific component. It is
a general, verified fact about how Chromium implements `overflow: hidden` +
`scrollbar-gutter`, not something specific to this file. This means: **the
round-two mechanism — a mismatched `scrollbar-gutter` reservation between
header/footer and body/sizer — cannot, by itself, cause header/footer to
visibly clip the total row.** The `scrollBarStyles` half of the shipped fix
is not load-bearing for preventing clipping (see below for what it's
actually for).

**Verified, this round — a genuinely *narrower* box, from a real width
subtraction rather than a phantom `scrollbar-gutter` reservation, does
clip.**

This matters because it's exactly what unmodified master does: master's
header/footer compute `width: maxWidth - scrollBarSize`, where
`scrollBarSize` comes from the separately JS-measured
`getCustomScrollBarSize()` probe — a real, literal reduction of the
wrapper's own CSS `width`, not a CSS-engine-internal reservation. Testing
this class directly (two `overflow: hidden` boxes, one at the full width,
one built by subtracting a deliberately-too-large amount from that same
width, both containing identically-sized content that fits the full-width
box but not the subtracted one) and hit-testing across the boundary: the
full-width box does not clip the content at all (hit-testable to its own
true edge, same as above), while the subtracted box clips it exactly at its
own — genuinely narrower — border-box edge, with the DOM node's content
completely un-hit-testable beyond that point. Unlike the `scrollbar-gutter`
case, this clipping is real: the box is *actually* narrower, not just
reporting a smaller `clientWidth` while remaining the same size. This
confirms the general mechanism class master relies on (a wrapper narrowed by
`maxWidth - <a JS-measured number>`) is capable of real clipping if that
JS-measured number is ever larger than what the colgroup was actually sized
against — it's just not the specific `scrollbar-gutter`-mismatch mechanism
claimed in round two.

**Verified, this round — the shipped fix (header/footer always
`width: maxWidth`, never reduced) cannot be narrower than the `<colgroup>`
it has to display, in any browser, regardless of what any scrollbar probe
measures.** This is a structural argument, not a browser-specific empirical
one:

1. The shared `<colgroup>` widths come from measuring `<th>` elements inside
   the sizer `<div>` (`useSticky.tsx`'s `useLayoutEffect`,
   `ths.map(th => th.getBoundingClientRect()?.width)`).
2. The sizer has no explicit `width` of its own — it's a plain block `<div>`
   that takes the width of its containing block (the outermost wrapper,
   which *is* `maxWidth` wide), then loses more of that to whatever real
   vertical scrollbar it renders when its content needs to scroll (which is
   exactly when column widths are being measured for `hasVerticalScroll:
   true`). So `sizer.clientWidth <= maxWidth`, always, by construction —
   this isn't contingent on any JS probe agreeing with anything.
3. The sizer's own `<table>` is **not** given `table-layout: fixed` (only
   header/body/footer's cloned tables get that via `mergeStyleProp(table,
   fixedTableLayout)`), so it lays out with the browser's normal automatic
   table layout, sizing each column from the *natural* content of
   **all** of `thead`+`tbody`+`tfoot` together (the sizer renders all three
   sections at once, unlike header/body/footer which each render only one).
   That means the measured `<th>` widths already account for the total
   row's actual content width whenever that content fits inside
   `sizer.clientWidth` — which is the normal, in-scope case this fix
   targets (see "Latent Bugs Found" for the narrow-chart case where it
   doesn't fit at all, which is a separate, already-documented issue).
4. Therefore the widths that end up in `<colgroup>` sum to at most
   `sizer.clientWidth`, which is at most `maxWidth`.
5. Header/footer's own `<table>` (with the same `<colgroup>`, under
   `table-layout: fixed`, with no explicit table `width`) can only need up
   to that same colgroup-derived width to render without visually
   overflowing its own column boxes (browsers still let content wider than
   its `<col>` spec expand a `table-layout: fixed` table when the table's
   own `width` is `auto`, but the sizer already measured that expanded
   need, so the colgroup value already includes it — the fixed-layout
   tables don't need to grow further).

Chaining these: the widest header/footer's own `<table>` will ever
legitimately need to be is bounded by `sizer.clientWidth`, which is bounded
by `maxWidth`. Setting header/footer's wrapper `width` to the full,
never-reduced `maxWidth` (what the fix does) therefore can never be
narrower than what the table needs — not "in the one browser tested," but
as a consequence of where each number comes from. This is the actual reason
the fix prevents the reported clipping, and it does not depend on
`getCustomScrollBarSize()`'s accuracy in any browser, unlike master's
subtraction-based width.

**Still unverified/inferred — the exact browser condition that triggers the
bug against unmodified master.** This is unchanged from round two and
already accepted by review as a reasonable sandbox limit, so it is only
summarized here: master's `width: maxWidth - scrollBarSize` is unsafe
exactly when the JS-measured `scrollBarSize` is *larger* than whatever real
reservation the sizer/body's own scrollbar actually took (see the previous
paragraph's class-level demonstration for why that direction, specifically,
causes real clipping). Sweeping chart widths (260px→190px) through the full
shrink→grow-back sequence and six zoom levels (0.75×–1.5×) against
unmodified master in real headed Chromium, `getCustomScrollBarSize()` and
the sizer's real scrollbar reservation agreed at every single step in this
sandbox — so the specific browser/OS/zoom condition that makes them disagree
for the original reporter is not reproducible with the one Linux/Chromium
build and X11 display available here. That the mechanism class itself is
real (previous paragraph) is now on firmer ground than round two's specific
(and now-retracted) numeric claim; that it's *master's* exact trigger
remains an inference, not a reproduction.

**A more likely contributor to the exact reported persistence
("stays clipped after growing back"), inferred but grounded in a separately
verified defect:** see the `needScrollBar` height-comparison bug under
"Latent Bugs Found". It makes `hasVerticalScroll` switch on too easily and
switch back off only once the chart is grown by an extra
`theadHeight + tfootHeight` px beyond what's actually needed — i.e. it's
easy for the scrollbar state, and the width reservation that comes with it,
to stay "on" after a grow-back that should have turned it off. Left unfixed
here — a distinct defect, and fixing it would change scrollbar-appearance
behavior more broadly than this PR should.

**Why `scrollbarGutter`/`scrollBarStyles` are still applied to header/footer,
even though they aren't what prevents the reported clipping (secondary,
less rigorously verified rationale):** header/footer aren't purely
decorative viewports — when `hasHorizontalScroll` is also true, their
`<table>` is deliberately wider than the wrapper (the same over-wide
`<colgroup>` as body), and `scrollLeft` is synced programmatically from body
so header/footer scroll in lockstep as the user scrolls body horizontally
(`onScroll` in `useSticky.tsx`). In that combined horizontal-and-vertical
scroll case, body's *visible* content region is narrower than
`maxWidth` by whatever its real, physically-rendered scrollbar occupies;
if header/footer's clip viewport is the full, un-reduced `maxWidth` while
body's real viewport is narrower, the same `scrollLeft` value would reveal a
wider slice of the row in header/footer than what's actually visible in
body, misaligning columns during horizontal scrolling. Matching
`scrollbarGutter`/`scrollBarStyles` on header/footer keeps their reported
`clientWidth` consistent with body's, which keeps that synced-scroll slice
consistent too. I have not built a real-browser repro of this specific
combined-scroll scenario (the reported bug, #21063, does not describe
horizontal scrolling), so this is presented as a plausible, structurally
motivated reason to keep the change, not a verified fix for a reproduced
defect — unlike the `width: maxWidth` change above, which is verified.

**Sizer/header/footer/body gutter symmetry is conditional, not
unconditional.** The sizer's wrapper sets `scrollbarGutter: 'stable'`
unconditionally (`useSticky.tsx`, sizer `<div>` style), while
header/footer/body all set it conditionally —
`hasVerticalScroll ? 'stable' : undefined`. So the four elements only agree
on gutter reservation while `hasVerticalScroll` is `true`; while it's
`false`, the sizer still reserves a gutter (it's `visibility: hidden` and
only used for measurement, so this doesn't affect anything visible) while
header/footer/body correctly reserve none, since there's no real scrollbar
to make room for. This is existing, pre-fix behavior, not something this PR
introduces or removes — it's noted here so this document doesn't claim an
unconditional four-way symmetry that isn't actually there.

### How this was verified

jsdom (this repo's Jest environment) does not implement real CSS layout —
`getBoundingClientRect`/`clientWidth` are stubbed, and hit-testing APIs like
`document.elementFromPoint` don't reflect real paint/clip behavior — so none
of the claims above can be checked through a jsdom test. This round's
verification used real, on-screen Chromium rendering plus explicit
hit-testing (not just numeric comparisons) for exactly that reason:

1. Started `Xvfb :99` directly (no `xauth` available in this sandbox, so
   `xvfb-run` didn't work) and pointed `DISPLAY=:99` at
   `chromium.launch({ headless: false })` via Playwright (already cached in
   this sandbox) — genuine on-screen rendering.
2. Built minimal, static HTML repros (not part of this diff, not committed)
   reproducing the exact box models under dispute: (a) an `overflow: hidden`
   wrapper with `scrollbar-gutter: stable` and the same
   `::-webkit-scrollbar` styling as this file's `scrollBarStyles`,
   containing content sized to reproduce round two's exact 190px/194px
   `clientWidth`/content-width numbers; (b) the same comparison with the
   *unstyled* (native, wider) scrollbar-gutter reservation, to match
   header/footer's specific pre-fix state; (c) two `overflow: hidden`
   wrappers differing only in whether their `width` is the full value or a
   value reduced by subtraction, both containing identical over-wide
   content, to isolate "phantom reservation" from "real narrowing."
3. For each, measured `clientWidth`/`getBoundingClientRect()` as before,
   but additionally swept `document.elementFromPoint(x, y)` across the
   disputed boundary pixel-by-pixel to determine what is actually
   hit-testable (i.e., actually painted and not clipped) at each point,
   rather than inferring clipping from a comparison of two numbers.
4. Result: the phantom-reservation repros (a) and (b) show content
   hit-testable all the way to its own true edge, never clipped at the
   reduced `clientWidth`; the real-narrowing repro (c) shows content
   genuinely clipped, exactly at the narrower box's own true edge. This
   directly falsifies round two's clipping claim while confirming the
   mechanism class master's subtraction-based width relies on is capable of
   real clipping when the subtracted amount is too large.
5. Re-verified the structural `colgroup <= sizer.clientWidth <= maxWidth`
   chain above by inspecting `useSticky.tsx` directly (this is a logical
   argument about where each number is computed and from what container,
   not something that needs a browser to check) rather than re-doing the
   full chart-width sweep from round two, since round two's sweep already
   established (and review already accepted) that master's own arithmetic
   doesn't diverge from the sizer/body's reservation anywhere reproducible
   in this sandbox — the open question was never "does the fixed code avoid
   divergence," it's "does removing the subtraction entirely avoid the
   *class* of bug regardless of divergence," which the structural argument
   answers independently of any sweep.

This traces both the retraction and the corrected argument through actual
DOM state and hit-testing in a real, on-screen browser, and says plainly
where it overturns round two's own conclusion rather than smoothing over
it.

## Why It Wasn't Caught

There is no test coverage of the sticky header/footer/body width-sync
mechanism at all. Every existing test that renders `TableChart` or
`DataTable` explicitly passes `sticky={false}`
(`plugins/plugin-chart-table/test/TableChart.test.tsx`), and
`plugins/plugin-chart-table/test/DataTable/` only had a test for
`getScrollBarSize.ts` in isolation — nothing exercises `useSticky.tsx`'s
`StickyWrap` component, so none of the four fixes to this exact mechanism
since 2022 (#21064, #26964, #36891, #42573) added a regression guard for
either of the two invariants this fix relies on: the load-bearing one
(header/footer's wrapper `width` must never be reduced below what the
shared colgroup needs — see Root Cause) or the secondary one
(header/footer must report the same `clientWidth` as body, for consistent
synced horizontal scrolling). Each fix addressed the specific manifestation
someone happened to reproduce, without a test pinning either invariant
itself.

Manual QA also wouldn't reliably catch a width-computation bug of this
kind: it would depend on the reporter's specific browser/OS/rendering-mode
scrollbar behavior, which is exactly the kind of environment-sensitive
condition this investigation had to build custom real-browser tooling
(headless *and* headed, plus hit-testing, not just numeric comparisons) to
even observe directly.

## The Fix

`superset-frontend/plugins/plugin-chart-table/src/DataTable/hooks/useSticky.tsx`,
in `StickyWrap` (~lines 305-354), plus a
`/** @jsxImportSource @emotion/react */` pragma added near the top of the
file (see "Prevention" for why):

1. Removed the `headerContainerWidth = hasVerticalScroll ? maxWidth -
   scrollBarSize : maxWidth` computation and the numeric
   `width: headerContainerWidth` on the header/footer wrapper divs.
   Replaced with an unconditional `width: maxWidth`. This is the change that
   actually prevents the reported clipping: the shared `<colgroup>` is
   always bounded by `sizer.clientWidth`, which is always bounded by
   `maxWidth` (see Root Cause), so a header/footer wrapper that is *never*
   narrowed below `maxWidth` can never be narrower than the table it has to
   display, regardless of whether `getCustomScrollBarSize()` agrees with the
   sizer/body's real scrollbar reservation in any given browser.
2. Also added `scrollbarGutter: hasVerticalScroll ? 'stable' : undefined`
   and `css={scrollBarStyles}` (the same custom `::-webkit-scrollbar`
   styling the body/sizer already carry) to the header/footer wrapper divs.
   **This step is not required to prevent the reported clipping** — real
   hit-testing shows `scrollbar-gutter` on an `overflow: hidden` box changes
   what `clientWidth` reports without moving where content actually clips
   (see Root Cause) — but it is kept for a secondary, less rigorously
   verified reason: keeping header/footer's reported `clientWidth`
   consistent with body's keeps their synced `scrollLeft` viewport
   consistent with body's real, physically-scrollbar-reduced viewport when
   both horizontal and vertical scrolling are active simultaneously.

`getCustomScrollBarSize()` is untouched and still used for the separate,
legitimate horizontal-scrollbar real-height reservation elsewhere in the
same effect.

This removes the divergent, subtraction-based computation rather than
compensating for it (e.g. no new "add a few px of buffer" fudge factor),
because a buffer would itself be a browser/OS/zoom-dependent number with the
exact same class of bug, and because the un-reduced `width: maxWidth` is
already provably wide enough without needing to guess at a safety margin.

## Alternatives Considered

- **Keep `getCustomScrollBarSize()` for header/footer, but also apply it to
  the body/sizer instead of `scrollbar-gutter`.** Rejected: this is the
  inverse of the chosen fix and has the same property of relying on a JS
  probe matching a real scrollbar's occupied space, rather than reusing one
  first-class CSS mechanism (`scrollbar-gutter`) everywhere. It would also
  touch the sizer's mounted-content measurement path, a larger and riskier
  change for a bug that doesn't require it.
- **Add a numeric buffer/fudge factor to `headerContainerWidth`** (e.g.
  round up, or add a few px of slack). Rejected per the task's own guidance:
  a fudge factor is itself a browser/OS/zoom-dependent number and doesn't
  remove the underlying defect, just narrows the range where it manifests.
- **Fix the `needScrollBar` height-comparison bug instead/also** (see Latent
  Bugs). Considered, because it's a plausible contributor to the
  "stays clipped after growing back" persistence. Rejected for this PR:
  it's a different defect (scrollbar *visibility* logic, not the
  *header/footer wrapper width* logic this fix targets), fixing it changes
  when scrollbars appear/disappear more broadly than this bug fix should,
  and the independent review already agreed it should stay out of scope.
- **Drop `scrollbarGutter`/`scrollBarStyles` from header/footer, keeping
  only the unconditional `width: maxWidth` change.** Considered once real
  hit-testing showed these aren't what prevents the reported clipping (see
  Root Cause). Kept anyway: while unverified against a reproduced defect,
  they're not free of purpose either — dropping them would let header/footer
  report a wider `clientWidth` than body during simultaneous horizontal and
  vertical scrolling, which is plausibly a real (if different) column
  misalignment risk during synced horizontal scroll. Removing them, on the
  evidence available here, would trade a proven-unnecessary line of CSS for
  a plausible new alignment gap, which isn't a clear improvement.

## Latent Bugs Found

- **`needScrollBar` height comparison in the same file's
  `useLayoutEffect`** (`useSticky.tsx` ~lines 199-205): it compares
  `innerHeight: fullTableHeight` (thead + tbody + tfoot) against
  `height: maxHeight - theadHeight - tfootHeight` (the body-only budget). The
  correct comparison is `fullTableHeight > maxHeight` (equivalently,
  `tbodyHeight > maxHeight - theadHeight - tfootHeight`); the current form
  double-counts the header/footer height, so `hasVerticalScroll` reports
  `true` up to `theadHeight + tfootHeight` px earlier than actually
  necessary, and only reverts to `false` once the chart is grown well past
  the point a user would expect. Verified by direct computation and by a
  real-browser measurement showing a 400px container reporting
  `hasVerticalScroll: true` for content that only needed 379px. Plausibly a
  meaningful contributor to why "grow the chart back up" doesn't always
  self-heal a scrollbar-adjacent layout issue (see Root Cause). Left
  unfixed — a different defect than the header/footer wrapper-width bug
  this PR fixes, and changing it alters scrollbar-appearance behavior more
  broadly than this fix should.
- At chart widths where the Total's *unbreakable* natural content width
  (numbers have no break points, so `table-layout: auto` cannot wrap them)
  is only barely smaller than the chart's total width, the total clips
  identically on master and on the fixed code, at every resize step,
  including before any scrollbar ever appears. Verified via the same
  real-browser sweep (both headless and headed Chromium). This is a
  different, more fundamental "the chart is too narrow for this content
  regardless of scrollbars" case, not the header/footer wrapper-width bug
  this PR targets — not fixed here.
- The `<col width={w} />` values passed to `<colgroup>` are floats (e.g.
  `95.65625`). The legacy HTML `width` attribute on `<col>` may be rounded
  down/truncated by some rendering engines, which could compound with either
  of the above. Not confirmed to matter on evergreen Chromium in this
  investigation; noted for anyone touching this file again.

## Prevention

Added `plugins/plugin-chart-table/test/DataTable/hooks/useSticky.test.tsx`,
which mounts `useSticky`'s `StickyWrap` for real (via `react-table`) with
mocked DOM measurements that force `hasVerticalScroll: true`, and mocks
`getCustomScrollBarSize()` to return a value distinguishable from any
CSS-computed one. It asserts, pinning the two invariants separately rather
than treating them as one:

1. **Load-bearing.** The header/footer wrapper's `style.width` matches the
   body's (`maxWidth`, not any pixel value) — pinning "header/footer's
   width is never reduced below what the shared colgroup needs." Fails
   against the pre-fix code (`258px` vs. expected `300px`, since
   `300 - 42 (mocked probe) = 258`, a header/footer wrapper genuinely
   narrower than the colgroup it has to display) and passes after the fix.
2. **Secondary.** The header/footer wrapper's `style.scrollbarGutter` and
   `className` (populated via the `css={scrollBarStyles}` prop) both match
   the body's — pinning "header/footer report the same `clientWidth` as
   body," which matters for keeping their synced horizontal `scrollLeft`
   consistent with body's real, scrollbar-reduced viewport (see Root
   Cause), not for preventing the reported clipping by itself.

The `className` assertion needed one more thing to be observable at all:
`useSticky.tsx` now carries a `/** @jsxImportSource @emotion/react */`
pragma (added just below the license header). Without it, this repo's
Jest/Babel setup passes the `css` prop straight through to the DOM as an
inert string attribute (`css="[object Object]"`, confirmed empirically —
`headerDiv.getAttribute('css')` returned exactly that before the pragma was
added) instead of resolving it through Emotion's JSX runtime into a real
class, because — unlike the webpack/SWC production build, which sets
`importSource: '@emotion/react'` globally for every file
(`webpack.config.js`, `createSwcLoader`) — this repo's `babel.config.js`
does not set the equivalent `importSource` for `@babel/preset-react` in its
Jest (`test`) env, and no file in this codebase currently carries the
per-file pragma that would substitute for it. Adding the pragma to this one
file makes Babel treat it exactly the way SWC already treats every file in
the real build (both resolve to the same `@emotion/react` JSX runtime): the
per-file pragma specifies the identical import source SWC already applies
globally, so it changes nothing about the shipped, webpack-built behavior —
it only changes what Jest's separate Babel pipeline can observe. This test
fails on the commit before
`css={scrollBarStyles}` was added to header/footer (header/footer
`className` is `''` while body's is populated) and passes on the fix
(verified by temporarily reverting just the two `css={scrollBarStyles}`
additions and re-running the test, then restoring them).
