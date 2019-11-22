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
"""add user attributes table

Revision ID: 0c5070e96b57
Revises: 7fcdcde0761c
Create Date: 2018-08-06 14:38:18.965248

"""

# revision identifiers, used by Alembic.
revision = "0c5070e96b57"
down_revision = "7fcdcde0761c"

import sqlalchemy as sa
from alembic import op


def upgrade():
    op.create_table(
        "user_attribute",
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("welcome_dashboard_id", sa.Integer(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["changed_by_fk"], ["ab_user.id"]),
        sa.ForeignKeyConstraint(["created_by_fk"], ["ab_user.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["ab_user.id"]),
        sa.ForeignKeyConstraint(["welcome_dashboard_id"], ["dashboards.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade():
    op.drop_table("user_attribute")
