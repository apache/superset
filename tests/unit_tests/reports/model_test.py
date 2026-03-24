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
