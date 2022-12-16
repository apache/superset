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
"""Resize key_value blob

Revision ID: e09b4ae78457
Revises: e786798587de
Create Date: 2022-06-14 15:28:42.746349

"""

# revision identifiers, used by Alembic.
revision = "e09b4ae78457"
down_revision = "e786798587de"

import sqlalchemy as sa
from alembic import op


def upgrade():
    with op.batch_alter_table("key_value", schema=None) as batch_op:
        batch_op.alter_column(
            "value",
            existing_nullable=False,
            existing_type=sa.LargeBinary(),
            type_=sa.LargeBinary(length=2**24 - 1),
        )


def downgrade():
    with op.batch_alter_table("key_value", schema=None) as batch_op:
        batch_op.alter_column(
            "value",
            existing_nullable=False,
            existing_type=sa.LargeBinary(length=2**24 - 1),
            type_=sa.LargeBinary(),
        )
