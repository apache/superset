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
"""Row-set-exact predicate injection for ad-hoc SQL (``Query``) datasources.

These tests exercise the *real* ``superset.utils.rls`` rewrite mechanism (the
same ``apply_rls`` / parser path SQL Lab uses) driving the enforcement gate's
``Query`` branch, so a governed ad-hoc-SQL chart returns the same row-set as SQL
Lab. Predicate *resolution* against the metadata DB is stubbed (no live DB), but
the parse + rewrite + re-emit boundary is real.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

import pytest

import superset.utils.rls as rls_module
from superset.security.rls_enforcement import (
    enforce,
    EnforcementOutcome,
)
from superset.sql.parse import RLSMethod, SQLStatement

ADHOC_SQL = "SELECT a, b FROM governed_table"


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
    """Reference: what SQL Lab's ``apply_rls`` produces for the same SQL+rule."""
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
# Positive: governed ad-hoc SQL gets the predicate injected (row-exact repro)
# ---------------------------------------------------------------------------
def test_query_branch_injects_predicate(mocker: Any) -> None:
    # @AC-FR001-01
    query = _make_query()
    mocker.patch.object(
        rls_module, "get_predicates_for_table", return_value=["tenant_id = 3"]
    )

    decision = enforce(query, ADHOC_SQL, None, "get_query_str_extended")

    assert decision.outcome is EnforcementOutcome.APPLIED
    assert decision.applied_filter_count >= 1
    assert "tenant_id = 3" in decision.sql
    # Row-set equivalence with the SQL-Lab apply_rls path for the same SQL+rule.
    assert decision.sql == _apply_rls_via_sqllab(ADHOC_SQL, "tenant_id = 3")


# ---------------------------------------------------------------------------
# Negative / no-rule: SQL returned byte-identical (untouched), outcome NOOP
# ---------------------------------------------------------------------------
def test_query_branch_no_rule_returns_sql_untouched(mocker: Any) -> None:
    # @AC-FR004-01
    query = _make_query()
    mocker.patch.object(
        rls_module, "get_predicates_for_table", return_value=[]
    )

    decision = enforce(query, ADHOC_SQL, None, "get_query_str_extended")

    assert decision.outcome is EnforcementOutcome.NOOP
    assert decision.sql == ADHOC_SQL  # byte-identical, no round-trip reformat
    assert decision.applied_filter_count == 0


# ---------------------------------------------------------------------------
# Cross-tenant / isolation: distinct identities get distinct predicates, and
# the memoization never serves identity A's predicates to identity B.
# ---------------------------------------------------------------------------
def test_cross_identity_predicates_do_not_bleed(mocker: Any) -> None:
    # @AC-FR001-02
    query = _make_query()
    guest_a = _guest("alice", [{"clause": "tenant_id = 1"}])
    guest_b = _guest("bob", [{"clause": "tenant_id = 2"}])

    # Resolution yields identity A's predicate first, then identity B's.
    seq = iter([["tenant_id = 1"], ["tenant_id = 2"]])
    mocker.patch.object(
        rls_module,
        "get_predicates_for_table",
        side_effect=lambda *a, **k: next(seq),
    )

    decision_a = enforce(query, ADHOC_SQL, guest_a, "get_query_str_extended")
    decision_b = enforce(query, ADHOC_SQL, guest_b, "get_query_str_extended")

    assert "tenant_id = 1" in decision_a.sql
    assert "tenant_id = 2" in decision_b.sql
    assert "tenant_id = 2" not in decision_a.sql
    assert "tenant_id = 1" not in decision_b.sql


def test_memoization_isolated_by_identity(mocker: Any) -> None:
    # @AC-FR001-03
    # Identity A resolves+caches; identity B must NOT be served A's predicate.
    query = _make_query()
    guest_a = _guest("alice", [{"clause": "tenant_id = 1"}])
    guest_b = _guest("bob", [{"clause": "tenant_id = 2"}])

    seq = iter([["tenant_id = 1"], ["tenant_id = 2"]])
    resolver = mocker.patch.object(
        rls_module,
        "get_predicates_for_table",
        side_effect=lambda *a, **k: next(seq),
    )

    dec_a = enforce(query, ADHOC_SQL, guest_a, "get_query_str_extended")
    dec_b = enforce(query, ADHOC_SQL, guest_b, "get_query_str_extended")

    assert "tenant_id = 1" in dec_a.sql
    assert "tenant_id = 2" in dec_b.sql
    # Both identities forced a resolve (no cross-identity cache hit).
    assert resolver.call_count == 2


def test_memoization_hits_within_same_identity(mocker: Any) -> None:
    # @AC-FR004-02
    # Same identity + same (db, catalog, schema, tables) resolves once.
    query = _make_query()
    guest = _guest("alice", [{"clause": "tenant_id = 1"}])
    resolver = mocker.patch.object(
        rls_module, "get_predicates_for_table", return_value=["tenant_id = 1"]
    )

    enforce(query, ADHOC_SQL, guest, "get_query_str_extended")
    enforce(query, ADHOC_SQL, guest, "get_query_str_extended")

    assert resolver.call_count == 1  # second render short-circuits to cache


# ---------------------------------------------------------------------------
# Single-parse: the ad-hoc SQL is parsed exactly once per enforce() call.
# ---------------------------------------------------------------------------
def test_single_parse_per_enforce(mocker: Any) -> None:
    # @AC-FR004-03
    query = _make_query()
    mocker.patch.object(
        rls_module, "get_predicates_for_table", return_value=["tenant_id = 3"]
    )
    spy = mocker.patch(
        "superset.utils.rls.SQLStatement", wraps=SQLStatement
    )

    enforce(query, ADHOC_SQL, None, "get_query_str_extended")

    assert spy.call_count == 1
