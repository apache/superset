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
"""Add onboarding workflows tables

Revision ID: 91b151e8dac1
Revises: 9787190b3d89
Create Date: 2026-02-04 16:32:25.570254

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "91b151e8dac1"
down_revision = "9787190b3d89"


def upgrade():
    op.create_table(
        "onboarding_workflow",
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(100), unique=True),
        sa.Column("description", sa.String(255)),
        sa.Column(
            "created_by_fk", sa.Integer(), sa.ForeignKey("ab_user.id"), nullable=True
        ),
        sa.Column(
            "changed_by_fk", sa.Integer(), sa.ForeignKey("ab_user.id"), nullable=True
        ),
    )

    op.create_table(
        "user_onboarding_workflow",
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("user_id", sa.Integer(), primary_key=True),
        sa.Column("onboarding_workflow_id", sa.Integer(), primary_key=True),
        sa.Column("visited_times", sa.Integer, default=0),
        sa.Column("should_visit", sa.Boolean, default=False),
        sa.Column(
            "created_by_fk", sa.Integer(), sa.ForeignKey("ab_user.id"), nullable=True
        ),
        sa.Column(
            "changed_by_fk", sa.Integer(), sa.ForeignKey("ab_user.id"), nullable=True
        ),
        sa.ForeignKeyConstraint(["user_id"], ["ab_user.id"]),
        sa.ForeignKeyConstraint(["onboarding_workflow_id"], ["onboarding_workflow.id"]),
    )


def downgrade():
    op.drop_table("user_onboarding_workflow")
    op.drop_table("onboarding_workflow")
