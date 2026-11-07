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
"""Syncing columns from the source is exempt through the editor too (S-04).

The dedicated refresh endpoint was made exempt on the SOW 5.2 grounds that
it does not author a change, it re-reads what the database already says
(``test_dataset_refresh``). "Sync columns from source" in the dataset editor
is the same act, but it does not write: it reads the source's columns into
the open dialog, and the author's Save then carries them through the ordinary
governed PUT. So the editor's half of that row was still going to review.

The exemption here is deliberately narrow, and these tests are mostly about
the narrowness: anything beyond a type that the source itself reports is
authored, and stays governed.

Two things this exemption is NOT, worth saying because both were assumed.
It is not a statement about the refresh the dataset route runs *after* an
``override_columns`` save -- that is a separate write with its own
exemption, and what it writes is pinned in ``test_dataset_refresh``. And it
is not a licence to move a column flag: every case below carried
``groupby=True`` on both sides, so a column an editor had deliberately
restricted never flowed through these tests at all. The last two cases are
that column, because re-enabling grouping on it is an authored change and
has to stay governed.
"""

from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval.changes import columns_only_resynced


def _stored(groupby: bool = True, **types: str) -> Any:
    """The dataset as stored. ``groupby`` is the editor's own choice about
    every column here, and defaults to the open state most columns are in."""
    return SimpleNamespace(
        table_name="bart_lines",
        columns=[
            SimpleNamespace(
                column_name=name, type=type_, verbose_name=None, groupby=groupby
            )
            for name, type_ in types.items()
        ],
        external_metadata=lambda: [
            {"name": "name", "type": "TEXT"},
            {"name": "color", "type": "TEXT"},
        ],
    )


def _posted(*columns: dict[str, Any]) -> dict[str, Any]:
    return {"columns": list(columns)}


def test_types_brought_into_line_with_the_source_are_exempt() -> None:
    asset = _stored(name="VARCHAR", color="VARCHAR")

    assert columns_only_resynced(
        asset,
        _posted(
            {"column_name": "name", "type": "TEXT", "groupby": True},
            {"column_name": "color", "type": "TEXT", "groupby": True},
        ),
    )


def test_a_type_the_source_does_not_report_is_authored() -> None:
    """Typing a type by hand is an edit, however plausible the value."""
    asset = _stored(name="VARCHAR", color="VARCHAR")

    assert not columns_only_resynced(
        asset,
        _posted(
            {"column_name": "name", "type": "BIGINT"},
            {"column_name": "color", "type": "TEXT"},
        ),
    )


def test_another_field_moving_alongside_keeps_the_whole_save_governed() -> None:
    asset = _stored(name="VARCHAR", color="VARCHAR")

    assert not columns_only_resynced(
        asset,
        _posted(
            {"column_name": "name", "type": "TEXT", "verbose_name": "Line name"},
            {"column_name": "color", "type": "TEXT"},
        ),
    )


def test_a_dropped_column_is_governed() -> None:
    asset = _stored(name="VARCHAR", color="VARCHAR")

    assert not columns_only_resynced(
        asset, _posted({"column_name": "name", "type": "TEXT"})
    )


def test_an_added_column_is_governed() -> None:
    asset = _stored(name="VARCHAR", color="VARCHAR")

    assert not columns_only_resynced(
        asset,
        _posted(
            {"column_name": "name", "type": "TEXT"},
            {"column_name": "color", "type": "TEXT"},
            {"column_name": "polyline", "type": "TEXT"},
        ),
    )


def test_a_save_that_moves_no_type_is_not_a_resync() -> None:
    """Nothing for this exemption to say, and no reason to ask the source."""
    asked = []
    asset = _stored(name="TEXT", color="TEXT")
    asset.external_metadata = lambda: asked.append(1) or []

    assert not columns_only_resynced(
        asset,
        _posted(
            {"column_name": "name", "type": "TEXT"},
            {"column_name": "color", "type": "TEXT"},
        ),
    )
    assert asked == []


def test_a_source_that_cannot_be_read_leaves_the_save_governed() -> None:
    """Fails closed: an unreachable database makes saves reviewed, not exempt."""
    asset = _stored(name="VARCHAR", color="VARCHAR")

    def unreachable() -> list[dict[str, Any]]:
        raise RuntimeError("could not connect")

    asset.external_metadata = unreachable

    assert not columns_only_resynced(
        asset,
        _posted(
            {"column_name": "name", "type": "TEXT"},
            {"column_name": "color", "type": "TEXT"},
        ),
    )


@pytest.mark.parametrize("posted", [{}, {"columns": None}, {"columns": "TEXT"}])
def test_a_payload_without_columns_says_nothing(posted: dict[str, Any]) -> None:
    assert not columns_only_resynced(_stored(name="VARCHAR"), posted)


def test_a_restricted_column_is_still_a_resync_when_only_its_type_moved() -> None:
    """The exemption does not depend on a column being open.

    An editor who turned grouping off on a column should still be able to
    pull the source's types in without that becoming a review.
    """
    asset = _stored(groupby=False, name="VARCHAR", color="VARCHAR")

    assert columns_only_resynced(
        asset,
        _posted(
            {"column_name": "name", "type": "TEXT", "groupby": False},
            {"column_name": "color", "type": "TEXT", "groupby": False},
        ),
    )


def test_but_re_enabling_grouping_on_it_is_authored_and_stays_governed() -> None:
    """The case the old fixtures could not express, and the one that matters.

    ``groupby`` is an editor's decision and the source has no opinion about
    it, so a save that turns it back on is an authored change however many
    types moved alongside. Exempt, it would reverse a restriction with
    nobody reviewing it -- which is exactly the damage the refresh was doing
    on the other side of the same save.
    """
    asset = _stored(groupby=False, name="VARCHAR", color="VARCHAR")

    assert not columns_only_resynced(
        asset,
        _posted(
            {"column_name": "name", "type": "TEXT", "groupby": True},
            {"column_name": "color", "type": "TEXT", "groupby": False},
        ),
    )
