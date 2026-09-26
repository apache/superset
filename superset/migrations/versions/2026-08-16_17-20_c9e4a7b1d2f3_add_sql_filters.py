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
"""add_sql_filters

Revision ID: c9e4a7b1d2f3
Revises: 1072de5ed955
Create Date: 2026-08-16 17:20:00.000000

"""

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKeyConstraint,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy_utils import UUIDType

from superset.migrations.shared.utils import create_table, drop_table
from superset.utils.core import MediumText

# revision identifiers, used by Alembic.
revision = "c9e4a7b1d2f3"
down_revision = "1072de5ed955"

TABLE_NAME = "sql_filters"


def upgrade() -> None:
    create_table(
        TABLE_NAME,
        Column("id", Integer, primary_key=True),
        Column("uuid", UUIDType(binary=True), nullable=True),
        Column("filter_name", String(255), nullable=False),
        Column("verbose_name", String(1024)),
        Column("description", MediumText()),
        Column("warning_text", Text),
        Column("table_id", Integer),
        Column("expression", MediumText(), nullable=False),
        Column("extra", Text),
        Column("created_on", DateTime, nullable=True),
        Column("changed_on", DateTime, nullable=True),
        Column("created_by_fk", Integer, nullable=True),
        Column("changed_by_fk", Integer, nullable=True),
        UniqueConstraint("uuid"),
        UniqueConstraint("table_id", "filter_name"),
        ForeignKeyConstraint(
            ["table_id"],
            ["tables.id"],
            name="fk_sql_filters_table_id",
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["created_by_fk"],
            ["ab_user.id"],
            name="fk_sql_filters_created_by_fk",
        ),
        ForeignKeyConstraint(
            ["changed_by_fk"],
            ["ab_user.id"],
            name="fk_sql_filters_changed_by_fk",
        ),
    )


def downgrade() -> None:
    drop_table(TABLE_NAME)
