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
"""remove sl_columns

Revision ID: a6b32d2d07b1
Revises: e53fd48cc078
Create Date: 2024-08-13 15:29:33.135672

"""

import sqlalchemy as sa
from alembic import op

from superset.migrations.shared.constraints import drop_fks_for_table
from superset.migrations.shared.utils import has_table

# revision identifiers, used by Alembic.
revision = "a6b32d2d07b1"
down_revision = "e53fd48cc078"

table_name = "sl_columns"


def upgrade():
    if has_table(table_name):
        drop_fks_for_table(table_name)
        op.drop_table(table_name)


def downgrade():
    op.create_table(
        table_name,
        sa.Column("uuid", sa.Numeric(precision=16), nullable=True),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("is_aggregation", sa.Boolean(), nullable=False),
        sa.Column("is_additive", sa.Boolean(), nullable=False),
        sa.Column("is_dimensional", sa.Boolean(), nullable=False),
        sa.Column("is_filterable", sa.Boolean(), nullable=False),
        sa.Column("is_increase_desired", sa.Boolean(), nullable=False),
        sa.Column("is_managed_externally", sa.Boolean(), nullable=False),
        sa.Column("is_partition", sa.Boolean(), nullable=False),
        sa.Column("is_physical", sa.Boolean(), nullable=False),
        sa.Column("is_temporal", sa.Boolean(), nullable=False),
        sa.Column("is_spatial", sa.Boolean(), nullable=False),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("type", sa.Text(), nullable=True),
        sa.Column("unit", sa.Text(), nullable=True),
        sa.Column("expression", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("warning_text", sa.Text(), nullable=True),
        sa.Column("external_url", sa.Text(), nullable=True),
        sa.Column("extra_json", sa.Text(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.Column("advanced_data_type", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["changed_by_fk"],
            ["ab_user.id"],
        ),
        sa.ForeignKeyConstraint(
            ["created_by_fk"],
            ["ab_user.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("uuid"),
    )
