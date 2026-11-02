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
"""Two ways of saying a field is empty are not an edit to it (R4-06).

A column that was never given an ``extra`` blob holds NULL; the dataset
editor posts every column back with ``extra`` set to the string ``"{}"``.
Read literally those differ, so every dataset save reported every column and
every metric as changed. One cause, four symptoms: a save that edited
nothing was refused as a governed change, certifying a dataset was never
exempt because the echo dragged columns and metrics along, a reviewer's
"What changed" always led with columns and metrics, and an author could not
make an exempt-only dataset edit at all.
"""

from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import bindings
from asset_approval.changes import changed_fields
from superset.utils import json

EMPTY = [None, "", "   ", "{}", " {} ", "[]", {}, []]


def _column(name: str, **fields: Any) -> SimpleNamespace:
    base = {
        "column_name": name,
        "verbose_name": None,
        "type": "VARCHAR",
        "expression": None,
        "description": None,
        "is_dttm": False,
        "filterable": True,
        "groupby": True,
        "extra": None,
    }
    base.update(fields)
    return SimpleNamespace(**base)


def _dataset(**fields: Any) -> SimpleNamespace:
    base = {
        "table_name": "bart_lines",
        "description": None,
        "sql": None,
        "extra": None,
        "columns": [_column("name"), _column("colour")],
        "metrics": [
            SimpleNamespace(metric_name="count", expression="COUNT(*)", extra=None)
        ],
    }
    base.update(fields)
    return SimpleNamespace(**base)


def _editor_echo() -> dict[str, Any]:
    """What the dataset editor posts back when nothing was edited."""
    return {
        "table_name": "bart_lines",
        "description": None,
        "sql": "",
        "columns": [
            {"column_name": "name", "extra": "{}"},
            {"column_name": "colour", "extra": "{}"},
        ],
        "metrics": [
            {"metric_name": "count", "expression": "COUNT(*)", "extra": "{}"}
        ],
    }


def test_the_editors_own_echo_is_not_a_change() -> None:
    assert changed_fields(_dataset(), _editor_echo()) == []


def test_certifying_through_the_editor_is_exempt() -> None:
    """The whole point: the echo must not drag governed fields along."""
    payload = {
        **_editor_echo(),
        "extra": json.dumps({"certification": {"certified_by": "Risk"}}),
    }

    assert changed_fields(_dataset(), payload) == ["extra"]
    assert bindings._only_exempt(_dataset(), payload) is True


@pytest.mark.parametrize("posted", EMPTY)
@pytest.mark.parametrize("stored", EMPTY)
def test_every_spelling_of_empty_agrees_with_every_other(
    posted: Any, stored: Any
) -> None:
    live = _dataset(description=stored)

    assert changed_fields(live, {"description": posted}) == []


def test_filling_an_empty_field_is_still_a_change() -> None:
    assert changed_fields(_dataset(), {"description": "Now set"}) == ["description"]


def test_emptying_a_field_that_held_something_is_still_a_change() -> None:
    live = _dataset(description="Was set")

    assert changed_fields(live, {"description": ""}) == ["description"]
    assert changed_fields(live, {"description": None}) == ["description"]


def test_a_real_column_edit_is_still_seen_through_the_echo() -> None:
    payload = _editor_echo()
    payload["columns"][0]["verbose_name"] = "Station name"

    assert changed_fields(_dataset(), payload) == ["columns"]


def test_a_column_whose_extra_really_moved_is_still_a_change() -> None:
    payload = _editor_echo()
    payload["columns"][0]["extra"] = json.dumps({"warning_markdown": "careful"})

    assert changed_fields(_dataset(), payload) == ["columns"]


def test_a_blob_that_is_not_empty_is_not_mistaken_for_empty() -> None:
    live = _dataset(extra=json.dumps({"certification": {"certified_by": "Risk"}}))

    assert changed_fields(live, {"extra": "{}"}) == ["extra"]
