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
"""Regression tests for the reduced-scope portion of #38629.

Deleting a user via ``SecurityManager.delete_user()`` raised
``IntegrityError`` on PostgreSQL / MySQL / MariaDB whenever the user had
rows in tables that referenced ``ab_user.id`` via a foreign key with no
``ON DELETE`` clause. This PR fixes it for the narrow set of tables
where the semantics are unambiguous — pure audit trails (``SET NULL``)
and owner-junction tables (``CASCADE``).

User-owned artifacts (``saved_query``, ``dashboards``, all
``AuditMixinNullable`` tables) are deferred to a Superset Improvement
Proposal because they should be *reassigned* to an admin rather than
silently orphaned. This test pins the reduced-scope invariant so a
future contributor cannot regress the specific FKs the fix targets.
"""

from __future__ import annotations

import pytest


def _iter_all_fks_to_ab_user() -> list[tuple[str, str, str | None]]:
    """Introspect the Superset metadata and return every foreign key
    that targets ``ab_user.id`` as ``(table, column, ondelete)``."""
    from superset import db  # noqa: F401  (ensures app is initialized)
    from superset.models.helpers import Model

    fks: list[tuple[str, str, str | None]] = []
    for table in Model.metadata.tables.values():
        for column in table.columns:
            for fk in column.foreign_keys:
                if fk.target_fullname == "ab_user.id":
                    fks.append((table.name, column.name, fk.ondelete))
    return fks


@pytest.mark.parametrize(
    "table,column,expected",
    [
        # Pure audit trails: row survives with FK cleared
        ("logs", "user_id", "SET NULL"),
        ("key_value", "created_by_fk", "SET NULL"),
        ("key_value", "changed_by_fk", "SET NULL"),
        # Owner-junction: row has no meaning without the user
        ("favstar", "user_id", "CASCADE"),
        ("user_attribute", "user_id", "CASCADE"),
        ("tab_state", "user_id", "CASCADE"),
        ("user_favorite_tag", "user_id", "CASCADE"),
    ],
)
def test_targeted_fk_uses_expected_ondelete(
    table: str, column: str, expected: str
) -> None:
    """Each targeted FK to ``ab_user.id`` must declare the semantically
    correct ``ondelete`` behavior. See #38629 for the audit vs.
    ownership rationale.
    """
    matches = [
        ondelete
        for tbl, col, ondelete in _iter_all_fks_to_ab_user()
        if tbl == table and col == column
    ]
    assert matches, f"Expected {table}.{column} FK to ab_user.id but none found"
    assert matches[0] == expected, (
        f"{table}.{column} should use ondelete={expected!r}, got {matches[0]!r}"
    )
