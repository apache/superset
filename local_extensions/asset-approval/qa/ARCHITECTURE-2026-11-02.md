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

# Asset approval — architecture and role-model rework plan

Reviewing architect's assessment, 2026-11-02. Written against the tree at
`/Users/amaannawab/preset_local/superset-upstream`, after reading
`qa/REPORT-2026-11-02.md` and `qa/REGRESSION-2026-11-02.md`.

This is a plan, not a patch. No source file was changed to produce it. Where
I say something is the case, I read it. Where I am reasoning ahead of the
code, I say so.

Out of scope on purpose, because another agent owns them: which roles VISA
actually operates, the import disposition in SOW 5.1, and the branch target.
Nothing below depends on those answers.

---

## Part 1. The recurring failure mode

### 1.1 The four rows, reduced to one sentence

S-01, R3-01, R4-06 and S-04 all have the same shape, and it is not a testing
shape. It is a binding shape:

> **the feature has more than one path to the same effect, and a fix binds to
> one of them while the product uses another.**

Spelled out per row:

| Row | The fix was bound to | The product used |
|---|---|---|
| S-01 | the class attribute `Datasource.save` | the bound method Flask-AppBuilder had already captured into `app.view_functions` |
| R3-01 | the API read path (`include_deleted`) | the Review button's navigation target in `Approvals.tsx` |
| R4-06 | the `extra`-only certification exemption | a dataset echo that dragged `columns` and `metrics` into the same payload |
| S-04 | `RefreshDatasetCommand`, the dedicated endpoint | the editor's Sync columns button, which stages into the ordinary governed PUT |

In every case a unit test standing next to the fix passed, because the test
and the fix were bound to the same path. The test did not lie. It answered a
narrower question than anyone read it as answering.

That means "write better tests" is the wrong lesson, and "always click it by
hand" is the right lesson but not a durable one: it depends on a person
remembering, and the one row in this epic that was caught by hand
(`S-04`) was caught by accident while chasing something else.

### 1.2 Why this architecture invites it

Five properties, all of them real, four of them avoidable.

**(a) The gate is attached by 24 independent monkeypatches.**
`install_bindings()` in
`local_extensions/asset-approval/backend/src/asset_approval/bindings.py`
makes 24 bind calls (`gate_run` and `gate_method`). Each one names a host
module path and a class by string and resolves it through
`install._resolve`, which on failure logs a warning and returns `None`. The
binding is then skipped and **that write path is ungated with no further
consequence**. There is no declared expected set, so a path that silently
drops out reduces a count nobody checks.

Evidence that the count is already drifting: both `install.py`'s module
docstring and `bindings.py`'s module docstring say "eighteen". I count 24.
`install.gate_function` is defined, documented as being "for the importers",
and called from nowhere — the importers are bound with `gate_run`. The
inventory in the prose has already fallen behind the code, which is exactly
what the inventory is supposed to prevent.

**(b) Two of the three binding idioms are structurally weaker than the
third.** `gate_run` patches `Cls.run`, which is resolved at call time, so it
reaches every caller. `gate_method` patches a class attribute that
Flask-AppBuilder may already have dereferenced into a bound method object
(S-01). `rebind_registered_routes` repairs that, but only for views whose
`view_functions` entry is still a bound method; the function itself
documents that a Flask-AppBuilder handler wrapped in before-request hooks
"closes over the handler where we cannot reach it" and is skipped. So there
is a known, named class of route that `gate_method` cannot reach and nothing
detects.

**(c) Exemptions are written in three different idioms, and one of them is
invisible.** This is the direct cause of S-04.

| Idiom | Where it lives | Example |
|---|---|---|
| payload-shape | `changes.py` predicates called from the gate | `columns_only_resynced`, `extra_is_only_certification`, `config_diff_changes_nothing`, `_only_exempt` in `bindings.py` |
| command-level | a `gate_run` closure that returns without gating | `_gate_dashboard_update`'s never-published branch |
| **omission** | a command simply absent from `install_bindings()` | `RefreshDatasetCommand`, described in a comment at `bindings.py` line 188 as "Left unbound, so it applies immediately" |

An exemption by omission is unreviewable. It does not appear in
`patched_targets()`, it has no test that can fail, and it says nothing about
*which effect* is exempt — only which code object is unguarded. S-04 is what
happens next: the effect (re-reading column types from the source) was
reachable by a second route, and the exemption, being attached to a code
object rather than to the effect, did not travel with it. The repair
(`columns_only_resynced`) is in the right idiom. The omission is still there
and still invisible.

**(d) The test harness installs the gate in the opposite order to
production.** In `tests/unit_tests/change_management/conftest.py`,
`bind_review_gate` is `autouse=True, scope="session"` and takes no `app`.
`answer_gate_signals` is `scope="module"` and takes `app`. Session-scoped
fixtures run first, so **the bindings are installed before any Flask app
exists**, and `rebind_registered_routes` is never called anywhere in the
suite except against the `_App` stub in `test_route_rebinding.py`.
Production does the reverse: `init_views()` builds the routes, then
`init_extensions` imports `entrypoint`, which binds and then rebinds. The
suite therefore cannot reproduce S-01 against a real route, by construction,
and `test_route_rebinding.py` says so in its own docstring.

**(e) `patched_targets()` records intent, not reachability, and nothing reads
it.** Covered in full below.

The one unavoidable property is (a) in spirit: there is no declared write-guard
seam in `superset_core`, which `install.py`'s docstring states plainly and
correctly. Twenty-four bindings is the honest price of that. The avoidable
part is that nothing checks the twenty-four.

### 1.3 Is `patched_targets()` trustworthy? No.

`install._patched` is a module-level `list[str]`. Each binder appends a
string such as `"UpdateChartCommand.run"` immediately after its `setattr`
succeeds. `patched_targets()` returns that list. Its only caller in the whole
tree is the log line at `entrypoint.py` line 547:

```
"%s installed: %d write paths bound, %d route(s) rebound"
```

Three separate reasons it cannot be used as evidence:

1. **It records the attempt, not the effect.** S-01 is the proof: the class
   attribute really was replaced, `_patched` really did contain
   `"Datasource.save"`, and the route really did call the original. A list of
   successful `setattr` calls is not a statement about what a request will
   execute.
2. **It has no denominator.** A binding whose `_resolve` fails is absent from
   the list and absent from any expectation. There is nothing to compare 24
   against, so the difference between 24 and 23 is a number in a log line.
3. **It is process-global and never reset**, and `_already_gated` makes
   re-binding a no-op. That is correct behaviour for idempotence, but it
   means the list describes the process, not the app, and in a multi-app test
   process it describes neither cleanly.

**What would make it trustworthy.** Three changes, all small:

- Give it a denominator. Move the 24 targets out of the body of
  `install_bindings()` into a declared module-level table in `bindings.py` —
  `(module_path, class_name, attr, idiom, disposition)` where `disposition`
  is `gated`, `refused` or `exempt`. `install_bindings()` iterates the table.
  An exemption by omission becomes an `exempt` row with a reason, which a
  reviewer can see and a test can assert.
- Make it report reachability rather than intent. After binding, assert the
  gate is actually in front of the thing a request reaches: for a command,
  `getattr(cls.run, "__asset_approval_gate__", False)`; for a routed method,
  that no entry in `app.view_functions` still points at an original held in
  `install._method_gates`. The second check is the inverse of
  `rebind_registered_routes` and costs one more pass over the same dict.
- Make the answer visible outside the log. See C6.

### 1.4 Countermeasures, ranked

Ranked by risk removed per unit of cost. Costs are my estimate from reading
the code, not from writing it.

| | Countermeasure | Cost | Risk removed | Tier |
|---|---|---|---|---|
| **C1** | Declared binding table plus a boot-time reachability assertion | low (about 60 lines, one new test module) | the whole S-01 class, and every future silently dropped binding | must |
| **C2** | One rule for where an exemption may live, with the omission exemptions converted | low to medium | the S-04 class | must |
| **C3** | Production-order app fixture in the suite | low | makes the S-01 class testable at all | must |
| **C4** | Route-level contract tests for the paths a person actually uses | medium | the residual S-04 and R4-06 class | should |
| **C5** | The diff rule for reviewers | nil | catches (1) to (4) at review time rather than at QA time | must |
| **C6** | Gate state as a read endpoint, not a log line | low | makes a broken deployment visible to an operator rather than to a QA walk | should |
| **C7** | Server-decided review routing | medium | the R3-01 second-half class | should |
| **C8** | Drift test across the two frontend copies | low | the R4-04 class | should |

#### C1. Declared binding table and a boot-time reachability assertion

The single highest-value item. Concretely:

- In `bindings.py`, hoist the 24 targets into `GOVERNED_WRITE_PATHS`, a
  module-level tuple of records. Each record carries the module path, the
  symbol, the idiom (`run`, `method`), the disposition (`gated`, `refused`,
  `exempt`) and a one-line reason for anything not `gated`.
- `install_bindings()` becomes a loop over that table plus the per-path gate
  closures it already has. The closures stay where they are; only the
  inventory moves.
- Add `install.verify_bindings(app) -> list[str]`, returning a list of
  defects. Three checks: every `gated` row's target resolves; every resolved
  target carries `__asset_approval_gate__`; no entry in `app.view_functions`
  has a `__func__` identical to an `original` recorded in
  `install._method_gates`. The third check is `rebind_registered_routes`
  read backwards, and it is the check that would have caught S-01 at boot.
- `entrypoint.init()` calls it after `rebind_registered_routes` and, if the
  list is non-empty, logs at `error` with the defect names. For a bank, go
  further: call `superset.change_management.register_write_gate` **only when
  the list is empty**. The fail-closed guard in `change_management.py` then
  refuses every write with `CHANGE_MANAGEMENT_UNENFORCED` rather than serving
  a feature with a hole in it. That is a two-line change at
  `bindings._tell_core_the_promise_is_kept` and it converts the worst failure
  mode in the feature from silent to loud.
- A new test module asserts that `GOVERNED_WRITE_PATHS` has no `exempt` row
  without a reason, and that every host symbol it names still resolves. That
  last assertion is the one that catches a host signature move on upgrade,
  which `install.py`'s docstring correctly identifies as the standing risk of
  the approach.

#### C2. One rule for where an exemption may live

Proposed rule, to be written into `changes.py`'s module docstring and
enforced by review:

> **An exemption is a statement about an effect, so it is expressed as a
> predicate over the live asset and the proposed payload, evaluated at the
> gate. It is never expressed by leaving a code path unbound, and never by
> trusting which endpoint the request arrived at.**

Rationale, in one line each:

- An endpoint-shaped exemption is wrong because endpoints are not the unit of
  effect. S-04 is the proof: two endpoints, one effect, one exemption.
- A command-shaped exemption is acceptable only when the command *is* the
  effect and nothing else can produce it. `_gate_dashboard_update`'s
  never-published branch qualifies, because it is a property of the asset,
  not of the route.
- A payload-shape exemption is correct because it is evaluated wherever the
  gate runs, which is every bound path at once. `columns_only_resynced`,
  `extra_is_only_certification` and `config_diff_changes_nothing` are all in
  this form and all survive a new route appearing.

Work implied before sign-off: turn the `RefreshDatasetCommand` omission into
an explicit `exempt` row in `GOVERNED_WRITE_PATHS` carrying the reason
already written in the comment at `bindings.py` line 188. The behaviour does
not change. The exemption becomes visible, countable and testable, and the
next person who adds a third way to resync columns has something to collide
with.

#### C3. Production-order app fixture

Add to `tests/unit_tests/change_management/conftest.py` a second fixture,
`app_with_extension_installed`, that builds the app, lets Superset register
its views, and only then runs `install_bindings()` and
`rebind_registered_routes(app)`. Keep `bind_review_gate` for the predicate
tests, which are cheap and should stay cheap. Mark the new fixture as the one
the route-level tests in C4 must use.

Without this the suite cannot express the S-01 bug at all against a real
route, and `test_route_rebinding.py` is reduced to testing
`rebind_registered_routes` against a stub it wrote itself. That test is good;
it is just not the same test.

#### C4. Route-level contract tests for the paths a person uses

Today the suite is mostly predicate tests and command tests. Six modules
touch a client at all (`test_api_visibility`, `test_dashboard_subendpoints_api`,
`test_dataset_refresh`, `test_fail_closed`, `test_import_refusal`,
`test_remaining_paths`), and the ones that matter most do not.
`test_a_column_resync_is_exempt.py` exercises `columns_only_resynced`
directly, nine times over, and never once sends the request the dataset
editor sends. That is S-04's test, written after S-04, in S-04's own shape.

Proposed: a single new module, `test_the_paths_a_person_uses.py`, holding one
test per product action, each one issuing the HTTP request the browser issues
against the C3 fixture and asserting the status code and whether a
`ChangeRequest` row exists. The list is short and it is already written down
in `REGRESSION-2026-11-02.md`'s walk table:

- `PUT /api/v1/dataset/<id>` with a resynced column set, from the editor's
  payload shape: 200 and no change request (S-04).
- `PUT /api/v1/dataset/<id>` with a certification-only `extra`: 200, no
  change request (R4-06).
- `PUT /api/v1/dataset/<id>` with a changed description: 200, no change
  request (QA-25).
- `POST /datasource/save/`: 422 and the dataset unmodified (S-01).
- `PUT /api/v1/dashboard/<id>` on an unpublished dashboard: 200; on a
  published one: 202 and a change request (QA-18).
- `DELETE /api/v1/chart/<id>`: 202, chart still present (QA-17).
- `POST /api/v1/change_request/<id>/approve` as the author: 403.
- The chart Explore save path, which `REPORT-2026-11-02.md` records under
  "Not covered" and which no walk has ever touched.

These are contract tests, not unit tests. They do not care how the gate is
bound. That is the point: each one would have failed for S-01 and S-04 while
the predicate tests passed.

#### C5. The diff rule for reviewers

A reviewer cannot tell from a diff that a fix reaches the product path unless
the diff is shaped to say so. The rule I would adopt, and it costs nothing:

> **A change to gate behaviour is reviewable only if the diff touches a
> declared binding row or a `changes.py` predicate, and carries a test that
> issues a request rather than calling a function.**

Three questions a reviewer asks, in order:

1. **What is the effect, and how many ways are there to produce it?** If the
   diff names an endpoint, a command class or a DAO method in its rationale,
   that is the warning sign. The answer has to be in terms of fields on the
   asset.
2. **Does `GOVERNED_WRITE_PATHS` change?** A behaviour change that leaves the
   table untouched is either a predicate change (fine, it applies everywhere
   the gate runs) or it is bound to one path (needs question 1 answered
   again).
3. **Does the test send a request?** If every new test calls a function
   directly, the diff has not been shown to reach the product. For an
   exemption or a refusal, that is a blocking comment.

S-01 fails question 3. S-04 fails questions 1 and 2. R4-06 fails question 1.
R3-01 fails question 1 across the backend/frontend boundary, which is the
hardest of the four to catch and the reason for C7.

#### C6. Gate state as a read endpoint

`entrypoint.init()`'s log line is the only place the install's own view of
itself is recorded, and nobody reads a log line. Add the defect list from C1
to the existing read-only Change review page, which already calls
`GET /api/v1/change_request/enabled` and is already permissioned behind
`can_configure_review`. Return `{enabled, gate_installed, bound, defects}`.
An operator then has one screen that answers "is review actually being
enforced on this instance", which is the question a control review will ask
and which currently has no answer short of trying an edit.

#### C7. Server-decided review routing

`Approvals.tsx`'s `review()` decides where to send an approver with a
client-side allowlist:

```
if (row.asset_type === 'dataset') { setReviewing(row); return; }
if (isRestore(row)) { setApproving(row); return; }   // isRestore = row.command === 'restore'
window.location.assign(assetUrl(row));
```

The default branch navigates. That is the R3-01 second half as a permanent
property: any change-request kind whose asset page cannot host review
controls must be added to the allowlist by hand or it silently routes to a
dead page. `REGRESSION-2026-11-02.md` already records the next instance of
it, filed as "worth fixing": after approving a delete from the asset's own
page the reviewer is left on the deleted chart's Explore page.

The fix in shape, not in code: the server knows the operation, the command
and whether the asset is reachable, and `api.serialize` already carries
per-row answers of exactly this kind (`can_approve`, `is_author`). Add
`reviewable_in_place: bool` to the serialised change request and have the
client branch on it, defaulting to in-place when absent. The allowlist then
lives beside the thing that knows the answer, and a new command kind defaults
to the safe branch instead of the dead one.

#### C8. Drift test across the two frontend copies

Seven modules exist twice, once in
`superset-frontend/src/features/changeManagement/` and once in
`local_extensions/asset-approval/frontend/src/`, and they have drifted:

| Module | host lines | extension lines | diff lines |
|---|---|---|---|
| `WhatChangedPanel.tsx` | 358 | 352 | 191 |
| `api.ts` | 219 | 218 | 119 |
| `display.ts` | 158 | 178 | 89 |
| `ApprovePublishModal.tsx` | 136 | 85 | 62 |
| `DatasetReviewModal.tsx` | 377 | 359 | 48 |
| `RequestReviewModal.tsx` | 210 | 205 | 40 |
| `types.ts` | 192 | 169 | 25 |

The extension copy cannot import the host copy; that is why
`local_extensions/asset-approval/frontend/src/host.tsx` exists as a shim.
So the duplication is forced by the framework and belongs in the debt
register. What does not belong there is the absence of any check: R4-04 was
"Fixed, in two places", the second place found only because someone opened
the Approvals page by hand. A test that asserts the user-facing strings and
the refusal-handling branches match across the two copies is cheap and
catches that class directly.

### 1.5 The honest limit

None of C1 to C8 removes the need for a walk. They remove the four specific
mechanisms that made four fixes invisible, and they make the fifth mechanism
visible when it arrives. The cheap guard named at the end of
`REPORT-2026-11-02.md` stays: before marking a row fixed, do the thing a
person would do, through the interface they would use. C4 is that guard
written down so it runs without a person remembering.

---

## Part 2. The role and permission model, reworked

### 2.1 Current state, as read

| Permission | View menu | Created by | Enforced where | Held by, stock install |
|---|---|---|---|---|
| `can_read` | `ChangeRequest` | FAB, from `method_permission_name` | `@protect()` on the six read routes, then `_may_see` per row | Admin, Alpha, Gamma |
| `can_write` | `ChangeRequest` | same | `@protect()` on `submit`, `withdraw`, `discard` | Admin, Alpha, Gamma, and the anonymous role under `PUBLIC_ROLE_LIKE` |
| `can_approve` | `ChangeRequest` | same, from `{"approve": "approve", "request_changes": "approve"}` | `@protect()` on `approve` and `request_changes`, and re-read by `eligibility.holds_approval_permission` | Admin, Alpha, Gamma |
| `can_review` | `[extension] preset.asset-approval` | host, from `extension.json` | host page router | Admin, then widened by `entrypoint._grant_page_permission_to_the_workflow` to every role holding `can_read` on ChangeRequest |
| `can_configure_review` | same | same | same | Admin only |

Object-level checks, all in `eligibility.py` and `lifecycle.py`, all
independent of the above:

- `can_approve(cr, asset, user_id)`: not the author, not a guest, account
  active, not in a machine-user role, holds the approval permission, and
  `is_strict_editor`. No administrator shortcut, by design (Visa Q1, SOW 9.3).
- `lifecycle.discard`: author **or** `is_strict_editor`. No role-level right
  beyond `can_write`.
- `lifecycle.withdraw`: author only.
- `api._may_see`: author or `is_strict_editor`.

Two config keys, read through `current_app.config.get`:
`ASSET_APPROVAL_APPROVER_ROLES` (`entrypoint.APPROVER_ROLES_CONFIG`) and
`ASSET_APPROVAL_MACHINE_USER_ROLES` (`eligibility.MACHINE_USER_ROLES_CONFIG`).
**Neither appears in `superset/config.py`, and neither does the
`CHANGE_MANAGEMENT` feature flag** (confirmed by grep over `superset/`). They
work, because `config.get` and `is_feature_enabled` both tolerate an absent
key, but they are undocumented and a typo in either key name is
indistinguishable from leaving it unset.

### 2.2 Should approving be a role-level right at all?

Yes. Keep it, as a ceiling and never as a floor.

The case against is real and worth stating: editorship is the operative
control, `can_approve` adds nothing an attacker has to defeat separately, and
holding it is necessary and not sufficient, which means the permission table
tells a control reviewer something that is not true on its own. The internal
inconsistency sharpens the point: **`discard` is destructive — it throws away
another person's work and frees the asset — and it is governed by editorship
alone, with no right of its own.** If editorship is sufficient for discard,
the argument goes, it should be sufficient for approve.

Three reasons I still keep it:

1. **It is the only enumerable answer.** A control reviewer asks "list
   everyone who can approve a change". An object-level answer requires
   walking every asset's editor list and intersecting it with every change
   request. A role-level ceiling gives a population at the role layer that
   can be printed, reviewed and signed off, and editorship narrows it from
   there. That is worth a permission that is not individually sufficient.
2. **It is the only enforcement point that is uniform across transports.**
   `@protect()` runs on the REST route regardless of whether the caller is
   the browser, MCP or a script. `eligibility.can_approve` runs because
   `lifecycle.approve` calls it. This epic has demonstrated four times that a
   single check placed on one path is not reached by all paths. Two
   independent checks on the one action that must never be wrong is the
   correct amount of redundancy here, not an excess.
3. **Removing it is a migration with no upside.** It would mean a new
   `superset init` story, a change to `method_permission_name`, and a
   permission that still exists in FAB's tables on every upgraded instance.

So: keep `can_approve`, and fix the two places where it is a ceiling in name
only — see 2.6, defects A and B. The ceiling has to actually constrain, and
the UI has to agree with the route about who is under it.

The discard asymmetry I would **not** fix before sign-off. It is deliberate
(SOW 5.3: one abandoned draft must not block an asset) and changing it risks
the deadlock the rule exists to avoid. It belongs in the next iteration as
`can_discard`, held by the same roles as `can_approve` plus Admin.

### 2.3 Proposed target role model

Four named roles, two of them new. The two new ones are **capability roles**:
they carry one right each and no access of their own, and a person holds one
alongside their ordinary access role. That is what makes the population
printable.

| Role | Kind | `can_read` CR | `can_write` CR | `can_approve` | `can_review` | `can_configure_review` |
|---|---|---|---|---|---|---|
| `Admin` | access | yes | yes | **no** | yes | **yes** |
| `Alpha` | access | yes | yes | **no** | yes | no |
| `Gamma` | access | yes | yes | **no** | yes | no |
| `Public` / `AUTH_ROLE_PUBLIC` | anonymous | no | **no** | **no** | **no** | no |
| `Change Approver` | capability | yes | yes | **yes** | yes | no |
| `Change Review Operator` | capability | yes | no | no | yes | **yes** |

What changes, per role:

- **Admin** loses `can_approve`. This is the opinionated call. An Admin who
  is a legitimate second editor of an asset today can approve, because
  `can_approve` falls through the denylist to them; after the change they
  cannot until someone adds `Change Approver` to their account. The gain is
  that "no administrator bypass" becomes provable at the permission layer as
  well as at the object layer, and a control reviewer reading the permission
  table sees exactly one role that can approve. `morgan` in the demo already
  proves the object-level half; this makes the printed answer match it.
  Admin keeps `can_configure_review`, which is the host's own default.
- **Alpha** loses `can_approve`. An Alpha authors; approving is a second
  function and should be granted as one.
- **Gamma** loses `can_approve`. This is the most clearly wrong current
  grant. Gamma reaches it only because Superset builds Gamma from a denylist
  and a new model permission falls through (verified on a running instance
  per `REPORT-2026-11-02.md`; I did not re-verify the denylist myself).
  Gamma keeps `can_read` and `can_write` on ChangeRequest, because a Gamma
  can author their own charts and must be able to submit, withdraw and
  discard their own drafts — which is also why `/approvals` rendering for
  `sam` is correct and NEW-6 was filed as the wrong thing.
- **Public** holds none of the five. `entrypoint._take_the_workflow_off_the_anonymous_role`
  already revokes `can_approve` and `can_review`. I would go one step further
  than the code currently does and also revoke `can_write` on ChangeRequest.
  The code deliberately declines, on the grounds that `can_write` reaches the
  anonymous role through `PUBLIC_ROLE_LIKE` plus `superset init` and revoking
  it "would be a tug of war with the host on every boot". That reasoning is
  sound for a general-purpose install and wrong for a bank: the tug of war is
  a boot-time write that always resolves the same way, and an anonymous role
  carrying a write permission on a governance table is an audit finding
  whether or not anything can be done with it. Nothing can: `lifecycle.submit`
  needs `author_fk == get_user_id()`, `withdraw` the same, and `discard`
  needs `is_strict_editor`, all of which fail for a `None` user id. So this
  is presentation, not exposure — but presentation is what a control review
  reads.
- **`Change Approver`** is the whole answer to "who gets `can_approve`". One
  role, named for one right, listed in `ASSET_APPROVAL_APPROVER_ROLES`,
  carrying no access of its own so that granting it cannot widen what a
  person can see. Membership is the auditable artefact.
- **`Change Review Operator`** exists only so that `can_configure_review`
  does not have to be Admin-or-nobody. Low priority; the page is read-only.
  If VISA does not ask for it, leave `can_configure_review` on Admin and drop
  this row.

### 2.4 `can_review` and `can_configure_review`

Leave both as they are, with one caveat each.

`can_review` is correctly widened by
`_grant_page_permission_to_the_workflow` to every role holding `can_read` on
ChangeRequest, with the anonymous role skipped via `belongs_to_the_workflow`.
That is right: the Approvals page is where a person sees their own drafts as
well as other people's reviews, so it belongs to everyone in the workflow and
not only to approvers.

`can_configure_review` is granted by the host to Admin and widened by nobody,
which is correct. The caveat is the name. The page it guards is read-only;
`ChangeReviewSettings.tsx` renders a disabled `Switch` and the line "Set in
the instance configuration. Changing it needs a restart." A right called
`can_configure_review` that configures nothing will be read by a control
reviewer as a configuration capability that does not exist. Either rename it
to `can_view_review_settings` before sign-off, which is a one-line change in
`extension.json` plus the two assertions in
`test_the_settings_page_is_not_the_inbox.py`, or write the discrepancy into
the runbook. I prefer the rename: it is cheaper now than after the permission
is in a customer's access matrix.

### 2.5 Service and machine accounts

**Role-name matching is not adequate for a bank.** What exists:
`eligibility.machine_user_roles()` reads `ASSET_APPROVAL_MACHINE_USER_ROLES`,
strips and compares `role.name` by string, in `is_eligible_approver` and in
`only_eligible_accounts`. Four weaknesses, in order of seriousness:

1. **It is a denylist keyed on a mutable string.** Renaming the role in the
   FAB UI silently un-flags every account in it. Nothing logs, nothing fails,
   and the next approval by a service account succeeds. For a maker-checker
   control, a silent widening on a rename is the wrong failure direction.
2. **It only catches accounts that are in the role.** A service account
   granted editorship directly, or carrying only `Alpha`, is not flagged.
   The control depends on an operator's discipline in role assignment, which
   is the thing the control is supposed to not depend on.
3. **It is a property of the account, when the real property is the
   session.** A human being is an approver because a human being is sitting
   there. The durable control is "an approval may only be given through an
   interactive, interactively-authenticated session" — not "this account is
   not in a list". `eligibility.can_approve` already enforces the strongest
   instance of this, `security_manager.is_guest_user()`, and that check needs
   no configuration at all.
4. **There is no audit trail.** Nothing records that an account was
   considered a machine user, so a control reviewer cannot reconstruct why a
   particular approval was or was not offered.

What I would do instead, in two steps:

- **Before sign-off, add a session-level condition to `eligibility.can_approve`:**
  refuse an approval that did not arrive through an interactive browser
  session. The information is available on the request. `ChangeRequestRestApi`
  sets `allow_browser_login = True`, so a cookie-authenticated call is
  distinguishable from a JWT or API-key call; MCP already resolves its own
  user before the gate is reached, which `REPORT-2026-11-02.md` records as a
  property it had to work around for a scripted call. Refusing non-interactive
  approvals is a stronger and cheaper control than any list of role names, it
  needs no configuration, and it cannot be defeated by a rename. Keep the
  role-name denylist alongside it as a coarse second line.
- **Next iteration, replace the list with a predicate.** Add
  `ASSET_APPROVAL_MACHINE_USER_PREDICATE`, a callable in config taking a FAB
  `User` and returning a bool, defaulting to the current role-name behaviour.
  A bank then plugs in its own identification — a username prefix, an LDAP
  attribute, an absent email, whatever their identity team already uses as
  the authoritative answer — and the answer stops being a copy of a fact held
  elsewhere. Log the predicate's verdict whenever it excludes someone, which
  closes weakness 4.

One further hardening worth a line: `_align_approval_permission` should also
revoke `can_approve` from any role named in `ASSET_APPROVAL_MACHINE_USER_ROLES`,
and refuse with an error log if a role appears in both config keys. A role
that is both an approver role and a machine-user role is a configuration
contradiction and should be reported, not silently resolved at the object
layer.

### 2.6 Defects in the model as it stands

Four, found by reading. The first two are blocking.

**A. `eligible_approvers` and `can_approve` disagree, and the disagreement
becomes live the moment VISA configures approver roles.** This is S-07's bug
class, recurring in the same function pair.

`eligibility.can_approve` checks `holds_approval_permission(user_id)`.
`eligibility.eligible_approvers` does not: it expands the asset's editor
subjects to users and filters them through `only_eligible_accounts`, which
applies `User.active.is_(True)` and the machine-role exclusion **and nothing
about the approval permission**. The module docstring on
`is_eligible_approver` names this exact trap for `active` — "``active`` was
filtered out of the list and not out of the check" — and the permission
condition was then added to the check only.

Two consequences, both at `lifecycle.py` line 147 and `api.py` lines 469 and
516:

- `lifecycle.submit` refuses with `NoEligibleApproverError` only when
  `eligible_approvers` is empty. If the asset's only other editor does not
  hold `can_approve`, submission **succeeds**, the asset locks, and the
  change can never be approved by anyone. That is precisely the unapprovable
  deadlock SOW 5.4's never-auto-approve rule exists to prevent, arriving
  through the check meant to prevent it.
- The banner and the request dialog name that person as the approver. The
  author chases them; `POST /api/v1/change_request/<id>/approve` answers 403.

This is latent today only because stock Superset hands `can_approve` to
Admin, Alpha and Gamma, so every plausible editor holds it. **Setting
`ASSET_APPROVAL_APPROVER_ROLES` to a narrow role — the first thing VISA will
do — makes it live on every asset whose second editor is not in that role.**
Fix: apply the permission condition inside `only_eligible_accounts`, so the
list and the check cannot answer differently, which is the stated reason that
function exists. It can be expressed in SQL: the role ids are already
available from `eligibility.roles_that_may_approve()`, so the filter is
`User.roles.any(Role.id.in_(role_ids))`, with the existing fail-open
behaviour preserved when the permission does not exist.

**B. `_align_approval_permission` can grant `can_approve` to the anonymous
role, and can leave it held by nobody.** Two problems in one function
(`entrypoint.py` lines 332 to 396).

- It iterates `security_manager.get_all_roles()` and calls
  `add_permission_role` for every role whose name is in the configured list.
  It does **not** call `belongs_to_the_workflow`, which every other grant in
  the file does. `install_views` runs `_take_the_workflow_off_the_anonymous_role`
  and then `_align_approval_permission`, so an operator who lists the
  anonymous role's name in `ASSET_APPROVAL_APPROVER_ROLES` gets
  `can_approve` granted back to it, after the revoke, on every boot. Fix: one
  `if not belongs_to_the_workflow(role): continue`, and log loudly, because a
  config naming the anonymous role as an approver role is a mistake worth
  shouting about.
- It grants only to roles that already exist. A role named in the config and
  absent from the database is silently skipped, while the revoke half still
  runs against `BUILTIN_ROLES`. So `ASSET_APPROVAL_APPROVER_ROLES =
  ["Change Approver"]` with the role not yet created strips `can_approve`
  from Admin, Alpha and Gamma and grants it to nobody. `@protect()` denies a
  permission no role holds, which `_seed_approval_permission`'s own docstring
  states, so **every approval on the instance returns 403 with nothing in the
  logs to explain it**. That is exactly the "a new permission nobody holds
  means `@protect()` denies everyone" hazard, arriving through the function
  written to avoid it. I am inferring the 403 from that docstring and from
  FAB's documented behaviour; I did not run it. Fix: create a named role that
  does not exist, and after alignment, if no role holds the permission, log at
  error and re-grant the previous holders rather than completing the revoke.
  Availability is the right direction to fail here, because editorship is
  still enforcing the real control.

**C. `BUILTIN_ROLES` hardcodes `"Public"` while `_anonymous_role_name()`
reads `AUTH_ROLE_PUBLIC`.** On an instance that renames the anonymous role,
`_align_approval_permission` will not revoke `can_approve` from it, because
the new name is not in `BUILTIN_ROLES`. `_take_the_workflow_off_the_anonymous_role`
does use the config value, so the hole is covered in practice. Still worth
making the two agree: build `BUILTIN_ROLES` with `_anonymous_role_name()`
rather than the literal.

**D. The three config keys are undeclared.** `ASSET_APPROVAL_APPROVER_ROLES`,
`ASSET_APPROVAL_MACHINE_USER_ROLES` and the `CHANGE_MANAGEMENT` feature flag
appear nowhere in `superset/config.py`. An operator reading the config file
finds no evidence they exist, and a typo in either key name reads as "unset",
which for the approver key means "leave whatever `superset init` produced" —
that is, Admin, Alpha and Gamma keep `can_approve` and the operator believes
they narrowed it. Declare all three with their defaults and a comment.

### 2.7 Migration and upgrade

The mechanism to carry this is already in `entrypoint.install_views`, and the
seed-then-align pattern is correct. What follows is the operator procedure and
the two places the current code will trip.

**What happens today on an existing install.** `install_views` runs on every
boot, in this order: `appbuilder.add_api(ChangeRequestRestApi)` (which is what
creates `can_approve`), `_grant_page_permission_to_the_workflow`,
`_seed_approval_permission`, `_take_the_workflow_off_the_anonymous_role`,
`_align_approval_permission`. With `ASSET_APPROVAL_APPROVER_ROLES` unset, the
seed copies `can_approve` to whoever holds `can_write` on ChangeRequest, once,
while nobody holds it, skipping the anonymous role; align does nothing. With
the key set, the seed returns immediately and align is authoritative.

**The operator procedure, in order. The order matters.**

1. Create the `Change Approver` role and add its members. Do this **before**
   touching the config. If the role is absent or empty when align first runs,
   defect B's second half strips the permission from Admin, Alpha and Gamma
   and grants it to nobody.
2. Set `ASSET_APPROVAL_APPROVER_ROLES = ["Change Approver"]`,
   `ASSET_APPROVAL_MACHINE_USER_ROLES = [...]`, and leave
   `CHANGE_MANAGEMENT` as it is.
3. Rolling restart, one worker at a time.

**Why there is no outage.** Permissions live in the shared metadata database,
not in process memory, so the first restarted worker applies the alignment for
the whole instance. Workers still running the old code read the same tables
and so enforce the new grants immediately. There is no window in which half
the fleet disagrees about who can approve. There is a window in which a
member of `Change Approver` who is also an Alpha has the right twice, which is
harmless.

**The one real window** is in-flight requests. A change request submitted
before the restart and pending afterwards is unaffected: nothing about the
stored row changes, and `can_approve` is evaluated at approval time. If its
only eligible approver was an Alpha who is not in `Change Approver`, that
request becomes unapprovable and must be discarded or re-submitted to a new
approver. There is no automatic repair for this and there should not be one.
Enumerate it before the restart with one query over `change_requests` where
`status = 'pending'`, intersected against the new role's membership. That
query belongs in the runbook, and with defect A fixed, `lifecycle.submit`
would have refused those submissions in the first place.

**`superset init` afterwards.** Running it rebuilds the builtin roles from
the denylist and re-grants `can_approve` to Admin, Alpha and Gamma.
`_align_approval_permission` revokes it again, but only on the next boot, so
there is a window between `superset init` and the following restart in which
Alpha holds the right. Editorship still gates every approval during that
window, so the exposure is one unintended approver per asset with an Alpha
second editor, not a bypass. The runbook line is: **always restart after
`superset init`**. I am inferring the re-grant from
`_align_approval_permission`'s own docstring, which states it, rather than
from running it.

### 2.8 Granted and should not be; missing

**Granted and should not be:**

- `can_approve` on Gamma. Falls through the denylist. The clearest wrong
  grant in the model.
- `can_approve` on Alpha and Admin. Defensible but wrong for a bank, per
  2.3.
- `can_write` on ChangeRequest on the anonymous role. Unusable, and still an
  audit finding.
- `can_approve` on any machine-user role. Nothing revokes it; the control is
  object-level only. Defence in depth, per 2.5.

**Missing:**

- Nothing enforces the ceiling on the *list* of approvers, which is defect A.
  The permission exists and is not read where the product reads eligibility.
- No right distinguishes discarding another person's draft from submitting
  one's own. Both are `can_write`. Deliberate per SOW 5.3; worth `can_discard`
  next iteration.
- No session-level condition on approving, per 2.5. The strongest missing
  control in the model.
- No readable statement of who can actually approve. The Change review page
  says "Other editors with the approval permission, never the author", which
  is the rule and not the answer. The answer is a database query over the
  roles holding `can_approve`, and the page should run it. Note also that
  `ASSET_APPROVAL_APPROVER_ROLES` reads as an allowlist but behaves as a
  partial one: `_align_approval_permission` revokes only from
  `BUILTIN_ROLES`, so a right an operator granted by hand to a role of their
  own is never taken back. For a control review, the config file is therefore
  not the authoritative answer and must not be presented as one.

---

## Part 3. Disposition

### Must do before sign-off

| | Item | Where |
|---|---|---|
| 1 | Filter `eligible_approvers` through the approval permission, so the list and the check agree (defect A) | `eligibility.only_eligible_accounts` |
| 2 | Skip the anonymous role in alignment; create a named role that is absent; refuse to complete a revoke that would leave `can_approve` held by nobody (defect B) | `entrypoint._align_approval_permission` |
| 3 | Declared `GOVERNED_WRITE_PATHS` table, `install.verify_bindings(app)`, and `register_write_gate` called only when it reports no defects (C1) | `bindings.py`, `install.py`, `entrypoint.init` |
| 4 | Convert the `RefreshDatasetCommand` omission into an explicit `exempt` row with its reason; write the exemption-placement rule into `changes.py` (C2) | `bindings.py`, `changes.py` |
| 5 | Production-order app fixture (C3) | `tests/unit_tests/change_management/conftest.py` |
| 6 | Session-level condition on approving: refuse a non-interactive approval (2.5) | `eligibility.can_approve` |
| 7 | Declare the three config keys with defaults and comments (defect D) | `superset/config.py` |
| 8 | Adopt the diff rule for gate changes (C5) | review practice |
| 9 | Rename `can_configure_review`, or write the discrepancy into the runbook (2.4) | `extension.json` |
| 10 | Runbook: the role-before-config ordering, the pending-request query, and "always restart after `superset init`" (2.7) | runbook |

Items 1, 2 and 3 are the ones I would block on. Item 6 is cheap and removes
more risk than the machine-user list it supplements.

### Should do in the next iteration

- Route-level contract tests for the eight paths in C4, including the chart
  Explore save that no walk has covered.
- `reviewable_in_place` on the serialised change request, replacing
  `Approvals.tsx`'s client-side command allowlist (C7).
- Gate state on the Change review page: `enabled`, `gate_installed`, `bound`,
  `defects`, and the roles that actually hold `can_approve` (C6, 2.8).
- `ASSET_APPROVAL_MACHINE_USER_PREDICATE`, defaulting to today's role-name
  behaviour (2.5).
- Revoke `can_approve` from machine-user roles; error on a role named in both
  config keys (2.5).
- `can_discard` as a right of its own (2.2).
- Revoke `can_write` on ChangeRequest from the anonymous role, accepting the
  boot-time tug of war (2.3).
- Drift test across the seven duplicated frontend modules (C8).
- Build `BUILTIN_ROLES` from `_anonymous_role_name()` (defect C).

### Architectural debt to record

- **No declared write-guard seam in `superset_core`.** Twenty-four
  monkeypatches is the price, and `install.py`'s docstring is already the
  right artefact for the upstream contribution. Each binding is a separate
  chance to drift on a host upgrade; C1's resolve assertion converts that from
  silent to loud but does not remove it.
- **`gate_method` cannot reach a Flask-AppBuilder handler wrapped in
  before-request hooks.** Named in `rebind_registered_routes` and skipped
  deliberately. No such path is bound today. If one appears, the gate will be
  installed, reported and absent, which is S-01 again.
- **Seven frontend modules duplicated and drifted**, forced by the extension
  boundary and the `host.tsx` shim. The R4-04 generator.
- **`eligibility.holds_approval_permission` fails open when `can_approve`
  does not exist**, while `@protect()` on the route fails closed. The UI will
  offer an Approve button the route refuses on an instance that has not run
  `superset init` since the permission shipped. Documented in the function;
  recorded here because it is a divergence between two enforcement points,
  which is this epic's signature failure.
- **`install.gate_function` is dead code.** Defined and documented as being
  for the importers; the importers are bound with `gate_run`. Remove it or
  use it, so the module does not advertise a third idiom nothing exercises.
- **The extension's test harness exists because a local extension happens to
  be unpacked on disk**, as its own conftest docstring says. A `.supx` loaded
  through `InMemoryLoader` could not be tested at all. That is a framework
  gap and it bounds how much of C3 and C4 can ever be trusted.
