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

"""Add a (dttm, dashboard_id) index to the logs table.

The top_n_dashboards cache warm-up strategy and log pruning filter on dttm
without user_id, so the existing (user_id, dttm) index cannot serve them and
the whole table is scanned. Including dashboard_id lets the warm-up query's
dashboard count be answered from the index alone.

Revision ID: c74a534819bf
Revises: b8f3a2c91d64
"""

from alembic import op

from superset.migrations.shared.utils import create_index, drop_index

revision: str = "c74a534819bf"
down_revision: str = "b8f3a2c91d64"

TABLE_NAME = "logs"
INDEX_NAME = "ix_logs_dttm_dashboard_id"


def upgrade() -> None:
    """Index time-windowed log scans, including the dashboard popularity count."""
    context = op.get_context()
    if context.dialect.name == "postgresql":
        if context.as_sql:
            op.execute(
                f"CREATE INDEX IF NOT EXISTS {INDEX_NAME} "
                f"ON {TABLE_NAME} (dttm, dashboard_id)"
            )
        else:
            # logs is written on every logged action and can be very large, so
            # avoid blocking writes for the duration of the build.
            with context.autocommit_block():
                op.execute(
                    f"CREATE INDEX CONCURRENTLY IF NOT EXISTS {INDEX_NAME} "
                    f"ON {TABLE_NAME} (dttm, dashboard_id)"
                )
    else:
        create_index(TABLE_NAME, INDEX_NAME, ["dttm", "dashboard_id"])


def downgrade() -> None:
    """Remove the time-windowed log index."""
    context = op.get_context()
    if context.dialect.name == "postgresql":
        if context.as_sql:
            op.execute(f"DROP INDEX IF EXISTS {INDEX_NAME}")
        else:
            with context.autocommit_block():
                op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {INDEX_NAME}")
    else:
        drop_index(TABLE_NAME, INDEX_NAME)
