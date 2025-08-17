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
"""add extensions table

Revision ID: d4d5115bdeb0
Revises: c233f5365c9e
Create Date: 2025-03-07 08:35:14.112691

"""

# revision identifiers, used by Alembic.
revision = "d4d5115bdeb0"
down_revision = "c233f5365c9e"

from uuid import uuid4  # noqa: E402

import sqlalchemy as sa  # noqa: E402
from alembic import op  # noqa: E402
from sqlalchemy_utils import UUIDType  # noqa: E402

from superset.migrations.shared.utils import (  # noqa: E402
    create_index,
    create_table,
    drop_index,
    drop_table,
)


def upgrade():
    create_table(
        "extensions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("manifest", sa.Text(), nullable=False),
        sa.Column("frontend", sa.Text(), nullable=True),
        sa.Column("backend", sa.Text(), nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("uuid", UUIDType(binary=True), default=uuid4),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(("created_by_fk",), ["ab_user.id"]),
        sa.ForeignKeyConstraint(("changed_by_fk",), ["ab_user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    create_index("extensions", op.f("ix_extensions_uuid"), ["uuid"], unique=True)
    create_index("extensions", op.f("ix_extensions_name"), ["name"], unique=True)


def downgrade():
    drop_index("extensions", op.f("ix_extensions_uuid"))
    drop_index("extensions", op.f("ix_extensions_name"))
    drop_table("extensions")
