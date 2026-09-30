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
"""
Where a dataset's partition filter mapping is persisted.

A mapping is four values -- see `superset.connectors.sqla.partition_mapping` for
what they mean. This module owns the question of where those four values live,
and nothing else. Every read goes through `PartitionMappingStore.load` and every
write through `set_partition_mapping`, so the answer can change without touching
the model, the API, validation or the query rewriter.

Two backings
------------
The feature ships stored as one key in ``tables.extra``
(`ExtraJsonPartitionMappingStore`) and will move to four real columns
(`ColumnPartitionMappingStore`) in the migration that adds them. Selected by
``PARTITION_MAPPING_STORE``.

``tables.extra`` is not merely the option that avoids a migration; it is a
reasonable home. It is already in `SqlaTable.export_fields` and already listed in
`ExportDatasetsCommand`'s ``JSON_KEYS``, so a mapping travels through
export/import with no bundle-format change. SQLAlchemy-Continuum already
versions the column, so dataset version history and restore work untouched. And
there is precedent for reading typed settings back out of it:
``certification``, ``warning_markdown`` and ``timezone`` all live there, the
first two surfaced through model properties exactly as the mapping now is.

It has to be the *dataset*-level blob, though, never ``table_columns.extra``,
even for the two values that are per-column after the migration. The dataset
editor's ``buildExtraJsonObject`` rebuilds every column's and metric's ``extra``
from ``certification`` and ``warning_markdown`` alone on each save, so anything
else parked there is destroyed the first time an owner opens the editor.
Dataset-level ``extra`` is round-tripped verbatim, and its one mutating path
(``setDatasetCertification``) parses and *merges*, so an unknown key survives.

Reads are cheap; writes are funnelled
-------------------------------------
`load` is on the hot path -- `get_extra_cache_keys`, every `get_sqla_query`, and
once per column in `TableColumn.data` -- so it memoizes on the instance, keyed on
the raw ``extra`` string, the same self-invalidating trick
`CertificationMixin.get_extra_dict` uses. (`SqlaTable.extra_dict` is an uncached
``json.loads``; don't route through it.)

Writes cannot be attribute assignment. Under the extra-JSON store the mapping
and ``extra`` are the same bytes, so ``table.partition_column = x`` followed by
``table.extra = <payload>`` loses the first write with no exception and no log --
and which of the two runs last is a property of marshmallow's field ordering.
The model's properties are therefore read-only and `set_partition_mapping` is the
only supported write.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field, replace
from typing import Any, Mapping, Protocol, TYPE_CHECKING

from flask import current_app as app

from superset.utils import json

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable

logger = logging.getLogger(__name__)

#: Top-level key in ``tables.extra``. Joins ``certification``,
#: ``warning_markdown``, ``timezone`` and ``disallow_adhoc_metrics``.
EXTRA_KEY = "partition_filter_mapping"

#: Bounds enforced on read as well as on write. ``DatasetPutSchema`` validates
#: the typed fields, but the free-text Extra box reaches the same storage without
#: passing through it, so the store re-checks rather than trusting its contents.
#: The two lengths are the widths the columns get after the migration.
MAX_COLUMN_NAME_LENGTH = 250
MAX_TRANSFORM_LENGTH = 4096

#: Sentinel for "this keyword was not passed", distinct from ``None``, which
#: means "clear this field".
UNSET: Any = object()

_MEMO_UNSET: Any = object()
_MEMO_VALUE_ATTR = "_partition_mapping_memo"
_MEMO_RAW_ATTR = "_partition_mapping_memo_raw"


@dataclass(frozen=True)
class ColumnTransform:
    """
    The two per-column halves of a mapping: the ``:value`` expression and
    whether it preserves ordering.
    """

    value_transform: str | None = None
    is_monotonic: bool = False

    @property
    def is_empty(self) -> bool:
        return self == ColumnTransform()


@dataclass(frozen=True)
class StoredPartitionMapping:
    """
    A dataset's mapping exactly as persisted -- unresolved and unvalidated.

    ``mapped_column is None`` means "follow ``main_dttm_col``", so re-pointing
    the dataset's default datetime column moves the mapping with it unless the
    owner overrides it. Deliberately not resolved at save time: that behaviour
    then falls out of the model rather than needing code on every write path.

    Transforms are keyed by column name rather than flattened onto the single
    effective mapped column, because flattening is unsound. An owner who sets a
    transform on ``A`` (then ``main_dttm_col``) and later re-points
    ``main_dttm_col`` to ``B`` would, flattened, have ``B``'s values silently
    mirrored through ``A``'s expression. Keyed, ``B`` has no transform, the
    mapping goes inactive, and the behaviour matches what four real columns
    would do -- which is the property that makes the two stores swappable.
    """

    partition_column: str | None = None
    mapped_column: str | None = None
    column_transforms: Mapping[str, ColumnTransform] = field(default_factory=dict)

    @property
    def is_empty(self) -> bool:
        return (
            not self.partition_column
            and not self.mapped_column
            and not self.column_transforms
        )

    def transform_for(self, column_name: str | None) -> ColumnTransform:
        """
        The transform declared on one column, or an empty one.

        Empty rather than ``None`` so callers read ``.value_transform`` /
        ``.is_monotonic`` unconditionally and get the same "not declared"
        answer a NULL column would give them.
        """
        if not column_name:
            return ColumnTransform()
        return self.column_transforms.get(column_name, ColumnTransform())

    def effective_mapped_column(self, main_dttm_col: str | None) -> str | None:
        """The column whose filters are mirrored, override or default."""
        return self.mapped_column or main_dttm_col

    def with_transform(
        self, column_name: str, transform: ColumnTransform
    ) -> StoredPartitionMapping:
        transforms = dict(self.column_transforms)
        if transform.is_empty:
            transforms.pop(column_name, None)
        else:
            transforms[column_name] = transform
        return replace(self, column_transforms=transforms)


@dataclass(frozen=True)
class PartitionMappingPatch:
    """
    Only the fields a request actually mentioned.

    Present keys rather than four ``X | None`` attributes, because ``None`` is a
    meaningful value here: ``{"partition_column": None}`` clears the mapping
    while an absent key leaves it alone. Collapsing the two is how a partial
    column payload silently clears a monotonic flag nobody touched -- the exact
    failure ``DatasetColumnsPutSchema`` avoids by refusing a ``load_default``.
    """

    fields: Mapping[str, Any] = field(default_factory=dict)
    column_fields: Mapping[str, Mapping[str, Any]] = field(default_factory=dict)

    @property
    def is_empty(self) -> bool:
        return not self.fields and not self.column_fields

    def apply_to(self, mapping: StoredPartitionMapping) -> StoredPartitionMapping:
        if self.fields:
            mapping = replace(mapping, **dict(self.fields))
        for column_name, values in self.column_fields.items():
            current = mapping.transform_for(column_name)
            mapping = mapping.with_transform(
                column_name, replace(current, **dict(values))
            )
        return mapping


class PartitionMappingStore(Protocol):
    """
    Where a dataset's partition mapping lives.

    Exists because the mapping ships before its migration: today it is one key
    in ``tables.extra``, and a follow-up moves it to four real columns. Both
    shapes answer the same two questions, so the model facade, the write funnel,
    validation and the query rewriter are written once against this and never
    learn which store answered.
    """

    def load(self, table: SqlaTable) -> StoredPartitionMapping: ...

    def save(self, table: SqlaTable, mapping: StoredPartitionMapping) -> None: ...


class ExtraJsonPartitionMappingStore:
    """One nested object under ``partition_filter_mapping`` in ``tables.extra``."""

    def load(self, table: SqlaTable) -> StoredPartitionMapping:
        raw = getattr(table, "extra", None)
        memo_raw = getattr(table, _MEMO_RAW_ATTR, _MEMO_UNSET)
        if memo_raw is _MEMO_UNSET or memo_raw != raw:
            # Transient instance attributes, not mapped columns, so they never
            # reach the database and never confuse Continuum. Safe to hand the
            # memoized object straight out: it is frozen.
            object.__setattr__(table, _MEMO_VALUE_ATTR, parse_mapping(raw))
            object.__setattr__(table, _MEMO_RAW_ATTR, raw)
        return getattr(table, _MEMO_VALUE_ATTR)

    def save(self, table: SqlaTable, mapping: StoredPartitionMapping) -> None:
        raw = getattr(table, "extra", None)
        updated = extra_with_partition_mapping(raw, mapping)
        if updated is raw:
            # `extra_with_partition_mapping` hands back the identical object when
            # the blob already says this. Writing anyway would dirty the column
            # and mint a Continuum version row for an edit that changed nothing.
            return
        # A *new string*, never a mutation of the parsed dict. `decode_extra`
        # parses fresh and throws its dict away, so mutating one would change
        # nothing on the model and SQLAlchemy would never see the attribute as
        # dirty. Assignment is also what invalidates `load`'s memo.
        table.extra = updated


class ColumnPartitionMappingStore:
    """
    Reads and writes four real columns. Not yet live.

    Deliberately unimplemented rather than written against attributes that do
    not exist. It would have to read ``table.partition_column``, which today is
    the facade property, which calls this store -- unbounded recursion. A
    property and a ``Column`` of the same name cannot coexist on a model, so
    this adapter is only coherent once the migration has replaced the
    properties, and until then it could only be exercised against a hand-built
    stand-in, which proves nothing about the parts that are actually hard: real
    columns, Continuum shadow rows, and the FAB metadata
    (``order_columns``/``search_columns``) that changes meaning the moment these
    stop being properties.

    The migration that activates it must, in one revision:

    1. add ``tables.partition_column`` / ``partition_mapped_column`` and
       ``table_columns.partition_value_transform`` /
       ``partition_transform_is_monotonic``, plus the four matching columns on
       the ``*_version`` shadow tables;
    2. backfill from ``tables.extra`` and strip the key, leaving a blob it could
       not parse in place rather than dropping an owner's configuration;
    3. delete the facade properties on `SqlaTable` and `TableColumn`, declare
       the real columns, and add the four names to ``export_fields``;
    4. implement this class and flip ``PARTITION_MAPPING_STORE`` to ``columns``.

    The port, the value object and every call site are already right, which is
    what this indirection buys: the migration is additive, not a rewrite.
    """

    _MESSAGE = (
        "PARTITION_MAPPING_STORE='columns' requires the migration that adds the "
        "partition mapping columns; use 'extra' until it has been applied."
    )

    def load(self, table: SqlaTable) -> StoredPartitionMapping:
        raise NotImplementedError(self._MESSAGE)

    def save(self, table: SqlaTable, mapping: StoredPartitionMapping) -> None:
        raise NotImplementedError(self._MESSAGE)


#: A literal table rather than a config-resolved import path: this is a
#: two-value migration switch with a known end state, not a plugin point.
STORES: dict[str, type[PartitionMappingStore]] = {
    "extra": ExtraJsonPartitionMappingStore,
    "columns": ColumnPartitionMappingStore,
}


def partition_mapping_store() -> PartitionMappingStore:
    """
    The configured store.

    Resolved per call, not memoized. ``app.config`` is per-app and tests flip
    this between cases; construction is a bare ``__init__`` over no state, so a
    cache would buy nothing and could outlive an app teardown.
    """
    name = app.config["PARTITION_MAPPING_STORE"]
    if name not in STORES:
        raise ValueError(
            f"Unknown PARTITION_MAPPING_STORE {name!r}; "
            f"expected one of {sorted(STORES)}"
        )
    return STORES[name]()


def load_partition_mapping(table: SqlaTable) -> StoredPartitionMapping:
    """The dataset's stored mapping. The one read entry point."""
    return partition_mapping_store().load(table)


def set_partition_mapping(  # pylint: disable=too-many-arguments
    table: SqlaTable,
    *,
    partition_column: Any = UNSET,
    mapped_column: Any = UNSET,
    value_transform: Any = UNSET,
    is_monotonic: Any = UNSET,
    column: str | None = None,
) -> StoredPartitionMapping:
    """
    Patch a dataset's mapping. An omitted keyword means "unchanged".

    The one supported write, for the DAO funnel, `update_from_object` and tests.
    ``value_transform`` and ``is_monotonic`` apply to ``column``, defaulting to
    the effective mapped column *after* this call's ``mapped_column`` is taken
    into account -- so setting a mapped column and its transform together does
    what it reads like.
    """
    store = partition_mapping_store()
    mapping = store.load(table)

    fields: dict[str, Any] = {}
    if partition_column is not UNSET:
        fields["partition_column"] = partition_column
    if mapped_column is not UNSET:
        fields["mapped_column"] = mapped_column

    column_fields: dict[str, dict[str, Any]] = {}
    if value_transform is not UNSET or is_monotonic is not UNSET:
        target = column or StoredPartitionMapping(
            mapped_column=fields.get("mapped_column", mapping.mapped_column)
        ).effective_mapped_column(table.main_dttm_col)
        if not target:
            raise ValueError(
                "Cannot set a partition value transform without a column: the "
                "dataset has no mapped column and no main_dttm_col."
            )
        values: dict[str, Any] = {}
        if value_transform is not UNSET:
            values["value_transform"] = value_transform
        if is_monotonic is not UNSET:
            values["is_monotonic"] = bool(is_monotonic)
        column_fields[target] = values

    patch = PartitionMappingPatch(fields=fields, column_fields=column_fields)
    mapping = patch.apply_to(mapping)
    store.save(table, mapping)
    return mapping


def clear_dangling(
    mapping: StoredPartitionMapping, surviving_column_names: set[str]
) -> StoredPartitionMapping:
    """
    Drop the parts of a mapping whose columns no longer exist.

    A metadata sync can remove the partition column at the source, which would
    otherwise leave the dataset pointing at a column that isn't there. The query
    layer bails out defensively on a dangling mapping, so this is about the
    dataset's stored state being honest rather than about correctness of the SQL.

    Needed on both write paths: the editor clears the mapping client-side too,
    but ``override_columns=true`` (an API-driven metadata sync, and SQL Lab's
    "Save dataset") bypasses the editor entirely, and the upsert path drops every
    column the payload omits -- so either can take a mapped column out from under
    the mapping.

    Runs from the DAO's write funnel rather than from ``update_columns``, where
    a clear would be overwritten moments later by the payload's own ``extra``.
    """
    if (
        mapping.partition_column
        and mapping.partition_column not in surviving_column_names
    ):
        mapping = replace(mapping, partition_column=None, mapped_column=None)
    elif mapping.mapped_column and mapping.mapped_column not in surviving_column_names:
        mapping = replace(mapping, mapped_column=None)

    stale = set(mapping.column_transforms) - surviving_column_names
    for column_name in stale:
        mapping = mapping.with_transform(column_name, ColumnTransform())
    return mapping


def parse_mapping(raw: Any) -> StoredPartitionMapping:
    """
    Read a mapping out of a raw ``extra`` string, tolerating anything.

    ``extra`` is a free-text box in the dataset editor, so every value here is
    typo- or attacker-supplied. Modelled on `get_dataset_timezone`: a value of
    the wrong type is "not configured", never propagated.

    ``is_monotonic`` insists on a literal ``True`` rather than coercing with
    ``bool()``. A truthy ``"no"`` would enable range mirroring, and this is the
    one field where being wrong drops real rows rather than merely failing to
    prune.
    """
    blob = decode_extra(raw).get(EXTRA_KEY)
    if not isinstance(blob, dict):
        return StoredPartitionMapping()

    transforms: dict[str, ColumnTransform] = {}
    raw_transforms = blob.get("column_transforms")
    if isinstance(raw_transforms, dict):
        # Keys are strings by construction: this only ever sees a JSON-decoded
        # object. The values are whatever someone typed.
        for column_name, entry in raw_transforms.items():
            if not isinstance(entry, dict):
                continue
            transform = ColumnTransform(
                value_transform=_as_transform(entry.get("value_transform")),
                is_monotonic=entry.get("is_monotonic") is True,
            )
            if not transform.is_empty:
                transforms[column_name] = transform

    return StoredPartitionMapping(
        partition_column=_as_name(blob.get("partition_column")),
        mapped_column=_as_name(blob.get("mapped_column")),
        column_transforms=transforms,
    )


def extra_with_partition_mapping(
    raw: Any, mapping: StoredPartitionMapping
) -> str | None:
    """
    The ``extra`` string that carries this mapping, other keys preserved.

    Pure, and needs no app context, which makes it the way to put a dataset into
    a given stored state without going through the configured store -- test
    fixtures today, and the backfill in the migration that moves this to columns.

    Returns ``raw`` *itself* when the blob already says exactly this, so callers
    can tell "no change" from "same text by coincidence" by identity.

    An ``extra`` that is not decodable JSON cannot be merged into and is replaced
    rather than blocking the write. That text is already inert -- ``certification``,
    ``timezone`` and ``warning_markdown`` all read as absent from it -- so the
    alternative would be to silently drop the mapping instead, which is worse and
    just as quiet. It is logged, because it is still someone's text.
    """
    decoded = decode_extra(raw)
    if raw and not decoded and not mapping.is_empty:
        logger.warning(
            "Replacing an undecodable dataset `extra` in order to store a "
            "partition filter mapping"
        )
    merged = {key: value for key, value in decoded.items() if key != EXTRA_KEY}
    if not mapping.is_empty:
        merged[EXTRA_KEY] = _encode_mapping(mapping)
    if merged == decoded:
        return raw
    return json.dumps(merged)


def decode_extra(raw: Any) -> dict[str, Any]:
    """``extra`` as a dict, or an empty one for anything that isn't."""
    try:
        decoded = json.loads(raw)
    except (TypeError, json.JSONDecodeError):
        return {}
    return decoded if isinstance(decoded, dict) else {}


def _encode_mapping(mapping: StoredPartitionMapping) -> dict[str, Any]:
    return {
        "partition_column": mapping.partition_column,
        "mapped_column": mapping.mapped_column,
        "column_transforms": {
            column_name: {
                "value_transform": transform.value_transform,
                "is_monotonic": transform.is_monotonic,
            }
            for column_name, transform in sorted(mapping.column_transforms.items())
        },
    }


def _as_name(value: Any) -> str | None:
    if isinstance(value, str) and value and len(value) <= MAX_COLUMN_NAME_LENGTH:
        return value
    return None


def _as_transform(value: Any) -> str | None:
    if isinstance(value, str) and value and len(value) <= MAX_TRANSFORM_LENGTH:
        return value
    return None


#: Names the dataset API uses for the mapping, mapped to the value object's.
#: The API keeps the post-migration column names; the value object is free to be
#: named for what it is, and this is the one place the two meet.
_TABLE_PAYLOAD_FIELDS = {
    "partition_column": "partition_column",
    "partition_mapped_column": "mapped_column",
}
_COLUMN_PAYLOAD_FIELDS = {
    "partition_value_transform": "value_transform",
    "partition_transform_is_monotonic": "is_monotonic",
}


def extract_partition_mapping_patch(
    model: SqlaTable | None,
    attributes: dict[str, Any] | None,
) -> PartitionMappingPatch | None:
    """
    Take the mapping fields out of an API payload, removing them as it goes.

    Stripping is not housekeeping: the model's mapping attributes are read-only
    properties, so anything left behind reaches a ``setattr`` or a
    ``TableColumn(**properties)`` and raises. Must run before
    ``attributes.pop("columns")``.
    """
    return _collect_patch(model, attributes, pop=True)


def read_partition_mapping_patch(
    model: SqlaTable | None,
    attributes: dict[str, Any] | None,
) -> PartitionMappingPatch | None:
    """
    The same patch, without touching the payload.

    For validation, which runs before the write and must leave ``attributes``
    exactly as the request sent them.
    """
    return _collect_patch(model, attributes, pop=False)


def _collect_patch(
    model: SqlaTable | None,
    attributes: dict[str, Any] | None,
    *,
    pop: bool,
) -> PartitionMappingPatch | None:
    """
    Read the mapping fields out of an API payload.

    Returns ``None`` when the payload mentioned none of them, which is how
    "absent means unchanged" survives all the way up to the caller.
    """
    if not attributes:
        return None

    take = dict.pop if pop else dict.get

    fields: dict[str, Any] = {}
    for payload_name, field_name in _TABLE_PAYLOAD_FIELDS.items():
        if payload_name in attributes:
            fields[field_name] = take(attributes, payload_name)

    column_fields: dict[str, dict[str, Any]] = {}
    columns_by_id = {column.id: column for column in model.columns} if model else {}
    for entry in attributes.get("columns") or []:
        if not isinstance(entry, dict):
            continue
        values = {
            field_name: take(entry, payload_name)
            for payload_name, field_name in _COLUMN_PAYLOAD_FIELDS.items()
            if payload_name in entry
        }
        if not values:
            continue
        if "is_monotonic" in values:
            # The column would be NOT NULL DEFAULT false after the migration, so
            # an explicit `null` reads as "not declared" rather than propagating.
            values["is_monotonic"] = values["is_monotonic"] is True
        # A partial column payload may carry only `id`, in which case the column
        # keeps the name it already has.
        name = entry.get("column_name")
        if not name and (existing := columns_by_id.get(entry.get("id"))):
            name = existing.column_name
        if not name:
            logger.warning(
                "Ignoring a partition value transform on a column payload with "
                "neither a column_name nor a known id"
            )
            continue
        column_fields.setdefault(name, {}).update(values)

    patch = PartitionMappingPatch(fields=fields, column_fields=column_fields)
    return None if patch.is_empty else patch
