# Asset approval

Maker-checker review for dashboards, charts and datasets. A change to a
governed asset does not reach viewers until a second eligible editor
approves it.

Turn it on with the `CHANGE_MANAGEMENT` feature flag. With the flag off the
extension installs nothing: no gate, no banner, no bell, no Approvals entry,
and Superset behaves as upstream.

## Configuration

Three settings, all of them in `superset_config.py`. None is declared in
`superset/config.py` -- two are this extension's own, and the flag has no
default entry -- and all three are read with `.get`, so a key that is
misspelt or in the wrong file is indistinguishable from one left out.

The extension therefore logs the effective value of each one at boot. Read
those three lines before believing a setting was picked up:

```text
preset.asset-approval config: FEATURE_FLAGS['CHANGE_MANAGEMENT'] = True (set)
preset.asset-approval config: ASSET_APPROVAL_MACHINE_USER_ROLES = [] (defaulted, so no role is treated as service accounts)
```

A key beginning `ASSET_APPROVAL_` that this extension does not read is named
in a warning on the same boot, which is how a typo such as
`ASSET_APPROVAL_MACHINE_USER_ROLE` shows up.

| Setting | Type | Default | What it does |
|---|---|---|---|
| `CHANGE_MANAGEMENT`, an entry in the `FEATURE_FLAGS` dict | `bool` | absent, which reads as `False` | Turns the whole feature on. |
| `ASSET_APPROVAL_MACHINE_USER_ROLES` | list of role names, or `None` | `None` | Names the roles whose members are service accounts, which may never approve. |

If a setting is absent:

- **`CHANGE_MANAGEMENT`** -- nothing is reviewed. Writes apply as they do on
  an unmodified Superset. The flag being on with the extension not loaded is
  a different matter: every governed write is refused rather than applied
  (QA-12).
- **`ASSET_APPROVAL_MACHINE_USER_ROLES`** -- no role is treated as service
  accounts, so every otherwise eligible account may approve.

### Who may approve is not configured here

There is deliberately no setting for it. Approving a change belongs to the
*other editors of that asset*, so the right travels with the asset rather
than with a role, and no central list grants or revokes it. Add someone as
an editor of a dashboard and they can approve changes to that dashboard,
and to nothing else.

A grantable `can_approve` permission did exist briefly, read from a
`ASSET_APPROVAL_APPROVER_ROLES` setting. It was removed. A role gate on top
of editorship can only ever subtract, so its sole effect is to stop a
legitimate editor approving, which is a deadlock rather than a control. If
QA raises S-05 ("no separate approval permission") again, the answer is
this section and
`tests/unit_tests/change_management/test_approval_is_editorship_not_a_role.py`,
not a rebuild.

`ASSET_APPROVAL_MACHINE_USER_ROLES` is not the same thing and remains. It
is a denylist: it stops the named roles' members counting as approvers at
all. It never grants the right to anyone.


## Who may approve

Three conditions, all required. None of them can be bought back by another.

1. **Not the author.** The submitter can never approve their own change
   (SOW 5.4). This is checked first and is not overridable by any
   permission or role.
2. **A strict editor of the asset.** Editorship on the merits, through a
   subject grant to the user, one of their roles, or one of their groups.
   There is deliberately **no administrator bypass in V1** (Visa Q1,
   SOW 9.3): an administrator who is not an editor of the asset cannot
   approve a change to it.
That is the whole of it. There is no third condition and no role to grant:
approving travels with the asset, not with the person's role.

The account itself also has to be one a person uses: **active**, and not a
**service account**.

### Why there is no approval permission to grant

A grantable `can_approve` permission on `ChangeRequest` existed briefly, set
from an `ASSET_APPROVAL_APPROVER_ROLES` list, and was removed.

It could only ever subtract. Editorship already decides, so a role gate on
top of it has exactly one effect: stopping an editor who should be able to
approve. That is a deadlock, not a control, and it was not hypothetical.
While the permission existed, the approve route consulted it and the list of
possible approvers did not, so narrowing the roles would have named an
approver in the request dialog and then refused them at the route, leaving a
change nobody could clear.

The reviewer actions therefore sit on `can_write` alongside `submit`,
`withdraw` and `discard`. That is what `@protect()` enforces on the route;
the decision that matters is `eligibility.can_approve`, per change request.

S-05 was raised as "no separate approval permission". The answer is that
this is deliberate. See
`tests/unit_tests/change_management/test_approval_is_editorship_not_a_role.py`,
which fails if anyone rebuilds it.

**To change who can approve a given asset, change its editors.** That is the
only lever, and it is per asset by design.

### How a machine user is identified

Superset has no notion of a machine user, so the instance names one:

```python
ASSET_APPROVAL_MACHINE_USER_ROLES = ["Service accounts"]
```

Members of those roles are never listed as possible approvers and are
refused if they try. The setting is empty by default, which is the behaviour
this had before (S-07).

A `NULL` in `ab_user.active` counts as not active. FAB writes that column
when it creates an account, so a null is a row that came from a direct write
or an older schema, and an approval right is the wrong place to read a null
in the account's favour.

The list the request dialog shows and the check the approve route makes read
one predicate. They used to disagree: `active` was filtered out of the list
and not out of the check, so a deactivated editor never appeared as an option
yet could still approve through the API.

### What is not separated

Gamma keeps `can_read` and `can_write` on `ChangeRequest` by default, and
that is deliberate. Gamma holds `can_write` on Dashboard and Chart on a stock
install, so a Gamma user authors governed writes; stripping the route
permission would leave their own change request unreadable, unsubmittable and
unwithdrawable. What stops a viewer acting on someone else's change is the
row-level check, not the route permission: every read is filtered to its
author or a strict editor of the asset, and every write re-checks eligibility
(S-08).

## The two pages

| Page | Permission | Who gets it |
|---|---|---|
| `/approvals` | `can_review` | whichever roles hold `can_read` on `ChangeRequest`, re-asserted on each boot |
| `/change-review-settings` | `can_configure_review` | Admin |

The inbox is widened on purpose: authors need it too, so everyone in the
workflow can open it. To take it off a role, revoke `can_read` on
`ChangeRequest` from that role.

Whether review is on for the instance is an administrator's question, so the
settings page declares a permission of its own. Declaring the same one as the
inbox meant it rode along on the same widening and reached every role in the
workflow.

Both pages also declare `featureFlag: CHANGE_MANAGEMENT`. With the flag off
the page does not exist: the host answers 404 and leaves it out of the menu,
for an administrator as much as anyone else (QA-23).

## What is not reviewed

A write reaches the gate and is let through again in three cases.

**Changes SOW 5.2 exempts**: the editors, viewers and owners lists, tags,
the description, and the certification. None of them alters what a viewer
sees on the asset. The editors list matters most: SOW 5.4 tells an author
with no eligible approver to add another editor so they can submit, and
gating that edit would mean needing an approver in order to get one.

The exemption is per write, not per field, and it is measured against the
live asset rather than against which keys the body carries. A properties
dialog posts every field it shows, so editing only the editors list still
arrives with the title alongside; what counts is which of them actually
differ. A payload carrying an exempt change *and* a governed one is
governed.

Certification is one rule with two homes. A chart and a dashboard keep it
in columns of their own; a dataset keeps it inside `extra`, so a change
there is exempt when certification is the only entry in the blob that
moved. Anything else in `extra`, `warning_markdown` included, is governed.

**A save that changes nothing.** Re-saving an untouched asset used to
create a request and lock the asset behind an empty diff, both paid for a
write that was going to be a no-op anyway (129076). The comparison is by
meaning rather than by spelling, since Superset round-trips `params`,
`json_metadata`, `position_json` and `extra` through `json.dumps` and a
re-save produces a byte-different string with the same content.

The dashboard's native-filter and chart-customization endpoints post a
diff of the configuration rather than the configuration itself, so they
are measured differently: a diff that asks for nothing the stored
configuration does not already say is let through. Opening the filter
modal and pressing Save posts every filter back as modified whether or not
one was touched, so without this each such save locked the dashboard
(R4-08).

**A save that undoes your own draft.** A save leaving the asset exactly as
it is, made by the author of the asset's open request, closes that request:
what it says is that the draft now proposes nothing. Without it the author
was answered 200 and told nothing while their draft went on proposing the
text they believed they had reverted, and an approver could still publish
it (R4-01). Only their own request, and only one the asset's main update
replays -- a native-filter or colours draft describes an operation that
body cannot speak for. A partial revert still differs from the live asset,
so it folds into the draft as any other edit does.

## Imports

An import that would overwrite a governed asset is refused rather than held
for review. Capturing one means storing the uploaded archive somewhere and
replaying it on approval, and the `change_requests` table is not that place,
so refusing is the honest behaviour until it exists. It is a departure from
"each overwritten asset gets its own request" (Visa Q12) and deliberately a
loud one.

The refusal is scoped to the collisions a bundle really has. Its uuids are
looked up, and only an asset the import would actually replace produces a
refusal, which is named after what was found. A bundle of entirely new assets
creates nothing a viewer can already see, so V1 does not gate it (SOW 8) --
including `superset import-dashboards`, whose CLI hardcodes `overwrite=True`
and so could not reach an empty instance at all before (S-06).

For a single-kind importer that is the assets under its own prefix.
`overwrite_all` widens it to the bundled charts, datasets and databases,
which is the importer's own rule: those are replaced only when both flags
are set.
