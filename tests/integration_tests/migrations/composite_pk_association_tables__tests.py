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
"""Schema-shape assertion tests for the composite-PK association-tables
migration (revision 2bee73611e32).

Builds the pre-migration shape against an isolated in-memory SQLite engine,
runs the migration's ``upgrade()``, and asserts the resulting shape: no
``id`` column, composite PK on the two FK columns, and no redundant
``UNIQUE(fk1, fk2)`` on the two tables that previously carried one.

Continuum-restore verification is OUT OF SCOPE; that work lives in the
entity-versioning follow-up. Cross-backend verification (PostgreSQL,
MySQL) is handled by CI's test-postgres / test-mysql shards.
"""

from importlib import import_module

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import inspect

# Import the migration module under test.
_migration = import_module(
    "superset.migrations.versions."
    "2026-05-01_23-36_2bee73611e32_composite_pk_association_tables"
)
AFFECTED_TABLES = _migration.AFFECTED_TABLES
TABLES_WITH_PRE_EXISTING_UNIQUE = _migration.TABLES_WITH_PRE_EXISTING_UNIQUE
TABLES_WITH_NULLABLE_FKS = _migration.TABLES_WITH_NULLABLE_FKS


@pytest.fixture(scope="module")
def post_upgrade_engine() -> sa.engine.Engine:
    """An isolated in-memory SQLite engine with the migration applied to a
    pre-migration-shaped seed schema. Used by the post-upgrade assertions
    below. Module-scoped so the upgrade only runs once per module.

    FK columns are NULLABLE on the six tables that historically allowed
    NULLs — with ``nullable=False`` here, ``test_fk_columns_not_null``
    would pass trivially rather than because the migration promoted
    anything."""
    engine = sa.create_engine("sqlite:///:memory:")
    md = sa.MetaData()
    for t in AFFECTED_TABLES:
        nullable = t.name in TABLES_WITH_NULLABLE_FKS
        cols: list[sa.SchemaItem] = [
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column(t.fk1, sa.Integer, nullable=nullable),
            sa.Column(t.fk2, sa.Integer, nullable=nullable),
        ]
        constraints: list[sa.SchemaItem] = []
        if t.name in TABLES_WITH_PRE_EXISTING_UNIQUE:
            constraints.append(sa.UniqueConstraint(t.fk1, t.fk2))
        sa.Table(t.name, md, *cols, *constraints)
    md.create_all(engine)

    # Apply the migration's upgrade() against this engine via Alembic's
    # MigrationContext, patching the migration module's ``op`` reference.
    with engine.connect() as conn:
        ctx = MigrationContext.configure(conn)
        ops = Operations(ctx)
        original_op = _migration.op
        _migration.op = ops  # type: ignore[attr-defined]
        try:
            _migration.upgrade()
        finally:
            _migration.op = original_op  # type: ignore[attr-defined]
    return engine


@pytest.mark.parametrize("t", AFFECTED_TABLES, ids=lambda t: t.name)
def test_no_id_column(post_upgrade_engine: sa.engine.Engine, t) -> None:
    """The synthetic ``id`` column is gone from each affected table."""
    insp = inspect(post_upgrade_engine)
    column_names = {c["name"] for c in insp.get_columns(t.name)}
    assert "id" not in column_names, (
        f"{t.name} still has an 'id' column after migration; "
        f"composite-PK conversion incomplete"
    )


@pytest.mark.parametrize("t", AFFECTED_TABLES, ids=lambda t: t.name)
def test_primary_key_is_composite_fks(post_upgrade_engine: sa.engine.Engine, t) -> None:
    """The primary key of each affected table is exactly ``(fk1, fk2)``."""
    insp = inspect(post_upgrade_engine)
    pk_cols = set(insp.get_pk_constraint(t.name).get("constrained_columns", []))
    assert pk_cols == {t.fk1, t.fk2}, (
        f"{t.name} primary key is {pk_cols}, expected {{{t.fk1}, {t.fk2}}}"
    )


@pytest.mark.parametrize(
    "t",
    [t for t in AFFECTED_TABLES if t.name in TABLES_WITH_PRE_EXISTING_UNIQUE],
    ids=lambda t: t.name,
)
def test_redundant_unique_dropped(post_upgrade_engine: sa.engine.Engine, t) -> None:
    """For the two tables that previously carried a UNIQUE(fk1, fk2), that
    constraint is now subsumed by the composite PK and must not appear
    separately in the unique-constraint list."""
    insp = inspect(post_upgrade_engine)
    redundant_pair = {t.fk1, t.fk2}
    for uc in insp.get_unique_constraints(t.name):
        cols = set(uc.get("column_names", []))
        assert cols != redundant_pair, (
            f"{t.name} still carries a redundant UniqueConstraint over "
            f"{redundant_pair} (name={uc.get('name')!r}); "
            f"composite-PK conversion incomplete"
        )


@pytest.mark.parametrize("t", AFFECTED_TABLES, ids=lambda t: t.name)
def test_fk_columns_not_null(post_upgrade_engine: sa.engine.Engine, t) -> None:
    """PK promotion implicitly tightens the FK columns to NOT NULL."""
    insp = inspect(post_upgrade_engine)
    cols_by_name = {c["name"]: c for c in insp.get_columns(t.name)}
    for col in (t.fk1, t.fk2):
        assert col in cols_by_name, f"{t.name} missing column {col}"
        assert cols_by_name[col].get("nullable") is False, (
            f"{t.name}.{col} is nullable; expected NOT NULL after PK promotion"
        )
