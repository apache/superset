# Retest request: asset approval

**Please retest against `064d38fe5e`** (branch `asset-demo`).

Run 5 was taken at `3eef50b`, 15 commits behind the current tip, so part of
the open list was already addressed before we started on the rest.

All four R5 defects are now fixed, the critical one included. R5-05 is the
only item deliberately left, because it is a scope question rather than a
defect.

Thanks for the run, and for the production-like stack. The two findings from
our own adversarial pass that the suite did not cover are the ones worth
adding permanently.

## Status of every open item at `064d38fe5e`

| Item | Status at `064d38fe5e` | Action |
|---|---|---|
| R5-03 import with a new uuid overwrites by slug or table name | **Fixed** | Retest |
| R5-01 title-only save records `json_metadata` keys | **Fixed** | Retest |
| R5-02 PNG report shows the editor's review banner | **Fixed** | Retest |
| R5-04 Approvals list has no server-side pagination | **Fixed** | Retest |
| R4-08 filter edit creates an empty request | Fixed after your snapshot | Retest |
| R4-04 refused approval is silent on the Approvals page | Fixed after your snapshot | Retest |
| R5-05 approver-roles setting needs `superset init` | Will not reproduce, but **not resolved** | Record as an SOW 5.4 deviation |

Counts by issue, not by scenario: of the 7 open items from run 5, **6 are
fixed and 1 is a scope question**. We have not recomputed the 89 scenario
figure, since several scenarios map to one item.

### R5-03, fixed

The cause was in our gate rather than in the host importer. The collision
check looked up existing rows by `uuid` only, so a bundle carrying a fresh
uuid found no collision, raised no refusal, and the host importer then
matched the live row on its natural key and replaced it.

The gate now resolves the identity the import will really bind, asking the
host's own `find_existing_by_import_identity` rather than keeping a second
copy of the matching rules. A dataset's database is resolved from the
bundle's `database_uuid` first: left unresolved, `database_id` drops out of
the predicate and the check would match a table name in *any* database,
refusing first-time imports that collide by name alone.

Checked against the real models and database:

| Case | Result |
|---|---|
| Dashboard, new uuid, live slug | Refused |
| Dataset, new uuid, live table identity | Refused |
| Genuinely new dashboard | Imports (S-06 preserved) |
| Dataset, same table name, absent database | Imports, not refused |

Charts are unaffected by this shape: `Slice` declares no unique constraint
other than `uuid`, which matches what you saw.

### R5-01, fixed, in two halves

Superset recomputes a dashboard's cross-filter scopes from its layout on
every read and answers with the same chart ids in a different order. The
properties dialog posts back what it was given, so a title-only save
arrived with `chart_configuration` and `global_chart_configuration`
differing by ordering alone.

Those id collections are now sorted before comparison rather than exempted.
A cross-filter scope is reviewable (Visa Q3), so exempting the keys would
have bought the same quiet by making a genuine scope edit invisible, which
is the opposite of the point.

The second half: the reviewer's panel asked a looser question of its own,
comparing `json_metadata` as one blob. The payload carries the layout inside
it while the asset keeps the layout in a column of its own, so the two never
matched and a bare "json_metadata Changed" row survived even once the gate
had gone quiet. The panel now reports the fields the gate counted, so the
two cannot drift apart again.

Confirmed live: a title-only save reports only `dashboard_title`, and
removing one chart from a scope is still gated and still named.

### R5-02, fixed

A report or thumbnail is rendered by a headless browser signed in as a real
user, so an editor with a draft had their review banner drawn into the PNG
and sent on to the recipients, who are frequently viewers and whom SOW 5.5
says see no workflow UI at all.

The banner is now left out of a capture, on the dashboard and on the chart.
`standalone=3` is the mode core added for exactly this distinction, an
automated capture rather than a live chrome-less embed; the frontend's
`ExploreStandaloneMode` was missing it, so the chart path had the same leak.

### R5-04, fixed

Only the requested page is serialized, which is where the time went, while
every visible row is still counted so the list can say how much there is to
page through.

The filters moved to the server with the page. Narrowing the rows the
browser happens to be holding answers a different question from the one the
filter appears to ask: a match on page four would simply not be found. The
From filter's options are collected before the filters narrow anything, so
it still offers an author whose rows are not on this page, and the author
names are resolved in one query rather than one per row.

### R4-08, fixed in `32f896fd7f`, `3fc5e9421f`, `52fdbb9d2f`

The modal marked an item modified as soon as its form was touched, so
opening a filter and putting the value back still counted as a change. Each
filter now reports its own pristine value from its own form, and the
baseline is frozen at the last reading before the form is touched, so the
save compares against that rather than against the touched mark. The name
field debounces, which is why the earlier attempt still captured on a
keystroke.

### R4-04 on the Approvals page, fixed in `f3154a49b9`

Every refused action on that page now resolves the server's reason and
raises it as a danger toast, and the row is re-read either way, since the
commonest refusal is that the request moved underneath the reader.

### R5-05, will not reproduce, but please do not close it

The `ASSET_APPROVAL_APPROVER_ROLES` setting was removed, so there is nothing
to configure and nothing for `superset init` to restore. The scenario as
written will not reproduce.

It is not resolved, though, and we were wrong to describe it that way at
first. SOW 5.4 asks for an editor "with access, edit permission for that
asset type, and the approval permission". We currently require only that the
approver is a strict editor of the asset and is not the author. So:

| SOW 5.4 condition | Enforced |
|---|---|
| has access | Yes, as editorship of that specific asset |
| edit permission for that asset type | **No** |
| the approval permission | **No**, removed |

The approval permission was removed because a role gate above editorship can
only subtract, and the implementation was inconsistent while it existed:
`can_approve` consulted it and `eligible_approvers` did not, so narrowing the
roles would have named an approver the route then refused. Removing a gate
that was wired inconsistently was the right immediate call, but "it can only
subtract" is not an argument that it should not exist. Narrowing the approver
pool is ordinary segregation of duties, and this customer's driver is
compliance, so it should be Visa's decision rather than ours.

The missing asset-type permission check looks like a plain gap rather than a
decision, and we expect to close it once the clause is settled.

## Two findings from our own adversarial pass, not covered by the 89

Both were control failures, both are fixed in `666f8893d3`, and neither is
reachable by walking the documented flows, which is why they are worth
adding to the suite rather than just closing.

**A discarded change could still be published.** Firing Submit and Discard
together on one draft returned 200 from both and left a row reading
`pending` while carrying a decision, a reviewer and a freed slot, which is
a state no sequence of transitions can produce. The author was told
"Changes discarded.", the request stayed in the approver's queue, was
approved, and published to the live dashboard. The row lock had been added
for the concurrent-approve bug and given only to `approve`, so the other
four transitions' status guards were advisory. All five now load under the
lock and the loser gets a 409.

**Approving without naming a version published unread.** The staleness
check was skipped when the field was absent, so quoting a stale revision
was refused with 409 while an empty body returned 200 and published content
that had been rewritten after the reviewer's revision was taken. The guard
now fails closed.

Suggested scenarios to add, all at four workers:

1. Submit and Discard fired together on one draft. Expect exactly one 200
   and one 409, and a row whose status, slot and decision agree.
2. Approve with no `seen_revision`, and with an empty one. Expect 409 and
   nothing published.
3. Withdraw and Discard together, and Approve and Request changes together.
   Expect one winner each.
4. A reviewer opening a dataset whose SQL was rewritten. Expect the full
   proposed SQL, not an empty field. Values over 2000 characters are
   shortened and flagged rather than dropped.

## One open question for you and the product owner

A pending delete request can be silently replaced. With a delete submitted
and sitting in the approver's queue, one ordinary save by the author folds
into it, resets it to draft, clears `submitted_at` and rewrites its
operation from delete to update. The author is told only "Changes updated
in your existing draft", and the approver's queue item disappears with no
notice.

Nothing publishes unreviewed, so the control holds, but the author's
submitted delete is destroyed and the audit record changes its own meaning.
We have not fixed this, because two intents in the code disagree: `submit`
says the content is locked once submitted and the author must withdraw
first, while the fold path treats any fresh edit as returning a bounced
request to the author's hands, which is right for a request the reviewer
sent back and wrong for one that is merely pending.

The two candidate behaviours are to refuse an edit while a request is
pending and tell the author to withdraw, or to keep the fold but preserve
the operation and notify the reviewer. We would rather agree the semantics
than pick one.
