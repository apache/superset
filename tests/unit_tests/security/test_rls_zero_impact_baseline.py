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
"""Zero-impact regression baseline for deployments with NO RLS rules.

The overwhelmingly common deployment has no row-level-security rules at all. For
those deployments the enforcement gate must be behavior-preserving and
effectively free: a governed-datasource render where no rule applies to any
referenced table must emit SQL that is BYTE-IDENTICAL to the SQL emitted without
the enforcement path, the outcome must be ``NOOP`` (never ``APPLIED`` or
``DENIED``), no audit-evidence row may be written, and the no-rule case must
short-circuit before the parser/rewriter re-serializes the statement.

Coverage spans both render paths:

* the ad-hoc SQL Lab ``Query`` path, which the gate actively rewrites when a
  rule applies — here the no-rule case must return the input untouched; and
* the ``SqlaTable`` (physical/virtual dataset) path, whose predicates are
  injected upstream so the gate is a pass-through.

The byte-identical assertions are load-bearing: a real re-serialization of the
no-rule SQL reformats it (``SELECT a, b FROM t`` -> multi-line), so an
accidental round-trip on the no-rule path would change the bytes and fail these
tests. ``test_no_rule_property_is_load_bearing`` proves that directly by forcing
a round-trip and asserting the emitted SQL diverges.
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
from superset.sql.parse import RLSMethod, SQLStatement

# A tidy single-line statement whose re-serialized form differs from the input,
# so a no-rule round-trip would be visible as changed bytes.
BASELINE_SQL = "SELECT a, b FROM governed_table"


def _make_query(sql: str = BASELINE_SQL) -> Any:
    """A stub ad-hoc ``Query`` datasource carrying just what the gate reads."""
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


def _make_sqla_table() -> Any:
    """A stub ``SqlaTable`` datasource (physical/virtual dataset path)."""
    from superset.connectors.sqla.models import SqlaTable

    return MagicMock(spec=SqlaTable)


@pytest.fixture(autouse=True)
def _no_rules(mocker: Any) -> Any:
    """Model the common no-RLS deployment: no predicate resolves for any table.

    ``get_predicates_for_table`` is the single resolver both render paths consult;
    returning ``[]`` for every table is exactly "no rule applies anywhere". The
    request-scoped memoization cache is cleared afterwards so tests stay isolated.
    """
    mocker.patch.object(rls_module, "get_predicates_for_table", return_value=[])
    yield
    rls_module.clear_rls_request_cache()


# ---------------------------------------------------------------------------
# Byte-identical SQL, NOOP (not APPLIED) — Query / ad-hoc path
# ---------------------------------------------------------------------------
def test_query_path_no_rule_sql_byte_identical_and_noop() -> None:
    # @AC-FR004-01
    query = _make_query()

    decision = enforce(query, BASELINE_SQL, None, "get_query_str_extended")

    assert decision.outcome is EnforcementOutcome.NOOP
    assert decision.outcome is not EnforcementOutcome.APPLIED
    # Byte-for-byte identical to the input: no parser round-trip reformat.
    assert decision.sql == BASELINE_SQL
    assert decision.applied_filter_count == 0
    assert decision.denial_class is None


# ---------------------------------------------------------------------------
# Byte-identical SQL, NOOP (not APPLIED) — SqlaTable / virtual path
# ---------------------------------------------------------------------------
def test_sqla_table_path_no_rule_sql_byte_identical_and_noop() -> None:
    # @AC-FR004-01
    datasource = _make_sqla_table()

    decision = enforce(datasource, BASELINE_SQL, None, "get_query_str_extended")

    assert decision.outcome is EnforcementOutcome.NOOP
    assert decision.outcome is not EnforcementOutcome.APPLIED
    assert decision.sql == BASELINE_SQL
    assert decision.applied_filter_count == 0
    assert decision.denial_class is None


# ---------------------------------------------------------------------------
# No side effects — no evidence row is written for a NOOP
# ---------------------------------------------------------------------------
def test_query_path_no_rule_writes_no_evidence(mocker: Any) -> None:
    # @AC-FR004-01
    # NOOP outcomes are never persisted; the sink must see nothing to record for
    # a no-rule render. Spying the internal writer proves nothing was persisted
    # without needing a metadata DB.
    add_spy = mocker.patch.object(rls_module.db.session, "add")
    query = _make_query()

    decision = enforce(query, BASELINE_SQL, None, "get_query_str_extended")

    assert decision.outcome is EnforcementOutcome.NOOP
    add_spy.assert_not_called()


def test_sqla_table_path_no_rule_writes_no_evidence(mocker: Any) -> None:
    # @AC-FR004-01
    add_spy = mocker.patch.object(rls_module.db.session, "add")
    datasource = _make_sqla_table()

    decision = enforce(datasource, BASELINE_SQL, None, "get_query_str_extended")

    assert decision.outcome is EnforcementOutcome.NOOP
    add_spy.assert_not_called()


# ---------------------------------------------------------------------------
# No side effects — no exception, never DENIED, on the no-rule path
# ---------------------------------------------------------------------------
def test_no_rule_path_never_denies_and_never_raises() -> None:
    # @AC-FR004-01
    # Both render kinds, exercised through the real gate, must resolve cleanly to
    # NOOP: no DENIED decision and no exception escaping the gate.
    for datasource in (_make_query(), _make_sqla_table()):
        decision = enforce(datasource, BASELINE_SQL, None, "get_query_str_extended")
        assert decision.outcome is EnforcementOutcome.NOOP
        assert decision.outcome is not EnforcementOutcome.DENIED
        assert decision.denial_class is None


# ---------------------------------------------------------------------------
# Cheap fast path — the no-rule case short-circuits before re-serializing
# ---------------------------------------------------------------------------
def test_query_path_no_rule_does_not_re_serialize(mocker: Any) -> None:
    # @AC-FR004-01
    # Algorithmic (not wall-clock) short-circuit proof: with no rule to apply, the
    # rewriter must NOT round-trip the statement through the formatter — that is
    # what would both cost time and change the bytes. Spying ``format`` on the
    # parsed statement asserts the fast path is taken.
    format_spy = mocker.spy(SQLStatement, "format")
    query = _make_query()

    decision = enforce(query, BASELINE_SQL, None, "get_query_str_extended")

    assert decision.outcome is EnforcementOutcome.NOOP
    assert format_spy.call_count == 0


def test_sqla_table_path_no_rule_does_not_invoke_rewriter(mocker: Any) -> None:
    # @AC-FR004-01
    # The SqlaTable path is a structural pass-through: it must never reach the
    # ad-hoc rewriter at all (predicates are injected upstream; re-entering the
    # rewriter here would risk a double-apply).
    rewrite_spy = mocker.spy(rls_module, "rewrite_sql_for_query")
    datasource = _make_sqla_table()

    decision = enforce(datasource, BASELINE_SQL, None, "get_query_str_extended")

    assert decision.outcome is EnforcementOutcome.NOOP
    assert rewrite_spy.call_count == 0


# ---------------------------------------------------------------------------
# The byte-identical property is load-bearing: prove a round-trip WOULD change
# the SQL, so the passing assertions above are not vacuous.
# ---------------------------------------------------------------------------
def test_no_rule_property_is_load_bearing() -> None:
    # @AC-FR004-01
    # If the no-rule path re-serialized the statement (the mutation these tests
    # guard against), the emitted SQL would be the reformatted form, which is NOT
    # byte-identical to the input. Demonstrating the divergence proves the
    # byte-identical assertions are meaningful, not tautological.
    reformatted = SQLStatement(BASELINE_SQL, engine="postgresql").format()
    assert reformatted != BASELINE_SQL

    # And the real gate returns the un-reformatted input for the no-rule case.
    decision = enforce(_make_query(), BASELINE_SQL, None, "get_query_str_extended")
    assert decision.sql == BASELINE_SQL
    assert decision.sql != reformatted
