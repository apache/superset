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
"""The publish mark has to outlive the write that noticed it.

``test_publish_exemption`` pins the decision -- never-published is exempt,
ever-published is not -- but it mocks both the recorder and the reader, so
it proves the half that was already right. This file is about the other
half: the mark reaching the database and staying there.

It did not. ``mark_published`` wrote through ``db.session`` on a
savepoint, and every path that reaches it goes on to raise
``ChangeRequestCreated`` and unwind that session, so the row was discarded
every time. An empty table answers "never published" for every dashboard,
which is the behaviour the table was added to replace: unpublish, edit
under the exemption, publish again, and the approver sees only the flag
(QA-18).

The second gap was narrower and worse. The gate's hook is suspended while
an approved change replays, so the approval that actually publishes a
dashboard -- the moment a viewer can first reach it -- was the one write
that could never record itself.
"""

from datetime import datetime
from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import gate, install, lifecycle
from asset_approval.models import ChangeStatus, PublishedAsset
from asset_approval.types import AssetType
from pytest_mock import MockerFixture
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

DECIDED_AT = datetime(2026, 10, 30, 9, 15)


def _ignore(*_args: Any, **_kwargs: Any) -> None:
    """A no-op stand-in for a model method the test does not exercise."""


@pytest.fixture
def store(mocker: MockerFixture, tmp_path: Any) -> Any:
    """A real ``published_assets``, and a real session beside it.

    On disk rather than in memory because the point of the test is that
    the mark is written on a *different* connection from the caller's: a
    private in-memory database would hide exactly that.
    """
    engine = create_engine(f"sqlite:///{tmp_path}/marks.db")
    PublishedAsset.__table__.create(bind=engine, checkfirst=True)
    session = sessionmaker(bind=engine)()
    mocker.patch.object(
        gate, "db", SimpleNamespace(engine=engine, session=session)
    )
    return SimpleNamespace(engine=engine, session=session)


def _rows(engine: Any) -> list[Any]:
    """Read the marks back on a connection of our own."""
    table = PublishedAsset.__table__
    with engine.connect() as connection:
        return list(connection.execute(select(table.c.asset_id)))


def test_the_mark_never_touches_the_callers_session(
    store: Any, mocker: MockerFixture
) -> None:
    """The defect at the level it actually lives at.

    Asserting "roll the session back and the row is still there" would be
    the obvious test and it would be a lie under SQLite: pysqlite commits
    whatever is pending when a SAVEPOINT is emitted, so the old savepoint
    write survives a rollback here and is lost on Postgres and MySQL,
    which is where it was lost. The portable fact is the one that matters
    anyway -- the mark does not ride the session that is about to be
    unwound.
    """
    add = mocker.patch.object(store.session, "add")

    gate.mark_published(AssetType.DASHBOARD, 11)

    add.assert_not_called()
    assert [row.asset_id for row in _rows(store.engine)] == [11]


def test_a_later_reader_sees_the_mark(store: Any, mocker: MockerFixture) -> None:
    # And the read is on its own connection too, so a mark another worker
    # committed is visible to a session that began before it.
    query = mocker.patch.object(store.session, "query")

    gate.mark_published(AssetType.DASHBOARD, 11)

    assert gate.has_ever_been_published(AssetType.DASHBOARD, 11) is True
    assert gate.has_ever_been_published(AssetType.DASHBOARD, 12) is False
    query.assert_not_called()


def test_marking_twice_is_a_no_op(store: Any) -> None:
    gate.mark_published(AssetType.DASHBOARD, 11)
    gate.mark_published(AssetType.DASHBOARD, 11)

    assert len(_rows(store.engine)) == 1


def test_the_gate_hook_is_blind_while_a_replay_runs() -> None:
    # Why the approval has to record the publish itself: during a replay
    # the whole hook is skipped, mark_published included.
    with gate.replaying():
        assert install._gate_applies() is False


@pytest.fixture
def approval(mocker: MockerFixture) -> dict[str, Any]:
    """``approve`` of a dashboard change, down to the replay."""
    statuses: list[ChangeStatus] = []
    request = SimpleNamespace(
        id=1,
        author=SimpleNamespace(id=7, username="alex"),
        author_fk=7,
        asset_type="dashboard",
        asset_id=11,
        status=ChangeStatus.PENDING.value,
        base_dict={},
        # Every real request carries these; a restore is identified by
        # the command it stores rather than by its operation (R3-01).
        command_args={},
        note=None,
        reviewer_fk=None,
        decided_at=None,
        set_status=statuses.append,
    )
    asset = SimpleNamespace(id=11, published=True)

    mocker.patch.object(lifecycle, "_locked", return_value=request)
    mocker.patch.object(lifecycle, "get_user_id", return_value=9)
    mocker.patch.object(lifecycle, "_asset_for", return_value=asset)
    mocker.patch.object(lifecycle, "can_approve", return_value=True)
    mocker.patch.object(lifecycle, "load_asset", return_value=asset)
    mocker.patch.object(lifecycle, "moved_since", return_value=[])
    mocker.patch.object(lifecycle, "is_strict_editor", return_value=True)
    mocker.patch.object(lifecycle, "_now", return_value=DECIDED_AT)
    mocker.patch.object(lifecycle.db.session, "add", _ignore)
    mocker.patch.object(lifecycle.db.session, "commit")
    mocker.patch.object(lifecycle.db.session, "rollback")
    mocker.patch.object(lifecycle, "apply_change", return_value="applied")
    marked = mocker.patch.object(lifecycle, "mark_published")
    return {"request": request, "asset": asset, "marked": marked}


def test_an_approval_that_publishes_records_it(approval: dict[str, Any]) -> None:
    lifecycle.approve(1)

    approval["marked"].assert_called_once_with(AssetType.DASHBOARD, 11)


def test_an_approval_that_leaves_it_a_draft_records_nothing(
    approval: dict[str, Any],
) -> None:
    # Read off the live asset, not the payload: the question is whether a
    # viewer can reach it now, however the change was phrased.
    approval["asset"].published = False

    lifecycle.approve(1)

    approval["marked"].assert_not_called()


def test_a_chart_approval_records_nothing(approval: dict[str, Any]) -> None:
    # The mark is dashboard-only; the exemption it serves is dashboard-only.
    approval["request"].asset_type = "chart"

    lifecycle.approve(1)

    approval["marked"].assert_not_called()


def test_the_mark_is_never_written_through_the_callers_session() -> None:
    # The structural guard. This is the third bug on this branch where
    # correct-looking code never reached the database, so pin the shape as
    # well as the behaviour.
    import inspect

    source = inspect.getsource(gate.mark_published)
    assert "db.session" not in source, (
        "mark_published must not ride the caller's session -- it is rolled "
        "back by the capture that follows it"
    )
    assert "db.engine.begin()" in source


def test_missing_version_history_does_not_stop_the_install(tmp_path: Any) -> None:
    """The backfill's risky half degrades instead of failing.

    ``install_bindings`` has core refuse every governed write until a gate
    registers, so an exception escaping ``init()`` is an authoring outage,
    not a weaker exemption. The shadow table can be absent for ordinary
    reasons -- versioning switched off, an older schema -- so reading it
    has to be allowed to come back empty.
    """
    from asset_approval.entrypoint import _published_in_version_history

    bare = create_engine(f"sqlite:///{tmp_path}/empty.db")
    with bare.connect() as connection:
        assert _published_in_version_history(connection) == set()
