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
"""sc-107581: slug collisions with soft-deleted dashboards get guidance.

On the full-constraint dialects a soft-deleted dashboard still blocks its
slug at flush; these pins cover the translation helper: a deleted holder
turns the IntegrityError into a 422 naming the holder and the restore
endpoint, anything else re-raises untouched, and no probe runs when no
slug is in play.
"""

from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset.commands.dashboard.exceptions import DashboardInvalidError
from superset.commands.soft_delete_collisions import (
    raise_for_soft_deleted_slug_collision,
)

_FINDER = "superset.commands.soft_delete_collisions.find_soft_deleted_slot_holder"


def test_deleted_holder_translates_to_guidance(mocker: MockerFixture) -> None:
    holder = MagicMock()
    holder.uuid = "abcd-1234"
    mocker.patch(_FINDER, return_value=holder)
    cause = Exception("UNIQUE constraint failed: dashboards.slug")

    with pytest.raises(DashboardInvalidError) as excinfo:
        raise_for_soft_deleted_slug_collision("q1-report", cause)

    messages = str(excinfo.value.normalized_messages())
    assert "abcd-1234" in messages
    assert "/api/v1/dashboard/abcd-1234/restore" in messages
    assert excinfo.value.__cause__ is cause


def test_no_deleted_holder_returns_so_caller_reraises(
    mocker: MockerFixture,
) -> None:
    """A conflict NOT caused by a soft-deleted row must not be masked."""
    mocker.patch(_FINDER, return_value=None)

    # Returning (rather than raising) is the contract that lets the caller
    # re-raise the original IntegrityError unmasked.
    raise_for_soft_deleted_slug_collision("q1-report", Exception("boom"))


def test_no_slug_skips_the_probe(mocker: MockerFixture) -> None:
    finder = mocker.patch(_FINDER)

    raise_for_soft_deleted_slug_collision(None, Exception("boom"))
    raise_for_soft_deleted_slug_collision("", Exception("boom"))

    finder.assert_not_called()
