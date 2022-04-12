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
"""add_on_saved_query_delete_tab_state_null_constraint"

Revision ID: 58df9d617f14
Revises: 6766938c6065
Create Date: 2022-03-16 23:24:40.278937

"""

# revision identifiers, used by Alembic.
revision = "58df9d617f14"
down_revision = "6766938c6065"

import sqlalchemy as sa
from alembic import op

from superset.utils.core import generic_find_fk_constraint_name


def upgrade():
    bind = op.get_bind()
    insp = sa.engine.reflection.Inspector.from_engine(bind)

    with op.batch_alter_table("tab_state") as batch_op:
        batch_op.drop_constraint(
            generic_find_fk_constraint_name("tab_state", {"id"}, "saved_query", insp),
            type_="foreignkey",
        )

        batch_op.create_foreign_key(
            "saved_query_id",
            "saved_query",
            ["saved_query_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade():
    bind = op.get_bind()
    insp = sa.engine.reflection.Inspector.from_engine(bind)

    with op.batch_alter_table("tab_state") as batch_op:
        batch_op.drop_constraint(
            generic_find_fk_constraint_name("tab_state", {"id"}, "saved_query", insp),
            type_="foreignkey",
        )

        batch_op.create_foreign_key(
            "saved_query_id",
            "saved_query",
            ["saved_query_id"],
            ["id"],
        )
