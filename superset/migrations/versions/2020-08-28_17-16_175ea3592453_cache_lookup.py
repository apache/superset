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
"""Add cache to datasource lookup table.

Revision ID: 175ea3592453
Revises: f80a3b88324b
Create Date: 2020-08-28 17:16:57.379425

"""

# revision identifiers, used by Alembic.
revision = "175ea3592453"
down_revision = "f80a3b88324b"

import sqlalchemy as sa  # noqa: E402
from alembic import op  # noqa: E402


def upgrade():
    op.create_table(
        "cache_keys",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("cache_key", sa.String(256), nullable=False),
        sa.Column("cache_timeout", sa.Integer(), nullable=True),
        sa.Column("datasource_uid", sa.String(64), nullable=False),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_cache_keys_datasource_uid"),
        "cache_keys",
        ["datasource_uid"],
        unique=False,
    )


def downgrade():
    op.drop_index(op.f("ix_cache_keys_datasource_uid"), table_name="cache_keys")
    op.drop_table("cache_keys")
