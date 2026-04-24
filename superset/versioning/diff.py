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
"""Diff engine for the ``version_changes`` table (FR-016..FR-019).

Hand-rolled because:

- The on-disk ``path`` shape (array of segments) is a direct
  representation of our chosen format; external diff libraries
  return string paths or JSON-Pointer forms that would need
  translation.
- Kind classification (``filter`` vs ``metric`` vs ``field`` etc.)
  is co-located with diff walking, avoiding a second classification
  pass over the generic diff output.
- Child-collection identity uses natural keys (``column_name``,
  ``metric_name``, slice ``uuid``) — the same identity model ADR-004
  settled on for ``dataset_snapshots``. External libraries default
  to list-index matching, which is wrong for our data.

See ADR (plan.md §"Key Design Decision: Hand-rolled diff engine") for
the full rationale.

All functions in this module are pure: they take dicts (or lists of
dicts) and return a list of :class:`ChangeRecord`. The ORM->dict
conversion and Continuum transaction lookup happen in the capture
listener (T048), not here. This keeps the engine unit-testable without
an app context or DB.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any, Callable

from superset.utils import json as _json

# Columns that are always excluded from change records, regardless of
# what ``__versioned__`` says. ``id`` / ``uuid`` are stable identifiers
# (not edited in normal flows). The four audit fields change on every
# save — emitting records for them would double every history entry
# with meaningless "timestamp changed, user stamped" rows that the UI
# would have to filter out anyway.
_AUDIT_FIELDS: frozenset[str] = frozenset(
    {
        "id",
        "uuid",
        "created_on",
        "changed_on",
        "created_by_fk",
        "changed_by_fk",
    }
)

# Chart ``params`` sub-keys that are promoted to first-class kinds.
# Every other params sub-key falls through to ``kind="field"``.
_CHART_PARAMS_KIND_BY_KEY: dict[str, str] = {
    "adhoc_filters": "filter",
    "time_range": "time_range",
    "color_scheme": "color_palette",
    "metrics": "metric",
    "groupby": "dimension",
    "columns": "dimension",
}


def scalar_fields_for(
    model_cls: Any,
    *,
    special: frozenset[str] = frozenset(),
) -> frozenset[str]:
    """Scalar columns on ``model_cls`` that should produce change records.

    Derived from the model itself at call time so contributors (and
    downstream derivatives) don't have to maintain a parallel whitelist
    in this module. Adding a new column to ``Dashboard``, ``Slice``, or
    ``SqlaTable`` — whether upstream or in a fork — automatically flows
    through to ``version_changes`` on the next save.

    Excludes, in order:

    1. The model's own ``__versioned__.exclude`` list, so change records
       stay consistent with Continuum's shadow tables. If Continuum
       isn't tracking a column, the change log shouldn't either.
    2. :data:`_AUDIT_FIELDS` — ``id``, ``uuid``, and the audit
       timestamps / user-id columns.
    3. The caller's ``special`` set — columns handled by a dedicated
       differ elsewhere. ``Slice.params``, for example, is walked by
       :func:`diff_slice_params` to produce first-class ``filter`` /
       ``time_range`` / ``metric`` / ``dimension`` records; emitting
       it as a single opaque ``field`` would defeat that.
    """
    try:
        table = model_cls.__table__
    except AttributeError:
        return frozenset()
    columns = frozenset(c.name for c in table.columns)
    continuum_exclude = frozenset(
        getattr(model_cls, "__versioned__", {}).get("exclude", []) or []
    )
    return columns - continuum_exclude - _AUDIT_FIELDS - special


@dataclass(frozen=True)
class ChangeRecord:
    """One atomic change, as stored in ``version_changes``.

    Fields match the ``version_changes`` columns one-to-one so the
    capture listener can serialise a list of these to
    ``session.bulk_insert_mappings`` without translation.
    """

    kind: str
    path: list[Any]
    from_value: Any
    to_value: Any


Key = str | int


def _diff_scalar(
    field_name: str,
    from_value: Any,
    to_value: Any,
) -> ChangeRecord | None:
    """Emit a generic ``kind="field"`` record when a scalar differs."""
    if from_value == to_value:
        return None
    return ChangeRecord(
        kind="field",
        path=[field_name],
        from_value=from_value,
        to_value=to_value,
    )


def _diff_list_by_natural_key(
    kind: str,
    path_prefix: list[Any],
    from_list: list[Any] | None,
    to_list: list[Any] | None,
    key_fn: Callable[[Any], Key | None],
) -> list[ChangeRecord]:
    """Diff two lists, matching elements by natural key.

    Emits one record per add / remove / modify. When ``key_fn`` returns
    ``None`` for an item (natural key missing or empty), the item falls
    back to its position as a synthetic key — so insertions in the
    middle of a keyless list still produce sensible records, at the
    cost of position-dependent identity.
    """
    from_list = from_list or []
    to_list = to_list or []

    from_by_key: dict[Key, Any] = {}
    for idx, item in enumerate(from_list):
        k = key_fn(item)
        from_by_key[k if k not in (None, "") else f"#{idx}"] = item
    to_by_key: dict[Key, Any] = {}
    for idx, item in enumerate(to_list):
        k = key_fn(item)
        to_by_key[k if k not in (None, "") else f"#{idx}"] = item

    records: list[ChangeRecord] = []
    # Preserve `from` order then append `to`-only keys, so sequence is
    # deterministic across runs.
    for k, from_item in from_by_key.items():
        to_item = to_by_key.get(k)
        if to_item is None:
            records.append(
                ChangeRecord(
                    kind=kind,
                    path=[*path_prefix, k],
                    from_value=from_item,
                    to_value=None,
                )
            )
        elif from_item != to_item:
            records.append(
                ChangeRecord(
                    kind=kind,
                    path=[*path_prefix, k],
                    from_value=from_item,
                    to_value=to_item,
                )
            )
    for k, to_item in to_by_key.items():
        if k not in from_by_key:
            records.append(
                ChangeRecord(
                    kind=kind,
                    path=[*path_prefix, k],
                    from_value=None,
                    to_value=to_item,
                )
            )
    return records


def _filter_key(f: Any) -> Key | None:
    """Natural key for an adhoc filter — its subject (column name).

    Users rarely have two filters on the same column; when they do the
    secondary dimensions (operator, comparator) appear in the record's
    from/to values so the renderer can disambiguate.
    """
    return f.get("subject") if isinstance(f, dict) else None


def _metric_key(m: Any) -> Key | None:
    """Natural key for a metric: prefer ``label``, fall back to column+aggregate."""
    if not isinstance(m, dict):
        return None
    if label := m.get("label"):
        return label
    column = m.get("column")
    col_name = column.get("column_name") if isinstance(column, dict) else None
    agg = m.get("aggregate")
    if col_name and agg:
        return f"{agg}({col_name})"
    return None


def _dimension_key(d: Any) -> Key | None:
    """Natural key for a groupby/columns element — usually a bare string."""
    if isinstance(d, str):
        return d
    if isinstance(d, dict):
        return d.get("label") or d.get("column_name")
    return None


def _coerce_params(p: Any) -> dict[str, Any]:
    """Decode ``Slice.params`` which is stored as a JSON string."""
    if p is None:
        return {}
    if isinstance(p, str):
        try:
            decoded = _json.loads(p)
        except _json.JSONDecodeError:
            return {}
        return decoded if isinstance(decoded, dict) else {}
    if isinstance(p, dict):
        return p
    return {}


def diff_slice_params(
    from_params: Any,
    to_params: Any,
) -> list[ChangeRecord]:
    """Diff the ``Slice.params`` JSON blob, promoting known keys to kinds."""
    from_p = _coerce_params(from_params)
    to_p = _coerce_params(to_params)
    records: list[ChangeRecord] = []
    all_keys = set(from_p) | set(to_p)
    for key in sorted(all_keys):
        from_v = from_p.get(key)
        to_v = to_p.get(key)
        if from_v == to_v:
            continue
        kind = _CHART_PARAMS_KIND_BY_KEY.get(key)
        if kind == "filter" and isinstance(from_v, list) and isinstance(to_v, list):
            records.extend(
                _diff_list_by_natural_key(
                    "filter",
                    ["params", "adhoc_filters"],
                    from_v,
                    to_v,
                    _filter_key,
                )
            )
        elif kind == "metric" and isinstance(from_v, list) and isinstance(to_v, list):
            records.extend(
                _diff_list_by_natural_key(
                    "metric",
                    ["params", "metrics"],
                    from_v,
                    to_v,
                    _metric_key,
                )
            )
        elif (
            kind == "dimension" and isinstance(from_v, list) and isinstance(to_v, list)
        ):
            records.extend(
                _diff_list_by_natural_key(
                    "dimension",
                    ["params", key],
                    from_v,
                    to_v,
                    _dimension_key,
                )
            )
        elif kind:
            # scalar first-class kind (time_range, color_palette) —
            # single record carrying the whole value
            records.append(
                ChangeRecord(
                    kind=kind,
                    path=["params", key],
                    from_value=from_v,
                    to_value=to_v,
                )
            )
        else:
            # unknown params sub-key: generic field change
            records.append(
                ChangeRecord(
                    kind="field",
                    path=["params", key],
                    from_value=from_v,
                    to_value=to_v,
                )
            )
    return records


def diff_scalar_fields(
    pre: dict[str, Any],
    post: dict[str, Any],
    *,
    fields: Iterable[str],
) -> list[ChangeRecord]:
    """Emit one ``kind="field"`` record per differing field in ``fields``.

    The ``fields`` iterable is supplied by the caller — typically
    :func:`scalar_fields_for` at listener wiring time. Keeping the
    field list outside this function means adding a new column to a
    model does not require a matching edit here.
    """
    records: list[ChangeRecord] = []
    for field in sorted(fields):
        record = _diff_scalar(field, pre.get(field), post.get(field))
        if record is not None:
            records.append(record)
    return records


def diff_slice(
    pre: dict[str, Any],
    post: dict[str, Any],
    *,
    fields: Iterable[str],
) -> list[ChangeRecord]:
    """Full Slice (chart) diff — scalars plus params classification.

    Pass ``fields=scalar_fields_for(Slice, special=frozenset({"params"}))``
    to get the ``params``-excluded scalar set; ``Slice.params`` is diffed
    separately by :func:`diff_slice_params` for kind promotion.
    """
    records = diff_scalar_fields(pre, post, fields=fields)
    records.extend(diff_slice_params(pre.get("params"), post.get("params")))
    return records


def diff_dashboard(
    pre: dict[str, Any],
    post: dict[str, Any],
    *,
    fields: Iterable[str],
) -> list[ChangeRecord]:
    """Dashboard scalar-field diff. All paths emit ``kind="field"``.

    Promoting ``position_json`` to ``kind="layout"`` or
    ``json_metadata.native_filter_configuration`` to ``kind="filter"``
    is deferred to Phase 2 alongside the UI that would render them
    (spec Clarifications §Session 2026-04-24).
    """
    return diff_scalar_fields(pre, post, fields=fields)


def diff_dataset(
    pre: dict[str, Any],
    post: dict[str, Any],
    *,
    fields: Iterable[str],
) -> list[ChangeRecord]:
    """SqlaTable scalar-field diff. All paths emit ``kind="field"``.

    Children (columns, metrics) are diffed separately via
    :func:`diff_dataset_columns` / :func:`diff_dataset_metrics` because
    the listener reads them via raw SQL (same pattern as
    ``dataset_snapshots``) rather than walking the ORM collection.
    """
    return diff_scalar_fields(pre, post, fields=fields)


def diff_dataset_columns(
    from_columns: list[dict[str, Any]] | None,
    to_columns: list[dict[str, Any]] | None,
) -> list[ChangeRecord]:
    """Child-collection diff on TableColumn rows, keyed by column_name."""
    return _diff_list_by_natural_key(
        kind="column",
        path_prefix=["columns"],
        from_list=from_columns,
        to_list=to_columns,
        key_fn=lambda c: c.get("column_name") if isinstance(c, dict) else None,
    )


def diff_dataset_metrics(
    from_metrics: list[dict[str, Any]] | None,
    to_metrics: list[dict[str, Any]] | None,
) -> list[ChangeRecord]:
    """Child-collection diff on SqlMetric rows, keyed by metric_name."""
    return _diff_list_by_natural_key(
        kind="metric",
        path_prefix=["metrics"],
        from_list=from_metrics,
        to_list=to_metrics,
        key_fn=lambda m: m.get("metric_name") if isinstance(m, dict) else None,
    )


def diff_dashboard_slices(
    from_slice_uuids: list[str] | None,
    to_slice_uuids: list[str] | None,
) -> list[ChangeRecord]:
    """Diff a dashboard's chart membership, keyed by slice uuid.

    Pure set-diff: added uuids get ``from_value=None, to_value=uuid``;
    removed uuids get the inverse. No "changed" case because chart
    associations are identity-only (the list element IS the uuid).
    """
    from_set = set(from_slice_uuids or [])
    to_set = set(to_slice_uuids or [])
    records: list[ChangeRecord] = []
    for uuid_ in sorted(from_set - to_set):
        records.append(
            ChangeRecord(
                kind="chart",
                path=["slices", uuid_],
                from_value=uuid_,
                to_value=None,
            )
        )
    for uuid_ in sorted(to_set - from_set):
        records.append(
            ChangeRecord(
                kind="chart",
                path=["slices", uuid_],
                from_value=None,
                to_value=uuid_,
            )
        )
    return records
