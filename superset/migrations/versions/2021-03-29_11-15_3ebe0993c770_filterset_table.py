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
"""add filter set model

Revision ID: 3ebe0993c770
Revises: 07071313dd52
Create Date: 2021-03-29 11:15:48.831225

"""

# revision identifiers, used by Alembic.
revision = "3ebe0993c770"
down_revision = "181091c0ef16"

import sqlalchemy as sa
from alembic import op


def upgrade():
    op.create_table(
        "filter_sets",
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.VARCHAR(500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("json_metadata", sa.Text(), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("owner_type", sa.VARCHAR(255), nullable=False),
        sa.Column(
            "dashboard_id", sa.Integer(), sa.ForeignKey("dashboards.id"), nullable=False
        ),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["changed_by_fk"], ["ab_user.id"]),
        sa.ForeignKeyConstraint(["created_by_fk"], ["ab_user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade():
    op.drop_table("filter_sets")
