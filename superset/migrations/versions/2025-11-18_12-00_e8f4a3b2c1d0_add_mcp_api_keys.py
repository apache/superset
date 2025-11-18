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
"""add mcp api keys

Revision ID: e8f4a3b2c1d0
Revises: x2s8ocx6rto6
Create Date: 2025-11-18 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "e8f4a3b2c1d0"
down_revision = "x2s8ocx6rto6"


def upgrade():
    """Create ab_api_key table for MCP service API key authentication."""
    op.create_table(
        "ab_api_key",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=256), nullable=False),
        sa.Column("key_hash", sa.String(length=128), nullable=False),
        sa.Column("key_prefix", sa.String(length=8), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("workspace_name", sa.String(length=256), nullable=False),
        sa.Column("created_on", sa.DateTime(), nullable=False),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("expires_on", sa.DateTime(), nullable=True),
        sa.Column("revoked_on", sa.DateTime(), nullable=True),
        sa.Column("revoked_by_fk", sa.Integer(), nullable=True),
        sa.Column("last_used_on", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["created_by_fk"], ["ab_user.id"]),
        sa.ForeignKeyConstraint(["revoked_by_fk"], ["ab_user.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["ab_user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create indexes
    with op.batch_alter_table("ab_api_key") as batch_op:
        batch_op.create_index("idx_api_key_hash", ["key_hash"], unique=True)
        batch_op.create_index("idx_api_key_user", ["user_id"], unique=False)
        batch_op.create_index(
            "idx_api_key_workspace", ["workspace_name"], unique=False
        )
        batch_op.create_index(
            "idx_api_key_workspace_user", ["workspace_name", "user_id"], unique=False
        )
        batch_op.create_index(
            "idx_api_key_active", ["revoked_on", "expires_on"], unique=False
        )


def downgrade():
    """Drop ab_api_key table."""
    op.drop_table("ab_api_key")
