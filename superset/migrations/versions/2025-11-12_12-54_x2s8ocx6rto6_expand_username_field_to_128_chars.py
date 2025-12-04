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
"""Expand username field to 128 chars

Revision ID: x2s8ocx6rto6
Revises: c233f5365c9e
Create Date: 2025-11-12 12:54:00.000000

"""

import logging

import sqlalchemy as sa
from alembic import op

from superset.migrations.shared.utils import get_table_column

logger = logging.getLogger("alembic.env")

# revision identifiers, used by Alembic.
revision = "x2s8ocx6rto6"
down_revision = "c233f5365c9e"


def upgrade():
    """Expand ab_user.username field from 64 to 128 characters."""
    # Check current column length to avoid errors if already upgraded
    column_info = get_table_column("ab_user", "username")

    if column_info is None:
        logger.warning("Column ab_user.username not found. Skipping migration.")
        return

    # Get current length - check the type attribute
    current_type = column_info.get("type")
    current_length = getattr(current_type, "length", None)

    if current_length is not None and current_length == 128:
        logger.info(
            "Column ab_user.username already has length %s. Skipping migration.",
            current_length,
        )
        return

    with op.batch_alter_table("ab_user") as batch_op:
        batch_op.alter_column(
            "username",
            existing_type=sa.String(current_length)
            if current_length
            else sa.String(64),
            type_=sa.String(128),
            existing_nullable=False,
        )


def downgrade():
    """Revert ab_user.username field from 128 to 64 characters."""
    # Check current column length
    column_info = get_table_column("ab_user", "username")

    if column_info is None:
        logger.warning("Column ab_user.username not found. Skipping downgrade.")
        return

    current_type = column_info.get("type")
    current_length = getattr(current_type, "length", None)

    if current_length is not None and current_length <= 64:
        logger.info(
            "Column ab_user.username already has length %s. Skipping downgrade.",
            current_length,
        )
        return

    with op.batch_alter_table("ab_user") as batch_op:
        batch_op.alter_column(
            "username",
            existing_type=sa.String(current_length)
            if current_length
            else sa.String(128),
            type_=sa.String(64),
            existing_nullable=False,
        )
