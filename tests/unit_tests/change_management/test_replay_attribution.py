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
"""Who an approved save is credited to.

The approval re-runs the author's own command, and the request running it
belongs to the approver. Left alone, every governed save in version history
carried the approver's name and the author's appeared nowhere in the history
of their own edit (QA-16).
"""

from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import replay
from flask import Flask, g
from pytest_mock import MockerFixture


@pytest.fixture
def bare_app() -> Flask:
    return Flask(__name__)


def _request(author: Any) -> SimpleNamespace:
    return SimpleNamespace(id=1, author=author)


def test_the_replay_runs_as_the_author(bare_app: Flask, mocker: MockerFixture) -> None:
    author = SimpleNamespace(id=7, username="alex")
    approver = SimpleNamespace(id=9, username="priya")
    seen: dict[str, Any] = {}

    class Command:
        def run(self) -> str:
            # Whoever this is, is who the save is stamped with.
            seen["user"] = g.user
            return "applied"

    mocker.patch.object(replay, "build_command", return_value=Command())

    with bare_app.app_context():
        g.user = approver
        assert replay.apply_change(_request(author)) == "applied"
        # And the approver is restored for everything after the replay.
        assert g.user is approver

    assert seen["user"] is author


def test_the_gate_is_suspended_for_the_replay(
    bare_app: Flask, mocker: MockerFixture
) -> None:
    """Otherwise the approval would be captured as a new change request."""
    seen: dict[str, Any] = {}

    class Command:
        def run(self) -> str:
            from asset_approval import gate

            seen["replaying"] = gate.is_replaying()
            return "applied"

    mocker.patch.object(replay, "build_command", return_value=Command())

    with bare_app.app_context():
        g.user = SimpleNamespace(id=9, username="priya")
        replay.apply_change(_request(SimpleNamespace(id=7, username="alex")))

    assert seen["replaying"] is True


def test_a_failing_replay_still_restores_the_approver(
    bare_app: Flask, mocker: MockerFixture
) -> None:
    approver = SimpleNamespace(id=9, username="priya")

    class Command:
        def run(self) -> str:
            raise RuntimeError("command blew up")

    mocker.patch.object(replay, "build_command", return_value=Command())

    with bare_app.app_context():
        g.user = approver
        with pytest.raises(RuntimeError):
            replay.apply_change(_request(SimpleNamespace(id=7)))
        assert g.user is approver
