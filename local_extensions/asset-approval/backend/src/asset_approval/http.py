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
"""Turning gate signals into HTTP responses.

Shared by the dashboard, chart and dataset APIs so all three answer a
captured write identically. The strings come from the agreed copy sheet:
a gated save never says "Overwritten" (SOW 5.5), because nothing was
overwritten -- the live asset is exactly as the viewer last saw it.
"""

from __future__ import annotations

from typing import Any

from asset_approval.changes import LAYOUT_PUT_BACK_PREFIX
from asset_approval.exceptions import (
    AssetLockedError,
    ChangeManagementException,
    ChangeRequestCreated,
)
from superset.change_management import review_signal_details

#: A capture is not a failure and not a plain success: the request was
#: accepted, and it takes a second person before it takes effect.
#: Read off the exception rather than written twice -- the two disagreeing
#: is what left MCP callers reading "Internal error" (QA-13).
CAPTURED_STATUS = ChangeRequestCreated.status

#: SOW 5.3: only one set of changes may be open on an asset at a time.
LOCKED_STATUS = 409

SAVED_MESSAGE = "Changes saved. Viewers still see the live version."
UPDATED_MESSAGE = "Changes updated in your existing draft."
BULK_MESSAGE = "%s changes saved as drafts. Viewers still see the live versions."
DELETE_MESSAGE = (
    "Delete saved as a draft. Nothing has been removed. Request review when "
    "you are ready."
)
UPDATED_REPLACED_DELETE_MESSAGE = (
    "Changes saved in place of the delete you had waiting, which is no "
    "longer requested. Request review when you are ready."
)
UPDATED_LEFT_REVIEW_MESSAGE = (
    "Changes updated in your draft, which has been taken back out of "
    "review. Request review again when you are ready."
)
DELETE_REPLACED_MESSAGE = (
    "Delete saved as a draft. Nothing has been removed, and it replaced the "
    "edit you had waiting. Request review when you are ready."
)
BULK_DELETE_MESSAGE = (
    "%s deletes saved as drafts. Nothing has been removed. Request review on "
    "each when you are ready."
)

#: Appended to a capture that put settings back to the live value.
#:
#: A sentence rather than a refusal. An editing surface that opens on the
#: live asset instead of on the author's open proposal posts the live value
#: back for every field it carries, so a second save silently undoes the
#: first; this is the only thing in the answer that says so, and it reaches
#: every HTTP caller -- the REST API included -- rather than only the
#: surfaces where a dialog could have warned.
#:
#: **Not yet the MCP tool result.** That text is written in core, by
#: ``mcp_service.middleware._captured_result`` from
#: ``change_management.review_signal_details``, neither of which reads this
#: module, and an MCP tool call never produces a 202 body to read it from.
#: Carrying it there means adding ``reverted_fields`` to
#: ``review_signal_details`` and to the tool's own sentence, which is a
#: change in core; until then the signal carries the list and the MCP
#: result does not say it.
#:
#: Written as what happened, not as an accusation: a deliberate revert
#: produces this sentence too, and it is true of one.
PUT_BACK_ONE_MESSAGE = (
    "This save put back 1 setting your draft had changed: %s."
)
PUT_BACK_MANY_MESSAGE = (
    "This save put back %d settings your draft had changed: %s."
)

#: How many names the sentence carries before it starts counting instead.
#: An Explore save posts every control, so a draft measured against a body
#: written from the live chart can legitimately name scores of settings, and
#: a sentence that long reads as a fault rather than as information.
NAMED_PUT_BACK_LIMIT = 5


#: What a save says when it undid layout the draft had changed. Not "settings":
#: a layout is charts, rows and tabs on the dashboard, and the names that follow
#: are the ones the review panel uses, so the author can find each one there.
LAYOUT_UNDONE_ONE_MESSAGE = "%s undid 1 layout change your draft had made: %s."
LAYOUT_UNDONE_MANY_MESSAGE = "%s undid %d layout changes your draft had made: %s."


def _named(items: list[str]) -> str:
    shown = items[:NAMED_PUT_BACK_LIMIT]
    named = ", ".join(shown)
    if len(items) > len(shown):
        named = f"{named} and {len(items) - len(shown)} more"
    return named


def _layout_count(item: str) -> int:
    """How many components one collapsed entry ("removed row x2") stands for."""
    head, _, tail = item.rpartition(" x")
    return int(tail) if head and tail.isdigit() else 1


def put_back_sentence(fields: list[str]) -> str:
    """What a fold says about the settings it returned to the live value.

    Empty for the ordinary case, so callers can append it unconditionally.
    Layout entries (``LAYOUT_PUT_BACK_PREFIX``) are said separately and in
    their own words: a count of layout changes, then which, rather than a
    "setting" with a column name.
    """
    if not fields:
        return ""
    layout = [
        field[len(LAYOUT_PUT_BACK_PREFIX) :]
        for field in fields
        if field.startswith(LAYOUT_PUT_BACK_PREFIX)
    ]
    settings = [f for f in fields if not f.startswith(LAYOUT_PUT_BACK_PREFIX)]
    sentences = []
    if settings:
        named = _named(settings)
        sentences.append(
            PUT_BACK_ONE_MESSAGE % named
            if len(settings) == 1
            else PUT_BACK_MANY_MESSAGE % (len(settings), named)
        )
    if layout:
        total = sum(_layout_count(item) for item in layout)
        lead = "It also" if settings else "This save"
        sentences.append(
            LAYOUT_UNDONE_ONE_MESSAGE % (lead, _named(layout))
            if total == 1
            else LAYOUT_UNDONE_MANY_MESSAGE % (lead, total, _named(layout))
        )
    return " ".join(sentences)


def captured_message(ex: ChangeRequestCreated) -> str:
    """What a captured write tells the caller it did.

    One function because there is one answer. This used to be decided twice
    -- once here for a response built off the API object, once again inside
    ``signal_response`` -- and the second copy knew only about deletes, so
    ``DELETE_REPLACED_MESSAGE`` and ``UPDATED_MESSAGE`` were written,
    tested, and then never reached a caller.
    """
    return " ".join(part for part in (_what_was_captured(ex), _put_back(ex)) if part)


def _put_back(ex: ChangeRequestCreated) -> str:
    """``getattr``: the message is also built from stand-ins for the signal."""
    return put_back_sentence(list(getattr(ex, "reverted_fields", None) or []))


def _what_was_captured(ex: ChangeRequestCreated) -> str:
    deleting = getattr(ex, "operation", "update") == "delete"
    if ex.count > 1:
        # A bulk delete or an import captures several assets, each reviewed
        # on its own, so the count is the useful thing to say (SOW 5.1).
        return (BULK_DELETE_MESSAGE if deleting else BULK_MESSAGE) % ex.count
    if deleting:
        # Never "Changes saved" for a delete: the asset is untouched and
        # saying it was saved describes the wrong act entirely. And where
        # the delete took the place of an edit, say so -- the dialogs warn
        # first, but a caller that never saw one otherwise loses the edit
        # with nothing in the answer to show for it (QA-03).
        return DELETE_REPLACED_MESSAGE if ex.replaced_edit else DELETE_MESSAGE
    if ex.updated_existing:
        # The mirror of DELETE_REPLACED_MESSAGE above. A save that takes the
        # place of a delete discards a different request, and one that folds
        # into a submitted request pulls it out of review and empties the
        # approver's queue. Both used to answer "Changes updated in your
        # existing draft", which describes neither (129078).
        if ex.replaced_delete:
            return UPDATED_REPLACED_DELETE_MESSAGE
        if ex.left_review:
            return UPDATED_LEFT_REVIEW_MESSAGE
        # A second save by the same author folds into the draft they already
        # have. "Changes saved" again reads as though a new one was made
        # and leaves them looking for it (QA-11).
        return UPDATED_MESSAGE
    return SAVED_MESSAGE


def signal_response(ex: ChangeManagementException) -> tuple[dict[str, Any], int]:
    """The body and status any gate signal answers with, in one place.

    Two different mechanisms have to produce the same answer. Where the
    signal reaches Flask, an error handler returns this. Where it does not
    -- Flask-AppBuilder's ``safe`` decorator catches ``Exception`` and turns
    anything it sees into a 500, which is most of the asset APIs -- an
    ``after_request`` hook substitutes this instead. Both read the answer
    from here so the two paths cannot drift.
    """
    if isinstance(ex, ChangeRequestCreated):
        # Read through core's reader, which the MCP middleware also uses,
        # so the 202 body and the tool result cannot come to describe the
        # same capture differently (QA-13).
        details = review_signal_details(ex)
        return (
            {
                "id": details["id"],
                "ids": details["ids"],
                "count": details["count"],
                "asset_type": details["asset_type"],
                "asset_id": details["asset_id"],
                "review_required": True,
                "message": captured_message(ex),
                # The same tripwire the sentence carries, as data. A QA run
                # -- or any client -- can assert that a save put work back
                # without parsing English out of ``message`` (SOW 5.5 owns
                # the copy; this is the oracle).
                "reverted_fields": list(getattr(ex, "reverted_fields", None) or []),
            },
            CAPTURED_STATUS,
        )
    if isinstance(ex, AssetLockedError):
        return (
            {
                "asset_type": ex.asset_type,
                "asset_id": ex.asset_id,
                "author": getattr(ex, "author", None),
                "message": str(ex),
            },
            LOCKED_STATUS,
        )
    return {"message": str(ex)}, getattr(ex, "status", 400)
