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
"""increase width of table_columns.type

Revision ID: 97125008dcb1
Revises: f80a3b88324b
Create Date: 2020-08-20 14:52:00.754088

"""

# revision identifiers, used by Alembic.
revision = "97125008dcb1"
down_revision = "f80a3b88324b"

import sqlalchemy as sa
from alembic import op


def upgrade():
    with op.batch_alter_table("table_columns") as batch_op:
        batch_op.alter_column(
            column_name="type",
            type_=sa.VARCHAR(128),
            existing_type=sa.VARCHAR(32),
            existing_nullable=True,
        )


def downgrade():
    with op.batch_alter_table("table_columns") as batch_op:
        batch_op.alter_column(
            column_name="type",
            type_=sa.VARCHAR(32),
            existing_type=sa.VARCHAR(128),
            existing_nullable=True,
        )
