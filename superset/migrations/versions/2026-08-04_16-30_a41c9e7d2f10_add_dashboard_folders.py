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
"""add dashboard folders

Revision ID: a41c9e7d2f10
Revises: 39097d124752
Create Date: 2026-08-04 16:30:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy_utils import UUIDType

from superset.migrations.shared.utils import (
    create_index,
    create_table,
    drop_index,
    drop_table,
)

revision: str = "a41c9e7d2f10"
down_revision: str = "39097d124752"


def upgrade() -> None:
    create_table(
        "dashboard_folders",
        sa.Column("id", UUIDType(binary=True), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("parent_id", UUIDType(binary=True), nullable=True),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["parent_id"],
            ["dashboard_folders.id"],
            name="fk_dashboard_folders_parent_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["created_by_fk"], ["ab_user.id"]),
        sa.ForeignKeyConstraint(["changed_by_fk"], ["ab_user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    create_index("dashboard_folders", "ix_dashboard_folders_parent_id", ["parent_id"])
    for table_name in ("dashboard_folder_editors", "dashboard_folder_viewers"):
        create_table(
            table_name,
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("subject_id", sa.Integer(), nullable=False),
            sa.Column("folder_id", UUIDType(binary=True), nullable=False),
            sa.ForeignKeyConstraint(
                ["subject_id"],
                ["subjects.id"],
                name=f"fk_{table_name}_subject_id",
                ondelete="CASCADE",
            ),
            sa.ForeignKeyConstraint(
                ["folder_id"],
                ["dashboard_folders.id"],
                name=f"fk_{table_name}_folder_id",
                ondelete="CASCADE",
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("subject_id", "folder_id"),
        )
    with op.batch_alter_table("dashboards") as batch_op:
        batch_op.add_column(
            sa.Column("folder_id", UUIDType(binary=True), nullable=True)
        )
        batch_op.create_foreign_key(
            "fk_dashboards_folder_id",
            "dashboard_folders",
            ["folder_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_index("ix_dashboards_folder_id", ["folder_id"])
    with op.batch_alter_table("dashboards_version") as batch_op:
        batch_op.add_column(
            sa.Column("folder_id", UUIDType(binary=True), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table("dashboards_version") as batch_op:
        batch_op.drop_column("folder_id")
    with op.batch_alter_table("dashboards") as batch_op:
        batch_op.drop_index("ix_dashboards_folder_id")
        batch_op.drop_constraint("fk_dashboards_folder_id", type_="foreignkey")
        batch_op.drop_column("folder_id")
    drop_table("dashboard_folder_viewers")
    drop_table("dashboard_folder_editors")
    drop_index("dashboard_folders", "ix_dashboard_folders_parent_id")
    drop_table("dashboard_folders")
