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
"""Adversarial tests for the FR-3 fail-closed unresolvable classifier.

Every FR-3 class must deterministically yield ``DENIED`` with a specific
``denial_class`` rather than an unfiltered render (APPLIED/NOOP) or a raw
exception bubbling out of the gate. The subtle leaks — a CTE/alias that shadows
a governed table name, and dynamic/templated table refs — are exercised
explicitly. Predicate resolution against the metadata DB is stubbed; the
parse + classify boundary is real.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest

import superset.utils.rls as rls_module
from superset.security.rls_enforcement import (
    enforce,
    EnforcementOutcome,
)
from superset.sql.parse import RLSMethod


def _make_query(sql: str, engine: str = "postgresql") -> Any:
    """A stub ``Query`` datasource carrying just what the gate reads."""
    from superset.models.sql_lab import Query

    query = MagicMock(spec=Query)
    database = MagicMock()
    database.id = 7
    database.db_engine_spec.engine = engine
    database.db_engine_spec.get_rls_method.return_value = RLSMethod.AS_PREDICATE
    database.get_default_catalog.return_value = None
    database.get_default_schema_for_query.return_value = "public"
    query.database = database
    query.catalog = None
    query.schema = "public"
    query.sql = sql
    return query


@pytest.fixture(autouse=True)
def _reset_request_cache() -> Any:
    """Isolate the request-scoped memoization cache between tests."""
    yield
    rls_module.clear_rls_request_cache()


def _governed(*_a: Any, **_k: Any) -> list[str]:
    """Resolver stub: every referenced table is governed by a predicate."""
    return ["tenant_id = 3"]


# ---------------------------------------------------------------------------
# FR-3.1 parse_failure — malformed SQL must DENY, not bubble a raw exception.
# ---------------------------------------------------------------------------
def test_parse_failure_denies(mocker: Any) -> None:
    # @AC-FR003-01
    query = _make_query("SELECT FROM WHERE ((")
    mocker.patch.object(rls_module, "get_predicates_for_table", _governed)

    decision = enforce(query, query.sql, None, "get_query_str_extended")

    assert decision.outcome is EnforcementOutcome.DENIED
    assert decision.denial_class == "parse_failure"


# ---------------------------------------------------------------------------
# FR-3.2 unsupported_dialect — a dialect with no RLS rewrite path must DENY.
# ---------------------------------------------------------------------------
def test_unsupported_dialect_denies(mocker: Any) -> None:
    # @AC-FR003-02
    query = _make_query("SELECT a FROM governed_table", engine="kustokql")
    mocker.patch.object(rls_module, "get_predicates_for_table", _governed)

    decision = enforce(query, query.sql, None, "get_query_str_extended")

    assert decision.outcome is EnforcementOutcome.DENIED
    assert decision.denial_class == "unsupported_dialect"


# ---------------------------------------------------------------------------
# FR-3.3 dynamic_sql — unrendered Jinja / templated table refs must DENY.
# ---------------------------------------------------------------------------
def test_dynamic_sql_denies(mocker: Any) -> None:
    # @AC-FR003-03
    query = _make_query("SELECT * FROM {{ tenant_table }}")
    mocker.patch.object(rls_module, "get_predicates_for_table", _governed)

    decision = enforce(query, query.sql, None, "get_query_str_extended")

    assert decision.outcome is EnforcementOutcome.DENIED
    assert decision.denial_class == "dynamic_sql"


def test_dynamic_sql_denies_on_parseable_template_block(mocker: Any) -> None:
    # @AC-FR003-03
    # A `{% ... %}` control block can leave otherwise-parseable SQL whose table
    # set is indeterminate; it must still deny rather than resolve a guess.
    query = _make_query("SELECT * FROM sales {% if x %} WHERE 1=1 {% endif %}")
    mocker.patch.object(rls_module, "get_predicates_for_table", _governed)

    decision = enforce(query, query.sql, None, "get_query_str_extended")

    assert decision.outcome is EnforcementOutcome.DENIED
    assert decision.denial_class == "dynamic_sql"


# ---------------------------------------------------------------------------
# FR-3.4 cross_db_ref — tables spanning distinct catalogs cannot be scoped.
# ---------------------------------------------------------------------------
def test_cross_db_ref_denies(mocker: Any) -> None:
    # @AC-FR003-04
    query = _make_query(
        "SELECT * FROM db1.public.t JOIN db2.public.u ON t.id = u.id"
    )
    mocker.patch.object(rls_module, "get_predicates_for_table", _governed)

    decision = enforce(query, query.sql, None, "get_query_str_extended")

    assert decision.outcome is EnforcementOutcome.DENIED
    assert decision.denial_class == "cross_db_ref"


# ---------------------------------------------------------------------------
# FR-3.5 alias_shadow — a CTE/alias named like a governed table (the subtle
# leak): predicate-by-name would target the wrong relation, so DENY.
# ---------------------------------------------------------------------------
def test_alias_shadow_governed_table_denies(mocker: Any) -> None:
    # @AC-FR003-05
    # `governed_table` is a governed name, but here it is a CTE that reads an
    # unrelated relation; the outer reference reads CTE output unfiltered.
    sql = (
        "WITH governed_table AS (SELECT * FROM real_secret) "
        "SELECT * FROM governed_table"
    )
    query = _make_query(sql)

    def resolver(table: Any, *_a: Any, **_k: Any) -> list[str]:
        # Only the name `governed_table` is governed; `real_secret` is not.
        return ["tenant_id = 3"] if table.table == "governed_table" else []

    mocker.patch.object(rls_module, "get_predicates_for_table", resolver)

    decision = enforce(query, sql, None, "get_query_str_extended")

    assert decision.outcome is EnforcementOutcome.DENIED
    assert decision.denial_class == "alias_shadow"


# ---------------------------------------------------------------------------
# FR-3.6 semantic_mismatch — the resolved injection target isn't in the parsed
# table set (ambiguous target), so DENY rather than best-effort guess.
# ---------------------------------------------------------------------------
def test_semantic_mismatch_denies(mocker: Any) -> None:
    # @AC-FR003-06
    query = _make_query("SELECT a FROM governed_table")

    # Resolution returns a predicate keyed to a table that isn't in the parsed
    # set (simulating an ambiguous/resolver-vs-parser divergence).
    def raise_mismatch(*_a: Any, **_k: Any) -> list[str]:
        raise rls_module.RLSUnresolvableError("semantic_mismatch")

    mocker.patch.object(rls_module, "get_predicates_for_table", raise_mismatch)

    decision = enforce(query, query.sql, None, "get_query_str_extended")

    assert decision.outcome is EnforcementOutcome.DENIED
    assert decision.denial_class == "semantic_mismatch"


# ---------------------------------------------------------------------------
# Regression: the classifier must NOT over-deny.
# ---------------------------------------------------------------------------
def test_resolvable_governed_query_still_applies(mocker: Any) -> None:
    # @AC-FR003-07
    sql = "SELECT a, b FROM governed_table"
    query = _make_query(sql)
    mocker.patch.object(
        rls_module, "get_predicates_for_table", return_value=["tenant_id = 3"]
    )

    decision = enforce(query, sql, None, "get_query_str_extended")

    assert decision.outcome is EnforcementOutcome.APPLIED
    assert decision.applied_filter_count >= 1
    assert "tenant_id = 3" in decision.sql
    assert decision.denial_class is None


def test_ungoverned_query_still_noop_verbatim(mocker: Any) -> None:
    # @AC-FR003-08
    sql = "SELECT a, b FROM ungoverned_table"
    query = _make_query(sql)
    mocker.patch.object(
        rls_module, "get_predicates_for_table", return_value=[]
    )

    decision = enforce(query, sql, None, "get_query_str_extended")

    assert decision.outcome is EnforcementOutcome.NOOP
    assert decision.sql == sql  # byte-identical, no denial
    assert decision.denial_class is None
