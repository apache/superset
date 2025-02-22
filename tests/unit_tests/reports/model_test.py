

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
                    "filterValues": ["value1", "value2"],
                }
            ]
        }
    }

    assert report_schedule.get_native_filters_params() == (
        '(filter_id:(extraFormData:(filters:!((col:column_name,op:IN,val:!(value1,value2)))),filterState:(label:column_name,validateStatus:!f,value:!(value1,value2)),id:filter_id,ownState:()))'
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
                    "columnName": "column_name_1",
                    "filterValues": ["value1", "value2"],
                },
                {
                    "nativeFilterId": "filter_id_2",
                    "columnName": "column_name_2",
                    "filterValues": ["value3", "value4"],
                }
            ]
        }
    }

    assert report_schedule.get_native_filters_params() == (
        '(filter_id_1:(extraFormData:(filters:!((col:column_name_1,op:IN,val:!(value1,value2)))),filterState:(label:column_name_1,validateStatus:!f,value:!(value1,value2)),id:filter_id_1,ownState:()),filter_id_2:(extraFormData:(filters:!((col:column_name_2,op:IN,val:!(value3,value4)))),filterState:(label:column_name_2,validateStatus:!f,value:!(value3,value4)),id:filter_id_2,ownState:()))'
    )

def test_report_generate_native_filter_no_values():
    """
    Test the ``_generate_native_filter`` method with no values.
    """
    report_schedule = ReportSchedule()
    native_filter_id = "filter_id"
    column_name = "column_name"
    values = None

    assert report_schedule._generate_native_filter(
        native_filter_id, column_name, values
    ) == {'filter_id': {'id': 'filter_id', 'extraFormData': {'filters': [{'col': 'column_name', 'op': 'IN', 'val': None}]}, 'filterState': {'label': 'column_name', 'validateStatus': False, 'value': None}, 'ownState': {}}}

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
                    # Missing "filterValues" key
                }
            ]
        }
    }
    
    assert report_schedule.get_native_filters_params() == '(filter_id:(extraFormData:(filters:!((col:column_name,op:IN,val:!n))),filterState:(label:column_name,validateStatus:!f,value:!n),id:filter_id,ownState:()))'

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
    column_name = "column_name"
    values = ["value1", "value2"]

    print(report_schedule._generate_native_filter(native_filter_id, column_name, values))
    assert report_schedule._generate_native_filter(
        native_filter_id, column_name, values
    ) == {
        "filter_id": {
            "extraFormData": {
                "filters": [{"col": "column_name", "op": "IN", "val": ["value1", "value2"]}]
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

    assert report_schedule.get_native_filters_params() == '()'

def test_get_native_filters_params_no_native_filters():
    """
    Test the ``get_native_filters_params`` method with no native filters.
    """
    report_schedule = ReportSchedule()
    report_schedule.extra = {
        "dashboard": {
            "nativeFilters": []
        }
    }

    assert report_schedule.get_native_filters_params() == '()'

def test_report_generate_native_filter_empty_values():
    """
    Test the ``_generate_native_filter`` method with empty values.
    """
    report_schedule = ReportSchedule()
    native_filter_id = "filter_id"
    column_name = "column_name"
    values = []

    assert report_schedule._generate_native_filter(
        native_filter_id, column_name, values
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
    column_name = ""
    values = ["value1", "value2"]

    assert report_schedule._generate_native_filter(
        native_filter_id, column_name, values
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