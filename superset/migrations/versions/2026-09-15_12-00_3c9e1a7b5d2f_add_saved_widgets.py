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
"""add_saved_widgets

Revision ID: 3c9e1a7b5d2f
Revises: e5f6a7b8c9d0
Create Date: 2026-09-15 12:00:00.000000

"""

revision = "3c9e1a7b5d2f"
down_revision = "e5f6a7b8c9d0"

import sqlalchemy as sa  # noqa: E402
from sqlalchemy_utils import UUIDType  # noqa: E402

from superset.migrations.shared.utils import (  # noqa: E402
    create_index,
    create_table,
    drop_index,
    drop_table,
)


def upgrade() -> None:
    create_table(
        "saved_widgets",
        sa.Column("uuid", UUIDType(binary=True), nullable=False),
        sa.Column("widget_type", sa.String(250), nullable=False),
        sa.Column("title", sa.String(500), nullable=True),
        sa.Column("props", sa.Text(), nullable=False),
        sa.Column("dataset_id", sa.Integer(), nullable=True),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["created_by_fk"],
            ["ab_user.id"],
            name="fk_saved_widgets_created_by_fk_ab_user",
        ),
        sa.ForeignKeyConstraint(
            ["changed_by_fk"],
            ["ab_user.id"],
            name="fk_saved_widgets_changed_by_fk_ab_user",
        ),
        sa.PrimaryKeyConstraint("uuid"),
    )
    create_index("saved_widgets", "ix_saved_widgets_created_by_fk", ["created_by_fk"])


def downgrade() -> None:
    drop_index("saved_widgets", "ix_saved_widgets_created_by_fk")
    drop_table("saved_widgets")
