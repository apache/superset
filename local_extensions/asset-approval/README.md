# Asset approval

Maker-checker review for dashboards, charts and datasets. A change to a
governed asset does not reach viewers until a second eligible editor
approves it.

Turn it on with the `CHANGE_MANAGEMENT` feature flag. With the flag off the
extension installs nothing: no gate, no banner, no bell, no Approvals entry,
and Superset behaves as upstream.

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
3. **The approval permission**, `can_approve` on `ChangeRequest`.

The account itself also has to be one a person uses. It must be **active**,
and it must not be a **service account**.

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

### How the approval right is identified

The right is a FAB permission like any other, created from the REST API's
route mapping: `approve` and `request_changes` carry `can_approve`, while
`submit`, `withdraw` and `discard` stay on `can_write`. Before that split,
one permission covered all five, so an operator could not say who may
approve without also saying who may submit (S-05).

FAB permissions are rows, not schema, so nothing here needs a migration. The
permission appears after the next `superset init`.

**Default.** `superset init`'s role sync grants `can_approve` to Admin, Alpha
and Gamma, which is exactly the set that already held `can_write` on
`ChangeRequest`. An instance that configures nothing therefore keeps the
approval rights it already had.

**Naming the roles.** Set `ASSET_APPROVAL_APPROVER_ROLES` in
`superset_config.py` to a list of role names:

```python
ASSET_APPROVAL_APPROVER_ROLES = ["Admin", "Reviewers"]
```

On every boot the extension grants `can_approve` to those roles and takes it
back off the **builtin** roles that are not listed (Admin, Alpha, Gamma,
sql_lab, Public). Roles an operator created are left alone, including ones
holding the right: a grant they made deliberately is theirs.

It runs on every boot rather than once because `superset init` rebuilds the
builtin roles from the security manager's denylist. Without the re-assertion
a revoke would be handed straight back the next time an operator ran it.

Leave the setting unset, or set it to `None`, and nothing is touched.

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
