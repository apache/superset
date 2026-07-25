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
"""Shared fixtures for the entity-versioning integration tests."""

from __future__ import annotations

from collections.abc import Iterator

import pytest
import sqlalchemy as sa

from superset import db
from tests.integration_tests.test_app import app

# Continuum capture tables, ordered children-before-parent for a portable
# ``DELETE`` (the shadow tables and ``version_changes`` all carry an FK to
# ``version_transaction``, so it must go last). ``DELETE`` rather than
# ``TRUNCATE`` so the same statement works on SQLite as well as Postgres/MySQL.
_VERSION_TABLES: tuple[str, ...] = (
    "dashboard_slices_version",
    "slices_version",
    "dashboards_version",
    "tables_version",
    "table_columns_version",
    "sql_metrics_version",
    "version_changes",
    "version_transaction",
)


def _assert_table_list_covers_schema() -> None:
    """Guard against drift: if a future versioned model adds a ``*_version``
    shadow table not listed in ``_VERSION_TABLES``, this fixture would stop
    fully clearing capture rows and silently reintroduce the accumulation it
    exists to prevent. Fail loudly instead. Checked once per test (cheap —
    reflection reads cached metadata)."""
    known = set(_VERSION_TABLES)
    shadow_tables = {
        name
        for name in sa.inspect(db.engine).get_table_names()
        # Continuum shadow tables are ``<entity_table>_version``; exclude
        # Alembic's own ``alembic_version`` bookkeeping table, which shares
        # the suffix but is not a shadow table.
        if name.endswith("_version") and name != "alembic_version"
    }
    missing = shadow_tables - known
    assert not missing, (
        f"_VERSION_TABLES is missing shadow table(s) {sorted(missing)}; add "
        "them (children before version_transaction) so the cleanup fixture "
        "keeps clearing all capture rows."
    )


def clear_version_tables() -> None:
    """Delete all entity-versioning capture rows and commit the cleanup."""
    with app.app_context():
        _assert_table_list_covers_schema()
        for table in _VERSION_TABLES:
            db.session.execute(sa.text(f"DELETE FROM {table}"))  # noqa: S608
        db.session.commit()


@pytest.fixture(autouse=True)
def clean_version_tables() -> Iterator[None]:
    """Clear the Continuum version tables around every versioning test.

    The integration suite runs with ``ENABLE_VERSIONING_CAPTURE`` on, so every
    save in every test — versioning-related or not — mints version rows. Left
    alone, those rows accumulate across the run, and the version-counting
    assertions in this package would have to defend against unrelated history.
    Clearing before each test gives it a clean version-table slate (it sees
    only the rows it creates); clearing after keeps these tests from leaving
    version-table residue for whatever runs next.

    Table names are interpolated from the fixed ``_VERSION_TABLES`` tuple, not
    from any test input, so the ``DELETE`` is not an injection surface.
    """
    clear_version_tables()
    yield
    clear_version_tables()
