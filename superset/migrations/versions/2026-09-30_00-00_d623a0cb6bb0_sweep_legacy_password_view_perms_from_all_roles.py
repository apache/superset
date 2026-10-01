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
"""sweep legacy password-view permissions from all roles (#44626 follow-up)

#44626 removed the legacy FAB server-rendered password reset views
(``ResetPasswordView``, ``ResetMyPasswordView``) and hid the
``UserDBModelView`` actions that redirected to them (``resetpasswords``,
``resetmypassword``). ``SupersetSecurityManager.sync_role_definitions`` was
updated to stop handing their permissions to the built-in Admin/Alpha/Gamma/
sql_lab roles on ``superset init``, but that exclusion only applies to the
pvms list those four roles are resynced from -- it never touches a role that
already held one of these permissions before upgrading, since Superset never
re-syncs operator-defined (custom) roles. An upgraded install's custom role
that was explicitly granted self-service or admin password reset therefore
keeps the dead permission forever, contradicting UPDATING.md's "no role"
claim for that release.

The permissions are already fully inert on every upgraded install regardless
of which role holds them: the views are never registered (so the routes
404/anything routing there raises ``BuildError``), and the ``UserDBModelView``
actions are hidden and wired to a handler that also answers 404. This
migration is therefore pure metadata cleanup with no behavior change -- it
deletes the stale (view, permission) pairs from every role that holds them
(not just the four synced built-ins), plus the underlying ``ab_permission``/
``ab_view_menu`` rows once orphaned.

Revision ID: d623a0cb6bb0
Revises: 95d8a99c822e
Create Date: 2026-09-30 00:00:00.000000

"""

# revision identifiers, used by Alembic.
revision = "d623a0cb6bb0"
down_revision = "95d8a99c822e"

from alembic import op  # noqa: E402
from sqlalchemy.exc import SQLAlchemyError  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from superset.migrations.shared.security_converge import (  # noqa: E402
    delete_pvms,
    Pvm,
)

# The legacy password-reset views' own form-submission permissions, plus the
# UserDBModelView actions that redirected to them. See
# ``superset.security.manager.LEGACY_PASSWORD_VIEWS`` /
# ``LEGACY_PASSWORD_LAUNCHERS`` for the code-side registration that these
# mirror.
PVM_LIST = (
    Pvm("ResetPasswordView", "can_this_form_get"),
    Pvm("ResetPasswordView", "can_this_form_post"),
    Pvm("ResetMyPasswordView", "can_this_form_get"),
    Pvm("ResetMyPasswordView", "can_this_form_post"),
    Pvm("UserDBModelView", "resetpasswords"),
    Pvm("UserDBModelView", "resetmypassword"),
)


def do_upgrade(session: Session) -> None:
    """Delete every PVM in ``PVM_LIST`` from every role that holds it. On a
    clean install, or one already cleaned up, the PVMs simply don't resolve
    and are skipped -- safe to run everywhere."""
    delete_pvms(session, PVM_LIST)


def do_downgrade(session: Session) -> None:
    """Intentionally a no-op.

    These permissions were deleted because the views/actions they gated are
    never registered in current code, so current code can never create them
    again on its own. Recreating the bare PVM rows here would just
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
