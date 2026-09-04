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
"""retire stale can_views / can_connections PVMs on the SemanticLayer view menu

The ``views`` (POST ``/<uuid>/views``) and ``connections`` (GET
``/connections/``) methods on ``SemanticLayerRestApi`` are mapped to
``can_read`` in ``method_permission_name``. Earlier builds left those methods
unmapped, so Flask-AppBuilder derived ``can_views`` and ``can_connections``
permission-view-menus (PVMs) on the ``SemanticLayer`` view menu. Current code
can no longer create them, and once ``SemanticLayer`` joined
``READ_ONLY_MODEL_VIEWS`` those two permissions would have been withheld from
everyone but Admin anyway.

This migration migrates any role holding the stale PVMs onto the live
``can_read`` PVM, then removes the stale rows. ``add_pvms`` runs first so
``can_read`` exists as a ``migrate_roles`` target. On a clean install (or one
where the default-off ``SEMANTIC_LAYERS`` flag was never enabled, so the API
was never registered and the stale PVMs never existed) ``migrate_roles`` is a
no-op — the old PVMs resolve to ``None`` and no role is rewritten — but the
migration as a whole is not: ``add_pvms`` still seeds the ``SemanticLayer``
view menu and its ``can_read`` PVM, which ``sync_role_definitions`` then grants
to Gamma. That is benign rather than a no-op: the endpoints 404 while the flag
is off, but a fresh install does gain those rows. It is safe to run everywhere;
guarding the calls on the stale PVMs actually being present would make it a
literal no-op there, at the cost of the unconditional seed.

Revision ID: b3e9c1a75d24
Revises: 8f31c5d726ab
Create Date: 2026-09-03 00:00:00.000000

"""

# revision identifiers, used by Alembic.
revision = "b3e9c1a75d24"
down_revision = "8f31c5d726ab"

from alembic import op  # noqa: E402
from sqlalchemy.exc import SQLAlchemyError  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from superset.migrations.shared.security_converge import (  # noqa: E402
    add_pvms,
    migrate_roles,
    Pvm,
)

VIEW_MENU = "SemanticLayer"

# The live permission the two read endpoints use. Ensure it exists before
# reassigning roles to it so the lookup in ``migrate_roles`` cannot resolve to
# ``None`` (FAB normally creates it on startup once the API is registered).
NEW_PVMS = {VIEW_MENU: ("can_read",)}

# Map each stale PVM to the live ``can_read``. ``migrate_roles`` will, for every
# role holding a stale PVM: add ``can_read`` (if missing), remove the stale PVM,
# then delete the stale PVM row. The stale permission rows and the view menu are
# only deleted by the helper if they become orphans afterwards.
PVM_MAP = {
    Pvm(VIEW_MENU, "can_views"): (Pvm(VIEW_MENU, "can_read"),),
    Pvm(VIEW_MENU, "can_connections"): (Pvm(VIEW_MENU, "can_read"),),
}


def do_upgrade(session: Session) -> None:
    add_pvms(session, NEW_PVMS)
    migrate_roles(session, PVM_MAP)


def do_downgrade(session: Session) -> None:
    """Intentionally a no-op.

    The upgrade only removes stale duplicate PVMs that current code can no
    longer create and leaves ``can_read`` untouched, so there is no prior
    state worth restoring; recreating ``can_views`` / ``can_connections``
    would just reintroduce orphaned permissions.
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
