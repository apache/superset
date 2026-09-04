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
"""theme_crud

Revision ID: 3fd555e76e3d
Revises: 363a9b1e8992
Create Date: 2025-07-15 16:40:35.166210

"""

import sqlalchemy as sa
from sqlalchemy.dialects import mysql
from sqlalchemy_utils import UUIDType

from superset.migrations.shared.utils import (
    create_fks_for_table,
    create_table,
    drop_table,
)

# revision identifiers, used by Alembic.
revision = "3fd555e76e3d"
down_revision = "363a9b1e8992"


def upgrade():
    create_table(
        "themes",
        sa.Column("uuid", UUIDType(), nullable=True),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("theme_name", sa.String(length=250), nullable=True),
        sa.Column(
            "json_data",
            sa.Text().with_variant(mysql.MEDIUMTEXT(), "mysql"),
            nullable=True,
        ),
        sa.Column("is_system", sa.Boolean(), default=False, nullable=False),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("uuid"),
    )

    # Create foreign key constraints
    create_fks_for_table(
        "fk_themes_created_by_fk_ab_user",
        "themes",
        "ab_user",
        ["created_by_fk"],
        ["id"],
    )

    create_fks_for_table(
        "fk_themes_changed_by_fk_ab_user",
        "themes",
        "ab_user",
        ["changed_by_fk"],
        ["id"],
    )


def downgrade():
    drop_table("themes")
