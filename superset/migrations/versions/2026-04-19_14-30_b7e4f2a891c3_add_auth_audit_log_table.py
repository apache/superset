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
"""add auth_audit_log table

Revision ID: b7e4f2a891c3
Revises: ce6bd21901ab
Create Date: 2026-04-19 14:30:00.000000

"""

import sqlalchemy as sa

from superset.migrations.shared.utils import create_table, drop_table

# revision identifiers, used by Alembic.
revision = "b7e4f2a891c3"
down_revision = "ce6bd21901ab"


def upgrade() -> None:
    create_table(
        "auth_audit_log",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("ip_address", sa.String(length=256), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["ab_user.id"],
            name="fk_auth_audit_log_user_id_ab_user",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_auth_audit_log"),
    )


def downgrade() -> None:
    drop_table("auth_audit_log")
