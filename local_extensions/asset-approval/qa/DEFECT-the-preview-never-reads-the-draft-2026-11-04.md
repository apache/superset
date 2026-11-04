# The preview surfaces never read the author's draft

Recorded 2026-11-04, after the fixes on `fix/qa-regression-93` were verified.
**Not fixed.** Written down to be looked at after the current round of testing.

Three reported symptoms on three different screens turn out to be one defect:
every surface that claims to *show* a proposed change reconstructs it from the
live asset instead of from the change request. The gate captures correctly and
the text sidebar reports correctly; only the visual preview is wrong.

| Symptom | Where it was reported |
|---|---|
| Show changes leaves the dashboard grid untouched | found here, new |
| After a held save, Explore still draws the live chart | sc-131032 |
| Revising a sent-back chart change silently drops the author's earlier edits | reported as a new High |

## What was measured

A dashboard restructure was captured on dashboard 6 and left `pending`:
four chart resizes (widths 6 -> 9, 6 -> 3, 3 -> 6; height 53 -> 80), the chart
order reversed inside three rows, the row order reversed inside both tabs, seven
charts removed, the `Exploratory` tab deleted and a `Regional breakdown` tab
added.

The capture is sound. Live holds **10** charts in `json_metadata.positions`; the
draft holds **3**, with the resizes and the reordering present. The review
sidebar names every removed chart, the deleted tab and the added tab.

With **Show changes** turned on, the banner flips to "Viewing your changes" and
the title changes to the proposed one. **The grid is identical to live** -- same
sizes, same order, same tabs, same rows. Only `dashboard_title` is applied.
Screenshots: `sc-124561-grid-show-changes-OFF.jpg` and
`sc-124561-grid-show-changes-ON-identical-grid.jpg`.

## Why it is the same defect three times

`proposedChartFormData`, `useProposedPreview` and `ProposedChartPreview` live in
`superset-frontend/src/features/changeManagement/` and are consumed by
`AssetReview.tsx`, the reviewer's panel. Nothing seeds a *working surface* from
the draft:

* `superset-frontend/src/explore/` has no import that reads the draft. Explore
  initialises from the live chart, which is sc-131032.
* Because Explore starts from live, the author's next save carries a `params`
  rebuilt from live. `gate._fold_into` then replaces the draft's `params` with
  it -- correctly, by its own rule that "Explore posts every control, so a body
  with `params` asserts the whole chart". That is the lost-edit High, and the
  fold is not the thing at fault.
* The dashboard's Show-changes toggle applies scalar fields and never applies
  `json_metadata.positions`.

## Why it matters more than it looks

The sidebar tells the truth in words while the preview contradicts it in
pictures, and people trust the picture. On the change measured above a reviewer
would be approving the removal of seven charts and a tab while looking at a
dashboard where all of them are still on screen.

It is also the one defect class QA has now reported from three directions
without us recognising it as one thing, which is why it is recorded here rather
than as three tickets.

## Shape of a fix, for whoever picks this up

One piece of work, not three patches: give the preview path a single way to
build "the asset as proposed" from a change request, and use it in all three
places -- the dashboard Show-changes toggle, Explore's initialisation when the
author has an open draft, and the revision flow. `proposedChartFormData` is
already most of the chart half.

Two things to decide rather than assume:

* `json_metadata.positions` is where a dashboard layout travels (the same fact
  behind the B3 fold fix). The preview has to merge positions, not just
  top-level fields.
* Seeding Explore from the draft changes what "discard" means for an author who
  wants to start again from live. That needs a deliberate answer.

## Also seen, lower priority

After a held save the dashboard page keeps rendering the edit session's layout
until a reload, while the banner says "you and viewers are both seeing the live
version". A reload corrects it. Same family: the page and the banner disagree
about which version is on screen.
