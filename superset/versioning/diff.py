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
"""Diff engine for the ``version_changes`` table.

Hand-rolled because:

- The on-disk ``path`` shape (array of segments) is a direct
  representation of our chosen format; external diff libraries
  return string paths or JSON-Pointer forms that would need
  translation.
- Kind classification (``filter`` vs ``metric`` vs ``field`` etc.)
  is co-located with diff walking, avoiding a second classification
  pass over the generic diff output.
- Child-collection identity uses natural keys (``column_name``,
  ``metric_name``, slice ``uuid``) — the same identity model
  ``DatasetDAO.update_columns`` settled on (ADR-004). External
  libraries default to list-index matching, which is wrong for our
  data.

See the module docstring above for the full rationale.

All functions in this module are pure: they take dicts (or lists of
dicts) and return a list of :class:`ChangeRecord`. The ORM->dict
conversion and Continuum transaction lookup happen in the capture
listener, not here. This keeps the engine unit-testable without
an app context or DB.
"""

from __future__ import annotations

import logging
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from typing import Any

from superset.utils import json as _json

logger = logging.getLogger(__name__)

# Per-field recursion depth caps for the leaf-level diff walker.
# A cap is a usefulness bound, not a safety bound: it controls how deep
# into a nested JSON value the engine emits per-leaf records before
# stopping and treating the sub-tree as an opaque value. Values are
# tuned to the field's semantic shape — layout meta is shallow
# (text/sizes/colors), json_metadata and chart params can carry deep
# structures (native filters, adhoc filter sub-queries).
_LAYOUT_META_DIFF_DEPTH = 3
_JSON_METADATA_DIFF_DEPTH = 6
_SLICE_PARAMS_DIFF_DEPTH = 6

# Output-safety caps applied at persistence time (see :func:`cap_records`).
# Unlike the depth caps above (usefulness bounds), these are *safety* bounds:
# they stop a single edit from writing an unbounded value or an unbounded
# number of rows into ``version_changes`` (and thus the activity stream). A
# 200 KB ``params``/SQL blob would otherwise become a 200 KB value, and a
# 2000-element list edit 2000 rows — both demonstrated. ``version_changes`` is
# an audit log, not a content store, so over-large output is summarised.
MAX_VALUE_BYTES = 8 * 1024  # per from_value / to_value, JSON-serialised
MAX_RECORDS_PER_FIELD = 100  # per top-level field; collapse beyond this

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

# Fields stripped from child-collection dict items (TableColumn,
# SqlMetric) before comparison and emission. ``changed_on`` /
# ``created_on`` / ``*_by_fk`` are audit fields that update on every
# save of the parent — without this filter, saving a dataset to add
# one column produces a record per existing column too (because their
# ``changed_on`` timestamps all refreshed). ``id`` and ``table_id``
# are implementation details — ``id`` can change under the
# ``override_columns`` delete-and-reinsert pattern (ADR-004) even
# when the column is semantically unchanged; ``table_id`` is the
# parent FK and never meaningfully differs within one dataset's
# history. ``uuid`` stays stable across normal saves and is kept so
# the renderer can use it for identity if it needs to.
_CHILD_ITEM_OPAQUE_FIELDS: frozenset[str] = frozenset(
    {
        "id",
        "table_id",
        "changed_on",
        "created_on",
        "changed_by_fk",
        "created_by_fk",
    }
)


def _strip_opaque_fields(item: Any) -> Any:
    """Return *item* with child-item audit/implementation fields removed.

    Pass-through for non-dict values (scalars, strings) — the strip
    only applies where it matters (dataset column / metric dicts).
    """
    if not isinstance(item, dict):
        return item
    return {k: v for k, v in item.items() if k not in _CHILD_ITEM_OPAQUE_FIELDS}


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

# Chart ``params`` sub-keys that are machine-stamped on save and don't
# carry user-authored signal — same category as ``last_saved_at`` on
# the scalar side. ``slice_id`` is a self-reference to the chart's
# own primary id; Superset's save paths add or refresh it on every
# save, producing a spurious "field" record on the first save after
# a chart's params were stored without it.
_CHART_PARAMS_AUDIT_KEYS: frozenset[str] = frozenset({"slice_id"})


def scalar_fields_for(
    model_cls: Any,
    *,
    special: frozenset[str] = frozenset(),
    audit: frozenset[str] = frozenset(),
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
       timestamps / user-id columns shared across the three entity types.
    3. The caller's ``audit`` set — model-specific save-side-effect
       columns that aren't user-authored content. ``Slice.last_saved_at``
       / ``last_saved_by_fk`` are stamped on every chart save by
       ``UpdateChartCommand``, similar to how ``changed_on`` is stamped
       by the ORM event listener; emitting "field" records for them
       would noise up the change log with one entry per save that
       carries no user-meaningful signal.
    4. The caller's ``special`` set — columns handled by a dedicated
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
    return columns - continuum_exclude - _AUDIT_FIELDS - audit - special


@dataclass(frozen=True)
class ChangeRecord:
    """One atomic change, as stored in ``version_changes``.

    Fields match the ``version_changes`` columns one-to-one so the
    capture listener can serialise a list of these to
    ``session.bulk_insert_mappings`` without translation.

    Three orthogonal dimensions:
    * ``kind`` — what type of thing changed (``filter`` / ``column`` /
      ``header`` / ``field`` / etc.). Content category.
    * ``operation`` — what happened to it (``add`` / ``remove`` /
      ``move`` / ``edit``). ``move`` only fires for layout records.
    * ``path`` — pure navigation address; no verb encoded.

    The transaction-level fourth dimension (``trigger``: ``restore`` /
    ``import`` / ``clone``) lives on ``version_transaction``, not here.
    """

    kind: str
    operation: str
    path: list[Any]
    from_value: Any
    to_value: Any


Key = str | int


def _value_bytes(value: Any) -> int:
    try:
        return len(_json.dumps(value, default=str))
    except (TypeError, ValueError):
        return len(str(value))


def _cap_value(value: Any) -> Any:
    """Replace an over-large ``from_value``/``to_value`` with a bounded marker.

    ``version_changes`` is an audit log, not a content store; a value past
    :data:`MAX_VALUE_BYTES` is swapped for a marker recording the original size
    and a short preview, so a huge ``params``/SQL/blob edit can't write a
    multi-hundred-KB row (or balloon the activity response). Values within the
    bound pass through unchanged.
    """
    size = _value_bytes(value)
    if size <= MAX_VALUE_BYTES:
        return value
    preview = value if isinstance(value, str) else _json.dumps(value, default=str)
    return {"__truncated__": True, "original_bytes": size, "preview": preview[:256]}


def cap_records(records: list[ChangeRecord]) -> list[ChangeRecord]:
    """Apply the output-safety caps to one entity's record list before it is
    persisted.

    1. **Record-count cap** — group by top-level field (``path[0]``); any field
       producing more than :data:`MAX_RECORDS_PER_FIELD` records (a 2000-element
       list edit, a 1000-key dict rewrite, a thousand-node layout churn) is
       collapsed to a single summary record carrying the count. First-seen field
       order is preserved.
    2. **Value-size cap** — every surviving record's ``from_value``/``to_value``
       is run through :func:`_cap_value`.
    """
    groups: dict[tuple[Any, ...], list[ChangeRecord]] = {}
    for record in records:
        groups.setdefault(tuple(record.path[:1]), []).append(record)

    deduped: list[ChangeRecord] = []
    for key, group in groups.items():
        if len(group) > MAX_RECORDS_PER_FIELD:
            first = group[0]
            deduped.append(
                ChangeRecord(
                    kind=first.kind,
                    operation="update",
                    path=list(key),
                    from_value={"__collapsed__": len(group)},
                    to_value={"__collapsed__": len(group)},
                )
            )
        else:
            deduped.extend(group)

    return [
        ChangeRecord(
            kind=r.kind,
            operation=r.operation,
            path=r.path,
            from_value=_cap_value(r.from_value),
            to_value=_cap_value(r.to_value),
        )
        for r in deduped
    ]


def _operation_from_values(from_value: Any, to_value: Any) -> str:
    """Derive the per-record ``operation`` verb from ``from_value`` /
    ``to_value`` nullability.

    * ``add`` — ``from_value`` is ``None`` and ``to_value`` is not.
    * ``remove`` — ``to_value`` is ``None`` and ``from_value`` is not.
    * ``edit`` — both populated (or both null, which shouldn't reach here).

    Used by every emit site except ``_diff_layout_node``, which emits
    ``move`` records (parent reparenting) that cannot be derived from
    value nullability alone.
    """
    if from_value is None and to_value is not None:
        return "add"
    if to_value is None and from_value is not None:
        return "remove"
    return "edit"


def _values_equivalent(from_value: Any, to_value: Any) -> bool:
    """True if a transition from ``from_value`` to ``to_value`` should
    NOT produce a record.

    Beyond plain ``==`` equality, treats ``None`` and ``""`` as equivalent:
    Superset's save paths normalize nullable strings to ``""`` on first
    write (e.g. ``Dashboard.css``, ``certified_by``,
    ``certification_details``), so a first-save transition between
    null and empty string carries no user-authored signal.
    """
    if from_value == to_value:
        return True
    if from_value in (None, "") and to_value in (None, ""):
        return True
    return False


def _diff_scalar(
    field_name: str,
    from_value: Any,
    to_value: Any,
) -> ChangeRecord | None:
    """Emit a generic ``kind="field"`` record when a scalar differs."""
    if _values_equivalent(from_value, to_value):
        return None
    return ChangeRecord(
        kind="field",
        operation=_operation_from_values(from_value, to_value),
        path=[field_name],
        from_value=from_value,
        to_value=to_value,
    )


def _recursive_leaf_diff(
    kind: str,
    path_prefix: list[Any],
    pre: Any,
    post: Any,
    *,
    max_depth: int,
) -> list[ChangeRecord]:
    """Walk matched dict structures and emit one ``ChangeRecord`` per
    changed leaf.

    Recursion rules:

    * Both sides equal (per :func:`_values_equivalent`) → no record.
    * Both sides ``dict`` AND recursion depth below ``max_depth`` →
      recurse into each key, extending the path by the key.
    * All other cases (scalar mismatch, list on either side, mismatched
      types, both dicts but depth-capped) → emit one leaf record with
      ``from_value`` / ``to_value`` carrying the raw pre/post values.

    Lists are treated as opaque on purpose — positional paths break on
    reorder and most lists in Superset's JSON blobs (adhoc filters,
    metrics, dataset columns) already have a dedicated natural-key
    walker upstream that emits per-element records with the right
    identity.

    A depth-cap hit on dict-vs-dict emits a debug log so production
    tuning can see when a field's cap is too tight to capture all
    meaningful change.
    """

    def _walk(pre: Any, post: Any, path: list[Any], depth: int) -> list[ChangeRecord]:
        if _values_equivalent(pre, post):
            return []
        if depth < max_depth and isinstance(pre, dict) and isinstance(post, dict):
            records: list[ChangeRecord] = []
            for key in sorted(set(pre) | set(post)):
                records.extend(
                    _walk(pre.get(key), post.get(key), [*path, key], depth + 1)
                )
            return records
        if isinstance(pre, dict) and isinstance(post, dict):
            logger.debug(
                "version_changes: depth cap %d hit at path=%s — sub-tree "
                "emitted as opaque leaf",
                max_depth,
                path,
            )
        return [
            ChangeRecord(
                kind=kind,
                operation=_operation_from_values(pre, post),
                path=list(path),
                from_value=pre,
                to_value=post,
            )
        ]

    return _walk(pre, post, path_prefix, 0)


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

    def _effective_key(raw: Key | None, idx: int) -> Key:
        if raw is None or raw == "":
            return idx
        return raw

    from_by_key: dict[Key, Any] = {}
    for idx, item in enumerate(from_list):
        from_by_key[_effective_key(key_fn(item), idx)] = item
    to_by_key: dict[Key, Any] = {}
    for idx, item in enumerate(to_list):
        to_by_key[_effective_key(key_fn(item), idx)] = item

    records: list[ChangeRecord] = []
    # Preserve `from` order then append `to`-only keys, so sequence is
    # deterministic across runs. For dict items (dataset columns /
    # metrics) we strip audit/implementation fields before comparing
    # AND before emitting — otherwise a save that only adds a new
    # column would also emit "changed" records for every existing
    # column, because their ``changed_on`` timestamps all refreshed.
    # The stripped from/to are what the renderer sees; the per-column
    # audit trail is already aggregated at the transaction level in
    # ``version_transaction`` (``user_id`` + ``issued_at``).
    for k, from_item in from_by_key.items():
        to_item = to_by_key.get(k)
        stripped_from = _strip_opaque_fields(from_item)
        if to_item is None:
            records.append(
                ChangeRecord(
                    kind=kind,
                    operation="remove",
                    path=[*path_prefix, k],
                    from_value=stripped_from,
                    to_value=None,
                )
            )
            continue
        stripped_to = _strip_opaque_fields(to_item)
        if stripped_from != stripped_to:
            records.append(
                ChangeRecord(
                    kind=kind,
                    operation="edit",
                    path=[*path_prefix, k],
                    from_value=stripped_from,
                    to_value=stripped_to,
                )
            )
    for k, to_item in to_by_key.items():
        if k not in from_by_key:
            records.append(
                ChangeRecord(
                    kind=kind,
                    operation="add",
                    path=[*path_prefix, k],
                    from_value=None,
                    to_value=_strip_opaque_fields(to_item),
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
    all_keys = (set(from_p) | set(to_p)) - _CHART_PARAMS_AUDIT_KEYS
    for key in sorted(all_keys):
        from_v = from_p.get(key)
        to_v = to_p.get(key)
        if _values_equivalent(from_v, to_v):
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
            # scalar first-class kind (time_range, color_palette).
            # For genuinely scalar values the recursion emits one leaf
            # record exactly as before; for the unusual case of a dict
            # value (custom viz params) it recurses to the leaf.
            records.extend(
                _recursive_leaf_diff(
                    kind=kind,
                    path_prefix=["params", key],
                    pre=from_v,
                    post=to_v,
                    max_depth=_SLICE_PARAMS_DIFF_DEPTH,
                )
            )
        else:
            # unknown params sub-key: generic field change, recursed
            # to the leaf so a deep custom-viz option doesn't ship its
            # whole sub-tree on both sides.
            records.extend(
                _recursive_leaf_diff(
                    kind="field",
                    path_prefix=["params", key],
                    pre=from_v,
                    post=to_v,
                    max_depth=_SLICE_PARAMS_DIFF_DEPTH,
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


def diff_json_field(
    field_name: str,
    from_value: Any,
    to_value: Any,
    *,
    exclude_keys: frozenset[str] = frozenset(),
    max_depth: int = _JSON_METADATA_DIFF_DEPTH,
) -> list[ChangeRecord]:
    """Diff a TEXT column that stores a JSON dict, emitting one record
    per changed leaf.

    Used for ``Dashboard.json_metadata`` (``position_json`` has its
    own structural diff via :func:`diff_dashboard_layout`). Saving the
    blob verbatim into ``from_value`` / ``to_value`` would swamp the
    change log with multi-KB strings on every save; recursing into the
    parsed dict reduces noise to "exactly which leaf changed".

    *exclude_keys* names sub-keys that are frontend-derived /
    auto-stamped on save and don't carry user-authored signal. Same
    rationale as the ``audit`` parameter on
    :func:`scalar_fields_for` for the parent-column level.

    Path is ``[field_name, key, ...]`` for leaf records, mirroring
    :func:`diff_slice_params`'s ``["params", key, ...]`` shape so
    renderers can use a single addressing scheme across the chart
    and dashboard sides.
    """
    from_p = _coerce_params(from_value)
    to_p = _coerce_params(to_value)
    records: list[ChangeRecord] = []
    for key in sorted(set(from_p) | set(to_p)):
        if key in exclude_keys:
            continue
        records.extend(
            _recursive_leaf_diff(
                kind="field",
                path_prefix=[field_name, key],
                pre=from_p.get(key),
                post=to_p.get(key),
                max_depth=max_depth,
            )
        )
    return records


# json_metadata sub-keys that the frontend auto-stamps / auto-derives
# on save. They mirror dashboard membership and chart inventory, not
# user-authored content, so they noise up the change log without
# carrying intent. The records produced for these keys can be ~50KB
# (full label-colour dict) for a one-chart save.
#
#   chart_configuration:        per-chart cross-filter scope state,
#                               re-derived when charts are added/removed.
#   global_chart_configuration: dashboard-wide filter scope; the
#                               ``chartsInScope`` list mirrors live
#                               dashboard membership.
#   map_label_colors:           label → colour map, re-stamped on save
#                               from currently-visible filter values.
#   shared_label_colors:        cross-chart shared-label colour list,
#                               rewritten by the DAO when a dashboard is
#                               merely *viewed* — producing phantom
#                               "Properties updated" records with no
#                               user edit (surfaced by the
#                               version-history UI). The
#                               view-time write itself is a separate
#                               round-trip-asymmetry issue (cf. #39706);
#                               this exclusion stops the change-record
#                               noise regardless.
#   show_chart_timestamps:      frontend toggle, defaults applied on
#                               save when missing.
#   color_namespace:            scoped colour-scheme namespace, frontend-
#                               derived from the chart set.
DASHBOARD_JSON_METADATA_AUDIT_KEYS: frozenset[str] = frozenset(
    {
        "chart_configuration",
        "global_chart_configuration",
        "map_label_colors",
        "shared_label_colors",
        "show_chart_timestamps",
        "color_namespace",
    }
)


# Layout component types and how they map to record ``kind`` strings.
# ``HEADER_ID`` is excluded — that's the dashboard's title bar, mirrored
# from ``dashboard_title``. ``ROOT_ID`` and ``GRID_ID`` are structural
# singletons whose only deltas are children lists, which we infer from
# the moves of the children themselves.
_LAYOUT_TYPE_TO_KIND: dict[str, str] = {
    "CHART": "chart",
    "ROW": "row",
    "COLUMN": "column",
    "TAB": "tab",
    "TABS": "tabs",
    "HEADER": "header",
    "MARKDOWN": "markdown",
    "DIVIDER": "divider",
}

# Layout components we never emit records for: ROOT_ID is the layout
# root (always present, never moves); GRID_ID is the singleton vertical
# stack inside ROOT_ID; HEADER_ID is the dashboard's title bar (already
# covered by the ``dashboard_title`` scalar field).
_LAYOUT_SUPPRESSED_IDS: frozenset[str] = frozenset({"ROOT_ID", "GRID_ID", "HEADER_ID"})


def _layout_component_label(node: dict[str, Any]) -> str | None:
    """Extract a human-readable label from a layout node, when one
    exists. Used to build the ``from_value`` / ``to_value`` payload so
    the UI can render messages like "Added chart 'Foo'" without
    needing to fetch related entities.
    """
    meta = node.get("meta") or {}
    if not isinstance(meta, dict):
        return None
    for key in ("sliceName", "label", "text"):
        value = meta.get(key)
        if isinstance(value, str) and value.strip():
            return value
    return None


def _layout_node_payload(node: dict[str, Any]) -> dict[str, Any]:
    """Minimal payload describing a layout node — enough for the UI
    to render the change without dragging the full layout snippet
    (which can be ~1KB per row when CHART nodes carry colour configs).
    """
    meta = node.get("meta") or {}
    if not isinstance(meta, dict):
        meta = {}
    payload: dict[str, Any] = {"id": node.get("id"), "type": node.get("type")}
    if (label := _layout_component_label(node)) is not None:
        payload["name"] = label
    if (chart_id := meta.get("chartId")) is not None:
        payload["chartId"] = chart_id
    # ``uuid`` (slice uuid for CHART nodes) lets the M2M-vs-layout
    # dedupe in :func:`fold_dashboard_layout_with_chart_changes`
    # match on the same key — :func:`diff_dashboard_slices` keys its
    # records by uuid, not chartId.
    if (slice_uuid := meta.get("uuid")) is not None:
        payload["uuid"] = slice_uuid
    return payload


def _layout_parent_id(node: dict[str, Any]) -> Any:
    """The immediate-parent node id for a layout component — the last
    entry in ``parents``. Used to detect moves: same id, different
    parent."""
    parents = node.get("parents") or []
    if not isinstance(parents, list) or not parents:
        return None
    return parents[-1]


def _meta_excluding_position(node: dict[str, Any]) -> dict[str, Any]:
    """Meta dict with ``parents``-equivalent positional bits removed
    so two nodes that differ ONLY in where they sit compare equal at
    the meta level. Move detection uses ``parents`` directly; this is
    for "edit" (meta change) detection."""
    meta = node.get("meta") or {}
    return dict(meta) if isinstance(meta, dict) else {}


def _diff_layout_node(
    node_id: str,
    pre_node: dict[str, Any] | None,
    post_node: dict[str, Any] | None,
) -> list[ChangeRecord]:
    """Diff one component slot in the layout dict and return records for
    the logical action — add, remove, move, edit.

    add / remove / move emit a single record carrying the minimal node
    payload (so the renderer can describe the affected component).
    edit recurses into the node's ``meta`` dict and emits one record per
    changed leaf, capped at ``_LAYOUT_META_DIFF_DEPTH``.

    Returns an empty list when the slot is unchanged or holds an unknown
    component type.
    """
    node_for_kind = post_node or pre_node or {}
    kind = _LAYOUT_TYPE_TO_KIND.get(node_for_kind.get("type") or "")
    if kind is None:
        return []  # unknown component type — skip rather than emit garbage

    if pre_node is None and post_node is not None:
        return [
            ChangeRecord(
                kind=kind,
                operation="add",
                path=[node_id],
                from_value=None,
                to_value=_layout_node_payload(post_node),
            )
        ]
    if post_node is None and pre_node is not None:
        return [
            ChangeRecord(
                kind=kind,
                operation="remove",
                path=[node_id],
                from_value=_layout_node_payload(pre_node),
                to_value=None,
            )
        ]

    # Both present — check move first, then edit.
    assert pre_node is not None
    assert post_node is not None
    pre_parent = _layout_parent_id(pre_node)
    if pre_parent != (post_parent := _layout_parent_id(post_node)):
        return [
            ChangeRecord(
                kind=kind,
                operation="move",
                path=[node_id],
                from_value={**_layout_node_payload(pre_node), "parent": pre_parent},
                to_value={**_layout_node_payload(post_node), "parent": post_parent},
            )
        ]

    # Edit: recurse into meta and emit one record per changed leaf.
    # Path shape ``[node_id, <leaf_key>, ...]``. The verb (operation) is
    # derived per-leaf by the recursion via ``_operation_from_values``;
    # a leaf added inside an existing node gets ``add`` and so on. The
    # node-level "this was an edit" fact is implicit in the path shape
    # carrying segments after ``node_id``.
    return _recursive_leaf_diff(
        kind=kind,
        path_prefix=[node_id],
        pre=_meta_excluding_position(pre_node),
        post=_meta_excluding_position(post_node),
        max_depth=_LAYOUT_META_DIFF_DEPTH,
    )


def diff_dashboard_layout(
    pre: Any,
    post: Any,
) -> list[ChangeRecord]:
    """Structural diff of a dashboard's ``position_json``, emitting one
    record per logical layout action.

    Walks both sides keyed on the component ``id`` (e.g.
    ``"CHART-mkPZLOnWCElgL0Udp1gVK"``):

    * id present only in *post* → ``op=add``, ``from_value=None``,
      ``to_value=<minimal payload>``
    * id present only in *pre*  → ``op=remove``, payload swapped
    * id in both, ``parents`` differs → ``op=move``, payloads carry
      old + new parent
    * id in both, parents equal, ``meta`` differs → ``op=edit``,
      payloads carry old + new meta
    * id in both, equal → no record

    The verb (add/remove/move/edit) is carried in each record's
    ``operation`` field; ``path`` is the pure navigation address to the
    node and carries no verb, matching the ``ChangeRecord`` contract.

    ``ROOT_ID`` / ``GRID_ID`` / ``HEADER_ID`` are suppressed (see
    :data:`_LAYOUT_SUPPRESSED_IDS`).
    """
    pre_nodes = _layout_nodes(pre)
    post_nodes = _layout_nodes(post)
    records: list[ChangeRecord] = []
    for node_id in sorted(set(pre_nodes) | set(post_nodes)):
        records.extend(
            _diff_layout_node(node_id, pre_nodes.get(node_id), post_nodes.get(node_id))
        )
    return records


def _layout_nodes(raw: Any) -> dict[str, dict[str, Any]]:
    """Coerce *raw* (a ``position_json`` blob or already-parsed dict) into
    the ``{node_id: node_dict}`` shape used by the layout diff, filtering
    out non-dict values and the always-present root/grid/header singletons.
    """
    parsed = _coerce_params(raw)
    return {
        k: v
        for k, v in parsed.items()
        if isinstance(v, dict) and k not in _LAYOUT_SUPPRESSED_IDS
    }


def diff_dashboard(
    pre: dict[str, Any],
    post: dict[str, Any],
    *,
    fields: Iterable[str],
) -> list[ChangeRecord]:
    """Dashboard diff: scalar fields plus structural diff of
    ``json_metadata`` and ``position_json``.

    Promoting ``position_json`` to ``kind="layout"`` or
    ``json_metadata.native_filter_configuration`` to ``kind="filter"``
    is deferred to Phase 2 alongside the UI that would render them;
    until then, both fields
    fall through to ``kind="field"`` records keyed by sub-key.
    """
    records = diff_scalar_fields(pre, post, fields=fields)
    records.extend(
        diff_json_field(
            "json_metadata",
            pre.get("json_metadata"),
            post.get("json_metadata"),
            exclude_keys=DASHBOARD_JSON_METADATA_AUDIT_KEYS,
        )
    )
    records.extend(
        diff_dashboard_layout(pre.get("position_json"), post.get("position_json"))
    )
    return records


def _layout_chart_uuids_by_verb(
    records: list[ChangeRecord],
) -> tuple[set[Any], set[Any]]:
    """Scan *records* for layout ``add``/``remove`` records on charts and
    return ``(added_uuids, removed_uuids)`` sets.

    Keys off ``operation`` (the explicit verb column) rather than
    ``path[0]`` — paths no longer carry the verb.
    """
    added: set[Any] = set()
    removed: set[Any] = set()
    for r in records:
        if r.kind != "chart":
            continue
        # Layout chart records have ``path = [node_id]`` (length 1) for
        # add/remove/move and ``[node_id, ...leaf]`` for edits. We only
        # care about the structural add/remove cases here.
        if len(r.path) != 1:
            continue
        if r.operation == "add" and isinstance(r.to_value, dict):
            uuid_ = r.to_value.get("uuid")
            if uuid_ is not None:
                added.add(uuid_)
        elif r.operation == "remove" and isinstance(r.from_value, dict):
            uuid_ = r.from_value.get("uuid")
            if uuid_ is not None:
                removed.add(uuid_)
    return added, removed


def _is_redundant_m2m_chart_record(
    r: ChangeRecord, added_uuids: set[Any], removed_uuids: set[Any]
) -> bool:
    """Return ``True`` when *r* is an M2M-style slice record that
    duplicates an already-captured layout add/remove for the same uuid.

    M2M slice records have path ``["slices", uuid]`` (length 2); their
    info is strictly less than the corresponding layout record's
    (no name, no parent), so the layout side wins on dedup.
    """
    if r.kind != "chart" or len(r.path) != 2 or r.path[0] != "slices":
        return False
    slice_uuid = r.path[1]
    if r.from_value is None and r.to_value is not None:
        return slice_uuid in added_uuids
    if r.to_value is None and r.from_value is not None:
        return slice_uuid in removed_uuids
    return False


def fold_dashboard_layout_with_chart_changes(
    records: list[ChangeRecord],
) -> list[ChangeRecord]:
    """When a dashboard save adds/removes charts, the ``slices`` M2M
    diff and the layout diff each emit a record for the same logical
    action. Drop the M2M ``kind="chart"`` records — the layout-side
    record carries more information (chart name, parent container).

    The matching is by slice uuid: ``diff_dashboard_slices`` produces
    records with path ``["slices", <slice-uuid>]``; the layout
    payloads carry the same uuid (sourced from
    ``position_json.CHART-x.meta.uuid``). We dedupe on that key.

    Called from the change-records listener after the M2M and layout
    diffs are both merged into the per-entity buffer.
    """
    added_uuids, removed_uuids = _layout_chart_uuids_by_verb(records)
    return [
        r
        for r in records
        if not _is_redundant_m2m_chart_record(r, added_uuids, removed_uuids)
    ]


def diff_dataset(
    pre: dict[str, Any],
    post: dict[str, Any],
    *,
    fields: Iterable[str],
) -> list[ChangeRecord]:
    """SqlaTable scalar-field diff. All paths emit ``kind="field"``.

    Children (columns, metrics) are diffed separately via
    :func:`diff_dataset_columns` / :func:`diff_dataset_metrics`. The
    listener reads them from Continuum shadow tables
    (``table_columns_version`` / ``sql_metrics_version``) rather than
    walking the ORM collection.
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
                operation="remove",
                path=["slices", uuid_],
                from_value=uuid_,
                to_value=None,
            )
        )
    for uuid_ in sorted(to_set - from_set):
        records.append(
            ChangeRecord(
                kind="chart",
                operation="add",
                path=["slices", uuid_],
                from_value=None,
                to_value=uuid_,
            )
        )
    return records
