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
"""Tests for the read-only RLS enforcement evidence query API.

The endpoint exposes the append-only ``rls_enforcement_evidence`` audit trail to
an auditor/admin scope, gated by a dedicated FAB permission. It is queryable by
outcome, identity handle, and time range, and returns audit fields only — never
governed rows, rule/clause text, or SQL.

These are app-factory HTTP tests: the request travels through the real
Flask-AppBuilder router and the ``@protect`` authorization decorator against a
metadata database provisioned on demand from the model's own metadata.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset.models.rls_evidence import RlsEnforcementEvidence

EVIDENCE_URL = "/api/v1/security/rls/enforcement-evidence/"


def _seed_evidence(session: Session) -> None:
    """Provision the evidence table and a couple of audit rows."""
    from superset.security.rls_evidence_api import RlsEnforcementEvidenceRestApi

    RlsEnforcementEvidenceRestApi.datamodel._session = session
    RlsEnforcementEvidence.metadata.create_all(session.get_bind())

    session.add(
        RlsEnforcementEvidence(
            ts=datetime(2026, 8, 1, 10, 0, 0),
            path="explore",
            identity_handle="handle-applied-abc",
            datasource_kind="query",
            datasource_id=7,
            outcome="applied",
            applied_filter_count=2,
            denial_class=None,
            integrity_prev_hash=None,
            integrity_hash="hash-1",
        )
    )
    session.add(
        RlsEnforcementEvidence(
            ts=datetime(2026, 8, 2, 11, 0, 0),
            path="embedded_guest",
            identity_handle="handle-denied-xyz",
            datasource_kind="query",
            datasource_id=9,
            outcome="denied",
            applied_filter_count=0,
            denial_class="cross_db_ref",
            integrity_prev_hash="hash-1",
            integrity_hash="hash-2",
        )
    )
    session.commit()


# ---------------------------------------------------------------------------
# Authorized read
# ---------------------------------------------------------------------------


def test_auditor_can_list_evidence(
    session: Session,
    client: Any,
    full_api_access: None,
) -> None:
    """@AC-FR10-19: an authorized auditor lists enforcement evidence (200)."""
    _seed_evidence(session)

    response = client.get(EVIDENCE_URL)

    assert response.status_code == 200
    payload = response.json
    assert payload["count"] == 2
    outcomes = {row["outcome"] for row in payload["result"]}
    assert outcomes == {"applied", "denied"}


def test_auditor_can_get_single_evidence_row(
    session: Session,
    client: Any,
    full_api_access: None,
) -> None:
    """@AC-FR10-20: an authorized auditor fetches a single evidence row (200)."""
    _seed_evidence(session)

    listed = client.get(EVIDENCE_URL).json["result"]
    pk = listed[0]["id"]

    response = client.get(f"{EVIDENCE_URL}{pk}")

    assert response.status_code == 200
    assert response.json["result"]["outcome"] in {"applied", "denied"}


def test_evidence_filterable_by_outcome(
    session: Session,
    client: Any,
    full_api_access: None,
) -> None:
    """@AC-FR10-21: results can be filtered to a single outcome class."""
    _seed_evidence(session)

    response = client.get(
        f"{EVIDENCE_URL}?q=(filters:!((col:outcome,opr:eq,value:denied)))"
    )

    assert response.status_code == 200
    payload = response.json
    assert payload["count"] == 1
    assert payload["result"][0]["outcome"] == "denied"
    assert payload["result"][0]["denial_class"] == "cross_db_ref"


# ---------------------------------------------------------------------------
# Authorization (adversarial — the negative is the point)
# ---------------------------------------------------------------------------


def test_unauthorized_user_is_denied(
    session: Session,
    client: Any,
    mocker: MockerFixture,
) -> None:
    """@AC-FR10-22: a caller WITHOUT the auditor permission is denied (401/403).

    The permission is enforced, not decorative: authentication passes but the
    evidence permission check fails, so no audit rows are disclosed.
    """
    from superset import security_manager

    _seed_evidence(session)

    # Authentication succeeds; the resource is not public; the permission check
    # for reading evidence fails.
    mocker.patch(
        "flask_appbuilder.security.decorators.verify_jwt_in_request",
        return_value=True,
    )
    mocker.patch.object(security_manager, "is_item_public", return_value=False)
    mocker.patch.object(security_manager, "has_access", return_value=False)

    response = client.get(EVIDENCE_URL)

    assert response.status_code in (401, 403)
    # No governed audit rows leaked in the denial body.
    body = response.get_data(as_text=True)
    assert "handle-applied-abc" not in body
    assert "handle-denied-xyz" not in body


# ---------------------------------------------------------------------------
# Non-disclosure boundary (serialized response schema)
# ---------------------------------------------------------------------------


def test_response_schema_carries_audit_fields_only(
    session: Session,
    client: Any,
    full_api_access: None,
) -> None:
    """@AC-FR10-23: the serialized row exposes audit fields and NOTHING that
    could carry governed data — no SQL, clause, rule text, or table name."""
    _seed_evidence(session)

    response = client.get(EVIDENCE_URL)
    assert response.status_code == 200
    row = response.json["result"][0]

    # Audit fields present.
    for field in (
        "id",
        "ts",
        "path",
        "identity_handle",
        "datasource_kind",
        "outcome",
        "applied_filter_count",
        "denial_class",
    ):
        assert field in row, f"missing audit field: {field}"

    # Governed-data-bearing fields absent by construction.
    forbidden = {
        "sql",
        "clause",
        "clauses",
        "rule",
        "rule_text",
        "table_name",
        "tables",
        "predicate",
        "where",
        "row",
        "rows",
        "data",
    }
    leaked = forbidden.intersection(row.keys())
    assert not leaked, f"response leaked governed fields: {leaked}"

    # And no value in the payload smuggles SQL/clause text.
    serialized = " ".join(str(v) for v in row.values())
    assert "SELECT" not in serialized.upper()
    assert "WHERE" not in serialized.upper()


def test_no_create_update_delete_routes(
    session: Session,
    client: Any,
    full_api_access: None,
) -> None:
    """@AC-FR10-24: the API is read-only — write verbs are not routed (405)."""
    _seed_evidence(session)

    post = client.post(EVIDENCE_URL, json={"outcome": "applied"})
    assert post.status_code == 405

    delete = client.delete(f"{EVIDENCE_URL}1")
    assert delete.status_code == 405
