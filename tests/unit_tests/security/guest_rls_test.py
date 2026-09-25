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
Tests for guest RLS scoping in virtual dataset and adhoc sub-query scenarios.

Verifies that dataset-scoped guest RLS rules are correctly applied
when querying through virtual datasets, that global (unscoped)
guest rules are not duplicated across inner and outer queries, and
that global guest rules still reach adhoc sub-queries, which no outer
query constrains.
"""

from __future__ import annotations

from typing import Callable
from unittest.mock import MagicMock, patch

from flask import Flask
from pytest_mock import MockerFixture
from sqlalchemy.sql.elements import TextClause

from superset.connectors.sqla.models import BaseDatasource
from superset.security.guest_token import (
    GuestToken,
    GuestTokenResourceType,
    GuestTokenRlsRule,
    GuestUser,
)
from superset.sql.parse import Table
from superset.utils.rls import get_predicates_for_table


def _make_datasource(dataset_id: int) -> MagicMock:
    datasource = MagicMock(spec=BaseDatasource)
    datasource.get_template_processor.return_value = MagicMock()
    datasource.get_template_processor.return_value.process_template = lambda x: x
    datasource.text = lambda x: TextClause(x)
    datasource.data = {"id": dataset_id}
    datasource.is_rls_supported = True
    return datasource


def _make_guest_user(rules: list[GuestTokenRlsRule]) -> GuestUser:
    token: GuestToken = {
        "user": {},
        "resources": [
            {"type": GuestTokenResourceType.DASHBOARD, "id": "test-dashboard-uuid"}
        ],
        "rls_rules": rules,
        "iat": 10,
        "exp": 20,
    }
    return GuestUser(token=token, roles=[])


def _guest_rls_filter(
    guest_user: GuestUser,
) -> Callable[[MagicMock], list[GuestTokenRlsRule]]:
    """Replicate real get_guest_rls_filters logic from manager.py:2709-2714."""

    def _filter(dataset: MagicMock) -> list[GuestTokenRlsRule]:
        return [
            rule
            for rule in guest_user.rls
            if not rule.get("dataset")
            or str(rule.get("dataset")) == str(dataset.data["id"])
        ]

    return _filter


def test_scoped_guest_rule_preserved_in_virtual_dataset(app: Flask) -> None:
    """
    Dataset-scoped guest RLS rule is preserved when querying through
    a virtual dataset.

    Path A (inner SQL): include_global_guest_rls=False skips only global rules,
                        but dataset-scoped rules matching PD are kept.
    Path B (outer query): get_guest_rls_filters(VD) doesn't match because
                          rule.dataset=42 != VD.id=99, but that's OK because
                          the rule was already applied in Path A.
    """
    pd_id = 42
    vd_id = 99

    scoped_rule = GuestTokenRlsRule(dataset=str(pd_id), clause="tenant_id = 5")
    guest_user = _make_guest_user(rules=[scoped_rule])

    mock_pd = _make_datasource(pd_id)
    mock_vd = _make_datasource(vd_id)

    with (
        patch(
            "superset.connectors.sqla.models.security_manager.get_rls_filters",
            return_value=[],
        ),
        patch(
            "superset.connectors.sqla.models.security_manager.get_guest_rls_filters",
            wraps=_guest_rls_filter(guest_user),
        ),
        patch(
            "superset.connectors.sqla.models.is_feature_enabled",
            return_value=True,
        ),
    ):
        # PATH A: what get_predicates_for_table() calls on PD
        inner_filters = BaseDatasource.get_sqla_row_level_filters(
            mock_pd, include_global_guest_rls=False
        )

        # PATH B: what get_sqla_query() calls on VD
        outer_filters = BaseDatasource.get_sqla_row_level_filters(
            mock_vd, include_global_guest_rls=True
        )

        inner_has_rule = any("tenant_id" in str(f) for f in inner_filters)
        outer_has_rule = any("tenant_id" in str(f) for f in outer_filters)

        # Scoped rule must appear in inner SQL (PD matches rule.dataset)
        assert inner_has_rule, (
            f"Dataset-scoped guest rule 'tenant_id = 5' (scoped to PD "
            f"id={pd_id}) should be applied in inner SQL. "
            f"inner_filters={[str(f) for f in inner_filters]}"
        )
        # Scoped rule should NOT appear in outer SQL (VD.id != rule.dataset)
        assert not outer_has_rule, (
            f"Dataset-scoped guest rule should not match VD id={vd_id}. "
            f"outer_filters={[str(f) for f in outer_filters]}"
        )


def test_unscoped_guest_rule_duplicated_in_virtual_dataset(app: Flask) -> None:
    """
    Unscoped (global) guest rules match ANY dataset — these are the ones
    that get duplicated in virtual datasets (the original issue #37359).

    The fix should selectively filter only unscoped rules from inner SQL,
    not all guest rules.
    """
    pd_id = 42
    vd_id = 99

    unscoped_rule = GuestTokenRlsRule(dataset=None, clause="org_id = 1")
    guest_user = _make_guest_user(rules=[unscoped_rule])

    mock_pd = _make_datasource(pd_id)
    mock_vd = _make_datasource(vd_id)

    with (
        patch(
            "superset.connectors.sqla.models.security_manager.get_rls_filters",
            return_value=[],
        ),
        patch(
            "superset.connectors.sqla.models.security_manager.get_guest_rls_filters",
            wraps=_guest_rls_filter(guest_user),
        ),
        patch(
            "superset.connectors.sqla.models.is_feature_enabled",
            return_value=True,
        ),
    ):
        # Both paths with guest RLS enabled (before the fix)
        inner_filters = BaseDatasource.get_sqla_row_level_filters(
            mock_pd, include_global_guest_rls=True
        )
        outer_filters = BaseDatasource.get_sqla_row_level_filters(
            mock_vd, include_global_guest_rls=True
        )

        inner_has_rule = any("org_id" in str(f) for f in inner_filters)
        outer_has_rule = any("org_id" in str(f) for f in outer_filters)

        assert inner_has_rule, "Unscoped rule should match PD"
        assert outer_has_rule, "Unscoped rule should match VD"


def _make_datasource_with_real_rls(dataset_id: int) -> MagicMock:
    """Create a mock datasource with real get_sqla_row_level_filters."""
    datasource = _make_datasource(dataset_id)
    # Bind real BaseDatasource method so RLS logic executes against mocked
    # security_manager rather than returning MagicMock auto-stub
    datasource.get_sqla_row_level_filters = (
        lambda **kwargs: BaseDatasource.get_sqla_row_level_filters(datasource, **kwargs)
    )
    return datasource


def test_scoped_guest_rule_preserved_through_get_predicates_for_table(
    app: Flask,
    mocker: MockerFixture,
) -> None:
    """
    Dataset-scoped guest RLS rules are preserved when
    get_predicates_for_table() calls get_sqla_row_level_filters()
    with include_global_guest_rls=False.

    Exercises the full path: get_predicates_for_table() → DB lookup →
    get_sqla_row_level_filters(include_global_guest_rls=False) →
    get_guest_rls_filters() returns scoped rule → predicate included.
    """
    from sqlalchemy.dialects import sqlite

    pd_id = 42
    scoped_rule = GuestTokenRlsRule(dataset=str(pd_id), clause="tenant_id = 5")
    guest_user = _make_guest_user(rules=[scoped_rule])

    mock_pd = _make_datasource_with_real_rls(pd_id)

    database = mocker.MagicMock()
    database.get_dialect.return_value = sqlite.dialect()
    db = mocker.patch("superset.utils.rls.db")
    db.session.query().filter().one_or_none.return_value = mock_pd

    with (
        patch(
            "superset.connectors.sqla.models.security_manager.get_rls_filters",
            return_value=[],
        ),
        patch(
            "superset.connectors.sqla.models.security_manager.get_guest_rls_filters",
            wraps=_guest_rls_filter(guest_user),
        ),
        patch(
            "superset.connectors.sqla.models.is_feature_enabled",
            return_value=True,
        ),
    ):
        table = Table("physical_table", "public", "examples")
        predicates = get_predicates_for_table(table, database, "examples")

        assert any("tenant_id" in p for p in predicates), (
            f"SECURITY BYPASS via get_predicates_for_table: "
            f"dataset-scoped guest rule 'tenant_id = 5' (scoped to PD "
            f"id={pd_id}) not found in predicates. Got: {predicates}"
        )


def test_global_guest_rule_excluded_through_get_predicates_for_table(
    app: Flask,
    mocker: MockerFixture,
) -> None:
    """
    Global (unscoped) guest RLS rules are excluded when a virtual dataset's
    inner SQL calls get_predicates_for_table() with
    include_global_guest_rls=False.

    This prevents double application: global guest rules match any dataset,
    so they would appear both in inner SQL (underlying table) and outer query
    (virtual dataset). The fix excludes them from the inner SQL path.
    """
    from sqlalchemy.dialects import sqlite

    pd_id = 42
    global_rule = GuestTokenRlsRule(dataset=None, clause="org_id = 1")
    guest_user = _make_guest_user(rules=[global_rule])

    mock_pd = _make_datasource_with_real_rls(pd_id)

    database = mocker.MagicMock()
    database.get_dialect.return_value = sqlite.dialect()
    db = mocker.patch("superset.utils.rls.db")
    db.session.query().filter().one_or_none.return_value = mock_pd

    with (
        patch(
            "superset.connectors.sqla.models.security_manager.get_rls_filters",
            return_value=[],
        ),
        patch(
            "superset.connectors.sqla.models.security_manager.get_guest_rls_filters",
            wraps=_guest_rls_filter(guest_user),
        ),
        patch(
            "superset.connectors.sqla.models.is_feature_enabled",
            return_value=True,
        ),
    ):
        table = Table("physical_table", "public", "examples")
        predicates = get_predicates_for_table(
            table, database, "examples", include_global_guest_rls=False
        )

        assert not any("org_id" in p for p in predicates), (
            f"Global guest rule 'org_id = 1' should be excluded from "
            f"get_predicates_for_table() to prevent double application "
            f"in virtual datasets. Got: {predicates}"
        )


def test_global_guest_rule_included_by_default_through_get_predicates_for_table(
    app: Flask,
    mocker: MockerFixture,
) -> None:
    """
    Global (unscoped) guest RLS rules are included by default, so a statement
    that no outer query constrains, such as a SQL Lab query, is still scoped
    to the guest token.
    """
    from sqlalchemy.dialects import sqlite

    global_rule = GuestTokenRlsRule(dataset=None, clause="org_id = 1")
    guest_user = _make_guest_user(rules=[global_rule])

    mock_pd = _make_datasource_with_real_rls(42)

    database = mocker.MagicMock()
    database.get_dialect.return_value = sqlite.dialect()
    db = mocker.patch("superset.utils.rls.db")
    db.session.query().filter().one_or_none.return_value = mock_pd

    with (
        patch(
            "superset.connectors.sqla.models.security_manager.get_rls_filters",
            return_value=[],
        ),
        patch(
            "superset.connectors.sqla.models.security_manager.get_guest_rls_filters",
            wraps=_guest_rls_filter(guest_user),
        ),
        patch(
            "superset.connectors.sqla.models.is_feature_enabled",
            return_value=True,
        ),
    ):
        table = Table("physical_table", "public", "examples")
        predicates = get_predicates_for_table(table, database, "examples")

        assert any("org_id" in p for p in predicates), (
            f"Global guest rule 'org_id = 1' should be included by default. "
            f"Got: {predicates}"
        )


def _validate_adhoc_subquery_as_guest(
    mocker: MockerFixture,
    rules: list[GuestTokenRlsRule],
    sql: str,
) -> str:
    """
    Run ``validate_adhoc_subquery`` for a guest holding ``rules``, with the
    sub-query's table resolving to a physical dataset.
    """
    from sqlalchemy.dialects import sqlite

    from superset.models.helpers import validate_adhoc_subquery
    from superset.sql.parse import RLSMethod

    guest_user = _make_guest_user(rules=rules)
    mock_pd = _make_datasource_with_real_rls(42)

    database = mocker.MagicMock()
    database.get_dialect.return_value = sqlite.dialect()
    database.get_default_catalog.return_value = None
    database.db_engine_spec.engine = "sqlite"
    database.db_engine_spec.get_rls_method.return_value = RLSMethod.AS_PREDICATE
    db = mocker.patch("superset.utils.rls.db")
    # SQLite folds unquoted identifiers, so datasets are looked up with ``all()``
    db.session.query().filter().all.return_value = [mock_pd]

    with (
        patch(
            "superset.connectors.sqla.models.security_manager.get_rls_filters",
            return_value=[],
        ),
        patch(
            "superset.connectors.sqla.models.security_manager.get_guest_rls_filters",
            wraps=_guest_rls_filter(guest_user),
        ),
        patch(
            "superset.connectors.sqla.models.is_feature_enabled",
            return_value=True,
        ),
        patch(
            "superset.models.helpers.is_feature_enabled",
            return_value=True,
        ),
    ):
        return validate_adhoc_subquery(sql, database, None, "public", "sqlite")


def test_global_guest_rule_applied_to_adhoc_subquery(
    app: Flask,
    mocker: MockerFixture,
) -> None:
    """
    Global (unscoped) guest RLS rules are injected into adhoc sub-queries.

    Unlike a virtual dataset's inner SQL, an adhoc sub-query is not constrained
    by the outer query's WHERE clause, so skipping the global guest rules there
    would let a guest read rows from every tenant.
    """
    sql = _validate_adhoc_subquery_as_guest(
        mocker,
        [GuestTokenRlsRule(dataset=None, clause="org_id = 1")],
        "SELECT MAX((SELECT COUNT(DISTINCT org_id) FROM physical_table))",
    )

    assert "org_id = 1" in sql, (
        f"Global guest rule 'org_id = 1' must be applied inside the adhoc "
        f"sub-query. Got: {sql}"
    )


def test_scoped_guest_rule_applied_to_adhoc_subquery(
    app: Flask,
    mocker: MockerFixture,
) -> None:
    """
    Dataset-scoped guest RLS rules keep being injected into adhoc sub-queries
    alongside global ones.
    """
    sql = _validate_adhoc_subquery_as_guest(
        mocker,
        [
            GuestTokenRlsRule(dataset=None, clause="org_id = 1"),
            GuestTokenRlsRule(dataset="42", clause="tenant_id = 5"),
        ],
        "SELECT (SELECT COUNT(*) FROM physical_table)",
    )

    assert "org_id = 1" in sql, f"Global guest rule missing. Got: {sql}"
    assert "tenant_id = 5" in sql, f"Scoped guest rule missing. Got: {sql}"
