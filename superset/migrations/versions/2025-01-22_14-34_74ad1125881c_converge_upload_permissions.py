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
"""converge_upload_permissions

Revision ID: 74ad1125881c
Revises: d482d51c15ca
Create Date: 2025-01-22 14:34:25.610084

"""

# revision identifiers, used by Alembic.
revision = "74ad1125881c"
down_revision = "d482d51c15ca"

from alembic import op  # noqa: E402
from sqlalchemy.exc import SQLAlchemyError  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from superset.migrations.shared.security_converge import (  # noqa: E402
    add_pvms,
    get_reversed_new_pvms,
    get_reversed_pvm_map,
    migrate_roles,
    Pvm,
)

NEW_PVMS = {"Database": ("can_upload",)}

PVM_MAP = {
    Pvm("Database", "can_csv_upload"): (Pvm("Database", "can_upload"),),
    Pvm("Database", "can_excel_upload"): (Pvm("Database", "can_upload"),),
    Pvm("Database", "can_columnar_upload"): (Pvm("Database", "can_upload"),),
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
        print(f"An error occurred while downgrading permissions: {ex}")
        session.rollback()
    pass
