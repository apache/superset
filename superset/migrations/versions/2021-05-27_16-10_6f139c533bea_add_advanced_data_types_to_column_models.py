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
"""adding advanced data type to column models

Revision ID: 6f139c533bea
Revises: cbe71abde154
Create Date: 2021-05-27 16:10:59.567684

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "6f139c533bea"
down_revision = "cbe71abde154"


def upgrade():
    with op.batch_alter_table("table_columns") as batch_op:
        batch_op.add_column(
            sa.Column(
                "advanced_data_type",
                sa.VARCHAR(255),
                nullable=True,
            )
        )
    with op.batch_alter_table("columns") as batch_op:
        batch_op.add_column(
            sa.Column(
                "advanced_data_type",
                sa.VARCHAR(255),
                nullable=True,
            )
        )
    with op.batch_alter_table("sl_columns") as batch_op:
        batch_op.add_column(
            sa.Column(
                "advanced_data_type",
                sa.Text,
                nullable=True,
            )
        )


def downgrade():
    with op.batch_alter_table("table_columns") as batch_op:
        batch_op.drop_column("advanced_data_type")
    with op.batch_alter_table("columns") as batch_op:
        batch_op.drop_column("advanced_data_type")
    with op.batch_alter_table("sl_columns") as batch_op:
        batch_op.drop_column("advanced_data_type")
