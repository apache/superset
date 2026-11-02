# Second QA pass: adversarial, as an ordinary user

2026-11-02. The brief was to stop walking the happy path and behave like a
normal user who is impatient and clicking everything: double-clicks, two
tabs, going back, hammering a flow until something gives.

Every state in this pass was set up and torn down through the product's own
write paths. Dashboard 7's title was changed and restored by capture,
submit and approve, never by SQL, after a phantom finding earlier in the
project turned out to be an artefact of editing rows behind the app's cache.

## Summary

Nine attacks. Seven held. **Two were control failures, both now fixed**, and
both of the same shape as the six "Fixed while broken" rows diagnosed
earlier: the original fix had landed on the one path its bug report named,
and the class of bug survived everywhere else.

| # | Attack | Result |
|---|---|---|
| 1 | Approve twice at once | Held: one 200, one 409 |
| 2 | Hostile input in every text field | Held: no injection. Uncovered a separate defect (below) |
| 3 | Save twice at once | Held: both folded into one request |
| 4 | **Submit and Discard at once** | **FAILED: published a discarded change. Fixed** |
| 5 | Withdraw and Discard at once | Held: legal in sequence, row coherent |
| 6 | Approve and Request changes at once | Held: one 200, one 409 |
| 7 | Submit twice / Discard twice at once | Held: one 200, one 409 each |
| 8 | Approve content that moved after loading | Held when a version is quoted |
| 9 | **Approve naming no version at all** | **FAILED: published unread. Fixed** |

## Finding 1: a discarded change could still be published

Firing `submit` and `discard` together on one draft returned **200 from
both**. The row came back:

```
status='pending', active_slot=NULL,
submitted_at=18:05:40.863, decided_at=18:05:40.860, reviewer_fk=3
```

Pending by its status, decided by its columns, and the asset unlocked. That
state is not reachable by any sequence of transitions.

The consequence, confirmed end to end: the author is told **"Changes
discarded."**, the request stays in the approver's queue, the approver
approves it, and it **publishes to the live dashboard**. An impatient
double-click publishes content the author believes they threw away.

### Cause

Only `approve` took the row lock. `_locked` had been added for 129071
(three concurrent Approves all returning 200) and was given to exactly the
one transition that report exercised. `submit`, `request_changes`,
`withdraw` and `discard` all still read the row unlocked, so each one's
status guard was advisory: two transitions read the old status, both passed
their own guard, and both wrote.

### Fix

Every transition now loads its request through `_locked`. The loser fails
its own guard with `InvalidTransitionError` and gets a 409 instead of a
false 200.

`_locked` also gained `populate_existing()`. Without it SQLAlchemy hands
back a row already in the identity map with its attributes as first loaded,
so the guard would read a stale status while holding the lock, which looks
exactly like the bug it was added to fix.

The metadata database here is PostgreSQL, so `SELECT ... FOR UPDATE` is
genuinely enforced; this is real serialisation and not a timing accident.

Re-tested live: `submit` + `discard` now gives one 200 and one 409 ("A
change request that is discarded cannot be submitted"), the row is
coherent, the discarded request is out of the queue and unapprovable.

Regression test: `test_every_transition_takes_the_lock.py`. A race is
awkward to drive from a unit test and a behavioural one would pass against
the broken code whenever the timing missed, so the test asserts the
structural fact that failed: every transition loads under the lock. It also
carries a drift guard that fails if a sixth transition is added without
being listed.

## Finding 2: approving without naming a version published unread

129070 added the staleness check: an author can withdraw, rewrite and
resubmit while a reviewer holds the page, so the approver quotes back the
revision they were shown and a request that moved underneath them is
refused.

The guard read `if seen_revision and ...`. Quoting a stale version was
correctly refused with 409. Sending the **same approve with an empty body**
returned 200 and published.

Demonstrated: a change was submitted as "Benign Title", then rewritten to
"SNEAKY REWRITE" after the reviewer's revision was taken. The stale quote
was refused. The no-quote approve published "SNEAKY REWRITE" to the live
dashboard.

A control a caller can switch off by leaving a field out is not a control.

### Reachability

The product's own UI always sends the revision, and there is exactly one
approve surface (the review panel; the queue only links to the asset). So
this is not reachable by clicking. It is reachable by any authenticated API
caller, which matters for a maker-checker control intended for audit: the
honest answer to "can an approval be recorded without attesting to a
version?" was yes.

### Fix

The guard now fails closed, and the requirement is decided by the server's
own state rather than the caller's: it applies exactly when there is a
revision to quote.

```python
current_revision = revision_of(change_request)
if current_revision is not None and seen_revision != current_revision:
    raise ReviewedVersionStaleError()
```

Both `None` and `""` are "did not say", and neither passes. A request with
no `changed_on` has nothing to attest to and is left alone, which is what
keeps this from becoming a flag a caller could argue about and what keeps
it from churning the fifteen existing tests that call `approve` on stubbed
rows.

Verified by clicking, not just by fetch: Approve in the review panel still
works end to end (approved, reviewer recorded, published, banner cleared).
That mattered because making the field mandatory would have broken any UI
path that omitted it.

Regression test: `test_approving_names_the_version_reviewed.py`.

## Defect found while attacking, not by an attack

Attack 2 put hostile strings into every field. Nothing injected. But the
long inputs exposed a real weakness: any value over 300 characters was
rendered to the reviewer as `None`, which the panel draws exactly as an
emptied field. The reviewer saw the old value struck through with nothing
in its place.

The title was the mild case. `sql` is not an opaque field, so it took the
same path, and real SQL is hundreds of characters, so a dataset whose SQL
had been rewritten showed the reviewer **nothing at all** while Visa Q11
asks for datasets to be reviewed as definitions, "a diff of columns,
metrics and SQL". Approving what you cannot see is the thing this feature
exists to prevent.

Fixed: values are shortened at 2000 characters and flagged `truncated`
rather than dropped, so the panel can never imply a field was emptied.
Regression test: `test_the_reviewer_sees_the_proposed_value.py`.

## Held, with notes

**Withdraw + Discard both returned 200.** Not a bug. Withdraw took the
request pending to draft and Discard then took draft to discarded, which is
a legal pair in that order, and the row is coherent with it
(`discarded`, `submitted_at` null, `decided_at` set). Finding 1's row was
impossible in any order, which is what separated the two.

**Naming yourself as the requested approver is accepted.** `submit` lets an
author set `requested_approver_id` to themselves. The control holds:
`can_approve` is false, the approve is refused, and the request does not
appear in the author's own queue. Nothing is orphaned either, because the
`for_me` queue filters on pending, not-author and `can_approve`, and never
on the requested approver, so the eligible approver still sees it. This is
a cosmetic hint pointing at someone who can never action it. Recorded, not
fixed: validating it is an API contract change with no gain to the control.

**A refusal message is imprecise.** Approving without naming a version now
answers "This change was updated after you opened it", which is not what
happened; the caller simply did not say what they saw. The UI cannot reach
this path, so the wording is only seen by API callers. Recorded, not fixed.

## State of the environment

The app container entered a restart loop part-way through this pass: a
truncated `apache_superset…dist-info` in the container's venv made the
entrypoint's editable reinstall fail repeatedly. Docker was holding 34.5 GB
of reclaimable images and a 4.4 GB build cache against 23 GiB free, which
fits a short write. Build cache pruned, container recreated from the image,
healthy since. No product code was involved and no test result depended on
it; the races above were run against a healthy app before and after.

Dashboard 7's title is back to "USA Births Names (Q4)" and no change
request is open against it.

Backend suite: 455 passed, 4 skipped.
