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
confirmed to have no successor worth auto-granting). This one handles the
other half of apache/superset#33272: permissions that were deprecated but
effectively renamed/consolidated onto a permission that already exists on
current master, almost always as part of the API-ification of the old
``Superset`` monolithic view (``superset/views/core.py``) into per-resource
``ModelRestApi``s.

``can_my_queries`` rests on strong-but-not-decorator-level evidence rather
than a formal ``@deprecated(new_target=...)`` marker (the old endpoint's
literal redirect target) -- flagged here for reviewer awareness, not hidden.
It needs both ``SavedQuery.can_list`` (gating the page shell) and
``SavedQuery.can_read`` (gating the ``/api/v1/saved_query/`` list call the
page actually renders); granting only the former would leave a migrated role
looking at a page with no visible data.

Each mapping was verified against a genuine live ``superset init`` DB (not
just ``UPDATING.md`` wording, which is wrong for the ``can_sql_json`` and
``can_results`` rows -- it names a non-existent "can_execute"/"can_results"
permission; the correct live successors, confirmed by querying
``ab_permission``/``ab_permission_view``/``ab_view_menu``, are
``can_execute_sql_query`` and ``can_get_results`` on the ``SQLLab`` view
menu).

This uses the existing, unmodified ``migrate_roles``/``add_pvms`` helpers:
``add_pvms`` first guarantees every successor PVM exists so ``migrate_roles``
can never resolve a target to ``None``, then ``migrate_roles`` moves any role
holding an old PVM onto its successor(s) and deletes the old PVM (and its
Permission/ViewMenu, if now orphaned). Chained after the deletion migration,
though the two touch disjoint PVMs and their relative order does not matter.

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
    "Dataset": ("can_get_or_create_dataset", "can_read"),
    "SQLLab": ("can_estimate_query_cost", "can_execute_sql_query", "can_get_results"),
    "Dashboard": ("can_read", "can_write"),
    "AvailableDomains": ("can_read",),
    "SecurityRestApi": ("can_read",),
    "SavedQuery": ("can_list", "can_read"),
}

# Map each deprecated (view, permission) to its live successor(s).
# `migrate_roles` will, for every role holding an old PVM: add the successor
# (if missing), remove the old PVM, then delete the old PVM row -- and the
# underlying Permission/ViewMenu too, if they become orphans.
PVM_MAP = {
    # Unchanged from the original migration -- already correct.
    Pvm(OLD_VIEW_MENU, "can_explore_json"): (Pvm("Chart", "can_read"),),
    Pvm(OLD_VIEW_MENU, "can_slice_json"): (Pvm("Chart", "can_read"),),
    Pvm(OLD_VIEW_MENU, "can_search_queries"): (Pvm("Query", "can_read"),),
    Pvm(OLD_VIEW_MENU, "can_tables"): (Pvm("Database", "can_read"),),
    Pvm(OLD_VIEW_MENU, "can_queries"): (Pvm("Query", "can_read"),),
    Pvm(OLD_VIEW_MENU, "can_filter"): (Pvm("Datasource", "can_get_column_values"),),
    Pvm(OLD_VIEW_MENU, "can_recent_activity"): (Pvm("Log", "can_recent_activity"),),
    Pvm(OLD_VIEW_MENU, "can_stop_query"): (Pvm("Query", "can_read"),),
    Pvm(OLD_VIEW_MENU, "can_estimate_query_cost"): (
        Pvm("SQLLab", "can_estimate_query_cost"),
    ),
    Pvm(OLD_VIEW_MENU, "can_sql_json"): (Pvm("SQLLab", "can_execute_sql_query"),),
    Pvm(OLD_VIEW_MENU, "can_results"): (Pvm("SQLLab", "can_get_results"),),
    # Corrected: the old key here was "can_get_or_create_table", a permission
    # name that never actually existed (no method named get_or_create_table
    # was ever generated by FAB) -- the real historical permission for this
    # capability was "can_sqllab_table_viz" (def sqllab_table_viz, route
    # /get_or_create_table/, PR #22931/#24375).
    Pvm(OLD_VIEW_MENU, "can_sqllab_table_viz"): (
        Pvm("Dataset", "can_get_or_create_dataset"),
    ),
    # Reclassified from the delete migration: each of these was originally
    # believed to have no successor, but actually has a verified live one
    # (PR body / @deprecated(new_target=...) evidence -- see file docstring).
    Pvm(OLD_VIEW_MENU, "can_select_star"): (Pvm("Database", "can_read"),),
    Pvm(OLD_VIEW_MENU, "can_available_domains"): (Pvm("AvailableDomains", "can_read"),),
    Pvm(OLD_VIEW_MENU, "can_validate_sql_json"): (Pvm("Database", "can_read"),),
    Pvm(OLD_VIEW_MENU, "can_schemas_access_for_file_upload"): (
        Pvm("Database", "can_read"),
    ),
    Pvm(OLD_VIEW_MENU, "can_extra_table_metadata"): (Pvm("Database", "can_read"),),
    Pvm(OLD_VIEW_MENU, "can_datasources"): (Pvm("Dataset", "can_read"),),
    # Kept as a rename (unlike its PR #24353 sibling can_add_slices, moved to
    # the delete migration): the live `copy_dash` REST route today is still
    # gated by exactly this permission, Dashboard.can_write -- a genuine 1:1
    # match for the old action, not a broader, unrelated grant.
    Pvm(OLD_VIEW_MENU, "can_copy_dash"): (Pvm("Dashboard", "can_write"),),
    Pvm("SqlLab", "can_my_queries"): (
        Pvm("SavedQuery", "can_list"),
        Pvm("SavedQuery", "can_read"),
    ),
    Pvm(OLD_VIEW_MENU, "can_created_dashboards"): (Pvm("Dashboard", "can_read"),),
    Pvm(OLD_VIEW_MENU, "can_created_slices"): (Pvm("Chart", "can_read"),),
    Pvm(OLD_VIEW_MENU, "can_fave_dashboards"): (Pvm("Dashboard", "can_read"),),
    Pvm(OLD_VIEW_MENU, "can_fave_slices"): (Pvm("Chart", "can_read"),),
    Pvm(OLD_VIEW_MENU, "can_favstar"): (
        Pvm("Dashboard", "can_read"),
        Pvm("Chart", "can_read"),
    ),
    Pvm(OLD_VIEW_MENU, "can_user_slices"): (Pvm("Chart", "can_read"),),
    Pvm(OLD_VIEW_MENU, "can_csrf_token"): (Pvm("SecurityRestApi", "can_read"),),
    # Genuinely missing from the original migration entirely (same 3.0-era
    # API-ification, same evidence standard as above).
    Pvm(OLD_VIEW_MENU, "can_annotation_json"): (Pvm("Chart", "can_read"),),
    Pvm(OLD_VIEW_MENU, "can_fave_dashboards_by_username"): (
        Pvm("Dashboard", "can_read"),
    ),
}


def do_upgrade(session: Session) -> None:
    add_pvms(session, NEW_PVMS)
    migrate_roles(session, PVM_MAP)


def do_downgrade(session: Session) -> None:
    """Intentionally a no-op.

    The successor permissions (``can_read``, etc.) are live, actively-created
    permissions used well beyond these deprecated routes, so they must not be
    deleted or have roles stripped of them on downgrade. Recreating the
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
