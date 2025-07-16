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
"""add report templates table

Revision ID: b4757fa23b89
Revises: 363a9b1e8992
Create Date: 2025-06-07 00:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

from superset.migrations.shared.utils import create_table

# revision identifiers, used by Alembic.
revision = "b4757fa23b89"
down_revision = "363a9b1e8992"


def upgrade() -> None:
    create_table(
        "report_templates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("name", sa.String(length=250), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("dataset_id", sa.Integer(), sa.ForeignKey("tables.id"), nullable=False),
        sa.Column("template_path", sa.String(length=1024), nullable=False),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("report_templates")
