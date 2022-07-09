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
"""security converge logs

Revision ID: 4b84f97828aa
Revises: 45731db65d9c
Create Date: 2020-12-14 13:40:46.492449

"""

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

revision = "4b84f97828aa"
down_revision = "45731db65d9c"

NEW_PVMS = {
    "Log": (
        "can_read",
        "can_write",
    )
}
PVM_MAP = {
    Pvm("LogModelView", "can_show"): (Pvm("Log", "can_read"),),
    Pvm(
        "LogModelView",
        "can_add",
    ): (Pvm("Log", "can_write"),),
    Pvm("LogModelView", "can_list"): (Pvm("Log", "can_read"),),
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
        print(f"An error occurred while upgrading Logs permissions: {ex}")
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
        print(f"An error occurred while downgrading Logs permissions: {ex}")
        session.rollback()
    pass
