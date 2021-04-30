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
"""add_dataset_name_column_to_tables

Revision ID: d891f321997f
Revises: 19e978e1b9c3
Create Date: 2021-04-29 16:34:15.679026

"""

# revision identifiers, used by Alembic.
revision = "d891f321997f"
down_revision = "d416d0d715cc"

import sqlalchemy as sa
from alembic import op


def upgrade():
    op.add_column(
        "tables", sa.Column("dataset_name", sa.String(length=250), nullable=True)
    )


def downgrade():
    with op.batch_alter_table("tables") as batch_op:
        batch_op.drop_column("dataset_name")
