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
"""add_saved_query_foreign_key_to_tab_state
Revision ID: c53bae8f08dd
Revises: bb38f40aa3ff
Create Date: 2021-12-15 15:05:21.845777
"""

# revision identifiers, used by Alembic.
revision = "c53bae8f08dd"
down_revision = "bb38f40aa3ff"

import sqlalchemy as sa
from alembic import op


def upgrade():
    with op.batch_alter_table("tab_state") as batch_op:
        batch_op.add_column(sa.Column("saved_query_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "saved_query_id", "saved_query", ["saved_query_id"], ["id"]
        )


def downgrade():
    with op.batch_alter_table("tab_state") as batch_op:
        batch_op.drop_constraint("saved_query_id", type_="foreignkey")
        batch_op.drop_column("saved_query_id")
