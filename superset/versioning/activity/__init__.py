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
"""Read-side queries for the cross-entity activity-view API.

Companion to :mod:`superset.versioning.queries`. Whereas ``queries.py``
returns transaction-level history for a single entity, the helpers
here unify change-record history across an entity's transitive
dependency chain — a dashboard's activity stream includes edits to
charts that were attached to it AND edits to datasets those charts
pointed at, each time-bounded by when the relationship was active.

One public entry point — :func:`get_activity` — dispatches on the
first argument to serve all three endpoint families:

* ``get_activity(Dashboard, dashboard_uuid, ...)`` — own edits +
  charts attached during their dashboard window + datasets those
  charts used during their chart window.
* ``get_activity(Slice, chart_uuid, ...)`` — own edits + datasets the
  chart pointed at during association.
* ``get_activity(SqlaTable, dataset_uuid, ...)`` — own edits only.
  Datasets are not transitive recipients of activity in V2.

Package layout (descends from public entry point to leaf helpers):

* :mod:`.orchestrator` — :func:`get_activity` (public), the
  ``activity_endpoint`` REST helper, the request param parser
  (:func:`parse_activity_query_params`), and the observability
  instrumentation (request-shape + per-kind metrics).
* :mod:`.scope` — scope resolution (DB-touching):
  :func:`resolve_scope` / :func:`_resolve_dashboard_scope` /
  :func:`_resolve_chart_scope` / :func:`_resolve_related_scope`.
* :mod:`.windows` — pure window arithmetic on half-open
  ``[start_tx, end_tx)`` intervals: :func:`intersect_windows` /
  :func:`union_windows` / :func:`merge_entity_windows` /
  :func:`row_within_any_window`. Extracted from :mod:`.scope` so
  :mod:`.queries` can import the pure helpers at module-top instead
  of through a cycle-dodging lazy import.
* :mod:`.queries` — every DB-touching helper: Phase A relationship
  walks, Phase B change-record fetch, name denormalization,
  path-entity resolution, and tombstone-state lookup.
* :mod:`.impact` — per-record impact-count computation (the only
  field that requires its own batched query).
* :mod:`.visibility` — the silent visibility filter; uses
  the same SQL-side access filters FAB applies on list endpoints.
* :mod:`.render` — record-decoration helpers that turn raw rows into
  the ActivityRecord DTO (summary headlines, ``changed_by`` projection,
  uuid lookup).
* :mod:`.kinds` — the kind-translation tables, the ``Window`` /
  ``EntityWindows`` type aliases, and :func:`load_shadow_model`.

The public surface (re-exported here) is the eight symbols below.
Sub-module privates are intentionally NOT re-exported — tests and
new internal callers should import them from their owning submodule
(e.g. ``from superset.versioning.activity.windows import
intersect_windows``) so the package's public API stays scannable.

``PathEntityResponseError`` and ``resolve_endpoint_path_entity`` are
re-exported here from :mod:`superset.versioning.api_helpers` (where
they live alongside the ``/versions/`` endpoint handlers) so the
three ``/activity/`` endpoint callers can ``from
superset.versioning.activity import resolve_endpoint_path_entity``
without crossing into the ``/versions/`` module name.
"""

from __future__ import annotations

from superset.versioning.activity.kinds import EntityWindows, Window
from superset.versioning.activity.orchestrator import (
    activity_endpoint,
    ActivityParamsError,
    get_activity,
    parse_activity_query_params,
)
from superset.versioning.api_helpers import (
    PathEntityResponseError,
    resolve_endpoint_path_entity,
)

__all__ = [
    "ActivityParamsError",
    "EntityWindows",
    "PathEntityResponseError",
    "Window",
    "activity_endpoint",
    "get_activity",
    "parse_activity_query_params",
    "resolve_endpoint_path_entity",
]
