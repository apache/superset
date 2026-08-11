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
"""Read-only query API over the ``rls_enforcement_evidence`` audit trail.

The endpoint gives an auditor/admin a trustworthy, queryable record that
row-level-security enforcement held — the applied-filter counts and the denial
classes per entry point and identity. It is gated by a dedicated Flask-AppBuilder
permission (``can read`` on ``RlsEnforcementEvidence``) that no default role
holds, so a restricted analyst cannot read another identity's outcomes.

The API is READ-ONLY (list / get + filters) — there is no create, update, or
delete route. It surfaces audit fields only (outcome, opaque identity handle,
datasource kind/id, applied-filter count, denial class, timestamps, and the
optional tamper-evidence hash columns). It never returns governed rows, rule or
clause text, or SQL: the backing model stores none of those, and only the audit
columns are listed here.
"""

import logging

from flask_appbuilder.models.sqla.interface import SQLAInterface

from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.models.rls_evidence import RlsEnforcementEvidence
from superset.security.rls_evidence_schemas import (
    openapi_spec_methods_override,
    RlsEnforcementEvidenceGetSchema,
)
from superset.views.base_api import BaseSupersetModelRestApi

logger = logging.getLogger(__name__)


class RlsEnforcementEvidenceRestApi(BaseSupersetModelRestApi):
    """Auditor-scoped, read-only view over RLS enforcement evidence."""

    datamodel = SQLAInterface(RlsEnforcementEvidence)

    # Read-only: only GET / GET_LIST / INFO are exposed — no POST / PUT / DELETE.
    include_route_methods = {RouteMethod.GET, RouteMethod.GET_LIST, RouteMethod.INFO}
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP

    # A dedicated permission class distinct from the RLS-rule CRUD API. FAB
    # auto-creates ``can read on RlsEnforcementEvidence`` on init; it is granted
    # to no default role, so only an explicitly authorized auditor/admin reads.
    class_permission_name = "RlsEnforcementEvidence"
    resource_name = "security/rls/enforcement-evidence"
    openapi_spec_tag = "Row Level Security"
    openapi_spec_methods = openapi_spec_methods_override
    allow_browser_login = True

    # Audit fields only — never SQL, clause, rule text, or governed rows.
    list_columns = [
        "id",
        "ts",
        "path",
        "identity_handle",
        "datasource_kind",
        "datasource_id",
        "outcome",
        "applied_filter_count",
        "denial_class",
        "integrity_prev_hash",
        "integrity_hash",
    ]
    show_columns = list_columns
    order_columns = [
        "ts",
        "path",
        "identity_handle",
        "datasource_kind",
        "outcome",
        "applied_filter_count",
        "denial_class",
    ]
    # Queryable by outcome, identity handle, datasource, and time range (``ts``).
    search_columns = [
        "ts",
        "path",
        "identity_handle",
        "datasource_kind",
        "datasource_id",
        "outcome",
        "denial_class",
    ]
    base_order = ("ts", "desc")

    list_model_schema = RlsEnforcementEvidenceGetSchema()
    show_model_schema = RlsEnforcementEvidenceGetSchema()
