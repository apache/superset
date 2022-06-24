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
"""security converge css templates

Revision ID: 8ee129739cf9
Revises: e38177dbf641
Create Date: 2020-11-30 17:54:09.118630

"""

# revision identifiers, used by Alembic.
revision = "8ee129739cf9"
down_revision = "e38177dbf641"


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
    "CssTemplate": (
        "can_read",
        "can_write",
    )
}
PVM_MAP = {
    Pvm("CssTemplateModelView", "can_list"): (Pvm("CssTemplate", "can_read"),),
    Pvm("CssTemplateModelView", "can_show"): (Pvm("CssTemplate", "can_read"),),
    Pvm(
        "CssTemplateModelView",
        "can_add",
    ): (Pvm("CssTemplate", "can_write"),),
    Pvm(
        "CssTemplateModelView",
        "can_edit",
    ): (Pvm("CssTemplate", "can_write"),),
    Pvm(
        "CssTemplateModelView",
        "can_delete",
    ): (Pvm("CssTemplate", "can_write"),),
    Pvm(
        "CssTemplateModelView",
        "muldelete",
    ): (Pvm("CssTemplate", "can_write"),),
    Pvm(
        "CssTemplateAsyncModelView",
        "can_list",
    ): (Pvm("CssTemplate", "can_read"),),
    Pvm(
        "CssTemplateAsyncModelView",
        "muldelete",
    ): (Pvm("CssTemplate", "can_write"),),
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
