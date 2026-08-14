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

"""Query rows must survive JSON serialization.

A single NULL in a temporal column used to break every tool that embedded the
chart. ``pandas.NaT`` subclasses ``datetime.datetime``, so pydantic_core takes
the datetime path and reads ``.year`` — ``nan`` on NaT — and raises
``TypeError: 'float' object cannot be interpreted as an integer`` at
serialization time, long after the query succeeded. FastMCP's ``fallback=str``
does not help, because NaT is not an unknown type.
"""

import datetime

import pandas as pd
import pydantic_core
import pytest

from superset.mcp_service.chart.tool.get_chart_data import (
    _is_json_null,
    _json_safe_rows,
)


def test_nat_is_recognised_as_null() -> None:
    assert _is_json_null(pd.NaT)
    assert _is_json_null(float("nan"))
    assert _is_json_null(None)
    assert not _is_json_null(0)
    assert not _is_json_null("")
    assert not _is_json_null(datetime.datetime(2026, 1, 1))


def test_nat_would_break_serialization_unsanitised() -> None:
    """Pin the failure this exists to prevent, so the fix cannot be dropped."""
    with pytest.raises(pydantic_core.PydanticSerializationError):
        pydantic_core.to_json({"ds": pd.NaT}, fallback=str)


def test_sanitised_rows_serialize() -> None:
    rows = [
        {"ds": pd.Timestamp("2026-01-01"), "v": 1},
        {"ds": pd.NaT, "v": float("nan")},
    ]
    safe = _json_safe_rows(rows)
    assert safe[1]["ds"] is None
    # Bare NaN serializes to the literal `NaN`, which is not valid JSON.
    assert safe[1]["v"] is None
    out = pydantic_core.to_json(safe, fallback=str).decode()
    assert "NaN" not in out
    # Real values are untouched.
    assert safe[0]["v"] == 1


def test_empty_rows_pass_through() -> None:
    assert _json_safe_rows([]) == []
