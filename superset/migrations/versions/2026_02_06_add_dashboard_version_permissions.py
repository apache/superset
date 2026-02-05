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
"""Add dashboard version history permissions (get/restore/update version)."""

from alembic import op
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from superset.migrations.shared.security_converge import (
    add_pvms,
    grant_pvms_to_roles_that_have,
    Pvm,
    revoke_pvms,
)

revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None

NEW_PVMS = {
    "Dashboard": (
        "can_get_versions",
        "can_restore_version",
        "can_update_version",
    )
}

# Grant new permissions to roles that already have can_read or can_write on Dashboard
GRANT_MAP = {
    Pvm("Dashboard", "can_read"): (Pvm("Dashboard", "can_get_versions"),),
    Pvm("Dashboard", "can_write"): (
        Pvm("Dashboard", "can_restore_version"),
        Pvm("Dashboard", "can_update_version"),
    ),
}


def upgrade() -> None:
    bind = op.get_bind()
    session = Session(bind=bind)
    add_pvms(session, NEW_PVMS)
    session.flush()
    grant_pvms_to_roles_that_have(session, GRANT_MAP)
    try:
        session.commit()
    except SQLAlchemyError as ex:
        session.rollback()
        raise Exception(f"An error occurred while upgrading permissions: {ex}") from ex


def downgrade() -> None:
    bind = op.get_bind()
    session = Session(bind=bind)
    revoke_pvms(session, NEW_PVMS)
    try:
        session.commit()
    except SQLAlchemyError as ex:
        session.rollback()
        raise Exception(
            f"An error occurred while downgrading permissions: {ex}"
        ) from ex
