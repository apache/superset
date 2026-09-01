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
"""replay user_favorite_tag migration for users upgrading from 3.0.x

This migration replays the user_favorite_tag table creation for users who
upgraded from Superset 3.0.x and missed migration e0f6f91c2055 due to
out-of-order migration timestamps.

See: https://github.com/apache/superset/issues/29836

The original migration (e0f6f91c2055) was dated 2023-07-12 but depended on
bf646a0c1501 which was dated 2023-06-28. However, bf646a0c1501's down_revision
(a23c6f8b1280) was dated 2023-07-19, creating a temporal inconsistency that
caused Alembic to skip these migrations for users upgrading through the 3.0.x
release line.

This replay migration safely re-runs the table creation using idempotent
utilities, ensuring the user_favorite_tag table exists regardless of the
upgrade path taken.

Revision ID: 31dae2559c05
Revises: 33d7e0e21daa
Create Date: 2026-04-22 19:00:00.000000

"""

from importlib import import_module

# revision identifiers, used by Alembic.
revision = "31dae2559c05"
down_revision = "33d7e0e21daa"

# Import the original migration module
module = import_module(
    "superset.migrations.versions.2023-07-12_20-34_e0f6f91c2055_create_user_favorite_table"
)


def upgrade():
    """
    Replay the user_favorite_tag table creation.

    This uses the idempotent create_table() utility from the original migration,
    which safely skips creation if the table already exists.
    """
    module.upgrade()


def downgrade():
    """
    Note: We intentionally do NOT call module.downgrade() here.

    If someone downgrades past this migration, we don't want to drop the
    user_favorite_tag table because:
    1. It may have been created by the original migration (e0f6f91c2055)
    2. Dropping it would cause data loss

    Downgrade behavior depends on the user's migration history:
    - Users who already have e0f6f91c2055 applied: the table is dropped by
      that migration's own downgrade() when they downgrade past it.
    - 3.0.x-only upgraders (the bug this replay fixes): e0f6f91c2055 is not in
      their history, so nothing ever drops the table. It intentionally persists
      after a downgrade -- there is no safe way to distinguish a table created
      by this replay from one created by the original migration, so we err on
      the side of preserving user data.
    """
    pass
