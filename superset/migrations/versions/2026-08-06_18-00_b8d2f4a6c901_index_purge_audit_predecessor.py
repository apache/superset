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
"""Index purge audit predecessor lookups.

Revision ID: b8d2f4a6c901
Revises: d7cecc48bd55
Create Date: 2026-08-06 18:00:00.000000

"""

from superset.migrations.shared.utils import create_index, drop_index

# revision identifiers, used by Alembic.
revision: str = "b8d2f4a6c901"
down_revision: str = "d7cecc48bd55"

_INDEX_NAME: str = "ix_purge_audit_log_retention_predecessor"


def upgrade() -> None:
    create_index(
        "purge_audit_log",
        _INDEX_NAME,
        ["entity_uuid", "entity_type", "trigger", "created_on"],
    )


def downgrade() -> None:
    drop_index("purge_audit_log", _INDEX_NAME)
