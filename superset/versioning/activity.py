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
"""Read-side queries for the cross-entity activity-view API (sc-107283).

Companion to :mod:`superset.versioning.queries`. Whereas ``queries.py``
returns transaction-level history for a single entity, the helpers here
unify change-record history across an entity's transitive dependency
chain — a dashboard's activity stream includes edits to charts that
were attached to it AND edits to datasets those charts pointed at,
each time-bounded by when the relationship was active.

Three public entry points correspond to the three endpoint families:

* ``get_activity(Dashboard, dashboard_uuid, ...)`` — own edits + charts
  attached during their dashboard window + datasets those charts used
  during their chart window.
* ``get_activity(Slice, chart_uuid, ...)`` — own edits + datasets the
  chart pointed at during association.
* ``get_activity(SqlaTable, dataset_uuid, ...)`` — own edits only.
  Datasets are not transitive recipients of activity in V2.

Built on top of sc-103156's shadow tables:

* ``dashboards_version`` / ``slices_version`` / ``tables_version`` —
  per-entity scalar shadows.
* ``dashboard_slices_version`` — M2M shadow capturing chart-on-dashboard
  validity windows.
* ``version_changes`` — atomic per-field change records keyed by
  ``(transaction_id, entity_kind, entity_id)``.
* ``version_transaction`` — per-commit metadata (``issued_at``, ``user_id``).

The relationship-traversal logic and time-window intersection live here;
sc-103156's read primitives (``find_active_by_uuid``,
``derive_version_uuid``, ``_resolve_version_tables``) are reused as-is.

See the spec at ``specs/sc-107283-versioning-activity-view/spec.md``
(AV-001..AV-020) and the plan's decision log (D-01..D-19) for the
design rationale.
"""

from __future__ import annotations
