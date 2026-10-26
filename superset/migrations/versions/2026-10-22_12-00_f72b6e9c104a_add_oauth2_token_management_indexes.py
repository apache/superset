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

"""Add a database lookup index for OAuth2 token management.

Revision ID: f72b6e9c104a
Revises: d623a0cb6bb0
"""

from alembic import op

from superset.migrations.shared.utils import create_index, drop_index, is_mysql

revision: str = "f72b6e9c104a"
down_revision: str = "d623a0cb6bb0"

TABLE_NAME = "database_user_oauth2_tokens"
INDEX_NAME = "idx_oauth2_tokens_database_id"


def upgrade() -> None:
    """Index connection-scoped token listings, counts, and deletions."""
    # MySQLDB already indexes database_id to support its foreign key.
    if is_mysql():
        return
    context = op.get_context()
    if context.dialect.name == "postgresql":
        if context.as_sql:
            op.execute(
                f"CREATE INDEX IF NOT EXISTS {INDEX_NAME} ON {TABLE_NAME} (database_id)"
            )
        else:
            with context.autocommit_block():
                op.execute(
                    f"CREATE INDEX CONCURRENTLY IF NOT EXISTS {INDEX_NAME} "
                    f"ON {TABLE_NAME} (database_id)"
                )
    else:
        create_index(TABLE_NAME, INDEX_NAME, ["database_id"])


def downgrade() -> None:
    """Remove the lookup index while preserving credentials and uniqueness."""
    if is_mysql():
        return
    context = op.get_context()
    if context.dialect.name == "postgresql":
        if context.as_sql:
            op.execute(f"DROP INDEX IF EXISTS {INDEX_NAME}")
        else:
            with context.autocommit_block():
                op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {INDEX_NAME}")
    else:
        drop_index(TABLE_NAME, INDEX_NAME)
