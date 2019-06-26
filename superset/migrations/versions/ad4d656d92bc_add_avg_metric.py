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
"""Add avg() to default metrics

Revision ID: ad4d656d92bc
Revises: b46fa1b0b39e
Create Date: 2016-10-25 10:16:39.871078

"""

# revision identifiers, used by Alembic.
revision = "ad4d656d92bc"
down_revision = "7e3ddad2a00b"

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column("columns", sa.Column("avg", sa.Boolean(), nullable=True))
    op.add_column("table_columns", sa.Column("avg", sa.Boolean(), nullable=True))


def downgrade():
    with op.batch_alter_table("columns") as batch_op:
        batch_op.drop_column("avg")
    with op.batch_alter_table("table_columns") as batch_op:
        batch_op.drop_column("avg")
