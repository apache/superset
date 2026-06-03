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
"""Decoration: turn raw change-records into the ActivityRecord DTO.

After fetching + filtering, each record needs the synthesized fields
the API contract documents — ``entity_kind`` translated to the user-
facing form, ``entity_uuid``, ``entity_deleted`` /
``entity_deletion_state``, ``source`` (self vs. related),
``summary`` (the AV-012 headline), ``impact`` (chart-count for
dashboard→dataset records), ``version_uuid``, ``changed_by``.

This module collects all those decorations:

* :func:`_decorate_records` — orchestrates the per-page additions in
  one pass: pulls tombstones + uuids + impact counts in batches, then
  walks records adding the synthesized fields and stripping the
  internal-only columns the API contract doesn't expose.
* :func:`_lookup_entity_uuids` — one IN-clause query per kind to
  resolve live ``uuid`` for non-tombstoned entities.
* :func:`_build_summary` — pure projection of (api_kind, record kind,
  entity_name) onto the AV-012 headline string.
* :func:`_changed_by_dict` — projects the user columns onto the
  ``changed_by`` DTO shape.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

import sqlalchemy as sa

from superset.extensions import db
from superset.versioning.activity.impact import (
    _batch_chart_counts,
    _collect_impact_pairs,
    _impact_for_record,
)
from superset.versioning.activity.kinds import (
    _API_KIND_LABEL,
    _load_shadow_model,
    _NAME_COLUMN,
    _TABLE_KIND_TO_API,
    _USER_FACING_KIND,
)
from superset.versioning.activity.queries import _check_entity_tombstones
from superset.versioning.queries import derive_version_uuid

_SUMMARY_VERBS: dict[str, str] = {
    # The kind taxonomy from FR-016 mapped to past-tense verbs for the
    # AV-012 "<entity_label> <verb>: <entity_name>" headline. "field" is
    # the fallback for scalar changes that don't map to a named verb.
    "filter": "filter changed",
    "metric": "metric changed",
    "dimension": "dimension changed",
    "column": "column changed",
    "chart": "chart changed",
    "time_range": "time range changed",
    "color_palette": "palette changed",
    "restore": "restored",
    "field": "updated",
}


def _decorate_records(
    records: list[dict[str, Any]],
    path_kind: str,
    path_id: int,
) -> list[dict[str, Any]]:
    """Add the synthesized ActivityRecord fields to each record:
    ``entity_kind`` (translated to API form), ``entity_uuid``,
    ``entity_deleted``, ``entity_deletion_state``, ``source``,
    ``summary``, ``impact``, ``version_uuid``, ``changed_by``.

    Mutates and returns *records* for chaining. Records are expected to
    already carry ``entity_name`` from :func:`_denormalize_entity_names`.
    """
    if not records:
        return records

    distinct: set[tuple[str, int]] = {
        (
            _TABLE_KIND_TO_API.get(r["entity_kind"], ""),
            r["entity_id"],
        )
        for r in records
        if _TABLE_KIND_TO_API.get(r["entity_kind"])
    }
    tombstones = _check_entity_tombstones(distinct)
    uuids = _lookup_entity_uuids(distinct, tombstones)
    # Pre-compute impact counts for the whole page in one batch query
    # instead of one COUNT per related record (was N+1).
    impact_counts = _batch_chart_counts(
        path_id, _collect_impact_pairs(records, path_kind)
    )

    for record in records:
        api_kind = _TABLE_KIND_TO_API.get(record["entity_kind"], "")
        entity_id = record["entity_id"]
        tombstone = tombstones.get(
            (api_kind, entity_id), {"deleted": True, "deletion_state": None}
        )
        entity_uuid = uuids.get((api_kind, entity_id))
        is_self = api_kind == path_kind and entity_id == path_id

        # Emit the user-facing form ("dashboard"/"chart"/"dataset") on the
        # wire; the internal class-name (api_kind) is kept above for the
        # remaining decoration steps that key off model_cls.__name__.
        record["entity_kind"] = _USER_FACING_KIND.get(api_kind, api_kind)
        record["entity_uuid"] = str(entity_uuid) if entity_uuid else None
        record["entity_deleted"] = tombstone["deleted"]
        record["entity_deletion_state"] = tombstone["deletion_state"]
        record["source"] = "self" if is_self else "related"
        record["version_uuid"] = (
            str(derive_version_uuid(entity_uuid, record["transaction_id"]))
            if entity_uuid
            else None
        )
        record["changed_by"] = _changed_by_dict(record)

        if is_self:
            record["summary"] = ""
            record["impact"] = None
        else:
            record["summary"] = _build_summary(api_kind, record)
            record["impact"] = _impact_for_record(record, path_kind, impact_counts)

        # Strip the internal-only columns the API contract doesn't expose.
        for key in (
            "entity_id",
            "sequence",
            "user_id",
            "changed_by_id",
            "first_name",
            "last_name",
        ):
            record.pop(key, None)
    return records


def _lookup_entity_uuids(
    distinct: set[tuple[str, int]],
    tombstones: dict[tuple[str, int], dict[str, Any]],
) -> dict[tuple[str, int], UUID | None]:
    """Batch-fetch live ``uuid`` per ``(api_kind, entity_id)``. Tombstoned
    entities are skipped (their ``entity_uuid`` is null per data-model.md).
    """
    result: dict[tuple[str, int], UUID | None] = {}
    by_kind: dict[str, list[int]] = {}
    for api_kind, entity_id in distinct:
        if tombstones.get((api_kind, entity_id), {}).get("deleted"):
            continue
        by_kind.setdefault(api_kind, []).append(entity_id)

    for api_kind, entity_ids in by_kind.items():
        if api_kind not in _NAME_COLUMN:
            continue
        model_cls = _load_shadow_model(_NAME_COLUMN[api_kind][0])
        live_tbl = model_cls.__table__  # type: ignore[attr-defined]
        rows = (
            db.session.connection()
            .execute(
                sa.select(live_tbl.c.id, live_tbl.c.uuid).where(
                    live_tbl.c.id.in_(entity_ids)
                )
            )
            .all()
        )
        for row in rows:
            result[(api_kind, row[0])] = row[1]
    return result


def _build_summary(api_kind: str, record: dict[str, Any]) -> str:
    """Build the AV-012 headline for a related record:
    ``"<Kind label> <verb>: <entity_name>"``."""
    label = _API_KIND_LABEL.get(api_kind, api_kind)
    verb = _SUMMARY_VERBS.get(record.get("kind", ""), "updated")
    name = record.get("entity_name") or ""
    return f"{label} {verb}: {name}" if name else f"{label} {verb}"


def _changed_by_dict(record: dict[str, Any]) -> dict[str, Any] | None:
    """Project the user columns onto the ``changed_by`` shape, or
    ``None`` when no Flask user was attached to the save (CLI / Celery)
    or when the user has since been deleted from ``ab_user``.
    """
    if record.get("changed_by_id") is None:
        return None
    return {
        "id": record["changed_by_id"],
        "first_name": record.get("first_name"),
        "last_name": record.get("last_name"),
    }
