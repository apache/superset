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
"""clean up stale can_import permission on ImportExportRestApi

The role-edit screen shows "can import on ImportExportRestApi" twice. Only one
of those is real: the live permission is ``can_import_`` (note the trailing
underscore), derived from the ``import_`` method on ``ImportExportRestApi``.
The visual duplicate is a stale ``can_import`` (no trailing underscore)
permission-view-menu (PVM) for the ``ImportExportRestApi`` view menu, left over
from an older Superset/FAB era and persisted across upgrades. FAB renders
``can_import_`` as "can import " and ``can_import`` as "can import", which look
identical in the UI.

Current code can no longer create the stale row, so this migration removes it.
Before deleting, any role that holds the stale PVM is given the live
``can_import_`` PVM so no role silently loses import access.

This is scoped to the ``ImportExportRestApi`` view menu ONLY. It does not touch
the ``can_import`` permission name globally; ``migrate_roles`` only deletes the
``can_import`` permission row if it has become a true orphan (no remaining
PVMs reference it).

Revision ID: a7d3f1b9c2e4
Revises: 78a40c08b4be
Create Date: 2026-06-23 03:23:55.000000

"""

# revision identifiers, used by Alembic.
revision = "a7d3f1b9c2e4"
down_revision = "78a40c08b4be"

from alembic import op  # noqa: E402
from sqlalchemy.exc import SQLAlchemyError  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from superset.migrations.shared.security_converge import (  # noqa: E402
    add_pvms,
    migrate_roles,
    Pvm,
)

VIEW_MENU = "ImportExportRestApi"

# The live permission that should exist for the import endpoint. We ensure it is
# present (it normally is, created on startup by FAB) before reassigning roles to
# it, so the lookup in ``migrate_roles`` cannot resolve to ``None``.
NEW_PVMS = {VIEW_MENU: ("can_import_",)}

# Map the stale PVM (``can_import`` with NO trailing underscore) to the live one
# (``can_import_``). ``migrate_roles`` will, for every role holding the stale
# PVM: add the live PVM (if missing), remove the stale PVM, then delete the
# stale PVM row. The stale ``can_import`` permission row and the view menu are
# only deleted by the helper if they become orphans afterwards.
PVM_MAP = {
    Pvm(VIEW_MENU, "can_import"): (Pvm(VIEW_MENU, "can_import_"),),
}


def do_upgrade(session: Session) -> None:
    """Ensure the live ``can_import_`` PVM exists and migrate any role holding the
    stale ``can_import`` PVM onto it before the stale row is removed."""
    # Guarantee the live PVM exists before we point roles at it. ``add_pvms`` is
    # idempotent: it only creates rows that are missing.
    add_pvms(session, NEW_PVMS)
    # On a clean install the stale PVM does not exist; ``migrate_roles`` resolves
    # the old PVM to ``None`` and becomes a no-op, so this is safe to run
    # everywhere.
    migrate_roles(session, PVM_MAP)


def do_downgrade(session: Session) -> None:
    """Intentionally a no-op: the upgrade only removes a stale duplicate PVM and
    leaves the live ``can_import_`` permission untouched, so there is no prior
    state worth restoring (recreating the stale row would just reintroduce the
    duplicate)."""
    # No-op by design. Recreating the stale ``can_import`` PVM and moving roles
    # back onto it would reintroduce the very duplicate permission this
    # migration removes (and the orphaned row serves no purpose). The live
    # ``can_import_`` permission is unaffected by the upgrade, so there is
    # nothing meaningful to restore.
    pass


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
