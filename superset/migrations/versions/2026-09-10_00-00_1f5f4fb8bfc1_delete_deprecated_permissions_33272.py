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

An earlier draft of this migration put 25 permissions here, all assumed to be
pure deletions. Two follow-up investigation passes -- checking historical
``superset/views/core.py``, the actual ``gh pr diff`` for every cited removal
PR, and live ``MODEL_API_RW_METHOD_PERMISSION_MAP`` successors -- found most
of those 25 actually have a real, verifiable live successor, so treating them
as pure deletions would have silently dropped custom roles' grants with no
replacement. Those 19 entries were moved to the rename migration's
``PVM_MAP`` instead (see that file). Only the 6 entries below were confirmed
to have no successor at all -- their endpoint/method was deleted outright,
not renamed or consolidated.

Renames with a verified live successor (e.g. ``can_explore_json`` ->
``can_read`` on ``Chart``) are handled separately in the next migration via
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
#   can_save_dash -- PR #24353, `@deprecated()` with no `new_target` (its two
#     siblings from the same PR, `can_copy_dash`/`can_add_slices`, DO have
#     real successors and are now in the rename migration instead).
#   can_profile -- PR #26462, explicit full feature removal (the Profile page
#     was deleted as unmaintained).
#   can_override_role_permissions -- PR #23714, `@deprecated()` with no
#     `new_target`; the PR body states it was "not called from client side
#     code at all."
PVM_LIST = (
    Pvm("Superset", "can_sync_druid_source"),
    Pvm("Superset", "can_approve"),
    Pvm("Superset", "can_request_access"),
    Pvm("Superset", "can_save_dash"),
    Pvm("Superset", "can_profile"),
    Pvm("Superset", "can_override_role_permissions"),
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
