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
"""add embedded_charts table

Revision ID: a1c7e4b62f18
Revises: 39097d124752
Create Date: 2026-09-01 10:00:00.000000

"""

import sqlalchemy as sa
from sqlalchemy_utils import UUIDType

from superset.migrations.shared.utils import create_table, drop_table

# revision identifiers, used by Alembic.
revision = "a1c7e4b62f18"
down_revision = "39097d124752"


def upgrade() -> None:
    create_table(
        "embedded_charts",
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.Column("uuid", UUIDType(binary=True), primary_key=True),
        sa.Column("allow_domain_list", sa.Text(), nullable=True),
        sa.Column("guest_token_revoked_before", sa.Integer(), nullable=True),
        sa.Column("slice_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["slice_id"], ["slices.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["changed_by_fk"], ["ab_user.id"]),
        sa.ForeignKeyConstraint(["created_by_fk"], ["ab_user.id"]),
    )


def downgrade() -> None:
    drop_table("embedded_charts")
