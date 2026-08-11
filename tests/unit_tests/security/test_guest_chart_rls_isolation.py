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
"""Tenant isolation for a guest-token identity rendering an ad-hoc-SQL chart.

An embedded guest renders charts through the enforcement gate's ``Query`` branch
(not SQL Lab), so this is the highest-severity cross-tenant surface: if the gate
drops the guest's scoped row-level-security clause, the guest sees another
tenant's rows. These tests drive the *real* ``superset.utils.rls`` rewrite
mechanism — the same ``apply_rls`` / parser path SQL Lab uses — so a governed
guest chart is asserted row-set-exact with SQL Lab. Predicate *resolution*
against the metadata DB is stubbed (no live DB stood up here), but the
parse + rewrite + re-emit boundary that decides what rows execute is real.

Positive: the guest's scoped clause is injected into the executed SQL and the
result is byte-for-byte identical to SQL Lab's ``apply_rls`` output for the same
SQL + rule (the #33346 chart-vs-SQL-Lab parity that was deferred).
Negative: a second guest identity — or a guest whose rule is removed — never
sees the first guest's predicate, so cross-tenant rows cannot leak.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

import pytest

import superset.utils.rls as rls_module
from superset.security.rls_enforcement import enforce, EnforcementOutcome
from superset.sql.parse import RLSMethod, SQLStatement

ADHOC_SQL = "SELECT a, b FROM governed_table"
TENANT_A_CLAUSE = "tenant_id = 1"
TENANT_B_CLAUSE = "tenant_id = 2"


def _make_query(sql: str = ADHOC_SQL) -> Any:
    """A stub ``Query`` datasource carrying just what the gate reads."""
    from superset.models.sql_lab import Query

    query = MagicMock(spec=Query)
    database = MagicMock()
    database.id = 7
    database.db_engine_spec.engine = "postgresql"
    database.db_engine_spec.get_rls_method.return_value = RLSMethod.AS_PREDICATE
    database.get_default_catalog.return_value = None
    database.get_default_schema_for_query.return_value = "public"
    query.database = database
    query.catalog = None
    query.schema = "public"
    query.sql = sql
    return query


def _guest(username: str, rls: list[dict[str, Any]]) -> Any:
    from superset.security.guest_token import GuestUser

    guest = MagicMock(spec=GuestUser)
    guest.username = username
    guest.rls = rls
    return guest


def _apply_rls_via_sqllab(sql: str, predicate: str) -> str:
    """Reference: what SQL Lab's ``apply_rls`` produces for the same SQL + rule."""
    stmt = SQLStatement(sql, engine="postgresql")
    database = MagicMock()
    database.db_engine_spec.get_rls_method.return_value = RLSMethod.AS_PREDICATE
    database.get_default_catalog.return_value = None
    with patch.object(
        rls_module, "get_predicates_for_table", return_value=[predicate]
    ):
        rls_module.apply_rls(database, None, "public", stmt)
    return stmt.format()


@pytest.fixture(autouse=True)
def _reset_request_cache() -> Any:
    """Isolate the request-scoped memoization cache between tests."""
    yield
    rls_module.clear_rls_request_cache()


# ---------------------------------------------------------------------------
# Positive: a guest's scoped clause is injected into the executed chart SQL and
# the render is row-set-exact with SQL Lab's apply_rls output (the parity that
# was deferred from the ad-hoc-SQL rewrite task).
# ---------------------------------------------------------------------------
def test_guest_chart_sql_is_row_exact_with_sql_lab() -> None:
    # @AC-FR006-06
    query = _make_query()
    guest = _guest("tenant_a_guest", [{"clause": TENANT_A_CLAUSE, "dataset": "5"}])
    # The dataset-scoped guest rule resolves as this table's predicate — exactly
    # what get_sqla_row_level_filters surfaces for a governed guest datasource.
    with patch.object(
        rls_module, "get_predicates_for_table", return_value=[TENANT_A_CLAUSE]
    ):
        decision = enforce(query, ADHOC_SQL, guest, "get_query_str_extended")

    assert decision.outcome is EnforcementOutcome.APPLIED
    assert decision.applied_filter_count >= 1
    assert TENANT_A_CLAUSE in decision.sql
    # Row-set equivalence with the SQL-Lab apply_rls path for the same SQL + rule.
    assert decision.sql == _apply_rls_via_sqllab(ADHOC_SQL, TENANT_A_CLAUSE)


# ---------------------------------------------------------------------------
# Negative (cross-tenant): a second guest identity renders the same chart and
# must never carry the first guest's predicate — no cross-tenant row leak.
# ---------------------------------------------------------------------------
def test_second_guest_does_not_see_first_guests_rows() -> None:
    # @AC-FR006-07
    query = _make_query()
    guest_a = _guest("tenant_a_guest", [{"clause": TENANT_A_CLAUSE, "dataset": "5"}])
    guest_b = _guest("tenant_b_guest", [{"clause": TENANT_B_CLAUSE, "dataset": "5"}])

    # Resolution reflects each tenant's own scoped rule in turn.
    seq = iter([[TENANT_A_CLAUSE], [TENANT_B_CLAUSE]])
    with patch.object(
        rls_module,
        "get_predicates_for_table",
        side_effect=lambda *a, **k: next(seq),
    ):
        decision_a = enforce(query, ADHOC_SQL, guest_a, "get_query_str_extended")
        decision_b = enforce(query, ADHOC_SQL, guest_b, "get_query_str_extended")

    assert TENANT_A_CLAUSE in decision_a.sql
    assert TENANT_B_CLAUSE in decision_b.sql
    # Cross-tenant isolation: neither render carries the other tenant's predicate.
    assert TENANT_B_CLAUSE not in decision_a.sql
    assert TENANT_A_CLAUSE not in decision_b.sql


# ---------------------------------------------------------------------------
# Negative (rule removed): a guest whose scoped rule no longer resolves gets an
# unfiltered NOOP — pinning that the predicate in the positive case is produced
# solely by the guest's rule, not by an incidental rewrite artifact.
# ---------------------------------------------------------------------------
def test_guest_without_resolved_rule_is_unfiltered() -> None:
    # @AC-FR006-08
    query = _make_query()
    guest = _guest("tenant_a_guest", [{"clause": TENANT_A_CLAUSE, "dataset": "5"}])
    # The rule is removed / no longer resolves for this table.
    with patch.object(rls_module, "get_predicates_for_table", return_value=[]):
        decision = enforce(query, ADHOC_SQL, guest, "get_query_str_extended")

    assert decision.outcome is EnforcementOutcome.NOOP
    assert decision.sql == ADHOC_SQL
    assert TENANT_A_CLAUSE not in decision.sql


# ---------------------------------------------------------------------------
# Isolation is enforced even when the request-scoped memoization is warm: the
# first guest's cached predicates must not be served to the second guest.
# ---------------------------------------------------------------------------
def test_memoization_does_not_bleed_across_guests() -> None:
    # @AC-FR006-09
    query = _make_query()
    guest_a = _guest("tenant_a_guest", [{"clause": TENANT_A_CLAUSE, "dataset": "5"}])
    guest_b = _guest("tenant_b_guest", [{"clause": TENANT_B_CLAUSE, "dataset": "5"}])

    seq = iter([[TENANT_A_CLAUSE], [TENANT_B_CLAUSE]])
    with patch.object(
        rls_module,
        "get_predicates_for_table",
        side_effect=lambda *a, **k: next(seq),
    ) as resolver:
        dec_a = enforce(query, ADHOC_SQL, guest_a, "get_query_str_extended")
        dec_b = enforce(query, ADHOC_SQL, guest_b, "get_query_str_extended")

    assert TENANT_A_CLAUSE in dec_a.sql
    assert TENANT_B_CLAUSE in dec_b.sql
    # Each guest forced its own resolve — no cross-identity cache hit.
    assert resolver.call_count == 2
