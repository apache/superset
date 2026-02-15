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
"""add FAB api key table

Revision ID: f1a2b3c4d5e6
Revises: 4b2a8c9d3e1f
Create Date: 2026-02-14 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "f1a2b3c4d5e6"
down_revision = "4b2a8c9d3e1f"


def upgrade():
    """Create ab_api_key table for FAB API key authentication.

    This table is managed by FAB's SecurityManager. For fresh installs,
    FAB's create_all() handles table creation. This migration ensures
    existing Superset installs get the table on upgrade.
    """
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if "ab_api_key" in inspector.get_table_names():
        return

    op.create_table(
        "ab_api_key",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("uuid", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=256), nullable=False),
        sa.Column("key_hash", sa.String(length=256), nullable=False),
        sa.Column("key_prefix", sa.String(length=16), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("scopes", sa.Text(), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("expires_on", sa.DateTime(), nullable=True),
        sa.Column("revoked_on", sa.DateTime(), nullable=True),
        sa.Column("last_used_on", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["ab_user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("uuid"),
    )

    with op.batch_alter_table("ab_api_key") as batch_op:
        batch_op.create_index("idx_api_key_prefix", ["key_prefix"])
        batch_op.create_index("idx_api_key_user_id", ["user_id"])


def downgrade():
    """Drop ab_api_key table."""
    op.drop_table("ab_api_key")
