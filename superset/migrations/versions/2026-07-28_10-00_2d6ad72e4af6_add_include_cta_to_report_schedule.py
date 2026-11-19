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
"""add include_cta to report_schedule

Adds a nullable ``include_cta`` column to the ``report_schedule`` table. It controls
whether the call-to-action link back to Superset (e.g. "Explore in Superset") is
included in the notifications delivered for that schedule. The column defaults to
true and NULL is treated as true, so existing schedules keep the link.

Revision ID: 2d6ad72e4af6
Revises: 1a27941d5352
Create Date: 2026-07-28 10:00:00.000000

"""

import sqlalchemy as sa

from superset.migrations.shared.utils import add_columns, drop_columns

# revision identifiers, used by Alembic.
revision = "2d6ad72e4af6"
down_revision = "b8d2f4a6c901"


def upgrade() -> None:
    """Add the nullable ``include_cta`` column to ``report_schedule``."""
    add_columns(
        "report_schedule",
        sa.Column(
            "include_cta",
            sa.Boolean(),
            nullable=True,
            server_default=sa.true(),
        ),
    )


def downgrade() -> None:
    """Drop the ``include_cta`` column from ``report_schedule``."""
    drop_columns("report_schedule", "include_cta")
