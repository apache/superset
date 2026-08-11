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
"""The ``rls_enforcement_evidence`` table: append-only, governed-data-free
audit of row-level-security enforcement outcomes.

Each row records the outcome of a single enforcement decision on a chart /
dashboard / export / embedded-guest render: the entry point, an opaque
identity handle, the datasource kind and id, and whether the row-level
security filters were applied or the query was denied. It stores counts and
classes only — never the filter clauses, table contents, or row values — so
the audit trail carries no governed data or PII.

There is no foreign key to ``row_level_security_filters``: the evidence must
survive rule deletion and must not disclose which rule fired.

The model is defined here so it registers with ``Model.metadata`` at app
init like every other Superset model; otherwise Alembic autogenerate and
metadata-driven tooling would not see the table.
"""

from flask_appbuilder import Model
from sqlalchemy import BigInteger, Column, DateTime, Index, Integer, String

#: Enforcement outcomes persisted to the evidence sink. ``applied`` means the
#: row-level-security filters were injected; ``denied`` means the query was
#: rejected fail-closed. A no-op (no rule applied) is not persisted here.
OUTCOME_APPLIED = "applied"
OUTCOME_DENIED = "denied"

#: Datasource kinds an enforcement decision can be taken against.
DATASOURCE_KIND_QUERY = "query"
DATASOURCE_KIND_SQLA_TABLE = "sqla_table"


class RlsEnforcementEvidence(Model):
    """Append-only, content-free record of an RLS enforcement decision."""

    __tablename__ = "rls_enforcement_evidence"
    __table_args__ = (
        Index("ix_rls_evidence_ts", "ts"),
        Index("ix_rls_evidence_identity_ts", "identity_handle", "ts"),
        Index("ix_rls_evidence_outcome_ts", "outcome", "ts"),
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    #: UTC timestamp of the enforcement decision.
    ts = Column(DateTime, nullable=False)
    #: Enumerated entry point, e.g. explore / dashboard / alert / thumbnail /
    #: export / embedded_guest.
    path = Column(String(32), nullable=False)
    #: Opaque, non-reversible hash of the identity; no PII.
    identity_handle = Column(String(128), nullable=False)
    #: ``query`` (ad-hoc SQL) or ``sqla_table``.
    datasource_kind = Column(String(16), nullable=False)
    #: Internal datasource id, not a table name; nullable.
    datasource_id = Column(BigInteger, nullable=True)
    #: ``applied`` / ``denied``.
    outcome = Column(String(8), nullable=False)
    #: Count of applied filters only — never the clauses.
    applied_filter_count = Column(Integer, nullable=False, default=0)
    #: Denial class when ``outcome == 'denied'``; nullable otherwise.
    denial_class = Column(String(24), nullable=True)
    #: Optional hash-chain columns for tamper-evidence; populated only when
    #: the integrity chain is enabled.
    integrity_prev_hash = Column(String(64), nullable=True)
    integrity_hash = Column(String(64), nullable=True)
