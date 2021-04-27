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
"""add_limiting_factor_column_to_query_model.py

Revision ID: d416d0d715cc
Revises: 19e978e1b9c3
Create Date: 2021-04-16 17:38:40.342260

"""

# revision identifiers, used by Alembic.
revision = "d416d0d715cc"
down_revision = "19e978e1b9c3"

import sqlalchemy as sa
from alembic import op


def upgrade():
    with op.batch_alter_table("query") as batch_op:
        batch_op.add_column(
            sa.Column("limiting_factor", sa.VARCHAR(255), server_default="UNKNOWN",)
        )


def downgrade():
    with op.batch_alter_table("query") as batch_op:
        batch_op.drop_column("limiting_factor")
