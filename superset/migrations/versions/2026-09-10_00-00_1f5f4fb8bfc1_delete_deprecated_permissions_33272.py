# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""delete deprecated permissions with no successor (#33272)

``superset init`` -> ``sync_role_definitions`` creates missing permissions and
runs ``clean_perms``, but ``clean_perms`` only deletes ``PermissionView`` rows
with a NULL ``Permission``/``ViewMenu`` foreign key -- it never removes
well-formed PVMs whose underlying endpoint/method has since been removed from
the codebase. Permissions deprecated across past releases (mostly on the
``Superset`` monolithic view) therefore persist forever across upgrades
(apache/superset#33272).

Each permission in ``PVM_LIST`` below was individually confirmed to have no
successor worth auto-granting: either the endpoint/method was deleted outright
with no live equivalent, or its nominal successor is a generic ``can_write``
on a ``ModelRestApi`` resource that would hand a role a materially broader,
largely unrelated capability instance-wide, rather than the one narrow action
the dead permission ever represented. See the grouped comment above
``PVM_LIST`` for the evidence and reasoning behind each entry.

Renames with a verified, proportionate live successor (e.g. ``can_explore_json``
-> ``can_read`` on ``Chart``) are handled separately in the next migration via
``migrate_roles``, so role assignments are preserved for those. This migration
only targets the explicit ``(view_menu, permission)`` pairs in ``PVM_LIST`` --
never a name-based sweep -- so it structurally cannot touch the per-object
``database_access``/``datasource_access``/``schema_access``/``catalog_access``
permissions, which share names across many view menus.

Revision ID: 1f5f4fb8bfc1
Revises: 7e2c9a4f1b83
Create Date: 2026-09-10 00:00:00.000000

"""

# revision identifiers, used by Alembic.
revision = "1f5f4fb8bfc1"
down_revision = "7e2c9a4f1b83"

from alembic import op  # noqa: E402
from sqlalchemy.exc import SQLAlchemyError  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from superset.migrations.shared.security_converge import (  # noqa: E402
    delete_pvms,
    Pvm,
)

# Explicit (view_menu, permission) pairs to delete. Deliberately NOT a
# name-based sweep: every entry names both the view menu and the permission so
# this can never accidentally match one of the per-object
# database_access/datasource_access/schema_access/catalog_access permissions,
# which are reused across many view menus (one per Database/SqlaTable/schema/
# catalog).
#
# Removal evidence (all on the "Superset" view menu):
#   can_sync_druid_source -- PR #19770, no `@deprecated` decorator; the entire
#     native Druid connector (SIP-11/SIP-68) was deleted outright, so no
#     successor concept exists.
#   can_approve, can_request_access -- both PR #24266, `@deprecated()` with no
#     `new_target`; the whole access-request/approval workflow and its
#     backing model were deleted.
#   can_save_dash -- PR #24353, `@deprecated()` with no `new_target`.
#   can_profile -- PR #26462, explicit full feature removal (the Profile page
#     was deleted as unmaintained).
#   can_override_role_permissions -- PR #23714 added `@deprecated()` with no
#     `new_target` (the PR body states it was "not called from client side
#     code at all"); the endpoint itself was actually deleted later, in
#     PR #24266.
#   can_testconn, can_sqllab_viz, can_import_dashboards, can_add_slices --
#     each does have a technically-live `@deprecated(new_target=...)`
#     successor (Database/Dataset/Chart/Dashboard `can_write` respectively),
#     but that successor authorizes full create/edit/delete of the resource
#     instance-wide -- a materially broader, largely unrelated grant compared
#     to the one narrow action these dead permissions ever gated (testing a
#     connection; creating one dataset; importing one dashboard; appending
#     charts to a dashboard you already own). None of their removal PRs
#     (#24354, #24375, #24353) documented in UPDATING.md that operators
#     should re-grant a successor to custom roles, so deleting them now
#     strands no one who followed the docs -- whereas migrating them would
#     silently upgrade a long-dead grant into a live, broader one on any
#     upgraded install that never cleaned up the role. Deleted here instead.
#     (`can_copy_dash`, from the same PR #24353 batch, is the one exception:
#     its live successor, `Dashboard.can_write`, gates the exact same
#     dashboard-copy action today, not a broader unrelated one -- so it stays
#     a rename; see the next migration.)
PVM_LIST = (
    Pvm("Superset", "can_sync_druid_source"),
    Pvm("Superset", "can_approve"),
    Pvm("Superset", "can_request_access"),
    Pvm("Superset", "can_save_dash"),
    Pvm("Superset", "can_profile"),
    Pvm("Superset", "can_override_role_permissions"),
    Pvm("Superset", "can_testconn"),
    Pvm("Superset", "can_sqllab_viz"),
    Pvm("Superset", "can_import_dashboards"),
    Pvm("Superset", "can_add_slices"),
)


def do_upgrade(session: Session) -> None:
    """Delete every PVM in ``PVM_LIST``. On a clean install, or one already
    cleaned up, the PVMs simply don't resolve and are skipped -- safe to run
    everywhere."""
    delete_pvms(session, PVM_LIST)


def do_downgrade(session: Session) -> None:
    """Intentionally a no-op.

    These permissions were deleted because the endpoints/methods that used
    them no longer exist in current code, so current code can never create
    them again on its own. Recreating the bare PVM rows here would just
    reintroduce dead, unreachable permissions with no code path granting or
    checking them -- there is no meaningful prior state to restore.
    """


def upgrade() -> None:
    bind = op.get_bind()
    session = Session(bind=bind)
    do_upgrade(session)
    try:
        session.commit()
    except SQLAlchemyError as ex:
        session.rollback()
        raise Exception(f"An error occurred while upgrading permissions: {ex}") from ex


def downgrade() -> None:
    bind = op.get_bind()
    session = Session(bind=bind)
    do_downgrade(session)
    try:
        session.commit()
    except SQLAlchemyError as ex:
        session.rollback()
        raise Exception(
            f"An error occurred while downgrading permissions: {ex}"
        ) from ex
