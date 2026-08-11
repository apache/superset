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
"""Marshmallow schema for the read-only RLS enforcement evidence API.

The schema is the non-disclosure boundary: it declares exactly the audit fields
returned to an auditor and nothing else. It carries no SQL, clause, rule text, or
governed row data — the backing model stores none of those.
"""

from marshmallow import fields, Schema


class RlsEnforcementEvidenceGetSchema(Schema):
    """Audit-only projection of one ``rls_enforcement_evidence`` row."""

    id = fields.Integer()
    ts = fields.DateTime()
    path = fields.String(
        metadata={
            "description": "Enumerated entry point (e.g. explore, dashboard, "
            "alert, thumbnail, export, embedded_guest)."
        }
    )
    identity_handle = fields.String(
        metadata={
            "description": "Opaque, non-reversible identity reference (no PII)."
        }
    )
    datasource_kind = fields.String(
        metadata={"description": "query or sqla_table."}
    )
    datasource_id = fields.Integer(
        allow_none=True,
        metadata={"description": "Internal datasource id, not a table name."},
    )
    outcome = fields.String(metadata={"description": "applied or denied."})
    applied_filter_count = fields.Integer(
        metadata={"description": "Count of applied filters only — never the clauses."}
    )
    denial_class = fields.String(
        allow_none=True,
        metadata={"description": "Denial class when the outcome is denied."},
    )
    integrity_prev_hash = fields.String(
        allow_none=True,
        metadata={"description": "Predecessor hash of the optional tamper chain."},
    )
    integrity_hash = fields.String(
        allow_none=True,
        metadata={"description": "Content hash of the optional tamper chain."},
    )


openapi_spec_methods_override = {
    "get": {"get": {"summary": "Get an RLS enforcement evidence record"}},
    "get_list": {
        "get": {
            "summary": "Get a list of RLS enforcement evidence records",
            "description": "Auditor/admin-scoped, read-only, governed-data-free "
            "audit trail of row-level-security enforcement outcomes. Use Rison or "
            "JSON query parameters to filter by outcome, identity handle, "
            "datasource, or time range.",
        }
    },
    "info": {"get": {"summary": "Get metadata information about this API resource"}},
}
