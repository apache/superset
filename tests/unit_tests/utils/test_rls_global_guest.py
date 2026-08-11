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
"""Global (unscoped) guest RLS on the ad-hoc chart (``Query``) path.

A guest identity renders charts through the enforcement gate's ``Query`` branch,
not SQL Lab. Global guest RLS rules (rules carrying no ``dataset``) must be
injected into the executed SQL for every referenced table, exactly once, on that
path — the shared rewriter otherwise drops them (it excludes global guest RLS to
avoid double-application inside virtual datasets, a safe assumption only for SQL
Lab). Predicate resolution against the metadata DB is stubbed; the parse +
rewrite + re-emit boundary is real.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

import pytest

import superset.utils.rls as rls_module
from superset.security.rls_enforcement import enforce, EnforcementOutcome
from superset.sql.parse import RLSMethod

ADHOC_SQL = "SELECT a, b FROM governed_table"
GLOBAL_CLAUSE = "org_id = 42"


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


@pytest.fixture(autouse=True)
def _reset_request_cache() -> Any:
    """Isolate the request-scoped memoization cache between tests."""
    yield
    rls_module.clear_rls_request_cache()


# ---------------------------------------------------------------------------
# Positive: a guest's global (unscoped) RLS is injected into the executed SQL.
# ---------------------------------------------------------------------------
def test_global_guest_rls_present_in_executed_sql(mocker: Any) -> None:
    # @AC-FR006-01
    query = _make_query()
    guest = _guest("alice", [{"clause": GLOBAL_CLAUSE}])
    # No dataset-scoped predicates resolve for this table; only the global
    # guest rule should surface in the rewritten SQL.
    mocker.patch.object(rls_module, "get_predicates_for_table", return_value=[])

    decision = enforce(query, ADHOC_SQL, guest, "get_query_str_extended")

    assert decision.outcome is EnforcementOutcome.APPLIED
    assert decision.applied_filter_count >= 1
    assert GLOBAL_CLAUSE in decision.sql


# ---------------------------------------------------------------------------
# Negative: dropping the global-guest application leaks (no predicate in SQL).
# This pins the enforcement — if the collection is removed, the guest render is
# unfiltered and this assertion fails.
# ---------------------------------------------------------------------------
def test_without_global_guest_collection_sql_is_unfiltered(mocker: Any) -> None:
    # @AC-FR006-02
    query = _make_query()
    guest = _guest("alice", [{"clause": GLOBAL_CLAUSE}])
    mocker.patch.object(rls_module, "get_predicates_for_table", return_value=[])
    # Simulate the global-guest collection being absent from the rewrite path.
    with patch.object(
        rls_module, "get_global_guest_rls_predicates", return_value=[]
    ):
        decision = enforce(query, ADHOC_SQL, guest, "get_query_str_extended")

    assert GLOBAL_CLAUSE not in decision.sql
    assert decision.outcome is EnforcementOutcome.NOOP


# ---------------------------------------------------------------------------
# Double-application guard: the global guest predicate appears exactly once,
# even when the same clause is also emitted as a dataset-scoped predicate.
# ---------------------------------------------------------------------------
def test_global_guest_rls_applied_exactly_once(mocker: Any) -> None:
    # @AC-FR006-03
    query = _make_query()
    guest = _guest("alice", [{"clause": GLOBAL_CLAUSE}])
    # The per-table resolver already surfaces the same clause (e.g. it would
    # match the same physical dataset). The global-guest collection must not
    # add a second copy.
    mocker.patch.object(
        rls_module, "get_predicates_for_table", return_value=[GLOBAL_CLAUSE]
    )

    decision = enforce(query, ADHOC_SQL, guest, "get_query_str_extended")

    assert decision.outcome is EnforcementOutcome.APPLIED
    assert decision.sql.count(GLOBAL_CLAUSE) == 1


# ---------------------------------------------------------------------------
# Dataset-scoped guest rules are NOT treated as global: a rule bound to a
# dataset id is left to the per-table resolver, never injected as global.
# ---------------------------------------------------------------------------
def test_dataset_scoped_guest_rule_not_collected_as_global() -> None:
    # @AC-FR006-04
    guest = _guest(
        "alice",
        [
            {"clause": GLOBAL_CLAUSE},
            {"clause": "tenant_id = 9", "dataset": "5"},
        ],
    )

    predicates = rls_module.get_global_guest_rls_predicates(guest)

    assert GLOBAL_CLAUSE in predicates
    assert "tenant_id = 9" not in predicates


# ---------------------------------------------------------------------------
# Non-guest identity contributes no global guest predicates.
# ---------------------------------------------------------------------------
def test_non_guest_identity_has_no_global_guest_predicates() -> None:
    # @AC-FR006-05
    assert rls_module.get_global_guest_rls_predicates(None) == []
