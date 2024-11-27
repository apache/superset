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
"""Add catalog column

Revision ID: 5f57af97bc3f
Revises: d60591c5515f
Create Date: 2024-04-11 15:41:34.663989

"""

import sqlalchemy as sa
from alembic import op

from superset.migrations.shared.utils import add_column_if_not_exists

# revision identifiers, used by Alembic.
revision = "5f57af97bc3f"
down_revision = "d60591c5515f"

tables = ["tables", "query", "saved_query", "tab_state", "table_schema"]


def upgrade():
    for table in tables:
        add_column_if_not_exists(
            table,
            sa.Column("catalog", sa.String(length=256), nullable=True),
        )


def downgrade():
    for table in reversed(tables):
        op.drop_column(table, "catalog")
