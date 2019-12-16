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
"""Add dashboard_role table to manage role that can access all charts of dashboard.

Revision ID: 5e4a03ef0bf0
Revises: 41f6a59a61f2
Create Date: 2019-12-16 12:00:00

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "5e4a03ef0bf0"
down_revision = "b347b202819b"


def upgrade():
    op.create_table(
        "dashboard_role",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("role_id", sa.Integer(), nullable=True),
        sa.Column("dashboard_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["dashboard_id"], ["dashboards.id"]),
        sa.ForeignKeyConstraint(["role_id"], ["ab_role.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

def downgrade():
    op.drop_table("dashboard_role")
