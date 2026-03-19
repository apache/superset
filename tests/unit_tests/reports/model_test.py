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
import pytest

from superset.reports.models import ReportSchedule


def test_get_native_filters_params():
    """
    Test the ``get_native_filters_params`` method.
    """
    report_schedule = ReportSchedule()
    report_schedule.extra = {
        "dashboard": {
            "nativeFilters": [
                {
                    "nativeFilterId": "filter_id",
                    "columnName": "column_name",
                    "filterType": "filter_select",
                    "filterValues": ["value1", "value2"],
                }
            ]
        }
    }

    assert report_schedule.get_native_filters_params() == (
        "(filter_id:(extraFormData:(filters:!((col:column_name,op:IN,val:!(value1,value2)))),filterState:(label:column_name,validateStatus:!f,value:!(value1,value2)),id:filter_id,ownState:()))"
    )


def test_get_native_filters_params_multiple_filters():
    """
    Test the ``get_native_filters_params`` method with multiple native filters.
    """
    report_schedule = ReportSchedule()
    report_schedule.extra = {
        "dashboard": {
            "nativeFilters": [
                {
                    "nativeFilterId": "filter_id_1",
                    "filterType": "filter_select",
                    "columnName": "column_name_1",
                    "filterValues": ["value1", "value2"],
                },
                {
                    "nativeFilterId": "filter_id_2",
                    "filterType": "filter_select",
                    "columnName": "column_name_2",
                    "filterValues": ["value3", "value4"],
                },
            ]
        }
    }

    assert report_schedule.get_native_filters_params() == (
        "(filter_id_1:(extraFormData:(filters:!((col:column_name_1,op:IN,val:!(value1,value2)))),filterState:(label:column_name_1,validateStatus:!f,value:!(value1,value2)),id:filter_id_1,ownState:()),filter_id_2:(extraFormData:(filters:!((col:column_name_2,op:IN,val:!(value3,value4)))),filterState:(label:column_name_2,validateStatus:!f,value:!(value3,value4)),id:filter_id_2,ownState:()))"
    )


def test_report_generate_native_filter_no_values():
    """
    Test the ``_generate_native_filter`` method with no values.
    """
    report_schedule = ReportSchedule()
    native_filter_id = "filter_id"
    column_name = "column_name"
    filter_type = "filter_select"
    values = None

    assert report_schedule._generate_native_filter(
        native_filter_id, filter_type, column_name, values
    ) == {
        "filter_id": {
            "id": "filter_id",
            "extraFormData": {
                "filters": [{"col": "column_name", "op": "IN", "val": []}]
            },
            "filterState": {
                "label": "column_name",
                "validateStatus": False,
                "value": [],
            },
            "ownState": {},
        }
    }


def test_get_native_filters_params_invalid_structure():
    """
    Test the ``get_native_filters_params`` method with invalid structure.
    """
    report_schedule = ReportSchedule()
    report_schedule.extra = {
        "dashboard": {
            "nativeFilters": [
                {
                    "nativeFilterId": "filter_id",
                    "columnName": "column_name",
                    "filterType": "filter_select",
                    # Missing "filterValues" key
                }
            ]
        }
    }

    with pytest.raises(KeyError, match="'filterValues'"):
        report_schedule.get_native_filters_params()


# todo(hugh): how do we want to handle this case?
# def test_report_generate_native_filter_invalid_filter_id():
#     """
#     Test the ``_generate_native_filter`` method with invalid filter id.
#     """
#     report_schedule = ReportSchedule()
#     native_filter_id = None
#     column_name = "column_name"
#     values = ["value1", "value2"]

#     assert report_schedule._generate_native_filter(
#         native_filter_id, column_name, values
#     ) == {}


def test_report_generate_native_filter():
    """
    Test the ``_generate_native_filter`` method.
    """
    report_schedule = ReportSchedule()
    native_filter_id = "filter_id"
    filter_type = "filter_select"
    column_name = "column_name"
    values = ["value1", "value2"]

    assert report_schedule._generate_native_filter(
        native_filter_id, filter_type, column_name, values
    ) == {
        "filter_id": {
            "extraFormData": {
                "filters": [
                    {"col": "column_name", "op": "IN", "val": ["value1", "value2"]}
                ]
            },
            "filterState": {
                "label": "column_name",
                "validateStatus": False,
                "value": ["value1", "value2"],
            },
            "id": "filter_id",
            "ownState": {},
        }
    }


def test_get_native_filters_params_empty():
    """
    Test the ``get_native_filters_params`` method with empty extra.
    """
    report_schedule = ReportSchedule()
    report_schedule.extra = {}

    assert report_schedule.get_native_filters_params() == "()"


def test_get_native_filters_params_no_native_filters():
    """
    Test the ``get_native_filters_params`` method with no native filters.
    """
    report_schedule = ReportSchedule()
    report_schedule.extra = {"dashboard": {"nativeFilters": []}}

    assert report_schedule.get_native_filters_params() == "()"


def test_report_generate_native_filter_empty_values():
    """
    Test the ``_generate_native_filter`` method with empty values.
    """
    report_schedule = ReportSchedule()
    native_filter_id = "filter_id"
    filter_type = "filter_select"
    column_name = "column_name"
    values = []

    assert report_schedule._generate_native_filter(
        native_filter_id, filter_type, column_name, values
    ) == {
        "filter_id": {
            "extraFormData": {
                "filters": [{"col": "column_name", "op": "IN", "val": []}]
            },
            "filterState": {
                "label": "column_name",
                "validateStatus": False,
                "value": [],
            },
            "id": "filter_id",
            "ownState": {},
        }
    }


def test_report_generate_native_filter_no_column_name():
    """
    Test the ``_generate_native_filter`` method with no column name.
    """
    report_schedule = ReportSchedule()
    native_filter_id = "filter_id"
    filter_type = "filter_select"
    column_name = ""
    values = ["value1", "value2"]

    assert report_schedule._generate_native_filter(
        native_filter_id, filter_type, column_name, values
    ) == {
        "filter_id": {
            "extraFormData": {
                "filters": [{"col": "", "op": "IN", "val": ["value1", "value2"]}]
            },
            "filterState": {
                "label": "",
                "validateStatus": False,
                "value": ["value1", "value2"],
            },
            "id": "filter_id",
            "ownState": {},
        }
    }


def test_report_generate_native_filter_select_null_column():
    report_schedule = ReportSchedule()
    result = report_schedule._generate_native_filter(
        "F1", "filter_select", None, ["US"]
    )
    assert result["F1"]["extraFormData"]["filters"][0]["col"] == ""
    assert result["F1"]["filterState"]["label"] == ""


def test_generate_native_filter_time_normal():
    report_schedule = ReportSchedule()
    result = report_schedule._generate_native_filter(
        "F2", "filter_time", "ignored", ["Last week"]
    )
    assert result == {
        "F2": {
            "id": "F2",
            "extraFormData": {"time_range": "Last week"},
            "filterState": {"value": "Last week"},
            "ownState": {},
        }
    }


def test_generate_native_filter_time_empty_values():
    report_schedule = ReportSchedule()
    result = report_schedule._generate_native_filter("F2", "filter_time", "ignored", [])
    assert result == {}


def test_generate_native_filter_timegrain_normal():
    report_schedule = ReportSchedule()
    result = report_schedule._generate_native_filter(
        "F3", "filter_timegrain", "ignored", ["P1D"]
    )
    assert result == {
        "F3": {
            "id": "F3",
            "extraFormData": {"time_grain_sqla": "P1D"},
            "filterState": {"value": ["P1D"]},
            "ownState": {},
        }
    }


def test_generate_native_filter_timecolumn_normal():
    """filter_timecolumn is the only branch missing 'id' in its output."""
    report_schedule = ReportSchedule()
    result = report_schedule._generate_native_filter(
        "F4", "filter_timecolumn", "ignored", ["ds"]
    )
    assert result == {
        "F4": {
            "extraFormData": {"granularity_sqla": "ds"},
            "filterState": {"value": ["ds"]},
        }
    }
    assert "id" not in result["F4"]


def test_generate_native_filter_range_normal():
    report_schedule = ReportSchedule()
    result = report_schedule._generate_native_filter(
        "F5", "filter_range", "price", [10, 100]
    )
    assert result == {
        "F5": {
            "id": "F5",
            "extraFormData": {
                "filters": [
                    {"col": "price", "op": ">=", "val": 10},
                    {"col": "price", "op": "<=", "val": 100},
                ]
            },
            "filterState": {
                "value": [10, 100],
                "label": "10 ≤ x ≤ 100",
            },
            "ownState": {},
        }
    }


def test_generate_native_filter_range_min_only():
    report_schedule = ReportSchedule()
    result = report_schedule._generate_native_filter(
        "F5", "filter_range", "price", [10]
    )
    assert result["F5"]["extraFormData"]["filters"] == [
        {"col": "price", "op": ">=", "val": 10}
    ]
    assert result["F5"]["filterState"]["label"] == "x ≥ 10"
    assert result["F5"]["filterState"]["value"] == [10, None]


def test_generate_native_filter_range_max_only():
    report_schedule = ReportSchedule()
    result = report_schedule._generate_native_filter(
        "F5", "filter_range", "price", [None, 100]
    )
    assert result["F5"]["extraFormData"]["filters"] == [
        {"col": "price", "op": "<=", "val": 100}
    ]
    assert result["F5"]["filterState"]["label"] == "x ≤ 100"


def test_generate_native_filter_range_empty_values():
    report_schedule = ReportSchedule()
    result = report_schedule._generate_native_filter("F5", "filter_range", "price", [])
    assert result["F5"]["extraFormData"]["filters"] == []
    assert result["F5"]["filterState"]["label"] == ""
    assert result["F5"]["filterState"]["value"] == [None, None]


def test_generate_native_filter_unknown_type():
    report_schedule = ReportSchedule()
    result = report_schedule._generate_native_filter("F6", "unknown_type", "col", ["x"])
    assert result == {}


def test_get_native_filters_params_null_native_filters():
    report_schedule = ReportSchedule()
    report_schedule.extra = {"dashboard": {"nativeFilters": None}}
    assert report_schedule.get_native_filters_params() == "()"


def test_get_native_filters_params_rison_quote_escaping():
    report_schedule = ReportSchedule()
    report_schedule.extra = {
        "dashboard": {
            "nativeFilters": [
                {
                    "nativeFilterId": "F1",
                    "filterType": "filter_select",
                    "columnName": "name",
                    "filterValues": ["O'Brien"],
                }
            ]
        }
    }
    result = report_schedule.get_native_filters_params()
    assert "'" not in result
    assert "%27" in result


def test_get_native_filters_params_missing_filter_id_key():
    report_schedule = ReportSchedule()
    report_schedule.extra = {
        "dashboard": {
            "nativeFilters": [
                {
                    "filterType": "filter_select",
                    "columnName": "col",
                    "filterValues": ["v"],
                    # Missing "nativeFilterId" key — skipped by defensive guard
                }
            ]
        }
    }
    result = report_schedule.get_native_filters_params()
    assert result == "()"


def test_generate_native_filter_empty_filter_id():
    """Empty native_filter_id triggers the ``or ""`` fallback branches."""
    report_schedule = ReportSchedule()
    result = report_schedule._generate_native_filter("", "filter_select", "col", ["x"])
    assert "" in result
    assert result[""]["id"] == ""


@pytest.mark.xfail(
    reason="BUG: models.py:296-302 uses truthiness (`if min_val and max_val`) "
    "instead of `is not None`, so zero is treated as missing",
    strict=True,
)
def test_generate_native_filter_range_zero_min():
    """Zero min_val should produce a two-sided label, not a max-only label."""
    report_schedule = ReportSchedule()
    result = report_schedule._generate_native_filter(
        "F5", "filter_range", "price", [0, 100]
    )
    # Filters use `is not None` (lines 285-288) so they are correct
    assert result["F5"]["extraFormData"]["filters"] == [
        {"col": "price", "op": ">=", "val": 0},
        {"col": "price", "op": "<=", "val": 100},
    ]
    # Label uses truthiness (lines 296-302) so this assertion documents the bug
    assert result["F5"]["filterState"]["label"] == "0 ≤ x ≤ 100"


@pytest.mark.xfail(
    reason="BUG: models.py:296-302 uses truthiness (`if min_val and max_val`) "
    "instead of `is not None`, so zero is treated as missing",
    strict=True,
)
def test_generate_native_filter_range_zero_max():
    """Zero max_val should produce a two-sided label, not a min-only label."""
    report_schedule = ReportSchedule()
    result = report_schedule._generate_native_filter(
        "F5", "filter_range", "price", [10, 0]
    )
    assert result["F5"]["extraFormData"]["filters"] == [
        {"col": "price", "op": ">=", "val": 10},
        {"col": "price", "op": "<=", "val": 0},
    ]
    assert result["F5"]["filterState"]["label"] == "10 ≤ x ≤ 0"


@pytest.mark.xfail(
    reason="BUG: models.py:296-302 uses truthiness (`if min_val and max_val`) "
    "instead of `is not None`, so zero is treated as missing",
    strict=True,
)
def test_generate_native_filter_range_both_zero():
    """Both values zero should produce a two-sided label, not an empty string."""
    report_schedule = ReportSchedule()
    result = report_schedule._generate_native_filter(
        "F5", "filter_range", "price", [0, 0]
    )
    assert result["F5"]["extraFormData"]["filters"] == [
        {"col": "price", "op": ">=", "val": 0},
        {"col": "price", "op": "<=", "val": 0},
    ]
    assert result["F5"]["filterState"]["label"] == "0 ≤ x ≤ 0"


def test_generate_native_filter_timegrain_empty_values():
    """Empty values for filter_timegrain should return empty dict (line 219 guard)."""
    report_schedule = ReportSchedule()
    result = report_schedule._generate_native_filter(
        "F3", "filter_timegrain", "ignored", []
    )
    assert result == {}


def test_generate_native_filter_timecolumn_empty_values():
    """Empty values for filter_timecolumn should return empty dict (line 219 guard)."""
    report_schedule = ReportSchedule()
    result = report_schedule._generate_native_filter(
        "F4", "filter_timecolumn", "ignored", []
    )
    assert result == {}


def test_get_native_filters_params_missing_filter_type():
    """Missing filterType key causes KeyError at line 202."""
    report_schedule = ReportSchedule()
    report_schedule.extra = {
        "dashboard": {
            "nativeFilters": [
                {
                    "nativeFilterId": "F1",
                    "columnName": "col",
                    "filterValues": ["v"],
                }
            ]
        }
    }
    with pytest.raises(KeyError, match="filterType"):
        report_schedule.get_native_filters_params()


def test_get_native_filters_params_missing_column_name():
    """Missing columnName key causes KeyError at line 203."""
    report_schedule = ReportSchedule()
    report_schedule.extra = {
        "dashboard": {
            "nativeFilters": [
                {
                    "nativeFilterId": "F1",
                    "filterType": "filter_select",
                    "filterValues": ["v"],
                }
            ]
        }
    }
    with pytest.raises(KeyError, match="columnName"):
        report_schedule.get_native_filters_params()


def test_generate_native_filter_range_null_column():
    """Range filter with None column_name falls back to empty string."""
    report_schedule = ReportSchedule()
    result = report_schedule._generate_native_filter(
        "F5", "filter_range", None, [10, 100]
    )
    assert result["F5"]["extraFormData"]["filters"][0]["col"] == ""
    assert result["F5"]["extraFormData"]["filters"][1]["col"] == ""


def test_generate_native_filter_time_empty_id():
    """Empty string filter ID for filter_time uses the ``or ""`` fallback."""
    report_schedule = ReportSchedule()
    result = report_schedule._generate_native_filter(
        "", "filter_time", "ignored", ["Last week"]
    )
    assert "" in result
    assert result[""]["id"] == ""
