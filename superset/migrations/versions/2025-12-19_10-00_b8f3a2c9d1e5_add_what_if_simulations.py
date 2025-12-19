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
"""add_what_if_simulations

Revision ID: b8f3a2c9d1e5
Revises: a9c01ec10479
Create Date: 2025-12-19 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import mysql
from sqlalchemy_utils import UUIDType

from superset.migrations.shared.utils import (
    create_fks_for_table,
    create_table,
    drop_table,
)

# revision identifiers, used by Alembic.
revision = "b8f3a2c9d1e5"
down_revision = "a9c01ec10479"


def upgrade():
    create_table(
        "what_if_simulations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("uuid", UUIDType(binary=True), nullable=False),
        sa.Column("name", sa.String(length=256), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("dashboard_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column(
            "modifications_json",
            sa.Text().with_variant(mysql.MEDIUMTEXT(), "mysql"),
            nullable=False,
        ),
        sa.Column(
            "cascading_effects_enabled",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("uuid"),
    )

    # Create index for fast lookup by dashboard_id + user_id
    op.create_index(
        "ix_what_if_simulations_dashboard_user",
        "what_if_simulations",
        ["dashboard_id", "user_id"],
    )

    # Create foreign key constraints
    create_fks_for_table(
        "fk_what_if_simulations_dashboard_id_dashboards",
        "what_if_simulations",
        "dashboards",
        ["dashboard_id"],
        ["id"],
        ondelete="CASCADE",
    )

    create_fks_for_table(
        "fk_what_if_simulations_user_id_ab_user",
        "what_if_simulations",
        "ab_user",
        ["user_id"],
        ["id"],
    )

    create_fks_for_table(
        "fk_what_if_simulations_created_by_fk_ab_user",
        "what_if_simulations",
        "ab_user",
        ["created_by_fk"],
        ["id"],
    )

    create_fks_for_table(
        "fk_what_if_simulations_changed_by_fk_ab_user",
        "what_if_simulations",
        "ab_user",
        ["changed_by_fk"],
        ["id"],
    )


def downgrade():
    op.drop_index(
        "ix_what_if_simulations_dashboard_user",
        table_name="what_if_simulations",
    )
    drop_table("what_if_simulations")
