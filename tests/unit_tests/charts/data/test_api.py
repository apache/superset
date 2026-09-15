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
"""Unit tests for the chart data API sort-parameter validator.

The autouse ``app_context`` fixture in
``tests/unit_tests/conftest.py`` supplies the Flask application context that
``flask.jsonify`` / ``flask.make_response`` require.
"""

from superset.charts.data.api import validate_sort_params


def test_validate_sort_params_no_orderby() -> None:
    # Empty orderby passes (returns None)
    assert validate_sort_params([]) is None


def test_validate_sort_params_valid() -> None:
    # Single entry with a bool direction passes
    assert validate_sort_params([("a", True)]) is None


def test_validate_sort_params_multi_column() -> None:
    # Multiple columns with bool directions pass
    assert validate_sort_params([("a", True), ("b", False)]) is None


def test_validate_sort_params_invalid_direction() -> None:
    # Non-boolean direction -> 400
    resp = validate_sort_params([("a", "asc")])
    assert resp is not None
    assert resp.status_code == 400
    assert resp.json["errors"][0]["error_type"] == "SORT_DIRECTION_INVALID"


def test_validate_sort_params_multi_column_validates_each_entry() -> None:
    # Every entry is validated; a bad direction anywhere in the list -> 400
    resp = validate_sort_params([("a", True), ("b", "desc")])
    assert resp is not None
    assert resp.status_code == 400
    assert resp.json["errors"][0]["error_type"] == "SORT_DIRECTION_INVALID"
    assert resp.json["errors"][0]["extra"]["column"] == "b"
