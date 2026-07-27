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
"""add_report_retry_columns

Revision ID: f3a8c1d2e9b7
Revises: e5f6a7b8c9d0
Create Date: 2026-07-24 00:00:00.000000

"""

import logging

import sqlalchemy as sa
from alembic import op

from superset.migrations.shared.utils import get_table_column

logger = logging.getLogger("alembic.env")

# revision identifiers, used by Alembic.
revision = "f3a8c1d2e9b7"
down_revision = "e5f6a7b8c9d0"

# Configuration columns (user-configurable)
_CONFIG_COLUMNS = [
    ("retry_on_failure", sa.Boolean(), False, "0"),
    ("retry_max_attempts", sa.Integer(), False, "3"),
    ("send_failed_reports", sa.Boolean(), False, "0"),
    ("retry_notify_owners", sa.Boolean(), False, "1"),
    ("retry_notify_recipients", sa.Boolean(), False, "0"),
]

# State columns (written by the execution engine)
_STATE_COLUMNS = [
    ("retry_attempt", sa.Integer(), False, "0"),
    ("retry_scheduled_dttm", sa.DateTime(), True, None),
]


def upgrade() -> None:
    """Add retry config and state columns to report_schedule."""
    if get_table_column("report_schedule", "retry_attempt") is not None:
        logger.info(
            "Column report_schedule.retry_attempt already exists. Skipping migration."
        )
        return

    with op.batch_alter_table("report_schedule") as batch_op:
        for name, col_type, nullable, default in _CONFIG_COLUMNS + _STATE_COLUMNS:
            batch_op.add_column(
                sa.Column(
                    name,
                    col_type,
                    nullable=nullable,
                    server_default=default,
                )
            )


def downgrade() -> None:
    """Remove retry config and state columns from report_schedule."""
    if get_table_column("report_schedule", "retry_attempt") is None:
        logger.info(
            "Column report_schedule.retry_attempt does not exist. Skipping downgrade."
        )
        return

    with op.batch_alter_table("report_schedule") as batch_op:
        for name, _, _, _ in _CONFIG_COLUMNS + _STATE_COLUMNS:
            batch_op.drop_column(name)
