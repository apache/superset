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
"""Two things the payload has to say, because the client cannot work them out.

**Where the review happens (R3-01).** The reviewer was navigated to an
archived chart's Explore page, which opens empty, says the dataset is
missing and carries no review controls. The first fix read the row's
``command``: a restore meant "decide in place", anything else meant
"navigate". That is a guess about the asset made from the request, and it
covers exactly the one command we happened to know about -- any other
change concerning an archived asset walks into the same dead page. The
server loads the asset on every one of these reads already, so it can
simply say whether the asset is in the trash. ``asset_archived`` is that
statement, read off ``deleted_at`` -- the same notion as the visibility
filter and the retention job.

**That the author has lost edit access (QA-07).** Approving is refused
with 409 once the author is no longer a strict editor, because the change
publishes as their work. The recorded decision was to keep the request
approvable *and* show the approver what had happened; only the first half
was built, so ``can_approve`` kept offering a button guaranteed to fail.
``author_can_still_edit`` is the second half, and it asks
``is_strict_editor`` -- which has no administrator shortcut -- so the note
agrees with the refusal rather than with the role table.

Both are asserted through ``serialize``, which is what every read path
returns, rather than through the helpers behind it: a field that is right
in a helper and absent from the payload is the shape of defect this epic
keeps shipping.
"""

from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import api
from asset_approval.gate import COMMAND_KEY, RESTORE_COMMAND
from pytest_mock import MockerFixture

#: The author, and the subject that grants them editorship.
AUTHOR_ID = 7
AUTHOR_SUBJECT_ID = 70

#: The approver's own subject, so a share with someone else is not a
#: share with the author.
OTHER_SUBJECT_ID = 90


def _author() -> SimpleNamespace:
    return SimpleNamespace(
        id=AUTHOR_ID, username="alex", first_name="Alex", last_name="Diaz"
    )


def _chart(deleted_at: Any = None, editor_subject_ids: tuple[int, ...] = ()) -> Any:
    return SimpleNamespace(
        id=42,
        slice_name="Genders by State",
        deleted_at=deleted_at,
        editors=[SimpleNamespace(id=subject) for subject in editor_subject_ids],
    )


def _request(command_args: dict[str, Any] | None = None) -> SimpleNamespace:
    return SimpleNamespace(
        id=4,
        asset_type="chart",
        asset_id=42,
        author=_author(),
        author_fk=AUTHOR_ID,
        requested_approver=None,
        reviewer=None,
        status="pending",
        is_open=True,
        note=None,
        review_note=None,
        created_on=None,
        changed_on=None,
        submitted_at=None,
        decided_at=None,
        operation="update",
        payload_dict={},
        base_dict={},
        command_args=command_args or {},
    )


def _restore_request() -> SimpleNamespace:
    """A restore is captured as an update carrying the command to replay."""
    return _request({COMMAND_KEY: RESTORE_COMMAND})


@pytest.fixture(autouse=True)
def quiet_neighbours(mocker: MockerFixture) -> None:
    """The parts of ``serialize`` these two fields do not depend on.

    The dataset lookup behind ``pending_dependency`` is the only one that
    would reach the database from here, and it has tests of its own.
    """
    mocker.patch.object(api, "find_open_request", return_value=None)


@pytest.fixture
def editorship(mocker: MockerFixture) -> None:
    """``is_strict_editor`` driven for real, through its two lookups.

    Patching ``is_strict_editor`` itself would assert nothing: the point of
    the field is that it asks the strict check, so the strict check runs
    and the asset's editors decide the answer.
    """
    mocker.patch(
        "superset.subjects.utils.get_user_subject_ids",
        side_effect=lambda user_id: (
            [AUTHOR_SUBJECT_ID] if user_id == AUTHOR_ID else [OTHER_SUBJECT_ID]
        ),
    )
    mocker.patch(
        "superset.security.manager.get_extra_editor_subject_ids", return_value=[]
    )


@pytest.fixture
def loads_the_archived_chart(mocker: MockerFixture) -> Any:
    """The chart DAO's behaviour in miniature: deleted rows need asking for."""

    def _find(asset_id: int, **kwargs: Any) -> Any:
        archived = _chart(deleted_at="2026-10-30T12:00:00")
        return archived if kwargs.get("skip_visibility_filter") else None

    return mocker.patch("superset.daos.chart.ChartDAO.find_by_id", side_effect=_find)


# ------------------------------------------------------- asset_archived


def test_a_change_about_an_archived_asset_says_the_asset_is_archived(
    editorship: None, loads_the_archived_chart: Any
) -> None:
    """The field the routing decision now hangs on (R3-01)."""
    archived = _chart(deleted_at="2026-10-30T12:00:00")

    payload = api.serialize(_restore_request(), archived)

    assert payload["asset_archived"] is True


def test_a_change_about_a_live_asset_says_it_is_not(
    editorship: None, mocker: MockerFixture
) -> None:
    mocker.patch("superset.daos.chart.ChartDAO.find_by_id", return_value=_chart())

    payload = api.serialize(_request(), _chart())

    assert payload["asset_archived"] is False


def test_the_answer_comes_from_the_asset_not_from_the_command(
    editorship: None, loads_the_archived_chart: Any
) -> None:
    """The whole point of moving this to the server.

    A change that is *not* a restore, about an asset that *is* archived,
    was the case the ``command === 'restore'`` test could never catch: the
    reviewer was sent to the dead page anyway. The field answers from the
    asset, so this reads the same as a restore does.
    """
    archived = _chart(deleted_at="2026-10-30T12:00:00")

    payload = api.serialize(_request(), archived)

    assert payload["asset_archived"] is True


def test_a_restore_whose_asset_already_came_back_is_not_archived(
    editorship: None, mocker: MockerFixture
) -> None:
    # Restored while the request waited, so it has a page again and the
    # reviewer should be taken to it. The command still says "restore".
    mocker.patch("superset.daos.chart.ChartDAO.find_by_id", return_value=_chart())

    payload = api.serialize(_restore_request(), _chart())

    assert payload["asset_archived"] is False


def test_an_unreadable_asset_is_not_called_archived(
    editorship: None, mocker: MockerFixture
) -> None:
    # ``serialize`` is called without an asset on the paths that have
    # none. Guessing "archived" there would route every such row into the
    # approve dialog on no evidence.
    mocker.patch("superset.daos.chart.ChartDAO.find_by_id", return_value=None)

    payload = api.serialize(_request())

    assert payload["asset_archived"] is False


# ------------------------------------------------- author_can_still_edit


def test_an_author_who_is_still_an_editor_reads_as_one(
    editorship: None, mocker: MockerFixture
) -> None:
    chart = _chart(editor_subject_ids=(AUTHOR_SUBJECT_ID,))
    mocker.patch("superset.daos.chart.ChartDAO.find_by_id", return_value=chart)

    payload = api.serialize(_request(), chart)

    assert payload["author_can_still_edit"] is True


def test_an_author_who_lost_edit_access_is_reported_before_the_button(
    editorship: None, mocker: MockerFixture
) -> None:
    """The half of QA-07 that was never built.

    The approve route already refuses this with a 409 naming the author.
    Until the payload said so, the approver met that sentence only after
    pressing a button the server was always going to refuse.
    """
    chart = _chart(editor_subject_ids=(OTHER_SUBJECT_ID,))
    mocker.patch("superset.daos.chart.ChartDAO.find_by_id", return_value=chart)

    payload = api.serialize(_request(), chart)

    assert payload["author_can_still_edit"] is False


def test_an_asset_with_no_editors_at_all_leaves_nobody_able_to_edit(
    editorship: None, mocker: MockerFixture
) -> None:
    chart = _chart()
    mocker.patch("superset.daos.chart.ChartDAO.find_by_id", return_value=chart)

    payload = api.serialize(_request(), chart)

    assert payload["author_can_still_edit"] is False


def test_the_check_is_the_strict_one_with_no_administrator_shortcut(
    mocker: MockerFixture
) -> None:
    # The refusal this note warns of is raised by ``is_strict_editor``,
    # which waves nobody through on the strength of a role. A note computed
    # from a looser check would tell an admin author's reviewer that all is
    # well and then refuse them (QA-07).
    strict = mocker.patch.object(api, "is_strict_editor", return_value=False)
    chart = _chart()
    mocker.patch("superset.daos.chart.ChartDAO.find_by_id", return_value=chart)

    payload = api.serialize(_request(), chart)

    assert payload["author_can_still_edit"] is False
    # Asked about the author, never about whoever is reading the queue.
    assert strict.call_args.args[1] == AUTHOR_ID


def test_the_question_is_asked_of_the_archived_asset_too(
    editorship: None, loads_the_archived_chart: Any
) -> None:
    # A restore is the one request whose asset is deleted, and its author
    # still has to hold the asset for the replay to run as them.
    archived = _chart(
        deleted_at="2026-10-30T12:00:00", editor_subject_ids=(AUTHOR_SUBJECT_ID,)
    )

    payload = api.serialize(_restore_request(), archived)

    assert payload["author_can_still_edit"] is True


def test_an_unreadable_asset_does_not_accuse_the_author(
    editorship: None, mocker: MockerFixture
) -> None:
    # Nothing to be an editor of, so nothing is established. Warning of a
    # loss of access we have not shown would be worse than saying nothing.
    mocker.patch("superset.daos.chart.ChartDAO.find_by_id", return_value=None)

    payload = api.serialize(_request())

    assert payload["author_can_still_edit"] is True


# ---------------------------------------------------- both, on every read


def test_both_fields_are_on_the_payload_every_read_path_returns(
    editorship: None, mocker: MockerFixture
) -> None:
    """``serialize`` is the one place the queue, the banner and the bell share.

    Four rows in this epic read "Fixed" because the fix sat beside the path
    the product uses. A field present only on the detail endpoint would be
    the same defect: the Approvals queue reads these from the list.
    """
    chart = _chart()
    mocker.patch("superset.daos.chart.ChartDAO.find_by_id", return_value=chart)

    payload = api.serialize(_request(), chart)

    assert "asset_archived" in payload
    assert "author_can_still_edit" in payload
