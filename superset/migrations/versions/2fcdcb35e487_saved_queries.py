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
"""saved_queries

Revision ID: 2fcdcb35e487
Revises: a6c18f869a4e
Create Date: 2017-03-29 15:04:35.734190

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "2fcdcb35e487"
down_revision = "a6c18f869a4e"


def upgrade():
    op.create_table(
        "saved_query",
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("db_id", sa.Integer(), nullable=True),
        sa.Column("label", sa.String(256), nullable=True),
        sa.Column("schema", sa.String(128), nullable=True),
        sa.Column("sql", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["changed_by_fk"], ["ab_user.id"]),
        sa.ForeignKeyConstraint(["created_by_fk"], ["ab_user.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["ab_user.id"]),
        sa.ForeignKeyConstraint(["db_id"], ["dbs.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade():
    op.drop_table("saved_query")
