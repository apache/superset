# Making asset approval a 100% extension: the mount-point ledger

2026-11-07, against `fix/qa-regression-93` @ `ec2f3365f7`. Derived mechanically
from the tree, not from reading: every core file that imports the feature, and
which symbols it imports. The commands are in "How this was derived" so it can
be regenerated after each migration step.

## The finding that shapes everything

The 27 core mount points are not 27 problems. They import a vocabulary of
**three kinds**, and almost every file needs only one of them:

| Vocabulary | Symbols | Core files |
|---|---|---|
| **A — deferred write** | `isReviewRequired`, `announceChangeCaptured`, `reviewRequiredToast`, `refusalMessage`, `deleteReviewMessage`, `recoveredToast` | **15** |
| **B — governed query + the copy that depends on it** | `useGovernedDeletes`, `deleteIsGoverned`, `deleteConfirmLabel`, `archiveConfirmDescription`, `deleteActionLabel` | **6** |
| **C — view slots, panels, events** | `REVIEW_PANEL_SLOT`, `OpenChangesProvider`, `useOpenChange`, `onProposedChart`, `authorsDraftFormData`, `openChangeFor`, the `announce*` events | **13** |

Seven files appear in two groups (the three list pages, `ArchivedList`,
`DatasourceModal`), which is why the raw count is 27 rather than 34.

A and B are the same thing from two directions: the host dealing with a write
gate it does not own. A is "what happened to my write", B is "what will happen
if I write". Neither is a view-slot problem, which is why no amount of slot work
would have made this feature an extension.

## The backend is already the architecture we want

`superset/change_management.py` — 293 lines, **ours and not yet upstream** —
already is the generic contract, and it is extension-agnostic: the only mention
of this extension is one sentence of operator-facing copy at line 196. It
exposes `register_write_gate`, `is_write_gate_installed`, `is_review_signal`,
`review_signal_details`, `review_promised_but_unenforced`,
`refuse_unreviewed_tool_call`, `install_fail_closed_guard`.

The 13 changed files under `superset/mcp_service/` are **core consuming that
contract**, not feature logic in core. They are the right shape and they stay.

So the frontend problem is precisely that this contract has no counterpart:
`superset-frontend/src/core/` offers `http`, `commands`, `menus`, `navigation`,
`extensions`, `editors`, `chat` and nothing for a write that was accepted and
not applied. Nothing in `superset-ui-core` knows the string `review_required`.
PR 2 is that counterpart, and `change_management.py` is the reviewed precedent
to cite in its description.

## PR 1 — contribution points

Carries vocabulary **C**, and the framework work already written: 17 files,
~2857 insertions, of which `superset/extensions/view.py` is +728.

Already written: the pages contribution, the extension loader and namespace
changes, `superset/extensions/utils.py`, `superset-frontend/src/core/pages`.

Still to add, one named area per surface that has none:

| Area | Retires |
|---|---|
| `dashboard.banner` | `DashboardBuilder`, `DashboardWrapper`, `Header`, `useHeaderActionsDropdownMenu` |
| `explore.banner` | `ExploreViewContainer`, `SaveModal`, `pages/Chart` |
| `dashboard.sliceHeader` | `SliceHeader` |
| `navbar` | `RightMenu` (the bell) — in the view-slots work already |
| `list.rowAction`, `list.statusCell` | the review tag and the delete entry on all three list pages |
| `modal.notice` | `DatasourceModal`, `ArchivedList` |

## PR 2 — the deferred-write contract

Carries vocabularies **A** and **B**. Design it as *"accepted but not
applied"*, not as "review_required": review is one case of a deferred write,
and a contract scoped to our feature is the one upstream has grounds to
reject.

Three capabilities:

1. **Outcome.** The shared client resolves a `202` carrying a deferral as a
   success that did not apply, exposing the server's own sentence. Retires
   `isReviewRequired`, `reviewRequiredToast`, `deleteReviewMessage`,
   `recoveredToast`, `refusalMessage`.
2. **Announcement.** A host event for "a write was deferred", so a list can
   refresh its own row without knowing who deferred it. Retires
   `announceChangeCaptured`.
3. **Query.** A host-side "would a write to this asset be deferred?", answered
   by whatever gate is registered. Retires `useGovernedDeletes`,
   `deleteIsGoverned`, and lets `softDeleteCopy` word itself without importing
   the feature.

Capability 3 is the one to get right: it is what makes a delete dialog honest
about its own button, and it is the thing five QA rows turned on.

## Two upstream bugs, fixed properly, each in its own PR

Both are genuine Superset defects, independent of this feature. They are fixed
in core -- which is allowed, because a real upstream bug fix *is* an upstream
PR -- and each gets its own branch so neither rides along inside a framework
PR, where it would invite the wrong argument.

The alternative was compensating inside the extension. That was considered and
rejected: it would leave the bug in place for every other deployment, and our
wrapper would be restoring what core had already clobbered. A workaround that
fights core is worse debt than a two-line core fix with a test.

**Bug 1 — a resync wipes an editor's column flags.**
`superset/connectors/sqla/models.py`, `fetch_metadata`: `groupby` and
`filterable` are set True on every column it matches, including ones that
already existed. Restrict a column, press "Sync columns from source", the
restriction is gone. No review involved; any deployment hits it. For us it was
worse, because the dataset route runs that refresh *inside* the approval, so
approving "label one column" also reversed a restriction that had itself been
reviewed and that the reviewer never saw.

*Fix:* set the two flags only on a column the resync has just **added**. They
are editor choices and the source has no opinion about either, so matching an
existing column against the source is not a reason to change them. Branch
`fix/resync-column-flags`.

**Bug 2 — a save-path default missing from the diff map.**
`superset/versioning/diff.py`: `show_chart_timestamps` is absent from
`DASHBOARD_JSON_METADATA_SAVE_DEFAULTS`, which core version diffing uses to
decide whether a key going from absent to its own default is a change. Core
version history therefore reports a change nobody made. For us it made the gate
capture that change, which held an exempt-only save, which is why nobody could
be added as an editor through the properties dialog.

*Fix:* add the key to `DASHBOARD_JSON_METADATA_SAVE_DEFAULTS` with the value
the save path writes (`False`). Branch `fix/metadata-save-default`.

Both are small, both carry their own test, and both are independently useful to
Superset, which is what makes them submittable on their own rather than as
collateral in a framework PR.

## The integration branch

Cut from `apache/master`, **not** from this branch. Cut from here it would
inherit 156 core frontend files of feature code and could never show whether
the extension is self-sufficient — the host would keep quietly supplying the
feature.

Contents, and nothing else: upstream master, the four PR branches merged, the
extension installed.

### "100% extension" as a check, not a claim

```bash
git diff apache/master...HEAD -- superset/ superset-frontend/ \
  | grep '^diff --git' | wc -l
```

Every file in that diff must be attributable to one of the four PRs, from a
listed allowlist. In CI, so drift fails on the commit that causes it rather
than at handover.

### The uninstall test

Separation is proved by removing the extension, not by the feature working:
the host must come up with no review vocabulary anywhere, no dangling imports,
and every delete dialog, banner and list page intact. Lane D verified viewer
containment behaviourally; this is the architectural form of the same question.

## Keeping the QA process intact

The tests follow their subjects out of core, and that is a deliverable rather
than a consequence.

* `tests/unit_tests/change_management/` — **122 files** — moves into the
  extension's own suite.
* `tests/unit_tests/change_management/test_every_qa_row_has_a_home.py` moves
  with them and must keep passing: **90 corpus ids**, 18 exemptions with
  reasons. It is the only mechanical proof that no QA row was lost in the move.
* `superset-frontend/playwright/tests/asset-approval/` — 6 specs, 17 tests.
* Re-run the corpus after **each** surface migrates, not once at the end: with
  27 surfaces moved at once we would know something broke and nothing about
  which move broke it.

`fix/qa-regression-93` stays alive as the behaviour oracle. When a migrated
surface behaves differently, that is what to diff against.

## Open decisions

* `WhatChangedPanel` exists twice, in core and in the extension, and the two
  have already diverged — both needed the same patch on 2026-11-06. Migration
  must pick one owner.
* `superset/security/manager.py` and `superset/views/datasource/views.py` are
  unclassified: the first looks like editorship plumbing that may already be
  generic, the second is the legacy datasource route. Each needs a decision.
* R5-04 is open with its cause recorded in `api.py`. It is a loop restructure
  in code that moves to the extension, so it is cheaper to do after the move.

## How this was derived

```bash
# the mount points
grep -rl "features/changeManagement\|utils/softDeleteCopy" superset-frontend/src \
  --include=*.tsx --include=*.ts | grep -v "features/changeManagement/" \
  | grep -v "\.test\."

# vocabulary A
grep -rl "isReviewRequired\|announceChangeCaptured\|reviewRequiredToast\|\
refusalMessage\|deleteReviewMessage" superset-frontend/src --include=*.tsx --include=*.ts

# vocabulary B
grep -rl "useGovernedDeletes\|deleteIsGoverned\|deleteConfirmLabel\|\
archiveConfirmDescription\|deleteActionLabel" superset-frontend/src

# vocabulary C
grep -rl "REVIEW_PANEL_SLOT\|OpenChangesProvider\|useOpenChange\|\
onProposedChart\|authorsDraftFormData\|openChangeFor" superset-frontend/src

# is the host contract extension-agnostic?
grep -nE "asset_approval|asset-approval" superset/change_management.py
```
