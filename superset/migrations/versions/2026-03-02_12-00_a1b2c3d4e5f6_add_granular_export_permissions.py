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
"""add granular export permissions

Revision ID: a1b2c3d4e5f6
Revises: 4b2a8c9d3e1f
Create Date: 2026-03-02 12:00:00.000000

"""

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "4b2a8c9d3e1f"

from alembic import op  # noqa: E402
from sqlalchemy.exc import SQLAlchemyError  # noqa: E402
from sqlalchemy.orm import Load, Session  # noqa: E402

from superset.migrations.shared.security_converge import (  # noqa: E402
    _delete_old_permissions,
    _find_pvm,
    add_pvms,
    get_reversed_new_pvms,
    get_reversed_pvm_map,
    logger,
    migrate_roles,
    Pvm,
    Role,
)

NEW_PVMS = {
    "Superset": (
        "can_export_data",
        "can_export_image",
        "can_copy_clipboard",
    )
}

PVM_MAP = {
    Pvm("Superset", "can_csv"): (
        Pvm("Superset", "can_export_data"),
        Pvm("Superset", "can_export_image"),
        Pvm("Superset", "can_copy_clipboard"),
    ),
}


def do_upgrade(session: Session) -> None:
    """
    Replace ``can_csv`` with the granular export permissions on every role.

    ``superset init`` recreates ``can_csv`` after this has run, so the
    revision can meet a database it has already converted (e.g. when
    ``alembic_version`` is stamped back to its parent). A re-run leaves any
    role that already holds a granular export permission as it is, still
    converts roles that hold only ``can_csv``, and deletes ``can_csv`` only
    once no role holds it.
    """
    add_pvms(session, NEW_PVMS)
    (old_pvm_key, new_pvm_keys), *_ = PVM_MAP.items()
    old_pvm = _find_pvm(session, old_pvm_key.view, old_pvm_key.permission)
    if old_pvm is None:
        return
    new_pvms = [_find_pvm(session, key.view, key.permission) for key in new_pvm_keys]

    roles = session.query(Role).options(Load(Role).joinedload(Role.permissions)).all()
    for role in roles:
        if old_pvm not in role.permissions:
            continue
        if any(new_pvm in role.permissions for new_pvm in new_pvms):
            logger.info("Keeping %s on %s: granular perms already set", old_pvm, role)
            continue
        logger.info("Replacing %s with %s on %s", old_pvm, new_pvms, role)
        role.permissions.remove(old_pvm)
        role.permissions.extend(new_pvms)

    if not any(old_pvm in role.permissions for role in roles):
        _delete_old_permissions(session, {old_pvm: new_pvms})


def do_downgrade(session: Session) -> None:
    add_pvms(session, get_reversed_new_pvms(PVM_MAP))
    migrate_roles(session, get_reversed_pvm_map(PVM_MAP))


def upgrade():
    bind = op.get_bind()
    session = Session(bind=bind)
    do_upgrade(session)
    try:
        session.commit()
    except SQLAlchemyError as ex:
        session.rollback()
        raise Exception(f"An error occurred while upgrading permissions: {ex}") from ex


def downgrade():
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
