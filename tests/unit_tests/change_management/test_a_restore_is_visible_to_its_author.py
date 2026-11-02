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
"""A restore request can be seen by the person who made it (R3-01).

Found walking the delete flow by hand: an approved delete archives the
chart, Recover this item answers 202 and makes a request -- and then the
request is nowhere. It is absent from its author's queue, its own page
answers 404, and the per-asset lookup answers "nothing pending".

Every read path loaded the asset to build the row and dropped the row when
the asset came back empty, which is exactly what a soft-deleted asset does.
Only the diff helper passed ``include_deleted``. So the request could not
be submitted, approved or discarded by anyone, and it held the asset's one
open slot for good, which stopped any further change to that asset too.
"""

from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import api
from pytest_mock import MockerFixture

from asset_approval.gate import COMMAND_KEY, RESTORE_COMMAND

RESTORE = {COMMAND_KEY: RESTORE_COMMAND}


def _request(command_args: dict[str, Any]) -> SimpleNamespace:
    return SimpleNamespace(
        id=7,
        asset_type="chart",
        asset_id=69,
        status="draft",
        operation="update",
        command_args=command_args,
        author_fk=2,
    )


@pytest.fixture
def loader(mocker: MockerFixture) -> Any:
    """Stands in for load_asset: archived assets need include_deleted."""
    archived = SimpleNamespace(id=69, slice_name="Genders by State")

    def load(kind: Any, asset_id: int, include_deleted: bool = False) -> Any:
        return archived if include_deleted else None

    return mocker.patch.object(api, "load_asset", side_effect=load)


def test_a_restore_reaches_its_archived_asset(loader: Any) -> None:
    assert api._asset_of(_request(RESTORE)) is not None


def test_an_ordinary_change_still_does_not_see_deleted_assets(loader: Any) -> None:
    """Only a restore looks past the archive; nothing else should."""
    assert api._asset_of(_request({})) is None


def test_the_flag_is_taken_from_the_request_not_guessed(loader: Any) -> None:
    api._asset_of(_request(RESTORE))

    assert loader.call_args.kwargs["include_deleted"] is True


def test_the_diff_helper_still_agrees(loader: Any) -> None:
    assert api._asset_for_diff(_request(RESTORE)) is not None


def test_an_unreadable_asset_does_not_break_the_diff(mocker: MockerFixture) -> None:
    mocker.patch.object(api, "load_asset", side_effect=RuntimeError("gone"))

    assert api._asset_for_diff(_request(RESTORE)) is None
