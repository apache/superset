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
"""fix Security view menu case

Revision ID: b4a3f2e1d0c9
Revises: 9e1f3b8c4d2a
Create Date: 2026-05-29 00:00:00.000000

On MySQL with the default case-insensitive collation, five Superset views that
declare ``class_permission_name = "security"`` (lowercase) cause FAB to look up
or insert a view-menu entry named ``"security"``.  MySQL's case-insensitive
``UNIQUE`` constraint means the lookup finds an existing ``"Security"`` row and
uses it, OR a fresh install stores ``"security"`` because that view is
registered before the FAB built-in views register ``"Security"``.

Python string comparisons in ``sync_role_definitions`` and the menu-hiding
logic are case-sensitive, so an all-lowercase ``"security"`` row breaks the
Security menu for MySQL (and MariaDB) deployments.

This migration normalises the row:
* If only the lowercase ``"security"`` row exists: rename it to ``"Security"``.
* If both rows exist (SQLite / PostgreSQL fresh-install with the old code):
  reassign every ``ab_permission_view`` from the lowercase row to the
  correctly-cased row, then delete the duplicate.
"""

# revision identifiers, used by Alembic.
revision = "b4a3f2e1d0c9"
down_revision = "9e1f3b8c4d2a"

import logging  # noqa: E402

from alembic import op  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from superset.migrations.shared.security_converge import (  # noqa: E402
    PermissionView,
    ViewMenu,
)

logger = logging.getLogger("alembic.env")


def do_upgrade(session: Session) -> None:
    # Fetch all view menus and compare in Python (SQL filter_by is
    # case-insensitive on MySQL, so we cannot rely on it here).
    all_vms: list[ViewMenu] = session.query(ViewMenu).all()
    security_upper = next((vm for vm in all_vms if vm.name == "Security"), None)
    security_lower = next((vm for vm in all_vms if vm.name == "security"), None)

    if security_lower is None:
        logger.info("No lowercase 'security' view-menu found; nothing to do.")
        return

    if security_upper is None:
        # Simple rename — only the incorrect row exists.
        logger.info(
            "Renaming ab_view_menu 'security' -> 'Security' (id=%d)",
            security_lower.id,
        )
        security_lower.name = "Security"
        session.flush()
    else:
        # Both rows exist.  Re-home every permission_view from the lowercase
        # entry to the correctly-cased entry, then drop the duplicate.
        logger.info(
            "Both 'security' (id=%d) and 'Security' (id=%d) found; merging.",
            security_lower.id,
            security_upper.id,
        )
        pvms_lower: list[PermissionView] = (
            session.query(PermissionView)
            .filter(PermissionView.view_menu_id == security_lower.id)
            .all()
        )
        for pvm in pvms_lower:
            upper_pvm = (
                session.query(PermissionView)
                .filter(
                    PermissionView.view_menu_id == security_upper.id,
                    PermissionView.permission_id == pvm.permission_id,
                )
                .one_or_none()
            )
            if upper_pvm:
                # Transfer role bindings from the duplicate row to the
                # surviving row before discarding the duplicate, so no
                # role silently loses a permission.
                for role in list(pvm.role):
                    if upper_pvm not in role.permissions:
                        role.permissions.append(upper_pvm)
                session.flush()
                session.delete(pvm)
            else:
                pvm.view_menu_id = security_upper.id
        session.flush()
        session.delete(security_lower)

    session.commit()


def upgrade() -> None:
    bind = op.get_bind()
    session = Session(bind=bind)
    do_upgrade(session)


def downgrade() -> None:
    # There is no safe way to determine the original state (whether the row was
    # lowercase or whether there were two rows), so downgrade is a no-op.
    pass
