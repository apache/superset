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
"""security converge databases

Revision ID: 42b4c9e01447
Revises: 5daced1f0e76
Create Date: 2020-12-14 10:49:36.110805

"""

# revision identifiers, used by Alembic.
revision = "42b4c9e01447"
down_revision = "1f6dca87d1a2"

import sqlalchemy as sa
from alembic import op
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from superset.migrations.shared.security_converge import (
    add_pvms,
    get_reversed_new_pvms,
    get_reversed_pvm_map,
    migrate_roles,
    Pvm,
)

NEW_PVMS = {"Database": ("can_read", "can_write",)}
PVM_MAP = {
    Pvm("DatabaseView", "can_add"): (Pvm("Database", "can_write"),),
    Pvm("DatabaseView", "can_delete"): (Pvm("Database", "can_write"),),
    Pvm("DatabaseView", "can_edit",): (Pvm("Database", "can_write"),),
    Pvm("DatabaseView", "can_list",): (Pvm("Database", "can_read"),),
    Pvm("DatabaseView", "can_mulexport",): (Pvm("Database", "can_read"),),
    Pvm("DatabaseView", "can_post",): (Pvm("Database", "can_write"),),
    Pvm("DatabaseView", "can_show",): (Pvm("Database", "can_read"),),
    Pvm("DatabaseView", "muldelete",): (Pvm("Database", "can_write"),),
    Pvm("DatabaseView", "yaml_export",): (Pvm("Database", "can_read"),),
}


def upgrade():
    bind = op.get_bind()
    session = Session(bind=bind)

    # Add the new permissions on the migration itself
    add_pvms(session, NEW_PVMS)
    migrate_roles(session, PVM_MAP)
    try:
        session.commit()
    except SQLAlchemyError as ex:
        print(f"An error occurred while upgrading permissions: {ex}")
        session.rollback()


def downgrade():
    bind = op.get_bind()
    session = Session(bind=bind)

    # Add the old permissions on the migration itself
    add_pvms(session, get_reversed_new_pvms(PVM_MAP))
    migrate_roles(session, get_reversed_pvm_map(PVM_MAP))
    try:
        session.commit()
    except SQLAlchemyError as ex:
        print(f"An error occurred while downgrading permissions: {ex}")
        session.rollback()
    pass
