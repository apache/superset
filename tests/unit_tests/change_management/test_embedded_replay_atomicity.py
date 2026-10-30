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
"""An approval is one transaction, the embedded path included.

The embedded-config upsert has no host command to re-invoke, so the
extension supplies an object shaped like one. The first version copied
the dashboard API's commit along with its two DAO arguments, and that
commit ran *inside* ``approve`` -- so the embedded config was published
while the request it came from was still pending, and a failure after
the replay left the two disagreeing (QA-26).

The commit is gone and ``approve`` carries its decorator again, so the
property holds. Nothing exercised it, which is how it broke the first
time and how it stayed broken through a second regression: between the
decorator being displaced and it being restored, the embedded write
committed nowhere at all.

These tests do not need ``EMBEDDED_SUPERSET``. The flag gates the
guest-token and embedded-render surfaces, not this object, and the
property under test is about transactions rather than about embedding.
"""

import inspect
from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import lifecycle, replay
from asset_approval.models import ChangeStatus
from pytest_mock import MockerFixture


def _ignore(*_args: Any, **_kwargs: Any) -> None:
    """A no-op stand-in for a model method the test does not exercise."""


def test_the_embedded_replay_does_not_commit(mocker: MockerFixture) -> None:
    """The regression itself, at the object that carried it."""
    upsert = mocker.patch(
        "superset.daos.dashboard.EmbeddedDashboardDAO.upsert",
        return_value="row",
    )
    commit = mocker.patch("superset.db.session.commit")

    dashboard = SimpleNamespace(id=42, embedded=[])
    result = replay.EmbeddedUpsertReplay(dashboard, ["x.example.invalid"]).run()

    assert result == "row"
    upsert.assert_called_once_with(dashboard, ["x.example.invalid"])
    commit.assert_not_called()
    # The module does not import ``db`` at all any more, which is the
    # cheapest proof that nothing in here reaches for a transaction.
    assert not hasattr(replay, "db")


@pytest.mark.parametrize(
    "wrapper", [replay.EmbeddedUpsertReplay, replay.DatasetSaveWithRefresh]
)
def test_no_replay_wrapper_commits_for_itself(wrapper: type) -> None:
    # Structural, and deliberately so: the way this broke was someone
    # copying an API endpoint's body, commit included, into a wrapper
    # that runs inside somebody else's transaction. Both wrappers the
    # extension owns are checked, not just the one that was wrong.
    source = inspect.getsource(wrapper.run)
    assert "commit" not in source, (
        f"{wrapper.__name__}.run commits inside the approval's transaction; "
        "approve commits once, for the replay and the decision together"
    )


def test_a_failure_after_the_replay_takes_the_whole_approval_down(
    mocker: MockerFixture,
) -> None:
    """The property the commit broke, asserted end to end.

    The replay succeeds, the decision write then fails, and nothing may
    be left behind: no commit, and the request still pending.
    """
    request = SimpleNamespace(
        id=1,
        author=SimpleNamespace(id=7, username="alex"),
        author_fk=7,
        asset_type="dashboard",
        asset_id=42,
        status=ChangeStatus.PENDING.value,
        base_dict={},
        note=None,
        reviewer_fk=None,
        decided_at=None,
        set_status=_ignore,
    )
    asset = SimpleNamespace(id=42, published=False, embedded=[])

    mocker.patch.object(lifecycle, "_locked", return_value=request)
    mocker.patch.object(lifecycle, "get_user_id", return_value=9)
    mocker.patch.object(lifecycle, "_asset_for", return_value=asset)
    mocker.patch.object(lifecycle, "can_approve", return_value=True)
    mocker.patch.object(lifecycle, "load_asset", return_value=asset)
    mocker.patch.object(lifecycle, "moved_since", return_value=[])
    mocker.patch.object(lifecycle, "is_strict_editor", return_value=True)
    mocker.patch.object(lifecycle, "_announce_approval", _ignore)

    # A real replay object over a stubbed DAO, so the embedded path is
    # the thing running rather than a mock of it.
    mocker.patch(
        "superset.daos.dashboard.EmbeddedDashboardDAO.upsert", return_value="row"
    )
    mocker.patch.object(
        replay,
        "build_command",
        return_value=replay.EmbeddedUpsertReplay(asset, ["x.example.invalid"]),
    )

    # The first decision write after the replay returns.
    mocker.patch.object(
        lifecycle.db.session, "add", side_effect=RuntimeError("decision failed")
    )
    commit = mocker.patch.object(lifecycle.db.session, "commit")
    rollback = mocker.patch.object(lifecycle.db.session, "rollback")

    with pytest.raises(RuntimeError):
        lifecycle.approve(1)

    commit.assert_not_called()
    rollback.assert_called_once()
    assert request.status == ChangeStatus.PENDING.value
