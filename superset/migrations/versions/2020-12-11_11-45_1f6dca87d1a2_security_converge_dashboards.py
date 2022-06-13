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
"""security converge dashboards

Revision ID: 1f6dca87d1a2
Revises: 4b84f97828aa
Create Date: 2020-12-11 11:45:25.051084

"""

# revision identifiers, used by Alembic.
revision = "1f6dca87d1a2"
down_revision = "4b84f97828aa"


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

NEW_PVMS = {
    "Dashboard": (
        "can_read",
        "can_write",
    )
}
PVM_MAP = {
    Pvm("DashboardModelView", "can_add"): (Pvm("Dashboard", "can_write"),),
    Pvm("DashboardModelView", "can_delete"): (Pvm("Dashboard", "can_write"),),
    Pvm(
        "DashboardModelView",
        "can_download_dashboards",
    ): (Pvm("Dashboard", "can_read"),),
    Pvm(
        "DashboardModelView",
        "can_edit",
    ): (Pvm("Dashboard", "can_write"),),
    Pvm(
        "DashboardModelView",
        "can_favorite_status",
    ): (Pvm("Dashboard", "can_read"),),
    Pvm(
        "DashboardModelView",
        "can_list",
    ): (Pvm("Dashboard", "can_read"),),
    Pvm(
        "DashboardModelView",
        "can_mulexport",
    ): (Pvm("Dashboard", "can_read"),),
    Pvm(
        "DashboardModelView",
        "can_show",
    ): (Pvm("Dashboard", "can_read"),),
    Pvm(
        "DashboardModelView",
        "muldelete",
    ): (Pvm("Dashboard", "can_write"),),
    Pvm(
        "DashboardModelView",
        "mulexport",
    ): (Pvm("Dashboard", "can_read"),),
    Pvm(
        "DashboardModelViewAsync",
        "can_list",
    ): (Pvm("Dashboard", "can_read"),),
    Pvm(
        "DashboardModelViewAsync",
        "muldelete",
    ): (Pvm("Dashboard", "can_write"),),
    Pvm(
        "DashboardModelViewAsync",
        "mulexport",
    ): (Pvm("Dashboard", "can_read"),),
    Pvm(
        "Dashboard",
        "can_new",
    ): (Pvm("Dashboard", "can_write"),),
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
