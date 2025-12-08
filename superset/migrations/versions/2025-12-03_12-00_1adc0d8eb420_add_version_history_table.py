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
"""add_version_history_table

Revision ID: 1adc0d8eb420
Revises: a9c01ec10479
Create Date: 2025-12-03 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = "1adc0d8eb420"
down_revision = "a9c01ec10479"


def upgrade():
    # Create version_history table
    op.create_table(
        "version_history",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "asset_type",
            sa.Enum("CHART", "DASHBOARD", "DATASET", name="assettype"),
            nullable=False,
        ),
        sa.Column(
            "asset_id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "version_number",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "version_data",
            sa.Text().with_variant(mysql.MEDIUMTEXT(), "mysql"),
            nullable=False,
        ),
        sa.Column(
            "description",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "created_on",
            sa.DateTime(),
            nullable=False,
        ),
        sa.Column(
            "created_by_fk",
            sa.Integer(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["created_by_fk"],
            ["ab_user.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "asset_type",
            "asset_id",
            "version_number",
            name="uq_version_history_asset_version",
        ),
    )

    # Create indexes for better query performance
    op.create_index(
        "idx_version_history_asset",
        "version_history",
        ["asset_type", "asset_id"],
        unique=False,
    )

    op.create_index(
        "idx_version_history_created_on",
        "version_history",
        ["created_on"],
        unique=False,
    )


def downgrade():
    # Drop indexes
    op.drop_index("idx_version_history_created_on", table_name="version_history")
    op.drop_index("idx_version_history_asset", table_name="version_history")

    # Drop table
    op.drop_table("version_history")
