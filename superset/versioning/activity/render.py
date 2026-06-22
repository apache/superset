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
``summary`` (the headline), ``impact`` (chart-count for
dashboard→dataset records), ``version_uuid``, ``changed_by``.

This module collects all those decorations:

* :func:`apply_record_decoration` — orchestrates the per-page additions in
  one pass: pulls tombstones + uuids + impact counts in batches, then
  walks records adding the synthesized fields and stripping the
  internal-only columns the API contract doesn't expose.
* :func:`_lookup_entity_uuids` — one IN-clause query per kind to
  resolve live ``uuid`` for non-tombstoned entities.
* :func:`_build_summary` — pure projection of (api_kind, record kind,
  entity_name) onto the headline string.
* :func:`_changed_by_dict` — projects the user columns onto the
  ``changed_by`` DTO shape.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

import sqlalchemy as sa

from superset.extensions import db
from superset.versioning.activity.impact import (
    batch_chart_counts,
    collect_impact_pairs,
    impact_for_record,
)
from superset.versioning.activity.kinds import (
    API_KIND_LABEL,
    load_shadow_model,
    NAME_COLUMN,
    TABLE_KIND_TO_API,
    USER_FACING_KIND,
)
from superset.versioning.activity.queries import check_entity_tombstones
from superset.versioning.queries import derive_version_uuid

_SUMMARY_VERBS: dict[str, str] = {
    # The kind taxonomy mapped to past-tense verbs for the
    # "<entity_label> <verb>: <entity_name>" headline. "field" is
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


def apply_record_decoration(
    records: list[dict[str, Any]],
    path_kind: str,
    path_id: int,
) -> None:
    """Add the synthesized ActivityRecord fields to each record in place:
    ``entity_kind`` (translated to API form), ``entity_uuid``,
    ``entity_deleted``, ``entity_deletion_state``, ``source``,
    ``summary``, ``impact``, ``version_uuid``, ``changed_by``.

    Mutates *records* in place; returns ``None``. Records are expected
    to already carry ``entity_name`` from
    :func:`apply_entity_name_denormalization`. The in-place mutation
    avoids re-allocating thousands of dicts on hot dashboards; the
    name + return signature make the side effect explicit instead of
    pretending to be a pure projection.
    """
    if not records:
        return

    distinct: set[tuple[str, int]] = {
        (
            TABLE_KIND_TO_API.get(r["entity_kind"], ""),
            r["entity_id"],
        )
        for r in records
        if TABLE_KIND_TO_API.get(r["entity_kind"])
    }
    tombstones = check_entity_tombstones(distinct)
    uuids = _lookup_entity_uuids(distinct, tombstones)
    # Pre-compute impact counts for the whole page in one batch query
    # instead of one COUNT per related record (was N+1).
    impact_counts = batch_chart_counts(
        path_id, collect_impact_pairs(records, path_kind)
    )

    for record in records:
        api_kind = TABLE_KIND_TO_API.get(record["entity_kind"], "")
        entity_id = record["entity_id"]
        tombstone = tombstones.get(
            (api_kind, entity_id), {"deleted": True, "deletion_state": None}
        )
        entity_uuid = uuids.get((api_kind, entity_id))
        is_self = api_kind == path_kind and entity_id == path_id

        # Emit the user-facing form ("dashboard"/"chart"/"dataset") on the
        # wire; the internal class-name (api_kind) is kept above for the
        # remaining decoration steps that key off model_cls.__name__.
        record["entity_kind"] = USER_FACING_KIND.get(api_kind, api_kind)
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
            # Self records are left summary-less (the panel renders
            # them from kind/path/values) — EXCEPT synthetic ``__meta__``
            # headlines, whose entire payload IS the summary and whose
            # primary surface is the entity's own stream ("restored to
            # version N" must render on include=self).
            record["summary"] = (
                _build_summary(api_kind, record)
                if record.get("kind") == "__meta__"
                else ""
            )
            record["impact"] = None
        else:
            record["summary"] = _build_summary(api_kind, record)
            record["impact"] = impact_for_record(record, path_kind, impact_counts)
            if record["entity_deleted"]:
                # Security: a tombstoned related entity has no live row, so
                # the visibility filter cannot access-gate it (there is
                # nothing to apply the FAB access filter to). Redact the raw
                # diff CONTENT — filter values, column names, SQL/adhoc
                # expressions — so a requester entitled only to the path
                # entity can't read the internal change values of a deleted
                # related entity. The entity_name and the headline
                # are kept deliberately (the panel shows "(deleted)
                # <name>"); only the value payload is stripped. Self-path
                # tombstones are untouched — the endpoint already gated them
                # via ``raise_for_access`` on the path entity.
                record["from_value"] = None
                record["to_value"] = None
                record["path"] = None

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


def _lookup_entity_uuids(
    distinct: set[tuple[str, int]],
    tombstones: dict[tuple[str, int], dict[str, Any]],
) -> dict[tuple[str, int], UUID | None]:
    """Batch-fetch live ``uuid`` per ``(api_kind, entity_id)``. Tombstoned
    entities are skipped (their ``entity_uuid`` is null).
    """
    result: dict[tuple[str, int], UUID | None] = {}
    by_kind: dict[str, list[int]] = {}
    for api_kind, entity_id in distinct:
        if tombstones.get((api_kind, entity_id), {}).get("deleted"):
            continue
        by_kind.setdefault(api_kind, []).append(entity_id)

    # ``no_autoflush`` mirrors the defensive posture of the baseline +
    # change-record listeners: this helper reads from live tables to
    # resolve uuids, and a future caller that resolves an entity before
    # the parent flush would otherwise trigger autoflush mid-read.
    # Today's call sites run from request-path code with no pending
    # session state, so the cost of the guard is zero.
    with db.session.no_autoflush:
        for api_kind, entity_ids in by_kind.items():
            if api_kind not in NAME_COLUMN:
                continue
            model_cls = load_shadow_model(NAME_COLUMN[api_kind][0])
            live_tbl = model_cls.__table__
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
    """Build the headline for a related record:
    ``"<Kind label> <verb>: <entity_name>"``."""
    label = API_KIND_LABEL.get(api_kind, api_kind)
    # Synthetic ``__meta__`` headlines carry their payload in to_value
    # and their verb on the transaction's ``action_kind`` (path stays
    # pure navigation). The restore variant names the version it
    # restored to ("Restored to X from [date]" is not
    # renderable from field diffs).
    if record.get("kind") == "__meta__":
        name = record.get("entity_name") or ""
        if record.get("action_kind") == "restore":
            to_value = record.get("to_value") or {}
            version_number = to_value.get("version_number")
            if version_number is not None:
                headline = f"{label} restored to version {version_number}"
                return f"{headline}: {name}" if name else headline
        return f"{label} updated: {name}" if name else f"{label} updated"
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
