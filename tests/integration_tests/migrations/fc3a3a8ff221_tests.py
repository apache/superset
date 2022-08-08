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
from copy import deepcopy

from superset.migrations.versions.fc3a3a8ff221_migrate_filter_sets_to_new_format import (
    downgrade_filter_set,
    upgrade_filter_set,
    upgrade_select_filters,
)

native_filters_v1 = [
    {
        "cascadeParentIds": [],
        "controlValues": {
            "enableEmptyFilter": False,
            "inverseSelection": False,
            "multiSelect": True,
            "sortAscending": True,
        },
        "defaultValue": None,
        "filterType": "filter_select",
        "id": "NATIVE_FILTER-CZpnK0rM-",
        "isInstant": True,
        "name": "Region",
        "scope": {"excluded": [], "rootPath": ["ROOT_ID"]},
        "targets": [{"column": {"name": "region"}, "datasetId": 2}],
    },
    {
        "cascadeParentIds": [],
        "defaultValue": "No filter",
        "filterType": "filter_time",
        "id": "NATIVE_FILTER-gCMse9C7e",
        "isInstant": True,
        "name": "Time Range",
        "scope": {"excluded": [], "rootPath": ["ROOT_ID"]},
        "targets": [{}],
    },
    {
        "cascadeParentIds": ["NATIVE_FILTER-CZpnK0rM-"],
        "controlValues": {
            "defaultToFirstItem": False,
            "enableEmptyFilter": False,
            "inverseSelection": False,
            "multiSelect": True,
            "sortAscending": True,
        },
        "defaultValue": None,
        "filterType": "filter_select",
        "id": "NATIVE_FILTER-oQRgQ25Au",
        "isInstant": True,
        "name": "Country",
        "scope": {"excluded": [], "rootPath": ["ROOT_ID"]},
        "targets": [{"column": {"name": "country_name"}, "datasetId": 2}],
    },
]
native_filters_v2 = [
    {
        "cascadeParentIds": [],
        "controlValues": {
            "defaultToFirstItem": False,
            "enableEmptyFilter": False,
            "inverseSelection": False,
            "multiSelect": True,
            "sortAscending": True,
        },
        "defaultValue": None,
        "filterType": "filter_select",
        "id": "NATIVE_FILTER-CZpnK0rM-",
        "isInstant": True,
        "name": "Region",
        "scope": {"excluded": [], "rootPath": ["ROOT_ID"]},
        "targets": [{"column": {"name": "region"}, "datasetId": 2}],
    },
    {
        "cascadeParentIds": [],
        "defaultValue": "No filter",
        "filterType": "filter_time",
        "id": "NATIVE_FILTER-gCMse9C7e",
        "isInstant": True,
        "name": "Time Range",
        "scope": {"excluded": [], "rootPath": ["ROOT_ID"]},
        "targets": [{}],
    },
    {
        "cascadeParentIds": ["NATIVE_FILTER-CZpnK0rM-"],
        "controlValues": {
            "defaultToFirstItem": False,
            "enableEmptyFilter": False,
            "inverseSelection": False,
            "multiSelect": True,
            "sortAscending": True,
        },
        "defaultValue": None,
        "filterType": "filter_select",
        "id": "NATIVE_FILTER-oQRgQ25Au",
        "isInstant": True,
        "name": "Country",
        "scope": {"excluded": [], "rootPath": ["ROOT_ID"]},
        "targets": [{"column": {"name": "country_name"}, "datasetId": 2}],
    },
]

filter_sets_v1 = {
    "name": "New filter set",
    "id": "FILTERS_SET-tt_Ovwy95",
    "nativeFilters": {
        "NATIVE_FILTER-tx05Ze2Hm": {
            "id": "NATIVE_FILTER-tx05Ze2Hm",
            "name": "Time range",
            "filterType": "filter_time",
            "targets": [{}],
            "defaultValue": "No filter",
            "cascadeParentIds": [],
            "scope": {"excluded": [], "rootPath": ["ROOT_ID"]},
            "isInstant": False,
        },
        "NATIVE_FILTER-JeZ9HYoTP": {
            "cascadeParentIds": [],
            "controlValues": {
                "enableEmptyFilter": False,
                "inverseSelection": False,
                "multiSelect": True,
                "sortAscending": True,
            },
            "defaultValue": None,
            "filterType": "filter_select",
            "id": "NATIVE_FILTER-JeZ9HYoTP",
            "isInstant": False,
            "name": "Platform",
            "scope": {"excluded": [], "rootPath": ["ROOT_ID"]},
            "targets": [{"column": {"name": "platform"}, "datasetId": 33}],
        },
        "NATIVE_FILTER-B2PFYVIUw": {
            "cascadeParentIds": [],
            "controlValues": {
                "enableEmptyFilter": False,
                "inverseSelection": False,
                "multiSelect": True,
                "sortAscending": True,
            },
            "defaultValue": None,
            "filterType": "filter_select",
            "id": "NATIVE_FILTER-B2PFYVIUw",
            "isInstant": False,
            "name": "Genre",
            "scope": {"excluded": [], "rootPath": ["ROOT_ID"]},
            "targets": [{"column": {"name": "genre"}, "datasetId": 33}],
        },
        "NATIVE_FILTER-VDLd4Wq-v": {
            "cascadeParentIds": [],
            "controlValues": {
                "enableEmptyFilter": False,
                "inverseSelection": False,
                "multiSelect": True,
                "sortAscending": True,
            },
            "defaultValue": None,
            "filterType": "filter_select",
            "id": "NATIVE_FILTER-VDLd4Wq-v",
            "isInstant": False,
            "name": "Publisher",
            "scope": {"excluded": [], "rootPath": ["ROOT_ID"]},
            "targets": [{"column": {"name": "publisher"}, "datasetId": 33}],
        },
    },
    "dataMask": {
        "nativeFilters": {
            "NATIVE_FILTER-tx05Ze2Hm": {
                "extraFormData": {"override_form_data": {"time_range": "No filter"}},
                "currentState": {"value": "No filter"},
                "id": "NATIVE_FILTER-tx05Ze2Hm",
            },
            "NATIVE_FILTER-B2PFYVIUw": {
                "extraFormData": {
                    "append_form_data": {
                        "filters": [
                            {
                                "col": "genre",
                                "op": "IN",
                                "val": ["Adventure", "Fighting", "Misc"],
                            }
                        ]
                    }
                },
                "currentState": {"value": ["Adventure", "Fighting", "Misc"]},
                "id": "NATIVE_FILTER-B2PFYVIUw",
            },
            "NATIVE_FILTER-VDLd4Wq-v": {
                "extraFormData": {"append_form_data": {"filters": []}},
                "currentState": {"value": None},
                "id": "NATIVE_FILTER-VDLd4Wq-v",
            },
            "NATIVE_FILTER-JeZ9HYoTP": {
                "extraFormData": {
                    "append_form_data": {
                        "filters": [
                            {
                                "col": "platform",
                                "op": "IN",
                                "val": ["GB", "GBA", "PSV", "DS", "3DS"],
                            }
                        ]
                    }
                },
                "currentState": {"value": ["GB", "GBA", "PSV", "DS", "3DS"]},
                "id": "NATIVE_FILTER-JeZ9HYoTP",
            },
        }
    },
}

filter_sets_v2 = {
    "name": "New filter set",
    "id": "FILTERS_SET-tt_Ovwy95",
    "nativeFilters": {
        "NATIVE_FILTER-tx05Ze2Hm": {
            "id": "NATIVE_FILTER-tx05Ze2Hm",
            "name": "Time range",
            "filterType": "filter_time",
            "targets": [{}],
            "defaultValue": "No filter",
            "cascadeParentIds": [],
            "scope": {"excluded": [], "rootPath": ["ROOT_ID"]},
            "isInstant": False,
        },
        "NATIVE_FILTER-JeZ9HYoTP": {
            "cascadeParentIds": [],
            "controlValues": {
                "enableEmptyFilter": False,
                "inverseSelection": False,
                "multiSelect": True,
                "sortAscending": True,
                "defaultToFirstItem": False,
            },
            "defaultValue": None,
            "filterType": "filter_select",
            "id": "NATIVE_FILTER-JeZ9HYoTP",
            "isInstant": False,
            "name": "Platform",
            "scope": {"excluded": [], "rootPath": ["ROOT_ID"]},
            "targets": [{"column": {"name": "platform"}, "datasetId": 33}],
        },
        "NATIVE_FILTER-B2PFYVIUw": {
            "cascadeParentIds": [],
            "controlValues": {
                "enableEmptyFilter": False,
                "inverseSelection": False,
                "multiSelect": True,
                "sortAscending": True,
                "defaultToFirstItem": False,
            },
            "defaultValue": None,
            "filterType": "filter_select",
            "id": "NATIVE_FILTER-B2PFYVIUw",
            "isInstant": False,
            "name": "Genre",
            "scope": {"excluded": [], "rootPath": ["ROOT_ID"]},
            "targets": [{"column": {"name": "genre"}, "datasetId": 33}],
        },
        "NATIVE_FILTER-VDLd4Wq-v": {
            "cascadeParentIds": [],
            "controlValues": {
                "enableEmptyFilter": False,
                "inverseSelection": False,
                "multiSelect": True,
                "sortAscending": True,
                "defaultToFirstItem": False,
            },
            "defaultValue": None,
            "filterType": "filter_select",
            "id": "NATIVE_FILTER-VDLd4Wq-v",
            "isInstant": False,
            "name": "Publisher",
            "scope": {"excluded": [], "rootPath": ["ROOT_ID"]},
            "targets": [{"column": {"name": "publisher"}, "datasetId": 33}],
        },
    },
    "dataMask": {
        "NATIVE_FILTER-tx05Ze2Hm": {
            "id": "NATIVE_FILTER-tx05Ze2Hm",
            "filterState": {"value": "No filter"},
            "extraFormData": {"time_range": "No filter"},
        },
        "NATIVE_FILTER-B2PFYVIUw": {
            "id": "NATIVE_FILTER-B2PFYVIUw",
            "filterState": {"value": ["Adventure", "Fighting", "Misc"]},
            "extraFormData": {
                "filters": [
                    {
                        "col": "genre",
                        "op": "IN",
                        "val": ["Adventure", "Fighting", "Misc"],
                    }
                ]
            },
        },
        "NATIVE_FILTER-VDLd4Wq-v": {
            "id": "NATIVE_FILTER-VDLd4Wq-v",
            "filterState": {"value": None},
            "extraFormData": {"filters": []},
        },
        "NATIVE_FILTER-JeZ9HYoTP": {
            "id": "NATIVE_FILTER-JeZ9HYoTP",
            "filterState": {"value": ["GB", "GBA", "PSV", "DS", "3DS"]},
            "extraFormData": {
                "filters": [
                    {
                        "col": "platform",
                        "op": "IN",
                        "val": ["GB", "GBA", "PSV", "DS", "3DS"],
                    }
                ]
            },
        },
    },
}


def test_upgrade_select_filters():
    """
    ensure that controlValue.defaultToFirstItem is added if it's missing
    """
    converted_filters = deepcopy(native_filters_v1)
    upgrade_select_filters(converted_filters)
    assert converted_filters == native_filters_v2


def test_upgrade_filter_sets():
    """
    ensure that filter set upgrade operation produces a object that is compatible
    with a currently functioning set
    """
    converted_filter_set = deepcopy(filter_sets_v1)
    upgrade_filter_set(converted_filter_set)
    assert converted_filter_set == filter_sets_v2


def test_downgrade_filter_set():
    """
    ensure that the filter set downgrade operation produces an almost identical dict
    as the original value
    """
    converted_v1_set = deepcopy(filter_sets_v1)
    # upgrade the native filter metadata in the comparison fixture,
    # as removing the defaultToFirstItem is not necessary
    upgrade_select_filters(converted_v1_set["nativeFilters"].values())

    converted_filter_set = deepcopy(filter_sets_v2)
    downgrade_filter_set(converted_filter_set)
    assert converted_filter_set == converted_v1_set
