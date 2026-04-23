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
"""Unit tests for the pure sort-and-page helper used by the aggregated
soft-deleted endpoint (sc-103157 US4).

The ORM-integrated ``DeletedDAO.list`` path is covered by the
integration tests in ``tests/integration_tests/deleted/api_tests.py``.
These unit tests cover the merge/sort/page helper in isolation so we
can reason about ordering, null handling, and paging without a DB.
"""

from __future__ import annotations

from datetime import datetime

from superset.deleted.dao import sort_and_page


def _row(**kwargs):
    """Build a minimal row dict with sensible defaults."""
    return {
        "type": kwargs.get("type", "chart"),
        "id": kwargs.get("id", 1),
        "uuid": kwargs.get("uuid", "u"),
        "name": kwargs.get("name", "name"),
        "deleted_at": kwargs.get("deleted_at"),
        "deleted_by": kwargs.get("deleted_by"),
    }


# ---------------------------------------------------------------------------
# deleted_at sort (default)
# ---------------------------------------------------------------------------


def test_sort_by_deleted_at_desc_is_default_order():
    rows = [
        _row(name="earlier", deleted_at=datetime(2026, 4, 20)),
        _row(name="later", deleted_at=datetime(2026, 4, 22)),
        _row(name="middle", deleted_at=datetime(2026, 4, 21)),
    ]
    out = sort_and_page(
        rows,
        order_column="deleted_at",
        order_direction="desc",
        page=0,
        page_size=10,
    )
    assert [r["name"] for r in out] == ["later", "middle", "earlier"]


def test_sort_by_deleted_at_asc():
    rows = [
        _row(name="later", deleted_at=datetime(2026, 4, 22)),
        _row(name="earlier", deleted_at=datetime(2026, 4, 20)),
    ]
    out = sort_and_page(
        rows,
        order_column="deleted_at",
        order_direction="asc",
        page=0,
        page_size=10,
    )
    assert [r["name"] for r in out] == ["earlier", "later"]


# ---------------------------------------------------------------------------
# name / type sort (cross-type)
# ---------------------------------------------------------------------------


def test_sort_by_name_crosses_types():
    rows = [
        _row(type="dashboard", name="Zebra"),
        _row(type="chart", name="Alpha"),
        _row(type="dataset", name="Mango"),
    ]
    out = sort_and_page(
        rows,
        order_column="name",
        order_direction="asc",
        page=0,
        page_size=10,
    )
    assert [r["name"] for r in out] == ["Alpha", "Mango", "Zebra"]


def test_sort_by_type_groups_rows():
    rows = [
        _row(type="dataset", name="x"),
        _row(type="chart", name="y"),
        _row(type="dashboard", name="z"),
    ]
    out = sort_and_page(
        rows,
        order_column="type",
        order_direction="asc",
        page=0,
        page_size=10,
    )
    assert [r["type"] for r in out] == ["chart", "dashboard", "dataset"]


# ---------------------------------------------------------------------------
# deleted_by sort (through nested username)
# ---------------------------------------------------------------------------


def test_sort_by_deleted_by_uses_username():
    rows = [
        _row(name="by-bob", deleted_by={"username": "bob"}),
        _row(name="by-alice", deleted_by={"username": "alice"}),
        _row(name="by-carol", deleted_by={"username": "carol"}),
    ]
    out = sort_and_page(
        rows,
        order_column="deleted_by",
        order_direction="asc",
        page=0,
        page_size=10,
    )
    assert [r["name"] for r in out] == ["by-alice", "by-bob", "by-carol"]


def test_sort_by_deleted_by_with_null_user_sorts_last_ascending():
    rows = [
        _row(name="has-user", deleted_by={"username": "alice"}),
        _row(name="anon", deleted_by=None),
    ]
    out = sort_and_page(
        rows,
        order_column="deleted_by",
        order_direction="asc",
        page=0,
        page_size=10,
    )
    assert [r["name"] for r in out] == ["has-user", "anon"]


def test_sort_by_deleted_by_with_null_user_still_sorts_last_descending():
    """Null users sort last in both directions (design decision — they
    shouldn't float to the top of a descending view)."""
    rows = [
        _row(name="has-user", deleted_by={"username": "alice"}),
        _row(name="anon", deleted_by=None),
    ]
    out = sort_and_page(
        rows,
        order_column="deleted_by",
        order_direction="desc",
        page=0,
        page_size=10,
    )
    assert [r["name"] for r in out] == ["has-user", "anon"]


# ---------------------------------------------------------------------------
# paging
# ---------------------------------------------------------------------------


def test_pagination_slices_after_sorting():
    rows = [_row(name=f"item-{i:02d}") for i in range(10)]
    out = sort_and_page(
        rows,
        order_column="name",
        order_direction="asc",
        page=1,
        page_size=3,
    )
    assert [r["name"] for r in out] == ["item-03", "item-04", "item-05"]


def test_pagination_beyond_end_returns_empty():
    rows = [_row(name=f"item-{i}") for i in range(3)]
    out = sort_and_page(
        rows,
        order_column="name",
        order_direction="asc",
        page=5,
        page_size=10,
    )
    assert out == []


def test_page_zero_returns_first_page():
    rows = [_row(name=f"item-{i:02d}") for i in range(5)]
    out = sort_and_page(
        rows,
        order_column="name",
        order_direction="asc",
        page=0,
        page_size=2,
    )
    assert [r["name"] for r in out] == ["item-00", "item-01"]


# ---------------------------------------------------------------------------
# edge cases
# ---------------------------------------------------------------------------


def test_empty_rows_returns_empty():
    assert (
        sort_and_page(
            [],
            order_column="deleted_at",
            order_direction="desc",
            page=0,
            page_size=25,
        )
        == []
    )


def test_unknown_order_column_falls_back_to_deleted_at():
    """Defensive fallback: if an unknown column is passed (the API
    layer catches this, but the helper is pure-defensive), sort by
    deleted_at."""
    rows = [
        _row(name="a", deleted_at=datetime(2026, 4, 20)),
        _row(name="b", deleted_at=datetime(2026, 4, 22)),
    ]
    out = sort_and_page(
        rows,
        order_column="bogus_column",
        order_direction="desc",
        page=0,
        page_size=10,
    )
    assert [r["name"] for r in out] == ["b", "a"]
