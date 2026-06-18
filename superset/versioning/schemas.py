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
"""Shared Marshmallow schemas for entity version history endpoints.

Consumed by ChartRestApi, DashboardRestApi, and DatasetRestApi — the response
shape is identical across all three resources, so the schemas live here to
avoid triplicated definitions.
"""

from __future__ import annotations

from marshmallow import fields, Schema, validate

from superset.versioning.changes import ACTION_KINDS


class VersionChangedBySchema(Schema):
    """Subset of the User model included in each version history entry."""

    id = fields.Integer()
    username = fields.String()
    first_name = fields.String()
    last_name = fields.String()


class VersionChangeRecordSchema(Schema):
    """One field-level diff hunk from ``version_changes``.

    The frontend renders human-readable prose from (``kind``,
    ``from_value``, ``to_value``) via Flask-Babel. Server-side the
    shape is deliberately machine-readable only.
    """

    kind = fields.String(
        metadata={
            "description": (
                "Semantic category of the change. First-class values in V1: "
                "'filter', 'metric', 'dimension', 'column', 'chart', "
                "'time_range', 'color_palette'. Falls back to 'field' for "
                "generic scalar changes that don't map to a named kind."
            )
        },
    )
    path = fields.Raw(
        metadata={
            "description": (
                "Array of segments locating the change in the entity's state. "
                "Example: ['params', 'adhoc_filters', 'country']."
            )
        },
    )
    from_value = fields.Raw(
        allow_none=True,
        metadata={
            "description": (
                "Value at path before the save; null when the field did not exist."
            ),
        },
    )
    to_value = fields.Raw(
        allow_none=True,
        metadata={
            "description": (
                "Value at path after the save; null when the field was removed."
            ),
        },
    )


class VersionListItemSchema(Schema):
    """A single version row in the version history response."""

    version_uuid = fields.UUID(
        metadata={
            "description": (
                "Deterministic UUIDv5 derived from the entity UUID and the "
                "Continuum transaction id — stable across replicas and "
                "retention pruning. The handle accepted by the get/restore "
                "version endpoints."
            )
        },
    )
    version_number = fields.Integer(
        metadata={"description": "0-based position in the history, oldest first"},
    )
    transaction_id = fields.Integer(
        metadata={"description": "Underlying Continuum transaction id"},
    )
    operation_type = fields.String(
        metadata={
            "description": (
                "One of 'baseline', 'update', or 'delete', derived from the "
                "Continuum integer constant. Restore is not a distinct "
                "operation_type: a restore surfaces as 'update' carrying "
                "``action_kind='restore'`` (see ACTIVITY_ACTION_KINDS)."
            )
        },
    )
    issued_at = fields.DateTime(
        metadata={"description": "UTC timestamp of the commit that produced the row"},
    )
    changed_by = fields.Nested(
        VersionChangedBySchema,
        allow_none=True,
        metadata={
            "description": (
                "User who produced the version, or null when the commit had no "
                "authenticated Flask user (CLI, Celery, import)."
            )
        },
    )
    changes = fields.List(
        fields.Nested(VersionChangeRecordSchema),
        metadata={
            "description": (
                "Structured diff records describing the atomic field-level "
                "changes at this version, ordered by emission sequence. "
                "Empty for baseline (op=0) transactions per spec M4."
            )
        },
    )


class VersionListResponseSchema(Schema):
    """Envelope for version list responses."""

    result = fields.List(fields.Nested(VersionListItemSchema))
    count = fields.Integer()


# ---- Cross-entity activity view (sc-107283) -------------------------------

#: Allowed values for ``ActivityRecordSchema.entity_kind``. User-facing
#: lowercase strings; the activity layer's internal kind dispatch keys off
#: ``model_cls.__name__`` (``Dashboard`` / ``Slice`` / ``SqlaTable``) and
#: translates to these labels at the JSON boundary in
#: :func:`superset.versioning.activity.apply_record_decoration`.
ACTIVITY_ENTITY_KINDS: tuple[str, ...] = ("dashboard", "chart", "dataset")

#: Allowed values for ``ActivityRecordSchema.source`` (spec AV-013).
ACTIVITY_SOURCES: tuple[str, ...] = ("self", "related")

#: Allowed values for ``ActivityRecordSchema.entity_deletion_state``.
#: Hard-delete is communicated separately via ``entity_deleted=true``;
#: the remaining state is the soft-delete sentinel (sc-103157).
ACTIVITY_DELETION_STATES: tuple[str, ...] = ("soft_deleted",)

#: Allowed values for ``ActivityRecordSchema.kind`` — mirrors the
#: change-record taxonomy from sc-103156 FR-016. ``"field"`` is the
#: fallback for scalar changes without a more specific category.
#:
#: ``"restore"`` (previously the synthetic kind for restore events) is
#: removed: restores now produce regular field-level records plus
#: ``version_transaction.action_kind="restore"`` (see ACTIVITY_ACTION_KINDS).
ACTIVITY_CHANGE_KINDS: tuple[str, ...] = (
    "filter",
    "metric",
    "dimension",
    "column",
    "chart",
    "row",
    "tab",
    "tabs",
    "header",
    "markdown",
    "divider",
    "time_range",
    "color_palette",
    "field",
    # Synthetic headline records emitted by commands via the listener's
    # ACTION_META_KEY (the ``__meta__`` path convention): machine
    # namespace, clearly non-content. The canonical case is restore,
    # whose record's ``to_value`` carries the restored-to
    # ``version_uuid`` / ``version_number`` (PR #40988 feedback).
    "__meta__",
)

#: Allowed values for ``ActivityRecordSchema.operation`` — the per-record
#: verb. ``move`` only fires for layout records; ``add`` / ``remove`` /
#: ``edit`` apply across every emit site.
ACTIVITY_CHANGE_OPERATIONS: tuple[str, ...] = (
    "add",
    "remove",
    "move",
    "edit",
    # Synthetic ``__meta__`` headline records announce an action (e.g. a
    # restore) rather than mutating a field — the field-verb vocabulary
    # would be dishonest for them. Source of the value:
    # superset.versioning.changes.OPERATION_ANNOUNCE.
    "announce",
)

#: Allowed values for ``ActivityRecordSchema.action_kind`` — the
#: transaction-level avenue. ``null`` (omitted from the enum, signalled
#: by ``allow_none``) means "ordinary save". Sourced from
#: :data:`superset.versioning.changes.ACTION_KINDS` so a future
#: addition (e.g. ``"thumbnail_warm"``) only has to update that
#: constant; the schema picks it up automatically.
ACTIVITY_ACTION_KINDS: tuple[str, ...] = tuple(sorted(ACTION_KINDS))


class ActivityChangedBySchema(Schema):
    """User attribution for an activity record.

    The activity-view payload exposes only the display fields
    (``id`` + given/family name); ``username`` is omitted by design (see
    data-model.md §"ActivityRecord DTO"). ``null`` when the saving user
    has been deleted from ``ab_user`` (sc-103156 §Session 2026-05-18
    clarification).
    """

    id = fields.Integer()
    first_name = fields.String()
    last_name = fields.String()


class ActivityImpactSchema(Schema):
    """Dependent-count summary attached to ``source='related'`` records.

    Synthesized server-side at the time of the activity query — it counts
    siblings affected by the same upstream change at the same transaction
    (e.g., how many charts on the requested dashboard pointed at the
    dataset whose edit this record represents).
    """

    charts = fields.Integer(
        metadata={
            "description": (
                "Number of sibling charts on the path entity affected by "
                "the same related-record change at this transaction."
            )
        },
    )


class ActivityRecordSchema(Schema):
    """One change record in the activity stream.

    One record per atomic field-level change. Fields mirror
    data-model.md §"``ActivityRecord`` DTO" — see that doc for source
    and required/optional details.
    """

    version_uuid = fields.String(
        metadata={
            "description": (
                "Stable UUIDv5 identifier for the source version "
                "(``derive_version_uuid(entity_uuid, transaction_id)``). "
                "Identical to what ``/versions/<version_uuid>/`` would "
                "return for the same change."
            )
        },
    )
    entity_kind = fields.String(
        validate=validate.OneOf(ACTIVITY_ENTITY_KINDS),
        metadata={
            "description": (
                "User-facing kind of the source entity: one of "
                '``"dashboard"`` / ``"chart"`` / ``"dataset"``.'
            )
        },
    )
    entity_uuid = fields.String(
        allow_none=True,
        metadata={
            "description": (
                "UUID of the source entity; ``null`` only when "
                "``entity_deleted: true`` (the entity has been hard-deleted "
                "since the change was recorded)."
            )
        },
    )
    entity_name = fields.String(
        metadata={
            "description": (
                "Name of the source entity *at the time of the change* — "
                "denormalized from the validity-strategy shadow row. "
                "Survives entity rename / delete."
            )
        },
    )
    entity_deleted = fields.Boolean(
        metadata={
            "description": (
                "True iff the source entity is hard-deleted "
                "(no live row by ``entity_id``). False for live and "
                "soft-deleted entities."
            )
        },
    )
    entity_deletion_state = fields.String(
        allow_none=True,
        validate=validate.OneOf(ACTIVITY_DELETION_STATES),
        metadata={
            "description": (
                "Present when the source entity has non-null ``deleted_at`` "
                "(sc-103157). Absent or ``null`` otherwise."
            )
        },
    )
    source = fields.String(
        validate=validate.OneOf(ACTIVITY_SOURCES),
        metadata={
            "description": (
                '``"self"`` if ``(entity_kind, entity_id)`` matches the '
                'path entity; else ``"related"``. Drives the frontend\'s '
                "no-group-under-save rendering rule (AV-013)."
            )
        },
    )
    transaction_id = fields.Integer(
        metadata={"description": "Stable secondary ordering key; never reused."},
    )
    issued_at = fields.DateTime(
        metadata={"description": "UTC timestamp; primary ordering key (DESC)."},
    )
    changed_by = fields.Nested(
        ActivityChangedBySchema,
        allow_none=True,
        metadata={
            "description": (
                "User who produced the change, or ``null`` when the saving "
                "user no longer exists in ``ab_user``."
            )
        },
    )
    kind = fields.String(
        validate=validate.OneOf(ACTIVITY_CHANGE_KINDS),
        metadata={
            "description": (
                "Content category — what kind of thing changed. "
                "``field`` is the fallback for scalar changes without a "
                "more specific category. Per-record."
            )
        },
    )
    operation = fields.String(
        validate=validate.OneOf(ACTIVITY_CHANGE_OPERATIONS),
        metadata={
            "description": (
                "Per-record verb: ``add`` / ``remove`` / ``move`` / "
                "``edit``. Explicit instead of inferred from "
                "``from_value`` / ``to_value`` null-tests. ``move`` only "
                "fires for layout records."
            )
        },
    )
    action_kind = fields.String(
        validate=validate.OneOf(ACTIVITY_ACTION_KINDS),
        allow_none=True,
        metadata={
            "description": (
                "Transaction-level avenue that produced this record's "
                "batch: ``restore`` / ``import`` / ``clone``. ``null`` "
                "for ordinary saves. All records sharing a "
                "``transaction_id`` share the same action_kind. The "
                "schema's third ``*_kind`` column (entity_kind / kind / "
                "action_kind), at transaction scope."
            )
        },
    )
    path = fields.List(
        fields.String(),
        metadata={
            "description": (
                "Pure navigation address — no verb or kind embedded. "
                "Examples: ``['slice_name']``, ``['params', "
                "'adhoc_filters', 'country']``, ``['CHART-x']`` for a "
                "layout add/remove/move, ``['HEADER-y', 'text']`` for a "
                "layout edit leaf. The verb lives in ``operation``, the "
                "element type in ``kind``."
            )
        },
    )
    from_value = fields.Raw(
        allow_none=True,
        metadata={"description": "Prior value; ``null`` = didn't exist."},
    )
    to_value = fields.Raw(
        allow_none=True,
        metadata={"description": "New value; ``null`` = removed."},
    )
    summary = fields.String(
        metadata={
            "description": (
                'Synthesized headline for ``source: "related"`` records — '
                'e.g., ``"Dataset updated: Sales Transactions"`` '
                '(AV-012). Absent for ``source: "self"`` records.'
            )
        },
    )
    impact = fields.Nested(
        ActivityImpactSchema,
        allow_none=True,
        metadata={
            "description": (
                'Optional dependent-count for ``source: "related"`` '
                'records — e.g., ``{"charts": 4}`` for a dataset edit '
                "that affected 4 charts on the path dashboard at the "
                'change\'s transaction. Absent for ``source: "self"`` '
                "records and for related records without dependents."
            )
        },
    )
    first_tracked_save = fields.Boolean(
        metadata={
            "description": (
                "True when this record's transaction is the entity's "
                "FIRST tracked save (first UPDATE after the retroactive "
                "baseline). Such transactions can carry dozens of "
                "params-normalization records for entities that predate "
                "versioning; clients use the marker to collapse them "
                "rather than render each delta as a user edit. Matched "
                "against the LIVE row's (id, uuid), so it is always "
                "false for hard-deleted entities (no live row) and for "
                "shadow rows predating the entity's current uuid."
            )
        },
    )


class ActivityResponseSchema(Schema):
    """Envelope for activity-view responses."""

    result = fields.List(fields.Nested(ActivityRecordSchema))
    count = fields.Integer(
        metadata={
            "description": (
                "Total record count across all pages (the filtered + "
                "denormalized stream), not just the current page. When "
                "``truncated`` is true this is a floor (the count within "
                "the fetched window), not the absolute total."
            )
        },
    )
    truncated = fields.Boolean(
        metadata={
            "description": (
                "True when the request hit the per-request fetch ceiling "
                "and older records exist beyond the returned window. "
                "Narrow the time range (``since``/``until``) to see them."
            )
        },
    )
