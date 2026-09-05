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

This section was revised after an independent review correctly challenged
the first version's evidence. What follows separates what is directly
verified from what remains inferred, including a place where deeper
real-browser testing overturned my own first conclusion.

**Verified — the defect class is real, and I have a genuine, non-forced
reproduction of it, but not against unmodified master.**

`useSticky.tsx`'s `StickyWrap` builds one shared `<colgroup>` (used by the
header, body, and footer `<table>`s under `table-layout: fixed`) by measuring
column widths inside a hidden "sizer" `<div>`. That sizer, and the real
scrollable body `<div>`, both use `scrollbar-gutter: stable` *and* the same
custom `::-webkit-scrollbar { width: 8px }` styling (`scrollBarStyles`,
`useSticky.tsx:230-248`). Master's header/footer wrapper `<div>`s, however,
computed their width as `maxWidth - scrollBarSize`, where `scrollBarSize`
comes from a **separately JS-measured probe**, `getCustomScrollBarSize()`
(`getScrollBarSize.ts:77-85`) — a different code path than the CSS
`scrollbar-gutter` property the body/sizer rely on.

Testing directly in a real, non-headless Chromium (via Playwright + a real
Xvfb X11 display, not just headless — see "How this was verified"), I found
that **`scrollbar-gutter: stable`'s reserved width depends on whether
`::-webkit-scrollbar` custom styling is applied to that same element**:  an
element with the custom scrollbar styling reserves 8px (matching
`CUSTOM_SCROLLBAR_SIZE`); the identical element *without* that styling
reserves 15px (the browser's native scrollbar width). This held across six
zoom levels (0.75×–1.5×) and both headless and headed rendering. This is the
verified, non-obvious mechanism: **the amount of space `scrollbar-gutter:
stable` reserves is not a fixed constant — it's contingent on scrollbar
styling applied to that specific element**, so any two elements in this file
that reserve gutter space must carry identical scrollbar styling or their
reservations can differ.

I confirmed this concretely by testing an intermediate, incomplete fix (see
below): converging the header/footer onto `scrollbar-gutter: stable` *without*
also giving them the same `scrollBarStyles` custom-scrollbar CSS the
body/sizer carry reserves the *unstyled* 15px on header/footer while the
sizer (styled) still computes the shared colgroup against its own 8px
reservation. Real, non-forced consequence, measured with real DOM APIs in a
real browser: header/footer wrapper `clientWidth` = 190px, footer `<table>`
`scrollWidth` = 194px — a genuine 4px overflow of an `overflow: hidden`
container, i.e. real clipping, with no mocked/forced values anywhere. This
is a live demonstration that "two independently-computed reservations for
the same scrollbar must be trusted to agree" is a real, reproducible failure
mode in this exact file, not a hypothetical one — it's just not the
failure mode present in unmodified master.

**What I could NOT verify: that unmodified master's specific
`getCustomScrollBarSize()`-based arithmetic diverges from the body/sizer's
reservation under any real (non-forced) browser condition available in this
sandbox.** My first pass at this RCA claimed this divergence based on
*headless* Chromium alone, where the probe read 0px against a 15px
"unstyled" gutter comparison — but that comparison was wrong on two counts,
both caught in review:

1. It compared the probe against an *unstyled* gutter reservation, but the
   body/sizer's actual reservation is the *styled* one (8px), which is what
   the probe is supposed to represent in the first place.
2. Headless Chromium's synthetic scrollbar probe (an off-screen
   `overflow: scroll` div) reads 0px in this environment — but re-running
   the identical probe in a **real, headed** Chromium session (Playwright
   launched against a real Xvfb X11 display, not headless) gives 8px,
   *exactly* matching the styled `scrollbar-gutter` reservation. I swept
   chart widths from 260px down to 190px, the full shrink→grow→resize
   sequence, and six zoom levels, all against unmodified master code in the
   headed browser: header, body, and footer `clientWidth` were identical at
   every single step. Master's arithmetic and the body/sizer's CSS
   reservation agree in every real-browser condition this sandbox could
   produce.

So: the specific numeric mismatch I originally proposed as "the" root cause
does not reproduce against master in real (non-headless) Chromium. It's
inferred, not verified, that some other real browser/OS/scrollbar-theme
combination (not available in this sandbox — only one Linux/Chromium build
plus a real X11 display were on hand) causes `getCustomScrollBarSize()` to
diverge from `scrollbar-gutter`'s reservation against master's code
specifically. One concrete, in-product example of a non-standard rendering
path that could plausibly matter here: Superset's own Alerts & Reports
feature renders dashboards through a headless browser to generate email
screenshots, which is exactly the rendering mode where I *did* observe the
probe read 0 — though even there, master's specific direction of mismatch
(probe reading *lower* than the styled reservation) produces wasted space,
not clipping, so it doesn't fully explain the report either.

**A more likely contributor to the exact reported persistence
("stays clipped after growing back"), inferred but grounded in a separately
verified defect:** see the `needScrollBar` height-comparison bug under
"Latent Bugs Found". It makes `hasVerticalScroll` switch on too easily and
switch back off only once the chart is grown by an extra
`theadHeight + tfootHeight` px beyond what's actually needed — i.e. it's
easy for the scrollbar state, and the ~8px width reservation that comes with
it, to stay "on" after a grow-back that should have turned it off. A Total
value sized close to the chart's edge in the first place, combined with that
stuck reservation, plausibly explains "shrink, then grow back, and it's
still cut off" independent of whether the header/footer/body reservations
agree with each other. This bug is real (verified by direct computation and
by measurement) but left unfixed here — it's a distinct defect, and fixing
it would change scrollbar-appearance behavior more broadly than this PR
should.

**Why the fix stands regardless of an unpinned master trigger:** master's
approach relies on a JS probe built from a *synthetic, unrelated* DOM
element correctly predicting what a browser's `scrollbar-gutter` CSS
property will reserve on a *completely different* set of elements. I've
shown this holds in the one real browser available here, but nothing
guarantees it holds everywhere Superset runs — and I demonstrated, concretely
and without forcing anything, that the moment any part of this file reserves
gutter space through a path that isn't identical to the body/sizer's, real
clipping results. The fix removes that reliance entirely: header, footer,
body, and the sizer now all reserve scrollbar space through the exact same
mechanism (`scrollbar-gutter: stable` plus the same custom scrollbar
styling), so there is no longer a second, independently-measured number that
could ever disagree.

### How this was verified

jsdom (this repo's Jest environment) does not implement real CSS layout —
`getBoundingClientRect`/`clientWidth` are stubbed — so this mechanism cannot
be observed through a jsdom test. To avoid reasoning-only conclusions:

1. Built a throwaway harness (`.scratch-repro/`, not part of this diff,
   removed before committing) that imports the **real, unmodified**
   `useSticky.tsx` through `react-table`, bundled with esbuild.
2. Initially drove it with Playwright's default **headless** Chromium
   (already cached in this sandbox, no download needed). This is what
   produced the first (incorrect) conclusion above.
3. On review pushback, re-ran the same harness against a **real, headed**
   Chromium session: started `Xvfb` directly (no `xauth` available in this
   sandbox, so `xvfb-run` didn't work; launched `Xvfb :99` manually and
   pointed `DISPLAY=:99` at a real `chromium.launch({ headless: false })`
   session) — genuine on-screen rendering, not headless approximation.
4. Measured the same probe-vs-gutter comparison in both modes and found
   headless and headed Chromium disagree with each other on the probe's
   result (0px vs. 8px) even though they agree on the CSS-only
   `scrollbar-gutter` reservation (15px unstyled / 8px styled in both) —
   i.e. the divergence I first reported was an artifact of the headless
   probe technique, not a property of real rendering.
5. Swept chart widths (260px→190px) through the full
   shrink→grow-back sequence, and six zoom levels, against unmodified
   master in the headed browser: no divergence between header/body/footer
   at any point.
6. Reproduced real, non-forced clipping (190px container vs. 194px content)
   by testing an incomplete fix (`scrollbar-gutter` on header/footer without
   the matching `scrollBarStyles`) — in both headless and headed Chromium
   identically.
7. Applied the corrected fix (`scrollBarStyles` + `scrollbar-gutter` on
   header/footer, matching body/sizer exactly) and reswept the same width
   range and resize sequence: header, body, and footer `clientWidth` are
   identical at every step, in both headless and headed Chromium.
8. Also found (documented under Latent Bugs, not fixed): at chart widths
   narrow enough that the total's *unbreakable* natural width barely exceeds
   even the full, unreserved chart width, clipping occurs on **both** master
   and the fixed code, identically, at every resize step including before
   any scrollbar ever appears — this is a `table-layout: auto` sizer
   correctly refusing to shrink an unbreakable numeric string below its
   natural width, an orthogonal "chart is too narrow for this content at
   all" case, not the reservation-mismatch defect this fix addresses.

This traces the defect through actual DOM state in a real, on-screen
browser at each step, not just a prose description of what "should" happen
— and this write-up says plainly where that tracing overturned an earlier,
headless-only conclusion rather than smoothing over it.

## Why It Wasn't Caught

There is no test coverage of the sticky header/footer/body width-sync
mechanism at all. Every existing test that renders `TableChart` or
`DataTable` explicitly passes `sticky={false}`
(`plugins/plugin-chart-table/test/TableChart.test.tsx`), and
`plugins/plugin-chart-table/test/DataTable/` only had a test for
`getScrollBarSize.ts` in isolation — nothing exercises `useSticky.tsx`'s
`StickyWrap` component, so none of the four fixes to this exact mechanism
since 2022 (#21064, #26964, #36891, #42573) added a regression guard for the
underlying invariant (header/footer/body must all reserve scrollbar space
through the same mechanism). Each fix addressed the specific manifestation
someone happened to reproduce, without a test pinning the invariant itself.

Manual QA also wouldn't reliably catch a reservation-mismatch of this kind:
it would depend on the reporter's specific browser/OS/rendering-mode
scrollbar behavior, which is exactly the kind of environment-sensitive
condition this investigation had to build custom real-browser tooling
(headless *and* headed) to even observe directly.

## The Fix

`superset-frontend/plugins/plugin-chart-table/src/DataTable/hooks/useSticky.tsx`,
in `StickyWrap` (~lines 289-345):

1. Removed the `headerContainerWidth = hasVerticalScroll ? maxWidth -
   scrollBarSize : maxWidth` computation and the numeric
   `width: headerContainerWidth` on the header/footer wrapper divs.
   Replaced with `width: maxWidth` plus
   `scrollbarGutter: hasVerticalScroll ? 'stable' : undefined` — the same
   CSS property the body div already uses.
2. Also applied `css={scrollBarStyles}` (the same custom
   `::-webkit-scrollbar` styling the body/sizer already carry) to the
   header/footer wrapper divs. This step is required, not cosmetic:
   `scrollbar-gutter: stable`'s reserved width depends on this styling being
   present (verified above), so header/footer must carry it too or they
   reserve a different amount than the body/sizer just did.

Header, body, footer, and the sizer that computes the shared `<colgroup>`
widths now all derive their available width from the exact same mechanism,
so they cannot disagree regardless of what any given browser's
`::-webkit-scrollbar`-based JS probe measures. `getCustomScrollBarSize()` is
untouched and still used for the separate, legitimate horizontal-scrollbar
real-height reservation elsewhere in the same effect.

This removes the divergent computation rather than compensating for it (e.g.
no new "add a few px of buffer" fudge factor), because a buffer would itself
be a browser/OS/zoom-dependent number with the exact same class of bug.

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
  it's a different defect (scrollbar *visibility* logic, not
  *width-reservation-consistency* logic), fixing it changes when scrollbars
  appear/disappear more broadly than this bug fix should, and the
  independent review already agreed it should stay out of scope.

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
  unfixed — a different defect than the reservation-consistency bug this PR
  fixes, and changing it alters scrollbar-appearance behavior more broadly
  than this fix should.
- At chart widths where the Total's *unbreakable* natural content width
  (numbers have no break points, so `table-layout: auto` cannot wrap them)
  is only barely smaller than the chart's total width, the total clips
  identically on master and on the fixed code, at every resize step,
  including before any scrollbar ever appears. Verified via the same
  real-browser sweep (both headless and headed Chromium). This is a
  different, more fundamental "the chart is too narrow for this content
  regardless of scrollbars" case, not the reservation-mismatch this PR
  targets — not fixed here.
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
CSS-computed one. It asserts the header/footer wrapper's `style.width` and
`style.scrollbarGutter` match the body's — i.e. it pins the invariant
("header, body, and footer must derive their available width from the same
mechanism") rather than any specific pixel value. It fails against the
pre-fix code (`258px` vs. expected `300px`, since
`300 - 42 (mocked probe) = 258`) and passes after the fix. Note this jsdom
test cannot verify the `scrollBarStyles`/`css` prop half of the fix (emotion's
`css` prop doesn't resolve to an observable `className` in this repo's Jest
setup — confirmed empirically before settling on this assertion shape), only
the `style.width`/`style.scrollbarGutter` half; the `scrollBarStyles`
requirement is verified instead by the real-browser harness described above.
