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
"""add_last_saved_at_to_slice_model

Revision ID: 6d20ba9ecb33
Revises: 'f6196627326f'
Create Date: 2021-08-02 21:14:58.200438

"""

# revision identifiers, used by Alembic.
revision = "6d20ba9ecb33"
down_revision = "f6196627326f"

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


def upgrade():
    with op.batch_alter_table("slices") as batch_op:
        batch_op.add_column(sa.Column("last_saved_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("last_saved_by_fk", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "slices_last_saved_by_fk", "ab_user", ["last_saved_by_fk"], ["id"]
        )

    # now do data migration, copy values from changed_on and changed_by
    slices_table = sa.Table(
        "slices",
        sa.MetaData(),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.Column("last_saved_at", sa.DateTime(), nullable=True),
        sa.Column("last_saved_by_fk", sa.Integer(), nullable=True),
    )
    conn = op.get_bind()
    conn.execute(
        slices_table.update().values(
            last_saved_at=slices_table.c.changed_on,
            last_saved_by_fk=slices_table.c.changed_by_fk,
        )
    )
    # ### end Alembic commands ###


def downgrade():
    with op.batch_alter_table("slices") as batch_op:
        batch_op.drop_constraint("slices_last_saved_by_fk", type_="foreignkey")
        batch_op.drop_column("last_saved_by_fk")
        batch_op.drop_column("last_saved_at")
    # ### end Alembic commands ###
