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
"""add_query_sql_editor_id_index

Revision ID: efb7a20ff8d8
Revises: be1b217cd8cd
Create Date: 2024-03-04 14:48:16.998927

"""

# revision identifiers, used by Alembic.
revision = "efb7a20ff8d8"
down_revision = "be1b217cd8cd"

from alembic import op

from superset.migrations.shared.utils import table_has_index

table = "query"
index = "ix_query_user_id_sql_editor_id"


def upgrade():
    if not table_has_index(table, index):
        op.create_index(
            op.f(index),
            table,
            ["user_id", "sql_editor_id"],
            unique=False,
        )


def downgrade():
    if table_has_index(table, index):
        op.drop_index(op.f(index), table_name=table)
