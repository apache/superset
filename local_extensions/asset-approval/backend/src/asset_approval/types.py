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
from enum import StrEnum


class AssetType(StrEnum):
    """The asset kinds the SOW puts under review (SOW 5.1)."""

    DASHBOARD = "dashboard"
    CHART = "chart"
    DATASET = "dataset"


class Operation(StrEnum):
    """What the captured write would do.

    The SOW puts edits, deletes and imports all under review (SOW 5.1), and
    they are not the same act: approving a delete runs a different command
    than approving an edit. Carried as its own column rather than folded
    into the payload, because replay has to branch on it and a reviewer has
    to be told which one they are agreeing to.
    """

    UPDATE = "update"
    DELETE = "delete"


class ChangeStatus(StrEnum):
    """Lifecycle of a change request.

    ``DRAFT``, ``PENDING`` and ``CHANGES_REQUESTED`` are *open*: the asset
    is locked and no second request may be opened against it. ``APPROVED``
    and ``DISCARDED`` are terminal and free the asset.

    Visa keeps no rejection history (Visa Q7), so "request changes" returns
    the request to ``CHANGES_REQUESTED`` rather than closing it and opening
    a new one -- the author keeps working on the same record.
    """

    DRAFT = "draft"
    PENDING = "pending"
    CHANGES_REQUESTED = "changes_requested"
    APPROVED = "approved"
    DISCARDED = "discarded"


#: Statuses that hold the asset's single open slot.
OPEN_STATUSES: frozenset[ChangeStatus] = frozenset(
    {
        ChangeStatus.DRAFT,
        ChangeStatus.PENDING,
        ChangeStatus.CHANGES_REQUESTED,
    }
)

#: Sentinel written to ``ChangeRequest.active_slot`` while a request is open.
#:
#: The SOW requires "one open change per asset, enforced by the database"
#: (SOW 5.3). A partial unique index would express that directly but is not
#: portable to MySQL, so the open-ness is carried in a column instead: the
#: slot holds ``OPEN_SLOT`` while open and ``NULL`` once terminal, under a
#: plain ``UNIQUE (asset_type, asset_id, active_slot)``. Every supported
#: metadata backend treats NULLs as distinct in a unique index, so closed
#: rows never collide while at most one open row can exist.
OPEN_SLOT = 1
