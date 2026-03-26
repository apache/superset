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

    result, warnings = report_schedule.get_native_filters_params()
    expected = (
        "(filter_id:(extraFormData:(filters:!((col:column_name,op:IN,"
        "val:!(value1,value2)))),filterState:(label:column_name,"
        "validateStatus:!f,value:!(value1,value2)),id:filter_id,ownState:()))"
    )
    assert result == expected
    assert warnings == []


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

    result, warnings = report_schedule.get_native_filters_params()
    expected = (
        "(filter_id_1:(extraFormData:(filters:!((col:column_name_1,op:IN,"
        "val:!(value1,value2)))),filterState:(label:column_name_1,"
        "validateStatus:!f,value:!(value1,value2)),id:filter_id_1,ownState:()),"
        "filter_id_2:(extraFormData:(filters:!((col:column_name_2,op:IN,"
        "val:!(value3,value4)))),filterState:(label:column_name_2,"
        "validateStatus:!f,value:!(value3,value4)),id:filter_id_2,ownState:()))"
    )
    assert result == expected
    assert warnings == []


def test_report_generate_native_filter_no_values():
    """
    Test the ``_generate_native_filter`` method with no values.
    """
    report_schedule = ReportSchedule()
    native_filter_id = "filter_id"
    column_name = "column_name"
    filter_type = "filter_select"
    values = None

    result, warning = report_schedule._generate_native_filter(
        native_filter_id, filter_type, column_name, values
    )
    assert result == {
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
    assert warning is None


def test_get_native_filters_params_missing_filter_values():
    """
    Test the ``get_native_filters_params`` method with missing filterValues.
    Should handle gracefully by using empty list as default.
    """
    report_schedule = ReportSchedule()
    report_schedule.extra = {
        "dashboard": {
            "nativeFilters": [
                {
                    "nativeFilterId": "filter_id",
                    "columnName": "column_name",
                    "filterType": "filter_select",
                    # Missing "filterValues" key - should default to []
                }
            ]
        }
    }

    # Should not raise, should handle gracefully with empty filterValues
    result, warnings = report_schedule.get_native_filters_params()
    assert "filter_id" in result
    assert "column_name" in result
    assert warnings == []


def test_get_native_filters_params_explicit_none_values():
    """
    Test the ``get_native_filters_params`` method with explicit None values.
    Should handle gracefully by coercing None to empty string/list.
    """
    report_schedule = ReportSchedule()
    report_schedule.extra = {
        "dashboard": {
            "nativeFilters": [
                {
                    "nativeFilterId": "filter_id",
                    "columnName": None,  # Explicit None
                    "filterType": "filter_select",
                    "filterValues": None,  # Explicit None
                }
            ]
        }
    }

    # Should not raise TypeError, should handle gracefully
    result, warnings = report_schedule.get_native_filters_params()
    assert "filter_id" in result
    assert warnings == []


def test_get_native_filters_params_missing_required_fields():
    """
    Test the ``get_native_filters_params`` method with missing required fields.
    Filters missing nativeFilterId or filterType should be skipped.
    """
    report_schedule = ReportSchedule()
    report_schedule.extra = {
        "dashboard": {
            "nativeFilters": [
                {
                    # Missing nativeFilterId - should be skipped
                    "filterType": "filter_select",
                    "columnName": "column_name",
                    "filterValues": ["value1"],
                },
                {
                    # Missing filterType - should be skipped
                    "nativeFilterId": "filter_2",
                    "columnName": "column_name",
                    "filterValues": ["value2"],
                },
                {
                    # Valid filter - should be processed
                    "nativeFilterId": "filter_3",
                    "filterType": "filter_select",
                    "columnName": "column_name",
                    "filterValues": ["value3"],
                },
            ]
        }
    }

    result, warnings = report_schedule.get_native_filters_params()
    # Only the valid filter should be in the result
    assert "filter_3" in result
    assert "filter_2" not in result
    assert "value1" not in result
    assert "value3" in result
    # Two malformed filters should generate two warnings
    assert len(warnings) == 2
    assert all("Skipping malformed native filter" in w for w in warnings)


def test_report_generate_native_filter():
    """
    Test the ``_generate_native_filter`` method.
    """
    report_schedule = ReportSchedule()
    native_filter_id = "filter_id"
    filter_type = "filter_select"
    column_name = "column_name"
    values = ["value1", "value2"]

    result, warning = report_schedule._generate_native_filter(
        native_filter_id, filter_type, column_name, values
    )
    assert result == {
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
    assert warning is None


def test_get_native_filters_params_empty():
    """
    Test the ``get_native_filters_params`` method with empty extra.
    """
    report_schedule = ReportSchedule()
    report_schedule.extra = {}

    result, warnings = report_schedule.get_native_filters_params()
    assert result == "()"
    assert warnings == []


def test_get_native_filters_params_no_native_filters():
    """
    Test the ``get_native_filters_params`` method with no native filters.
    """
    report_schedule = ReportSchedule()
    report_schedule.extra = {"dashboard": {"nativeFilters": []}}

    result, warnings = report_schedule.get_native_filters_params()
    assert result == "()"
    assert warnings == []


def test_report_generate_native_filter_empty_values():
    """
    Test the ``_generate_native_filter`` method with empty values.
    """
    report_schedule = ReportSchedule()
    native_filter_id = "filter_id"
    filter_type = "filter_select"
    column_name = "column_name"
    values = []

    result, warning = report_schedule._generate_native_filter(
        native_filter_id, filter_type, column_name, values
    )
    assert result == {
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
    assert warning is None


def test_report_generate_native_filter_no_column_name():
    """
    Test the ``_generate_native_filter`` method with no column name.
    """
    report_schedule = ReportSchedule()
    native_filter_id = "filter_id"
    filter_type = "filter_select"
    column_name = ""
    values = ["value1", "value2"]

    result, warning = report_schedule._generate_native_filter(
        native_filter_id, filter_type, column_name, values
    )
    assert result == {
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
    assert warning is None


def test_report_generate_native_filter_select_null_column():
    report_schedule = ReportSchedule()
    result, warning = report_schedule._generate_native_filter(
        "F1", "filter_select", None, ["US"]
    )
    assert result["F1"]["extraFormData"]["filters"][0]["col"] == ""
    assert result["F1"]["filterState"]["label"] == ""
    assert warning is None


def test_generate_native_filter_time_normal():
    report_schedule = ReportSchedule()
    result, warning = report_schedule._generate_native_filter(
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
    assert warning is None


def test_generate_native_filter_timegrain_normal():
    report_schedule = ReportSchedule()
    result, warning = report_schedule._generate_native_filter(
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
    assert warning is None


def test_generate_native_filter_timecolumn_normal():
    """filter_timecolumn is the only branch missing 'id' in its output."""
    report_schedule = ReportSchedule()
    result, warning = report_schedule._generate_native_filter(
        "F4", "filter_timecolumn", "ignored", ["ds"]
    )
    assert result == {
        "F4": {
            "extraFormData": {"granularity_sqla": "ds"},
            "filterState": {"value": ["ds"]},
        }
    }
    assert "id" not in result["F4"]
    assert warning is None


def test_generate_native_filter_range_normal():
    report_schedule = ReportSchedule()
    result, warning = report_schedule._generate_native_filter(
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
    assert warning is None


def test_generate_native_filter_range_min_only():
    report_schedule = ReportSchedule()
    result, warning = report_schedule._generate_native_filter(
        "F5", "filter_range", "price", [10]
    )
    assert result["F5"]["extraFormData"]["filters"] == [
        {"col": "price", "op": ">=", "val": 10}
    ]
    assert result["F5"]["filterState"]["label"] == "x ≥ 10"
    assert result["F5"]["filterState"]["value"] == [10, None]
    assert warning is None


def test_generate_native_filter_range_max_only():
    report_schedule = ReportSchedule()
    result, warning = report_schedule._generate_native_filter(
        "F5", "filter_range", "price", [None, 100]
    )
    assert result["F5"]["extraFormData"]["filters"] == [
        {"col": "price", "op": "<=", "val": 100}
    ]
    assert result["F5"]["filterState"]["label"] == "x ≤ 100"
    assert warning is None


def test_generate_native_filter_range_empty_values():
    report_schedule = ReportSchedule()
    result, warning = report_schedule._generate_native_filter(
        "F5", "filter_range", "price", []
    )
    assert result["F5"]["extraFormData"]["filters"] == []
    assert result["F5"]["filterState"]["label"] == ""
    assert result["F5"]["filterState"]["value"] == [None, None]
    assert warning is None


def test_report_generate_native_filter_unknown_filter_type():
    """
    Test the ``_generate_native_filter`` method with an unknown filter type.
    Should return empty dict and a warning message.
    """
    report_schedule = ReportSchedule()
    native_filter_id = "filter_id"
    filter_type = "filter_unknown"
    column_name = "column_name"
    values = ["value1", "value2"]

    result, warning = report_schedule._generate_native_filter(
        native_filter_id, filter_type, column_name, values
    )
    assert result == {}
    assert warning is not None
    assert "unrecognized filter type" in warning
    assert "filter_unknown" in warning
    assert "filter_id" in warning


def test_get_native_filters_params_null_native_filters():
    report_schedule = ReportSchedule()
    report_schedule.extra = {"dashboard": {"nativeFilters": None}}
    result, warnings = report_schedule.get_native_filters_params()
    assert result == "()"
    assert warnings == []


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
    result, warnings = report_schedule.get_native_filters_params()
    assert "'" not in result
    assert "%27" in result
    assert warnings == []


def test_get_native_filters_params_unknown_filter_type():
    """
    Test the ``get_native_filters_params`` method with an unknown filter type.
    Should skip the filter and include a warning.
    """
    report_schedule = ReportSchedule()
    report_schedule.extra = {
        "dashboard": {
            "nativeFilters": [
                {
                    "nativeFilterId": "filter_1",
                    "filterType": "filter_unknown_type",
                    "columnName": "column_name",
                    "filterValues": ["value1"],
                },
                {
                    "nativeFilterId": "filter_2",
                    "filterType": "filter_select",
                    "columnName": "column_name",
                    "filterValues": ["value2"],
                },
            ]
        }
    }

    result, warnings = report_schedule.get_native_filters_params()
    # The unknown filter should be skipped, valid filter should be present
    assert "filter_2" in result
    assert "filter_1" not in result
    assert "value2" in result
    # Should have one warning for the unknown filter type
    assert len(warnings) == 1
    assert "unrecognized filter type" in warnings[0]
    assert "filter_unknown_type" in warnings[0]


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
    result, warnings = report_schedule.get_native_filters_params()
    assert result == "()"
    assert len(warnings) == 1
    assert "Skipping malformed native filter" in warnings[0]


def test_generate_native_filter_empty_filter_id():
    """Empty native_filter_id triggers the ``or ""`` fallback branches."""
    report_schedule = ReportSchedule()
    result, warning = report_schedule._generate_native_filter(
        "", "filter_select", "col", ["x"]
    )
    assert "" in result
    assert result[""]["id"] == ""
    assert warning is None


@pytest.mark.xfail(
    reason="BUG: models.py uses truthiness (`if min_val and max_val`) "
    "instead of `is not None`, so zero is treated as missing",
    strict=True,
)
def test_generate_native_filter_range_zero_min():
    """Zero min_val should produce a two-sided label, not a max-only label."""
    report_schedule = ReportSchedule()
    result, warning = report_schedule._generate_native_filter(
        "F5", "filter_range", "price", [0, 100]
    )
    # Filters use `is not None` so they are correct
    assert result["F5"]["extraFormData"]["filters"] == [
        {"col": "price", "op": ">=", "val": 0},
        {"col": "price", "op": "<=", "val": 100},
    ]
    # Label uses truthiness so this assertion documents the bug
    assert result["F5"]["filterState"]["label"] == "0 ≤ x ≤ 100"


@pytest.mark.xfail(
    reason="BUG: models.py uses truthiness (`if min_val and max_val`) "
    "instead of `is not None`, so zero is treated as missing",
    strict=True,
)
def test_generate_native_filter_range_zero_max():
    """Zero max_val should produce a two-sided label, not a min-only label."""
    report_schedule = ReportSchedule()
    result, warning = report_schedule._generate_native_filter(
        "F5", "filter_range", "price", [10, 0]
    )
    assert result["F5"]["extraFormData"]["filters"] == [
        {"col": "price", "op": ">=", "val": 10},
        {"col": "price", "op": "<=", "val": 0},
    ]
    assert result["F5"]["filterState"]["label"] == "10 ≤ x ≤ 0"


@pytest.mark.xfail(
    reason="BUG: models.py uses truthiness (`if min_val and max_val`) "
    "instead of `is not None`, so zero is treated as missing",
    strict=True,
)
def test_generate_native_filter_range_both_zero():
    """Both values zero should produce a two-sided label, not an empty string."""
    report_schedule = ReportSchedule()
    result, warning = report_schedule._generate_native_filter(
        "F5", "filter_range", "price", [0, 0]
    )
    assert result["F5"]["extraFormData"]["filters"] == [
        {"col": "price", "op": ">=", "val": 0},
        {"col": "price", "op": "<=", "val": 0},
    ]
    assert result["F5"]["filterState"]["label"] == "0 ≤ x ≤ 0"


def test_get_native_filters_params_missing_filter_type():
    """Missing filterType skips the filter and emits a warning."""
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
    result, warnings = report_schedule.get_native_filters_params()
    assert result == "()"
    assert len(warnings) == 1
    assert "Skipping malformed native filter" in warnings[0]


def test_get_native_filters_params_missing_column_name():
    """Missing columnName defaults to empty string via .get() fallback."""
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
    result, warnings = report_schedule.get_native_filters_params()
    assert "F1" in result
    assert warnings == []


def test_generate_native_filter_range_null_column():
    """Range filter with None column_name falls back to empty string."""
    report_schedule = ReportSchedule()
    result, warning = report_schedule._generate_native_filter(
        "F5", "filter_range", None, [10, 100]
    )
    assert result["F5"]["extraFormData"]["filters"][0]["col"] == ""
    assert result["F5"]["extraFormData"]["filters"][1]["col"] == ""
    assert warning is None


def test_generate_native_filter_time_empty_id():
    """Empty string filter ID for filter_time uses the ``or ""`` fallback."""
    report_schedule = ReportSchedule()
    result, warning = report_schedule._generate_native_filter(
        "", "filter_time", "ignored", ["Last week"]
    )
    assert "" in result
    assert result[""]["id"] == ""
    assert warning is None
