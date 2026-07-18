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
"""Add an index on version_transaction.issued_at.

The version-history retention prune selects candidates using
``issued_at < cutoff`` and returns them in primary-key order. PostgreSQL 17
and MySQL 8 planner checks with 500,000 transactions showed that the primary
key remains optimal when expired rows exist near the low-id end. When no rows
meet the cutoff, however, the primary-key plan scans the entire table. Both
engines choose this index for that case, reducing it to an empty range scan,
while retaining the primary-key plan for a populated backlog.

Revision ID: d3b9a1f6c204
Revises: 8f3a1b2c4d5e
Create Date: 2026-06-15 16:30:00.000000
"""

from superset.migrations.shared.utils import create_index, drop_index

revision: str = "d3b9a1f6c204"
down_revision: str = "8f3a1b2c4d5e"

INDEX_NAME: str = "ix_version_transaction_issued_at"
TABLE_NAME: str = "version_transaction"


def upgrade() -> None:
    """Create the retention cutoff index if it does not exist."""
    create_index(TABLE_NAME, INDEX_NAME, ["issued_at"], unique=False)


def downgrade() -> None:
    """Remove the retention cutoff index."""
    drop_index(TABLE_NAME, INDEX_NAME)
