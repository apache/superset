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
"""What a proposed payload actually changes about the live asset.

The gate used to treat "the payload has keys" as "the asset changes", and
the review API reported the payload's keys as the changed fields. Neither
looks at what is live, which produced two of the review's findings from one
cause: a save that altered nothing still created a request and locked the
asset (129076), and a reviewer was told `params` and `json_metadata` had
"Changed" when the author had renamed a chart (129075).

The comparison has to be semantic, not textual. Superset round-trips
`params`, `query_context`, `json_metadata` and `position_json` through
`json.dumps`, so re-saving an untouched chart produces a byte-different
string with identical meaning -- which is exactly the empty save that
reached an approver's queue.
"""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from superset.utils import json
from superset.versioning.diff import DASHBOARD_JSON_METADATA_SAVE_DEFAULTS

logger = logging.getLogger(__name__)

#: Payload fields Superset stores as serialized JSON. Compared by meaning.
JSON_FIELDS = frozenset(
    {
        "params",
        "query_context",
        "json_metadata",
        "position_json",
        "extra",
    }
)

#: Fields whose value is a list of named things (dataset columns, metrics).
#: Compared by name, because that is how a person reads the change.
NAMED_LIST_FIELDS: dict[str, str] = {
    "columns": "column_name",
    "metrics": "metric_name",
}

#: Payload keys that never describe asset content, so never a change on
#: their own: bookkeeping the host adds to the body on its way through.
IGNORED_FIELDS = frozenset(
    {
        "last_saved_at",
        "last_saved_by",
        "last_saved_by_fk",
        "changed_on",
        "changed_by",
        "changed_by_fk",
    }
)

#: What a named thing *is*, rather than what it says. ``uuid`` belongs
#: beside ``id``, and its absence was a real defect: the stored payload is
#: JSON, so its ``uuid`` arrives as a ``str`` while the live ORM row holds
#: a ``uuid.UUID``, and those two never compare equal. Every dataset
#: change therefore reported ``columns`` and ``metrics`` as changed
#: whatever the author had really edited -- a pure SQL rewrite came back
#: with ``changed_fields`` naming all three, while the same payload's own
#: ``dataset_detail`` said nothing had moved in either list.
#:
#: Capture was never wrong, which is why no test caught it: the gate
#: compares the in-memory command body, where ``uuid`` is still a ``UUID``
#: on both sides. Only the read-back, which re-parses the stored JSON,
#: could see the mismatch -- so the reviewer was shown the noise and the
#: author never was.
IDENTITY_FIELDS = frozenset({"id", "uuid"})


#: Entries inside a dashboard's ``json_metadata`` that Superset derives for
#: itself rather than taking from the author.
#:
#: The label-colour maps are recomputed from whichever charts happened to
#: render, which is why the colours command is already allowed to apply its
#: background sync directly. Measuring them here would have the gate call a
#: recomputation an edit.
DERIVED_METADATA_KEYS = frozenset(
    {
        "shared_label_colors",
        "map_label_colors",
        "color_scheme_domain",
    }
)

#: The dashboard PUT carries the layout inside ``json_metadata`` while the
#: asset keeps it in a column of its own, so the stored metadata has no
#: ``positions`` at all and a whole-blob comparison always differs. It is
#: compared against the column instead, which is exact: an unchanged layout
#: round-trips to the same thing.
LAYOUT_KEY = "positions"
LAYOUT_COLUMN = "position_json"


#: Entries the dashboard write seeds with a default when the stored
#: metadata has never had them, mapped to that default.
#:
#: ``DashboardDAO.set_dash_metadata`` ends with
#: ``md.setdefault(key, default_value)`` over its own ``metadata_defaults``
#: (``superset/daos/dashboard.py``), plus ``md.setdefault(
#: "timed_refresh_immune_slices", [])``. So a key the stored metadata lacks,
#: stated by the body as exactly that default, is stored with the same value
#: the write would have seeded whether the body mentioned it or not: it is
#: not an edit to the dashboard, it is the shape being filled in.
#:
#: Read from core rather than copied. Every edit-mode save posts the whole
#: set (``cleanedData.metadata`` in ``dashboardState.ts``), and core's
#: version history already answers this exact question about this exact set
#: -- a second table here would drift from both.
#:
#: Narrow on purpose, in three ways. Only a key the stored metadata does not
#: have at all: a dashboard that holds ``refresh_frequency: 300`` and is sent
#: ``0`` has had its refresh turned off, which is a change. Only the exact
#: default, type included, so ``1`` is not ``True``. And only this table:
#: everything else the body states is still compared as it always was.
SEEDED_METADATA_DEFAULTS = DASHBOARD_JSON_METADATA_SAVE_DEFAULTS

#: The dashboard-wide cross-filter scope, which no reader needs stored.
#:
#: ``getCrossFiltersConfiguration`` (``superset-frontend/src/dashboard/util/
#: crossFilters.ts``) synthesises ``{scope: DEFAULT_CROSS_FILTER_SCOPING,
#: chartsInScope: <every chart>}`` for a dashboard whose metadata has no
#: global scope, and the backend's own ``_derive_cross_filter_scopes``
#: (``superset/dashboards/filter_scope.py``) answers the same question the
#: same way -- an absent global config means every chart. The default is
#: therefore what absence already says, and the client writing it down is
#: not the author scoping anything.
#:
#: Only the default. A ``rootPath`` that names a tab, or any ``excluded``
#: list, is a scope somebody set, and a chart entering or leaving one is
#: reviewable (Visa Q3) -- those still read as a change, which is why this
#: key is not in ``DERIVED_METADATA_KEYS``.
GLOBAL_CROSS_FILTER_KEY = "global_chart_configuration"
WHOLE_DASHBOARD_ROOT = "ROOT_ID"


def _is_the_whole_dashboard_scope(value: Any) -> bool:
    """Whether this global cross-filter config only restates the default."""
    config = _parsed(value)
    if not isinstance(config, dict) or set(config) - {"scope", "chartsInScope"}:
        return False
    scope = _parsed(config.get("scope"))
    if not isinstance(scope, dict) or set(scope) - {"rootPath", "excluded"}:
        return False
    return (
        [str(step) for step in scope.get("rootPath") or []] == [WHOLE_DASHBOARD_ROOT]
        and not scope.get("excluded")
    )


def _says_what_absence_already_says(key: str, value: Any) -> bool:
    """Whether stating *key* as *value* adds nothing to not stating it.

    Asked only of a key the stored metadata does not have.
    """
    if key == GLOBAL_CROSS_FILTER_KEY:
        return _is_the_whole_dashboard_scope(value)
    if key not in SEEDED_METADATA_DEFAULTS:
        return False
    seeded = SEEDED_METADATA_DEFAULTS[key]
    return type(value) is type(seeded) and value == seeded


def keys_the_editor_filled_in(current: Any, proposed: Any) -> frozenset[str]:
    """Keys a save writes down for the first time without saying anything.

    The gate has always ignored these: edit mode posts the whole metadata
    shape (``cleanedData.metadata`` in ``dashboardState.ts``), so a
    dashboard stored before that shape existed comes back carrying ten
    keys it never had, every one at its own default. Stating
    ``refresh_frequency: 0`` on a dashboard that has no refresh frequency
    is the shape being filled in, not an edit.

    ``_metadata_differs`` knew that and stayed quiet, so the save was
    correctly folded and the dashboard was not locked. The reviewer's panel
    did not, and listed all ten under ``json_metadata`` on the first save of
    any older dashboard -- the gate right, the display wrong, which is R5-01
    as it was re-filed and the "dozens of internal settings" half of
    129075.

    So both now ask the same function. Only a key the stored metadata does
    not have at all, and only the exact default: a dashboard that holds
    ``refresh_frequency: 300`` and is sent ``0`` has had its refresh turned
    off, and that is still a change.
    """
    before, after = _parsed(current), _parsed(proposed)
    if not isinstance(before, dict) or not isinstance(after, dict):
        return frozenset()
    return frozenset(
        key
        for key in set(after) - set(before)
        # The raw value, as ``_metadata_differs`` asks it. Parsing first
        # would turn ``default_filters``' ``"{}"`` into a dict and lose the
        # type match the predicate makes.
        if _says_what_absence_already_says(key, after.get(key))
    )


#: Entries that hold a collection of ids rather than an ordered list.
#:
#: Superset recomputes a dashboard's cross-filter scopes from its layout on
#: every read, and the recomputation answers with the same chart ids in a
#: different order. Compared literally, a save that moved only the title
#: came back with ``chart_configuration`` and ``global_chart_configuration``
#: differing, so the gate captured a change the author had not made and the
#: reviewer's panel named keys they had never touched (R5-01).
#:
#: Sorting them rather than dropping them is the whole point. A cross-filter
#: scope is reviewable (Visa Q3), so a chart genuinely entering or leaving
#: one still has to read as a change; adding these to
#: ``DERIVED_METADATA_KEYS`` would have bought the same quiet by making that
#: edit invisible. Only the order stops counting.
UNORDERED_ID_LISTS = frozenset(
    {"chartsInScope", "excluded", "timed_refresh_immune_slices"}
)


def _sorted_ids(items: list[Any]) -> list[Any]:
    """Sorted by a key that cannot raise on a mixed or sparse list."""
    return sorted(items, key=lambda item: (item is None, str(item)))


def _in_a_fixed_order(value: Any) -> Any:
    """``value`` with its id collections sorted and the rest left alone."""
    if isinstance(value, dict):
        return {
            key: (
                _sorted_ids(item)
                if key in UNORDERED_ID_LISTS and isinstance(item, list)
                else _in_a_fixed_order(item)
            )
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_in_a_fixed_order(item) for item in value]
    return value


def _parsed(value: Any) -> Any:
    """A JSON string as its data, so ordering and spacing do not count.

    Order stops counting inside ``UNORDERED_ID_LISTS`` as well, which is
    what this docstring already promised and did not deliver.
    """
    if isinstance(value, (dict, list)):
        return _in_a_fixed_order(value)
    if value is None:
        return value
    # A UUID and its own string are one value written two ways: the stored
    # payload carries the string, the live row the object. Compared as
    # they arrive they differ, which is how an untouched column read as
    # edited -- see ``IDENTITY_FIELDS``.
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            return _in_a_fixed_order(json.loads(text))
        except (ValueError, TypeError):
            return value
    return value


def _field_value(item: Any, field: str) -> Any:
    return item.get(field) if isinstance(item, dict) else getattr(item, field, None)


def _by_name(items: Any, key: str) -> dict[Any, Any]:
    if not isinstance(items, (list, tuple)):
        return {}
    return {_field_value(item, key): item for item in items}


def _named_list_differs(current: Any, proposed: Any, key: str) -> bool:
    """Whether a list of named things differs, ignoring order.

    A payload's items are dicts from the request body; the live asset's are
    ORM rows. Comparing them whole would call every save a change, so only
    the fields the payload actually carries are compared, per name.
    """
    before, after = _by_name(current, key), _by_name(proposed, key)
    if set(before) != set(after):
        return True
    for name, after_item in after.items():
        before_item = before[name]
        if not isinstance(after_item, dict):
            if after_item != before_item:
                return True
            continue
        for field, value in after_item.items():
            if field in IGNORED_FIELDS or field in IDENTITY_FIELDS:
                continue
            was = _field_value(before_item, field)
            if _is_nothing(value) and _is_nothing(was):
                continue
            if _parsed(value) != _parsed(was):
                return True
    return False


def _is_nothing(value: Any) -> bool:
    """Whether this value says the field holds nothing at all.

    A column that was never given an ``extra`` blob holds NULL, while the
    dataset editor posts every column back with ``extra`` set to the string
    ``"{}"``. Read literally those differ, so *every* dataset save reported
    every column and every metric as changed: a save that edited nothing was
    refused as a governed change, certifying a dataset was never exempt
    because the echo dragged columns and metrics along with it, and a
    reviewer's "What changed" always led with columns and metrics whatever
    the author had actually edited (R4-06).

    They are the same statement, so they are compared as one. Only when
    *both* sides are empty: emptying a field that held something is a real
    change and still reads as one.
    """
    if value is None:
        return True
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return True
        parsed = _parsed(text)
        return isinstance(parsed, (dict, list)) and not parsed
    if isinstance(value, (dict, list, tuple, set)):
        return not value
    return False


def _unset_boolean(current: Any, proposed: Any) -> bool:
    """Whether this is a never-written boolean column being told it is false.

    A ``Boolean`` column whose row predates it holds NULL, and every reader
    in Superset treats that as false. The dataset schema declares
    ``load_default=False``, so a PUT carries ``always_filter_main_dttm:
    false`` whether or not the author touched it -- and against a NULL that
    read as a real change, so a dataset save that altered only exempt
    fields was held for review, on an asset that may have no second editor
    to release it (QA-25).
    """
    one_missing = (current is None) != (proposed is None)
    return one_missing and isinstance(current if proposed is None else proposed, bool)


def _differs(current: Any, proposed: Any, field: str) -> bool:
    if _is_nothing(current) and _is_nothing(proposed):
        # Two ways of saying the field is empty, not an edit to it.
        return False
    if _unset_boolean(current, proposed):
        return bool(current) != bool(proposed)
    if field in JSON_FIELDS:
        return _parsed(current) != _parsed(proposed)
    if field in NAMED_LIST_FIELDS:
        return _named_list_differs(current, proposed, NAMED_LIST_FIELDS[field])
    if isinstance(proposed, (list, tuple)) and isinstance(current, (list, tuple)):
        # Relationship lists (owners, editors, tags) arrive as ids and are
        # held as rows; compare the ids either side carries.
        def ids(items: Any) -> set[Any]:
            return {
                item if isinstance(item, int) else _field_value(item, "id")
                for item in items
            }

        return ids(current) != ids(proposed)
    return current != proposed


def _metadata_differs(asset: Any, current: Any, proposed: Any) -> bool:
    """Whether a dashboard's ``json_metadata`` really moved.

    A dashboard save posts more than the author edited: the derived
    label-colour maps, and the layout, which the stored metadata does not
    carry. Compared as one blob every save read as a change, so a save that
    altered nothing still created a request and locked the dashboard, a
    reviewer's "What changed" named ``json_metadata`` whatever the author
    had really done, and a save that put a field back to its live value
    could never be recognised as the revert it was.

    Entry by entry instead, against the place the asset actually keeps each
    one. Everything the author can set is still compared, so a real edit to
    any of it still reads as a change.
    """
    before, after = _parsed(current), _parsed(proposed)
    if not isinstance(before, dict) or not isinstance(after, dict):
        return before != after
    for key in (set(before) | set(after)) - DERIVED_METADATA_KEYS:
        was = before.get(key)
        if key == LAYOUT_KEY and key not in before:
            was = getattr(asset, LAYOUT_COLUMN, None)
        now = after.get(key)
        if _is_nothing(was) and _is_nothing(now):
            continue
        if key == LAYOUT_KEY:
            # Component by component, so a client that does not echo the
            # entries the write assigns itself is not read as having moved
            # the layout. The same comparison the "put back" sentence makes.
            if not _same_layout(now, was):
                return True
            continue
        if key not in before and _says_what_absence_already_says(key, now):
            # Stating this adds nothing to the metadata not having it. See
            # ``SEEDED_METADATA_DEFAULTS``.
            continue
        if _parsed(was) != _parsed(now):
            return True
    return False


def changed_fields(asset: Any, payload: dict[str, Any]) -> list[str]:
    """The payload's fields that differ from what is live, in order.

    An asset that cannot be read answers "every field the payload carries",
    because refusing to guess is safer than reporting no change and letting
    a write past the gate.
    """
    if asset is None:
        return sorted(k for k in payload if k not in IGNORED_FIELDS)
    changed = []
    for field, proposed in payload.items():
        if field in IGNORED_FIELDS:
            continue
        if not hasattr(asset, field):
            # Not a column of the live asset (a command argument that rode
            # in on the body). It cannot be compared, so it counts.
            changed.append(field)
            continue
        try:
            moved = (
                _metadata_differs(asset, getattr(asset, field), proposed)
                if field == "json_metadata"
                else _differs(getattr(asset, field), proposed, field)
            )
            if moved:
                changed.append(field)
        except Exception:  # noqa: BLE001 -- comparison must never block a write
            logger.warning(
                "asset-approval: could not compare %r; treating it as changed",
                field,
                exc_info=True,
            )
            changed.append(field)
    return sorted(changed)


def is_empty_change(asset: Any, payload: dict[str, Any]) -> bool:
    """Whether this payload would leave the live asset exactly as it is."""
    return not changed_fields(asset, payload)


#: Changes SOW 5.2 exempts from review, because none of them alter what a
#: viewer sees: who may edit the asset, and the metadata around it.
#:
#: The editors list matters most. SOW 5.4 tells an author with no eligible
#: approver to add another editor so they can submit -- and if that edit
#: were itself captured, it would need an approver to apply, which is the
#: very thing they do not have. Gating it makes a single-editor asset
#: permanently unchangeable.
EXEMPT_FIELDS = frozenset(
    {
        "editors",
        "viewers",
        "owners",
        "tags",
        "certified_by",
        "certification_details",
        "description",
    }
)

#: Entries inside a dataset's ``extra`` blob that the exemption reaches.
#:
#: A chart and a dashboard hold certification in columns of their own, which
#: ``EXEMPT_FIELDS`` names. A dataset does not: its certification is a key
#: inside ``extra``, so the same edit arrived as a change to a governed JSON
#: column and was held for review -- on an asset that may have no second
#: editor to release it, which is the deadlock SOW 5.2 exempts it to avoid
#: (R4-06).
#:
#: Only certification. ``warning_markdown`` also lives here and does show a
#: viewer a banner, so it stays governed.
EXEMPT_EXTRA_KEYS = frozenset({"certification"})


def extra_is_only_certification(asset: Any, payload: dict[str, Any]) -> bool:
    """Whether the only thing this payload moves inside ``extra`` is the badge.

    False when ``extra`` is absent, unreadable as an object either side, or
    carries anything else -- the exemption has to be certain, and an
    unparseable blob is not.
    """
    if "extra" not in payload:
        return False
    # A dataset that was never certified holds no ``extra`` at all, and the
    # first certification is exactly the edit this exempts; an absent blob
    # therefore reads as an empty one rather than as incomparable.
    before = _parsed(getattr(asset, "extra", None)) or {}
    after = _parsed(payload.get("extra")) or {}
    if not isinstance(before, dict) or not isinstance(after, dict):
        return False
    moved = {
        key
        for key in set(before) | set(after)
        if _parsed(before.get(key)) != _parsed(after.get(key))
    }
    return bool(moved) and moved <= EXEMPT_EXTRA_KEYS


#: The one column field "Sync columns from source" can move. Everything else
#: in a column is authored, so a save that moves any of it is a change
#: whatever the source says.
RESYNCABLE_COLUMN_FIELD = "type"


def columns_only_resynced(asset: Any, payload: dict[str, Any]) -> bool:
    """Whether the column changes only restate what the source table says.

    "Sync columns from source" in the dataset editor does not write. It reads
    the source's columns into the open dialog, and the author's Save then
    carries them like any other edit, through the ordinary governed PUT. The
    dedicated refresh endpoint is already exempt -- SOW 5.2: it does not
    author a change, it re-reads what the database already says -- and this
    is the same act performed through the dialog, so it is exempt on the same
    grounds (S-04).

    Narrow on purpose, and the narrowness is what makes it safe. The column
    set has to be unchanged, every field other than ``type`` has to match
    what is stored, at least one type has to have moved, and every moved type
    has to be the type the source itself reports. A column added or dropped,
    a verbose name, a flag, a metric: all authored, all still governed, and
    in all of those the source is never consulted at all.

    Fails closed. A source that cannot be read answers "not a resync", so an
    unreachable database makes saves governed rather than exempt.
    """
    proposed = payload.get("columns")
    if not isinstance(proposed, (list, tuple)):
        return False

    before = _by_name(getattr(asset, "columns", None), "column_name")
    after = _by_name(proposed, "column_name")
    if not after or set(before) != set(after):
        return False

    resynced = _types_that_moved_alone(before, after)
    if not resynced:
        # Nothing moved that this exemption covers, so there is nothing for
        # it to say. Asking the source here would be a query for no reason.
        return False
    return _types_match_the_source(asset, resynced)


def _types_that_moved_alone(
    before: dict[Any, Any], after: dict[Any, Any]
) -> dict[Any, Any] | None:
    """The proposed types that moved, or None if anything else moved too."""
    resynced: dict[Any, Any] = {}
    for name, item in after.items():
        if not isinstance(item, dict):
            return None
        stored = before[name]
        for field, value in item.items():
            if field in IGNORED_FIELDS or field in IDENTITY_FIELDS:
                continue
            was = _field_value(stored, field)
            if field == RESYNCABLE_COLUMN_FIELD:
                if _parsed(value) != _parsed(was):
                    resynced[name] = value
            elif not (_is_nothing(value) and _is_nothing(was)) and _parsed(
                value
            ) != _parsed(was):
                return None
    return resynced


def _normalised_type(value: Any) -> str:
    return str(value or "").strip().upper()


def _types_match_the_source(asset: Any, resynced: dict[Any, Any]) -> bool:
    """Whether each moved type is the one the source reports for that column."""
    try:
        source = {
            column.get("name"): column.get("type")
            for column in asset.external_metadata()
            if isinstance(column, dict)
        }
    except Exception:  # pylint: disable=broad-except
        logger.warning(
            "could not read the source's columns for %r, so the save is "
            "treated as authored rather than a resync",
            getattr(asset, "table_name", asset),
            exc_info=True,
        )
        return False
    return all(
        name in source and _normalised_type(value) == _normalised_type(source[name])
        for name, value in resynced.items()
    )


#: The shape the dashboard's native-filter and chart-customization
#: endpoints post: a diff against the stored configuration rather than the
#: configuration itself.
CONFIG_DIFF_KEYS = frozenset({"modified", "deleted", "reordered"})


def config_diff_changes_nothing(
    current: Any, diff: dict[str, Any], *, metadata_key: str
) -> bool:
    """Whether applying this diff would leave the configuration as it is.

    Opening the filter modal and pressing Save posts every filter back as
    "modified" whether or not any of them was touched, so a save that
    altered nothing still created a request and locked the dashboard --
    the same cost 129076 removed for full-state bodies, still being paid
    on the diff ones because a diff cannot be compared with the asset
    field by field (R4-08).

    Deliberately not a re-implementation of the DAO's merge: it answers the
    narrower question of whether any entry in the diff asks for something
    the stored configuration does not already say. Anything it cannot read
    counts as a change, because a gate is only allowed to be wrong in the
    direction of capturing too much.
    """
    if not isinstance(diff, dict) or not set(diff) <= CONFIG_DIFF_KEYS:
        return False
    stored = _stored_config(current, metadata_key)
    if stored is None:
        return False
    by_id = {item.get("id"): item for item in stored if isinstance(item, dict)}

    if any(item_id in by_id for item_id in diff.get("deleted") or []):
        return False
    if not _modifications_already_hold(diff.get("modified") or [], by_id):
        return False

    order = diff.get("reordered") or []
    return not order or list(order) == [item.get("id") for item in stored]


def _stored_config(current: Any, metadata_key: str) -> list[Any] | None:
    """The configuration list a diff describes, or None if unreadable."""
    metadata = _parsed(current)
    if not isinstance(metadata, dict):
        return None
    stored = metadata.get(metadata_key) or []
    return stored if isinstance(stored, list) else None


def _modifications_already_hold(
    modified: Any, by_id: dict[Any, Any]
) -> bool:
    """Whether writing every proposed entry would leave the stored ones as is.

    The DAO does not merge a modified entry into the stored one: it puts the
    proposed entry in the stored one's place. So an entry only holds when
    the two agree on every key *either* carries. Looking only at the keys
    the proposal brought let an entry that carried nothing but its ``id``
    pass as a no-op while the DAO went on to reduce the stored filter to
    ``{"id": ...}`` -- a write the gate had waved through (B5). What the
    gate captures has to cover everything the apply will write.

    A key set to nothing and a key left out still read as the same thing,
    as ``_differs`` reads them, so a modal that drops an empty field is not
    an edit.
    """
    for proposed in modified:
        if not isinstance(proposed, dict):
            return False
        live = by_id.get(proposed.get("id"))
        if not isinstance(live, dict):
            # An entry the stored configuration has never seen.
            return False
        for field in proposed.keys() | live.keys():
            if _parsed(proposed.get(field)) != _parsed(live.get(field)):
                return False
    return True


def changed_keys_by_kind(current: Any, proposed: Any) -> dict[str, list[str]]:
    """Which top-level entries the author moved, and which the save added.

    ``changed_keys`` answers "which entries differ", and on a chart's
    ``params`` that is nearly all of them. Explore posts every control's
    current value, so ticking one checkbox arrives carrying 76 keys the
    stored blob never held, almost all of them the control's own default.
    The reviewer was told "78 changes" and shown three names taken in
    alphabetical order, none of which the author had touched. That is
    QA-15 on the chart surface, where its dashboard fix never reached: a
    checker shown noise instead of the change cannot check anything.

    The split is a ranking, not a filter. Everything is still reported, so
    a key that is genuinely new is never hidden; the panel can simply lead
    with what moved and count what was merely written down for the first
    time.

    Returns empty lists when the shapes are not comparable as objects,
    which is what ``changed_keys`` does and for the same reason.
    """
    before, after = _parsed(current), _parsed(proposed)
    empty: dict[str, list[str]] = {"moved": [], "added": [], "removed": []}
    if not isinstance(before, dict) or not isinstance(after, dict):
        return empty
    moved, added, removed = [], [], []
    for key in set(before) | set(after):
        was, now = _parsed(before.get(key)), _parsed(after.get(key))
        if was == now:
            continue
        if key not in before:
            added.append(key)
        elif key not in after:
            removed.append(key)
        else:
            moved.append(key)
    return {
        "moved": sorted(moved),
        "added": sorted(added),
        "removed": sorted(removed),
    }


def changed_keys(current: Any, proposed: Any) -> list[str]:
    """Which top-level entries differ between two JSON blobs.

    A chart's `params` and a dashboard's `json_metadata` are single columns
    holding dozens of settings, so a reviewer was told only that the column
    had "Changed" (129075). Naming the entries that moved turns that into
    something a person can decide about: the author renamed the chart, or
    swapped a metric, or changed a filter.

    Returns an empty list when the shapes are not comparable as objects --
    the caller falls back to saying the field changed, which is what it
    used to say anyway.
    """
    before, after = _parsed(current), _parsed(proposed)
    if not isinstance(before, dict) or not isinstance(after, dict):
        return []
    return sorted(
        key
        for key in set(before) | set(after)
        if _parsed(before.get(key)) != _parsed(after.get(key))
    )


#: The nodes every v2 layout carries, whatever is on the dashboard.
#:
#: Superset builds a layout as four structural entries plus one per thing the
#: author put on it: a version marker, and the root, grid and header the
#: editor hangs everything from (``superset-frontend/src/dashboard/util/
#: constants.ts``). They are not settings and nobody chooses them.
LAYOUT_SCAFFOLDING = frozenset(
    {"DASHBOARD_VERSION_KEY", "ROOT_ID", "GRID_ID", "HEADER_ID"}
)


def scaffolding_being_laid_down(current: Any, proposed: Any) -> frozenset[str]:
    """Structural nodes arriving because the layout did not exist yet.

    A dashboard stored without a layout is compared against ``{}`` -- empty
    against an object is an object written for the first time, which is right
    for every other blob and makes the four scaffolding nodes read as four
    things the author added. "Dashboard layout: 4 added" on a save that only
    changed the title, which is R5-01's other half, on the path the
    ``json_metadata`` fix could not reach: ``layout_summary`` counts
    generated element ids and so has no defaults table to consult.

    Only while the stored layout holds nothing of the author's. Once a
    dashboard has real content, the four are present on both sides, so a
    root-level restructure lands in ``moved`` and is reported as it always
    was -- and if one of them is somehow absent and arrives, that is a
    layout being repaired under a dashboard that has one, which a reviewer
    should see. Suppressing them unconditionally would hide exactly that.
    """
    before, after = _parsed(current), _parsed(proposed)
    if not isinstance(after, dict):
        return frozenset()
    stored = before if isinstance(before, dict) else {}
    if set(stored) - LAYOUT_SCAFFOLDING:
        return frozenset()
    return frozenset(LAYOUT_SCAFFOLDING & (set(after) - set(stored)))


def layout_summary(current: Any, proposed: Any) -> dict[str, int] | None:
    """How a dashboard's layout moved, in counts rather than ids.

    `position_json` keys are generated element ids, so listing them tells a
    reviewer nothing. How many things arrived, left or shifted does.

    The scaffolding a first layout brings with it is not counted; see
    ``scaffolding_being_laid_down``. A dashboard whose layout is only being
    created, with nothing on it yet, therefore reports no layout change at
    all rather than four.
    """
    before, after = _parsed(current), _parsed(proposed)
    if not isinstance(before, dict) or not isinstance(after, dict):
        return None
    added = set(after) - set(before) - scaffolding_being_laid_down(before, after)
    removed = set(before) - set(after)
    moved = {
        key
        for key in set(before) & set(after)
        if _parsed(before.get(key)) != _parsed(after.get(key))
    }
    if not (added or removed or moved):
        return None
    return {"added": len(added), "removed": len(removed), "changed": len(moved)}


def baseline_of(asset: Any, payload: dict[str, Any]) -> dict[str, Any]:
    """What the asset holds, right now, in the fields this payload reviews.

    Recorded with the capture so an approval can tell whether the asset
    moved while the request waited. Only the reviewed fields: an exempt
    change applied during the review is allowed to coexist with it, and
    measuring those too would refuse the very edit SOW 5.4 tells an author
    to make in order to get their change approved.

    Values are stored as JSON, so each is reduced to something that
    survives the round trip -- a relationship list becomes its ids, and a
    column Superset keeps as a JSON string is parsed, both so the
    comparison at approval time is by meaning rather than by spelling.
    """
    if asset is None:
        return {}
    baseline: dict[str, Any] = {}
    for field in payload:
        if field in IGNORED_FIELDS or field in EXEMPT_FIELDS:
            continue
        if not hasattr(asset, field):
            continue
        try:
            baseline[field] = _comparable(getattr(asset, field), field)
        except Exception:  # noqa: BLE001 -- a baseline must never block a write
            logger.warning(
                "asset-approval: could not record a baseline for %r", field
            )
    return baseline


def _blob_without(
    value: Any, ignored: frozenset[str], *, absent_is_empty: bool = False
) -> Any:
    """A JSON column parsed, with some of its entries left out.

    Anything that is not an object comes back as it parsed, so an
    unreadable blob is still compared rather than quietly becoming empty.
    """
    parsed = _parsed(value)
    if absent_is_empty:
        parsed = parsed or {}
    if isinstance(parsed, dict):
        return {k: v for k, v in parsed.items() if k not in ignored}
    return parsed


def _comparable(value: Any, field: str) -> Any:
    """One field reduced to the form the baseline comparison uses."""
    if field == "json_metadata":
        # Without this a background colour sync -- which the gate lets
        # through on purpose -- would move the baseline under every waiting
        # dashboard request and make it unapprovable.
        return _blob_without(value, DERIVED_METADATA_KEYS)
    if field == "extra":
        # The exempt entries are left out for the same reason
        # ``baseline_of`` skips the exempt columns: certifying the dataset
        # is allowed to happen while a request waits, and measuring it here
        # would turn that permitted edit into a stale-baseline refusal of
        # the request it coexists with.
        return _blob_without(value, EXEMPT_EXTRA_KEYS, absent_is_empty=True)
    if field in JSON_FIELDS:
        return _parsed(value)
    if field in NAMED_LIST_FIELDS:
        key = NAMED_LIST_FIELDS[field]
        return sorted(
            str(name) for name in _by_name(value, key) if name is not None
        )
    if isinstance(value, (list, tuple)):
        return sorted(
            str(item if isinstance(item, int) else _field_value(item, "id"))
            for item in value
        )
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


#: The one JSON column whose *entries* are named rather than the column.
#: A chart's ``params`` is dozens of settings in one field, so telling an
#: author that "params" was put back says nothing they can act on.
KEYED_BLOB_FIELD = "params"


def _says_the_same(one: Any, other: Any) -> bool:
    """Whether two values inside a JSON blob say the same thing.

    The same two spellings of empty ``changed_fields`` reconciles: a key the
    draft dropped and a key the body sets to ``""`` are one statement, and
    reading them as different would report a revert nobody made.
    """
    if _is_nothing(one) and _is_nothing(other):
        return True
    return _parsed(one) == _parsed(other)


def _keys_put_back(current: Any, drafted: Any, proposed: Any) -> list[str]:
    """Entries inside one JSON blob that the draft moved and this body undid.

    Anything not readable as an object either side answers nothing: the
    sentence this feeds is a heuristic that must never be wrong in the
    direction of accusing a save of losing work it did not touch.
    """
    live, draft, body = _parsed(current), _parsed(drafted), _parsed(proposed)
    if not all(isinstance(blob, dict) for blob in (live, draft, body)):
        return []
    return [
        key
        for key, was_drafted in draft.items()
        # A key the body says nothing about is one this save left alone; the
        # fold keeps the draft's value and nothing was put back.
        if key in body
        and not _says_the_same(was_drafted, live.get(key))
        and _says_the_same(body[key], live.get(key))
        and not _says_the_same(body[key], was_drafted)
    ]


def reverted_fields(
    asset: Any, draft: dict[str, Any], body: dict[str, Any]
) -> list[str]:
    """Settings the draft had moved off live that this body puts back.

    The tripwire behind the "put back" sentence. An editing surface that
    starts from the live asset rather than from the author's open proposal
    writes the live value back for every field it posts, so a second save
    from such a surface silently undoes the first one. This is how a save
    says that happened, and it is measured on the server so that a REST
    client which never saw a dialog is told as well. (The MCP tool result
    does not carry it yet; see ``http.PUT_BACK_ONE_MESSAGE`` for why.)

    Deliberately a heuristic, and deliberately non-blocking. It cannot tell
    a revert the author meant from an edit made on a stale view, so the
    wording it feeds says what happened and does not accuse. A false 409
    would refuse the author the one way they have of undoing part of a
    draft.

    ``params`` is reported by its entries rather than by its name: a chart's
    whole control set lives in that one field, so "params" alone is not
    something an author can check.

    Anything unreadable answers nothing. Saying less than the truth is
    survivable here; naming a setting the save did not touch is not.
    """
    if asset is None:
        return []
    put_back: list[str] = []
    for field, proposed in body.items():
        if field in IGNORED_FIELDS or field not in draft:
            continue
        if not hasattr(asset, field):
            continue
        if field == LAYOUT_COLUMN:
            # Read below with ``json_metadata.positions``, as one layout. The
            # column's name is not something a person recognises.
            continue
        try:
            live = getattr(asset, field)
            drafted = draft[field]
            if field == KEYED_BLOB_FIELD:
                put_back.extend(_keys_put_back(live, drafted, proposed))
                continue
            if field == "json_metadata":
                # The layout rides inside the metadata on a dashboard save and
                # is judged on its own below; left in, it made every
                # layout-bearing save look unlike live and hid a revert of
                # the metadata's other settings.
                live, drafted, proposed = (
                    _without_layout(value) for value in (live, drafted, proposed)
                )
            if (
                _differs(live, drafted, field)
                and not _differs(live, proposed, field)
                and _differs(drafted, proposed, field)
            ):
                put_back.append(field)
        except Exception:  # noqa: BLE001 -- a diagnostic must never block a write
            logger.warning(
                "asset-approval: could not tell whether %r was put back", field
            )
    try:
        put_back.extend(layout_put_back(asset, draft, body))
    except Exception:  # noqa: BLE001 -- a diagnostic must never block a write
        logger.warning(
            "asset-approval: could not tell whether the layout was put back",
            exc_info=True,
        )
    return sorted(set(put_back))


#: Marks an entry of ``reverted_fields`` as a layout component rather than a
#: field. The list is data to clients and must stay a list of strings; the
#: marker is how the sentence tells "chart: Revenue (removed)" from
#: ``dashboard_title`` without a second list.
LAYOUT_PUT_BACK_PREFIX = "layout: "

_NOT_THERE = object()


def _without_layout(metadata: Any) -> Any:
    """A ``json_metadata`` value with the layout taken out of it.

    Anything that is not an object is returned as it came, so a field that is
    not metadata the layout rides in is compared exactly as before.
    """
    parsed = _parsed(metadata)
    if not isinstance(parsed, dict) or LAYOUT_KEY not in parsed:
        return metadata
    return {key: value for key, value in parsed.items() if key != LAYOUT_KEY}


def _layout_object(value: Any) -> dict[str, Any] | None:
    parsed = _parsed(value)
    return parsed if isinstance(parsed, dict) and parsed else None


def _layout_stated_by(body: dict[str, Any]) -> dict[str, Any] | None:
    """The layout a dashboard body states, the way the update command reads it.

    ``json_metadata.positions`` wins when it is there and not null, and the
    raw ``position_json`` is only read otherwise: the update command
    reconciles the first and overwrites the column from it. ``None`` when the
    body says nothing about the layout, which is not the same as saying the
    layout is empty.
    """
    metadata = _parsed(body.get("json_metadata"))
    if isinstance(metadata, dict) and metadata.get(LAYOUT_KEY) is not None:
        return _layout_object(metadata[LAYOUT_KEY])
    return _layout_object(body.get(LAYOUT_COLUMN))


#: The entry on a ``CHART`` layout node that the write assigns for itself.
#:
#: ``DashboardDAO.set_dash_metadata`` (``superset/daos/dashboard.py``) ends
#: every layout-bearing save with
#:
#:     for obj in positions.values():
#:         if (chart_id := _layout_chart_id(obj)) is not None:
#:             obj["meta"]["uuid"] = uuid_map.get(chart_id)
#:
#: so the stored ``meta.uuid`` is the uuid of whichever ``Slice`` the node's
#: ``chartId`` resolves to, whatever the body said about it -- and the same
#: loop canonicalises ``meta.chartId`` to the integer
#: ``_layout_chart_id`` read out of it.
#:
#: It is therefore not compared as stated. :func:`_as_stored_component`
#: resolves it instead, which is the whole point: the author's browser
#: happens to echo the uuid back, a REST or MCP client building the same
#: layout by hand has no reason to, and both store the identical node. Read
#: literally, every such body looked unlike live on every chart, so a
#: restored chart was not counted as restored and its name never reached the
#: sentence -- while the revert itself still happened.
SERVER_ASSIGNED_CHART_META = "uuid"


def _chart_reference(node: Any) -> int | None:
    """The chart a layout node points at, read the way the write reads it.

    Mirrors ``superset.daos.dashboard._layout_chart_id``: only a ``CHART``
    node carries a chart, and a numeric *form* of the id counts as the id,
    because that is the value the save canonicalises the node to. ``None``
    for anything else, so a row, a tab or a malformed node is compared
    exactly as it was before.
    """
    if not isinstance(node, dict) or node.get("type") != "CHART":
        return None
    meta = node.get("meta")
    if not isinstance(meta, dict):
        return None
    value = meta.get("chartId")
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value) if value.is_integer() else None
    if isinstance(value, str) and value.strip().lstrip("-").isdigit():
        return int(value.strip())
    return None


def _as_stored_component(node: Any, live: Any) -> Any:
    """One layout component as this save is going to store it.

    Only the entries the write assigns are resolved, and only when the two
    nodes point at the same chart -- at which point their stored uuids are
    equal *by construction*, because both are ``uuid_map[chartId]``. So this
    predicts the stored value rather than dropping a field: a node pointing
    at a *different* chart keeps its own ``chartId``, differs on it, and is
    not a component that was put back.

    Everything else is left exactly as stated. A node edited to a third
    value -- a resize, a rename, a background -- still differs from live,
    which is the one thing this comparison must not lose.
    """
    chart = _chart_reference(node)
    if chart is None or chart != _chart_reference(live):
        return node
    meta = {**node["meta"], "chartId": chart}
    live_meta = live.get("meta")
    if isinstance(live_meta, dict) and SERVER_ASSIGNED_CHART_META in live_meta:
        meta[SERVER_ASSIGNED_CHART_META] = live_meta[SERVER_ASSIGNED_CHART_META]
    else:
        # A layout last written through the raw ``position_json`` path has no
        # uuid on its nodes (``reconcile_position_json`` has no ``uuid_map``),
        # so an echo that carries one is stating nothing either.
        meta.pop(SERVER_ASSIGNED_CHART_META, None)
    return {**node, "meta": meta}


def _same_layout(stated: Any, live: Any) -> bool:
    """Whether a stated layout says what the live one says.

    Component by component, so the entries the write assigns itself are
    resolved per node rather than compared as part of one blob. Two layouts
    that are not both readable as objects are compared exactly as before,
    because an unreadable layout is not something to be lenient about.
    """
    one, other = _layout_object(stated), _layout_object(live)
    if one is None or other is None:
        return bool(_parsed(stated) == _parsed(live))
    if set(one) != set(other):
        return False
    return all(_same_component(one[key], other[key]) for key in one)


def _same_component(one: Any, other: Any) -> bool:
    """Whether a stated component says what the live one says.

    ``other`` is the live side on both call sites, and is what the stated
    node's server-assigned entries are resolved against.
    """
    if one is _NOT_THERE or other is _NOT_THERE:
        return one is other
    stated, live = _parsed(one), _parsed(other)
    return bool(
        _as_stored_component(stated, live) == _as_stored_component(live, live)
    )


def _layout_label(entry: dict[str, Any]) -> str:
    """One put-back component as the author would say it.

    Seen from the author's side: the comparison runs from their draft to the
    draft with these components put back, so something that comes back
    "added" is a removal their draft had made.
    """
    drafted = {"added": "removed", "removed": "added"}.get(
        entry.get("kind", ""), "moved" if entry.get("moved") else "changed"
    )
    kind = str(entry.get("type") or "component").lower()
    name = entry.get("name")
    return f"{drafted} {kind}: {name}" if name else f"{drafted} {kind}"


#: The last thing left to say when naming the components failed outright.
#:
#: Only reached when ``api``'s naming raises. It used to be the answer for
#: the ordinary case of a put-back container as well, and an author told "this
#: save undid 1 layout change: changed arrangement" has been told that
#: something went and not what, on a dashboard of forty tiles. A container
#: is named by what it holds instead (:func:`_held_by_what_came_back`).
UNNAMEABLE_LAYOUT_LABEL = "changed arrangement"


def _held_by_what_came_back(
    restored: list[str], drafted: dict[str, Any], put_back: dict[str, Any]
) -> list[str]:
    """Put-back containers, named by the components inside them.

    A row, a column and a tabs strip have no name of their own: all that
    differs on one is its list of children, and when the children themselves
    sit in the same places ``_layout_components`` has nothing to show for it.
    The charts underneath do have names, and the review panel already names
    an unnamed container that way -- ``_holding`` is the panel's own
    function, so the words the sentence uses are the words the author will
    read beside it.

    Named off ``put_back`` first, which is the live arrangement: a container
    the draft had emptied holds what live put back into it. The draft is the
    fallback for a container live does not have.
    """
    # ``api`` imports this module, so the import is local; see below.
    from asset_approval.api import _component_type, _holding

    labels = []
    for key in sorted(restored, key=str):
        node = put_back.get(key, drafted.get(key))
        entry: dict[str, Any] = {
            "kind": "changed",
            "type": _component_type(key, node),
        }
        if name := (_holding(put_back, key) or _holding(drafted, key)):
            entry["name"] = name
        labels.append(_layout_label(entry))
    return labels


def layout_put_back(
    asset: Any, draft: dict[str, Any], body: dict[str, Any]
) -> list[str]:
    """Layout components the draft had moved off live that this body puts back.

    The same question ``reverted_fields`` asks of a scalar, asked of each
    component of a dashboard's layout. The layout travels two ways -- the raw
    ``position_json`` and ``json_metadata.positions`` -- and either may carry
    it, in the draft and in the body.

    Dashboard edit mode starts from the live dashboard, not from the author's
    draft, so its save posts the live layout whole. That is legitimate and
    says nothing by itself: a component is put back only when the draft had
    it differently from live *and* this body has it as live has it. A body
    that carries the whole layout but changes nothing the draft had changed
    answers nothing, and so does a draft that never touched the layout.

    Each entry is ``"layout: removed chart: Revenue"`` -- what the draft had
    done to that component, named the way the review panel names it. Entries
    that read identically are collapsed with a count ("removed row x2").
    """
    if not hasattr(asset, LAYOUT_COLUMN):
        return []
    live = _layout_object(getattr(asset, LAYOUT_COLUMN, None))
    drafted, stated = _layout_stated_by(draft), _layout_stated_by(body)
    if live is None or drafted is None or stated is None:
        return []
    restored = [
        key
        for key in set(live) | set(drafted) | set(stated)
        if not _same_component(
            drafted.get(key, _NOT_THERE), live.get(key, _NOT_THERE)
        )
        and _same_component(stated.get(key, _NOT_THERE), live.get(key, _NOT_THERE))
    ]
    if not restored:
        return []

    put_back = dict(drafted)
    for key in restored:
        if key in live:
            put_back[key] = live[key]
        else:
            put_back.pop(key, None)
    try:
        # Imported here: ``api`` imports this module. It owns how a layout
        # component is named, and a second copy of that would drift from the
        # panel the author reads it against.
        from asset_approval.api import _layout_components

        labels = [_layout_label(entry) for entry in _layout_components(drafted, put_back)]
        if not labels:
            # What came back was only containers -- a row's list of children,
            # a column's -- which carry no name of their own. The components
            # *inside* them do, so the container is named by what it holds,
            # which is what the author can go and look at.
            labels = _held_by_what_came_back(restored, drafted, put_back)
    except Exception:  # noqa: BLE001 -- naming is a courtesy; the count is not
        logger.warning("asset-approval: could not name the layout put back", exc_info=True)
        # One entry per component, so the count the sentence leads with is
        # still the number that came back even when none could be named.
        labels = [UNNAMEABLE_LAYOUT_LABEL] * len(restored)

    counts: dict[str, int] = {}
    for label in labels:
        counts[label] = counts.get(label, 0) + 1
    return [
        f"{LAYOUT_PUT_BACK_PREFIX}{label}{f' x{n}' if n > 1 else ''}"
        for label, n in sorted(counts.items())
    ]


def moved_since(asset: Any, baseline: dict[str, Any]) -> list[str]:
    """Reviewed fields whose live value no longer matches the baseline.

    An empty baseline answers "nothing moved": a request captured before
    baselines were recorded, or one carrying a diff body, is approved on
    the terms it was approved on before -- the check is an addition, not a
    retroactive refusal of work already in the queue.
    """
    if not baseline or asset is None:
        return []
    moved = []
    for field, was in baseline.items():
        try:
            now = _comparable(getattr(asset, field, None), field)
            if _is_nothing(now) and _is_nothing(was):
                # The same two spellings of empty that ``changed_fields``
                # reconciles. Without this an unrelated exempt save that
                # wrote "" where the baseline had None left the waiting
                # request unapprovable, and the refusal named a field
                # nobody had touched.
                continue
            if now != was:
                moved.append(field)
        except Exception:  # noqa: BLE001
            logger.warning(
                "asset-approval: could not compare the baseline for %r", field
            )
    return sorted(moved)
