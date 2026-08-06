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
"""Add folder_activity table

Revision ID: a1b2c3d4e5f6
Revises: 4567cf3d03cc
Create Date: 2026-08-04 12:00:00.000000
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "4567cf3d03cc"


def upgrade():
    op.create_table(
        "folder_activity",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "folder_id",
            sa.Integer(),
            sa.ForeignKey("folders.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("target_type", sa.String(50), nullable=True),
        sa.Column("target_name", sa.String(250), nullable=True),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column(
            "created_on",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_folder_activity_folder_id", "folder_activity", ["folder_id"]
    )
    op.create_index(
        "ix_folder_activity_created_on", "folder_activity", ["created_on"]
    )


def downgrade():
    op.drop_table("folder_activity")
