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
"""Add relationship between RLS filters and groups

Revision ID: 19631c6eb7fc
Revises: 94e7a3499973
Create Date: 2025-03-13 16:26:20.944441

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "19631c6eb7fc"
down_revision = "94e7a3499973"


def upgrade():
    op.create_table(
        "rls_filter_groups",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "rls_filter_id",
            sa.Integer(),
            sa.ForeignKey(
                "row_level_security_filters.id",
                name="rls_filter_groups_rls_filter_id_fkey",
            ),
            nullable=False,
        ),
        sa.Column(
            "group_id",
            sa.Integer(),
            sa.ForeignKey("ab_group.id", name="rls_filter_groups_group_id_fkey"),
            nullable=False,
        ),
        sa.UniqueConstraint("group_id", "rls_filter_id", name="uq_rls_filter_group"),
    )


def downgrade():
    # Remove constraints explicitly to avoid issues when dropping the table
    with op.batch_alter_table("rls_filter_groups") as batch_op:
        batch_op.drop_constraint("uq_rls_filter_group", type_="unique")
        batch_op.drop_constraint(
            "rls_filter_groups_rls_filter_id_fkey", type_="foreignkey"
        )
        batch_op.drop_constraint("rls_filter_groups_group_id_fkey", type_="foreignkey")
    op.drop_table("rls_filter_groups")
