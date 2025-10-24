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
"""add llm tables

Revision ID: 58200d37f074
Revises: c233f5365c9e
Create Date: 2025-08-11 11:20:44.248026

"""

# revision identifiers, used by Alembic.
revision = "58200d37f074"
down_revision = "c233f5365c9e"

import sqlalchemy as sa
from alembic import op


def upgrade():
    op.create_table(
        "llm_connection",
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("database_id", sa.Integer(), nullable=False),
        sa.Column("enabled", sa.Boolean(), default=False, nullable=False),
        sa.Column("provider", sa.String(length=255), nullable=False),
        sa.Column("model", sa.String(length=255), nullable=False),
        sa.Column("api_key", sa.Text(), nullable=False),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["changed_by_fk"],
            ["ab_user.id"],
        ),
        sa.ForeignKeyConstraint(
            ["created_by_fk"],
            ["ab_user.id"],
        ),
        sa.ForeignKeyConstraint(
            ["database_id"],
            ["dbs.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "llm_context_options",
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("database_id", sa.Integer(), nullable=True),
        sa.Column("refresh_interval", sa.Integer(), nullable=True),
        sa.Column(
            "schemas",
            sa.Text().with_variant(sa.dialects.mysql.MEDIUMTEXT(), "mysql"),
            nullable=True,
        ),
        sa.Column("include_indexes", sa.Boolean(), default=True),
        sa.Column("top_k", sa.Integer(), default=10, nullable=True),
        sa.Column("top_k_limit", sa.Integer(), default=50000, nullable=True),
        sa.Column(
            "instructions",
            sa.Text().with_variant(sa.dialects.mysql.MEDIUMTEXT(), "mysql"),
            nullable=True,
        ),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["changed_by_fk"],
            ["ab_user.id"],
        ),
        sa.ForeignKeyConstraint(
            ["created_by_fk"],
            ["ab_user.id"],
        ),
        sa.ForeignKeyConstraint(
            ["database_id"],
            ["dbs.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "context_builder_task",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("task_id", sa.String(length=255), nullable=True),
        sa.Column("database_id", sa.Integer(), nullable=True),
        sa.Column("started_time", sa.DateTime(), nullable=True),
        sa.Column(
            "params",
            sa.Text().with_variant(sa.dialects.mysql.MEDIUMTEXT(), "mysql"),
            nullable=True,
        ),
        sa.Column("ended_time", sa.DateTime(), nullable=True),
        sa.Column("status", sa.String(length=255), nullable=True),
        sa.Column("duration", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["database_id"],
            ["dbs.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("task_id"),
    )

    op.create_table(
        "custom_llm_providers",
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("endpoint_url", sa.String(length=1024), nullable=False),
        sa.Column(
            "request_template",
            sa.Text().with_variant(sa.dialects.mysql.MEDIUMTEXT(), "mysql"),
            nullable=False,
        ),
        sa.Column("response_path", sa.String(length=255), nullable=False),
        sa.Column(
            "headers",
            sa.Text().with_variant(sa.dialects.mysql.MEDIUMTEXT(), "mysql"),
            nullable=True,
        ),
        sa.Column(
            "models",
            sa.Text().with_variant(sa.dialects.mysql.MEDIUMTEXT(), "mysql"),
            nullable=False,
        ),
        sa.Column(
            "system_instructions",
            sa.Text().with_variant(sa.dialects.mysql.MEDIUMTEXT(), "mysql"),
            nullable=True,
        ),
        sa.Column("timeout", sa.Integer(), default=30, nullable=True),
        sa.Column("enabled", sa.Boolean(), default=True, nullable=False),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["changed_by_fk"],
            ["ab_user.id"],
        ),
        sa.ForeignKeyConstraint(
            ["created_by_fk"],
            ["ab_user.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    # ### end Alembic commands ###


def downgrade():
    op.drop_table("custom_llm_providers")
    op.drop_table("llm_context_options")
    op.drop_table("llm_connection")
    op.drop_table("context_builder_task")
    # ### end Alembic commands ###
