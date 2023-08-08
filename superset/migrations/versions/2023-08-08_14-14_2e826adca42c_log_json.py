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
"""Fix schema for log

Revision ID: 2e826adca42c
Revises: 0769ef90fddd
Create Date: 2023-08-08 14:14:23.381364

"""


import sqlalchemy as sa
from alembic import op

from superset.utils.core import MediumText

# revision identifiers, used by Alembic.
revision = "2e826adca42c"
down_revision = "0769ef90fddd"


def upgrade():
    with op.batch_alter_table("logs") as batch_op:
        batch_op.alter_column(
            "json",
            existing_type=sa.Text(),
            type_=MediumText(),
            existing_nullable=True,
        )


def downgrade():
    with op.batch_alter_table("logs") as batch_op:
        batch_op.alter_column(
            "json",
            existing_type=MediumText(),
            type_=sa.Text(),
            existing_nullable=True,
        )
