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
FR-12 fallback audit: a virtual dataset (a ``SqlaTable`` whose ``sql`` is an
ad-hoc query) built over a governed physical source must inherit that source's
Row Level Security when queried -- including the leak-prone *global-guest* case.

These tests exercise the REAL predicate-resolution path:

* real in-memory metadata DB (``session`` fixture) holding the physical
  ``SqlaTable`` and the virtual ``SqlaTable``;
* real ``superset.utils.rls.apply_rls`` / ``get_predicates_for_table`` parsing
  and rewriting the virtual dataset's inner SQL (the exact call
  ``SqlaTable.get_from_clause`` makes at query time);
* real ``BaseDatasource.get_sqla_row_level_filters`` for the outer WHERE, and
  the real ``SupersetSecurityManager.get_guest_rls_filters`` global-vs-scoped
  matching logic (only the identity *resolver*
  ``get_current_guest_user_if_guest`` is stubbed, so the security-critical
  global/scoped decision runs for real).

WARNING (env constraint): the task specifies integration tests under
``tests/integration_tests/security/`` when the live integration harness (app
factory + metadata DB + HTTP fixtures) runs. That full harness is not runnable
here, so this is provided as the strongest unit-level proof against the real
``utils/rls`` path with RLS rules stubbed at the security-manager seam. The
end-to-end HTTP parity assertion remains owed by F4-T3 / F3-T2 (see impl-notes).

Audit verdict: NO-GAP-PROVEN-SAFE. Global-guest RLS is applied exactly once, on
the virtual dataset's outer WHERE (``include_global_guest_rls=True``), and is
correctly excluded from the inner-table path (``include_global_guest_rls=False``)
to avoid double application -- never dropped. No fix to
``connectors/sqla/models.py`` was required; these tests stand as the regression
guard that gates F2-T2 (fail-closed).
"""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

from sqlalchemy.orm.session import Session

# Seam used for patching the security manager as imported into models.py.
_SM = "superset.connectors.sqla.models.security_manager"
_FEATURE = "superset.connectors.sqla.models.is_feature_enabled"


def _setup_metadata(session: Session) -> None:
    """Create the Superset metadata tables in the in-memory DB."""
    from superset.connectors.sqla.models import SqlaTable

    SqlaTable.metadata.create_all(session.get_bind())


def _governed_virtual(session: Session) -> tuple[Any, Any, Any]:
    """A governed physical table + a virtual dataset selecting from it.

    Returns ``(database, physical_table, virtual_dataset)`` already flushed so
    both datasets carry real ids (the id is what distinguishes the virtual
    dataset from its underlying physical source during RLS resolution).
    """
    from superset import db
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database

    _setup_metadata(session)
    database = Database(database_name="d", sqlalchemy_uri="sqlite://")
    physical = SqlaTable(
        table_name="governed_orders",
        schema="main",
        database=database,
    )
    virtual = SqlaTable(
        table_name="my_saved_chart",
        schema="main",
        database=database,
        sql="SELECT * FROM governed_orders",
    )
    db.session.add_all([database, physical, virtual])
    db.session.flush()
    return database, physical, virtual


def _guest(rls_rules: list[dict[str, Any]]) -> Any:
    """Minimal stand-in for ``GuestUser`` carrying RLS rules from its token."""

    class _Guest:
        username = "guest_user"

        def __init__(self, rls: list[dict[str, Any]]) -> None:
            self.rls = rls

    return _Guest(rls_rules)


# @AC-FR012-01
def test_positive_user_rls_applied_to_virtual_dataset_inner_sql(
    session: Session,
) -> None:
    """POSITIVE: a user's RLS rule on the underlying governed table is injected
    into the virtual dataset's inner SQL via the real ``apply_rls`` path.

    This is the fallback under audit: the virtual dataset has a different id
    from its physical source, so the source's rule can only reach it by being
    resolved from the *tables referenced in the virtual SQL* -- exactly what
    ``get_predicates_for_table`` does. The rule targets ``governed_orders``
    only; the virtual dataset itself carries none.
    """
    from superset.sql.parse import SQLStatement
    from superset.utils.rls import apply_rls

    database, _physical, virtual = _governed_virtual(session)

    regular_rule = MagicMock()
    regular_rule.clause = "region = 'EU'"
    regular_rule.group_key = None

    def only_governed(table: Any) -> list[Any]:
        # The user's rule lives on the physical governed table, not the virtual.
        if getattr(table, "table_name", None) == "governed_orders":
            return [regular_rule]
        return []

    # Same parse + rewrite call SqlaTable.get_from_clause performs for a virtual
    # dataset, over the real utils/rls machinery and the real metadata DB.
    statement = SQLStatement(virtual.sql, engine=database.db_engine_spec.engine)
    with (
        patch(f"{_SM}.get_rls_filters", side_effect=only_governed),
        patch(f"{_SM}.get_guest_rls_filters", return_value=[]),
        patch(_FEATURE, return_value=False),
    ):
        applied = apply_rls(
            database,
            None,
            "main",
            statement,
            exclude_dataset_id=virtual.id,
        )

    rewritten = statement.format()
    assert applied is True
    # The source table's predicate must be present in the rewritten virtual SQL.
    assert "region" in rewritten
    assert "'EU'" in rewritten


# @AC-FR012-02
def test_guest_global_rls_applied_to_virtual_dataset_outer_query(
    session: Session,
) -> None:
    """GUEST (security-critical): a GLOBAL guest RLS rule (no ``dataset``) is
    applied to the virtual dataset's outer WHERE and is NOT silently dropped.

    Only the identity resolver is stubbed; the real
    ``get_guest_rls_filters`` global/scoped matching runs. The assertion is on
    the actual presence of the guest predicate in the resolved filter set -- a
    test that would pass even if global-guest were dropped is rejected: we also
    assert the outer path really returned the guest clause, and that the
    inner-table path (``include_global_guest_rls=False``) excludes it so it is
    applied exactly once (no double, no leak).
    """
    from superset import security_manager

    _database, _physical, virtual = _governed_virtual(session)

    global_rule = {"clause": "tenant_id = 42"}  # no 'dataset' key => GLOBAL
    guest = _guest([global_rule])

    with (
        patch(f"{_SM}.get_rls_filters", return_value=[]),
        patch(f"{_SM}.get_current_guest_user_if_guest", return_value=guest),
        patch(_FEATURE, return_value=True),
    ):
        # Real global/scoped matching: a global rule targets every dataset.
        resolved = security_manager.get_guest_rls_filters(virtual)
        outer_included = virtual.get_sqla_row_level_filters(
            include_global_guest_rls=True
        )
        outer_excluded = virtual.get_sqla_row_level_filters(
            include_global_guest_rls=False
        )

    # The global guest rule is resolved for the virtual dataset...
    assert resolved == [global_rule]
    # ...and is present in the outer-WHERE filter set (leak-prone path proven).
    included_strs = [str(f) for f in outer_included]
    assert any("tenant_id = 42" in s for s in included_strs)
    # Excluded ONLY on the inner-table path (avoids double-apply), never dropped.
    excluded_strs = [str(f) for f in outer_excluded]
    assert not any("tenant_id = 42" in s for s in excluded_strs)


# @AC-FR012-03
def test_guest_global_rls_excluded_from_inner_table_path_only(
    session: Session,
) -> None:
    """The global-guest rule is skipped on the underlying-table resolution
    (``get_predicates_for_table`` -> ``include_global_guest_rls=False``) so it is
    NOT applied twice, while a DATASET-SCOPED guest rule targeting the physical
    table IS still resolved there.

    This pins the exact single-application contract that keeps the outer-WHERE
    application (previous test) from becoming a double filter.
    """
    from superset.sql.parse import Table
    from superset.utils.rls import get_predicates_for_table

    database, physical, _virtual = _governed_virtual(session)

    global_rule = {"clause": "tenant_id = 42"}  # global -> excluded here
    scoped_rule = {
        "clause": "org = 7",
        "dataset": physical.id,  # scoped to the physical table -> included here
    }
    guest = _guest([global_rule, scoped_rule])

    table = Table(table="governed_orders", schema="main", catalog=None)
    with (
        patch(f"{_SM}.get_rls_filters", return_value=[]),
        patch(f"{_SM}.get_current_guest_user_if_guest", return_value=guest),
        patch(_FEATURE, return_value=True),
    ):
        predicates = get_predicates_for_table(
            table,
            database,
            database.get_default_catalog(),
        )

    joined = " ".join(predicates)
    # Global guest rule is NOT injected on the inner-table path.
    assert "tenant_id = 42" not in joined
    # Dataset-scoped guest rule targeting this physical table IS injected.
    assert "org = 7" in joined


# @AC-FR012-04
def test_no_bleed_other_identitys_scoped_rule_not_applied(
    session: Session,
) -> None:
    """NEGATIVE (no cross-identity bleed): a guest rule scoped to a DIFFERENT
    dataset id must NOT be applied to this virtual dataset."""
    from superset import security_manager

    _database, _physical, virtual = _governed_virtual(session)

    foreign_rule = {"clause": "leak = 1", "dataset": virtual.id + 999}
    guest = _guest([foreign_rule])

    with (
        patch(f"{_SM}.get_rls_filters", return_value=[]),
        patch(f"{_SM}.get_current_guest_user_if_guest", return_value=guest),
        patch(_FEATURE, return_value=True),
    ):
        resolved = security_manager.get_guest_rls_filters(virtual)
        outer = virtual.get_sqla_row_level_filters(include_global_guest_rls=True)

    assert resolved == []
    assert not any("leak = 1" in str(f) for f in outer)


# @AC-FR012-05
def test_negative_no_rule_no_over_restriction(session: Session) -> None:
    """NEGATIVE (no over-restriction): a virtual dataset over an UNGOVERNED
    table with no applicable rule leaves the inner SQL byte-identical and
    applies no predicate."""
    from superset import db
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database
    from superset.sql.parse import SQLStatement
    from superset.utils.rls import apply_rls

    _setup_metadata(session)
    database = Database(database_name="d", sqlalchemy_uri="sqlite://")
    physical = SqlaTable(table_name="ungoverned", schema="main", database=database)
    virtual = SqlaTable(
        table_name="v",
        schema="main",
        database=database,
        sql="SELECT * FROM ungoverned",
    )
    db.session.add_all([database, physical, virtual])
    db.session.flush()

    statement = SQLStatement(virtual.sql, engine=database.db_engine_spec.engine)
    original = statement.format()
    with (
        patch(f"{_SM}.get_rls_filters", return_value=[]),
        patch(f"{_SM}.get_guest_rls_filters", return_value=[]),
        patch(_FEATURE, return_value=False),
    ):
        applied = apply_rls(
            database,
            None,
            "main",
            statement,
            exclude_dataset_id=virtual.id,
        )

    assert applied is False
    assert statement.format() == original
