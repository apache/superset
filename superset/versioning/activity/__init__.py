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

* :mod:`.orchestrator` — :func:`get_activity` (public), the request
  param parser (:func:`parse_activity_query_params`), and the
  observability instrumentation that T037/T038 specify.
* :mod:`.scope` — pure window arithmetic + scope resolution
  (:func:`_resolve_scope` / :func:`_resolve_dashboard_scope` /
  :func:`_resolve_chart_scope`, plus :func:`_intersect_windows` /
  :func:`_union_windows` / :func:`_merge_entity_windows` /
  :func:`_row_within_any_window`).
* :mod:`.queries` — every DB-touching helper: Phase A relationship
  walks, Phase B change-record fetch, name denormalization,
  path-entity resolution, and tombstone-state lookup.
* :mod:`.impact` — per-record impact-count computation (the only
  field that requires its own batched query).
* :mod:`.visibility` — the AV-008 silent visibility filter; uses
  the same SQL-side access filters FAB applies on list endpoints.
* :mod:`.render` — record-decoration helpers that turn raw rows into
  the ActivityRecord DTO (summary headlines, ``changed_by`` projection,
  uuid lookup).
* :mod:`.kinds` — the kind-translation tables, the ``Window`` /
  ``EntityWindows`` type aliases, and :func:`_load_shadow_model`.

``PathEntityResponseError`` and ``resolve_endpoint_path_entity`` are
re-exported here from :mod:`superset.versioning.api_helpers` (where
they live alongside the ``/versions/`` endpoint handlers) so the
three ``/activity/`` endpoint callers in ``charts/api.py`` /
``dashboards/api.py`` / ``datasets/api.py`` (which import via
``activity_module.<name>``) keep working without an import-path
migration.

Re-exports below preserve every symbol previously importable from
``superset.versioning.activity`` — public, test-private, and
``activity_module.<name>``-style call sites are all unaffected.
"""

from __future__ import annotations

from superset.versioning.activity.impact import (
    _batch_chart_counts,
    _collect_impact_pairs,
    _impact_for_record,
)
from superset.versioning.activity.kinds import (
    _API_KIND_LABEL,
    _API_KIND_TO_TABLE,
    _load_shadow_model,
    _NAME_COLUMN,
    _NOT_FOUND_EXC,
    _TABLE_KIND_TO_API,
    _USER_FACING_KIND,
    EntityWindows,
    Window,
)
from superset.versioning.activity.orchestrator import (
    _DEFAULT_PAGE_SIZE,
    _emit_request_shape_attributes,
    _MAX_PAGE_SIZE,
    _METRIC_PREFIX,
    _parse_include,
    _parse_iso_datetime,
    _parse_optional_iso,
    _parse_page,
    _parse_page_size,
    _phase_timer,
    _VALID_INCLUDE_VALUES,
    activity_endpoint,
    ActivityParamsError,
    get_activity,
    parse_activity_query_params,
)
from superset.versioning.activity.queries import (
    _batch_datasets_used_by_charts,
    _charts_attached_to_dashboard,
    _check_entity_tombstones,
    _datasets_used_by_chart,
    _denormalize_entity_names,
    _fetch_change_records,
    _resolve_names_for_kind,
    _resolve_path_entity,
    _select_change_rows_for_kinds,
)
from superset.versioning.activity.render import (
    _build_summary,
    _changed_by_dict,
    _decorate_records,
    _lookup_entity_uuids,
    _SUMMARY_VERBS,
)
from superset.versioning.activity.scope import (
    _intersect_windows,
    _merge_entity_windows,
    _resolve_chart_scope,
    _resolve_dashboard_scope,
    _resolve_related_scope,
    _resolve_scope,
    _row_within_any_window,
    _union_windows,
)
from superset.versioning.activity.visibility import (
    _filter_records_by_visibility,
    _resolve_visibility,
)

# Re-exported from api_helpers so the three /activity/ endpoint
# callers (which import via ``activity_module.PathEntityResponseError``
# / ``activity_module.resolve_endpoint_path_entity``) keep working
# without an import-path migration.
from superset.versioning.api_helpers import (
    PathEntityResponseError,
    resolve_endpoint_path_entity,
)

__all__ = [
    # Public API
    "ActivityParamsError",
    "EntityWindows",
    "PathEntityResponseError",
    "Window",
    "activity_endpoint",
    "get_activity",
    "parse_activity_query_params",
    "resolve_endpoint_path_entity",
    # Test-imported privates (kept stable for test_activity.py)
    "_API_KIND_LABEL",
    "_API_KIND_TO_TABLE",
    "_DEFAULT_PAGE_SIZE",
    "_MAX_PAGE_SIZE",
    "_METRIC_PREFIX",
    "_NAME_COLUMN",
    "_NOT_FOUND_EXC",
    "_SUMMARY_VERBS",
    "_TABLE_KIND_TO_API",
    "_USER_FACING_KIND",
    "_VALID_INCLUDE_VALUES",
    "_batch_chart_counts",
    "_batch_datasets_used_by_charts",
    "_build_summary",
    "_changed_by_dict",
    "_charts_attached_to_dashboard",
    "_check_entity_tombstones",
    "_collect_impact_pairs",
    "_datasets_used_by_chart",
    "_decorate_records",
    "_denormalize_entity_names",
    "_emit_request_shape_attributes",
    "_fetch_change_records",
    "_filter_records_by_visibility",
    "_impact_for_record",
    "_intersect_windows",
    "_load_shadow_model",
    "_lookup_entity_uuids",
    "_merge_entity_windows",
    "_parse_include",
    "_parse_iso_datetime",
    "_parse_optional_iso",
    "_parse_page",
    "_parse_page_size",
    "_phase_timer",
    "_resolve_chart_scope",
    "_resolve_dashboard_scope",
    "_resolve_names_for_kind",
    "_resolve_path_entity",
    "_resolve_related_scope",
    "_resolve_scope",
    "_resolve_visibility",
    "_row_within_any_window",
    "_select_change_rows_for_kinds",
    "_union_windows",
]
