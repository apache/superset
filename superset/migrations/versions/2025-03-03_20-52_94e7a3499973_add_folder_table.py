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
"""Add folder table

Revision ID: 94e7a3499973
Revises: 74ad1125881c
Create Date: 2025-03-03 20:52:24.585143

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy_utils import UUIDType

# revision identifiers, used by Alembic.
revision = "94e7a3499973"
down_revision = "74ad1125881c"


def upgrade():
    op.create_table(
        "folders",
        sa.Column("id", UUIDType(binary=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.String(length=1000), nullable=True),
        sa.Column("table_id", sa.Integer(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["table_id"], ["tables.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.add_column(
        "sql_metrics",
        sa.Column("folder_id", UUIDType(binary=True), nullable=True),
    )
    op.add_column(
        "sql_metrics",
        sa.Column("folder_position", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(None, "sql_metrics", "folders", ["folder_id"], ["id"])
    op.add_column(
        "table_columns",
        sa.Column("folder_id", UUIDType(binary=True), nullable=True),
    )
    op.add_column(
        "table_columns",
        sa.Column("folder_position", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(None, "table_columns", "folders", ["folder_id"], ["id"])


def downgrade():
    op.drop_column("table_columns", "folder_position")
    op.drop_column("table_columns", "folder_id")
    op.drop_column("sql_metrics", "folder_position")
    op.drop_column("sql_metrics", "folder_id")
    op.drop_table("folders")
