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
"""add source column to logs table

Revision ID: 5c9c775d72de
Revises: ce6bd21901ab
Create Date: 2026-04-19 00:00:00.000000

"""

import logging

import sqlalchemy as sa
from alembic import op

from superset.migrations.shared.utils import get_table_column

logger = logging.getLogger("alembic.env")

# revision identifiers, used by Alembic.
revision = "5c9c775d72de"
down_revision = "ce6bd21901ab"


def upgrade() -> None:
    column_info = get_table_column("logs", "source")
    if column_info is not None:
        logger.info("Column logs.source already exists. Skipping migration.")
        return

    with op.batch_alter_table("logs") as batch_op:
        batch_op.add_column(sa.Column("source", sa.String(length=32), nullable=True))


def downgrade() -> None:
    column_info = get_table_column("logs", "source")
    if column_info is None:
        logger.info("Column logs.source does not exist. Skipping downgrade.")
        return

    with op.batch_alter_table("logs") as batch_op:
        batch_op.drop_column("source")
