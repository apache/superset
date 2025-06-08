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
from importlib import import_module

migrate_native_filters_to_new_schema = import_module(
    "superset.migrations.versions."
    "2021-04-29_15-32_f1410ed7ec95_migrate_native_filters_to_new_schema",
)
downgrade_dashboard = migrate_native_filters_to_new_schema.downgrade_dashboard
upgrade_dashboard = migrate_native_filters_to_new_schema.upgrade_dashboard

dashboard_v1 = {
    "native_filter_configuration": [
        {
            "filterType": "filter_select",
            "cascadingFilters": True,
            "defaultValue": ["Albania", "Algeria"],
        },
    ],
    "filter_sets_configuration": [
        {
            "nativeFilters": {
                "FILTER": {
                    "filterType": "filter_select",
                    "cascadingFilters": True,
                    "defaultValue": ["Albania", "Algeria"],
                },
            },
        },
    ],
}


dashboard_v2 = {
    "native_filter_configuration": [
        {
            "filterType": "filter_select",
            "cascadingFilters": True,
            "defaultDataMask": {
                "filterState": {
                    "value": ["Albania", "Algeria"],
                },
            },
        }
    ],
    "filter_sets_configuration": [
        {
            "nativeFilters": {
                "FILTER": {
                    "filterType": "filter_select",
                    "cascadingFilters": True,
                    "defaultDataMask": {
                        "filterState": {
                            "value": ["Albania", "Algeria"],
                        },
                    },
                },
            },
        },
    ],
}


def test_upgrade_dashboard():
    """
    ensure that dashboard upgrade operation produces a correct dashboard object
    """
    converted_dashboard = deepcopy(dashboard_v1)
    filters, filter_sets = upgrade_dashboard(converted_dashboard)
    assert filters == 1
    assert filter_sets == 1
    assert dashboard_v2 == converted_dashboard


def test_downgrade_dashboard():
    """
    ensure that dashboard downgrade operation produces a correct dashboard object
    """
    converted_dashboard = deepcopy(dashboard_v2)
    filters, filter_sets = downgrade_dashboard(converted_dashboard)
    assert filters == 1
    assert filter_sets == 1
    assert dashboard_v1 == converted_dashboard
