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
"""metric currency should be JSON

Revision ID: f1edd4a4d4f2
Revises: 378cecfdba9f
Create Date: 2025-04-30 11:04:39.105229

"""

import json

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "f1edd4a4d4f2"
down_revision = "378cecfdba9f"


def upgrade():
    """
    Convert the currency column to JSON using a staging column.
    """
    op.add_column("sql_metrics", sa.Column("currency_tmp", sa.JSON(), nullable=True))

    conn = op.get_bind()
    result = conn.execute(
        sa.text("SELECT id, currency FROM sql_metrics WHERE currency IS NOT NULL")
    )

    for row_id, json_value in result:
        conn.execute(
            sa.text("UPDATE sql_metrics SET currency_tmp = :val WHERE id = :id"),
            {"val": json_value, "id": row_id},
        )

    op.drop_column("sql_metrics", "currency")
    op.alter_column("sql_metrics", "currency_tmp", new_column_name="currency")


def downgrade():
    """
    Convert the currency column back to text using a staging column.
    """
    op.add_column(
        "sql_metrics",
        sa.Column("currency_tmp", sa.String(length=128), nullable=True),
    )

    conn = op.get_bind()
    result = conn.execute(
        sa.text("SELECT id, currency FROM sql_metrics WHERE currency IS NOT NULL")
    )

    for row in result:
        row_id = row[0]
        string_value = json.dumps(row[1])
        conn.execute(
            sa.text("UPDATE sql_metrics SET currency_tmp = :val WHERE id = :id"),
            {"val": string_value, "id": row_id},
        )

    op.drop_column("sql_metrics", "currency")
    op.alter_column("sql_metrics", "currency_tmp", new_column_name="currency")
