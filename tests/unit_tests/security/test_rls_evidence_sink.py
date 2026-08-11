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
"""Tests for the row-level-security enforcement evidence sink.

The sink persists one ``rls_enforcement_evidence`` row per governed decision,
DECOUPLED from the decision itself: a sink failure is logged and swallowed and
must never change or block the enforcement outcome. An optional hash chain makes
the append-only trail tamper-evident when enabled by config; when disabled the
chain columns stay null and behavior is unchanged.

Persistence is exercised against a real in-memory SQLite database created from
the model's own metadata; only the app config and identity/datasource seams are
mocked.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from superset.models.rls_evidence import RlsEnforcementEvidence
from superset.security import rls_enforcement as sink_mod
from superset.security.rls_enforcement import (
    EnforcementDecision,
    EnforcementOutcome,
    record_evidence,
)

COMPILED_SQL = "SELECT col FROM governed_table"


def _sqlite_session() -> Session:
    """Real SQLite session backed by the evidence model's own metadata."""
    engine = create_engine("sqlite://", future=True)
    RlsEnforcementEvidence.__table__.create(bind=engine)
    factory = sessionmaker(bind=engine, future=True)
    return factory()


def _query_datasource(datasource_id: int = 7) -> Any:
    """A stand-in ``Query`` datasource the sink classifies by duck-typed kind."""
    datasource = MagicMock()
    datasource.__class__.__name__ = "Query"
    datasource.id = datasource_id
    return datasource


def _guest_identity(username: str = "tenant-a", rls: Any = None) -> Any:
    identity = MagicMock()
    identity.username = username
    identity.rls = rls if rls is not None else [{"clause": "tenant_id = 1"}]
    return identity


@pytest.fixture
def hash_chain_disabled(mocker: Any) -> None:
    mocker.patch.object(sink_mod, "_hash_chain_enabled", return_value=False)


@pytest.fixture
def hash_chain_enabled(mocker: Any) -> None:
    mocker.patch.object(sink_mod, "_hash_chain_enabled", return_value=True)


def _applied_decision(count: int = 2) -> EnforcementDecision:
    return EnforcementDecision(
        outcome=EnforcementOutcome.APPLIED,
        sql=COMPILED_SQL,
        applied_filter_count=count,
    )


def _denied_decision(denial_class: str = "parse_failure") -> EnforcementDecision:
    return EnforcementDecision(
        outcome=EnforcementOutcome.DENIED,
        sql=COMPILED_SQL,
        denial_class=denial_class,
    )


# ---------------------------------------------------------------------------
# Evidence fidelity
# ---------------------------------------------------------------------------


@pytest.mark.usefixtures("hash_chain_disabled")
def test_applied_decision_writes_exactly_one_row() -> None:
    """@AC-FR10-07: a successful applied enforcement persists exactly one row
    capturing outcome, identity handle, datasource, and applied filter count."""
    session = _sqlite_session()
    record_evidence(
        _query_datasource(datasource_id=7),
        _guest_identity("tenant-a"),
        "explore",
        _applied_decision(count=3),
        session=session,
    )

    rows = session.query(RlsEnforcementEvidence).all()
    assert len(rows) == 1
    row = rows[0]
    assert row.outcome == "applied"
    assert row.path == "explore"
    assert row.datasource_kind == "query"
    assert row.datasource_id == 7
    assert row.applied_filter_count == 3
    assert row.denial_class is None
    assert row.ts is not None
    # Identity handle is present but opaque: it is not the raw username.
    assert row.identity_handle
    assert "tenant-a" not in row.identity_handle
    session.close()


@pytest.mark.usefixtures("hash_chain_disabled")
def test_denied_decision_records_denial_class() -> None:
    """@AC-FR10-08: a denied enforcement persists the denial class server-side."""
    session = _sqlite_session()
    record_evidence(
        _query_datasource(),
        _guest_identity(),
        "embedded_guest",
        _denied_decision("cross_db_ref"),
        session=session,
    )

    row = session.query(RlsEnforcementEvidence).one()
    assert row.outcome == "denied"
    assert row.denial_class == "cross_db_ref"
    assert row.applied_filter_count == 0
    session.close()


@pytest.mark.usefixtures("hash_chain_disabled")
def test_noop_decision_persists_no_row() -> None:
    """@AC-FR10-09: a no-op (no rule applied) writes no evidence row."""
    session = _sqlite_session()
    record_evidence(
        _query_datasource(),
        _guest_identity(),
        "explore",
        EnforcementDecision(outcome=EnforcementOutcome.NOOP, sql=COMPILED_SQL),
        session=session,
    )
    assert session.query(RlsEnforcementEvidence).count() == 0
    session.close()


@pytest.mark.usefixtures("hash_chain_disabled")
def test_identity_handle_is_stable_and_distinguishes_identities() -> None:
    """@AC-FR10-10: the opaque identity handle is deterministic for one identity
    and differs across identities so evidence is attributable without PII."""
    session = _sqlite_session()
    record_evidence(
        _query_datasource(), _guest_identity("tenant-a"), "explore",
        _applied_decision(), session=session,
    )
    record_evidence(
        _query_datasource(), _guest_identity("tenant-a"), "explore",
        _applied_decision(), session=session,
    )
    record_evidence(
        _query_datasource(), _guest_identity("tenant-b"), "explore",
        _applied_decision(), session=session,
    )

    handles = [r.identity_handle for r in session.query(RlsEnforcementEvidence).all()]
    assert handles[0] == handles[1]
    assert handles[0] != handles[2]
    session.close()


# ---------------------------------------------------------------------------
# Decision-independence (adversarial)
# ---------------------------------------------------------------------------


@pytest.mark.usefixtures("hash_chain_disabled")
def test_sink_failure_is_swallowed_and_never_raises() -> None:
    """@AC-FR10-11: a sink DB error is swallowed at the boundary — no exception
    escapes to the caller."""
    session = MagicMock()
    session.add.side_effect = RuntimeError("db is down")

    # Must not raise.
    record_evidence(
        _query_datasource(),
        _guest_identity(),
        "explore",
        _applied_decision(),
        session=session,
    )


def test_enforce_decision_unchanged_when_sink_raises(mocker: Any) -> None:
    """@AC-FR10-12: injecting a sink failure into enforce() leaves the returned
    decision's outcome/sql/counts UNCHANGED and raises nothing."""
    # A NOOP-producing SqlaTable datasource so enforce() takes a deterministic
    # branch, then force the sink to explode.
    from superset.connectors.sqla.models import SqlaTable

    datasource = MagicMock(spec=SqlaTable)
    boom = mocker.patch.object(
        sink_mod, "record_evidence", side_effect=RuntimeError("sink exploded")
    )

    decision = sink_mod.enforce(datasource, COMPILED_SQL, None, "explore")

    # The decision stands exactly as computed; the sink error did not propagate.
    assert decision.outcome is EnforcementOutcome.NOOP
    assert decision.sql == COMPILED_SQL
    assert boom.called


def test_enforce_still_invokes_sink_on_the_decision(mocker: Any) -> None:
    """@AC-FR10-13: enforce() drives the sink with the decision it produced."""
    from superset.connectors.sqla.models import SqlaTable

    datasource = MagicMock(spec=SqlaTable)
    recorder = mocker.patch.object(sink_mod, "record_evidence")

    decision = sink_mod.enforce(datasource, COMPILED_SQL, None, "explore")

    assert recorder.called
    _, kwargs = recorder.call_args
    passed = recorder.call_args[0]
    # The decision object handed to the sink is the one returned to the caller.
    assert decision in passed or decision in kwargs.values()


# ---------------------------------------------------------------------------
# Hash chain
# ---------------------------------------------------------------------------


@pytest.mark.usefixtures("hash_chain_disabled")
def test_hash_chain_disabled_leaves_chain_columns_null() -> None:
    """@AC-FR10-14: with the chain disabled, both integrity columns stay null."""
    session = _sqlite_session()
    record_evidence(
        _query_datasource(), _guest_identity(), "explore",
        _applied_decision(), session=session,
    )
    row = session.query(RlsEnforcementEvidence).one()
    assert row.integrity_prev_hash is None
    assert row.integrity_hash is None
    session.close()


@pytest.mark.usefixtures("hash_chain_enabled")
def test_hash_chain_links_row_to_predecessor() -> None:
    """@AC-FR10-15: with the chain enabled, row N's prev-hash equals row N-1's
    hash and every row carries a non-null content hash."""
    session = _sqlite_session()
    for _ in range(3):
        record_evidence(
            _query_datasource(), _guest_identity(), "explore",
            _applied_decision(), session=session,
        )

    rows = session.query(RlsEnforcementEvidence).order_by(
        RlsEnforcementEvidence.id
    ).all()
    assert len(rows) == 3
    assert rows[0].integrity_prev_hash is None  # genesis row
    for prev, curr in zip(rows, rows[1:], strict=False):
        assert curr.integrity_hash is not None
        assert prev.integrity_hash is not None
        assert curr.integrity_prev_hash == prev.integrity_hash
    session.close()


@pytest.mark.usefixtures("hash_chain_enabled")
def test_hash_chain_detects_tampering() -> None:
    """@AC-FR10-16: recomputing a row's hash after its content is altered no
    longer matches the stored hash — tampering is detectable."""
    session = _sqlite_session()
    for _ in range(2):
        record_evidence(
            _query_datasource(), _guest_identity(), "explore",
            _applied_decision(), session=session,
        )

    rows = session.query(RlsEnforcementEvidence).order_by(
        RlsEnforcementEvidence.id
    ).all()
    target = rows[1]
    # Recomputing the stored hash over the untampered content reproduces it.
    good = sink_mod.compute_evidence_hash(target, target.integrity_prev_hash)
    assert good == target.integrity_hash

    # Tamper with the persisted content: the recomputed hash diverges.
    target.applied_filter_count = target.applied_filter_count + 99
    tampered = sink_mod.compute_evidence_hash(target, target.integrity_prev_hash)
    assert tampered != target.integrity_hash
    session.close()


@pytest.mark.usefixtures("hash_chain_enabled")
def test_verify_chain_flags_broken_link() -> None:
    """@AC-FR10-17: an integrity verification over the persisted chain passes on
    an untouched chain and fails once a row's content is altered."""
    session = _sqlite_session()
    for _ in range(3):
        record_evidence(
            _query_datasource(), _guest_identity(), "explore",
            _applied_decision(), session=session,
        )

    rows = session.query(RlsEnforcementEvidence).order_by(
        RlsEnforcementEvidence.id
    ).all()
    assert sink_mod.verify_evidence_chain(rows) is True

    rows[1].outcome = "denied"
    assert sink_mod.verify_evidence_chain(rows) is False
    session.close()


# ---------------------------------------------------------------------------
# Non-disclosure
# ---------------------------------------------------------------------------


@pytest.mark.usefixtures("hash_chain_disabled")
def test_evidence_never_stores_sql_or_clause_text() -> None:
    """@AC-FR10-18: the evidence row carries no governed data — no SQL text, no
    clause text, no raw table name."""
    session = _sqlite_session()
    record_evidence(
        _query_datasource(),
        _guest_identity(rls=[{"clause": "secret_tenant_col = 42"}]),
        "explore",
        _applied_decision(),
        session=session,
    )
    row = session.query(RlsEnforcementEvidence).one()
    serialized = " ".join(
        str(getattr(row, c.name)) for c in RlsEnforcementEvidence.__table__.columns
    )
    assert "governed_table" not in serialized
    assert "secret_tenant_col" not in serialized
    assert "SELECT" not in serialized.upper()
    session.close()
