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
"""Add database/user token table

Revision ID: aeadd0fd0f92
Revises: 4ce1d9b25135
Create Date: 2022-06-03 17:01:56.443838

"""

# revision identifiers, used by Alembic.
revision = "aeadd0fd0f92"
down_revision = "4ce1d9b25135"

import sqlalchemy as sa
from alembic import op
from sqlalchemy_utils import EncryptedType


def upgrade():
    op.create_table(
        "database_user_oauth2_tokens",
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("database_id", sa.Integer(), nullable=False),
        sa.Column(
            "access_token",
            EncryptedType(),
            nullable=True,
        ),
        sa.Column("access_token_expiration", sa.DateTime(), nullable=True),
        sa.Column(
            "refresh_token",
            EncryptedType(),
            nullable=True,
        ),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["changed_by_fk"],
            ["ab_user.id"],
        ),
        sa.ForeignKeyConstraint(
            ["created_by_fk"],
            ["ab_user.id"],
        ),
        sa.ForeignKeyConstraint(
            ["database_id"],
            ["dbs.id"],
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["ab_user.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade():
    op.drop_table("database_user_oauth2_tokens")
