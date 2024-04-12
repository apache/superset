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
# pylint: disable=import-outside-toplevel, unused-argument

from typing import Any


def test_update_id_refs_immune_missing(  # pylint: disable=invalid-name
    app_context: None,
):
    """
    Test that missing immune charts are ignored.

    A chart might be removed from a dashboard but still remain in the list of charts
    immune to filters. The missing chart ID should be simply ignored when the
    dashboard is imported.
    """
    from superset.commands.dashboard.importers.v1.utils import update_id_refs

    config = {
        "position": {
            "CHART1": {
                "id": "CHART1",
                "meta": {
                    "chartId": 101,
                    "uuid": "uuid1",
                },
                "type": "CHART",
            },
            "CHART2": {
                "id": "CHART2",
                "meta": {
                    "chartId": 102,
                    "uuid": "uuid2",
                },
                "type": "CHART",
            },
        },
        "metadata": {
            "filter_scopes": {
                "101": {"filter_name": {"immune": [102, 103]}},
                "104": {"filter_name": {"immune": [102, 103]}},
            },
            "native_filter_configuration": [],
        },
    }
    chart_ids = {"uuid1": 1, "uuid2": 2}
    dataset_info: dict[str, dict[str, Any]] = {}  # not used

    fixed = update_id_refs(config, chart_ids, dataset_info)
    assert fixed == {
        "position": {
            "CHART1": {
                "id": "CHART1",
                "meta": {"chartId": 1, "uuid": "uuid1"},
                "type": "CHART",
            },
            "CHART2": {
                "id": "CHART2",
                "meta": {"chartId": 2, "uuid": "uuid2"},
                "type": "CHART",
            },
        },
        "metadata": {
            "filter_scopes": {"1": {"filter_name": {"immune": [2]}}},
            "native_filter_configuration": [],
        },
    }


def test_update_native_filter_config_scope_excluded():
    from superset.commands.dashboard.importers.v1.utils import update_id_refs

    config = {
        "position": {
            "CHART1": {
                "id": "CHART1",
                "meta": {"chartId": 101, "uuid": "uuid1"},
                "type": "CHART",
            },
            "CHART2": {
                "id": "CHART2",
                "meta": {"chartId": 102, "uuid": "uuid2"},
                "type": "CHART",
            },
        },
        "metadata": {
            "native_filter_configuration": [{"scope": {"excluded": [101, 102, 103]}}],
        },
    }
    chart_ids = {"uuid1": 1, "uuid2": 2}
    dataset_info: dict[str, dict[str, Any]] = {}  # not used

    fixed = update_id_refs(config, chart_ids, dataset_info)
    assert fixed == {
        "position": {
            "CHART1": {
                "id": "CHART1",
                "meta": {"chartId": 1, "uuid": "uuid1"},
                "type": "CHART",
            },
            "CHART2": {
                "id": "CHART2",
                "meta": {"chartId": 2, "uuid": "uuid2"},
                "type": "CHART",
            },
        },
        "metadata": {"native_filter_configuration": [{"scope": {"excluded": [1, 2]}}]},
    }
