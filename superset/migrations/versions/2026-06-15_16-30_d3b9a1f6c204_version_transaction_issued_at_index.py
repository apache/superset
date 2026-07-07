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
"""add index on version_transaction.issued_at

The version-history retention prune (``version_history.prune_old_versions``)
selects candidate transactions with ``WHERE issued_at < cutoff``. Without an
index on ``issued_at`` every scheduled run sequentially scans the
``version_transaction`` table, which only grows over time (live-bearing rows
are never deleted). This adds a btree index so the candidate scan is a range
scan instead of a full-table scan.

Revision ID: d3b9a1f6c204
Revises: 8f3a1b2c4d5e
Create Date: 2026-06-15 16:30:00.000000

"""

from superset.migrations.shared.utils import create_index, drop_index

# revision identifiers, used by Alembic.
revision = "d3b9a1f6c204"
down_revision = "8f3a1b2c4d5e"

INDEX_NAME = "ix_version_transaction_issued_at"
TABLE_NAME = "version_transaction"


def upgrade():
    # Idempotent helper (skips if the index already exists) so a re-run after
    # a partially-applied upgrade doesn't error.
    create_index(TABLE_NAME, INDEX_NAME, ["issued_at"], unique=False)


def downgrade():
    drop_index(TABLE_NAME, INDEX_NAME)
