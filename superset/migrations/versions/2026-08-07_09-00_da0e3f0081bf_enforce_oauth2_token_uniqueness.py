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
"""Enforce one OAuth2 token per (user_id, database_id).

`OAuth2StoreTokenCommand` always deletes any existing token for a
user+database pair before storing a new one, so the table is only ever
meant to carry a single live row per pair -- but that invariant was only
enforced in application code, via a plain (non-unique) lookup index. A
race between two concurrent OAuth2 callbacks for the same user+database
can leave duplicate rows behind, and nothing downstream picks a
deterministic one of them. Flagged as a follow-up during review of #42211
(which fixed an unrelated `purge_oauth2_tokens` filter bug on this same
table).

Pre-flight: deletes any pre-existing duplicate rows, keeping the
highest-id row per (user_id, database_id) pair, since
`OAuth2StoreTokenCommand` always deletes-then-inserts and a higher id is
therefore the more recently issued token.

Revision ID: da0e3f0081bf
Revises: b8d2f4a6c901
Create Date: 2026-08-07 09:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

from superset.migrations.shared.utils import create_index, drop_index

# revision identifiers, used by Alembic.
revision: str = "da0e3f0081bf"
down_revision: str = "b8d2f4a6c901"

TABLE_NAME = "database_user_oauth2_tokens"
INDEX_NAME = "idx_user_id_database_id"
# Temporary name for the unique index while it and the old non-unique index
# briefly coexist -- see the comment in ``upgrade`` below.
TMP_INDEX_NAME = "idx_user_id_database_id_tmp_unique"


def upgrade() -> None:
    bind = op.get_bind()
    metadata = sa.MetaData()
    table = sa.Table(TABLE_NAME, metadata, autoload_with=bind)

    # Find the highest id per (user_id, database_id) pair by reading into
    # Python first, rather than deleting via a subquery on the same table:
    # MySQL rejects a DELETE whose WHERE clause subqueries the target table
    # (error 1093).
    rows = bind.execute(
        sa.select(table.c.id, table.c.user_id, table.c.database_id)
    ).fetchall()
    max_id_by_pair: dict[tuple[int, int], int] = {}
    for row in rows:
        pair = (row.user_id, row.database_id)
        if row.id > max_id_by_pair.get(pair, -1):
            max_id_by_pair[pair] = row.id
    keep_ids = set(max_id_by_pair.values())
    dupe_ids = [row.id for row in rows if row.id not in keep_ids]
    if dupe_ids:
        bind.execute(table.delete().where(table.c.id.in_(dupe_ids)))

    # MySQL's InnoDB won't drop an index that's still needed to satisfy a
    # foreign key (error 1553) -- the existing (user_id, database_id) index
    # is the only one covering the `user_id` FK. Create the new unique
    # index (which covers the same leading column) before dropping the old
    # one, so an FK-satisfying index always exists, then swap it into its
    # final name.
    create_index(TABLE_NAME, TMP_INDEX_NAME, ["user_id", "database_id"], unique=True)
    drop_index(TABLE_NAME, INDEX_NAME)
    create_index(TABLE_NAME, INDEX_NAME, ["user_id", "database_id"], unique=True)
    drop_index(TABLE_NAME, TMP_INDEX_NAME)


def downgrade() -> None:
    # The pre-flight dedupe above is not reversible -- any rows it removed
    # stay removed -- but that only ever discards rows that violated the
    # single-token-per-pair invariant the application already assumed.
    create_index(TABLE_NAME, TMP_INDEX_NAME, ["user_id", "database_id"])
    drop_index(TABLE_NAME, INDEX_NAME)
    create_index(TABLE_NAME, INDEX_NAME, ["user_id", "database_id"])
    drop_index(TABLE_NAME, TMP_INDEX_NAME)
