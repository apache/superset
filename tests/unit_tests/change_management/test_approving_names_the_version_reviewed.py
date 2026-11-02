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
"""An approval names the version it approves, or it is refused.

129070 added the check: the author can withdraw, rewrite and resubmit while
a reviewer holds the page, so the approver quotes back the revision they were
shown and a request that moved underneath them is refused.

The guard read ``if seen_revision and ...``, so it was only ever as good as
its caller. Omitting the field skipped it. Found by approving with an empty
body: the request had been rewritten from "Benign Title" to "SNEAKY REWRITE"
after the reviewer's revision was taken, the stale quote was correctly
refused with 409, and then the very same approve with ``{}`` returned 200 and
published "SNEAKY REWRITE" to the live dashboard.

A control that the caller can switch off by leaving a field out is not a
control. Approving is an attestation to a particular version, so not naming
one is refused rather than waved through, and the requirement is decided by
the server's own state: it applies exactly when there is a revision to quote.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import lifecycle
from asset_approval.exceptions import ReviewedVersionStaleError
from asset_approval.models import ChangeStatus
from pytest_mock import MockerFixture

REVISION = "2026-11-02T18:18:38.165620"


def _ignore(*_args: Any, **_kwargs: Any) -> None:
    """A no-op stand-in for a model method this test does not exercise."""


@pytest.fixture
def approval(mocker: MockerFixture) -> SimpleNamespace:
    """``approve`` with every check except the revision already satisfied."""
    request = SimpleNamespace(
        id=1,
        author=SimpleNamespace(id=7, username="priya"),
        author_fk=7,
        asset_type="dashboard",
        asset_id=7,
        status=ChangeStatus.PENDING.value,
        changed_on=SimpleNamespace(isoformat=lambda: REVISION),
        base_dict={},
        command_args={},
        note=None,
        set_status=_ignore,
    )
    asset = SimpleNamespace(id=7)

    mocker.patch.object(lifecycle, "_locked", return_value=request)
    mocker.patch.object(lifecycle, "get_user_id", return_value=9)
    mocker.patch.object(lifecycle, "_asset_for", return_value=asset)
    mocker.patch.object(lifecycle, "can_approve", return_value=True)
    mocker.patch.object(lifecycle, "load_asset", return_value=asset)
    mocker.patch.object(lifecycle, "moved_since", return_value=[])
    # The author still edits the asset, so only the revision is left to decide.
    mocker.patch.object(lifecycle, "is_strict_editor", return_value=True)
    mocker.patch.object(lifecycle, "_now", return_value=None)
    mocker.patch.object(lifecycle, "_announce_approval", _ignore)
    mocker.patch.object(lifecycle.db.session, "add", _ignore)
    mocker.patch.object(lifecycle, "apply_change", return_value="applied")
    return request


def test_quoting_the_version_on_the_page_approves(approval: SimpleNamespace) -> None:
    assert lifecycle.approve(1, seen_revision=REVISION) == "applied"


def test_quoting_a_version_that_has_moved_is_refused(
    approval: SimpleNamespace,
) -> None:
    with pytest.raises(ReviewedVersionStaleError):
        lifecycle.approve(1, seen_revision="2026-11-02T18:18:38.010485")


def test_naming_no_version_at_all_is_refused(approval: SimpleNamespace) -> None:
    """The bug. An omitted field used to mean "skip the check"."""
    with pytest.raises(ReviewedVersionStaleError):
        lifecycle.approve(1)


def test_an_empty_quote_is_not_a_waiver(approval: SimpleNamespace) -> None:
    """``None`` and ``""`` are both "did not say", and neither passes.

    The old guard was falsy-tested, so both were waivers.
    """
    for quote in (None, ""):
        with pytest.raises(ReviewedVersionStaleError):
            lifecycle.approve(1, seen_revision=quote)


def test_a_request_with_no_revision_to_quote_is_unaffected(
    approval: SimpleNamespace, mocker: MockerFixture
) -> None:
    """The requirement follows the server's state, not the caller's.

    Nothing to attest to means nothing to demand, which is also what keeps
    this from becoming a flag a caller could argue about.
    """
    approval.changed_on = None

    assert lifecycle.approve(1) == "applied"
