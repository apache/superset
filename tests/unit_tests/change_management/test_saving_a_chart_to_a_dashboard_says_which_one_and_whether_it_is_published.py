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
"""A legacy chart save that also files the chart on a dashboard says so.

The author asked for a rename; the reviewer saw a rename. The chart was also
added to a published dashboard, and nothing the reviewer was shown said so
(``save_to_dashboard_id`` was neither captured nor displayed). It is captured
now and so it has to be read: which dashboard, by name, and whether that
dashboard is published -- the difference between tidying a draft and putting a
chart in front of the people who view the board pack.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import api
from asset_approval.gate import KWARGS_KEY
from pytest_mock import MockerFixture


def _request(body: dict[str, Any] | None = None, **keywords: Any) -> Any:
    return SimpleNamespace(
        operation="update",
        command_args={KWARGS_KEY: keywords},
        payload_dict=body or {},
    )


def _dashboard(mocker: MockerFixture, *, name: str | None, published: bool | None):
    mocker.patch.object(
        api, "_names_of", return_value={5: name} if name else {}
    )
    mocker.patch.object(api, "_dashboard_published", return_value=published)


def test_it_says_the_chart_will_be_added_to_the_dashboard_by_name(
    mocker: MockerFixture,
) -> None:
    _dashboard(mocker, name="Board pack", published=False)

    [entry] = api.describe_changes(_request(save_to_dashboard_id=5), SimpleNamespace())

    assert entry["summary"].startswith('Also adds this chart to the dashboard "Board pack"')
    assert entry["after"] == "Board pack"


def test_it_says_so_when_the_dashboard_is_published(mocker: MockerFixture) -> None:
    _dashboard(mocker, name="Board pack", published=True)

    [entry] = api.describe_changes(_request(save_to_dashboard_id=5), SimpleNamespace())

    assert "PUBLISHED" in entry["summary"]
    assert entry["published"] is True


def test_it_says_when_the_dashboard_is_not_published(mocker: MockerFixture) -> None:
    _dashboard(mocker, name="Scratch", published=False)

    [entry] = api.describe_changes(_request(save_to_dashboard_id=5), SimpleNamespace())

    assert "not published" in entry["summary"]
    assert "PUBLISHED" not in entry["summary"]
    assert entry["published"] is False


def test_a_dashboard_whose_state_cannot_be_read_is_not_called_unpublished(
    mocker: MockerFixture,
) -> None:
    """The permissive answer to an unreadable fact is the wrong one."""
    _dashboard(mocker, name="Board pack", published=None)

    [entry] = api.describe_changes(_request(save_to_dashboard_id=5), SimpleNamespace())

    assert "could not be checked" in entry["summary"]
    assert "not published" not in entry["summary"]


def test_a_dashboard_nobody_can_name_is_shown_by_id(mocker: MockerFixture) -> None:
    _dashboard(mocker, name=None, published=True)

    [entry] = api.describe_changes(_request(save_to_dashboard_id=5), SimpleNamespace())

    assert entry["summary"].startswith("Also adds this chart to dashboard 5.")
    assert "PUBLISHED" in entry["summary"]


def test_a_rename_riding_with_the_attach_shows_both(mocker: MockerFixture) -> None:
    """The case as the reviewer met it: the rename, and now the dashboard."""
    _dashboard(mocker, name="Board pack", published=True)
    chart = SimpleNamespace(slice_name="Old")

    entries = api.describe_changes(
        _request({"slice_name": "New"}, save_to_dashboard_id=5), chart
    )

    assert [entry["field"] for entry in entries] == [
        "save_to_dashboard_id",
        "slice_name",
    ]


def test_a_new_dashboard_is_said_to_be_created(mocker: MockerFixture) -> None:
    mocker.patch.object(api, "_names_of", return_value={})

    [entry] = api.describe_changes(
        _request(new_dashboard_name="Quarterly review"), SimpleNamespace()
    )

    assert entry["summary"] == (
        'Also creates a new dashboard "Quarterly review" containing this chart.'
    )


def test_the_published_lookup_asks_the_database_and_survives_it_failing(
    mocker: MockerFixture,
) -> None:
    mocker.patch.object(
        api.db.session, "query", side_effect=RuntimeError("no database")
    )

    assert api._dashboard_published(5) is None


@pytest.mark.parametrize("published", [True, False])
def test_the_published_lookup_reads_the_dashboard_row(
    mocker: MockerFixture, published: bool
) -> None:
    row = SimpleNamespace(published=published)
    query = mocker.patch.object(api.db.session, "query")
    query.return_value.filter.return_value.one_or_none.return_value = row

    assert api._dashboard_published(5) is published
