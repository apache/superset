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

from superset.utils import json

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


def _parsed(value: Any) -> Any:
    """A JSON string as its data, so ordering and spacing do not count."""
    if isinstance(value, (dict, list)) or value is None:
        return value
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            return json.loads(text)
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
            if field in IGNORED_FIELDS or field == "id":
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
    """Whether every proposed entry says only what is already stored."""
    for proposed in modified:
        if not isinstance(proposed, dict):
            return False
        live = by_id.get(proposed.get("id"))
        if live is None:
            # An entry the stored configuration has never seen.
            return False
        for field, value in proposed.items():
            if _parsed(value) != _parsed(live.get(field)):
                return False
    return True


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


def layout_summary(current: Any, proposed: Any) -> dict[str, int] | None:
    """How a dashboard's layout moved, in counts rather than ids.

    `position_json` keys are generated element ids, so listing them tells a
    reviewer nothing. How many things arrived, left or shifted does.
    """
    before, after = _parsed(current), _parsed(proposed)
    if not isinstance(before, dict) or not isinstance(after, dict):
        return None
    added = set(after) - set(before)
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
            if _comparable(getattr(asset, field, None), field) != was:
                moved.append(field)
        except Exception:  # noqa: BLE001
            logger.warning(
                "asset-approval: could not compare the baseline for %r", field
            )
    return sorted(moved)
