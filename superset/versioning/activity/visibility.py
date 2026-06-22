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
"""Silent visibility filter for activity-view records.

Drops records whose source entity the requester can't read. Silent in
the sense that dropped records contribute no count and no placeholder
to the response — the user sees only what they're entitled to see, and
the response shape can't be used to infer the existence of entities
they're gated out of.

Visibility is resolved SQL-side via each resource's existing FAB
access filter (``DashboardAccessFilter`` / ``ChartFilter`` /
``DatasourceFilter``). Two SQL queries per kind (one for live ids, one
for the access-filtered subset) replace the N-call
``security_manager.can_access_<kind>(entity)`` loop that dominated
latency on dashboard-scope responses with many related entities
(sqlalchemy-review W-NEW-1).

**Inline imports.** ``_resolve_visibility`` defers the FAB-filter
imports (``DashboardAccessFilter`` / ``ChartFilter`` /
``DatasourceFilter`` and ``SQLAInterface``) until call time. Same
init-order rationale as :mod:`superset.versioning.baseline` —
``versioning`` packages are imported from ``init_versioning()``
before all model mappers are configured, and the filter classes pull
in their resource's model graph (Chart → Dataset → Database for
``ChartFilter``, etc.); a module-top import would trip mapper
resolution before Continuum's ``make_versioned()`` has finished.

**Integration shape.** The activity-view consumes FAB's access-filter
classes (``DashboardAccessFilter`` / ``ChartFilter`` /
``DatasourceFilter``) directly rather than translating them or
re-implementing the predicate. That keeps the activity stream's
visibility posture identical to the list endpoints' — operator-
controlled and stable — at the cost of coupling to FAB's exact
filter shape. Future entities added to the activity surface must
extend the dispatch table in ``_resolve_visibility`` to include
their access-filter class.
"""

from __future__ import annotations

import logging
from typing import Any

from superset.extensions import db
from superset.versioning.activity.kinds import (
    chunked_ids,
    load_shadow_model,
    NAME_COLUMN,
    TABLE_KIND_TO_API,
)

logger = logging.getLogger(__name__)


def filter_records_by_visibility(
    records: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Drop records whose source entity the requester can't read.

    The filter is silent: dropped records contribute no count
    and no placeholder. Tombstoned entities (no live row) pass through
    — the decorator step marks them ``entity_deleted: true`` and the
    payload exposes no navigable ``entity_uuid``, so there's nothing
    sensitive left to gate.

    Visibility is resolved SQL-side via each resource's existing access
    filter, which reads the requesting user from Flask-Login internally
    (no explicit user parameter threads through here). If a CLI/Celery
    bypass becomes necessary in the future, add it then with a real call
    site.
    """
    if not records:
        return records

    distinct: set[tuple[str, int]] = {
        (
            TABLE_KIND_TO_API.get(r["entity_kind"], r["entity_kind"]),
            r["entity_id"],
        )
        for r in records
    }
    visible = _resolve_visibility(distinct)
    return [
        r
        for r in records
        if visible.get(
            (
                TABLE_KIND_TO_API.get(r["entity_kind"], r["entity_kind"]),
                r["entity_id"],
            ),
            True,  # tombstone / unknown kind → pass through
        )
    ]


def _resolve_visibility(
    distinct_entities: set[tuple[str, int]],
) -> dict[tuple[str, int], bool]:
    """Return ``{(api_kind, entity_id): can_read}`` for the live row of
    each entity. Missing live rows (tombstoned) map to ``True`` — the
    decorator handles the deleted-state messaging separately.

    Visibility is computed SQL-side via each resource's existing access
    filter (``DashboardAccessFilter`` / ``ChartFilter`` /
    ``DatasourceFilter``). These are the same filters FAB's
    ``ModelRestApi`` applies to ``base_filters`` on list endpoints, so
    the activity-view visibility check matches the rest of the read
    surface byte-for-byte. Two queries per kind (one for live ids, one
    for the access-filtered subset) replace the N-call
    ``security_manager.can_access_<kind>(entity)`` loop that dominated
    latency on dashboard-scope activity responses with many related
    entities (sqlalchemy-review W-NEW-1).
    """
    # pylint: disable=import-outside-toplevel
    from flask_appbuilder.models.sqla.interface import SQLAInterface

    from superset.charts.filters import ChartFilter
    from superset.dashboards.filters import DashboardAccessFilter
    from superset.views.base import DatasourceFilter

    access_filter_classes: dict[str, type] = {
        "Dashboard": DashboardAccessFilter,
        "Slice": ChartFilter,
        "SqlaTable": DatasourceFilter,
    }

    by_kind: dict[str, list[int]] = {}
    for api_kind, entity_id in distinct_entities:
        by_kind.setdefault(api_kind, []).append(entity_id)

    visible: dict[tuple[str, int], bool] = {}
    for api_kind, entity_ids in by_kind.items():
        if api_kind in NAME_COLUMN and api_kind not in access_filter_classes:
            # The kind is in the change-records taxonomy but is missing
            # an access-filter wiring — almost certainly a future-entity
            # addition that updated ``TABLE_KIND_TO_API`` but forgot
            # the visibility dispatch. Fail closed: the activity stream
            # must not silently disclose change records for an entity
            # whose access predicate is unimplemented. Warn so the gap
            # surfaces in CI / staging logs before production.
            logger.warning(
                "activity visibility: no access filter wired for kind %r; "
                "denying %d records",
                api_kind,
                len(entity_ids),
            )
            for entity_id in entity_ids:
                visible[(api_kind, entity_id)] = False
            continue
        if api_kind not in NAME_COLUMN:
            # Kind isn't in the change-records taxonomy at all — not
            # something the activity-view emits today. Pass through so
            # the decorator can mark it as a tombstone if appropriate.
            for entity_id in entity_ids:
                visible[(api_kind, entity_id)] = True
            continue
        model_cls = load_shadow_model(NAME_COLUMN[api_kind][0])
        access_filter = access_filter_classes[api_kind]("id", SQLAInterface(model_cls))

        # Chunk the candidate ids to stay under SQLite's bind-variable floor
        # (a dashboard built from a large chart library can exceed it).
        live_ids: set[int] = set()
        visible_ids: set[int] = set()
        for chunk in chunked_ids(entity_ids):
            # Live ids — what exists at all. Used to decide tombstone vs
            # not-visible: an id missing from this set is tombstoned and
            # passes through (True); an id in this set but absent from the
            # access-filtered set is denied (False).
            live_ids.update(
                row[0]
                for row in db.session.query(model_cls.id)
                .filter(model_cls.id.in_(chunk))
                .all()
            )
            # Apply the SQL-side access filter to a query restricted to the
            # candidate ids. Same predicate FAB uses for list endpoints, so
            # results are consistent with the rest of the read surface.
            visible_ids.update(
                row[0]
                for row in access_filter.apply(
                    db.session.query(model_cls.id).filter(model_cls.id.in_(chunk)),
                    value=None,
                ).all()
            )

        for entity_id in entity_ids:
            if entity_id not in live_ids:
                visible[(api_kind, entity_id)] = True
            else:
                visible[(api_kind, entity_id)] = entity_id in visible_ids
    return visible
