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
"""add user_session_auth_stamp table

Revision ID: c6219cac9270
Revises: b4a3f2e1d0c9
Create Date: 2026-05-13 12:00:00.000000

"""

import sqlalchemy as sa

from superset.migrations.shared.utils import create_table, drop_table

# revision identifiers, used by Alembic.
revision: str = "c6219cac9270"
down_revision: str = "b4a3f2e1d0c9"


def upgrade() -> None:
    """Create the per-user session authentication stamp table."""
    create_table(
        "user_session_auth_stamp",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("stamp", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["ab_user.id"],
            name="fk_user_session_auth_stamp_user_id_ab_user",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("user_id", name="pk_user_session_auth_stamp"),
    )


def downgrade() -> None:
    """Drop the per-user session authentication stamp table."""
    drop_table("user_session_auth_stamp")
