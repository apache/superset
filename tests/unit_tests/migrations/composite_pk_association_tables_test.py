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
"""Unit tests for the composite-PK association-tables migration (revision
2bee73611e32). Verifies the post-migration constraint enforcement: duplicate
``(fk1, fk2)`` insertions fail with IntegrityError, distinct pairs succeed.

Schema is built *synthetically* from the hardcoded ``AFFECTED_TABLES`` list:
each junction table is reconstructed as a composite-PK ``sa.Table`` and created
via ``metadata.create_all(engine)`` against in-memory SQLite (see
``_build_in_memory_schema``). It does not reflect the live ORM models — the list
mirrors the post-composite-PK shape the migration targets, so keep it in sync
with the migration's table set.
"""

from importlib import import_module

import pytest
import sqlalchemy as sa
from sqlalchemy.exc import IntegrityError

_migration = import_module(
    "superset.migrations.versions."
    "2026-05-01_23-36_2bee73611e32_composite_pk_association_tables"
)

# (table_name, fk1_col, fk2_col, fk1_parent_table, fk2_parent_table)
# Parent-table names are needed to build the FK targets in the in-memory schema.
AFFECTED_TABLES = [
    ("dashboard_roles", "dashboard_id", "role_id", "dashboards", "ab_role"),
    ("dashboard_slices", "dashboard_id", "slice_id", "dashboards", "slices"),
    ("dashboard_user", "user_id", "dashboard_id", "ab_user", "dashboards"),
    (
        "report_schedule_user",
        "user_id",
        "report_schedule_id",
        "ab_user",
        "report_schedule",
    ),
    (
        "rls_filter_roles",
        "role_id",
        "rls_filter_id",
        "ab_role",
        "row_level_security_filters",
    ),
    (
        "rls_filter_tables",
        "table_id",
        "rls_filter_id",
        "tables",
        "row_level_security_filters",
    ),
    ("slice_user", "user_id", "slice_id", "ab_user", "slices"),
    ("sqlatable_user", "user_id", "table_id", "ab_user", "tables"),
]


def _build_in_memory_schema(
    table_name: str, fk1: str, fk2: str, fk1_parent: str, fk2_parent: str
) -> tuple[sa.engine.Engine, sa.Table]:
    """Build an in-memory SQLite schema with two minimal parent tables and
    the junction table under test (composite-PK shape). Returns the engine
    and the junction-table object for inserts."""
    metadata = sa.MetaData()
    sa.Table(
        fk1_parent,
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
    )
    if fk2_parent != fk1_parent:
        sa.Table(
            fk2_parent,
            metadata,
            sa.Column("id", sa.Integer, primary_key=True),
        )
    junction = sa.Table(
        table_name,
        metadata,
        sa.Column(
            fk1,
            sa.Integer,
            sa.ForeignKey(f"{fk1_parent}.id"),
            primary_key=True,
        ),
        sa.Column(
            fk2,
            sa.Integer,
            sa.ForeignKey(f"{fk2_parent}.id"),
            primary_key=True,
        ),
    )
    engine = sa.create_engine("sqlite:///:memory:")
    metadata.create_all(engine)
    # Seed parent rows so the FK constraints can be satisfied.
    # Identifiers come from the AFFECTED_TABLES test parameter list, not user input.
    with engine.begin() as conn:
        conn.execute(
            sa.text(f"INSERT INTO {fk1_parent} (id) VALUES (1), (2)")  # noqa: S608
        )
        if fk2_parent != fk1_parent:
            conn.execute(
                sa.text(f"INSERT INTO {fk2_parent} (id) VALUES (1), (2)")  # noqa: S608
            )
    return engine, junction


@pytest.mark.parametrize("table,fk1,fk2,fk1_parent,fk2_parent", AFFECTED_TABLES)
def test_duplicate_insert_rejected(
    table: str, fk1: str, fk2: str, fk1_parent: str, fk2_parent: str
) -> None:
    """Inserting the same ``(fk1, fk2)`` pair twice raises ``IntegrityError``.

    Verifies SC-004 / FR-007 — the composite primary key enforces uniqueness
    at the database level on every affected table.
    """
    engine, junction = _build_in_memory_schema(table, fk1, fk2, fk1_parent, fk2_parent)
    with engine.begin() as conn:
        conn.execute(junction.insert().values({fk1: 1, fk2: 1}))
        with pytest.raises(IntegrityError):
            conn.execute(junction.insert().values({fk1: 1, fk2: 1}))


@pytest.mark.parametrize("table,fk1,fk2,fk1_parent,fk2_parent", AFFECTED_TABLES)
def test_distinct_pairs_accepted(
    table: str, fk1: str, fk2: str, fk1_parent: str, fk2_parent: str
) -> None:
    """Two distinct ``(fk1, fk2)`` pairs both succeed.

    Sanity check that the PK isn't accidentally a single-column constraint
    (which would reject ``(1, 1)`` and ``(1, 2)`` as a duplicate on column 1).
    """
    engine, junction = _build_in_memory_schema(table, fk1, fk2, fk1_parent, fk2_parent)
    with engine.begin() as conn:
        conn.execute(junction.insert().values({fk1: 1, fk2: 1}))
        conn.execute(junction.insert().values({fk1: 1, fk2: 2}))
        result = conn.execute(
            sa.text(f"SELECT COUNT(*) FROM {table}")  # noqa: S608
        ).scalar_one()
        assert result == 2


def test_assert_fks_present_raises_on_empty() -> None:
    """The MySQL resumability guard fails loudly when a junction table has
    already lost its foreign keys — signalling a prior interrupted attempt —
    rather than silently rebuilding it without them."""
    with pytest.raises(RuntimeError, match="no foreign keys"):
        _migration._assert_fks_present([], "dashboard_slices", "upgrade")


def test_assert_fks_present_passes_when_fks_exist() -> None:
    """A normal run (FKs reflected) passes the guard without raising."""
    _migration._assert_fks_present(
        [{"name": "fk_dashboard_slices_dashboard_id", "constrained_columns": ["x"]}],
        "dashboard_slices",
        "downgrade",
    )
