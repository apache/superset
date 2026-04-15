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
"""remove_aggs

Revision ID: 7467e77870e4
Revises: c829ff0b37d0
Create Date: 2018-07-22 08:50:01.078218

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "7467e77870e4"
down_revision = "c829ff0b37d0"


def upgrade():
    with op.batch_alter_table("table_columns") as batch_op:
        batch_op.drop_column("avg")
        batch_op.drop_column("max")
        batch_op.drop_column("sum")
        batch_op.drop_column("count_distinct")
        batch_op.drop_column("min")

    with op.batch_alter_table("columns") as batch_op:
        batch_op.drop_column("avg")
        batch_op.drop_column("max")
        batch_op.drop_column("sum")
        batch_op.drop_column("count_distinct")
        batch_op.drop_column("min")


def downgrade():
    op.add_column("table_columns", sa.Column("min", sa.Boolean(), nullable=True))
    op.add_column(
        "table_columns", sa.Column("count_distinct", sa.Boolean(), nullable=True)
    )
    op.add_column("table_columns", sa.Column("sum", sa.Boolean(), nullable=True))
    op.add_column("table_columns", sa.Column("max", sa.Boolean(), nullable=True))
    op.add_column("table_columns", sa.Column("avg", sa.Boolean(), nullable=True))

    op.add_column("columns", sa.Column("min", sa.Boolean(), nullable=True))
    op.add_column("columns", sa.Column("count_distinct", sa.Boolean(), nullable=True))
    op.add_column("columns", sa.Column("sum", sa.Boolean(), nullable=True))
    op.add_column("columns", sa.Column("max", sa.Boolean(), nullable=True))
    op.add_column("columns", sa.Column("avg", sa.Boolean(), nullable=True))
