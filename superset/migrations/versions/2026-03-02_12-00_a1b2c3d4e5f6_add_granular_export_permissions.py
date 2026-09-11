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
from sqlalchemy.orm import Session  # noqa: E402

from superset.migrations.shared.security_converge import (  # noqa: E402
    add_pvms,
    get_reversed_new_pvms,
    get_reversed_pvm_map,
    migrate_roles,
    Pvm,
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
    add_pvms(session, NEW_PVMS)
    migrate_roles(session, PVM_MAP)


def do_downgrade(session: Session) -> None:
    add_pvms(session, get_reversed_new_pvms(PVM_MAP))
    migrate_roles(session, get_reversed_pvm_map(PVM_MAP))


def upgrade():
    bind = op.get_bind()
    session = Session(bind=bind)
    do_upgrade(session)


def downgrade():
    bind = op.get_bind()
    session = Session(bind=bind)
    do_downgrade(session)
