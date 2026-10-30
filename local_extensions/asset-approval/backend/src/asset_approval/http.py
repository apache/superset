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
DELETE_REPLACED_MESSAGE = (
    "Delete saved as a draft. Nothing has been removed, and it replaced the "
    "edit you had waiting. Request review when you are ready."
)
BULK_DELETE_MESSAGE = (
    "%s deletes saved as drafts. Nothing has been removed. Request review on "
    "each when you are ready."
)


def captured_message(ex: ChangeRequestCreated) -> str:
    """What a captured write tells the caller it did.

    One function because there is one answer. This used to be decided twice
    -- once here for a response built off the API object, once again inside
    ``signal_response`` -- and the second copy knew only about deletes, so
    ``DELETE_REPLACED_MESSAGE`` and ``UPDATED_MESSAGE`` were written,
    tested, and then never reached a caller.
    """
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
