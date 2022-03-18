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
"""add key-value store

Revision ID: 6766938c6065
Revises: 7293b0ca7944
Create Date: 2022-03-04 09:59:26.922329

"""

# revision identifiers, used by Alembic.
revision = "6766938c6065"
down_revision = "7293b0ca7944"

from uuid import uuid4

import sqlalchemy as sa
from alembic import op
from sqlalchemy_utils import UUIDType


def upgrade():
    op.create_table(
        "key_value",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("resource", sa.String(32), nullable=False),
        sa.Column("value", sa.LargeBinary(), nullable=False),
        sa.Column("uuid", UUIDType(binary=True), default=uuid4),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.Column("expires_on", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["created_by_fk"], ["ab_user.id"]),
        sa.ForeignKeyConstraint(["changed_by_fk"], ["ab_user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_key_value_uuid"), "key_value", ["uuid"], unique=True)
    op.create_index(
        op.f("ix_key_value_expires_on"), "key_value", ["expires_on"], unique=False
    )


def downgrade():
    op.drop_index(op.f("ix_key_value_expires_on"), table_name="key_value")
    op.drop_index(op.f("ix_key_value_uuid"), table_name="key_value")
    op.drop_table("key_value")
