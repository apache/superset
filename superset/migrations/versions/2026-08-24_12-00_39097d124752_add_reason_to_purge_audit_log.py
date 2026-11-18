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
"""Add a reason to purge_audit_log.

Adds a nullable ``reason`` column to ``purge_audit_log`` holding a stable
machine code identifying which policy rule blocked a purge (or the
cascade-integrity failure class). Written at finalization for
blocked outcomes only; NULL for confirmed, failed, non-blocked, and
pre-existing rows. No backfill: the information was never captured for
historical records, and readers treat the column as optional.

Apply this migration before deploying the code that depends on it. The
audit model declares the column, so a worker running the new code against
the un-migrated table cannot write its write-ahead record; the scheduled
purge then fails closed (nothing is purged unaudited) and logs a
write-ahead warning every run until the migration lands.

The downgrade discards every recorded block reason -- the rows survive and
revert to reason-less, exactly like pre-feature history.

Revision ID: 39097d124752
Revises: 1072de5ed955
Create Date: 2026-08-24 12:00:00.000000

"""

import sqlalchemy as sa

from superset.migrations.shared.utils import add_columns, drop_columns

# revision identifiers, used by Alembic.
revision: str = "39097d124752"
down_revision: str = "1072de5ed955"


def upgrade() -> None:
    """Add the nullable ``reason`` column to ``purge_audit_log``."""
    add_columns(
        "purge_audit_log",
        sa.Column("reason", sa.String(64), nullable=True),
    )


def downgrade() -> None:
    """Drop the ``reason`` column from ``purge_audit_log``."""
    drop_columns("purge_audit_log", "reason")
