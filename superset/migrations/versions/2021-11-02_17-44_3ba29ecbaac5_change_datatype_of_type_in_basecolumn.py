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
"""Change datatype of type in BaseColumn

Revision ID: 3ba29ecbaac5
Revises: abe27eaf93db
Create Date: 2021-11-02 17:44:51.792138

"""

# revision identifiers, used by Alembic.
revision = "3ba29ecbaac5"
down_revision = "abe27eaf93db"

import sqlalchemy as sa
from alembic import op


def upgrade():

    with op.batch_alter_table("table_columns") as batch_op:
        batch_op.alter_column(
            "type", existing_type=sa.VARCHAR(length=32), type_=sa.TEXT()
        )


def downgrade():
    with op.batch_alter_table("table_columns") as batch_op:
        batch_op.alter_column(
            "type", existing_type=sa.TEXT(), type_=sa.VARCHAR(length=32)
        )
