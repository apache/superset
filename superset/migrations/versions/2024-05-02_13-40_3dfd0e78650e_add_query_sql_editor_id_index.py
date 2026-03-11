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

Revision ID: 3dfd0e78650e
Revises: 5f57af97bc3f
Create Date: 2024-05-02 13:40:23.126659

"""

from alembic import op

from superset.migrations.shared.utils import create_index, drop_index

# revision identifiers, used by Alembic.
revision = "3dfd0e78650e"
down_revision = "5f57af97bc3f"

table = "query"
index = "ix_sql_editor_id"


def upgrade():
    create_index(
        table,
        op.f(index),
        ["sql_editor_id"],
        unique=False,
    )


def downgrade():
    drop_index(index_name=op.f(index), table_name=table)
