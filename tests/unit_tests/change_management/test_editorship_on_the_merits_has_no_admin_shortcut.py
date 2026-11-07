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
"""``is_strict_editor`` itself, not the callers that consult it.

A test leak, found by a sweep of this suite. Who may approve a change is
decided here, and the rule V1 is built on is that it is *editorship on the
merits*: the Admin role is not a reviewer, because a role gate on top of
editorship can only ever stop a legitimate editor approving, and a shortcut
under it would let any administrator wave a change through (SOW 5.3).

Two files are named for that rule and both patch this function and then
assert that the caller consulted the stub -- including the one whose
docstring reads "Including an administrator". The only guard on the function
itself was ``assert "is_strict_editor" in source``, which a comment would
satisfy. So the body could be given the host's admin shortcut, or have its
empty-subject default flipped, and all 1328 tests still passed. Either is a
maker-checker bypass.

The intersection in the middle *is* driven for real elsewhere
(``test_review_routing_payload``), so this file takes the two ends nothing
covered: the absence of an admin shortcut, and what an empty set of subjects
means. The inputs are stubbed -- the two lookups the function reads from --
and the decision is the real one. That is the distinction the leak turned
on: stub what a predicate reads, never the predicate.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import eligibility
from pytest_mock import MockerFixture

EDITOR = 7
OUTSIDER = 8
ASSET = SimpleNamespace(id=3)

#: Subject ids the asset's editors hold.
EDITOR_SUBJECTS = {41, 42}


@pytest.fixture
def subjects(mocker: MockerFixture) -> Any:
    """The two lookups the predicate reads, and nothing else.

    ``get_user_subject_ids`` is imported inside the function, so it is
    patched where it lives rather than on this module.
    """
    return SimpleNamespace(
        of_user=mocker.patch(
            "superset.subjects.utils.get_user_subject_ids",
            return_value=[],
        ),
        of_asset=mocker.patch.object(
            eligibility,
            "asset_editor_subject_ids",
            return_value=set(EDITOR_SUBJECTS),
        ),
        is_admin=mocker.patch.object(
            eligibility.security_manager, "is_admin", return_value=False
        ),
    )


# ---- the rule itself --------------------------------------------------------


def test_an_editor_of_the_asset_is_an_editor(subjects: Any) -> None:
    subjects.of_user.return_value = [42]

    assert eligibility.is_strict_editor(ASSET, EDITOR)


def test_someone_with_other_subjects_is_not(subjects: Any) -> None:
    subjects.of_user.return_value = [99]

    assert not eligibility.is_strict_editor(ASSET, OUTSIDER)


# ---- the two ends nothing covered -------------------------------------------


def test_an_administrator_who_is_not_an_editor_is_still_not_an_editor(
    subjects: Any,
) -> None:
    """The rule the module docstring forbids breaking.

    The host's own ``is_editor`` answers True for any admin
    (``security/manager.py``), and reaching for it here -- or adding the same
    shortcut -- would make every administrator an approver of everything.
    This is the assertion that was missing: both tests named for this rule
    patched the function out and asserted on the stub.
    """
    subjects.is_admin.return_value = True
    subjects.of_user.return_value = [99]

    assert not eligibility.is_strict_editor(ASSET, OUTSIDER)


def test_nor_when_they_hold_no_subjects_at_all(subjects: Any) -> None:
    subjects.is_admin.return_value = True
    subjects.of_user.return_value = []

    assert not eligibility.is_strict_editor(ASSET, OUTSIDER)


def test_a_principal_with_no_subjects_is_an_editor_of_nothing(
    subjects: Any,
) -> None:
    """The empty-subject default, which is the other half of the leak.

    Returning True here -- "no subjects, so nothing to exclude them" -- makes
    a principal with no subject rows an editor of every asset, and so an
    eligible approver everywhere. A guest token is exactly such a principal.
    """
    subjects.of_user.return_value = []

    assert not eligibility.is_strict_editor(ASSET, OUTSIDER)


def test_an_asset_nobody_edits_has_no_editors(subjects: Any) -> None:
    """The empty set on the other side. Not symmetric with the case above:
    this one is a fact about the asset, and it must not read as "anyone"."""
    subjects.of_user.return_value = [42]
    subjects.of_asset.return_value = set()

    assert not eligibility.is_strict_editor(ASSET, EDITOR)


def test_the_asset_is_the_one_asked_about(subjects: Any) -> None:
    """The editor set is read per asset, not once for the instance."""
    subjects.of_user.return_value = [42]

    eligibility.is_strict_editor(ASSET, EDITOR)

    subjects.of_asset.assert_called_once_with(ASSET)
