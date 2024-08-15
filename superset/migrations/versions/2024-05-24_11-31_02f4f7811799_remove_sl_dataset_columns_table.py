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
"""remove sl_dataset_columns tables

Revision ID: 02f4f7811799
Revises: f7b6750b67e8
Create Date: 2024-05-24 11:31:57.115586

"""

import sqlalchemy as sa
from alembic import op

from superset.migrations.shared.constraints import drop_fks_for_table

# revision identifiers, used by Alembic.
revision = "02f4f7811799"
down_revision = "f7b6750b67e8"


def upgrade():
    connection = op.get_bind()
    if connection.dialect.name != "sqlite":
        drop_fks_for_table("sl_dataset_columns")
    op.drop_table("sl_dataset_columns")


def downgrade():
    op.create_table(
        "sl_dataset_columns",
        sa.Column("dataset_id", sa.Integer(), nullable=False),
        sa.Column("column_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["column_id"],
            ["sl_columns.id"],
        ),
        sa.ForeignKeyConstraint(
            ["dataset_id"],
            ["sl_datasets.id"],
        ),
        sa.PrimaryKeyConstraint("dataset_id", "column_id"),
    )
