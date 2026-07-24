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
"""Add ON DELETE behavior for a targeted set of ab_user foreign keys

Revision ID: 5f2a8b9c4d1e
Revises: 8f3a1b2c4d5e
Create Date: 2026-07-13 11:00:00.000000

Partial fix for #38629. Deleting a user via Settings → List Users raises
IntegrityError on PostgreSQL / MySQL / MariaDB because tables that
reference ``ab_user.id`` have no ``ON DELETE`` behavior on their foreign
key constraint. Scope is intentionally narrow — only the tables where
the correct semantics are unambiguous:

- **Pure audit trails** (``SET NULL``) — the row must survive when its
  author is deleted; the audit reference is cleared.

  - ``logs.user_id``
  - ``key_value.created_by_fk`` / ``key_value.changed_by_fk``

- **Owner-junction tables** (``CASCADE``) — the row has no meaning
  without the user.

  - ``favstar.user_id``
  - ``user_attribute.user_id``
  - ``tab_state.user_id``
  - ``user_favorite_tag.user_id``

**Deliberately deferred to a SIP** (per review on #41994): tables like
``saved_query``, ``query``, ``slices.last_saved_by_fk``, and everything
reached via ``AuditMixinNullable`` (``dashboards``, ``slices``, ``dbs``,
``tables``, ``report_schedule``, ...) — those represent user-owned
artifacts that should be *reassigned* to an admin rather than orphaned
with ``NULL``. The right long-term flow needs community design work.

This partial fix still unblocks the two user-reported failures on the
issue (``logs_ibfk_1`` and ``key_value_created_by_fk_fkey``) while the
SIP determines the reassignment semantics for the rest.

Same pattern as ``6d05b0a70c89`` (2023, owners refs) and
``32bf93dfe2a4`` (2025, FAB tables). Uses a local helper that filters
by ``local_cols`` because the shared ``redefine()`` helper matches only
by referred columns and would collide on tables with multiple FKs to
``ab_user.id`` (``created_by_fk`` + ``changed_by_fk``).
"""

from alembic import op
from sqlalchemy.engine.reflection import Inspector

# revision identifiers, used by Alembic.
revision = "5f2a8b9c4d1e"
down_revision = "8f3a1b2c4d5e"


# (table, column) pairs. Semantic split:
#   SET NULL — pure audit trail; row survives, reference cleared
#   CASCADE  — row has no meaning without the referenced user
_FKS_SET_NULL: list[tuple[str, str]] = [
    ("logs", "user_id"),
    ("key_value", "created_by_fk"),
    ("key_value", "changed_by_fk"),
]

_FKS_CASCADE: list[tuple[str, str]] = [
    ("favstar", "user_id"),
    ("user_attribute", "user_id"),
    ("tab_state", "user_id"),
    ("user_favorite_tag", "user_id"),
]


def _redefine_fk(
    table: str,
    local_col: str,
    on_delete: str | None,
) -> None:
    """DROP + RECREATE a single foreign key filtered by ``local_col``.

    Unlike ``superset.migrations.shared.constraints.redefine`` (which
    matches only by referred columns and would collide when a table has
    multiple FKs to the same target), this helper looks up the existing
    FK whose ``constrained_columns`` includes ``local_col``, drops that
    specific constraint, and creates a replacement with the requested
    ``ON DELETE`` clause.

    Silent no-op when the table or column does not exist on the target
    database — makes the migration safe to re-run and safe on installs
    that don't have every optional table.
    """
    bind = op.get_bind()
    insp = Inspector.from_engine(bind)

    if table not in insp.get_table_names():
        return

    column_names = {c["name"] for c in insp.get_columns(table)}
    if local_col not in column_names:
        return

    existing_name: str | None = None
    for fk in insp.get_foreign_keys(table):
        if (
            fk["referred_table"] == "ab_user"
            and fk["referred_columns"] == ["id"]
            and fk["constrained_columns"] == [local_col]
        ):
            existing_name = fk["name"]
            break

    conv = {"fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s"}
    with op.batch_alter_table(table, naming_convention=conv) as batch_op:
        if existing_name:
            batch_op.drop_constraint(existing_name, type_="foreignkey")
        batch_op.create_foreign_key(
            constraint_name=f"fk_{table}_{local_col}_ab_user",
            referent_table="ab_user",
            local_cols=[local_col],
            remote_cols=["id"],
            ondelete=on_delete,
        )


def upgrade():
    for table, col in _FKS_SET_NULL:
        _redefine_fk(table, col, on_delete="SET NULL")

    for table, col in _FKS_CASCADE:
        _redefine_fk(table, col, on_delete="CASCADE")


def downgrade():
    for table, col in _FKS_SET_NULL + _FKS_CASCADE:
        _redefine_fk(table, col, on_delete=None)
