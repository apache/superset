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
"""Normalize legacy database metadata cache timeouts.

Older database forms stored metadata cache timeouts as strings. Convert only
recognized non-negative integer strings, preserving malformed configurations
and unrelated fields instead of guessing at their intended values.

Revision ID: 9670ab7f6bc6
Revises: d623a0cb6bb0
Create Date: 2026-10-27 00:00:00.000000
"""

from decimal import InvalidOperation

# The shared JSON wrapper cannot decode decimals without losing stored precision.
import simplejson  # noqa: TID251
from alembic import op
from sqlalchemy import column, Integer, select, table, Text

from superset.utils import json

revision = "9670ab7f6bc6"
down_revision = "d623a0cb6bb0"

_DATABASES = table("dbs", column("id", Integer), column("extra", Text))
_TIMEOUT_KEYS = (
    "catalog_cache_timeout",
    "schema_cache_timeout",
    "table_cache_timeout",
)


def upgrade() -> None:
    """Convert legacy non-negative integer strings to integer timeouts."""
    connection = op.get_bind()
    for database_id, raw_extra in connection.execute(
        select(_DATABASES.c.id, _DATABASES.c.extra).with_for_update()
    ):
        try:
            extra = simplejson.loads(raw_extra, use_decimal=True)
        except (TypeError, ValueError, InvalidOperation):
            continue
        if not isinstance(extra, dict) or not isinstance(
            extra.get("metadata_cache_timeout"), dict
        ):
            continue
        timeouts = extra["metadata_cache_timeout"]

        changed = False
        for key in _TIMEOUT_KEYS:
            value = timeouts.get(key)
            if not isinstance(value, str):
                continue
            try:
                timeout = int(value)
            except ValueError:
                continue
            if timeout < 0:
                continue
            timeouts[key] = timeout
            changed = True

        if changed:
            result = connection.execute(
                _DATABASES.update()
                .where(_DATABASES.c.id == database_id, _DATABASES.c.extra == raw_extra)
                .values(extra=json.dumps(extra))
            )
            if result.rowcount != 1:
                raise RuntimeError(
                    f"Database {database_id} configuration changed during migration; "
                    "retry the upgrade with database configuration edits paused."
                )


def downgrade() -> None:
    """Keep integers, which older versions support, without guessing original types.

    An integer may have been present before upgrade or saved afterward. Turning
    it into a string would change valid user configuration and reintroduce the bug.
    """
