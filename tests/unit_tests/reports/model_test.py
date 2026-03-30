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


def test_report_generate_native_filter_time_empty_values():
    """
    Test filter_time with empty values returns empty dict and warning.
    """
    report_schedule = ReportSchedule()
    result, warning = report_schedule._generate_native_filter(
        "filter_id", "filter_time", "column_name", []
    )
    assert result == {}
    assert warning is not None
    assert "filter_time" in warning
    assert "empty filterValues" in warning
    assert "filter_id" in warning


def test_report_generate_native_filter_timegrain_empty_values():
    """
    Test filter_timegrain with empty values returns empty dict and warning.
    """
    report_schedule = ReportSchedule()
    result, warning = report_schedule._generate_native_filter(
        "filter_id", "filter_timegrain", "column_name", []
    )
    assert result == {}
    assert warning is not None
    assert "filter_timegrain" in warning
    assert "empty filterValues" in warning
    assert "filter_id" in warning


def test_report_generate_native_filter_timecolumn_empty_values():
    """
    Test filter_timecolumn with empty values returns empty dict and warning.
    """
    report_schedule = ReportSchedule()
    result, warning = report_schedule._generate_native_filter(
        "filter_id", "filter_timecolumn", "column_name", []
    )
    assert result == {}
    assert warning is not None
    assert "filter_timecolumn" in warning
    assert "empty filterValues" in warning
    assert "filter_id" in warning


def test_report_generate_native_filter_range_empty_values():
    """
    Test filter_range with empty values handles gracefully.
    Returns filter with None values for min/max.
    """
    report_schedule = ReportSchedule()
    result, warning = report_schedule._generate_native_filter(
        "filter_id", "filter_range", "column_name", []
    )
    assert result == {
        "filter_id": {
            "id": "filter_id",
            "extraFormData": {"filters": []},
            "filterState": {
                "value": [None, None],
                "label": "",
            },
            "ownState": {},
        }
    }
    assert warning is None


def test_report_generate_native_filter_range_none_values():
    """
    Test filter_range with None values handles gracefully without TypeError.
    Previously this would fail with: TypeError: object of type 'NoneType' has no len()
    """
    report_schedule = ReportSchedule()
    result, warning = report_schedule._generate_native_filter(
        "filter_id", "filter_range", "column_name", None
    )
    assert result == {
        "filter_id": {
            "id": "filter_id",
            "extraFormData": {"filters": []},
            "filterState": {
                "value": [None, None],
                "label": "",
            },
            "ownState": {},
        }
    }
    assert warning is None


def test_get_native_filters_params_time_filters_empty_values():
    """
    Test get_native_filters_params with time filters having empty values.
    Should skip those filters and include warnings.
    """
    report_schedule = ReportSchedule()
    report_schedule.extra = {
        "dashboard": {
            "nativeFilters": [
                {
                    "nativeFilterId": "time_filter",
                    "filterType": "filter_time",
                    "columnName": "time_col",
                    "filterValues": [],  # Empty values
                },
                {
                    "nativeFilterId": "timegrain_filter",
                    "filterType": "filter_timegrain",
                    "columnName": "grain_col",
                    "filterValues": None,  # None values (coerced to [])
                },
                {
                    "nativeFilterId": "select_filter",
                    "filterType": "filter_select",
                    "columnName": "select_col",
                    "filterValues": ["value1"],  # Valid filter
                },
            ]
        }
    }

    result, warnings = report_schedule.get_native_filters_params()
    # The time filters should be skipped, select filter should be present
    assert "select_filter" in result
    assert "time_filter" not in result
    assert "timegrain_filter" not in result
    assert "value1" in result
    # Should have two warnings for the empty time filters
    assert len(warnings) == 2
    assert any("filter_time" in w for w in warnings)
    assert any("filter_timegrain" in w for w in warnings)
