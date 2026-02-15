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
"""add_embedded_charts_table

Revision ID: 50aff65919a0
Revises: f5b5f88d8526
Create Date: 2026-01-08 16:45:00.000000

"""

from uuid import uuid4

import sqlalchemy as sa
from alembic import op
from sqlalchemy_utils import UUIDType

from superset.migrations.shared.utils import create_table

# revision identifiers, used by Alembic.
revision = "50aff65919a0"
down_revision = "f5b5f88d8526"


def upgrade():
    create_table(
        "embedded_charts",
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("allow_domain_list", sa.Text(), nullable=True),
        sa.Column("uuid", UUIDType(binary=True), default=uuid4, primary_key=True),
        sa.Column(
            "chart_id",
            sa.Integer(),
            sa.ForeignKey("slices.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
    )


def downgrade():
    op.drop_table("embedded_charts")
