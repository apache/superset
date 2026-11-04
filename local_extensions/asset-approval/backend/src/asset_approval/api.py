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
"""REST API for the review workflow.

The four list views are the ones the SOW asked for (SOW 5.6) -- awaiting my
review, my drafts, changes I submitted, recently decided -- but reached
through a ``show`` parameter rather than a new top-level menu, so the bell,
the Home tab and the Approvals page can all deep-link to the same endpoint
(Decision 7).
"""

from __future__ import annotations

import copy
import logging
from datetime import date, datetime, timedelta, timezone
from importlib import import_module
from typing import Any
from uuid import UUID

from flask import request
from flask_appbuilder.api import expose, protect, safe
from sqlalchemy import and_, or_

from superset import db
from asset_approval import lifecycle
from asset_approval.eligibility import (
    can_approve,
    eligible_approvers,
    is_strict_editor,
)
from asset_approval.exceptions import (
    AuthorNoLongerEditorError,
    ApprovalForbiddenError,
    ChangeManagementException,
    ChangeRequestNotFoundError,
    InvalidTransitionError,
    NoEligibleApproverError,
    ReplayFailedError,
    ReviewedVersionStaleError,
    ReviewNoteRequiredError,
    StaleBaselineError,
)
from asset_approval.gate import (
    captured_arguments,
    captured_exempt_fields,
    COMMAND_KEY,
    find_open_request,
    is_enabled,
    RESTORE_COMMAND,
    RESTORE_VERSION_COMMAND,
    UPSERT_EMBEDDED_COMMAND,
)
from asset_approval.install import REVIEW_COMMANDS

# ``_is_nothing`` and ``_parsed`` are the gate's own definitions of "the same
# value" and "empty". Imported, not restated: the panel went wrong once by
# keeping its own copy of the gate's comparison (R5-01).
from asset_approval.changes import (
    _is_nothing,
    _parsed,
    DERIVED_METADATA_KEYS,
    EXEMPT_FIELDS,
    changed_fields,
    changed_keys_by_kind,
    IDENTITY_FIELDS,
    IGNORED_FIELDS,
    LAYOUT_COLUMN,
    LAYOUT_KEY,
    layout_summary,
)
from asset_approval.models import ChangeRequest
from asset_approval.replay import is_restore, load_asset
from asset_approval.types import (
    AssetType,
    ChangeStatus,
    OPEN_STATUSES,
    Operation,
)
from superset.superset_typing import FlaskResponse
from superset.utils import json
from superset.utils.core import get_user_id
from superset.views.base_api import BaseSupersetApi, statsd_metrics

logger = logging.getLogger(__name__)

#: Activity older than this is not shown (Decision 8: a native 30-day
#: changelog, not an unbounded feed).
#: How long after a decision the author is still told about it on the asset.
#:
#: Long enough to span a lunch or a meeting, short enough that it reads as
#: "this just happened" rather than as a record. The record is version
#: history; Visa keeps no review history of its own (Q7).
RECENTLY_DECIDED = timedelta(hours=12)

ACTIVITY_WINDOW_DAYS = 30


def _user_brief(user: Any) -> dict[str, Any] | None:
    if user is None:
        return None
    return {
        "id": user.id,
        "username": getattr(user, "username", None),
        "first_name": getattr(user, "first_name", None),
        "last_name": getattr(user, "last_name", None),
    }


def _asset_title(asset: Any) -> str | None:
    for attr in ("dashboard_title", "slice_name", "table_name"):
        if (value := getattr(asset, attr, None)) is not None:
            return value
    return None


#: How a changed field is shown is decided by the *value*, never by the
#: field's name.
#:
#: This used to be a list of names (``OPAQUE_FIELDS``) beside a whitelist of
#: scalar types (``_shown``) and a whitelist of command names
#: (``_describe_command``). Each failed open: a field the lists did not know
#: came out as the bare word "Changed", a blank, or nothing, and the reviewer
#: approved it unseen. The gate does not work that way -- ``changed_fields``
#: walks every key in the body and counts a key it does not recognise as
#: changed -- so the information the panel needs was always there and the
#: panel kept re-deriving it, narrower, from lists of its own.
#:
#: Now the gate says *which* fields changed and this module says *how* each
#: one changed, from its before and after values alone:
#:
#: * a JSON object (``params``, ``json_metadata``, ``css``-as-object, anything
#:   new) is compared key by key and nested objects are walked, so what is
#:   listed is the setting that moved with its two values;
#: * a collection (``viewers``, ``dashboards``, ``tags``) is compared as a set
#:   and named, with what joined and what left;
#: * everything else is a before and an after.
#:
#: Special rendering -- a theme by name, which chart moved, a filter removed
#: against a filter added -- is an *enrichment* layered on that default
#: (``_ENRICHERS``, the layout and config-diff helpers). If an enrichment does
#: not apply or fails, the default is what the reviewer gets, which still
#: carries both values.
#:
#: Nothing here is hidden for secrecy. ``serialize`` already returns the raw
#: request body as ``proposed`` to anyone entitled to see the change, so the
#: limits below are about the reviewer's reading, not about what may be
#: disclosed: a value is cut to a readable length *and said to be cut*.

#: There is no limit on how many entries one changed field lists.
#:
#: There used to be one (25), with the rest reported as a count. A count is
#: not content: a reviewer told "and 7 more" is approving seven things they
#: were not shown (sc-129075: "'and 3 more' hides changes"). The entries are
#: derived from the request body, which ``serialize`` already returns whole as
#: ``proposed``, and each value in them is cut to ``ENTRY_VALUE_LIMIT``, so
#: listing all of them costs the payload no more than the body already does.
#: The panel decides how much to show at once; it never decides what exists.

#: How much of one value inside a structured field is shown.
ENTRY_VALUE_LIMIT = 300

#: How many levels of nested objects are walked before a value is shown whole.
MAX_BLOB_DEPTH = 4

#: Characters of unchanged text kept before the first difference when a long
#: text value has to be cut, so the edit is in the window and not past it.
CONTEXT_BEFORE_CHANGE = 200

_MISSING = object()

#: Attributes that name a thing, in the order they are preferred. A guess at
#: how to label an unknown object; an object with none of them is labelled by
#: its id, which is still a label.
_LABEL_ATTRS = (
    "label",
    "dashboard_title",
    "slice_name",
    "table_name",
    "theme_name",
    "name",
    "username",
    "column_name",
    "metric_name",
    "title",
)

def _same(current: Any, proposed: Any) -> bool:
    """Whether a submitted value is the one already stored.

    Compared leniently on purpose. Values round-trip through JSON and the
    ORM, so a stored ``None`` arrives as ``""`` and a structural field
    arrives as text whose key order may differ from the stored copy. Both
    are the same value to a reviewer, and treating them as different is
    what produced the noise this exists to remove.
    """
    if current is None and proposed in (None, "", [], {}):
        return True
    if isinstance(current, str) and isinstance(proposed, str):
        if current == proposed:
            return True
        try:
            return json.loads(current) == json.loads(proposed)
        except (ValueError, TypeError):
            return False
    if isinstance(proposed, list) and isinstance(current, list):
        # Relationship lists (editors, tags) arrive as ids; the stored side
        # is model objects. Compare by id where both sides offer one.
        def ids(items: Any) -> list[Any]:
            return [
                i.get("id") if isinstance(i, dict) else getattr(i, "id", i)
                for i in items
            ]

        return ids(current) == ids(proposed)
    return bool(current == proposed)


#: How much of a text value the side panel shows before it is shortened.
#: A dataset's SQL is a governed field the reviewer is asked to read as a
#: definition (Visa Q11), and real SQL runs to hundreds of characters, so
#: the limit has to fit one rather than cut it off.
SHOWN_VALUE_LIMIT = 2000


def _shown(value: Any) -> tuple[Any, bool]:
    """The value as the panel should show it, and whether it was shortened.

    It never answers ``None`` for a value that is actually there. It used
    to: a string over 300 characters became ``None``, and the panel renders
    that identically to a field being emptied. So a reviewer looking at a
    renamed dashboard saw the old title struck through and nothing put in
    its place, and on a dataset any realistic SQL change showed them
    nothing at all -- while the SOW asks for exactly that diff.

    Approving what you cannot see is the one thing this feature exists to
    prevent, so a value that is too long is shortened and *said* to be
    shortened, never silently dropped.
    """
    if value is None or isinstance(value, (bool, int, float)):
        return value, False
    if isinstance(value, str):
        if len(value) <= SHOWN_VALUE_LIMIT:
            return value, False
        return value[:SHOWN_VALUE_LIMIT], True
    return None, False


#: Dashboard sub-commands whose captured body is a config diff, and the
#: ``json_metadata`` entry each one rewrites.
DIFF_COMMAND_FIELDS = {
    "native_filters": "native_filter_configuration",
    "chart_customizations": "chart_customization_config",
}


def _metadata_reader(asset: Any) -> Any:
    """``field -> value`` over a dashboard's stored ``json_metadata``."""
    try:
        metadata = json.loads(getattr(asset, "json_metadata", None) or "{}")
    except (ValueError, TypeError):
        metadata = {}
    if not isinstance(metadata, dict):
        metadata = {}
    return metadata.get


# ---------------------------------------------------------------- the values


def _label_of(item: Any) -> str:
    """What to call an object in a sentence: its name if it has one, else its id.

    A guess, and a safe one. Every object ends up with *some* label, so an
    object this does not know how to name is still listed, by its id.
    """
    if isinstance(item, (dict, list, tuple)):
        if isinstance(item, dict):
            for attr in _LABEL_ATTRS:
                value = item.get(attr)
                if isinstance(value, str) and value:
                    return value
            if item.get("id") is not None:
                return str(item["id"])
        return _text_of(item)
    for attr in _LABEL_ATTRS:
        value = getattr(item, attr, None)
        if isinstance(value, str) and value:
            return value
    ident = getattr(item, "id", None)
    return str(ident) if ident is not None else str(item)


def _text_of(value: Any) -> str:
    """Any value as text a person can read. Never raises.

    ``json.dumps`` rather than ``str`` for containers, so a nested value
    reads as the JSON it was written as, and ``_label_of`` for anything JSON
    cannot hold, so a model object is its name and not its repr.
    """
    if isinstance(value, str):
        return value
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    try:
        if isinstance(value, (set, frozenset)):
            value = sorted(value, key=str)
        return json.dumps(
            value, default=_label_of, sort_keys=True, ensure_ascii=False
        )
    except Exception:  # noqa: BLE001 -- showing a value must never break the list
        return str(value)


def _clip(text: str, limit: int) -> tuple[str, bool]:
    """``text`` cut to ``limit`` characters, and whether it was."""
    return (text[:limit], True) if len(text) > limit else (text, False)


def _is_structural(value: Any) -> bool:
    """Whether a value is more than a scalar: an object, a list, a model."""
    return not (value is None or isinstance(value, (bool, int, float, str)))


def _is_collection(value: Any) -> bool:
    return isinstance(value, (list, tuple, set, frozenset))


def _render(value: Any) -> tuple[Any, bool]:
    """Any value as the panel should show it, and whether it was shortened.

    ``_shown`` answers for scalars and for nothing else: it hands back
    ``None`` for a dict, a list or a model, and a caller that took that for
    "no value" drew a bare "Changed" for every field the whitelist did not
    cover. This answers for everything. ``None`` comes back only for a
    value that really is absent (or an empty collection), which is what the
    panel draws as an em-dash.
    """
    shown, cut = _shown(value)
    if shown is not None or value is None:
        return shown, cut
    if _is_collection(value):
        if not value:
            return None, False
        items = sorted(value, key=str) if isinstance(value, (set, frozenset)) else value
        text = ", ".join(_label_of(item) for item in items)
    else:
        text = _text_of(value)
    return _clip(text, SHOWN_VALUE_LIMIT)


def _around_the_change(before: str, after: str) -> tuple[str, str, bool]:
    """Two long texts, cut to the same window around where they first differ.

    Cutting each from its start, as ``_shown`` does, is right for a value
    that is only on one side. For an edit it is wrong: change the end of a
    stylesheet or a SQL query and the first 2000 characters of "before" and
    "after" are identical, so the reviewer is shown two equal blocks and told
    they are shortened -- the edit is exactly what was cut. Both are cut from
    the same place instead, a little before the first difference.
    """
    if len(before) <= SHOWN_VALUE_LIMIT and len(after) <= SHOWN_VALUE_LIMIT:
        return before, after, False
    shared = 0
    for one, other in zip(before, after, strict=False):
        if one != other:
            break
        shared += 1
    start = max(0, shared - CONTEXT_BEFORE_CHANGE)

    def window(text: str) -> str:
        piece = text[start : start + SHOWN_VALUE_LIMIT]
        return f"…{piece}" if start else piece

    return window(before), window(after), True


def _pair(current: Any, proposed: Any) -> dict[str, Any]:
    """``before`` and ``after`` for any two values, flagged when cut."""
    if isinstance(current, str) and isinstance(proposed, str):
        before, after, cut = _around_the_change(current, proposed)
    else:
        before, before_cut = _render(current)
        after, after_cut = _render(proposed)
        cut = before_cut or after_cut
    pair: dict[str, Any] = {"before": before, "after": after}
    if cut:
        pair["truncated"] = True
    return pair


def _scalar_entry(field: str, current: Any, proposed: Any) -> dict[str, Any]:
    """The default for a field: what it was and what it would become."""
    entry: dict[str, Any] = {"field": field, **_pair(current, proposed)}
    if _is_structural(current) or _is_structural(proposed):
        entry["opaque"] = True
    return entry


def _entry_text(value: Any) -> tuple[str | None, bool]:
    """One value inside a structured field, for the entry list."""
    if value is _MISSING or value is None:
        return None, False
    return _clip(_text_of(value), ENTRY_VALUE_LIMIT)


def _entry(kind: str, key: str, was: Any = _MISSING, now: Any = _MISSING) -> dict:
    """One line of a structured field's change list."""
    before, before_cut = _entry_text(was)
    after, after_cut = _entry_text(now)
    entry: dict[str, Any] = {"kind": kind, "key": key}
    if before is not None:
        entry["before"] = before
    if after is not None:
        entry["after"] = after
    if before_cut or after_cut:
        entry["truncated"] = True
    return entry


def _capped(entry: dict[str, Any], entries: list[dict[str, Any]]) -> dict[str, Any]:
    """``entries`` on ``entry``, all of them.

    Still called ``_capped`` for the callers that were written against the
    limit it used to apply; it no longer drops or counts anything.
    """
    if entries:
        entry["entries"] = entries
    return entry


# ------------------------------------------------------ structured (JSON) values


def _structure_of(value: Any) -> dict[Any, Any] | None:
    """The JSON object a value is, or None.

    Decided by what the value *is*, not by which column it came from, so a
    JSON column nobody has met yet is compared key by key like the five this
    list used to name.
    """
    if isinstance(value, dict):
        return value
    if isinstance(value, str) and value.lstrip().startswith("{"):
        try:
            parsed = json.loads(value)
        except (ValueError, TypeError):
            return None
        return parsed if isinstance(parsed, dict) else None
    return None


def _blob_pair(current: Any, proposed: Any) -> tuple[Any, Any]:
    """Both sides parsed, an empty one standing in as ``{}`` against an object.

    A stored value that is empty parsed to ``None`` and was then compared
    with nothing, so every setting in the new object read as no change at all
    and the field fell back to a bare "Changed" -- for ``params``,
    ``json_metadata`` and ``position_json`` alike. Empty against an object is
    an object being written for the first time, and every key in it is new.
    """
    before, after = _parsed(current), _parsed(proposed)
    if isinstance(after, dict) and (before is None or before == {}):
        before = {}
    if isinstance(before, dict) and (after is None or after == {}):
        after = {}
    return before, after


def _item_name(item: Any) -> str:
    """What a configuration entry (a filter, a customization) is called."""
    if isinstance(item, dict):
        for attr in ("name", "title", "label"):
            value = item.get(attr)
            if isinstance(value, str) and value:
                return value
        if item.get("id") is not None:
            return str(item["id"])
    return _label_of(item)


def _identified(items: Any) -> dict[Any, Any] | None:
    """A list of objects keyed by their ``id``, or None if it is not one."""
    if not isinstance(items, list):
        return None
    found: dict[Any, Any] = {}
    for item in items:
        if not isinstance(item, dict) or item.get("id") is None:
            return None
        try:
            if item["id"] in found:
                return None
        except TypeError:
            return None
        found[item["id"]] = item
    return found


def _leaf_changes(path: str, was: Any, now: Any, depth: int) -> list[dict[str, Any]]:
    """The settings that differ between two values, down to a readable level.

    Objects are walked, so ``label_colors`` is the one colour that moved and
    not the word "Changed". A list of objects that each carry an ``id`` -- a
    dashboard's filters, its customizations -- is compared by id, so a filter
    removed reads differently from a filter added. Anything else is shown
    whole, cut to ``ENTRY_VALUE_LIMIT`` and said to be cut.
    """
    absent_was = was is _MISSING or _is_nothing(was)
    absent_now = now is _MISSING or _is_nothing(now)
    if absent_was and absent_now:
        return []
    if not absent_was and not absent_now and _parsed(was) == _parsed(now):
        return []

    if depth < MAX_BLOB_DEPTH:
        if (
            not absent_was
            and not absent_now
            and isinstance(was, dict)
            and isinstance(now, dict)
        ):
            found: list[dict[str, Any]] = []
            for key in sorted(set(was) | set(now), key=str):
                found.extend(
                    _leaf_changes(
                        f"{path}.{key}",
                        was.get(key, _MISSING),
                        now.get(key, _MISSING),
                        depth + 1,
                    )
                )
            if found:
                return found
        # A list of objects that each carry an id, on either side being empty
        # or not: the first filter added to a dashboard that had none is as
        # nameable as the fifth.
        by_was = _identified([] if absent_was else was)
        by_now = _identified([] if absent_now else now)
        if by_was is not None and by_now is not None:
            if found := _identified_changes(path, by_was, by_now, depth):
                return found

    kind = "added" if absent_was else "removed" if absent_now else "changed"
    return [_entry(kind, path, was, now)]


def _identified_changes(
    path: str, was: dict[Any, Any], now: dict[Any, Any], depth: int
) -> list[dict[str, Any]]:
    """Entries added, removed, edited or reordered in two lists keyed by id."""
    found: list[dict[str, Any]] = []
    for ident in [*was, *(i for i in now if i not in was)]:
        label = f"{path} · {_item_name(now.get(ident, was.get(ident)))}"
        if ident not in now:
            found.append(_entry("removed", label, was[ident]))
        elif ident not in was:
            found.append(_entry("added", label, _MISSING, now[ident]))
        else:
            found.extend(_leaf_changes(label, was[ident], now[ident], depth + 1))
    if not found and list(was) != list(now):
        found.append(
            _entry(
                "changed",
                f"{path} · order",
                ", ".join(_item_name(item) for item in was.values()),
                ", ".join(_item_name(item) for item in now.values()),
            )
        )
    return found


def _blob_entries(
    before: dict[Any, Any],
    after: dict[Any, Any],
    skip: frozenset[str] = frozenset(),
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """What differs between two objects: ``(edited, written for the first time)``.

    The split is the ranking ``changed_keys_by_kind`` has always made: an
    Explore save arrives carrying dozens of controls the stored blob never
    held, and listing those beside the one the author edited buried it. They
    are kept apart so the caller can lead with the edit and count the rest.
    """
    edited: list[dict[str, Any]] = []
    added: list[dict[str, Any]] = []
    for key in sorted(set(before) | set(after), key=str):
        if key in skip:
            continue
        found = _leaf_changes(
            str(key), before.get(key, _MISSING), after.get(key, _MISSING), 1
        )
        (edited if key in before else added).extend(found)
    return edited, added


# ------------------------------------------------------------ a dashboard layout

#: Layout components that only hold other components. Moving a chart changes
#: its row too, and naming the row would add a second line for one move.
#: Anything *not* listed here is named, so a component type nobody has met
#: is shown rather than skipped.
LAYOUT_CONTAINER_TYPES = frozenset({"ROOT", "GRID", "ROW", "COLUMN", "TABS"})


def _component_type(key: Any, component: Any) -> str:
    if isinstance(component, dict) and isinstance(component.get("type"), str):
        return component["type"]
    return str(key).split("-")[0]


def _component_name(component: Any) -> str | None:
    """What the author would call a layout component: the chart, the heading.

    A chart's ``sliceNameOverride`` is the name the dashboard actually shows
    (the title the author typed over the chart's own), so it leads.
    """
    meta = component.get("meta") if isinstance(component, dict) else None
    if not isinstance(meta, dict):
        return None
    for attr in ("sliceNameOverride", "sliceName", "text", "code"):
        value = meta.get(attr)
        if isinstance(value, str) and value.strip():
            # A markdown block's "name" is its text, which runs to paragraphs.
            first = value.strip().splitlines()[0].strip()
            return _clip(first, 80)[0]
    if meta.get("chartId") is not None:
        return f"chart {meta['chartId']}"
    return None


def _meta_details(was: Any, now: Any) -> list[str]:
    """What else about a component differs: a resize, a rename, a background.

    A resize is reported here, as a detail, and is deliberately *not* a move:
    the component is where it was and only its size changed, which a reviewer
    weighs differently from a chart that went somewhere else.
    """
    if not (isinstance(was, dict) and isinstance(now, dict)):
        return []
    details = []
    old_meta, new_meta = was.get("meta"), now.get("meta")
    if isinstance(old_meta, dict) and isinstance(new_meta, dict):
        for key in sorted(set(old_meta) | set(new_meta), key=str):
            if _parsed(old_meta.get(key)) != _parsed(new_meta.get(key)):
                details.append(
                    f"{key} {_clip(_text_of(old_meta.get(key)), 40)[0]}"
                    f" → {_clip(_text_of(new_meta.get(key)), 40)[0]}"
                )
    elif _parsed(old_meta) != _parsed(new_meta):
        details.append("meta")
    return details


def _placements(layout: dict[Any, Any]) -> dict[Any, tuple[Any, int]]:
    """``id -> (container id, index in its children)``, from the ``children`` lists.

    A node's own ``parents`` is a copy of its ancestry that the editor
    rewrites for every descendant when a row moves, so it cannot tell a chart
    that went elsewhere from a chart whose row did. The container's
    ``children`` list is the layout itself, and it is also the only place a
    reorder within one container is written down: both swapped charts keep
    byte-identical nodes.
    """
    placed: dict[Any, tuple[Any, int]] = {}
    for container, component in layout.items():
        children = component.get("children") if isinstance(component, dict) else None
        if not isinstance(children, list):
            continue
        for index, child in enumerate(children):
            if isinstance(child, str):
                placed.setdefault(child, (container, index))
    return placed


def _reordered(
    before: dict[Any, Any], after: dict[Any, Any]
) -> dict[Any, tuple[int, int]]:
    """Components whose order inside the same container changed.

    ``id -> (position before, position after)``, 1-based in the container's
    full ``children`` list on each side. A component is reordered when its
    place among the siblings *both* sides hold differs; one that merely
    shifted because a neighbour arrived or left is not.
    """
    found: dict[Any, tuple[int, int]] = {}
    for container, was in before.items():
        now = after.get(container)
        if not (isinstance(was, dict) and isinstance(now, dict)):
            continue
        old, new = was.get("children"), now.get("children")
        if not (isinstance(old, list) and isinstance(new, list)):
            continue
        kept_old = [c for c in old if c in new]
        kept_new = [c for c in new if c in old]
        if kept_old == kept_new:
            continue
        slot_new = {c: i for i, c in enumerate(kept_new)}
        for i, child in enumerate(kept_old):
            if slot_new.get(child) != i:
                found[child] = (old.index(child) + 1, new.index(child) + 1)
    return found


def _where(layout: dict[Any, Any], placed: dict[Any, tuple[Any, int]], key: Any) -> str:
    """Where a container sits, in words an author would use.

    A tab by its title, anything else by its place among siblings of its own
    type ("row 2 of tab: Overview"). Only what the tree itself says: no
    position is made up for a container the layout does not place.
    """
    parts: list[str] = []
    seen: set[Any] = set()
    while key is not None and key not in seen:
        seen.add(key)
        component = layout.get(key)
        type_ = _component_type(key, component)
        if type_ in ("ROOT", "GRID"):
            break
        if type_ == "TABS" and parts:
            pass  # the tab inside it is what an author names; "tabs 1" adds nothing
        elif type_ == "TAB" and (name := _component_name(component)):
            parts.append(f"tab: {name}")
        else:
            at = placed.get(key)
            if at is None:
                parts.append(type_.lower())
            else:
                siblings = layout.get(at[0], {}).get("children", [])
                number = sum(
                    1
                    for s in siblings[: at[1] + 1]
                    if _component_type(s, layout.get(s)) == type_
                )
                parts.append(f"{type_.lower()} {number}")
        key = placed[key][0] if key in placed else None
    return " of ".join(parts) if parts else "the top level"


def _holding(layout: dict[Any, Any], key: Any) -> str | None:
    """The names of what a container holds, for a container nobody named."""
    names: list[str] = []
    stack = [key]
    seen: set[Any] = set()
    while stack:
        node = stack.pop()
        if node in seen:
            continue
        seen.add(node)
        component = layout.get(node)
        if not isinstance(component, dict):
            continue
        children = component.get("children")
        if isinstance(children, list) and children:
            stack.extend(reversed(children))
        if node != key and _component_type(node, component) not in LAYOUT_CONTAINER_TYPES:
            if name := _component_name(component):
                names.append(name)
    if not names:
        return None
    return _clip("holding " + ", ".join(names), 160)[0]


def _layout_components(
    before: dict[Any, Any], after: dict[Any, Any]
) -> list[dict[str, Any]]:
    """The components that arrived, left, moved or changed, named.

    ``layout_summary`` counts them -- "1 added, 0 removed, 1 moved" -- and the
    ids are generated, so a count is all it can say. Each component also
    carries its own ``meta`` (a chart its name, a heading its text), which is
    what a reviewer recognises.

    A move is named the way an add or a remove is, with where it went in
    ``details``: "position 1 → 2 in row 1" for a reorder inside one container
    and "from row 1 to tab: Regional" for a move into another. Nothing is
    capped: a restructure that moves forty charts lists forty.
    """
    was_at, now_at = _placements(before), _placements(after)
    reordered = _reordered(before, after)
    found = []
    for key in sorted(set(before) | set(after), key=str):
        in_before, in_after = key in before, key in after
        if not (in_before and in_after):
            component = after[key] if in_after else before[key]
            entry: dict[str, Any] = {
                "kind": "added" if in_after else "removed",
                "type": _component_type(key, component),
            }
            if (name := _component_name(component)) is not None:
                entry["name"] = name
            found.append(entry)
            continue

        was, now = before[key], after[key]
        type_ = _component_type(key, now)
        container = type_ in LAYOUT_CONTAINER_TYPES
        moved, notes = False, []
        if key in was_at and key in now_at:
            if was_at[key][0] != now_at[key][0]:
                moved = True
                notes.append(
                    f"from {_where(before, was_at, was_at[key][0])}"
                    f" to {_where(after, now_at, now_at[key][0])}"
                )
            elif key in reordered:
                moved = True
                old, new = reordered[key]
                notes.append(
                    f"position {old} → {new}"
                    f" in {_where(after, now_at, now_at[key][0])}"
                )
        elif not container and isinstance(was, dict) and isinstance(now, dict):
            # Placed in neither tree's ``children``: all that is left to go on
            # is the node's own record of its ancestry.
            moved = _parsed(was.get("parents")) != _parsed(now.get("parents"))
        details = _meta_details(was, now)
        if not (moved or details):
            # Nothing nameable differs. A leaf whose record still differs is
            # listed bare, as it always was; a container's own record changes
            # whenever a child does, and that is the child's line to carry.
            if container or _parsed(was) == _parsed(now):
                continue

        entry = {"kind": "changed", "type": type_}
        name = _component_name(now)
        if name is None and container:
            name = _holding(after, key)
        entry["name"] = name if name is not None else str(key)
        if moved:
            entry["moved"] = True
        if notes or details:
            entry["details"] = notes + details
        found.append(entry)
    return found


def _layout_of(before: Any, after: Any) -> dict[str, Any] | None:
    """How a layout moved: counts, and the components behind them."""
    before, after = _blob_pair(before, after)
    summary = layout_summary(before, after)
    if not summary:
        return None
    layout: dict[str, Any] = dict(summary)
    components = _layout_components(before, after)
    layout["components"] = components
    return layout


# --------------------------------------------------- derived filter scopes

#: The two lists a filter's scope keeps beside the scope itself.
#:
#: ``scope`` (``rootPath`` and ``excluded``) is what the author set. These are
#: what Superset worked out from it: every chart, and every tab, the scope
#: reaches *right now*. Superset recomputes them whenever a chart or a tab is
#: added or removed, so deleting one chart rewrote the list in the dashboard
#: scope, in every other chart's cross-filter record and in every native
#: filter -- eleven rows, none of which the author touched, between the
#: reviewer and the one change that was made.
#:
#: They are real: the stored values do change, and a chart entering or
#: leaving a scope is reviewable (Visa Q3). So they are not dropped. They are
#: moved out of the way of the author's own edit and put under one line that
#: says what caused them, with every value still sent.
SCOPE_CACHE_KEYS = ("chartsInScope", "tabsInScope")

#: Fields of ``json_metadata`` that are lists of objects with an ``id``, each
#: object keeping a scope of its own, and what to call one.
_SCOPED_LISTS = {
    "native_filter_configuration": ("native filter", "filter"),
    "chart_customization_config": ("chart customization", "customization"),
}


def _layout_names(layout: Any) -> tuple[dict[str, str], dict[str, str]]:
    """``(chart id -> name, tab id -> name)`` for what a layout holds.

    A scope lists charts by id and tabs by the layout's own element id
    (``TAB-d-E0Zc1cTH``). Neither means anything to a reviewer, and the
    layout in the same payload knows both names.
    """
    charts: dict[str, str] = {}
    tabs: dict[str, str] = {}
    if not isinstance(layout, dict):
        return charts, tabs
    for key, component in layout.items():
        if not isinstance(component, dict):
            continue
        kind = _component_type(key, component)
        if kind == "CHART":
            meta = component.get("meta")
            chart_id = meta.get("chartId") if isinstance(meta, dict) else None
            if chart_id is not None:
                charts[str(chart_id)] = (
                    _component_name(component) or f"chart {chart_id}"
                )
        elif kind == "TAB":
            tabs[str(key)] = _component_name(component) or str(key)
    return charts, tabs


def _scope_sites(
    blob: dict[Any, Any], chart_names: dict[str, str]
) -> dict[tuple[str, str], tuple[str, str, dict[Any, Any]]]:
    """Every place ``blob`` keeps a scope: ``site -> (label, noun, holder)``.

    ``holder`` is the object that carries the two cache lists, so the caller
    can read them and take them out. Only places that are known by shape are
    listed; a scope kept anywhere else is simply left in the ordinary list of
    entries, where it is shown in full as it always was.
    """
    sites: dict[tuple[str, str], tuple[str, str, dict[Any, Any]]] = {}
    overall = blob.get("global_chart_configuration")
    if isinstance(overall, dict):
        sites[("global", "")] = ("Dashboard cross-filtering", "cross-filter", overall)
    per_chart = blob.get("chart_configuration")
    if isinstance(per_chart, dict):
        for chart_id, record in per_chart.items():
            cross = record.get("crossFilters") if isinstance(record, dict) else None
            if isinstance(cross, dict):
                name = chart_names.get(str(chart_id), f"chart {chart_id}")
                sites[("chart", str(chart_id))] = (
                    f"Cross-filtering from {name}",
                    "cross-filter",
                    cross,
                )
    for field, (noun, word) in _SCOPED_LISTS.items():
        for ident, item in (_identified(blob.get(field)) or {}).items():
            sites[(field, str(ident))] = (f"{_item_name(item)} {word}", noun, item)
    return sites


def _scope_row(kind: str, key: str, text: str) -> dict[str, Any]:
    """One line of the consequence group.

    Not cut to ``ENTRY_VALUE_LIMIT``: a list of chart names is the content of
    the line, and cutting it is how a chart leaving a scope would go unseen.
    """
    entry: dict[str, Any] = {"kind": kind, "key": key, "consequence": True}
    entry["after" if kind == "added" else "before"] = text
    return entry


def _scope_consequence(
    kind_count: int,
    names: list[str],
    singular: str,
    plural: str,
) -> str:
    listed = ", ".join(names)
    return f"{kind_count} {singular if kind_count == 1 else plural} ({listed})"


def _split_scope_caches(
    before: Any, after: Any, was_layout: Any, now_layout: Any
) -> tuple[Any, Any, list[dict[str, Any]], str | None]:
    """Take the derived scope lists out of two ``json_metadata`` blobs.

    Returns the two blobs without them, one row per list that really moved
    (what left it, what joined it, by name), and the sentence that says why.
    Both blobs come back unchanged in meaning when there is nothing to
    separate, and are copies either way.

    A scope list is only taken out where it exists on both sides. A filter
    that was added or removed shows its whole body, scope lists included, in
    its own ordinary row, because there the lists are part of what arrived.
    """
    if not (isinstance(before, dict) and isinstance(after, dict)):
        return before, after, [], None
    before, after = copy.deepcopy(before), copy.deepcopy(after)

    was_charts, was_tabs = _layout_names(_parsed(was_layout))
    now_charts, now_tabs = _layout_names(_parsed(now_layout))
    chart_names = {**was_charts, **now_charts}
    tab_names = {**was_tabs, **now_tabs}
    gone_charts = set(was_charts) - set(now_charts)
    new_charts = set(now_charts) - set(was_charts)
    gone_tabs = set(was_tabs) - set(now_tabs)
    new_tabs = set(now_tabs) - set(was_tabs)

    def chart(ident: Any) -> str:
        return chart_names.get(str(ident), f"chart {ident}")

    def tab(ident: Any) -> str:
        return tab_names.get(str(ident), str(ident))

    rows: list[dict[str, Any]] = []
    nouns: list[str] = []
    touched_charts: set[str] = set()
    touched_tabs: set[str] = set()

    def note(noun: str) -> None:
        if noun not in nouns:
            nouns.append(noun)

    # A chart's own cross-filter record arrives with the chart and leaves with
    # it. Only for a chart the layout really added or removed: a record that
    # vanishes for a chart still on the dashboard is not a consequence of
    # anything and stays in the ordinary list.
    was_records = before.get("chart_configuration")
    now_records = after.get("chart_configuration")
    if isinstance(was_records, dict) and isinstance(now_records, dict):
        for chart_id in sorted(set(was_records) ^ set(now_records), key=str):
            left = chart_id in was_records
            if str(chart_id) not in (gone_charts if left else new_charts):
                continue
            record = (was_records if left else now_records).pop(chart_id)
            cross = record.get("crossFilters") if isinstance(record, dict) else None
            scope = cross.get("scope") if isinstance(cross, dict) else None
            text = f"scope: {_text_of(scope)}" if scope is not None else "no scope set"
            rows.append(
                _scope_row(
                    "removed" if left else "added",
                    f"{chart(chart_id)} · cross-filter settings",
                    text,
                )
            )
            touched_charts.add(str(chart_id))
            note("cross-filter")

    was_sites = _scope_sites(before, chart_names)
    now_sites = _scope_sites(after, chart_names)
    for site, (label, noun, was_holder) in was_sites.items():
        if site not in now_sites:
            continue
        now_holder = now_sites[site][2]
        for cache, name_of, touched, what in (
            ("chartsInScope", chart, touched_charts, "charts"),
            ("tabsInScope", tab, touched_tabs, "tabs"),
        ):
            was_ids, now_ids = was_holder.get(cache), now_holder.get(cache)
            sides = (was_ids, now_ids)
            if not all(ids is None or isinstance(ids, list) for ids in sides):
                continue  # not a list: leave it where the ordinary walk shows it
            was_holder.pop(cache, None)
            now_holder.pop(cache, None)
            left = [i for i in was_ids or [] if i not in (now_ids or [])]
            joined = [i for i in now_ids or [] if i not in (was_ids or [])]
            for kind, ids in (("removed", left), ("added", joined)):
                if ids:
                    rows.append(
                        _scope_row(
                            kind,
                            f"{label} · {what} in scope",
                            ", ".join(sorted(name_of(i) for i in ids)),
                        )
                    )
                    touched.update(str(i) for i in ids)
                    note(noun)

    if not rows:
        return before, after, [], None

    def named(ids: set[str], name_of: Any) -> list[str]:
        return sorted(name_of(i) for i in ids)

    causes = []
    for ids, name_of, singular, plural in (
        (touched_charts & gone_charts, chart, "removed chart", "removed charts"),
        (touched_charts & new_charts, chart, "added chart", "added charts"),
        (touched_tabs & gone_tabs, tab, "removed tab", "removed tabs"),
        (touched_tabs & new_tabs, tab, "added tab", "added tabs"),
        # Nothing was added or removed to explain it, so the author changed who
        # is in the scope. That is the edit Visa Q3 means, and it is named here
        # in the line that is always visible, not only in the detail.
        (
            touched_charts - gone_charts - new_charts,
            chart,
            "chart entering or leaving a scope",
            "charts entering or leaving a scope",
        ),
        (
            touched_tabs - gone_tabs - new_tabs,
            tab,
            "tab entering or leaving a scope",
            "tabs entering or leaving a scope",
        ),
    ):
        if ids:
            causes.append(
                _scope_consequence(len(ids), named(ids, name_of), singular, plural)
            )

    subject = nouns[0]
    if len(nouns) > 1:
        subject = f"{', '.join(nouns[:-1])} and {nouns[-1]}"
    summary = f"{subject[0].upper()}{subject[1:]} scopes updated"
    if causes:
        summary += " for " + "; ".join(causes)
    return before, after, rows, summary


# ------------------------------------------------------------- structured entry


def _opaque_entry(
    field: str, current: Any, proposed: Any, layout_column: Any = _MISSING
) -> dict[str, Any]:
    """What moved inside a JSON column too big to show whole.

    Leads with what the author actually moved. Explore posts every control's
    current value, so ticking one checkbox arrives carrying dozens of keys
    the stored blob never held, nearly all of them that control's own
    default. Naming those alongside the real edit told the reviewer "78
    changes" and listed three settings nobody had touched, which is QA-15 on
    the chart surface, where its dashboard fix never reached. Nothing is
    hidden: the rest are counted and said out loud.

    ``keys`` names the top-level settings (what the panel has always shown).
    ``entries`` is the detail under them: each setting that moved, with its
    value before and after, walked into nested objects.
    """
    entry: dict[str, Any] = {"field": field, "opaque": True}
    before, after = _blob_pair(current, proposed)
    if field == LAYOUT_COLUMN:
        if layout := _layout_of(before, after):
            entry["layout"] = layout
        return entry

    kinds = changed_keys_by_kind(before, after)
    skip: frozenset[str] = frozenset()
    scope_rows: list[dict[str, Any]] = []
    scope_summary: str | None = None
    if field == "json_metadata":
        # The gate ignores these: Superset recomputes them on every read, so
        # they move on their own and no author sets them. Naming them here
        # told a reviewer that a dashboard save had changed
        # `map_label_colors` and `shared_label_colors`, which nobody had
        # touched, while saying nothing about what actually moved (129075).
        #
        # Read from the same set the gate uses rather than listed again, so
        # the two cannot drift apart -- which is exactly how they had.
        #
        # The layout rides inside the metadata on a dashboard save while the
        # asset keeps it in a column, so it is compared against that column,
        # as the gate does, and reported as a layout and not as a key.
        skip = DERIVED_METADATA_KEYS | {LAYOUT_KEY}
        was_layout = (
            before.get(LAYOUT_KEY)
            if isinstance(before, dict) and LAYOUT_KEY in before
            else None
            if layout_column is _MISSING
            else layout_column
        )
        now_layout = (
            after[LAYOUT_KEY]
            if isinstance(after, dict) and LAYOUT_KEY in after
            else was_layout
        )
        # The scope lists Superset recomputes from the layout are separated
        # from the author's own settings and reported once, below.
        before, after, scope_rows, scope_summary = _split_scope_caches(
            before, after, was_layout, now_layout
        )
        kinds = {
            kind: [key for key in keys if key not in skip]
            for kind, keys in changed_keys_by_kind(before, after).items()
        }
        if isinstance(after, dict) and LAYOUT_KEY in after:
            if not (
                _is_nothing(was_layout) and _is_nothing(now_layout)
            ) and _parsed(was_layout) != _parsed(now_layout):
                if layout := _layout_of(was_layout, now_layout):
                    entry["layout"] = layout

    edited = kinds["moved"] + kinds["removed"]
    if keys := edited or kinds["added"]:
        entry["keys"] = keys

    if isinstance(before, dict) and isinstance(after, dict):
        edited_entries, added_entries = _blob_entries(before, after, skip)
        # The edit leads and the settings written down for the first time
        # follow, every one of them named with its value. They used to be
        # counted ("76 further settings written for the first time"), which
        # is a number where a reviewer needs the settings.
        _capped(entry, edited_entries + added_entries + scope_rows)
        if scope_rows and scope_summary:
            entry["consequence_summary"] = scope_summary
    return entry


# ---------------------------------------------------------------- collections

#: Where the names behind a field's ids live, so a list of ids can be shown as
#: the things it holds. An enrichment: a field not listed is still compared and
#: shown, by whatever labels its items carry or by their ids.
_NAMED_MODELS: dict[str, tuple[str, str]] = {
    "dashboards": ("superset.models.dashboard", "Dashboard"),
    "editors": ("superset.subjects.models", "Subject"),
    "viewers": ("superset.subjects.models", "Subject"),
    "tags": ("superset.tags.models", "Tag"),
    "theme_id": ("superset.models.core", "Theme"),
    "datasource_id": ("superset.connectors.sqla.models", "SqlaTable"),
    "owners": ("", "user"),
    # The metrics a dataset save asks to delete: ``delete_metric_ids`` is a
    # keyword and not a body field, but its ids are named the same way.
    "delete_metric_ids": ("superset.connectors.sqla.models", "SqlMetric"),
}


def _model_for(ref: tuple[str, str]) -> Any:
    module, name = ref
    if name == "user":
        from superset import security_manager

        return security_manager.user_model
    return getattr(import_module(module), name)


def _names_of(field: str, ids: list[Any]) -> dict[Any, str]:
    """``id -> name`` for the ids of one field, or nothing if they cannot be read.

    Naming is a courtesy on top of the default, which shows the id: a lookup
    that fails costs the name and never the row.
    """
    wanted = [i for i in ids if isinstance(i, int) and not isinstance(i, bool)]
    if not wanted or field not in _NAMED_MODELS:
        return {}
    try:
        model = _model_for(_NAMED_MODELS[field])
        rows = db.session.query(model).filter(model.id.in_(wanted)).all()
        return {row.id: _label_of(row) for row in rows}
    except Exception:  # noqa: BLE001 -- see above
        logger.warning("asset-approval: could not name the %s ids %s", field, wanted)
        return {}


def _collection_entry(field: str, current: Any, proposed: Any) -> dict[str, Any]:
    """A list-valued field as the things in it, and which joined or left.

    ``viewers``, ``editors``, ``tags`` and a chart's ``dashboards`` are lists,
    and the scalar renderer had nothing to say about a list, so a title change
    carrying an access grant read "Changed" beside a raw key. Items are
    compared by name, after ids are resolved to names, so a payload that sends
    ids and a stored side that holds objects compare as the same thing.
    """
    ids = [
        item
        for items in (current, proposed)
        for item in (items or [])
        if isinstance(item, int)
    ]
    names = _names_of(field, ids)

    def members(items: Any) -> list[tuple[Any, str]]:
        """``(identity, label)`` per item.

        Identity is the id where the item has one, so a payload that sends
        ``1`` and a stored side that holds the row with ``id`` 1 are one
        member even when the name could not be looked up. An item with no id
        (a tag sent by name) is its own label.
        """
        found = []
        for item in items or []:
            if isinstance(item, int) and not isinstance(item, bool):
                found.append((item, names.get(item, str(item))))
                continue
            ident = _field_of(item, "id") if not isinstance(item, str) else None
            label = _label_of(item)
            found.append((ident if ident is not None else label, label))
        return found

    was, now = members(current), members(proposed)

    def missing_from(
        items: list[tuple[Any, str]], others: list[tuple[Any, str]]
    ) -> list[str]:
        idents = {ident for ident, _ in others}
        labels = {label for _, label in others}
        return [
            label
            for ident, label in items
            if ident not in idents and label not in labels
        ]

    entries = [_entry("added", label) for label in missing_from(now, was)]
    entries += [_entry("removed", label) for label in missing_from(was, now)]
    was_labels, now_labels = [label for _, label in was], [label for _, label in now]

    entry: dict[str, Any] = {"field": field, "opaque": True}
    for side, items in (("before", was_labels), ("after", now_labels)):
        text, cut = (
            _clip(", ".join(items), SHOWN_VALUE_LIMIT) if items else (None, False)
        )
        entry[side] = text
        if cut:
            entry["truncated"] = True
    entry["count"] = {"before": len(was_labels), "after": len(now_labels)}
    return _capped(entry, entries)


# ------------------------------------------------------------------ enrichments


def _named_id(field: str, current: Any, proposed: Any, *_context: Any) -> dict:
    """An id field as the thing it points at: a theme, a dataset, by name."""
    ids = [value for value in (current, proposed) if isinstance(value, int)]
    names = _names_of(field, ids)

    def label(value: Any) -> Any:
        if value is None or not isinstance(value, int) or isinstance(value, bool):
            return value
        return f"{names[value]} ({value})" if value in names else value

    return {"field": field, "before": label(current), "after": label(proposed)}


def _named_dataset(
    field: str, current: Any, proposed: Any, asset: Any, payload: dict[str, Any]
) -> dict[str, Any] | None:
    """A chart's dataset, by name. Only tables have a name table to read."""
    kind = payload.get("datasource_type", getattr(asset, "datasource_type", None))
    if kind not in (None, "table"):
        return None
    return _named_id(field, current, proposed)


_ENRICHERS: dict[str, Any] = {
    "theme_id": _named_id,
    "datasource_id": _named_dataset,
}


def _field_entry(
    field: str,
    current: Any,
    proposed: Any,
    *,
    asset: Any = None,
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """One changed field, shown from its two values.

    The default is chosen by the shape of the values (an object, a
    collection, a scalar) and every branch carries both values or a list of
    what moved. An enrichment may replace it; if it declines or fails the
    default stands, so the worst case for a field this module has never seen
    is a before and an after.
    """
    if (enrich := _ENRICHERS.get(field)) is not None:
        try:
            entry = enrich(field, current, proposed, asset, payload or {})
        except Exception:  # noqa: BLE001 -- the default below still answers
            logger.warning("asset-approval: could not enrich %r", field, exc_info=True)
            entry = None
        if entry is not None:
            return entry

    if _structure_of(current) is not None or _structure_of(proposed) is not None:
        entry = _opaque_entry(
            field,
            current,
            proposed,
            layout_column=getattr(asset, LAYOUT_COLUMN, None)
            if asset is not None
            else _MISSING,
        )
        if not any(key in entry for key in ("layout", "entries")):
            # Whatever the structure was, it moved somewhere this could not
            # give a value for. Names alone are not a change a reviewer can
            # judge, so both values come with them rather than the word
            # "Changed" or a list of keys.
            entry.update(_pair(current, proposed))
        return entry

    if _is_collection(current) or _is_collection(proposed):
        return _collection_entry(field, current, proposed)
    return _scalar_entry(field, current, proposed)


# -------------------------------------------------------------------- keywords

#: What a write is *called with*, beside its body.
#:
#: The gate captures every constructor argument past the asset id and the
#: body (``gate.KWARGS_KEY``), because a command's keywords change what the
#: write does as much as its body does: ``delete_metric_ids`` deletes with a
#: body of ``{}``, ``preserve_existing_metrics`` decides whether the metrics a
#: save does not list survive, ``save_to_dashboard_id`` attaches the chart to a
#: dashboard. A capture holds them; replay hands them back; and until this
#: section nothing showed them to the reviewer, who was asked to approve the
#: body alone.
#:
#: The rule is the one ``_field_entry`` follows for fields: the default is
#: chosen without knowing the keyword and fails *closed*, so a keyword a
#: command grows next week still reaches the reviewer with its name and its
#: value. ``_KEYWORD_RENDERERS`` only improves on that for the few whose
#: consequence a person needs spelled out; a renderer that declines or fails
#: leaves the default standing.


def _quoted(value: Any) -> str:
    """A keyword's value as it reads in ``name = value``."""
    return json.dumps(value) if isinstance(value, str) else _text_of(value)


def _keyword_entry(
    name: str, summary: str, value: Any = _MISSING, **more: Any
) -> dict[str, Any]:
    """One keyword as an entry: its name, what it does, and its value.

    ``summary`` is the consequence in a sentence; ``after`` is the value
    itself, so the mechanism stays visible beside the explanation of it.
    """
    entry: dict[str, Any] = {"field": name, "keyword": True, "summary": summary}
    if value is not _MISSING:
        after, cut = _render(value)
        entry["after"] = after
        if cut:
            entry["truncated"] = True
        if _is_structural(value):
            entry["opaque"] = True
    entry.update(more)
    return entry


def _unrecognised_keyword(name: str, value: Any) -> dict[str, Any]:
    """The default: a keyword nobody wrote a sentence for, by name and value."""
    text, _ = _clip(_quoted(value), ENTRY_VALUE_LIMIT)
    return _keyword_entry(name, f"Also applied with this save: {name} = {text}", value)


def _whole_ids(value: Any) -> list[int] | None:
    """``value`` as a list of ids, or ``None`` if any of it is not an id."""
    items = list(value) if _is_collection(value) else [value]
    if not items or not all(
        isinstance(item, int) and not isinstance(item, bool) for item in items
    ):
        return None
    return sorted(set(items))


def _metrics_being_deleted(value: Any, _request: Any, asset: Any) -> dict | None:
    """``delete_metric_ids`` as the metrics, by name, that approving deletes.

    Read off the dataset's own metrics: the DAO deletes only a metric that is
    on the dataset, so an id that is not one of them deletes nothing and is
    said so rather than named as if it would go. Without the dataset the ids
    are looked up, and an id nobody can name is shown as an id.
    """
    ids = _whole_ids(value)
    if ids is None:
        return None
    own = None
    if asset is not None and hasattr(asset, "metrics"):
        own = {
            _field_of(metric, "id"): _field_of(metric, "metric_name")
            or _label_of(metric)
            for metric in getattr(asset, "metrics", None) or []
        }
    names = own if own is not None else _names_of("delete_metric_ids", ids)

    going: list[str] = []
    stray: list[str] = []
    for ident in ids:
        if ident in names:
            going.append(str(names[ident]))
        elif own is not None:
            stray.append(f"metric {ident}")
        else:
            going.append(f"metric {ident}")

    parts = []
    if going:
        noun = "metric" if len(going) == 1 else "metrics"
        parts.append(
            f"Deletes {len(going)} {noun} from this dataset: {', '.join(going)}. "
            "Anything that uses them loses them."
        )
    if stray:
        parts.append(
            f"{', '.join(stray)} {'is' if len(stray) == 1 else 'are'} not on "
            "this dataset, so nothing is deleted for "
            f"{'it' if len(stray) == 1 else 'them'}."
        )
    entry = _keyword_entry(
        "delete_metric_ids", " ".join(parts), ", ".join(going + stray)
    )
    return _capped(entry, [_entry("removed", name) for name in going])


def _keeping_other_metrics(value: Any, *_context: Any) -> dict | None:
    if value is not True:
        return None
    return _keyword_entry(
        "preserve_existing_metrics",
        "The dataset's other metrics are kept. The metrics in this save are "
        "added or updated, not taken as the full list, so a metric it does "
        "not mention stays.",
        value,
    )


def _replacing_columns(value: Any, *_context: Any) -> dict | None:
    if value is not True:
        return None
    return _keyword_entry(
        "override_columns",
        "Columns are replaced and then refreshed from the source table, not "
        "merged: a column this save does not list is removed, and so is one "
        "the source no longer has.",
        value,
    )


def _dashboard_published(ident: int) -> bool | None:
    """Whether a dashboard is published, or ``None`` if that cannot be read."""
    try:
        from superset.models.dashboard import Dashboard

        row = db.session.query(Dashboard).filter(Dashboard.id == ident).one_or_none()
        return None if row is None else bool(row.published)
    except Exception:  # noqa: BLE001 -- the sentence says it could not check
        logger.warning("asset-approval: could not read dashboard %s", ident)
        return None


def _adding_to_dashboard(value: Any, *_context: Any) -> dict | None:
    """``save_to_dashboard_id``: the chart goes onto a dashboard as well."""
    try:
        ident = int(value)
    except (TypeError, ValueError):
        return None
    name = _names_of("dashboards", [ident]).get(ident)
    published = _dashboard_published(ident)
    target = f'the dashboard "{name}"' if name else f"dashboard {ident}"
    summary = f"Also adds this chart to {target}."
    if published is True:
        summary += (
            " That dashboard is PUBLISHED, so this reaches the people who "
            "view it as soon as it is approved."
        )
    elif published is False:
        summary += " That dashboard is not published."
    else:
        summary += " Whether that dashboard is published could not be checked."
    return _keyword_entry(
        "save_to_dashboard_id",
        summary,
        name or ident,
        published=published,
    )


def _adding_to_new_dashboard(value: Any, *_context: Any) -> dict | None:
    if not isinstance(value, str) or not value.strip():
        return None
    return _keyword_entry(
        "new_dashboard_name",
        f'Also creates a new dashboard "{value}" containing this chart.',
        value,
    )


_KEYWORD_RENDERERS: dict[str, Any] = {
    "delete_metric_ids": _metrics_being_deleted,
    "preserve_existing_metrics": _keeping_other_metrics,
    "override_columns": _replacing_columns,
    "save_to_dashboard_id": _adding_to_dashboard,
    "new_dashboard_name": _adding_to_new_dashboard,
}


def keyword_entries(change_request: Any, asset: Any) -> list[dict[str, Any]]:
    """One entry per keyword the write was captured with, none skipped.

    A keyword with a renderer is explained by it; any other, and any whose
    renderer declines or fails, is shown by name and value. Nothing the
    capture holds can be left out of this list, which is the point: a keyword
    that is replayed on approval and shown nowhere is a blind approval.
    """
    command_args = getattr(change_request, "command_args", None)
    arguments = captured_arguments(command_args)
    # A dataset save captured before keywords were kept as a set carries this
    # one under a key of its own, and replay still honours it.
    if isinstance(command_args, dict) and command_args.get("override_columns") is True:
        arguments.setdefault("override_columns", True)

    entries = []
    for name, value in arguments.items():
        entry = None
        if (render := _KEYWORD_RENDERERS.get(name)) is not None:
            try:
                entry = render(value, change_request, asset)
            except Exception:  # noqa: BLE001 -- the default below still answers
                logger.warning(
                    "asset-approval: could not explain %r", name, exc_info=True
                )
        entries.append(
            entry if entry is not None else _unrecognised_keyword(name, value)
        )
    return entries



# --------------------------------------------------------------------- commands

#: What the gate captured for a delete of the embedded config. The class is
#: the host's, so the name is read from where the gate registers it.
DELETE_EMBEDDED_COMMAND = REVIEW_COMMANDS[
    ("superset.commands.dashboard.delete", "DeleteEmbeddedDashboardCommand")
]

#: Said where an empty domain list is shown, because empty does not mean what
#: it looks like: the embedded view only checks the referrer when the list has
#: something in it.
ANY_SITE = "Any site (no domain restriction)"


def _config_diff_entry(
    field: str, body: Any, asset: Any
) -> dict[str, Any]:
    """A filter or customization diff, as what it does to each entry.

    The body is ``{modified, deleted, reordered}`` against the stored list.
    ``modified`` both edits an entry and adds one the list has never held, and
    ``deleted`` was discarded entirely, so removing a filter read exactly like
    adding one. The stored list is read so each is named and the three are told
    apart; the DAO replaces a modified entry whole, so a key the new entry
    leaves out is shown as removed.
    """
    stored = _metadata_reader(asset)(field)
    by_id = _identified(stored if isinstance(stored, list) else []) or {}
    entries: list[dict[str, Any]] = []
    if isinstance(body, dict):
        for item in body.get("modified") or []:
            live = by_id.get(item.get("id")) if isinstance(item, dict) else None
            if live is None:
                entries.append(_entry("added", _item_name(item), _MISSING, item))
                continue
            # Named as the stored entry is, because that is what the reviewer
            # knows it by: a replacement that drops the name would otherwise
            # be listed under its id.
            name = _item_name(live)
            edited, added = _blob_entries(live, item)
            for leaf in edited + added:
                entries.append({**leaf, "key": f"{name} · {leaf['key']}"})
        for ident in body.get("deleted") or []:
            live = by_id.get(ident)
            entries.append(
                _entry(
                    "removed",
                    _item_name(live) if live else str(ident),
                    live or _MISSING,
                )
            )
        order = body.get("reordered") or []
        if order and list(order) != list(by_id):
            entries.append(
                _entry(
                    "changed",
                    "order",
                    ", ".join(_item_name(item) for item in by_id.values()),
                    ", ".join(_item_name(by_id.get(i, {"id": i})) for i in order),
                )
            )
    entry: dict[str, Any] = {"field": field, "opaque": True}
    if not entries:
        # A body this could not read as a diff is shown as it is.
        entry.update(_pair(None, body))
        return entry
    return _capped(entry, entries)


def _saved_version(asset: Any, version_uuid: Any) -> dict[str, Any] | None:
    """The history record of the version being restored, or None."""
    from superset.versioning.queries import list_versions

    for version in list_versions(type(asset), asset.uuid, entity=asset) or []:
        if str(version.get("version_uuid")) == str(version_uuid):
            return version
    return None


def _describe_version_restore(
    change_request: ChangeRequest, asset: Any
) -> list[dict[str, Any]]:
    """Which version a restore puts back, and what that version holds.

    The change request records the version's number and uuid and nothing
    else, so the panel read "Version 0" beside an em-dash. The history already
    keeps, per version, who saved it, when, and the list of changes that save
    made; those are read here and not recorded again, so the panel shows the
    same account Version History does. A history that cannot be read costs
    the detail and not the row: the version's number is still said.
    """
    number = change_request.command_args.get("version_number")
    version_uuid = change_request.payload_dict.get("version_uuid")
    entry: dict[str, Any] = {
        "field": "version",
        "before": None,
        "after": f"Version {number}" if number is not None else version_uuid,
    }
    try:
        saved = _saved_version(asset, version_uuid) if asset is not None else None
    except Exception:  # noqa: BLE001 -- the number above still answers
        logger.warning("asset-approval: could not read version history", exc_info=True)
        saved = None
    if saved:
        if saved.get("issued_at") is not None:
            entry["saved_at"] = _text_of(saved["issued_at"])
        if who := saved.get("changed_by"):
            entry["saved_by"] = _user_name(who)
        entries = []
        for record in saved.get("changes") or []:
            operation = str(record.get("operation") or "")
            kind = (
                "added"
                if operation.startswith(("add", "insert", "create"))
                else "removed"
                if operation.startswith(("remove", "delete"))
                else "changed"
            )
            path = record.get("path")
            key = (
                " · ".join(str(part) for part in path)
                if isinstance(path, (list, tuple))
                else str(path or record.get("kind") or "")
            )
            entries.append(
                _entry(kind, key, record.get("from_value"), record.get("to_value"))
            )
        _capped(entry, entries)
    return [entry]


def _user_name(user: Any) -> str:
    full = " ".join(
        part
        for part in (
            (user.get("first_name") if isinstance(user, dict) else None),
            (user.get("last_name") if isinstance(user, dict) else None),
        )
        if part
    )
    return full or _label_of(user)


def _describe_command(
    change_request: ChangeRequest, asset: Any, kind: str | None
) -> list[dict[str, Any]] | None:
    """Changes for captures whose body is not fields of the asset.

    ``None`` when the body *is* asset fields, or is a command this does not
    know: the generic field-by-field comparison applies and shows every key
    in the body, so an unrecognised command is shown rather than skipped.
    This used to list the commands it knew and test one of them for a name the
    gate does not emit (``"embedded"`` against ``upsert_embedded``), which left
    the descriptive branch unreachable.
    """
    if kind is None:
        return None

    if kind in DIFF_COMMAND_FIELDS:
        return [
            _config_diff_entry(
                DIFF_COMMAND_FIELDS[kind], change_request.payload_dict, asset
            )
        ]

    if kind == RESTORE_VERSION_COMMAND:
        return _describe_version_restore(change_request, asset)

    if kind == RESTORE_COMMAND:
        # The body is the asset's own uuid, which says nothing. What approving
        # does is put the asset back in front of everyone who can see it.
        return [
            {
                "field": "archived",
                "before": "Archived (hidden from viewers)",
                "after": "Restored (visible to viewers again)",
            }
        ]

    if kind in (UPSERT_EMBEDDED_COMMAND, DELETE_EMBEDDED_COMMAND):
        embedded = (getattr(asset, "embedded", None) or [None])[0]
        if kind == DELETE_EMBEDDED_COMMAND:
            return [{"field": "embedding", "before": "Enabled", "after": "Disabled"}]
        before = (
            (getattr(embedded, "allow_domain_list", None) or ANY_SITE)
            if embedded
            else "Not embedded"
        )
        domains = change_request.payload_dict.get("allowed_domains") or []
        return [
            {
                "field": "embedding_allowed_domains",
                "before": before,
                "after": ",".join(domains) or ANY_SITE,
            }
        ]
    return None


def applied_fields(change_request: Any, asset: Any) -> list[str]:
    """The body's changed fields that approving will actually write.

    ``changed_fields`` answers "what differs from the live asset", and for an
    exempt field (editors, viewers, tags, ...) that is not the same as "what
    approving writes". Replay drops an exempt field unless the capture named
    it as one this very write changed (``gate.captured_exempt_fields``); the
    rest are the form echoing a value back, and a request is only a snapshot
    of it. An echo that differs from live *now* -- someone added an editor
    since -- was listed as a change the reviewer was approving, when
    approving would never write it. Listing it tells them something will
    happen that will not; leaving out one that is written would be a blind
    approval, which is why this asks the capture and does not guess.

    A capture that never recorded owns none, which is how replay reads it too.
    """
    owned = set(
        captured_exempt_fields(getattr(change_request, "command_args", None)) or ()
    )
    return [
        field
        for field in changed_fields(asset, change_request.payload_dict)
        if field not in EXEMPT_FIELDS or field in owned
    ]


def describe_changes(
    change_request: ChangeRequest, asset: Any
) -> list[dict[str, Any]]:
    """What approving does: the keywords it is called with, then the fields.

    Keywords first, because they are the part of a write most likely to be
    missed and least likely to be reversible: a metric delete is a keyword
    over a body that says nothing at all.
    """
    return keyword_entries(change_request, asset) + _describe_fields(
        change_request, asset
    )


def _describe_fields(
    change_request: ChangeRequest, asset: Any
) -> list[dict[str, Any]]:
    """What each changed field is now, and what it would become.

    The stored payload is a field-level request body, not a snapshot, so a
    before/after pair is what the data actually supports -- and for the
    fields a person can read, it is also what answers "what am I
    approving?" better than a rendered diff would.

    A delete has no fields: the change is the asset itself.
    """
    if Operation(change_request.operation) is Operation.DELETE:
        return []

    kind = change_request.command_args.get(COMMAND_KEY)
    if (described := _describe_command(change_request, asset, kind)) is not None:
        return described

    current_of = _metadata_reader(asset) if kind == "colors" else None

    # A dashboard save resends the whole properties payload, so most of what
    # arrives is the field's existing value coming back unchanged. Listing
    # those buried a one-field edit in ten rows and told the reviewer "10
    # changes" for a renamed title, which is worse than unhelpful because it
    # teaches them not to trust the count (QA-15).
    #
    # Which fields those are is the gate's question, and it is asked here
    # rather than answered again, so the panel cannot drift from the
    # decision. It had drifted: ``_same`` compared ``json_metadata`` as one
    # blob, and the payload carries the layout inside it while the asset
    # keeps the layout in a column of its own, so the two never matched. A
    # title-only save reported "json_metadata Changed" with nothing behind
    # it, on top of the ordering noise in the keys themselves (R5-01).
    #
    # A colour write is the exception: it sets keys inside json_metadata
    # rather than columns, so there is no column for the gate to compare and
    # the lenient per-value test is the only one that applies.
    reported = (
        None
        if current_of is not None
        else set(applied_fields(change_request, asset))
    )

    changes = []
    for field, proposed in sorted(change_request.payload_dict.items()):
        if current_of is not None:
            current = current_of(field)
            if _same(current, proposed):
                continue
        else:
            current = getattr(asset, field, None) if asset is not None else None
            if field not in reported:
                continue

        # Every field the gate counted is shown from its two values. There is
        # no list of field names here to fall off the end of.
        changes.append(
            _field_entry(
                field,
                current,
                proposed,
                asset=asset,
                payload=change_request.payload_dict,
            )
        )
    return changes


def _is_archived(asset: Any) -> bool:
    """Whether the live asset is in the trash.

    ``deleted_at`` is how soft-deletion is recorded (``SoftDeleteMixin``),
    and it is the same notion the visibility filter and the retention job
    read, so an asset only reachable because ``_asset_of`` asked past that
    filter answers True here. An asset kind without the mixin has no
    ``deleted_at`` and is never archived.
    """
    return getattr(asset, "deleted_at", None) is not None


def _author_can_still_edit(change_request: Any, asset: Any) -> bool:
    """Whether the change's author is still an editor of the asset.

    Approving replays the change as the author's work, so the approve route
    re-asks this on the merits and refuses with 409 once the answer is no.
    The recorded decision for QA-07 was to leave the request approvable and
    *tell* the approver; this is the telling half, which was never built, so
    ``can_approve`` offered a button that could only fail.

    The strict check deliberately, as everywhere else in this feature: an
    administrator is not an editor on the strength of the role alone, and
    the note must agree with the refusal rather than with the role table.

    An unverifiable answer is "yes": with no asset loaded there is nothing
    to be an editor of, and warning of a loss of access we have not
    established would be worse than saying nothing.
    """
    if asset is None or change_request.author_fk is None:
        return True
    return is_strict_editor(asset, change_request.author_fk)


#: Said to a reviewer who has been handed a request with nothing in it to read.
NOTHING_TO_REVIEW = (
    "There is nothing here the reviewer can check: the request either matches "
    "the live version already, or carries something this page cannot describe. "
    "It cannot be approved from here. Request changes, or ask the author to "
    "discard it."
)


def _detail_shows_something(detail: dict[str, Any] | None) -> bool:
    """Whether a dataset's definition diff has a row for the reviewer."""
    if not detail:
        return False
    sql = detail.get("sql")
    if sql and (sql.get("before") or "") != (sql.get("after") or ""):
        return True
    for key in ("columns", "metrics"):
        diff = detail.get(key) or {}
        if any(diff.get(kind) for kind in ("added", "changed", "removed")):
            return True
    return bool(detail.get("settings"))


def review_blocker(
    change_request: Any,
    changes: list[dict[str, Any]],
    detail: dict[str, Any] | None = None,
) -> str | None:
    """Why this open request cannot be approved from what is shown, or ``None``.

    A request that is open, is not a delete, and has nothing to list -- no
    changed field, no keyword, no dataset row -- renders as an empty panel.
    That is how the metric delete read before keywords were shown: held,
    opened, nothing on it, Approve enabled. It is also how a request whose
    body has become the live asset reads, and the two look identical to
    someone clicking through a queue, so neither gets an Approve.

    A confident "nothing changed" is the wrong thing to say here, because
    this cannot tell *nothing happens* from *something this page could not
    describe*; so it says that, shows the raw call (``_unreadable_entry``),
    and the approve route refuses the same request. A delete is not empty:
    the asset is the change.
    """
    if not getattr(change_request, "is_open", False):
        return None
    if Operation(change_request.operation) is Operation.DELETE:
        return None
    if changes or _detail_shows_something(detail):
        return None
    return NOTHING_TO_REVIEW


def _unreadable_entry(change_request: Any) -> dict[str, Any]:
    """The raw captured call, for a request with nothing else to show.

    The body, the keywords and which exempt fields it owns, as stored. Not
    pretty, and not meant to be: it is what is there, shown so that a
    reviewer who is told there is nothing to approve can see for themselves
    what the request holds.
    """
    args = change_request.command_args if isinstance(
        change_request.command_args, dict
    ) else {}
    call = {
        "command": args.get(COMMAND_KEY),
        "body": change_request.payload_dict,
        "arguments": captured_arguments(args),
        "exempt_fields_written": captured_exempt_fields(args) or [],
    }
    text, cut = _clip(_text_of(call), SHOWN_VALUE_LIMIT)
    entry: dict[str, Any] = {
        "field": "captured_call",
        "unreadable": True,
        "opaque": True,
        "summary": "The request as it was captured",
        "after": text,
    }
    if cut:
        entry["truncated"] = True
    return entry


def serialize(change_request: ChangeRequest, asset: Any = None) -> dict[str, Any]:
    """One change request, as the UI needs it."""
    changes = describe_changes(change_request, asset)
    detail = dataset_detail(change_request, asset) if asset is not None else None
    blocked = review_blocker(change_request, changes, detail)
    if blocked:
        changes = [_unreadable_entry(change_request)]
    return {
        "id": change_request.id,
        "asset_type": change_request.asset_type,
        "asset_id": change_request.asset_id,
        "asset_title": _asset_title(asset) if asset is not None else None,
        # Whether the asset has a page to send a reviewer to. An archived
        # one does not: Explore on a soft-deleted chart opens empty, says
        # the dataset is missing and carries no review controls, so a client
        # must decide in place instead of navigating. Answered from the
        # asset the server already loaded rather than guessed at from the
        # command, which only ever covered ``restore`` and left every other
        # change about an archived asset walking into the same dead page
        # (R3-01).
        "asset_archived": _is_archived(asset),
        # Whether the author still holds edit access to the asset. Approving
        # is refused once they do not, and ``can_approve`` stays true by
        # decision, so the approver has to be told before they press it
        # (QA-07).
        "author_can_still_edit": _author_can_still_edit(change_request, asset),
        "status": change_request.status,
        "is_open": change_request.is_open,
        "note": change_request.note,
        "review_note": change_request.review_note,
        "author": _user_brief(change_request.author),
        "requested_approver": _user_brief(change_request.requested_approver),
        "reviewer": _user_brief(change_request.reviewer),
        "created_on": change_request.created_on.isoformat()
        if change_request.created_on
        else None,
        "changed_on": change_request.changed_on.isoformat()
        if change_request.changed_on
        else None,
        "submitted_at": change_request.submitted_at.isoformat()
        if change_request.submitted_at
        else None,
        "decided_at": change_request.decided_at.isoformat()
        if change_request.decided_at
        else None,
        # What this change actually alters about the live asset, not which
        # keys the body happens to carry. Superset re-serializes `params`
        # and `json_metadata` on every save, so the keys told a reviewer
        # that those had "Changed" when the author had renamed a chart
        # (129075). Compared against the asset as it stands now, so a
        # reviewer reading this is reading the decision in front of them.
        # The token an approver quotes back when they press Approve, so a
        # request that moved since they loaded it is refused (129070).
        "revision": lifecycle.revision_of(change_request),
        "changed_fields": applied_fields(
            change_request, _asset_for_diff(change_request)
        ),
        # The raw request body. The UI lays it over the live asset to show
        # the dashboard as approving would leave it -- the same composition
        # the command performs, so the preview is the outcome rather than a
        # separate rendering of it. Only ever returned to people already
        # entitled to see the change (the endpoints gate on editorship).
        "proposed": change_request.payload_dict,
        "operation": change_request.operation,
        # Which command approving replays: null for the asset's main update,
        # otherwise e.g. "native_filters". ``proposed`` is that command's
        # body, so a client must not lay it over the asset unless this is
        # null.
        "command": change_request.command_args.get(COMMAND_KEY),
        "changes": changes,
        # Set when there is nothing to show a reviewer, with the reason. A
        # client must not offer Approve while this is set: the server
        # refuses it as well, but a button that can only fail is the same
        # trap as ``can_approve`` was before QA-07.
        "review_blocked": blocked,
        "dataset_detail": detail,
        # The dataset this chart is built on, when it has a change waiting
        # of its own. Approving this one first can publish a chart against
        # columns that do not exist yet (QA-09).
        "pending_dependency": pending_dependency(change_request, asset)
        if asset is not None
        else None,
    }


def _may_see(change_request: ChangeRequest, asset: Any, user_id: int | None) -> bool:
    """Whether this user may read this change request at all.

    Its author, or a strict editor of the asset -- never a viewer, and never
    an administrator on the strength of the role alone (no admin bypass in
    V1, see :mod:`asset_approval.eligibility`). Viewers see no
    workflow UI (SOW 5.5, Visa Q6), so they must not see it through the API.
    """
    if user_id is None:
        return False
    if change_request.author_fk == user_id:
        return True
    return is_strict_editor(asset, user_id)


#: What the Approvals list asks for at a time, and the most it may ask for.
#: The list was unpaginated, so every request on the instance was serialized
#: on every read (R5-04).
DEFAULT_PAGE_SIZE = 25
MAX_PAGE_SIZE = 100


def _requested_page() -> tuple[int, int]:
    """The page the caller asked for, clamped to something sane.

    A missing or unreadable value reads as the first page rather than as an
    error: this endpoint feeds the bell, and a bad query string should not
    be able to empty it.
    """

    def _whole(name: str, default: int) -> int:
        try:
            return int(request.args.get(name, default))
        except (TypeError, ValueError):
            return default

    page = max(_whole("page", 0), 0)
    page_size = min(max(_whole("page_size", DEFAULT_PAGE_SIZE), 1), MAX_PAGE_SIZE)
    return page, page_size


def _authors_named(author_ids: set[int]) -> list[dict[str, Any]]:
    """The authors behind these ids, in one query.

    The From filter offers everyone with something in the current view, so
    it needs names for authors whose rows are not on this page.
    """
    if not author_ids:
        return []
    from superset import security_manager

    user_model = security_manager.user_model
    try:
        users = (
            db.session.query(user_model).filter(user_model.id.in_(author_ids)).all()
        )
    except Exception:  # noqa: BLE001
        # The filter's options are a convenience. The list they sit above is
        # not, so failing to name an author must not empty it.
        logger.warning("asset-approval: could not name the authors in this view")
        return []
    return [brief for user in users if (brief := _user_brief(user)) is not None]


def _requested_author() -> int | None:
    """The author the caller is filtering by, or ``None`` for all of them."""
    raw = request.args.get("author")
    if raw is None or raw == "":
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


class ChangeRequestRestApi(BaseSupersetApi):
    resource_name = "change_request"
    allow_browser_login = True
    class_permission_name = "ChangeRequest"
    openapi_spec_tag = "Change Requests"
    method_permission_name = {
        "list_requests": "read",
        "get_request": "read",
        "for_asset": "read",
        "open_for_type": "read",
        "pending_count": "read",
        "enabled": "read",
        "submit": "write",
        # The reviewer actions sit on ``can_write`` like the rest. Who may
        # approve is not a role: it is whoever else edits the asset, which
        # ``eligibility.can_approve`` decides per change request. S-05 asked
        # for a separate permission and one was built; it was removed again
        # because it contradicted the mockups, and because a role gate on
        # top of editorship can only ever stop a legitimate editor
        # approving.
        "approve": "write",
        "request_changes": "write",
        # Author and editor actions. ``withdraw`` is the author's own
        # (lifecycle.withdraw), and SOW 5.3 lets any editor ``discard`` so
        # one abandoned draft cannot block an asset.
        "withdraw": "write",
        "discard": "write",
    }

    # ------------------------------------------------------------------ reads

    @expose("/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def list_requests(self) -> FlaskResponse:
        """The four SOW views, selected by ``?show=``.

        ``for_me`` is the only one that drives the notification count. It
        excludes the viewer's own work in flight, because a request you
        submitted is not a request that needs you (Decision 9) -- with one
        exception, which is the whole of sc-131033. A change an approver
        sent *back* is waiting on nobody but its author. The bell already
        counted it, so an author saw a badge of 1, clicked "View all
        approvals", landed here and was told "Nothing needs you right now".
        Mock 16c asks for the Approvals count to match the bell, and it
        could not while this view dropped half of what the bell counts.

        Whatever the view, a row is only returned to someone entitled to see
        that request: its author, or a strict editor of the asset (the same
        test ``get_request`` applies). ``can_read`` on ChangeRequest is a
        route permission every role may hold; it is not a licence to read
        other people's pending work on assets the reader has no say over.
        """
        if not is_enabled():
            return self.response(200, result=[], count=0)

        show = request.args.get("show", "for_me")
        user_id = get_user_id()
        query = db.session.query(ChangeRequest)

        if show == "submitted_by_me":
            query = query.filter(ChangeRequest.author_fk == user_id)
        elif show == "recently_decided":
            query = query.filter(
                ChangeRequest.status.in_(
                    [ChangeStatus.APPROVED.value, ChangeStatus.DISCARDED.value]
                ),
                or_(
                    ChangeRequest.author_fk == user_id,
                    ChangeRequest.reviewer_fk == user_id,
                ),
            ).order_by(ChangeRequest.decided_at.desc())
        elif show == "all_pending":
            query = query.filter(
                ChangeRequest.status == ChangeStatus.PENDING.value
            )
        else:  # for_me
            query = query.filter(
                or_(
                    # Waiting on this reader as an approver.
                    and_(
                        ChangeRequest.status == ChangeStatus.PENDING.value,
                        ChangeRequest.author_fk != user_id,
                    ),
                    # Or waiting on them as the author who has to act on it.
                    and_(
                        ChangeRequest.status
                        == ChangeStatus.CHANGES_REQUESTED.value,
                        ChangeRequest.author_fk == user_id,
                    ),
                )
            )

        # Paging needs a total order. ``decided_at`` can tie and the other
        # views had no order at all, so rows could repeat or go missing
        # between one page and the next.
        query = query.order_by(ChangeRequest.id.desc())

        page, page_size = _requested_page()
        first = page * page_size
        last = first + page_size
        wanted_type = (request.args.get("asset_type") or "").strip() or None
        wanted_author = _requested_author()
        needle = (request.args.get("name") or "").strip().lower()

        results = []
        author_ids: set[int] = set()
        visible = 0
        for change_request in query.all():
            asset = _asset_of(change_request)
            if asset is None:
                continue
            # Never list a request on an asset this user has no say over.
            approvable = can_approve(change_request, asset, user_id)
            if show == "for_me":
                # ``can_approve`` is false for your own change by design, so
                # the returned row has to be admitted on the other ground or
                # the widened filter above would be undone here.
                returned_to_me = (
                    change_request.author_fk == user_id
                    and ChangeStatus(change_request.status)
                    is ChangeStatus.CHANGES_REQUESTED
                )
                if not approvable and not returned_to_me:
                    continue
            elif not _may_see(change_request, asset, user_id):
                continue

            # Every author with something in this view, collected before the
            # filters narrow it. The From filter used to be built from the
            # rows the browser happened to hold, so once the list was paged
            # it could only offer the authors on the current page.
            #
            # Ids here and names once at the end: reading
            # ``change_request.author`` per row is a query per row, which is
            # the shape of problem this endpoint is being fixed for.
            if change_request.author_fk is not None:
                author_ids.add(change_request.author_fk)

            # The filters are applied here rather than in SQL so that the
            # author list above still sees the whole view, and so that a
            # search by name can use the asset's title, which lives on the
            # asset and not on the request.
            if wanted_type and change_request.asset_type != wanted_type:
                continue
            if wanted_author is not None and change_request.author_fk != wanted_author:
                continue
            if needle and needle not in (_asset_title(asset) or "").lower():
                continue
            # Only the rows on the page the client asked for are serialized.
            # That is where the time went: ``serialize`` diffs the request
            # against its asset, and doing it for every row made the list
            # take seconds once an instance had a hundred of them (R5-04).
            #
            # Every visible row is still counted, because the bell's number
            # and this endpoint are the same read, and a count that stopped
            # at the page would quietly under-report what needs review.
            if first <= visible < last:
                # Carried per row, not just used as a filter: the list writes
                # each status from the reader's point of view -- "Needs your
                # review" against "Awaiting review" -- and offers Review or
                # Open accordingly, which it cannot decide without this. It is
                # already computed for `for_me`, and `_may_see` has loaded the
                # same asset.
                payload = serialize(change_request, asset)
                payload["can_approve"] = approvable
                payload["is_author"] = change_request.author_fk == user_id
                results.append(payload)
            visible += 1

        return self.response(
            200,
            result=results,
            count=visible,
            page=page,
            page_size=page_size,
            authors=_authors_named(author_ids),
        )

    @expose("/<int:pk>", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def get_request(self, pk: int) -> FlaskResponse:
        """One change request, with who may act on it."""
        try:
            change_request = lifecycle.find(pk)
        except ChangeRequestNotFoundError:
            return self.response_404()

        asset = _asset_of(change_request)
        if asset is None:
            return self.response_404()

        user_id = get_user_id()
        if not _may_see(change_request, asset, user_id):
            # Viewers see no workflow UI at all (SOW 5.5, Visa Q6), so they
            # must not be able to read one through the API either.
            return self.response_403()

        payload = serialize(change_request, asset)
        payload["can_approve"] = can_approve(change_request, asset, user_id)
        payload["is_author"] = change_request.author_fk == user_id
        payload["eligible_approvers"] = [
            _user_brief(u)
            for u in eligible_approvers(asset, exclude_user_id=change_request.author_fk)
        ]
        return self.response(200, result=payload)

    @expose("/asset/<asset_type>/<int:asset_id>", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def for_asset(self, asset_type: str, asset_id: int) -> FlaskResponse:
        """The asset's open request, if it has one.

        What the banner on a dashboard is built from. Returns an empty
        result rather than 404 when there is nothing open, because "no
        pending change" is the normal case, not an error.
        """
        if not is_enabled():
            return self.response(200, result=None)
        try:
            kind = AssetType(asset_type)
        except ValueError:
            return self.response_400(message=f"Unknown asset type {asset_type!r}.")

        change_request = (
            db.session.query(ChangeRequest)
            .filter(
                ChangeRequest.asset_type == kind.value,
                ChangeRequest.asset_id == asset_id,
                ChangeRequest.status.in_([s.value for s in OPEN_STATUSES]),
            )
            .one_or_none()
        )
        if change_request is None:
            # Nothing open. Before answering "nothing to show", look for a
            # decision this asset's author has not had a chance to see yet.
            #
            # An approval was silent: the reviewer's page reloads itself,
            # and the author found out by opening the dashboard later and
            # noticing it had changed. Their own change going live is the
            # one outcome they are waiting for, and the product said
            # nothing about it. A short window, because this is a nudge on
            # the way past rather than a record -- the history is in
            # version history, and SOW Q7 is clear that Visa keeps none of
            # its own.
            change_request = (
                db.session.query(ChangeRequest)
                .filter(
                    ChangeRequest.asset_type == kind.value,
                    ChangeRequest.asset_id == asset_id,
                    ChangeRequest.status == ChangeStatus.APPROVED.value,
                    ChangeRequest.author_fk == get_user_id(),
                    ChangeRequest.decided_at.isnot(None),
                    ChangeRequest.decided_at
                    >= datetime.now(timezone.utc) - RECENTLY_DECIDED,
                )
                .order_by(ChangeRequest.decided_at.desc())
                .first()
            )

        if change_request is None:
            return self.response(200, result=None)

        asset = _asset_of(change_request)
        user_id = get_user_id()
        if asset is None or not _may_see(change_request, asset, user_id):
            # A viewer gets the same answer as if nothing were pending.
            return self.response(200, result=None)

        payload = serialize(change_request, asset)
        payload["can_approve"] = can_approve(change_request, asset, user_id)
        payload["is_author"] = change_request.author_fk == user_id
        # The banner names who can approve, so the author is not left
        # guessing who to chase. Excludes the author, who never can.
        payload["eligible_approvers"] = [
            _user_brief(u)
            for u in eligible_approvers(
                asset, exclude_user_id=change_request.author_fk
            )
        ]
        return self.response(200, result=payload)

    @expose("/open/<asset_type>", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def open_for_type(self, asset_type: str) -> FlaskResponse:
        """Every open change on one asset kind, as {asset_id: status}.

        Built for list pages, which need to tag many rows at once. Asking
        the per-asset endpoint once per row would turn one list into fifty
        requests.

        Only rows this user may know about are returned: an editor of the
        asset, or its author. A viewer gets an empty map, which renders as
        no tags at all -- the same thing they would see with the feature off
        (SOW 5.5, Visa Q6).
        """
        if not is_enabled():
            return self.response(200, result={})
        try:
            kind = AssetType(asset_type)
        except ValueError:
            return self.response_400(message=f"Unknown asset type {asset_type!r}.")

        user_id = get_user_id()
        result: dict[str, str] = {}
        for change_request in (
            db.session.query(ChangeRequest)
            .filter(
                ChangeRequest.asset_type == kind.value,
                ChangeRequest.status.in_([s.value for s in OPEN_STATUSES]),
            )
            .all()
        ):
            asset = _asset_of(change_request)
            if asset is None:
                continue
            if not _may_see(change_request, asset, user_id):
                continue
            result[str(change_request.asset_id)] = change_request.status
        return self.response(200, result=result)

    @expose("/enabled", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def enabled(self) -> FlaskResponse:
        """Whether review is required on this instance (SOW 5.7).

        Read by the Change review page, which describes the behaviour the
        flag turns on and so needs to say truthfully whether it is on. The
        flag is process-static, so this is a report, not a control.
        """
        return self.response(200, result={"enabled": is_enabled()})

    @expose("/count", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def pending_count(self) -> FlaskResponse:
        """The bell's red number.

        Only what needs *this* person: reviews waiting on them, plus their
        own changes that came back. Hidden at zero, never a badge for things
        they merely participated in (Decision 9).
        """
        if not is_enabled():
            return self.response(200, result={"needs_me": 0, "returned": 0})

        user_id = get_user_id()
        needs_me = 0
        for change_request in (
            db.session.query(ChangeRequest)
            .filter(
                ChangeRequest.status == ChangeStatus.PENDING.value,
                ChangeRequest.author_fk != user_id,
            )
            .all()
        ):
            asset = _asset_of(change_request)
            if asset is not None and can_approve(change_request, asset, user_id):
                needs_me += 1

        returned = (
            db.session.query(ChangeRequest)
            .filter(
                ChangeRequest.status == ChangeStatus.CHANGES_REQUESTED.value,
                ChangeRequest.author_fk == user_id,
            )
            .count()
        )
        return self.response(
            200, result={"needs_me": needs_me, "returned": returned}
        )

    # ----------------------------------------------------------------- writes

    @expose("/<int:pk>/submit", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    def submit(self, pk: int) -> FlaskResponse:
        # ``silent`` because every field here is optional: a client that
        # approves or submits with no body at all is making a legitimate
        # request, and Flask's strict parse would answer 400 before the
        # authorization check ever ran -- turning "you may not approve your
        # own change" into a malformed-request error.
        body = request.get_json(silent=True) or {}
        return self._act(
            lambda: lifecycle.submit(
                pk,
                note=body.get("note"),
                requested_approver_id=body.get("requested_approver_id"),
            ),
            "Review requested.",
            reload_pk=pk,
        )

    @expose("/<int:pk>/approve", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    def approve(self, pk: int) -> FlaskResponse:
        body = request.get_json(silent=True) or {}
        if (refusal := self._refusal_to_approve_blind(pk)) is not None:
            return refusal
        return self._act(
            lambda: lifecycle.approve(
                pk,
                note=body.get("note"),
                # What the approver's page was showing. Sent back so a
                # change that moved underneath them is refused rather than
                # published unread (129070).
                seen_revision=body.get("seen_revision"),
            ),
            "Changes approved and published.",
            reload_pk=pk,
        )

    @expose("/<int:pk>/request_changes", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    def request_changes(self, pk: int) -> FlaskResponse:
        body = request.get_json(silent=True) or {}
        return self._act(
            lambda: lifecycle.request_changes(pk, body.get("review_note", "")),
            "Changes requested.",
            reload_pk=pk,
        )

    @expose("/<int:pk>/withdraw", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    def withdraw(self, pk: int) -> FlaskResponse:
        return self._act(
            lambda: lifecycle.withdraw(pk),
            "Request withdrawn. Your changes are editable again.",
            reload_pk=pk,
        )

    @expose("/<int:pk>/discard", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    def discard(self, pk: int) -> FlaskResponse:
        return self._act(
            lambda: lifecycle.discard(pk), "Changes discarded.", reload_pk=pk
        )

    # ----------------------------------------------------------------- shared

    def _refusal_to_approve_blind(self, pk: int) -> FlaskResponse | None:
        """422 for a pending request that shows a reviewer nothing to approve.

        The panels disable Approve for it, but the answer cannot live only in
        a client: a request with nothing on it is one a reviewer cannot have
        read, and approving it is approving blind whoever sends the call.
        Asked only of someone who could approve it, so a caller who could not
        is answered by the workflow as before and learns nothing from this.
        """
        try:
            change_request = lifecycle.find(pk)
        except ChangeRequestNotFoundError:
            return None
        if ChangeStatus(change_request.status) is not ChangeStatus.PENDING:
            return None
        asset = _asset_of(change_request)
        if asset is None or not can_approve(change_request, asset, get_user_id()):
            return None
        reason = review_blocker(
            change_request,
            describe_changes(change_request, asset),
            dataset_detail(change_request, asset),
        )
        return self.response(422, message=reason) if reason else None

    def _act(
        self, action: Any, message: str, reload_pk: int | None = None
    ) -> FlaskResponse:
        """Run a lifecycle action and map its refusals onto status codes.

        Every refusal the workflow can raise is answered here rather than in
        each endpoint, so the five actions cannot drift apart in how they
        report the same problem.
        """
        try:
            action()
        except ChangeRequestNotFoundError:
            return self.response_404()
        except ApprovalForbiddenError as ex:
            return self.response(403, message=str(ex))
        except (ReviewNoteRequiredError, NoEligibleApproverError) as ex:
            return self.response(422, message=str(ex))
        except (
            AuthorNoLongerEditorError,
            InvalidTransitionError,
            ReviewedVersionStaleError,
            StaleBaselineError,
        ) as ex:
            # Conflicts rather than bad requests: the call was fine, either
            # the request or the asset under it had already moved on.
            return self.response(409, message=str(ex))
        except ReplayFailedError as ex:
            return self.response(ex.status, message=str(ex))
        except ChangeManagementException as ex:
            logger.exception("Change request action failed")
            return self.response(500, message=str(ex))

        pk = reload_pk
        try:
            change_request = lifecycle.find(pk) if pk else None
        except ChangeRequestNotFoundError:
            change_request = None
        result = (
            serialize(change_request, _asset_of(change_request))
            if change_request
            else None
        )
        return self.response(200, message=message, result=result)


#: The column and metric fields a reviewer reads first, in the order they are
#: listed. This is a presentation order and not a filter: every other field a
#: proposed column or metric carries is compared and listed after these. It
#: used to be the whole list, so a column's ``warning_markdown`` or a metric's
#: ``warning_text`` moved without the dialog noticing and the reviewer read
#: "No column changed." beside an enabled Approve (the banner that went to
#: every viewer was seen on screen).
#:
#: ``verbose_name`` leads both because it is the label the dataset shows
#: everywhere a person meets it. Leaving it out of the columns meant a
#: proposal that renamed a column reported nothing changed, and the reviewer
#: approved a relabelling they were never shown (R4-05).
COLUMN_FIELDS = (
    "verbose_name",
    "type",
    "expression",
    "description",
    "is_dttm",
    "filterable",
    "groupby",
)
METRIC_FIELDS = ("verbose_name", "expression", "metric_type", "description", "d3format")


def _by_key(items: Any, key: str) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for item in items or []:
        if isinstance(item, dict):
            name = item.get(key)
        else:
            name = getattr(item, key, None)
        if name:
            out[str(name)] = item
    return out


def _asset_of(change_request: Any) -> Any:
    """The asset a change request is about.

    ``include_deleted`` for a restore, because the whole point of one is
    that the asset is archived. Without it every read path -- the queue,
    the request's own page, the per-asset lookup, the list tags, the bell
    -- loaded nothing and dropped the row, so a restore request was
    invisible to its own author: it could not be submitted, approved or
    discarded, and it held the asset's one open slot for good, which
    stopped any further change to that asset as well (R3-01).
    """
    return load_asset(
        AssetType(change_request.asset_type),
        change_request.asset_id,
        include_deleted=is_restore(change_request),
    )


def _asset_for_diff(change_request: Any) -> Any:
    """The live asset a change is measured against, or None if unreadable."""
    try:
        return _asset_of(change_request)
    except Exception:  # noqa: BLE001 -- a diff must never break the listing
        logger.warning(
            "asset-approval: could not load %s %s to diff against",
            change_request.asset_type,
            change_request.asset_id,
            exc_info=True,
        )
        return None


def _field_of(item: Any, field: str) -> Any:
    return item.get(field) if isinstance(item, dict) else getattr(item, field, None)


def _diff_named(
    current: Any, proposed: Any, key: str, fields: tuple[str, ...]
) -> dict[str, list[dict[str, Any]]]:
    """Added / changed / removed, by name.

    Named rather than positional because that is how a person reads a
    dataset: they care that `revenue` changed, not that row 7 did.

    ``fields`` says which to list first. Which fields are *compared* is the
    proposal's: every key it carries, judged by the gate's own test for
    whether two values are the same.
    """
    before, after = _by_key(current, key), _by_key(proposed, key)
    added = [
        {"name": n, "fields": _stated_values(after[n], fields, key, arriving=True)}
        for n in sorted(set(after) - set(before))
    ]
    removed = [
        {"name": n, "fields": _stated_values(before[n], fields, key, arriving=False)}
        for n in sorted(set(before) - set(after))
    ]
    changed = []
    for name in sorted(set(before) & set(after)):
        # Only the fields the proposal actually carries. A dataset body may
        # describe a column by the few keys it is changing, and reading an
        # absent key as ``None`` reported every other field as cleared --
        # burying the one real edit under a column of invented ones.
        present = _fields_present(after[name], fields, key)
        deltas = [
            {
                "field": f,
                "before": _render(_field_of(before[name], f))[0],
                "after": _render(_field_of(after[name], f))[0],
            }
            for f in present
            if _field_moved(_field_of(before[name], f), _field_of(after[name], f))
        ]
        if deltas:
            changed.append({"name": name, "fields": deltas})
    return {"added": added, "changed": changed, "removed": removed}


def _field_moved(was: Any, now: Any) -> bool:
    """Whether a column's or metric's field differs, as the gate judges it.

    The gate's own test (``changes._named_list_differs``), so the dialog lists
    exactly the fields the gate counted: an ``extra`` of ``"{}"`` against a
    stored NULL is two spellings of nothing and not an edit, while a field
    emptied is one.
    """
    if _is_nothing(was) and _is_nothing(now):
        return False
    return bool(_parsed(was) != _parsed(now))


def _fields_present(item: Any, fields: tuple[str, ...], key: str) -> tuple[str, ...]:
    """The compared fields this proposal has an opinion about.

    A proposed entry is a dict, and *all* of its keys are compared, the listed
    ones first. An object (a stored row) can only be asked for the listed
    ones, which is why the listed ones are what a removed entry states.
    """
    if not isinstance(item, dict):
        return fields
    rest = sorted(
        (
            name
            for name in item
            if name not in fields
            and name != key
            and name not in IGNORED_FIELDS
            and name not in IDENTITY_FIELDS
        ),
        key=str,
    )
    return tuple(f for f in fields if f in item) + tuple(rest)


def _stated_values(
    item: Any, fields: tuple[str, ...], key: str, arriving: bool
) -> list[dict[str, Any]]:
    """What an added or removed entry actually says, field by field.

    A name on its own tells a reviewer that a metric arrived but not what it
    computes, so the one thing worth deciding about -- its expression -- was
    the one thing missing (R4-05). Carried in the same shape the changed
    entries use, so the panel renders all three the same way: an arrival has
    no "before", a departure has no "after".
    """
    stated = []
    for field in _fields_present(item, fields, key):
        value = _field_of(item, field)
        if _is_nothing(value):
            continue
        shown = _render(value)[0]
        stated.append(
            {
                "field": field,
                "before": None if arriving else shown,
                "after": shown if arriving else None,
            }
        )
    return stated


def dataset_impact(asset: Any) -> dict[str, int]:
    """How far a dataset change reaches.

    dbt Cloud shows downstream impact on a model change and Matt's
    prototype called it "Potential impact"; the SOW asks for the same here.
    Approving a dataset edit is approving it for every chart built on it,
    and the reviewer should be told how many that is before they do.
    """
    from superset.models.slice import Slice  # pylint: disable=import-outside-toplevel

    charts = (
        db.session.query(Slice)
        .filter(
            Slice.datasource_id == asset.id,
            Slice.datasource_type == "table",
        )
        .all()
    )
    dashboard_ids = {d.id for chart in charts for d in (chart.dashboards or [])}
    return {"charts": len(charts), "dashboards": len(dashboard_ids)}


def pending_dependency(
    change_request: ChangeRequest, asset: Any
) -> dict[str, Any] | None:
    """The chart's dataset, when it has a change of its own still open.

    Approving replays the author's body over whatever is live, so a chart
    approved before the dataset change it was written against publishes a
    chart referencing columns or metrics that do not exist yet. Viewers get
    a broken chart and nothing warned the approver (QA-09).

    A warning, not a refusal. The one-open-change-per-asset rule means two
    editors can hold the chart and the dataset separately, so enforcing an
    order would deadlock the pair; and SOW 5.3 scopes that rule to a single
    asset, so a cross-asset ordering is a wider change than this is. The
    approver is told and decides.

    A dashboard is warned about the same way, about the charts on it: a
    dashboard approved while one of its charts has a change of its own
    waiting publishes the dashboard around a chart the approver has not
    seen, and nothing said so either (R4-03).

    ``None`` when there is nothing to say, which is the common case.
    """
    if asset is None:
        return None
    kind = AssetType(change_request.asset_type)
    if kind is AssetType.DASHBOARD:
        return _chart_on_the_dashboard_with_a_change(asset)
    if kind is AssetType.CHART:
        return _dataset_under_the_chart_with_a_change(asset)
    return None


def _dataset_under_the_chart_with_a_change(chart: Any) -> dict[str, Any] | None:
    """The chart's dataset, when it has a change of its own still open."""
    # Charts can also sit on a semantic view, which has no change requests
    # of its own; ``dataset_impact`` guards the same way.
    if getattr(chart, "datasource_type", None) != "table":
        return None
    datasource_id = getattr(chart, "datasource_id", None)
    if datasource_id is None:
        return None

    open_request = find_open_request(AssetType.DATASET, datasource_id)
    if open_request is None:
        return None
    return {
        "asset_type": AssetType.DATASET.value,
        "asset_id": datasource_id,
        "change_request_id": open_request.id,
        "status": open_request.status,
        "author": _user_brief(open_request.author),
        "title": _asset_title(getattr(chart, "datasource", None)),
        "count": 1,
    }


def _chart_on_the_dashboard_with_a_change(dashboard: Any) -> dict[str, Any] | None:
    """A chart on this dashboard that is itself waiting for a decision.

    One of them, with a count: the approver needs to know the dashboard is
    not the whole picture and who to ask, not a roll call. The oldest
    request is named, because that is the one most likely to be forgotten.
    """
    chart_ids = [
        chart.id for chart in (getattr(dashboard, "slices", None) or []) if chart.id
    ]
    if not chart_ids:
        return None

    waiting = (
        db.session.query(ChangeRequest)
        .filter(
            ChangeRequest.asset_type == AssetType.CHART.value,
            ChangeRequest.asset_id.in_(chart_ids),
            ChangeRequest.status.in_([status.value for status in OPEN_STATUSES]),
        )
        .order_by(ChangeRequest.created_on)
        .all()
    )
    if not waiting:
        return None

    oldest = waiting[0]
    charts = {chart.id: chart for chart in (dashboard.slices or [])}
    return {
        "asset_type": AssetType.CHART.value,
        "asset_id": oldest.asset_id,
        "change_request_id": oldest.id,
        "status": oldest.status,
        "author": _user_brief(oldest.author),
        "title": _asset_title(charts.get(oldest.asset_id)),
        "count": len(waiting),
    }


def dataset_detail(
    change_request: ChangeRequest, asset: Any
) -> dict[str, Any] | None:
    """A dataset reviewed as a definition, not as rendered charts.

    Visa Q11: datasets are reviewed as a diff of columns, metrics and SQL,
    and charts are deliberately not re-rendered against the draft. A dataset
    change is a change to a contract, and the contract is what to look at.
    """
    if AssetType(change_request.asset_type) is not AssetType.DATASET:
        return None
    if Operation(change_request.operation) is Operation.DELETE:
        return {"impact": dataset_impact(asset)}

    body = change_request.payload_dict
    detail: dict[str, Any] = {"impact": dataset_impact(asset)}

    if "sql" in body:
        detail["sql"] = {
            "before": getattr(asset, "sql", None),
            "after": body.get("sql"),
        }
    if "columns" in body:
        detail["columns"] = _diff_named(
            getattr(asset, "columns", []), body["columns"], "column_name", COLUMN_FIELDS
        )
    if "metrics" in body:
        detail["metrics"] = _diff_named(
            getattr(asset, "metrics", []), body["metrics"], "metric_name", METRIC_FIELDS
        )
    if settings := _dataset_settings(change_request, asset):
        detail["settings"] = settings
    return detail


#: Dataset fields the review dialog already has a tab of their own for.
#: Everything else a dataset change carries had nowhere to be shown at all.
DATASET_FIELDS_SHOWN_ELSEWHERE = frozenset({"sql", "columns", "metrics"})


def _dataset_settings(
    change_request: ChangeRequest, asset: Any
) -> list[dict[str, Any]]:
    """Every other dataset field this change moves, as a before/after pair.

    The dialog had exactly three tabs -- Source, Metrics, Columns -- and
    ``dataset_detail`` emitted exactly those three, so a payload carrying
    any other changed field was replayed on approve and shown **nowhere**.
    A reviewer read "No column changed." and approved a rewritten
    ``fetch_values_predicate``, a moved ``main_dttm_col``, a new
    ``template_params`` or an ``extra.warning_markdown`` that puts a banner
    in front of every viewer, without ever seeing it. That is a
    review-integrity gap of the same family this feature exists to close
    (129075).

    Which fields moved is the gate's question, asked here rather than
    answered again, so the dialog cannot come to disagree with the capture.
    ``description`` and the other exempt fields appear when they ride along
    with a governed change: the exemption is per-write, so the write is
    governed and the reviewer is approving the description too.

    Shown through the same renderers ``describe_changes`` uses, so a long
    value is shortened and *said* to be shortened rather than silently
    dropped, and a value that is a list or an object is shown as the things in
    it (flagged ``opaque`` because it is not a scalar) rather than reduced to
    the word "Changed".
    """
    body = change_request.payload_dict
    settings: list[dict[str, Any]] = []
    for field in applied_fields(change_request, asset):
        if field in DATASET_FIELDS_SHOWN_ELSEWHERE:
            continue
        current = getattr(asset, field, None)
        proposed = body.get(field)
        if _is_collection(current) or _is_collection(proposed):
            settings.append(_collection_entry(field, current, proposed))
        else:
            settings.append(_scalar_entry(field, current, proposed))
    return settings
