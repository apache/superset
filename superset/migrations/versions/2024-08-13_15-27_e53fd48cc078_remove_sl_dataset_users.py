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
"""remove sl_dataset_users

Revision ID: e53fd48cc078
Revises: 38f4144e8558
Create Date: 2024-08-13 15:27:11.589886

"""

import sqlalchemy as sa
from alembic import op

from superset.migrations.shared.constraints import drop_fks_for_table

# revision identifiers, used by Alembic.
revision = "e53fd48cc078"
down_revision = "38f4144e8558"


def upgrade():
    connection = op.get_bind()
    if connection.dialect.name != "sqlite":
        drop_fks_for_table("sl_dataset_users")
    op.drop_table("sl_dataset_users")


def downgrade():
    op.create_table(
        "sl_dataset_users",
        sa.Column("dataset_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["dataset_id"],
            ["sl_datasets.id"],
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["ab_user.id"],
        ),
        sa.PrimaryKeyConstraint("dataset_id", "user_id"),
    )
