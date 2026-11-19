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
Revises: e7d93a524ff6
Create Date: 2026-07-31 00:00:00.000000

"""

import sqlalchemy as sa

from superset.migrations.shared.utils import add_columns, drop_columns

# revision identifiers, used by Alembic.
revision = "f3a8c1d2e9b7"
down_revision = "e7d93a524ff6"


def upgrade() -> None:
    """Add retry config and state columns to report_schedule.

    Columns that already exist are skipped, so a database that received them
    under another revision (e.g. a backport) can be stamped back onto this
    chain and upgrade without losing the stored values.
    """
    add_columns(
        "report_schedule",
        # User-configurable
        sa.Column(
            "retry_on_failure",
            sa.Boolean(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "retry_max_attempts",
            sa.Integer(),
            nullable=False,
            server_default="3",
        ),
        sa.Column(
            "send_failed_reports",
            sa.Boolean(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "retry_notify_owners",
            sa.Boolean(),
            nullable=False,
            server_default="1",
        ),
        sa.Column(
            "retry_notify_recipients",
            sa.Boolean(),
            nullable=False,
            server_default="0",
        ),
        # Execution engine state
        sa.Column(
            "retry_attempt",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column("retry_scheduled_dttm", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    """Remove retry config and state columns from report_schedule."""
    drop_columns(
        "report_schedule",
        "retry_scheduled_dttm",
        "retry_attempt",
        "retry_notify_recipients",
        "retry_notify_owners",
        "send_failed_reports",
        "retry_max_attempts",
        "retry_on_failure",
    )
