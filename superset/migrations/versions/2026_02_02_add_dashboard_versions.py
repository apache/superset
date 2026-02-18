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
"""add dashboard_versions table."""

import sqlalchemy as sa
from sqlalchemy.dialects import mysql

from superset.migrations.shared.utils import (
    create_fks_for_table,
    create_table,
    drop_table,
)

revision = "a1b2c3d4e5f6"
down_revision = "9787190b3d89"


def upgrade() -> None:
    create_table(
        "dashboard_versions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("dashboard_id", sa.Integer(), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column(
            "position_json",
            sa.Text().with_variant(mysql.MEDIUMTEXT(), "mysql"),
            nullable=True,
        ),
        sa.Column(
            "json_metadata",
            sa.Text().with_variant(mysql.MEDIUMTEXT(), "mysql"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    create_fks_for_table(
        "fk_dashboard_versions_dashboard_id_dashboards",
        "dashboard_versions",
        "dashboards",
        ["dashboard_id"],
        ["id"],
        ondelete="CASCADE",
    )
    create_fks_for_table(
        "fk_dashboard_versions_created_by_fk_ab_user",
        "dashboard_versions",
        "ab_user",
        ["created_by_fk"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    drop_table("dashboard_versions")
