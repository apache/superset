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
"""Certifying a dataset is exempt wherever the certification is kept (R4-06).

SOW 5.2 exempts certification. A chart and a dashboard hold it in columns
of their own, which the exempt list names. A dataset keeps it inside
``extra``, so certifying one arrived as a change to a governed JSON column
and was refused while another editor had a change open -- the deadlock the
exemption exists to prevent.
"""

from types import SimpleNamespace
from typing import Any

from asset_approval import bindings
from superset.utils import json


def _dataset(extra: dict[str, Any] | None = None, **fields: Any) -> SimpleNamespace:
    base = {
        "extra": json.dumps(extra) if extra is not None else None,
        "description": "A dataset",
        "sql": "SELECT 1",
    }
    base.update(fields)
    return SimpleNamespace(**base)


def _certification(by: str = "Risk", details: str = "Signed off") -> dict[str, Any]:
    return {"certification": {"certified_by": by, "details": details}}


def test_certifying_a_dataset_is_exempt() -> None:
    live = _dataset()
    payload = {"extra": json.dumps(_certification())}

    assert bindings._only_exempt(live, payload) is True


def test_recertifying_with_different_words_is_exempt() -> None:
    live = _dataset(extra=_certification(details="Old wording"))
    payload = {"extra": json.dumps(_certification(details="New wording"))}

    assert bindings._only_exempt(live, payload) is True


def test_clearing_the_certification_is_exempt() -> None:
    live = _dataset(extra=_certification())
    payload = {"extra": json.dumps({})}

    assert bindings._only_exempt(live, payload) is True


def test_certification_alongside_a_governed_field_is_not_exempt() -> None:
    """The exemption is per write, not per field."""
    live = _dataset()
    payload = {"extra": json.dumps(_certification()), "sql": "SELECT 2"}

    assert bindings._only_exempt(live, payload) is False


def test_another_entry_in_extra_is_not_exempt() -> None:
    live = _dataset()
    payload = {"extra": json.dumps({"warning_markdown": "Do not use"})}

    assert bindings._only_exempt(live, payload) is False


def test_certification_beside_another_entry_in_extra_is_not_exempt() -> None:
    live = _dataset()
    payload = {
        "extra": json.dumps(
            {**_certification(), "warning_markdown": "Do not use"}
        )
    }

    assert bindings._only_exempt(live, payload) is False


def test_an_unreadable_extra_is_not_exempt() -> None:
    live = _dataset(extra=_certification())
    payload = {"extra": "not json at all"}

    assert bindings._only_exempt(live, payload) is False


def test_extra_rewritten_with_the_same_meaning_is_not_a_change() -> None:
    """Re-serialising the blob must not read as a certification edit."""
    live = _dataset(extra={"certification": {"certified_by": "Risk", "details": "x"}})
    payload = {"extra": json.dumps({"certification": {"details": "x", "certified_by": "Risk"}})}

    assert bindings._only_exempt(live, payload) is False
