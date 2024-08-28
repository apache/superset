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
"""remove sl_dataset_tables

Revision ID: 38f4144e8558
Revises: 39549add7bfc
Create Date: 2024-08-13 15:23:28.768963

"""

import sqlalchemy as sa
from alembic import op

from superset.migrations.shared.constraints import drop_fks_for_table

# revision identifiers, used by Alembic.
revision = "38f4144e8558"
down_revision = "39549add7bfc"


def upgrade():
    connection = op.get_bind()
    if connection.dialect.name != "sqlite":
        drop_fks_for_table("sl_dataset_tables")
    op.drop_table("sl_dataset_tables")


def downgrade():
    op.create_table(
        "sl_dataset_tables",
        sa.Column("dataset_id", sa.Integer(), nullable=False),
        sa.Column("table_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["dataset_id"],
            ["sl_datasets.id"],
        ),
        sa.ForeignKeyConstraint(
            ["table_id"],
            ["sl_tables.id"],
        ),
        sa.PrimaryKeyConstraint("dataset_id", "table_id"),
    )
