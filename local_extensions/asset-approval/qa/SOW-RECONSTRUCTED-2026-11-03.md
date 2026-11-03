# The Visa SOW, as this codebase states it

**The signed SOW is not in this repository.** Neither is the Visa Q&A. This
document is reconstructed from the clause citations carried in the code,
the tests, the README and the QA papers, which is the only record of it we
hold. `DECISIONS-2026-11-02.md:197` says the same thing in as many words:
"The signed SOW is not in the repository either, so we cannot read §5.1
directly."

So read this as *what we have built against*, not as the contract. Where
the two differ, the contract wins, and the first job of anyone with the
signed copy is to check this page against it. Clause numbering below is
ours only in the sense that we are repeating the numbers the code cites.

Every row is traceable: `grep -rn "SOW 5\.\|Visa Q" --include="*.py"
--include="*.ts" --include="*.tsx" --include="*.md" . | grep -v node_modules`

## The commitment in one line

A change to a governed dashboard, chart or dataset does not reach viewers
until a second eligible editor approves it.

## Section 5: the workflow

| Clause | What the code cites it as saying | Where |
|---|---|---|
| **5.1** | Dashboards, charts and datasets are the governed asset types. Imports are in V1. A dashboard that has never been published is outside the gate, because while it is a draft no viewer can reach it. | `test_publish_exemption.py:19`, `UnpublishedNotice.tsx:29` |
| **5.2** | Certain changes are exempt, because none of them alter what a viewer sees: the editors, viewers and owners lists, tags, certification, and the description. Syncing a dataset's columns from the source is exempt too: it does not author a change, it re-reads what the database already says. | `changes.py:334-362`, `test_a_column_resync_is_exempt.py:19`, `test_certification_is_exempt.py:19` |
| **5.3** | A reviewer must be able to see what they are deciding on, including opening the current version in a new tab for side-by-side comparison. Datasets are reviewed as definitions. | `DatasetReviewModal.tsx:187`, `ReviewBanner.tsx:111` |
| **5.4** | The submitter can never approve their own change. Hidden and machine users are kept out of the approver list. An author with no eligible approver is told to add another editor, which is the documented way out of "nobody can approve this". | `README.md:114`, `test_machine_users_are_not_approvers.py:19`, `RequestReviewModal.tsx:96` |
| **5.5** | An author with an unsubmitted draft sees the live asset until they turn Show changes on. Viewers see no workflow UI at all. Another editor is told why the asset is locked. | `ReviewBanner.test.tsx:21`, `test_a_viewer_cannot_act_on_a_change.py:34`, `AssetLockedModal.tsx:68` |
| **5.6** | The Approvals inbox has four list views: for me, submitted by me, recently decided, all pending. The SOW also asks for a drafts view and a status filter. | `types.ts:180` |
| **5.7** | The instance states, read-only, whether review is required on it. | `api.py:838`, `ChangeReviewSettings.tsx:80` |

## Section 6: the feature flag

| Clause | What the code cites it as saying | Where |
|---|---|---|
| **6.1** | With the feature off, Superset behaves exactly as today. Nothing was promised, so nothing is withheld. | `test_fail_closed.py:92`, `useAssetReview.ts:37` |

## Section 8: what is not gated

| Clause | What the code cites it as saying | Where |
|---|---|---|
| **8** | Creating a new asset is not gated. Neither is Save as. | `DECISIONS-2026-11-02.md:211`, `CLOSURE-2026-11-02.md:103` |

## Section 9: who may approve

| Clause | What the code cites it as saying | Where |
|---|---|---|
| **9.3** | No administrator bypass in V1. An administrator who is not an editor of the asset cannot approve a change to it. | `README.md:119`, `test_approval_is_editorship_not_a_role.py:93` |

## The Visa questions

| Q | What the code cites it as saying | Where |
|---|---|---|
| **Q1** | No administrator bypass. Same answer as 9.3, from their side. | `test_approval_is_editorship_not_a_role.py:93` |
| **Q3** | A cross-filter scope is reviewable, so a chart entering or leaving one has to read as a change. | `test_a_title_save_does_not_report_the_cross_filter_scopes.py:32` |
| **Q6** | Viewers see no workflow UI. The API returns nothing for them, so there is no branch that could leak the existence of a pending change. | `ReviewBanner.tsx:84` |
| **Q7** | Visa keeps no rejection history. "Request changes" returns the same record to the author rather than closing it and opening another. | `types.py:49`, `lifecycle.py:21` |
| **Q8** | Requests never expire. A stale one is drawn in amber after three days, which is a nudge and not a deadline. | `display.ts:50`, `ReviewBanner.tsx:164` |
| **Q11** | Datasets are reviewed as definitions: "a diff of columns, metrics and SQL". Charts are deliberately not re-rendered against the draft dataset. | `test_the_reviewer_sees_the_proposed_value.py:28`, `DatasetReviewModal.tsx:189` |
| **Q12** | Each overwritten asset in an import gets its own request. | `README.md:259` |

## The acceptance criterion the build is judged on

Only one is quoted by number anywhere in the tree:

> **Acceptance criterion 2.** Nothing reaches viewers without a second
> editor's approval, through the UI and the API.

That is the criterion the 2026-10-23 product acceptance failed the build
on, and the one the 2026-11-03 retest reports as holding on every route
tested. `PA-RETEST-2026-11-03.md:8`.

AC1 and AC3, if they exist, are cited nowhere. That is itself a gap worth
closing before sign-off: we are reporting against a numbered criterion
whose siblings we cannot name.

## Where we knowingly depart from it

Three, all of them deliberate and all of them needing Visa's agreement
rather than ours:

1. **Imports are refused, not captured** (§5.1, Q12). An import that would
   overwrite an existing asset is refused with a message directing the
   author to make the change in Superset instead. Capturing one means
   storing an uploaded archive and replaying it on approval, and the
   change-request table is not somewhere to put a zip. This is a narrowing
   of scope, not a defect, and it is the one open item on the retest that
   testing cannot close. `README.md:256`, ticket 129072.
2. **The Approvals inbox has no drafts view and no status filter**, which
   §5.6 asks for. `DECISIONS-2026-11-02.md:1201`.
3. **A first publish is reviewed as a field diff**, not by showing the
   approver the dashboard they are being asked to expose. Defensible on a
   narrow reading of AC2 and recommended for V1 with the caveat written
   down, but the thing the reviewer reads does not describe what they are
   deciding. `DECISIONS-2026-11-02.md:965-995`.

Plus the agreed V1 exclusions, which are scope rather than departure:
creation and Save as ungated (§8), and no administrator bypass (§9.3, Q1).

## What this means for sign-off

The V1 exclusion list is spread across three documents and no single place
states it. `DECISIONS-2026-11-02.md:1189` recommends writing it as one page
and having Visa sign it, so that the sign-off means something specific.
That has not been done. Until it is, the deferrals are our assertions
rather than their agreement, which is the difference between a documented
scope and an undocumented gap.
