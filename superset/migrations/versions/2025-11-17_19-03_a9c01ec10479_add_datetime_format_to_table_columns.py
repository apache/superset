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
"""add_datetime_format_to_table_columns

Revision ID: a9c01ec10479
Revises: x2s8ocx6rto6
Create Date: 2025-11-17 19:03:48.600000

"""

import logging

import sqlalchemy as sa
from alembic import op

from superset.migrations.shared.utils import get_table_column

logger = logging.getLogger("alembic.env")

# revision identifiers, used by Alembic.
revision = "a9c01ec10479"
down_revision = "x2s8ocx6rto6"


def upgrade():
    """Add datetime_format column to table_columns table."""
    # Check if column already exists to avoid errors if already upgraded
    column_info = get_table_column("table_columns", "datetime_format")

    if column_info is not None:
        logger.info(
            "Column table_columns.datetime_format already exists. Skipping migration."
        )
        return

    with op.batch_alter_table("table_columns") as batch_op:
        batch_op.add_column(
            sa.Column("datetime_format", sa.String(length=100), nullable=True)
        )


def downgrade():
    """Remove datetime_format column from table_columns table."""
    # Check if column exists before attempting to drop it
    column_info = get_table_column("table_columns", "datetime_format")

    if column_info is None:
        logger.info(
            "Column table_columns.datetime_format does not exist. Skipping downgrade."
        )
        return

    with op.batch_alter_table("table_columns") as batch_op:
        batch_op.drop_column("datetime_format")
