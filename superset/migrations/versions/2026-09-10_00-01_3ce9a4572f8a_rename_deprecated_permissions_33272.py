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
"""migrate roles off deprecated, renamed permissions (#33272)

Companion to the previous migration (which deletes deprecated permissions
that have no successor). This one handles the other half of
apache/superset#33272: permissions that were deprecated but effectively
renamed/consolidated onto a permission that already exists on current master,
almost always as part of the API-ification of the old ``Superset`` monolithic
view (``superset/views/core.py``) into per-resource ``ModelRestApi``s whose
generic CRUD methods map to ``can_read``.

Each mapping below was verified with a genuine live ``superset init`` DB (not
just ``UPDATING.md`` wording, which is wrong for the ``can_sql_json`` and
``can_results`` rows -- it names a non-existent "can_execute"/"can_results"
permission; the correct live successors, confirmed by querying
``ab_permission``/``ab_permission_view``/``ab_view_menu``, are
``can_execute_sql_query`` and ``can_get_results`` on the ``SQLLab`` view menu):

- ``can_explore_json`` -> ``can_read`` on ``Chart`` (PR #41714)
- ``can_slice_json`` -> ``can_read`` on ``Chart`` (PR #22496, #24423)
- ``can_search_queries`` -> ``can_read`` on ``Query`` (PR #22579)
- ``can_tables`` -> ``can_read`` on ``Database`` (PR #22501, #24342)
- ``can_queries`` -> ``can_read`` on ``Query`` (PR #22611)
- ``can_filter`` -> ``can_get_column_values`` on ``Datasource`` (PR #22882, #24335)
- ``can_recent_activity`` (``Superset``) -> ``can_recent_activity`` on ``Log``
  (PR #22789, #24400)
- ``can_get_or_create_table`` -> ``can_get_or_create_dataset`` on ``Dataset``
  (PR #22931)
- ``can_stop_query`` -> ``can_read`` on ``Query`` (PR #22624)
- ``can_estimate_query_cost`` (``Superset``) -> ``can_estimate_query_cost`` on
  ``SQLLab`` (PR #23226)
- ``can_sql_json`` -> ``can_execute_sql_query`` on ``SQLLab`` (PR #22809)
- ``can_results`` -> ``can_get_results`` on ``SQLLab`` (PR #22809)

All twelve old permissions live on the ``Superset`` view menu. This uses the
existing, unmodified ``migrate_roles``/``add_pvms`` helpers: ``add_pvms`` first
guarantees every successor PVM exists so ``migrate_roles`` can never resolve a
target to ``None``, then ``migrate_roles`` moves any role holding an old PVM
onto its successor(s) and deletes the old PVM (and its Permission/ViewMenu, if
now orphaned). Chained after the deletion migration, though the two touch
disjoint PVMs and their relative order does not matter.

Revision ID: 3ce9a4572f8a
Revises: 1f5f4fb8bfc1
Create Date: 2026-09-10 00:01:00.000000

"""

# revision identifiers, used by Alembic.
revision = "3ce9a4572f8a"
down_revision = "1f5f4fb8bfc1"

from alembic import op  # noqa: E402
from sqlalchemy.exc import SQLAlchemyError  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from superset.migrations.shared.security_converge import (  # noqa: E402
    add_pvms,
    migrate_roles,
    Pvm,
)

OLD_VIEW_MENU = "Superset"

# The live permissions these old ones are being folded into. Ensured present
# before `migrate_roles` runs so lookups can't resolve to None (they normally
# already exist -- FAB creates them on startup -- this just makes the
# migration self-contained).
NEW_PVMS = {
    "Chart": ("can_read",),
    "Query": ("can_read",),
    "Database": ("can_read",),
    "Datasource": ("can_get_column_values",),
    "Log": ("can_recent_activity",),
    "Dataset": ("can_get_or_create_dataset",),
    "SQLLab": ("can_estimate_query_cost", "can_execute_sql_query", "can_get_results"),
}

# Map each deprecated (view, permission) to its live successor(s).
# `migrate_roles` will, for every role holding an old PVM: add the successor
# (if missing), remove the old PVM, then delete the old PVM row -- and the
# underlying Permission/ViewMenu too, if they become orphans.
PVM_MAP = {
    Pvm(OLD_VIEW_MENU, "can_explore_json"): (Pvm("Chart", "can_read"),),
    Pvm(OLD_VIEW_MENU, "can_slice_json"): (Pvm("Chart", "can_read"),),
    Pvm(OLD_VIEW_MENU, "can_search_queries"): (Pvm("Query", "can_read"),),
    Pvm(OLD_VIEW_MENU, "can_tables"): (Pvm("Database", "can_read"),),
    Pvm(OLD_VIEW_MENU, "can_queries"): (Pvm("Query", "can_read"),),
    Pvm(OLD_VIEW_MENU, "can_filter"): (Pvm("Datasource", "can_get_column_values"),),
    Pvm(OLD_VIEW_MENU, "can_recent_activity"): (Pvm("Log", "can_recent_activity"),),
    Pvm(OLD_VIEW_MENU, "can_get_or_create_table"): (
        Pvm("Dataset", "can_get_or_create_dataset"),
    ),
    Pvm(OLD_VIEW_MENU, "can_stop_query"): (Pvm("Query", "can_read"),),
    Pvm(OLD_VIEW_MENU, "can_estimate_query_cost"): (
        Pvm("SQLLab", "can_estimate_query_cost"),
    ),
    Pvm(OLD_VIEW_MENU, "can_sql_json"): (Pvm("SQLLab", "can_execute_sql_query"),),
    Pvm(OLD_VIEW_MENU, "can_results"): (Pvm("SQLLab", "can_get_results"),),
}


def do_upgrade(session: Session) -> None:
    add_pvms(session, NEW_PVMS)
    migrate_roles(session, PVM_MAP)


def do_downgrade(session: Session) -> None:
    """Intentionally a no-op.

    The successor permissions (``can_read``, etc.) are live, actively-created
    permissions used well beyond these twelve deprecated routes, so they must
    not be deleted or have roles stripped of them on downgrade. Recreating the
    deprecated PVMs and moving roles back onto them would just reintroduce
    permissions current code can no longer create or check.
    """


def upgrade() -> None:
    bind = op.get_bind()
    session = Session(bind=bind)
    do_upgrade(session)
    try:
        session.commit()
    except SQLAlchemyError as ex:
        session.rollback()
        raise Exception(f"An error occurred while upgrading permissions: {ex}") from ex


def downgrade() -> None:
    bind = op.get_bind()
    session = Session(bind=bind)
    do_downgrade(session)
    try:
        session.commit()
    except SQLAlchemyError as ex:
        session.rollback()
        raise Exception(
            f"An error occurred while downgrading permissions: {ex}"
        ) from ex
