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
            if _parsed(value) != _parsed(_field_value(before_item, field)):
                return True
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
            if _differs(getattr(asset, field), proposed, field):
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


def _comparable(value: Any, field: str) -> Any:
    """One field reduced to the form the baseline comparison uses."""
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
