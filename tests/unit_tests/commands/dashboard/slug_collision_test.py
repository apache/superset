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
    """Only ``None`` means "no slug sent" and skips the probe entirely."""
    finder = mocker.patch(_FINDER)

    raise_for_soft_deleted_slug_collision(None, Exception("boom"))

    finder.assert_not_called()


def test_empty_string_slug_is_probed(mocker: MockerFixture) -> None:
    """An empty string is a real, storable slug value and IS probed.

    The PUT schema accepts a zero-length slug and the uniqueness
    prechecks compare every non-None value, so a collision on ""
    deserves the same translation as any other."""
    finder = mocker.patch(_FINDER, return_value=None)

    raise_for_soft_deleted_slug_collision("", Exception("boom"))

    finder.assert_called_once()


def test_live_holder_wins_over_archived_namesake(mocker: MockerFixture) -> None:
    """A LIVE holder means the original error stands — no restore advice.

    The race: archived A holds slug s; this request passes the live
    uniqueness precheck; another request commits a live dashboard with s;
    this request's flush then fails against the LIVE row. Advising a
    restore of archived A could never resolve that conflict, so the
    helper must return (original IntegrityError re-raised by the caller)
    and never even consult the deleted-holder probe.
    """
    db_mock = mocker.patch("superset.db")
    db_mock.session.query.return_value.filter.return_value.first.return_value = (
        MagicMock()  # a live dashboard row holds the slug
    )
    finder = mocker.patch(_FINDER)

    raise_for_soft_deleted_slug_collision("q1-report", Exception("boom"))

    finder.assert_not_called()
