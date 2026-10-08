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
"""
Result-shape handling for the SQL tool.

``Database.execute`` returns a ``DataFrame`` when a row limit was supplied and a
plain list of mappings when one was not. The tool asked for both at different
times and only handled the first, which surfaced as an ``AttributeError`` on a
perfectly ordinary query — hence these.
"""

from __future__ import annotations


def test_dataframe_results_are_normalised() -> None:
    """A frame yields column dtypes and records."""
    import pandas as pd

    from superset.ai.tools.sql import _columns_and_records

    frame = pd.DataFrame({"one": [1, 2], "two": ["a", "b"]})
    columns, records = _columns_and_records(frame)

    assert [c["name"] for c in columns] == ["one", "two"]
    assert all(c["type"] != "unknown" for c in columns)
    assert records == [{"one": 1, "two": "a"}, {"one": 2, "two": "b"}]


def test_list_results_are_normalised() -> None:
    """A list of mappings yields the same shape, without dtypes."""
    from superset.ai.tools.sql import _columns_and_records

    columns, records = _columns_and_records(
        [{"one": 1, "two": "a"}, {"one": 2, "two": "b"}]
    )

    assert [c["name"] for c in columns] == ["one", "two"]
    assert records == [{"one": 1, "two": "a"}, {"one": 2, "two": "b"}]


def test_ragged_list_results_collect_every_column() -> None:
    """
    A column absent from the first row is still reported.

    Taking the keys of row one only would silently drop a column that a later
    row carries.
    """
    from superset.ai.tools.sql import _columns_and_records

    columns, _ = _columns_and_records([{"a": 1}, {"a": 2, "b": 3}])
    assert [c["name"] for c in columns] == ["a", "b"]


def test_empty_results_are_handled() -> None:
    """No rows is not an error."""
    from superset.ai.tools.sql import _columns_and_records

    assert _columns_and_records([]) == ([], [])
    assert _columns_and_records(None) == ([], [])


def test_row_limit_never_becomes_unbounded(app_context: None) -> None:
    """
    The limit is always a positive integer.

    A falsy ceiling would send an unlimited query — the exact outcome this
    helper exists to prevent — and would also change the result shape the tool
    receives back.
    """
    from unittest.mock import patch

    from flask import current_app

    from superset.ai.tools.sql import _row_limit

    assert _row_limit(None) > 0
    for bad in (None, 0, -5, "nonsense"):
        with patch.dict(current_app.config, {"AI_AGENT_MAX_RESULT_ROWS": bad}):
            assert _row_limit(None) > 0, bad


def test_row_limit_only_narrows(app_context: None) -> None:
    """A model cannot raise the ceiling by asking for more."""
    from unittest.mock import patch

    from flask import current_app

    from superset.ai.tools.sql import _row_limit

    with patch.dict(current_app.config, {"AI_AGENT_MAX_RESULT_ROWS": 10}):
        assert _row_limit(5) == 5
        assert _row_limit(5000) == 10


def test_row_limit_rejects_nonsense(app_context: None) -> None:
    """A malformed limit is reported rather than coerced."""
    import pytest

    from superset.ai.tools.base import ToolError
    from superset.ai.tools.sql import _row_limit

    for bad in (0, -1, "10", 1.5, True):
        with pytest.raises(ToolError, match="positive integer"):
            _row_limit(bad)
