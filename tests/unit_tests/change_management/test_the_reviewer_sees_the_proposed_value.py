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
"""A value that is there is never shown to the reviewer as absent.

Found by submitting a deliberately awkward change and reading the panel: a
string longer than 300 characters became ``None``, and the panel renders
``None`` exactly as it renders an emptied field. The reviewer saw the old
title struck through with nothing in its place, and the payload agreed:
``{"field": "dashboard_title", "before": "...", "after": null}``.

The title was the mild case. ``sql`` is not an opaque field, so it went
down the same path, and real SQL is hundreds of characters -- so a dataset
whose SQL had been rewritten showed the reviewer nothing at all, while
Visa Q11 asks for datasets to be reviewed as definitions, "a diff of
columns, metrics and SQL".

Approving what you cannot see is the thing this feature exists to prevent,
which makes this a weakness in the control rather than a rendering nit.
"""

from __future__ import annotations

from asset_approval.api import SHOWN_VALUE_LIMIT, _shown

REAL_SQL = """SELECT
    d.department_name,
    r.region_name,
    DATE_TRUNC('month', o.order_date) AS month,
    COUNT(DISTINCT o.order_id) AS orders,
    SUM(o.net_amount) AS revenue
FROM orders o
JOIN customers c ON c.customer_id = o.customer_id
JOIN regions r ON r.region_id = c.region_id
JOIN departments d ON d.department_id = o.department_id
WHERE o.status NOT IN ('cancelled', 'refunded')
  AND o.order_date >= '2024-01-01'
GROUP BY 1, 2, 3
ORDER BY revenue DESC"""


def test_a_realistic_sql_change_is_shown_in_full() -> None:
    """The case that mattered: it is well past the old 300 limit."""
    assert len(REAL_SQL) > 300

    shown, shortened = _shown(REAL_SQL)

    assert shown == REAL_SQL
    assert shortened is False


def test_a_value_too_long_to_show_is_shortened_and_says_so() -> None:
    """Shortened, never dropped. The flag is what stops the panel implying
    the field was emptied."""
    shown, shortened = _shown("x" * (SHOWN_VALUE_LIMIT + 50))

    assert shortened is True
    assert len(shown) == SHOWN_VALUE_LIMIT


def test_an_absent_value_is_still_absent() -> None:
    """Emptying a field is a real change and must keep reading as one."""
    assert _shown(None) == (None, False)


def test_ordinary_values_are_untouched() -> None:
    for value in ("a title", True, False, 0, 41.5):
        assert _shown(value) == (value, False)


def test_a_value_that_cannot_be_shown_at_all_is_not_invented() -> None:
    """A dict or a list is not something the panel can render inline; the
    caller marks the field opaque instead, which says "Changed" rather than
    claiming it was emptied."""
    assert _shown({"a": 1}) == (None, False)
    assert _shown([1, 2]) == (None, False)
