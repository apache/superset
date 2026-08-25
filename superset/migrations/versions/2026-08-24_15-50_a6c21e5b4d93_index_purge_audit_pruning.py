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
"""Index purge-audit pruning predicates.

Revision ID: a6c21e5b4d93
Revises: 39097d124752
Create Date: 2026-08-24 15:50:00.000000

"""

from superset.migrations.shared.utils import create_index, drop_index

# revision identifiers, used by Alembic.
revision: str = "a6c21e5b4d93"
down_revision: str = "39097d124752"

_TABLE_NAME: str = "purge_audit_log"
_INDEX_NAME: str = "ix_purge_audit_log_pruning"


def upgrade() -> None:
    """Add an index matching recurring pruning access patterns."""
    create_index(
        _TABLE_NAME,
        _INDEX_NAME,
        ["status", "entity_type", "entity_uuid", "created_on"],
    )


def downgrade() -> None:
    """Remove the purge-audit pruning index."""
    drop_index(_TABLE_NAME, _INDEX_NAME)
