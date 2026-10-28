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
from __future__ import annotations

import uuid
from typing import Any

from flask_appbuilder import Model
from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy_utils import UUIDType

from asset_approval.types import (
    AssetType,
    ChangeStatus,
    Operation,
    OPEN_SLOT,
    OPEN_STATUSES,
)
from superset.models.helpers import AuditMixinNullable
from superset.utils import json


class PublishedAsset(Model):
    """Every asset this instance has ever seen published.

    SOW 5.1 exempts a dashboard from review while it is still a draft,
    because no viewer can reach it yet. Deciding that from the live Draft
    flag asks the wrong question: an editor can clear the flag, edit freely
    while it is clear, and set it again, and the approver sees only the flag
    moving while the content rides in behind it (QA-18).

    What the exemption actually means is *never published*, which the asset
    cannot answer about itself -- `published` is where it is now, not where
    it has been. So the fact is recorded the first time the asset is seen
    published, and never removed: unpublishing is a change of visibility,
    not of history.
    """

    __tablename__ = "published_assets"
    __table_args__ = (
        UniqueConstraint("asset_type", "asset_id", name="uq_published_asset"),
    )

    id = Column(Integer, primary_key=True)
    asset_type = Column(String(32), nullable=False)
    asset_id = Column(Integer, nullable=False)
    #: When this instance first saw it published, which is not necessarily
    #: when it was first published -- an asset published before the
    #: extension was installed is recorded the first time it is written to.
    first_seen_at = Column(DateTime, nullable=False)


class ChangeRequest(AuditMixinNullable, Model):
    """One author's pending change to one governed asset.

    The row stores the *request payload* the author submitted, not a copy of
    the resulting asset. Approval replays that payload through the shipped
    update command, which keeps this feature correct across Superset
    upgrades without tracking what each command does internally.
    """

    __tablename__ = "change_requests"
    __table_args__ = (
        # SOW 5.3: one open change per asset, enforced by the database.
        # See ``OPEN_SLOT`` for why the open-ness is a column rather than a
        # partial index.
        UniqueConstraint(
            "asset_type",
            "asset_id",
            "active_slot",
            name="uq_change_requests_one_open_per_asset",
        ),
        Index("ix_change_requests_asset", "asset_type", "asset_id"),
        Index("ix_change_requests_status", "status"),
        Index("ix_change_requests_author", "author_fk"),
    )

    id = Column(Integer, primary_key=True)
    uuid = Column(UUIDType(binary=True), default=uuid.uuid4, nullable=True)

    asset_type = Column(String(32), nullable=False)
    asset_id = Column(Integer, nullable=False)
    operation = Column(
        String(16), nullable=False, default=Operation.UPDATE.value
    )

    status = Column(String(32), nullable=False, default=ChangeStatus.DRAFT.value)
    #: ``OPEN_SLOT`` while open, ``NULL`` once terminal. Maintained by
    #: :meth:`set_status`; never written directly.
    active_slot = Column(Integer, nullable=True, default=OPEN_SLOT)

    #: The raw request body, serialized. Replayed verbatim on approval.
    payload = Column(Text, nullable=False)

    author_fk = Column(Integer, ForeignKey("ab_user.id"), nullable=False)
    author = relationship(
        "User",
        foreign_keys=[author_fk],
    )

    #: Optional "ask someone specific" (Decision 4). Advisory only: it
    #: surfaces the request for that person first, it does not restrict who
    #: may approve.
    requested_approver_fk = Column(
        Integer, ForeignKey("ab_user.id"), nullable=True
    )
    requested_approver = relationship(
        "User",
        foreign_keys=[requested_approver_fk],
    )

    reviewer_fk = Column(Integer, ForeignKey("ab_user.id"), nullable=True)
    reviewer = relationship(
        "User",
        foreign_keys=[reviewer_fk],
    )

    #: The author's "what changed?" note, which the reviewer may add to.
    note = Column(Text, nullable=True)
    #: Required when a reviewer requests changes.
    review_note = Column(Text, nullable=True)

    submitted_at = Column(DateTime, nullable=True)
    decided_at = Column(DateTime, nullable=True)

    def __repr__(self) -> str:
        return (
            f"<ChangeRequest {self.id} {self.asset_type}:{self.asset_id} "
            f"{self.status}>"
        )

    @property
    def is_open(self) -> bool:
        return ChangeStatus(self.status) in OPEN_STATUSES

    @property
    def captured(self) -> dict[str, Any]:
        """The full capture: the request body plus any extra command args."""
        return json.loads(self.payload)

    @property
    def payload_dict(self) -> dict[str, Any]:
        """The request body, as the command originally received it."""
        return self.captured.get("body", {})

    @property
    def command_args(self) -> dict[str, Any]:
        """Constructor arguments the command takes outside the request body.

        ``UpdateChartCommand`` takes ``normalization_changes`` and
        ``UpdateDatasetCommand`` takes ``override_columns``; neither arrives
        in the body, and replaying without them would not be replaying the
        same command. ``override_columns`` in particular decides whether a
        dataset update replaces its column set, so losing it on approval
        would silently apply a different change than the one reviewed.
        """
        return self.captured.get("command_args", {})

    @property
    def base_dict(self) -> dict[str, Any]:
        """What the asset held, in the reviewed fields, when this was captured.

        The approval replays the author's body, so it overwrites whatever is
        live at the moment it runs -- not whatever was live when the author
        wrote it. Turn the feature off, edit the asset, turn it back on, and
        approving the waiting request published the old title over the new
        one with nothing said (QA-24). Comparing these values against the
        live asset is how an approval knows the ground moved under it.

        Empty for requests captured before this was recorded, and for diff
        bodies, which describe an operation rather than the asset's fields.
        An empty baseline skips the check rather than inventing one.
        """
        return self.captured.get("base", {})

    def set_status(self, status: ChangeStatus) -> None:
        """Move the request, keeping ``active_slot`` consistent.

        The slot and the status must change together: a terminal row that
        kept its slot would keep the asset locked forever, and an open row
        without one would let a second request slip past the unique
        constraint. Funnelling both through one method is what keeps the
        database guarantee honest.
        """
        self.status = status.value
        self.active_slot = OPEN_SLOT if status in OPEN_STATUSES else None

    @staticmethod
    def serialize_payload(
        body: dict[str, Any],
        command_args: dict[str, Any] | None = None,
        base: dict[str, Any] | None = None,
    ) -> str:
        """Serialize a captured write for storage.

        Stored as ``{"body": ..., "command_args": ...}`` rather than the
        bare body, because replaying a command faithfully needs both.
        ``sort_keys`` keeps the stored form stable so two captures of the
        same edit compare equal, which the "nothing changed" refusal
        (SOW 3) relies on.
        """
        captured: dict[str, Any] = {
            "body": body,
            "command_args": command_args or {},
        }
        if base:
            # Only when there is one, so a request captured without a
            # baseline stores exactly the shape it always did.
            captured["base"] = base
        return json.dumps(captured, sort_keys=True, default=str)


def asset_type_for(model: Any) -> AssetType | None:
    """Map a model instance to the asset kind under review, if any."""
    name = type(model).__name__
    return {
        "Dashboard": AssetType.DASHBOARD,
        "Slice": AssetType.CHART,
        "SqlaTable": AssetType.DATASET,
    }.get(name)
