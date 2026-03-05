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
"""add_user_auth_tokens

Revision ID: a1b2c3d4e5f6
Revises: f5b5f88d8526
Create Date: 2026-03-05 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

from superset.migrations.shared.utils import add_column_if_not_exists

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "f5b5f88d8526"


def upgrade() -> None:
    op.create_table(
        "user_auth_tokens",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("ab_user.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("provider", sa.String(256), nullable=False),
        sa.Column("access_token", sa.Text, nullable=True),
        sa.Column("access_token_expiration", sa.DateTime, nullable=True),
        sa.Column("refresh_token", sa.Text, nullable=True),
        sa.Column("created_on", sa.DateTime, nullable=True),
        sa.Column("changed_on", sa.DateTime, nullable=True),
        sa.Column("created_by_fk", sa.Integer, nullable=True),
        sa.Column("changed_by_fk", sa.Integer, nullable=True),
    )
    op.create_index(
        "idx_user_auth_tokens_user_provider",
        "user_auth_tokens",
        ["user_id", "provider"],
    )


def downgrade() -> None:
    op.drop_index("idx_user_auth_tokens_user_provider", table_name="user_auth_tokens")
    op.drop_table("user_auth_tokens")
