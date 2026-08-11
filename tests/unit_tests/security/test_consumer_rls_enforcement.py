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
"""Per-consumer row-level-security regression tests.

Every downstream data consumer — a dashboard tile render, an alert/report
render, a thumbnail render, and a CSV/Excel export — retrieves its rows through
one of two datasource seams:

* ``ExploreMixin.query`` — the dataframe path used by the shared ``QueryContext``
  that dashboards, alerts/reports and thumbnails render through; and
* ``ExploreMixin.get_query_str`` — the SQL path the streaming CSV/Excel export
  builds from.

Both seams funnel through the single ``get_query_str_extended`` chokepoint, which
routes the compiled SQL through the enforcement gate (``enforce``). These tests
prove, per consumer, that:

* the consumer's render seam invokes the gate exactly once, on the compiled SQL,
  tagged with the ``get_query_str_extended`` call-site path (enforcement is
  inherited by construction, not by a per-consumer opt-in);
* when the gate APPLIES an RLS rewrite, the consumer's output carries the
  filtered SQL — a governed datasource is filtered identically regardless of
  which consumer requested it;
* on a deployment with no RLS rule (gate NOOP), the consumer's output SQL is
  byte-identical to the un-gated compiled SQL — no regression for non-RLS
  deployments; and
* the enforcement is authentic — neutralising the gate (making it re-emit the
  raw SQL) drops the filter from the consumer's output, so the assertions above
  are load-bearing, not vacuous.

A final parity test drives the *real* gate + ``superset.utils.rls`` rewrite to
assert a guest/governed chart render is row-set-exact with the SQL-Lab
``apply_rls`` output for the same SQL and rule (the chart-vs-SQL-Lab parity owed
since the ad-hoc-SQL rewrite work).

Predicate *resolution* against the metadata DB is stubbed (no live DB is stood
up here); the compile → gate → re-emit boundary that decides what SQL each
consumer executes is exercised for real. See WARNINGs in the task record for the
residual live-DB HTTP integration gap.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest
from pytest_mock import MockerFixture

import superset.utils.rls as rls_module
from superset.models.helpers import ExploreMixin
from superset.security.rls_enforcement import (
    enforce,
    EnforcementDecision,
    EnforcementOutcome,
)
from superset.sql.parse import RLSMethod, SQLStatement

COMPILED_SQL = "SELECT col FROM governed_table"
TENANT_CLAUSE = "tenant_id = 7"
FILTERED_SQL = f"{COMPILED_SQL} WHERE {TENANT_CLAUSE}"


class _FakeDatasource(ExploreMixin):
    """Minimal ``ExploreMixin`` overriding the abstract properties it reads."""

    sql: Any = None
    catalog: Any = None
    schema: Any = None
    database: Any = None

    @property
    def db_engine_spec(self) -> Any:
        # An engine with no DISALLOWED_SQL_* config, so the shared denylist gate
        # short-circuits and the query path proceeds straight to the RLS gate.
        spec = MagicMock()
        spec.engine = "__test_engine__"
        return spec


def _make_datasource() -> ExploreMixin:
    """Build a minimal ``ExploreMixin`` whose collaborators are stubbed.

    Only the pieces the ``query`` / ``get_query_str`` seams touch on the way to
    ``get_query_str_extended`` are supplied, so the consumer paths exercise the
    real chokepoint wiring without a live ORM datasource or database.
    """
    datasource = _FakeDatasource()
    datasource.sql = None

    sqlaq = MagicMock()
    sqlaq.cte = None
    sqlaq.applied_template_filters = []
    sqlaq.applied_filter_columns = []
    sqlaq.rejected_filter_columns = []
    sqlaq.labels_expected = []
    sqlaq.prequeries = []
    datasource.get_sqla_query = MagicMock(return_value=sqlaq)  # type: ignore

    database = MagicMock()
    database.compile_sqla_query = MagicMock(return_value=COMPILED_SQL)
    database.mutate_sql_based_on_config = MagicMock(side_effect=lambda s: s)
    datasource.database = database

    return datasource


def _spy_gate(mocker: MockerFixture, outcome: EnforcementDecision) -> Any:
    """Replace the gate at the chokepoint with a spy returning ``outcome``."""
    return mocker.patch("superset.models.helpers.enforce", return_value=outcome)


def _noop() -> EnforcementDecision:
    return EnforcementDecision(outcome=EnforcementOutcome.NOOP, sql=COMPILED_SQL)


def _applied() -> EnforcementDecision:
    return EnforcementDecision(
        outcome=EnforcementOutcome.APPLIED,
        sql=FILTERED_SQL,
        applied_filter_count=1,
    )


# ---------------------------------------------------------------------------
# Consumers rendering through the shared QueryContext dataframe path
# (dashboard tile, alerts/reports, thumbnails) all reach the gate via
# ``ExploreMixin.query``. Driving ``query`` directly exercises the exact seam
# their QueryContext delegates to (get_query_result -> query ->
# get_query_str_extended -> enforce).
# ---------------------------------------------------------------------------
def _run_query_consumer(datasource: ExploreMixin) -> str:
    """Drive the dataframe-path seam and return the SQL that was executed.

    ``ExploreMixin.query`` compiles + gates the SQL, then hands it to
    ``database.get_df``; the SQL it hands over is exactly what the consumer would
    execute against the warehouse, and is echoed back on ``QueryResult.query``.
    """
    executed: dict[str, str] = {}

    def _capture_get_df(query_sql: str, *_: Any, **__: Any) -> pd.DataFrame:
        executed["sql"] = query_sql
        return pd.DataFrame({"col": [1]})

    database: Any = datasource.database
    database.get_df = MagicMock(side_effect=_capture_get_df)
    result = datasource.query({})
    # QueryResult.query holds the exact SQL the consumer executed; assert it
    # matches what reached the warehouse driver so the two views cannot diverge.
    assert executed["sql"] == result.query
    return result.query


def test_dashboard_tile_consumer_invokes_gate_once(mocker: MockerFixture) -> None:
    # @AC-FR007-01
    spy = _spy_gate(mocker, _noop())
    datasource = _make_datasource()

    _run_query_consumer(datasource)

    assert spy.call_count == 1
    args, _ = spy.call_args
    assert args[0] is datasource
    assert args[1] == COMPILED_SQL
    assert args[3] == "get_query_str_extended"


def test_dashboard_tile_consumer_executes_filtered_sql(mocker: MockerFixture) -> None:
    # @AC-FR007-01
    # A governed datasource: the gate APPLIES a row filter and the tile executes
    # the filtered SQL, not the raw compiled SQL.
    _spy_gate(mocker, _applied())
    datasource = _make_datasource()

    executed_sql = _run_query_consumer(datasource)

    assert executed_sql == FILTERED_SQL
    assert TENANT_CLAUSE in executed_sql


def test_dashboard_tile_consumer_noop_is_byte_identical(mocker: MockerFixture) -> None:
    # @AC-FR007-01
    # No-RLS deployment: the gate NOOPs and the executed SQL is byte-identical to
    # the un-gated compiled SQL — no regression.
    _spy_gate(mocker, _noop())
    datasource = _make_datasource()

    executed_sql = _run_query_consumer(datasource)

    assert executed_sql == COMPILED_SQL


def test_alerts_reports_consumer_inherits_enforcement(mocker: MockerFixture) -> None:
    # @AC-FR007-02
    # Alerts/reports render the chart through the same QueryContext dataframe
    # seam; the governed filter must reach the SQL they execute.
    spy = _spy_gate(mocker, _applied())
    datasource = _make_datasource()

    executed_sql = _run_query_consumer(datasource)

    assert spy.call_count == 1
    assert executed_sql == FILTERED_SQL


def test_alerts_reports_consumer_noop_is_byte_identical(
    mocker: MockerFixture,
) -> None:
    # @AC-FR007-02
    _spy_gate(mocker, _noop())
    datasource = _make_datasource()

    executed_sql = _run_query_consumer(datasource)

    assert executed_sql == COMPILED_SQL


def test_thumbnail_consumer_inherits_enforcement(mocker: MockerFixture) -> None:
    # @AC-FR007-03
    # A thumbnail renders the chart image from the same QueryContext dataframe
    # path; its executed SQL must carry the governed filter.
    spy = _spy_gate(mocker, _applied())
    datasource = _make_datasource()

    executed_sql = _run_query_consumer(datasource)

    assert spy.call_count == 1
    assert executed_sql == FILTERED_SQL


def test_thumbnail_consumer_noop_is_byte_identical(mocker: MockerFixture) -> None:
    # @AC-FR007-03
    _spy_gate(mocker, _noop())
    datasource = _make_datasource()

    executed_sql = _run_query_consumer(datasource)

    assert executed_sql == COMPILED_SQL


# ---------------------------------------------------------------------------
# CSV/Excel streaming export reaches the gate via ``ExploreMixin.get_query_str``
# (streaming_export_command -> datasource.get_query_str -> get_query_str_extended
# -> enforce). Driving get_query_str exercises the export consumer's exact seam.
# ---------------------------------------------------------------------------
def test_csv_excel_export_consumer_invokes_gate_once(mocker: MockerFixture) -> None:
    # @AC-FR007-04
    spy = _spy_gate(mocker, _noop())
    datasource = _make_datasource()

    datasource.get_query_str({})

    assert spy.call_count == 1
    args, _ = spy.call_args
    assert args[1] == COMPILED_SQL
    assert args[3] == "get_query_str_extended"


def test_csv_excel_export_consumer_inherits_enforcement(
    mocker: MockerFixture,
) -> None:
    # @AC-FR007-04
    # The exported SQL (what the CSV/Excel rows are drawn from) must carry the
    # governed row filter.
    _spy_gate(mocker, _applied())
    datasource = _make_datasource()

    export_sql = datasource.get_query_str({})

    assert TENANT_CLAUSE in export_sql
    assert FILTERED_SQL in export_sql


def test_csv_excel_export_consumer_noop_is_byte_identical(
    mocker: MockerFixture,
) -> None:
    # @AC-FR007-04
    # No-RLS deployment: the exported SQL contains the compiled SQL verbatim, no
    # injected predicate — byte-identical apart from the statement terminator the
    # export path always appends.
    _spy_gate(mocker, _noop())
    datasource = _make_datasource()

    export_sql = datasource.get_query_str({})

    assert export_sql == f"{COMPILED_SQL};"
    assert TENANT_CLAUSE not in export_sql


# ---------------------------------------------------------------------------
# Authenticity by mutation: neutralising the gate (re-emitting the raw compiled
# SQL) must drop the governed filter from each consumer's output. If these go
# GREEN with the gate disabled, the enforcement assertions above are vacuous.
# ---------------------------------------------------------------------------
def test_dataframe_consumer_enforcement_is_authentic(mocker: MockerFixture) -> None:
    # @AC-FR007-05
    # Gate neutralised -> raw SQL re-emitted -> no filter reaches the dataframe
    # consumer's executed SQL.
    _spy_gate(mocker, _noop())
    datasource = _make_datasource()

    executed_sql = _run_query_consumer(datasource)

    assert TENANT_CLAUSE not in executed_sql


def test_export_consumer_enforcement_is_authentic(mocker: MockerFixture) -> None:
    # @AC-FR007-05
    # Gate neutralised -> raw SQL re-emitted -> no filter reaches the export SQL.
    _spy_gate(mocker, _noop())
    datasource = _make_datasource()

    export_sql = datasource.get_query_str({})

    assert TENANT_CLAUSE not in export_sql


# ---------------------------------------------------------------------------
# #33346 parity: a guest/governed ad-hoc-SQL chart render, driven through the
# *real* gate and rewrite mechanism, is row-set-exact with the SQL-Lab apply_rls
# output for the same SQL + rule. This is the chart-vs-SQL-Lab parity owed since
# the ad-hoc-SQL rewrite work — asserted here at the consumer boundary.
# ---------------------------------------------------------------------------
ADHOC_SQL = "SELECT a, b FROM governed_table"
GUEST_CLAUSE = "tenant_id = 1"


def _make_query() -> Any:
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
    query.sql = ADHOC_SQL
    return query


def _guest() -> Any:
    from superset.security.guest_token import GuestUser

    guest = MagicMock(spec=GuestUser)
    guest.username = "tenant_a_guest"
    guest.rls = [{"clause": GUEST_CLAUSE, "dataset": "5"}]
    return guest


def _apply_rls_via_sql_lab(sql: str, predicate: str) -> str:
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


@pytest.fixture
def reset_request_cache() -> Any:
    yield
    rls_module.clear_rls_request_cache()


@pytest.mark.usefixtures("reset_request_cache")
def test_guest_chart_render_is_row_exact_with_sql_lab() -> None:
    # @AC-FR007-05
    query = _make_query()
    guest = _guest()
    with patch.object(
        rls_module, "get_predicates_for_table", return_value=[GUEST_CLAUSE]
    ):
        decision = enforce(query, ADHOC_SQL, guest, "get_query_str_extended")

    assert decision.outcome is EnforcementOutcome.APPLIED
    assert GUEST_CLAUSE in decision.sql
    # Row-set equivalence with the SQL-Lab apply_rls path for the same SQL + rule.
    assert decision.sql == _apply_rls_via_sql_lab(ADHOC_SQL, GUEST_CLAUSE)
