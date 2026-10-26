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


def _differs(current: Any, proposed: Any, field: str) -> bool:
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
