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
"""Dashboard CSS is shown, because CSS can hide anything.

``css`` was one of five names in ``OPAQUE_FIELDS``, so a stylesheet edit
reached the reviewer as the word "Changed". A rule that sets
``display: none`` on a chart, a filter bar or a warning banner is the
quietest possible edit, and it is exactly the one the reviewer was not shown.

``css`` is text. It is now shown as text, before and after, like any other
text field; a long one is cut around the edit and said to be cut.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

from asset_approval import api


def _request(payload: dict[str, Any]) -> Any:
    return SimpleNamespace(operation="update", command_args={}, payload_dict=payload)


def test_a_stylesheet_edit_shows_both_stylesheets() -> None:
    asset = SimpleNamespace(css=".chart { color: red }")

    [entry] = api.describe_changes(
        _request({"css": ".chart { display: none }"}), asset
    )

    assert entry == {
        "field": "css",
        "before": ".chart { color: red }",
        "after": ".chart { display: none }",
    }


def test_a_stylesheet_written_over_an_empty_one_is_shown() -> None:
    asset = SimpleNamespace(css=None)

    [entry] = api.describe_changes(_request({"css": "body { display: none }"}), asset)

    assert entry["after"] == "body { display: none }"
    assert entry["before"] is None


def test_an_edit_at_the_end_of_a_long_stylesheet_is_inside_the_window() -> None:
    """The case cutting from the start gets wrong.

    The first two thousand characters of both sides are identical, so a
    reviewer shown them is shown two equal blocks and told they were
    shortened -- the edit is exactly what was cut.
    """
    shared = "".join(f".rule-{n} {{ margin: 0 }}\n" for n in range(400))
    assert len(shared) > api.SHOWN_VALUE_LIMIT * 2
    asset = SimpleNamespace(css=shared + ".banner { display: block }")

    [entry] = api.describe_changes(
        _request({"css": shared + ".banner { display: none }"}), asset
    )

    assert entry["truncated"] is True
    assert "display: block" in entry["before"]
    assert "display: none" in entry["after"]
    assert len(entry["after"]) <= api.SHOWN_VALUE_LIMIT + 1


def test_a_long_value_present_on_one_side_only_is_still_cut_from_the_start() -> None:
    asset = SimpleNamespace(css=None)

    [entry] = api.describe_changes(
        _request({"css": "x" * (api.SHOWN_VALUE_LIMIT + 10)}), asset
    )

    assert entry["truncated"] is True
    assert len(entry["after"]) == api.SHOWN_VALUE_LIMIT
