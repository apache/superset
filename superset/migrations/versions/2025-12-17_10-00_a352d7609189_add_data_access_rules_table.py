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
"""add_data_access_rules_table

Revision ID: a352d7609189
Revises: a9c01ec10479
Create Date: 2025-12-17 10:00:00.000000

"""

import sqlalchemy as sa
from sqlalchemy.dialects import mysql

from superset.migrations.shared.utils import (
    create_fks_for_table,
    create_table,
    drop_table,
)

# revision identifiers, used by Alembic.
revision = "a352d7609189"
down_revision = "a9c01ec10479"


def upgrade():
    create_table(
        "data_access_rules",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("role_id", sa.Integer(), nullable=False),
        sa.Column(
            "rule",
            sa.Text().with_variant(mysql.MEDIUMTEXT(), "mysql"),
            nullable=False,
        ),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create foreign key constraints
    create_fks_for_table(
        "fk_data_access_rules_role_id_ab_role",
        "data_access_rules",
        "ab_role",
        ["role_id"],
        ["id"],
        ondelete="CASCADE",
    )

    create_fks_for_table(
        "fk_data_access_rules_created_by_fk_ab_user",
        "data_access_rules",
        "ab_user",
        ["created_by_fk"],
        ["id"],
    )

    create_fks_for_table(
        "fk_data_access_rules_changed_by_fk_ab_user",
        "data_access_rules",
        "ab_user",
        ["changed_by_fk"],
        ["id"],
    )


def downgrade():
    drop_table("data_access_rules")
