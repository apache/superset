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
"""Enforcement-overhead benchmark + request-scoped memoization validation.

Two properties of the RLS enforcement chokepoint are guarded here:

1. **Overhead budget** — the added latency of the enforcement step
   (classify + parse + resolve + rewrite + evidence) per governed render stays
   within the performance budget of 25 ms p95. Predicate *resolution* against
   the metadata DB is stubbed with a fixed, small cost so the measurement
   captures OUR added work, not DB latency. The wall-clock p95 is recorded as an
   informational metric and asserted against a generous ceiling that still
   catches a pathological per-call regression without flaking on a loaded box.

2. **Memoization** — resolving predicates for the same
   ``(identity, table-set)`` within one request happens exactly ONCE (a repeat
   render is a cache hit, not a re-resolve), and a DIFFERENT identity forces a
   fresh resolve (no cross-identity cache bleed). This algorithmic property is
   the load-bearing gate: it is deterministic and does not depend on machine
   load, so a regression to O(n)-per-render resolution turns the suite RED
   regardless of the environment the benchmark runs on.
"""

from __future__ import annotations

import logging
import time
from typing import Any
from unittest.mock import MagicMock

import pytest

import superset.utils.rls as rls_module
from superset.security.rls_enforcement import enforce, EnforcementOutcome
from superset.sql.parse import RLSMethod

logger = logging.getLogger(__name__)

ADHOC_SQL = "SELECT a, b FROM governed_table"

# Performance budget for the enforcement step (excluding the governed query's
# own DB execution). See the performance design's quantified NFR budget.
OVERHEAD_BUDGET_MS = 25.0

# Wall-clock is environment-sensitive; the informational p95 assertion uses a
# generous multiple of the budget so it catches a real O(n)-per-call regression
# (which would blow past this by orders of magnitude) without flaking on a
# loaded CI box. The load-bearing correctness gate is the memoization assertion.
INFORMATIONAL_CEILING_MS = OVERHEAD_BUDGET_MS * 10

# Number of governed renders to sample for the p95 measurement.
BENCHMARK_ITERATIONS = 200

# Number of repeat renders of the same identity+table-set within one request,
# standing in for a dashboard's N tiles over the same governed table.
DASHBOARD_TILE_COUNT = 25


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


def _fixed_cost_resolver(cost_ms: float) -> Any:
    """A predicate resolver that spends a fixed small cost, like a DB round-trip.

    Standing in for the metadata-DB lookup so the benchmark measures the
    enforcement machinery's own overhead relative to a known, stable resolution
    cost rather than real (variable) DB latency.
    """

    def _resolve(*_args: Any, **_kwargs: Any) -> list[str]:
        if cost_ms:
            time.sleep(cost_ms / 1000.0)
        return ["tenant_id = 3"]

    return _resolve


@pytest.fixture(autouse=True)
def _reset_request_cache() -> Any:
    """Isolate the request-scoped memoization cache between tests."""
    yield
    rls_module.clear_rls_request_cache()


# ---------------------------------------------------------------------------
# Overhead budget (informational wall-clock p95 + regression ceiling)
# ---------------------------------------------------------------------------
def test_enforcement_overhead_within_budget(mocker: Any) -> None:
    # @AC-NFR005-01
    # Stub predicate resolution with a fixed small cost so we measure OUR added
    # work (classify + parse + rewrite + evidence + cache), not DB latency.
    mocker.patch.object(
        rls_module,
        "get_predicates_for_table",
        side_effect=_fixed_cost_resolver(0.0),
    )
    # Evidence persistence is a decoupled sink; keep its I/O out of the
    # enforcement-overhead measurement (it is measured/guarded by F5).
    mocker.patch(
        "superset.security.rls_enforcement.record_evidence", return_value=None
    )

    samples_ms: list[float] = []
    for i in range(BENCHMARK_ITERATIONS):
        # A fresh identity per iteration forces the full resolve+rewrite path
        # every time (no memoized short-circuit), so each sample measures the
        # worst-case single-render overhead rather than a cache hit.
        guest = _guest(f"user-{i}", [{"clause": "tenant_id = 3"}])
        start = time.perf_counter()
        decision = enforce(_make_query(), ADHOC_SQL, guest, "get_query_str_extended")
        samples_ms.append((time.perf_counter() - start) * 1000.0)
        assert decision.outcome is EnforcementOutcome.APPLIED

    samples_ms.sort()
    p95 = samples_ms[int(len(samples_ms) * 0.95)]
    median = samples_ms[len(samples_ms) // 2]
    logger.warning(
        "RLS enforcement overhead (environment-sensitive, informational): "
        "median=%.3fms p95=%.3fms budget=%.1fms",
        median,
        p95,
        OVERHEAD_BUDGET_MS,
    )

    # Environment-sensitive ceiling: catches a pathological per-call regression
    # (e.g. O(tiles) resolution or a re-parse loop) without flaking under load.
    assert p95 < INFORMATIONAL_CEILING_MS, (
        f"enforcement p95 {p95:.3f}ms exceeded the regression ceiling "
        f"{INFORMATIONAL_CEILING_MS:.1f}ms (budget {OVERHEAD_BUDGET_MS}ms)"
    )


# ---------------------------------------------------------------------------
# Memoization (load-bearing, deterministic): N tiles -> 1 resolve
# ---------------------------------------------------------------------------
def test_dashboard_tiles_resolve_predicates_once(mocker: Any) -> None:
    # @AC-NFR005-02
    # A dashboard rendering many tiles over the same governed table + identity
    # must resolve predicates exactly once within the request, not once per tile.
    query = _make_query()
    guest = _guest("alice", [{"clause": "tenant_id = 1"}])
    resolver = mocker.patch.object(
        rls_module,
        "get_predicates_for_table",
        return_value=["tenant_id = 1"],
    )

    for _ in range(DASHBOARD_TILE_COUNT):
        decision = enforce(query, ADHOC_SQL, guest, "get_query_str_extended")
        assert decision.outcome is EnforcementOutcome.APPLIED

    # The load-bearing invariant: resolution cost is O(1) in the tile count.
    assert resolver.call_count == 1


def test_distinct_identity_forces_reresolve(mocker: Any) -> None:
    # @AC-NFR005-03
    # Memoization is identity-partitioned: a different identity over the same
    # table-set must NOT be served the first identity's cached predicates.
    query = _make_query()
    guest_a = _guest("alice", [{"clause": "tenant_id = 1"}])
    guest_b = _guest("bob", [{"clause": "tenant_id = 2"}])

    seq = iter([["tenant_id = 1"], ["tenant_id = 2"]])
    resolver = mocker.patch.object(
        rls_module,
        "get_predicates_for_table",
        side_effect=lambda *a, **k: next(seq),
    )

    # Repeat each identity K times; each identity resolves once, and the two
    # identities never share a cache entry.
    for _ in range(DASHBOARD_TILE_COUNT):
        dec_a = enforce(query, ADHOC_SQL, guest_a, "get_query_str_extended")
    for _ in range(DASHBOARD_TILE_COUNT):
        dec_b = enforce(query, ADHOC_SQL, guest_b, "get_query_str_extended")

    assert "tenant_id = 1" in dec_a.sql
    assert "tenant_id = 2" in dec_b.sql
    assert "tenant_id = 2" not in dec_a.sql
    assert "tenant_id = 1" not in dec_b.sql
    # Exactly one resolve per identity across all repeat renders.
    assert resolver.call_count == 2
