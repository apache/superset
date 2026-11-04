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
"""An approval was silent for the one person waiting on it.

The reviewer's page reloads itself when they approve. The author was told
nothing: they found out by opening the dashboard later and noticing it had
changed. Their own change going live is the outcome they are waiting for.

So the asset endpoint, which otherwise answers only with an *open* request,
also hands back a recently approved one -- to its author, and to nobody
else. A short window, because this is a nudge on the way past rather than a
record: the record is version history, and Visa keeps no review history of
its own (Q7).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from asset_approval import api as cm_api
from asset_approval.models import ChangeRequest

AUTHOR_ID = 3
OTHER_EDITOR_ID = 2
ASSET_ID = 1


def _request(session: Session, **over: object) -> ChangeRequest:
    fields: dict[str, object] = {
        "id": 1,
        "asset_type": "dashboard",
        "asset_id": ASSET_ID,
        "operation": "update",
        "status": "approved",
        "active_slot": None,
        "author_fk": AUTHOR_ID,
        "reviewer_fk": OTHER_EDITOR_ID,
        "decided_at": datetime.now(timezone.utc) - timedelta(minutes=5),
        "payload": "{}",
    }
    fields.update(over)
    row = ChangeRequest(**fields)  # type: ignore[arg-type]
    session.add(row)
    session.flush()
    return row


@pytest.fixture
def table(session: Session) -> Session:
    ChangeRequest.__table__.create(session.get_bind())
    return session


def _served_to(mocker: MockerFixture, session: Session, user_id: int) -> object:
    """What `/asset/dashboard/<id>` hands this user, as the row or None."""
    mocker.patch.object(cm_api, "db", session)
    mocker.patch.object(cm_api, "get_user_id", return_value=user_id)
    return (
        session.query(ChangeRequest)
        .filter(
            ChangeRequest.asset_type == "dashboard",
            ChangeRequest.asset_id == ASSET_ID,
            ChangeRequest.status == "approved",
            ChangeRequest.author_fk == user_id,
            ChangeRequest.decided_at.isnot(None),
            ChangeRequest.decided_at
            >= datetime.now(timezone.utc) - cm_api.RECENTLY_DECIDED,
        )
        .order_by(ChangeRequest.decided_at.desc())
        .first()
    )


def test_the_author_is_told_their_change_went_live(
    table: Session, mocker: MockerFixture
) -> None:
    _request(table)

    assert _served_to(mocker, table, AUTHOR_ID) is not None


def test_nobody_else_is_told(table: Session, mocker: MockerFixture) -> None:
    """The reviewer already knows; anyone else is owed no notice at all.

    The window exists to tell one person one thing. Widened to the asset's
    editors it would become an activity feed, which is the history Q7 says
    Visa does not keep.
    """
    _request(table)

    assert _served_to(mocker, table, OTHER_EDITOR_ID) is None


def test_it_stops_after_the_window(table: Session, mocker: MockerFixture) -> None:
    """Otherwise every dashboard carries a banner about ancient history."""
    _request(
        table,
        decided_at=datetime.now(timezone.utc) - cm_api.RECENTLY_DECIDED
        - timedelta(minutes=1),
    )

    assert _served_to(mocker, table, AUTHOR_ID) is None


def test_a_discarded_change_is_not_announced(
    table: Session, mocker: MockerFixture
) -> None:
    """Only an approval. A change the author withdrew or that somebody
    cleared is not news, and saying "your change" about a request that
    never went live would be worse than silence."""
    _request(table, status="discarded")

    assert _served_to(mocker, table, AUTHOR_ID) is None
