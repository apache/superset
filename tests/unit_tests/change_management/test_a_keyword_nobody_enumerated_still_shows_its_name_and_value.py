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
"""A keyword nobody has heard of still reaches the reviewer, by name and value.

This is the property of ``test_a_field_nobody_listed_still_shows_its_before_and_after``
one level down. The gate captures whatever a command was constructed with, so
a keyword added to a command next week is held, replayed on approval and --
unless the panel fails closed -- shown nowhere. A panel that explains five
keywords and skips the rest has moved the blind approval from the fields to
the arguments.

So the default is chosen without knowing the keyword, and the five that have
sentences of their own only improve on it. These use names that appear
nowhere in the code: a test that named a keyword the code knew would pass
whether or not the class was closed.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import api
from asset_approval.gate import KWARGS_KEY
from pytest_mock import MockerFixture


def _request(**keywords: Any) -> Any:
    return SimpleNamespace(
        operation="update",
        command_args={KWARGS_KEY: keywords},
        payload_dict={},
    )


@pytest.fixture(autouse=True)
def no_database(mocker: MockerFixture) -> None:
    mocker.patch.object(api, "_names_of", return_value={})
    mocker.patch.object(api, "_dashboard_published", return_value=None)


def test_an_unrecognised_keyword_shows_its_name_and_its_value() -> None:
    [entry] = api.describe_changes(
        _request(zorblax_mode="lenient"), SimpleNamespace()
    )

    assert entry["field"] == "zorblax_mode"
    assert entry["keyword"] is True
    assert entry["after"] == "lenient"
    assert "zorblax_mode" in entry["summary"]
    assert '"lenient"' in entry["summary"]


@pytest.mark.parametrize(
    ("value", "after", "in_the_sentence"),
    [
        (True, True, "true"),
        (3, 3, "3"),
        ("text", "text", '"text"'),
        ([1, 2], "1, 2", "[1, 2]"),
        (["b", "a"], "b, a", '["b", "a"]'),
        ({"k": 1}, '{"k": 1}', '{"k": 1}'),
    ],
)
def test_the_value_is_shown_whatever_its_shape(
    value: Any, after: Any, in_the_sentence: str
) -> None:
    [entry] = api.describe_changes(_request(quux_toggle=value), SimpleNamespace())

    assert entry["after"] == after
    assert entry["summary"].endswith(f"quux_toggle = {in_the_sentence}")


def test_a_long_value_is_shortened_and_says_so() -> None:
    [entry] = api.describe_changes(
        _request(wibble_payload="x" * 5000), SimpleNamespace()
    )

    assert entry["truncated"] is True
    assert entry["after"]  # shortened, never dropped
    assert len(entry["summary"]) < 1000


def test_every_captured_keyword_gets_exactly_one_entry() -> None:
    """The property that retires the class: nothing captured is skipped.

    A mix of the keywords with sentences of their own and ones without, in one
    write. Whatever the capture holds, the list holds -- by count, so a
    renderer that quietly returned nothing cannot hide behind a neighbour.
    """
    keywords = {
        "delete_metric_ids": [1],
        "preserve_existing_metrics": True,
        "override_columns": True,
        "save_to_dashboard_id": 5,
        "new_dashboard_name": "Board",
        "never_heard_of_it": "yes",
        "nor_this": [3],
    }

    entries = api.describe_changes(_request(**keywords), SimpleNamespace())

    assert sorted(entry["field"] for entry in entries) == sorted(keywords)
    assert all(entry["keyword"] and entry["summary"] for entry in entries)


def test_a_known_keyword_with_a_value_its_renderer_cannot_read_falls_back() -> None:
    """A sentence is a courtesy. A value it does not fit is still shown."""
    entries = api.describe_changes(
        _request(
            delete_metric_ids="not a list of ids",
            save_to_dashboard_id="not an id",
            new_dashboard_name=["not", "a", "name"],
            preserve_existing_metrics="maybe",
            override_columns="maybe",
        ),
        SimpleNamespace(metrics=[]),
    )

    assert len(entries) == 5
    for entry in entries:
        assert entry["field"] in entry["summary"]
        assert entry["after"] is not None


def test_a_renderer_that_raises_costs_the_sentence_and_not_the_row(
    mocker: MockerFixture,
) -> None:
    def boom(*_args: Any) -> None:
        raise RuntimeError("lookup failed")

    mocker.patch.dict(api._KEYWORD_RENDERERS, {"delete_metric_ids": boom})

    [entry] = api.describe_changes(_request(delete_metric_ids=[3]), SimpleNamespace())

    assert entry["field"] == "delete_metric_ids"
    assert "[3]" in entry["summary"]


def test_a_write_carrying_no_keyword_lists_none() -> None:
    request = SimpleNamespace(operation="update", command_args={}, payload_dict={})

    assert api.describe_changes(request, SimpleNamespace()) == []
