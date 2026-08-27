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
"""
Drop _customer_location_uc (take 2)

Revision ID: 16755d4ca4ae
Revises: f3a8c1d2e9b7
Create Date: 2026-07-31 10:00:00.000000
"""

import logging

from alembic import op
from migration_utils import create_unique_constraint, drop_unique_constraint
from sqlalchemy.engine.reflection import Inspector

from superset.utils.core import generic_find_uq_constraint_name

# revision identifiers, used by Alembic.
revision = "16755d4ca4ae"
down_revision = "f3a8c1d2e9b7"

logger = logging.getLogger("alembic.env")


def upgrade():
    """Re-attempt the constraint drop that migration ``df3d7e2eb9a4``
    intended but silently skipped.

    That migration passed a **list** to ``generic_find_uq_constraint_name``,
    whose body compared ``columns == set(uq["column_names"])`` — and
    ``list == set`` is always ``False`` in Python, so the constraint was
    never found and never dropped. Databases migrated through it still
    carry the legacy 3-column constraint ``(database_id, schema,
    table_name)``, which both leaks across catalogs (no ``catalog`` leg)
    and diverges from schemas built from model metadata, where the model's
    4-column constraint exists instead.

    The lookup below passes a set (and the helper itself coerces, so the
    foot-gun is gone either way). On databases where the legacy constraint
    is already absent the lookup finds nothing and the migration is a
    harmless no-op. The model's intended 4-column constraint can never
    match a 3-column set comparison, so it is not at risk.
    """
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)

    if constraint_name := generic_find_uq_constraint_name(
        "tables",
        {"database_id", "schema", "table_name"},
        inspector,
    ):
        drop_unique_constraint(op, constraint_name, "tables")


def downgrade():
    """Restore the legacy constraint, mirroring ``df3d7e2eb9a4``'s
    downgrade. Best-effort: rows written after the drop may legitimately
    collide on ``(database_id, schema, table_name)`` across catalogs, in
    which case the constraint cannot be recreated and the downgrade
    proceeds with a warning — matching the tolerant posture of the
    constraint's original creator, which wrapped creation in try/except.
    """
    try:
        create_unique_constraint(
            op,
            "_customer_location_uc",
            "tables",
            ["database_id", "schema", "table_name"],
        )
    except Exception:  # pylint: disable=broad-except
        logger.warning(
            "Could not recreate _customer_location_uc on 'tables'; existing "
            "rows likely collide on (database_id, schema, table_name) across "
            "catalogs. Continuing without the legacy constraint.",
            exc_info=True,
        )
