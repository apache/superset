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
"""Add query context to slices

Revision ID: 030c840e3a1c
Revises: 3317e9248280
Create Date: 2021-07-21 12:09:37.048337

"""

# revision identifiers, used by Alembic.
revision = "030c840e3a1c"
down_revision = "3317e9248280"

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import mysql


def upgrade():
    with op.batch_alter_table("slices") as batch_op:
        batch_op.add_column(sa.Column("query_context", sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table("slices") as batch_op:
        batch_op.drop_column("query_context")
