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

from flask import Response

from asset_approval.exceptions import (
    AssetLockedError,
    ChangeManagementException,
    ChangeRequestCreated,
)

#: A capture is not a failure and not a plain success: the request was
#: accepted, and it takes a second person before it takes effect.
CAPTURED_STATUS = 202

#: SOW 5.3: only one set of changes may be open on an asset at a time.
LOCKED_STATUS = 409

SAVED_MESSAGE = "Changes saved. Viewers still see the live version."
UPDATED_MESSAGE = "Changes updated in your existing draft."
BULK_MESSAGE = "%s changes waiting for review."
DELETE_MESSAGE = "Delete submitted for review. Nothing has been removed."
BULK_DELETE_MESSAGE = "%s deletes waiting for review. Nothing has been removed."


def captured_response(api: Any, ex: ChangeRequestCreated) -> Response:
    """Answer a write that was captured for review."""
    deleting = ex.operation == "delete"
    if ex.count > 1:
        # A bulk delete or an import captures several assets, each reviewed
        # on its own, so the count is the useful thing to say (SOW 5.1).
        message = (BULK_DELETE_MESSAGE if deleting else BULK_MESSAGE) % ex.count
    elif deleting:
        # Never "Changes saved" for a delete: the asset is untouched and
        # saying it was saved describes the wrong act entirely.
        message = DELETE_MESSAGE
    elif ex.updated_existing:
        message = UPDATED_MESSAGE
    else:
        message = SAVED_MESSAGE
    return api.response(
        CAPTURED_STATUS,
        id=ex.change_request_id,
        ids=ex.change_request_ids,
        count=ex.count,
        asset_type=ex.asset_type,
        asset_id=ex.asset_id,
        review_required=True,
        message=message,
    )


def locked_response(api: Any, ex: AssetLockedError) -> Response:
    """Answer a write refused because another editor holds the asset."""
    return api.response(
        LOCKED_STATUS,
        asset_type=ex.asset_type,
        asset_id=ex.asset_id,
        author=ex.author,
        message=str(ex),
    )


def refused_response(api: Any, ex: ChangeManagementException) -> Response:
    """Answer a write the gate refused outright rather than captured.

    Imports that would overwrite and writes with nothing replayable (see
    ``UnreviewableWriteRefusedError``). The body is a plain ``message``,
    which is what the import modal and the API clients show verbatim; the
    status comes from the exception so every caller answers alike.
    """
    return api.response(ex.status, message=str(ex))


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
        deleting = getattr(ex, "operation", "update") == "delete"
        if ex.count > 1:
            message = (BULK_DELETE_MESSAGE if deleting else BULK_MESSAGE) % ex.count
        else:
            message = DELETE_MESSAGE if deleting else SAVED_MESSAGE
        return (
            {
                "id": ex.change_request_id,
                "ids": ex.change_request_ids,
                "count": ex.count,
                "asset_type": ex.asset_type,
                "asset_id": ex.asset_id,
                "review_required": True,
                "message": message,
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
