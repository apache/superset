<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# Asset approval decision register

Companion to `REPORT-2026-11-02.md` and `REGRESSION-2026-11-02.md`. Those two
say what the build does. This says what we have decided, what we are asking
VISA to decide, and what has to be true before QA can sign the epic off.

Nothing here is a code change. Twenty-five decisions, each with an owner. Six
of them genuinely need VISA; the rest we own, and every one of those has a
recommendation that can be actioned today.

## Why a register and not a bug list

Engineering on this epic is finished. The tracker (SC-124561) holds 45 rows
and four are still open: S-05, S-06, S-07 and S-09. None of the four is
missing code. Each has working code sitting behind a documented default, and
each is open because somebody has to choose the default.

That is a different kind of item from a defect, and it needs a different
record. A defect closes when the behaviour changes. A decision closes when
somebody with authority writes down the choice, and a bank's control reviewer
will ask to see that writing, not the commit.

## Status at a glance

| ID | Decision | Signed by | If undecided at sign-off |
|---|---|---|---|
| D-01 | S-05: which roles may approve | VISA | Caveat |
| D-02 | S-06: the written §5.1 import disposition | VISA | **Blocker** |
| D-03 | S-07: which role names are service accounts | VISA | Caveat |
| D-04 | S-09: which branch the delivery targets | Delivery team | Caveat |
| D-05 | QA-19 / NEW-2: the author sees the live version | PM | Record only |
| D-06 | QA-05: a captured delete stays a draft | PM | Record only |
| D-07 | QA-07: an author who lost edit access | PM | Record only |
| D-08 | QA-09: warn on a dependency, do not order it | PM | Record only |
| D-09 | QA-02: file the legacy datasource defect upstream | PM | Record only |
| D-10 | The admin dead end on embedded configuration | PM | Caveat |
| D-11 | QA-16 residual: the author's note in version history | PM | Caveat |
| D-12 | NEW-6 residual: `/approvals` renders for a Gamma | PM | Record only |
| D-13 | The delete copy contradicts itself | PM | **Blocker** |
| D-14 | Where the reviewer lands after approving a delete | PM | Caveat |
| D-15 | Restoring gives no feedback | PM | Caveat |
| D-16 | A viewer's browser cache outlives an approval | Delivery team | Caveat |
| D-17 | `eligible_approvers` does not check the approval right | Delivery team | **Blocker if D-01 narrows** |
| D-18 | QA-18b: what the approver sees at a first publish | VISA | Caveat |
| D-19 | Is the approval record audit evidence, and for how long | VISA | Caveat |
| D-20 | The twelve NEW defects were never filed | PM | Caveat |
| D-21 | Two rows are unit-tested only; one path is unwalked | Delivery team | **Blocker** |
| D-22 | The written V1 / V2 boundary | VISA | **Blocker** |
| D-23 | QA-04 residual: the filter modal closes on a refusal | PM | Caveat |
| D-24 | QA-07 residual: Approve is offered when it cannot work | PM | Caveat |
| D-25 | Removing yourself from an asset's editors is ignored | PM | Record only |

Four blockers, one conditional blocker. Everything else is a caveat in the
sign-off note or a line in this file.

D-23, D-24 and D-25 come from the extended regression walk, which has since
covered QA-03, QA-04, QA-07 and QA-21 by hand. All four passed. Two left
residuals, which are the first two rows above, and D-24 is the undelivered half
of a decision this register had already recorded as taken, which is exactly the
kind of thing a register is for.

---

# Part 1. The four open tracker rows

## D-01. S-05: which roles may approve a change

### The question

Reviewing a change and making a change are now two different rights. Which
job titles at VISA should hold the reviewing right?

### What is built

A permission called `can_approve` exists on the change request record and is
enforced on the route, not only hidden in the interface. It covers **approve**
and **request changes**. Submitting, withdrawing and discarding your own
change stay on the ordinary editing right. The config key
`ASSET_APPROVAL_APPROVER_ROLES` names the roles that hold it.

Holding the right is necessary and never sufficient. An approver still has to
be an editor of that specific asset on the merits, and never the author. There
is no administrator bypass.

Left unset, the right lands on whichever roles already held the editing right,
which on a stock Superset is Admin, Alpha and Gamma. That is deliberately the
same set as before the split, so an instance that configures nothing behaves
exactly as it did.

### Options

**(a) Ship the default and let VISA configure at deployment.** Behaviour is
unchanged from the build QA has been testing, so nothing QA has signed moves
underneath them. A control reviewer will read the shipped default as "every
role that can edit can also approve", and will want to know why that is not a
segregation-of-duties failure. The answer is good and we must be ready to give
it: the approval still requires a *different* editor of that same asset, so the
right alone buys nobody anything. The reviewer will probably accept that and
still ask for the narrower list, which is a config file edit.

**(b) Narrow the shipped default ourselves, to Admin and Alpha.** Reads better
to a control reviewer: the role Superset gives to people who mostly consume
dashboards no longer carries an approval right at all. It also changes
behaviour after QA finished testing, and it has a sharp edge. A Gamma can
author a governed change. If the only other editor of that asset is also a
Gamma, the change becomes unapprovable, and because of D-17 the author is told
an approver exists and then gets refused at the moment they try. Narrowing is
only safe after D-17 is fixed.

**(c) Set it to the empty list.** Nobody approves anything. The feature is off
in effect while appearing to be on. Not a real option; listed because the
config key accepts it and somebody will eventually try it.

### Recommended decision

**(a), with a written recommendation attached.** Ship the behaviour-preserving
default. In the hand-over note, tell VISA the configuration we recommend:

```python
ASSET_APPROVAL_APPROVER_ROLES = ["Admin", "Alpha", "<their reviewer role>"]
```

with Gamma removed, and apply it as a deployment step once they confirm their
role inventory. Fix D-17 first, because that configuration is what exposes it.

Why not (b): we would be guessing at VISA's role topology from a stock
install's role names, and a wrong guess here does not fail safe in the user's
eyes. It fails as "I cannot get my work approved", which is the worst failure
mode this feature has.

What would change my mind: if VISA's control reviewer has already written that
approval rights must be held by a named role and nothing else, then (b) with
their role name is right and we should take the behaviour change now rather
than at deployment.

### Who signs

**VISA.** The mechanism is ours; the role list is theirs. We cannot know it.

### Cost if accepted

Hours. One paragraph in the hand-over note and one config block. The
dependency, D-17, is about half a day.

### If it is not decided before sign-off

**A caveat, not a blocker.** The build is correct and documented either way.
The sign-off note has to say plainly: approval rights are at the stock default,
VISA has been given the recommended configuration, and the named owner for
applying it is X. A control reviewer who finds that caveat unresolved six
months later will treat it as our finding, not theirs, so it needs a date.

---

## D-02. S-06: what an import that would overwrite a governed asset should do

### The question

Someone uploads a file that would replace a dashboard that is already live. We
currently refuse. Should we refuse, hold it for review, or let it through?

### What is built, and what is written down

An import that would overwrite an existing asset is refused with 422 and this
message:

> Importing over an existing dashboard needs review, and an import cannot be
> reviewed yet. Make the change to the dashboard in Superset instead, where it
> will go through review. An import that only creates new assets is unaffected.

An import that only creates new assets is unaffected, including through
`superset import-dashboards`, whose command line hard-codes overwrite. Both
halves were walked by hand.

**The "3-case rule" attributed to Vitor does not exist in writing.** It appears
in no file in this repository, no QA document and no code comment. The only
occurrences of that name anywhere in the tree are unrelated upstream changelog
entries. The signed SOW is not in the repository either, so we cannot read
§5.1 directly. What we can read is what the code cites §5.1 and Visa Q12 as
saying: imports are under review, and an import that overwrites three assets
raises three separate requests. Measured against that, today's refusal is a
**departure from §5.1**, and the code says so in as many words.

So this is not a question about which of three cases applies. It is a request
for an amendment, and we should write the amendment ourselves rather than wait
for a rule nobody can produce.

### The three cases we propose writing

| Case | Proposed V1 disposition |
|---|---|
| 1. The bundle creates only new assets | **Apply.** Creation is not gated in V1 at all (SOW §8). Already the behaviour. |
| 2. The bundle would overwrite an asset viewers can see | **Refuse** with the message above. Held for review in V2. |
| 3. The bundle would overwrite an asset no viewer can see (a dashboard never published) | **Apply.** Editing such a dashboard in the product already applies straight through, so refusing the import is stricter than the product. |

Case 3 is a real inconsistency in today's build, not a hypothetical. The
refusal fires on any uuid collision at all, with no check of whether the
colliding asset is governed, while direct edits to a never-published dashboard
apply directly. The function that answers "has this ever been published" is
already imported in the same module, so closing the gap is small.

### Options

**(a) Refuse in V1, with the amendment signed, and narrow case 3.** Honest and
visible. A control reviewer likes a refusal: nothing gets past the control, and
the person is told why. The cost lands on whoever does bulk migrations, who has
to make the change in the product instead of in a file.

**(b) Hold the import for review in V1.** Matches §5.1 as written, and is the
largest single piece of work left anywhere on this epic. It needs somewhere to
store an uploaded bundle with a retention policy, a secrets story (bundle YAML
can carry database credentials), a replayable import command, and a review
surface that can diff a zip. The review surface is the hardest one in the
feature, for a path that is already safe today. A reviewer who cannot really
read a zip diff and approves it anyway is a worse control than a refusal.

**(c) Let overwriting imports through.** A hole in the one control the feature
exists to provide, reachable by anyone who can upload a file. Not an option. A
control reviewer would stop the sign-off here and would be right to.

### Recommended decision

**(a).** Refuse in V1. Get the three-case table above signed as a §5.1
amendment. Narrow case 3 so the import path is no stricter than the product.
Held imports go to V2 with a written scope.

### Who signs

**VISA**, because it amends the SOW. We draft it; they sign it.

### Cost if accepted

The amendment is a PM afternoon. The case 3 narrowing is half a day plus a
test, and needs its own ticket. Held imports in V2 are weeks, not days, and
should be estimated separately.

### If it is not decided before sign-off

**A blocker.** Not because the behaviour is wrong, but because the behaviour
knowingly departs from a signed document. Signing QA off on a build that
contradicts the SOW, with nothing in writing bridging the two, is the kind of
gap that resurfaces in an audit as a finding against us. The amendment is
cheap. Get it signed.

---

## D-03. S-07: which role names mark service and integration accounts

### The question

Some Superset accounts are not people. They are scripts, integrations and
service accounts. A machine must never be the second pair of eyes. Which of
VISA's role names identify those accounts?

### What is built

`ASSET_APPROVAL_MACHINE_USER_ROLES` names them. Members of those roles are
excluded from the list of possible approvers **and** refused by the approve
route itself, so the two cannot disagree. That mattered: the previous version
filtered the dropdown and not the check, so a deactivated editor never appeared
as an option yet could still approve through the API. Inactive accounts are
excluded by the same predicate, and a null in the active column counts as
inactive.

The setting is empty by default, which is the behaviour this had before.

### Options

**(a) Ask VISA for the list and ship empty until they answer.** The control
does not collapse while it is empty: a service account would additionally have
to hold editorship of the specific asset and not be the author. In practice
that is unlikely but not impossible, and "unlikely" is not a sentence to put in
front of a bank's control reviewer. Empty also looks like an oversight rather
than a decision, unless the register says otherwise.

**(b) Guess at the role names.** We would be inventing facts about VISA's
environment. If we guess wrong the key silently excludes nobody, and we would
have shipped something that looks configured and is not. Worse than empty.

**(c) Infer machine accounts from something other than role, such as the
absence of a last-login or a naming convention on the username.** Heuristics
on identity are how people get locked out of their own work. A bank will not
accept "we guessed from the username" as the definition of a non-approver.

### Recommended decision

**(a).** Ask VISA, ship empty, and record their answer here as the decision.
If their answer is "we have no service accounts with asset editorship", that is
a perfectly good decision and we write it down in those words. A recorded "none"
is worth as much to a control reviewer as a list, and costs nothing.

### Who signs

**VISA.** We cannot see their role inventory and must not guess at it.

### Cost if accepted

Hours. One question, one config line, one line in this file.

### If it is not decided before sign-off

**A caveat.** The sign-off note says the mechanism is built and tested, the
list is empty, and VISA owns populating it. Pair it with D-01 in the same email
and the same deployment step, because both are the same shape of question and
the same one-line answer.

---

## D-04. S-09: which branch the delivery targets

### The question

QA asked which Superset this was built on, having been told it was master. Was
that right, and what does VISA receive?

### What is actually true

QA's premise was wrong, and `BUILD-TARGET.md` in the extension directory
documents it. The branch is on the PCS 6.1 line. Its base tag is `v6.1.0.14`,
the newest PCS 6.1 build tag, at commit `fb79c3c16d`. Every tag from
`v6.1.0.0` through `v6.1.0.14` is an ancestor, which anybody can check:

```bash
git merge-base --is-ancestor v6.1.0.14 HEAD && echo "on the 6.1 line"
```

There are 89 commits on top, 15 of them upstream and the rest this delivery.
The upstream 15 are thirteen dependency bumps, a sunburst time-grain fix and a
Docker build change. They touch exactly one file this delivery also touches,
and that file is generated. The delivery also applies cleanly to the base tag
on its own, with the suite giving the same result there.

So S-09 is answerable by us today. What is left is not "which branch" but
"which tag at hand-over, and who cuts it".

### Options

**(a) Deliver against `v6.1.0.14` as recorded, and re-run the regression if a
newer 6.1 tag lands before hand-over.** The evidence QA already has stays
valid. If a newer tag appears, re-running the browser regression is a day.

**(b) Rebase onto whatever the newest 6.1 tag is at hand-over, unconditionally.**
Keeps VISA closest to current, and invalidates every manual result in the
regression file until it is re-walked. Given that four rows on this epic read
"Fixed" while the behaviour was still there, and every one was caught only by
hand, throwing away manual evidence for a tag bump is a poor trade.

**(c) Target master.** What QA believed was happening. Nobody wants it and
nothing suggests it.

### Recommended decision

**(a).** Record `BUILD-TARGET.md` as the answer to S-09 and close the row.
State the two host changes the delivery carries, because a PCS 6.1 build does
not have them: the extension pages framework from apache/superset#45522, and
`superset/change_management.py`. Neither needs a migration. Note the one honest
limit the file already states, which is that the cross-tag suite run used this
branch's installed dependencies rather than the tag's pins, and that the single
place the delivery touches the differing library is inside a best-effort
`except`.

### Who signs

**The delivery team**, not VISA. This is our release question. VISA is told
the answer; they do not need to choose it.

### Cost if accepted

None. The document exists. Closing the row is a tracker edit and a pointer.

### If it is not decided before sign-off

**A caveat at most.** QA should not hold an epic for a question that has a
written answer sitting next to the code. Point them at the file and move the
row to closed.

---

# Part 2. Decisions already taken, recorded here so they are not implicit

These were decided deliberately during the build. They are not open. They are
written down because a decision that only exists in a commit message is one
somebody re-litigates in six months, and because each of them is a place where
a control reviewer may expect the opposite behaviour and deserves an answer.

## D-05. QA-19 and NEW-2: an author with a pending change sees the live version

**The question.** You have proposed a rename that nobody has approved yet. When
you open the dashboard, do you see your proposal or what everyone else sees?

**Decided: you see the live version, and the banner says so.** Your proposal is
one click away behind **Show changes** and **What changed**, and the change
request holds it. The header and the browser tab show the live title too, which
is the NEW-2 half: previously the header showed the proposal while the banner
beside it said the author was on the live version.

**The alternative and why not.** Defaulting the author's view to their own
pending version would mean hydrating the entire dashboard from the proposed
payload on every open. It is the riskiest frontend change on the list, and the
preview path cannot currently express sub-command bodies, so it would have to
branch by request kind. Against that, the current behaviour has a property
worth keeping: the author and the viewer see the same thing unless the author
asks otherwise, which makes "has this gone live yet" answerable by looking.

**A control reviewer's view.** Favourable. Showing the author the live version
by default means nobody mistakes an unapproved change for a published one.

**Signed by:** PM. **Cost:** none, shipped. **If undecided:** record only. Keep
the alternative on the V2 list as a usability item, not a correctness one.

### Superseded on 2026-11-05 — the alternative was built

**This decision no longer describes the product.** The author now opens on
their own changes, and the live version is behind the switch: exactly the
alternative rejected above. The change is in `804c5263b4` and `9599190c36`.

**Why it was reversed.** The rejection above weighed risk and a property worth
keeping, and did not price what defaulting to live costs. Edit mode loads
nothing of its own -- it sets one boolean -- so whatever the page is showing is
what gets edited. With the page on live, an author editing a change they had
already saved was editing the published asset, and their next save posted it
over their own draft, field by field, with nothing said. Five separate
reproductions are recorded in `qa/logs/`; the external QA engineer filed the
chart version of it as High (see
`TRACKER-sc-124561-run-7-and-samwise.md`, his "New, High"). It is a lost-work
defect, which makes it a correctness item, not the usability item this entry
files it as.

**The authority.** The 29-screen mock set tagged SOW V1, confirmed binding by
Amaan on 2026-11-05. Author screen 2 carries the SOW line "the author sees
their draft when they open the asset, with a link to the current version";
author screen 1 shows the edit canvas carrying the draft's own Changed and
Added tags, and a Discard whose tooltip promises saved changes stay. The
artifact is not in this repository -- it is served from a sandbox URL, which is
why commits citing "author screen 1b" cannot be followed from here. That is a
gap in our record, not evidence against the decision.

**What is still true from the entry above.** The risk assessment was accurate.
Seeding an editor from the proposal crashed the page twice before it landed,
and a third time on charts, each on the same unguarded read in
`SliceHeader/index.tsx` -- now guarded. And the property it wanted to keep is
kept, differently: the author is told in the banner which version is on screen
and can reach the other in one click, so "has this gone live yet" is still
answerable by looking.

**Scope.** Dashboards and datasets as of 2026-11-05. Charts still open on the
live version, so Samwise's High remains open there.

**Not signed.** `DESIGN-editing-a-change-that-is-already-in-review.md` section
11 asked for a written answer "signed the way D-05 was" before any code was
written, and the code was written first. This note records what happened; it
does not substitute for that signature.

## D-06. QA-05: a captured delete stays a draft the author must submit

**The question.** You archive a chart. It is captured for review instead of
being archived. Should it go straight into the reviewer's queue, or wait until
you press Request review?

**Decided: it waits.** The queue shows it as a Draft with a Request review
action and says so. Only the wording changed; two places said "submitted" when
they meant "captured", and "submitted" now means post-Request-review
everywhere.

**Why not auto-submit.** The author-presses-Request-review split is deliberate
and the draft state is load-bearing elsewhere: it is what lets an author
capture several edits and submit once, and what withdraw returns to.
Auto-submitting deletes alone would make deletes the one operation with a
different lifecycle.

**A control reviewer's view.** Neutral. Nothing reaches viewers either way. The
risk they would ask about is the opposite one: an author archives something,
assumes it is gone, and it sits in a draft forever. The copy fix answers that,
and D-13 finishes the job.

**Signed by:** PM. **Cost:** none, shipped. **If undecided:** record only.

## D-07. QA-07: a change whose author has since lost edit access stays approvable

**The question.** Alex proposes a change, then moves team and loses edit access
to the dashboard. Can the change still be approved?

**Decided: yes, and the approver is told why if they try.** It is not
auto-discarded. The refusal that used to appear came from the host's own
editorship check firing during the replay, addressed to the approver, who did
have the rights and could not tell what had gone wrong. Worse, that check treats
an administrator as an editor of everything, so an admin author removed from an
asset was replayed anyway, which is the admin bypass the model refuses arriving
through the back door. It is now checked on the merits, so the message names the
real reason and reads the same for every author. Walk K confirmed it by hand:
the request stays visible, approving is refused with 409 naming the author, and
the live asset is untouched.

**Half of this decision is not delivered.** The recorded decision was to *show*
the approver that the author had lost access. What is delivered is a refusal at
the moment they press Approve. Walk K found that the payload still reports the
change as approvable, so the approver is offered a button that cannot work. See
D-24, which is the open half.

**Why not auto-discard.** The control is "a second current editor approved
this", and that holds whoever the author has become. Discarding on access
change would strand work on every re-organisation, and a bank re-organises.

**A control reviewer's view.** This is the one in Part 2 most likely to draw a
question. Be ready with the exact sentence: the approval is given by a current
editor who is not the author, and that is the control. Who the author works for
now does not change what the change contains or who signed it off.

**Signed by:** PM. **Cost:** none, shipped. **If undecided:** record only.

## D-08. QA-09: the approver is warned about a dependency, not blocked by it

**The question.** A chart's dataset also has a change waiting. Should the
dataset's change have to be approved first?

**Decided: warn, do not order.** The approver is told, from a single lookup on
the review payload. No ordering rule is enforced.

**Why not enforce it.** One open change per asset plus an ordering rule
deadlocks two editors: each holds a change the other's change has to wait for,
and neither can withdraw without losing work. The rule as scoped covers a
single asset.

**A control reviewer's view.** The warning is the right shape. They may ask
what stops an approver approving a chart that will break when the dataset
change lands. The honest answer is nothing, and the dataset change needs its
own approval before it can break anything, so no unreviewed content reaches a
viewer either way.

**Signed by:** PM. **Cost:** none, shipped. **If undecided:** record only.

## D-09. QA-02: the legacy datasource-save defect is filed upstream, not fixed here

**The question.** A legacy dataset save that fails still wipes the dataset's
editors. Do we fix it on this story?

**Decided: file it upstream.** It reproduces with change management switched
off, so it is not ours. It is also unreachable on this build, because S-01 made
that endpoint refuse with 422 before anything is mutated, and the regression
confirmed the dataset keeps both editors and all four columns after the
refusal.

**A control reviewer's view.** Fine, once they can see that the path is closed
on this build. The regression row is the evidence; cite it rather than the
argument.

**Signed by:** PM. **Cost:** an upstream issue, an hour. **If undecided:**
record only.

## D-10. The one path where an administrator reaches a dead end

**The question.** An administrator who is not an editor of a dashboard can
create an embedded-configuration change and then never get it approved: the
approval is refused with 409 and the message says why. Is that acceptable?

**Decided: acceptable, and it goes in the runbook.** It is the no-admin-bypass
rule working exactly as VISA asked. The administrator can author a change,
because authoring is an ordinary write, and cannot approve it, because they are
not an editor of that asset. Nobody else can approve it either, if there is no
second editor.

**Options we are declining.** Blocking the capture up front would mean teaching
the gate to predict approvability at write time, which is a new class of check
and a new class of wrong answer. Letting the admin approve their own change is
the bypass VISA ruled out.

**A control reviewer's view.** Positive, and worth showing them deliberately.
This is the clearest demonstration in the build that there is no privileged
escape.

**Signed by:** PM. **Cost:** a runbook paragraph, an hour. **If undecided:** a
caveat. The behaviour is right; an administrator who hits it without the runbook
will file it as a bug, and that costs more than writing the paragraph.

---

# Part 3. Decisions surfaced by the regression walk and still open

## D-11. QA-16 residual: the author's note is not shown in version history

### The question

When a change is approved, the asset's version history records who approved it.
Should it also show the note the author wrote explaining the change?

### Where it stands

Version history now reads "Latest save · Alex Rivera", then "Approved by Priya
Shah", then the headline of what changed. Attribution is to the author, which
is right, and the approval is labelled. The panel also already renders an
approval note. That note is the **approver's** words, typed at approval time.
The **author's** note, the one they wrote when they asked for review, is not
shown anywhere in the panel.

The data path for this already exists and is cheaper than the earlier memo
assumed. The approval is carried into version history through the host's
existing headline record, which already has a note field on it. Adding the
author's note means putting one more key on that record and rendering it. No
stored transaction identifier is needed and no schema change is needed, both of
which the earlier memo listed as prerequisites.

### Options

**(a) Add the author's note.** Version history then answers the question a
control reviewer actually asks, which is not "who approved this" but "what did
they think they were approving". Cheap, and the plumbing is already in place.

**(b) Ship without it.** The note is not lost. It lives on the change request
record, which is never pruned, and the review panel shows it. What is missing
is the note in the *version history* panel, which is where someone looking at
the asset months later would go.

**(c) Build a fuller audit view.** Out of scope for V1 and would need D-19
answered first.

### Recommended decision

**(a).** Do it. The gap between this and the earlier estimate is the whole
reason to re-cost before deferring. One key on an existing record, one line in
an existing panel, one test.

What would change my mind: if the change turns out to need the version-history
record shape to move, it becomes a V2 item immediately. The record is a host
convention and we should not bend it for a nice-to-have.

### Who signs

**PM**, unless D-19 comes back saying the approval record is formal audit
evidence, in which case this stops being optional and VISA owns it.

### Cost if accepted

Half a day including the test. Needs a ticket.

### If it is not decided before sign-off

**A caveat.** Say in the note that the author's rationale is recorded on the
change request and visible in review, and is not yet surfaced in the asset's
version history panel. If D-19 says the record is audit evidence, this becomes
a blocker.

## D-12. NEW-6 residual: the Approvals page renders for a Gamma

### The question

A Gamma user opens `/approvals` and gets the page, saying "Nothing is waiting
for you right now". Should they get the page at all?

### Where it stands

This was filed as "the Approvals shell renders for a viewer" and the filing had
the shape wrong. A Gamma can author charts on a stock Superset, so a Gamma can
have changes of their own, and the inbox is legitimately theirs: it is where
authors find their own drafts, not only where approvers find work. The page is
widened on purpose, to whichever roles hold the read right on change requests.

What was genuinely wrong underneath it is fixed and verified. With
`PUBLIC_ROLE_LIKE` set, which is Superset's documented way to let signed-out
visitors see dashboards, the **anonymous** role held the editing right on change
requests, and both grants in the extension hand rights to "whoever already holds
X". So the anonymous role was seeded the approval right and handed the Approvals
page with it. Nothing could be approved with it, because the route needs a user
id and a strict editorship and refuses a guest outright, but an approval
permission sitting on the anonymous role is the wrong thing to show a control
review. There is now an install-time revoke, so existing installs are reached
and not only new ones, and a test pins it.

### Options

**(a) Leave it.** A Gamma sees an empty inbox that is honestly theirs. The
alternative narrows a page that authors need.

**(b) Narrow the page to roles holding the approval right.** Reads tidier in a
permissions table. It also takes the inbox away from every author who is not an
approver, which is the larger group and the one the page was widened for.
Authors would then have no single place to find their own drafts.

**(c) Split the page into an approver view and a "my drafts" view.** The right
end state, and a V2 item. The inbox has no drafts view or status filter today,
which is already noted as a gap against the SOW.

### Recommended decision

**(a) for V1, (c) on the V2 list.** An empty inbox that says so is not a
defect. It is the page correctly reporting that you have nothing outstanding.

### Who signs

**PM.**

### Cost if accepted

None. Record it and move on.

### If it is not decided before sign-off

**Record only.** The security half is fixed and tested. Make sure the sign-off
note separates the two, because the row's title still describes the misfiling
and will be read as an open leak if nobody says otherwise.

## D-13. The delete copy contradicts itself

### The question

Archiving a chart says you can recover it within 30 days. Approving the same
delete says "This removes the chart. It cannot be undone." Both cannot be true.
Which sentence is wrong?

### Where it stands

The second one is wrong, and the restore flow proves it: an archived chart can
be restored, the restore is itself captured for review, and approving it brings
the chart back with a 200. The regression walked that end to end.

There is a second, smaller copy fault in the same family: the notification bell
reads "waiting 5 minutes ago", which double-counts, while the table beside it
says "5 minutes".

### Options

**(a) Fix the approve-the-delete wording to match the truth.** Say the asset
moves to Recently archived and can be restored there, with restoring itself
going through review. Fix the bell at the same time.

**(b) Leave it.** A reviewer is told, at the moment of deciding, that an action
is irreversible when it is not. That is the single worst copy fault in the
build. A control reviewer assessing whether approvers can make informed
decisions will find it, and it undermines every other claim we make about the
review surface being honest.

**(c) Make the delete actually irreversible.** Nobody wants this and it would
contradict the restore feature we built.

### Recommended decision

**(a).** This is the one item in Part 3 I would not ship without. It is copy, it
is cheap, and it is a false statement made to a reviewer at the exact moment
they are exercising the control.

### Who signs

**PM.** No customer input needed to stop saying something untrue.

### Cost if accepted

Two to three hours including the bell, plus a snapshot test on the dialog.

### If it is not decided before sign-off

**A blocker.** Not on technical grounds. On the grounds that we cannot ask a
bank to accept a review surface that misinforms the reviewer, when the fix is
an afternoon.

## D-14. Where the reviewer lands after approving a delete

### The question

A reviewer approves a delete from the asset's own page. The asset is now gone.
Where should they end up?

### Where it stands

On the deleted chart's Explore page, which no longer loads, showing "Missing
dataset. The dataset linked to this chart may have been deleted." Wrong noun,
dead page. This is the same class as the second half of the restore defect,
where Review navigated the approver to an archived chart's own page.

### Options

**(a) Return them to the Approvals queue.** They came to decide something and
they have decided it. The queue is where the next decision is. Simple, and the
route already exists.

**(b) Return them to the asset list.** Shows the asset gone from the list,
which is satisfying confirmation. Less useful if they were working through a
queue.

**(c) Keep them in place with a confirmation state replacing the page.** Best
of the three and the most work: a dedicated "this asset has been removed" state
with a link onward.

**(d) Leave it.** The reviewer sees an error message about a dataset after
correctly approving a chart deletion. They will reasonably believe something
broke, and may raise an incident about a successful operation.

### Recommended decision

**(a).** Send them to the Approvals queue with a confirmation toast. It reuses
what exists, it is right in the common case of working through a queue, and it
never shows a dead page. Put (c) on the V2 list.

### Who signs

**PM.**

### Cost if accepted

Half a day. Needs a ticket.

### If it is not decided before sign-off

**A caveat.** It is a dead end, not a wrong outcome: the delete did apply
correctly. Note it, with the cost, and expect it back as a support ticket in
the first week of use.

## D-15. Restoring from Recently archived gives no feedback

### The question

You press Restore on an archived chart. The row stays where it is, correctly,
because the restore has been captured for review rather than applied. Nothing
on screen says so. Should it?

### Options

**(a) Add a toast and a pending state on the row.** The same treatment every
other capture already gets. Without it the silence invites a second click, and a
second click on a captured restore is the kind of thing that produces a
duplicate request or an "already has changes open" refusal the user cannot
explain.

**(b) Leave it.** The restore is safe, captured and reviewable. The user simply
cannot tell that anything happened.

### Recommended decision

**(a).** Every other capture path in the build announces itself. This one not
doing so is an omission, not a choice, and the inconsistency is the tell.

### Who signs

**PM.**

### Cost if accepted

Two to four hours. Fold into the same ticket as D-14; they are the same screen
and the same class of problem.

### If it is not decided before sign-off

**A caveat.** Low risk, visible to every user who archives anything.

## D-16. A viewer's browser cache outlives an approval

### The question

An approval applies and the dashboard title changes. A viewer whose browser
already fetched the old version keeps seeing the old title until their cache
expires. Is that acceptable for an asset under formal change control?

### Where it stands

Found during the regression and worth telling QA about, because it cost half an
hour of chasing a leak that was not one. Re-fetching the same URL with the cache
bypassed returns the live title, so the server is correct and the content is
correct. The entity tag on the read is the asset's live version identifier, and
it changes when the version changes, so a browser that revalidates gets fresh
content. What is happening is a browser serving from its own freshness window
without revalidating at all.

Two things follow. First, this is not a review leak: no unapproved content is
ever shown. It is approved content arriving late. Second, the fix is a
revalidation header on the governed read, not cache invalidation plumbing, which
makes it much smaller than it first looks.

### Options

**(a) Require revalidation on governed asset reads.** Every read of a governed
asset asks the server whether its version identifier still matches, which it can
answer cheaply. Correct, small, and costs one conditional request per read.

**(b) Invalidate on approval.** Push-based, more moving parts, and it cannot
reach a cache that lives in somebody's browser. Wrong tool for this problem.

**(c) Accept it and document the window.** Defensible: nothing unapproved is
ever shown, and the staleness is bounded. A control reviewer would want the
bound written down, and "it depends on the browser" is not a bound.

### Recommended decision

**(a)**, as its own ticket, scoped to reads of the three governed asset types.
Verify by doing what the regression did: load as a viewer, approve as the
reviewer, reload as the viewer without clearing anything, and see the new title.

What would change my mind: if requiring revalidation measurably slows dashboard
loads for VISA's user counts, take (c) and write the bound down explicitly in
the runbook.

### Who signs

**The delivery team.** It is a correctness and performance trade in our code,
not a customer policy question. Tell VISA the outcome.

### Cost if accepted

Half a day to a day, plus a browser verification. Needs a ticket.

### If it is not decided before sign-off

**A caveat, and one QA should be told about explicitly** so the next person does
not spend half an hour chasing a phantom leak. Word it carefully: approved
content can arrive late in an already-open browser; unapproved content is never
shown.

## D-17. The approver list does not check the approval right

### The question

If VISA narrows who may approve, will the product still tell authors the truth
about who can approve their change?

### Where it stands

No, and this is the sharp edge under D-01. The function that lists eligible
approvers filters on two things: the account is active, and it is not in a
service-account role. It does **not** filter on whether the account's roles hold
the approval right. The approve route does check it. So the list and the check
can disagree, which is precisely the failure mode S-07 was filed for and that
the machine-user work was careful to avoid.

Nothing is wrong today, because the default grants the approval right to every
role that could already approve, so the two agree by accident. The moment VISA
sets a narrower list, three things break together:

- The request dialog names an approver who cannot approve.
- The "no one else can approve this" warning does not fire when it should, so
  the author submits a change that nobody can act on.
- The author's change sits pending until somebody notices.

There is no test covering the interaction. The two tests that exist cover the
route enforcement and the machine-user filter.

### Options

**(a) Fix it now, before any narrowing.** The list learns the approval right,
the same way it learned active and service accounts, expressed in the same place
so the list and the check cannot drift. Add a test that narrows the roles and
asserts an editor without the right is neither listed nor counted as an
approver.

**(b) Fix it when VISA narrows the roles.** Leaves a loaded gun in the
configuration path. The person who pulls the trigger is a deployment engineer
reading our own recommended configuration from D-01.

### Recommended decision

**(a).** Fix it before hand-over. We are about to hand VISA a config key and
recommend they narrow it, which is exactly the action that exposes this.

### Who signs

**The delivery team.**

### Cost if accepted

Half a day including the test.

### If it is not decided before sign-off

**A blocker, conditional on D-01.** If VISA's answer to D-01 is "leave the
default", it is a caveat. If their answer narrows the roles, which is what we
are recommending, it is a blocker and must land first. Treat it as a blocker,
because we are the ones recommending the narrowing.

## D-18. QA-18b: what the approver is shown when a dashboard is published for the first time

### The question

A dashboard is built as a draft, where edits apply directly because no viewer
can see it. The author then publishes it, which is a governed change. What
should the approver be shown at that moment: the single field that flipped, or
the content viewers are about to see?

### Where it stands

The publish exemption works and was walked both ways. A save on an
unpublished dashboard applies directly; the same asset once published is
governed; the transition is picked up without a restart; and "has this ever been
published" closes the way in for an asset that was published once and unpublished
again, with the publish mark durable and pinned by a test.

What is not addressed is what the approver *sees* at that first publish. The
diff is computed against the live asset, and by publish time the live asset
already holds everything the author built while it was a draft. So the approver
is shown a single flag moving from unpublished to published, and approving it
exposes a whole dashboard they were never shown.

This was raised in the earlier memo as a separate ticket and was never on QA's
list. It is not on the tracker. The newest report does not mention it, which
means it is currently nobody's.

### Options

**(a) Present the content at a first publish.** The right answer. The approver
is asked to approve exposure of a dashboard, so they should see the dashboard.
It needs the review surface to treat a first publish as a different kind of
review from a field diff.

**(b) Accept it for V1 with the caveat written down.** Defensible on a narrow
reading: nothing reaches a viewer without a second editor approving, which is
the acceptance criterion, and the approver can open the dashboard in place
through Show changes. The weakness is that the thing the reviewer is asked to
read does not describe what they are deciding, and "the reviewer could have
looked" is a thin answer to a control reviewer.

**(c) Exempt the first publish entirely.** No. That is the moment content
reaches viewers, which is the only moment that matters.

### Recommended decision

**(b) for V1, (a) as a named V2 ticket raised now.** The acceptance criterion
holds, the gap is in the quality of the review rather than its existence, and
the work is a new review mode rather than a fix. But raise the ticket today and
put it in front of VISA in the same letter as D-22, because it is exactly the
kind of thing they should get to weigh rather than discover.

What would change my mind: if VISA's control reviewer treats the review record
as evidence that a named individual examined the content, then (b) is not
available and this becomes V1 work.

### Who signs

**VISA**, as part of the V1 / V2 boundary.

### Cost if accepted

The ticket is an hour. The V2 work is a new review mode and should be estimated
on its own; it is not a days-scale item.

### If it is not decided before sign-off

**A caveat, and the one I would most want explicitly acknowledged by the
customer** rather than quietly noted by us. An unfiled gap that we knew about is
worse than a filed one we deferred.

## D-19. Is the approval record audit evidence, and for how long

### The question

Does VISA treat the record of who approved what as formal audit evidence? If so,
how long must it be retained?

### Why it matters

It decides three things at once, which is why it is worth one question.

First, D-11. If the record is audit evidence, the author's rationale belongs in
it and is not optional.

Second, retention. There are two records here and they age differently. The
change request record holds the author, the reviewer, the decision time, the
note and the payload, and is never pruned. The asset's version history, which is
where the "Approved by" label and the note are surfaced, is pruned on a
retention window that defaults to 30 days. So the durable record and the
readable record are not the same record. If VISA needs the readable one to
survive, the retention window has to be set deliberately at deployment, and
somebody has to own that.

Third, whether the change request table needs a documented export or report at
all, which nothing on this epic currently provides.

### Options

**(a) Ask the question and act on the answer.** One question, three
consequences resolved.

**(b) Assume it is audit evidence and build accordingly.** Safe in a compliance
sense, and it pulls D-11 and a retention configuration into V1 on an assumption.

**(c) Assume it is not.** Cheapest and the one that goes wrong quietly. The way
it goes wrong is that in month four somebody asks for approval history on an
asset, and the readable half has been pruned.

### Recommended decision

**(a)**, and regardless of the answer, write the retention mismatch into the
runbook now. The mismatch is a fact about the build and should be documented
whether or not VISA treats the record formally. Recommend to VISA that they set
the version history retention window to match their own record-keeping period.

### Who signs

**VISA.**

### Cost if accepted

The question is free. The runbook paragraph is an hour. If the answer is yes,
D-11 becomes required, at half a day, and a retention value becomes a deployment
step.

### If it is not decided before sign-off

**A caveat with teeth.** Write the mismatch down explicitly: the durable record
is the change request table, the readable record is version history, and the
latter prunes at 30 days by default. That sentence is the whole risk.

## D-20. Twelve defects were found and fixed and never filed

### The question

Twelve defects, NEW-1 to NEW-12, were found in the manual passes and fixed.
None is on the QA tracker. Two were high severity, one of them a row the tracker
had recorded as fixed a week earlier. Should they be filed retrospectively?

### Options

**(a) File all twelve as closed rows, each pointing at the report section and
the walk that verified it.** The tracker then matches reality, and the audit
trail shows the defects were found, fixed and verified rather than appearing
from nowhere in a report. It also makes the two reversals visible: a row that
read Fixed and was not.

**(b) Leave them in the report only.** The report is detailed and honest and a
reader can follow it. But the tracker is what a control reviewer counts, and a
tracker that says 45 rows against a build that fixed 57 defects invites exactly
the wrong question.

**(c) File only the two high-severity ones.** Arbitrary line, and the two
reversals are the ones most worth the paper trail.

### Recommended decision

**(a).** File all twelve as closed with evidence. It is administration, not
engineering, and it is the cheapest credibility we will buy on this epic.

### Who signs

**PM.**

### Cost if accepted

Two to three hours of tracker work.

### If it is not decided before sign-off

**A caveat.** The sign-off note must then state the real numbers: 45 tracker
rows plus 12 unfiled defects, all verified by hand, with the report as the
record. Do not let the sign-off imply 45 was the whole story.

## D-21. Two rows are unit-tested only, and one path was never walked

### The question

The regression has since been extended, and four of the six rows that were
unit-tested only have now been walked: QA-03, QA-04, QA-07 and QA-21. Two
remain on unit tests alone, QA-08 and QA-09, and both need two sessions racing,
which a single walk cannot honestly reproduce. One path was not walked in any
pass: the chart Explore save. Is that enough for sign-off?

The four newly walked rows all passed, and two left residuals that are decisions
of their own rather than coverage gaps. See D-23 and D-24.

### Why this is a decision and not a task

Because of the pattern the report names. Four rows on this epic read **Fixed**
while the behaviour was still there: S-01, R3-01, R4-06 and S-04. Every one was
written, reviewed and unit-tested. Every one was caught only by using the
feature. They fail the same way: the fix goes on the path the test exercises and
the product uses a different one.

On this epic, specifically, a passing unit test is weak evidence that the
product works. That is not a general claim about testing. It is an observed
property of this codebase, measured four times.

The chart Explore save is the one that should worry us most, because it is a
primary authoring path for charts and it is exactly the shape of the four
failures: a save path with its own route that may not be the one the tests
exercise.

### Options

**(a) Walk the chart Explore save by hand before sign-off, and accept unit
tests for QA-08 and QA-09.** The Explore save because it is a primary path and
nobody has used it by hand. QA-08 and QA-09 because a concurrency row walked by
one person in one session produces a result that reads like evidence and is not
one.

**(b) Accept unit tests for all three.** Fast, and it bets the sign-off on the
one kind of evidence this epic has already shown to be insufficient, four times,
on the one remaining path that has the exact shape of those four failures.

**(c) Walk all three, including the two concurrency rows.** Thorough in
appearance. The concurrency walk cannot be done honestly without two sessions,
so part of the effort buys a false reassurance, which is worse than a named gap.

### Recommended decision

**(a).** Walk the Explore save. Name QA-08 and QA-09 in the sign-off note as
unit-test-only, with the reason, and say plainly that a two-session race was not
reproduced. Honest and proportionate.

### Who signs

**The delivery team**, with QA.

### Cost if accepted

Two to three hours of browser time, including writing the result into the
regression file.

### If it is not decided before sign-off

**A blocker on the Explore save specifically.** A primary authoring path that
nobody has used by hand, on an epic where four fixes were verified by hand after
passing their tests, is not something to sign. QA-08 and QA-09 are a caveat.

## D-22. The written V1 / V2 boundary

### The question

What is explicitly out of scope for V1, and has VISA agreed to it in writing?

### Where it stands

The V2 list is spread across three documents and no single place states it.
Collected, it is:

- **Creation and Save as.** Creating a new asset is not gated. Cited as SOW §8,
  so probably already agreed, and it should still be in the one list.
- **Administrator bypass.** Ruled out for V1 in writing (Visa Q1, SOW §9.3),
  verified by hand, and the one place it reaches a dead end is D-10.
- **Held imports.** D-02. Needs the §5.1 amendment.
- **The author's view defaulting to their own pending version.** D-05.
- **What the approver sees at a first publish.** D-18. Not filed anywhere.
- **The inbox has no drafts view and no status filter**, which the SOW asks for
  at §5.6.
- **A dedicated post-delete confirmation state.** D-14 option (c).

### Options

**(a) Write it as one page, have VISA sign it, attach it to the sign-off.** The
sign-off then means something specific. Every item above is either already
agreed, recommended for deferral here, or newly surfaced and needs their
attention.

**(b) Let the sign-off note carry the list informally.** Faster. It leaves the
deferrals as our assertions rather than their agreement, which is the difference
between a documented scope and an undocumented gap.

### Recommended decision

**(a).** One page, signed. It is also the natural carrier for D-02's amendment
and D-18's caveat, so three VISA decisions travel in one document.

### Who signs

**VISA.**

### Cost if accepted

A PM day to draft, then their turnaround.

### If it is not decided before sign-off

**A blocker.** Everything else in this register can be a caveat because the
build is correct and the gap is recorded. This one is the record. Without it, the
sign-off is a signature on an unstated scope, and the first disagreement about
what V1 included will be unresolvable.

## D-23. QA-04 residual: the filter modal closes on a refusal

### The question

An author with a draft already open renames a native filter and saves. The save
is correctly refused with 409 and a danger toast explains why. The modal then
closes anyway, so the author has to reopen it and retype the name. Do we fix
that, or accept it?

### Where it stands

The data-loss half of QA-04 is fixed and walked: the refusal now produces a
visible toast reading "You already have other changes open on this dashboard.
Submit or discard them before making this change", rather than the filter
silently disappearing. What remains is that the modal does not stay open to hold
the author's typing.

Two things about this row are worth carrying into the sign-off note. First, the
tester nearly filed it as data loss on the strength of a screenshot taken nine
seconds late, after the toast had gone, and only the network log settled it.
That is a warning about how this class of defect is evidenced, not about the
build. Second, the original diagnosis had two independent causes, a swallowed
409 and a dispatch that was not awaited, and fixing only one of them would have
left the work still lost. Both are fixed.

### Options

**(a) Keep the modal open on a refusal.** The author's typing survives and they
can resolve the conflict and retry. Correct behaviour and a small change in one
place, now that the refusal is surfaced at all.

**(b) Accept it.** Nothing is lost that the author cannot retype, and they are
told exactly why. The cost is retyping a filter name on an uncommon path.

### Recommended decision

**(b) for V1, with (a) as a named follow-up ticket.** The control is intact, the
author is informed, and the remaining cost is retyping a short string on a path
that requires already having an open draft. I would not hold a sign-off for it.

What would change my mind: if the same modal loses more than a name, for example
a whole filter configuration, then the retyping cost is no longer small and (a)
becomes V1. Worth one check during the Explore walk in D-21.

### Who signs

**PM.**

### Cost if accepted

Nothing for V1. The follow-up is two to four hours.

### If it is not decided before sign-off

**A caveat.** One line: a filter save refused for a conflicting draft closes the
modal, and the author retypes the filter name.

## D-24. QA-07 residual: the approver is offered a button that cannot work

### The question

When an author has lost edit access, the approve attempt is refused with a clear
409. But the change is still reported as approvable, so the Approve button is
offered and only fails when pressed. Should the approver be told before they
press it?

### Where it stands

This is the undelivered half of D-07. The recorded decision was to **show** the
approver that the author no longer holds edit access and keep the request
approvable so the work is not stranded. What shipped is the second half only:
the request stays, and pressing Approve produces a refusal that names the author
and the reason. The approvability flag on the payload does not carry the fact, so
nothing in the interface warns the approver in advance.

Nothing unsafe happens. The refusal is correct, the live asset is untouched, and
the message is good. The gap is that the approver learns it by failing.

### Options

**(a) Carry the fact on the review payload and show it.** The approver sees, in
the panel, that the author has lost access and that the change cannot be
published as their work until access is restored or it is discarded. This is
what was decided, and it is the same shape as the dataset-dependency warning in
D-08, which is already built: one extra field on the payload, one line in the
panel.

**(b) Suppress the Approve button instead.** Simpler to describe and worse to
use. The approver then has a request they cannot act on and no stated reason,
which is the failure mode the original defect was about.

**(c) Accept the refusal-on-press behaviour.** Defensible. It is one extra click
and the message is clear. It also means a decision we recorded as taken is not
actually in the product, which is the specific thing this register exists to
stop.

### Recommended decision

**(a).** It is the decision we already took, the pattern already exists next door
in D-08, and leaving it means D-07 is recorded as delivered when half of it is
not. That mismatch is more expensive than the fix.

### Who signs

**PM**, delivered by the team.

### Cost if accepted

Half a day including a test. Needs a ticket.

### If it is not decided before sign-off

**A caveat**, and it must be worded as the open half of D-07 rather than as a
new defect, so the record stays honest about what was and was not delivered.

## D-25. Removing yourself from an asset's editors is silently ignored

### The question

Walk K found that removing **yourself** from an asset's editors is accepted with
200 and then does nothing, while removing somebody else works. Is that ours?

### Where it stands

It is core Superset behaviour on the editors list, not change-management
behaviour, and the editors list is one of the exempt fields so the gate is not
involved. It matters here only because the editors list is the one thing this
feature asks authors to edit on purpose: an author with no eligible approver is
told to add a second editor so they can submit.

So the shape that would bite is the reverse of what was found. Adding an editor
works, which is the path the feature depends on, and was walked separately in
the editors-picker work. Removing yourself does not, and is reported as success.

### Options

**(a) File it upstream and note it, as we did with the legacy datasource
defect in D-09.** It reproduces independently of this feature, so carrying it on
this story means owning a core defect inside a customer delivery.

**(b) Fix it on this branch.** We would be patching core behaviour unrelated to
the control, on a delivery branch, before a sign-off. Wrong time and wrong
place.

### Recommended decision

**(a).** File upstream, and put one line in the runbook so that when somebody
reports it against this epic the answer is already written. State explicitly
that adding an editor, which is the path the no-approver flow depends on, works
and was verified.

### Who signs

**PM.**

### Cost if accepted

An hour: an upstream issue and a runbook line.

### If it is not decided before sign-off

**Record only.** It is not our defect and it does not touch the control. It will
be reported against us anyway, so write the answer down first.

---

# Where the four documents disagree

The newest report wins in each case. Named here so nobody reads a stale
conclusion as current.

**1. The restore hole. `QA-CONCLUSIONS.md` was wrong.** It states that
restoring an archived asset no longer goes live unreviewed, that all three
restore commands were bound, and that "the hole is closed". NEW-12 shows it was
not, in two separate ways: every API read loaded the asset without including
deleted rows, so a request about a soft-deleted asset was dropped entirely, and
once that was fixed the Review button still sent the approver to the archived
chart's dead page. Both halves are now fixed with a test on the first. The
earlier memo was written from the commit, not from the product. This is the
clearest instance of the pattern the report names.

**2. The cost of the version-history note. `QA-CONCLUSIONS.md` is stale.** It
estimates the history label and note as medium, needing a stored transaction
identifier. The label and attribution shipped through the host's existing
headline record, which needs no such identifier and already carries a note
field. D-11 is now half a day, not a medium. Re-cost before deferring.

**3. The Approvals entry with the flag off. `QA-CONCLUSIONS.md` deferred
something that is now done.** It defers QA-23 as medium and expensive, needing a
feature-flag field on the page type in core. The regression walked it with the
flag off: the Settings menu has no Approvals and no Change review entry, and the
enabled endpoint answers false. Both pages declare the feature flag and the host
answers 404 with the flag off, for an administrator as much as anyone else.
Closed, not deferred.

**4. The import test. `QA-CONCLUSIONS.md` is stale.** It states that the §5.1
import refusal has no assertion that runs, as one of nine stale test failures.
There is now a dedicated import refusal test, the suite is green, and both
halves of the behaviour were walked by hand including through the command line
importer that hard-codes overwrite.

**5. The first publish. The report is silent where the memo was not.**
`QA-CONCLUSIONS.md` raises QA-18b, what the approver is shown at a first
publish, as a new ticket and says to raise it with QA explicitly because it was
not on their list. The report covers the publish exemption thoroughly and does
not mention the review-content half at all. This is the one place where the
newest document is the less complete one, and it is why D-18 exists.

**6. The restore going live. `PA-TRIAGE.md` is superseded.** It lists restoring
an archived asset under "V2, not counted, goes live today, worth confirming with
VISA". Restores are captured, reviewable and verified end to end. The V2 scope
question is gone; what remains is D-15, the missing feedback.

**7. S-09's premise. The tracker row is wrong.** It says the branch is based on
master, not 6.1. `BUILD-TARGET.md` shows the base tag is `v6.1.0.14` on the PCS
6.1 line, with a one-line command anyone can run to confirm it. See D-04.

**8. "Vitor's 3-case rule" exists in no document.** Not in the repository, not
in the QA files, not in the code comments. The only occurrences of that name
anywhere in the tree are unrelated upstream changelog entries by a contributor of
the same name. `QA-CONCLUSIONS.md` asks for it in writing and never received it.
We should stop waiting and write the three cases ourselves. See D-02.

**9. One question in `QA-CONCLUSIONS.md` is now moot.** It asks whether the
MCP tooling is enabled in VISA's environment, because the answer decided whether
routing the writes was V1 or V2. Both the routing and the deny-by-default
posture are built and were exercised as real tool calls against a running
instance: the dashboard update created a change request and left the live title
untouched, the capture comes back as a success rather than an error, and the
markdown write folded into the author's existing draft. The question no longer
changes anything. Do not send it.

**10. QA-07 is recorded as delivered and half of it is not.** Both the earlier
memo and the report describe the decision as showing the approver that the
author has lost edit access while keeping the change approvable. The extended
regression walk shows only the second half shipped: the refusal is correct and
well worded, and the payload still reports the change as approvable, so nothing
warns the approver in advance. The walk is right and the two earlier documents
overstate what was built. See D-24.

**11. QA-04 is recorded as fixed and has a residual.** The data-loss half is
genuinely fixed, both of its two independent causes. The modal still closes on
the refusal, so the author retypes the filter name. The earlier memo named both
causes correctly and did not mention the modal staying open, which is the part
only a walk would surface. See D-23.

---

# What VISA must answer

Five items. Everything else in this register we have answered ourselves.

1. **Which roles should be able to approve a change?** We need the role names
   as they exist in your Superset. Approving is now a separate right from
   editing. Today it sits with every role that can already edit, which keeps
   current behaviour; we recommend narrowing it to your administrators, your
   Alpha-equivalent role and a named reviewer role. An approver must still be a
   second editor of that specific asset and can never approve their own change,
   whatever role they hold.

2. **Which of your role names identify service, integration or other
   non-human accounts?** Members of those roles will never be offered as
   approvers and will be refused if they try. If the answer is that you have no
   such accounts holding edit access to dashboards, charts or datasets, tell us
   that and we will record it as the decision.

3. **Please sign the attached amendment to §5.1 on imports.** For this
   release, an upload that would overwrite an existing published asset is
   refused with a clear message explaining what to do instead; an upload that
   only creates new assets is unaffected; and an upload that would overwrite a
   dashboard no viewer can see yet is applied, matching what editing that
   dashboard already does. Holding an upload for review moves to the next
   release. The amendment states those three cases.

4. **Do you treat the record of who approved what as formal audit evidence,
   and for how long must it be retained?** Your answer decides two things: 
   whether the author's written rationale must appear in an asset's history
   panel as well as in the review itself, and what retention period we set at
   deployment. The full record, including the author, the approver, the time and
   the rationale, is kept indefinitely today; the summary shown in an asset's
   own history panel is pruned after 30 days unless we change that setting for
   you.

5. **Please sign the attached V1 / V2 scope page.** It lists what this release
   deliberately does not cover, so nothing is ambiguous later. One item on it is
   new and we want your view rather than our assumption: when a dashboard is
   published for the first time, the approver is shown that the dashboard is
   being made visible, not the full contents being made visible. Nothing reaches
   a viewer without a second editor approving it, and the approver can open the
   dashboard to look. If you need the review itself to present the content, that
   moves into this release.

---

# Proposed sign-off criteria

Written so QA can tick each line, and so a line that cannot be ticked names what
is missing.

## A. The control holds

- [ ] With a change awaiting review, a viewer account sees the live version,
      no banner, no pending tag, no Edit button and no review controls, through
      the interface and through the API.
- [ ] An administrator who is not an editor of the asset cannot see, approve,
      request changes on, or discard a change to it. All three are refused.
- [ ] An administrator's own write to an asset another author holds is refused
      with the same lock anyone else gets.
- [ ] An author cannot approve their own change, whatever role they hold.
- [ ] With the feature flag on and the extension not loaded, dataset and
      dashboard writes are both refused and neither applies.
- [ ] With the feature flag off, the Settings menu has no Approvals and no
      Change review entry, and the enabled endpoint answers false.
- [ ] A change left open while the flag was off cannot be approved over an edit
      made in the meantime; the refusal names the field that moved.
- [ ] The approval right is a permission of its own, enforced on the approve and
      request-changes routes and not only in the interface.
- [ ] The anonymous role holds neither the approval right nor the Approvals
      page, on a fresh install and on an upgraded one, with the public-role-like
      setting in use.

## B. The round trip works, by hand, through the interface

- [ ] Dashboard: edit, captured, submitted, reviewed on a real diff, approved,
      applied, recorded with its reviewer and decision time, slot freed.
- [ ] Dataset: the same, with the metric and the column label live afterwards.
- [ ] **Chart, through the Explore save path.** Not walked in any pass to date.
      D-21.
- [ ] Delete: captured not applied, the asset stays in the list, and nothing is
      removed until the delete is approved.
- [ ] Restore: captured, visible in the author's queue as a draft, reachable by
      the reviewer, reviewable in place rather than on the archived asset's own
      page, and the asset returns on approval.
- [ ] Native filters: a touched-then-reverted filter creates no request; a real
      rename creates one carrying that filter alone.
- [ ] An MCP write creates a change request, leaves the live asset untouched,
      and reports success rather than an error.
- [ ] An import that would overwrite an existing asset is refused with the
      corrected message; an import of entirely new assets succeeds, including
      through the command line importer.
- [ ] Embedded configuration: the write is captured and approving it commits
      the whole configuration atomically.
- [ ] A save that changes nothing creates no request, on dashboards, datasets
      and native filters.
- [ ] A save mixing an exempt change with a governed one is governed.
- [ ] An exempt-only change applies directly while another author holds an open
      change.
- [ ] A chart inside a dashboard with an open change carries the pending tag on
      its card, exactly once on the page, and the card still shows the live
      chart name.

## C. Review is honest

- [ ] What changed names the fields the author actually edited, and does not
      lead with columns and metrics on every dataset save.
- [ ] An added metric shows its label and expression; a relabelled column shows
      the label.
- [ ] Every refusal the reviewer can trigger shows the server's own sentence,
      in the banner and on the Approvals page, and both re-read afterwards.
- [ ] No dialog tells the reviewer an action cannot be undone when it can.
      **D-13.**
- [ ] The approver is warned when a chart's dataset has a change waiting.
- [ ] The approver is told when the author has lost edit access, in a sentence
      that names the real reason. Either before they press Approve, or recorded
      as the open half of this decision. **D-24.**
- [ ] A filter save refused for a conflicting draft shows a toast that names the
      reason, and the residual modal behaviour is recorded. **D-23.**
- [ ] The archive dialog warns that deleting replaces a change already waiting
      for review.
- [ ] Approving a change that moved after the approver opened it is refused and
      the panel re-reads itself.
- [ ] Version history credits the author, labels the approval with the
      approver's name, and the author's rationale is either shown or named as a
      caveat. **D-11.**

## D. The record is complete

- [ ] All 45 tracker rows are closed or explicitly open with a named owner and a
      reason.
- [ ] The twelve NEW defects are filed as closed rows with evidence. **D-20.**
- [ ] The four rows that once read Fixed while broken (S-01, R3-01, R4-06,
      S-04) each carry the walk that verified them, not only the commit.
- [ ] Rows covered by unit tests alone are named as such in the sign-off note,
      with the reason: QA-08 and QA-09, both needing two sessions racing, which
      a single walk cannot honestly reproduce. **D-21.**
- [ ] The two residuals the extended walk left, D-23 and D-24, are recorded as
      residuals of QA-04 and QA-07 and not as new defects.
- [ ] Every decision in this register is either signed or recorded as a caveat
      with an owner and a date.
- [ ] The build target is stated, with the base tag and the two host changes the
      delivery carries. **D-04.**
- [ ] The suite is green against a freshly built `dist/`, since the tests import
      the extension from there and a stale build proves nothing.

## E. The four blockers are cleared

- [ ] **D-02.** The §5.1 import amendment is signed.
- [ ] **D-13.** The delete copy no longer contradicts itself.
- [ ] **D-21.** The chart Explore save path has been walked by hand.
- [ ] **D-22.** The V1 / V2 scope page is signed.
- [ ] **D-17**, if VISA's answer to D-01 narrows the approver roles: the
      eligible-approver list checks the approval right, with a test.

## F. Caveats that must appear in the sign-off note

Each of these is acceptable to ship. None is acceptable to ship silently.

- [ ] Approver roles are at the stock default; VISA owns narrowing them (D-01).
- [ ] The service-account role list is empty; VISA owns populating it (D-03).
- [ ] The author's rationale is not surfaced in the asset's version history
      panel (D-11).
- [ ] After approving a delete from the asset's own page the reviewer lands on a
      dead page (D-14).
- [ ] Restoring gives no on-screen feedback (D-15).
- [ ] Approved content can arrive late in an already-open browser; unapproved
      content is never shown (D-16).
- [ ] At a first publish the approver reviews the exposure, not the content
      (D-18).
- [ ] The durable approval record is the change request table; the summary in an
      asset's history panel prunes at 30 days by default (D-19).
- [ ] An administrator who is not an editor can author an embedded-configuration
      change that nobody can approve; this is the no-bypass rule working (D-10).
- [ ] A filter save refused for a conflicting draft closes the modal, so the
      author retypes the filter name (D-23).
- [ ] The approver is warned about an author's lost edit access by the refusal
      rather than in advance; this is the open half of D-07 (D-24).
- [ ] Removing yourself from an asset's editors is accepted and ignored; core
      behaviour, filed upstream, and adding an editor works (D-25).
- [ ] QA-08 and QA-09 rest on unit tests; no two-session race was reproduced
      (D-21).
