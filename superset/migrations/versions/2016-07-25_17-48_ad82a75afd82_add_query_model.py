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
"""Update models to support storing the queries.

Revision ID: ad82a75afd82
Revises: f162a1dea4c4
Create Date: 2016-07-25 17:48:12.771103

"""

# revision identifiers, used by Alembic.
revision = "ad82a75afd82"
down_revision = "f162a1dea4c4"

import sqlalchemy as sa
from alembic import op


def upgrade():
    op.create_table(
        "query",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("client_id", sa.String(length=11), nullable=False),
        sa.Column("database_id", sa.Integer(), nullable=False),
        sa.Column("tmp_table_name", sa.String(length=256), nullable=True),
        sa.Column("tab_name", sa.String(length=256), nullable=True),
        sa.Column("sql_editor_id", sa.String(length=256), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=True),
        sa.Column("name", sa.String(length=256), nullable=True),
        sa.Column("schema", sa.String(length=256), nullable=True),
        sa.Column("sql", sa.Text(), nullable=True),
        sa.Column("select_sql", sa.Text(), nullable=True),
        sa.Column("executed_sql", sa.Text(), nullable=True),
        sa.Column("limit", sa.Integer(), nullable=True),
        sa.Column("limit_used", sa.Boolean(), nullable=True),
        sa.Column("select_as_cta", sa.Boolean(), nullable=True),
        sa.Column("select_as_cta_used", sa.Boolean(), nullable=True),
        sa.Column("progress", sa.Integer(), nullable=True),
        sa.Column("rows", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("start_time", sa.Numeric(precision=20, scale=6), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("end_time", sa.Numeric(precision=20, scale=6), nullable=True),
        sa.ForeignKeyConstraint(["database_id"], ["dbs.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["ab_user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.add_column(
        "dbs", sa.Column("select_as_create_table_as", sa.Boolean(), nullable=True)
    )
    op.create_index(
        op.f("ti_user_id_changed_on"), "query", ["user_id", "changed_on"], unique=False
    )


def downgrade():
    op.drop_table("query")
    op.drop_column("dbs", "select_as_create_table_as")
