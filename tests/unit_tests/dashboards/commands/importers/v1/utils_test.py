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


def test_update_charts_reference():
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
            "CHART3": {
                "id": "CHART3",
                "meta": {"chartId": 103, "uuid": "uuid3"},
                "type": "CHART",
            },
            "CHART4": {
                "id": "CHART4",
                "meta": {"chartId": 104, "uuid": "uuid4"},
                "type": "CHART",
            },
        },
        "metadata": {
            "chart_configuration": {
                "101": {
                    "id": 101,
                    "crossFilters": {
                        "chartsInScope": [102, 103],
                        "scope": {"excluded": [101, 110]},
                    },
                },
                "102": {
                    "id": 102,
                    "crossFilters": {
                        "chartsInScope": [],
                        "scope": {"excluded": [101, 102, 103, 110]},
                    },
                },
                "103": {
                    "id": 103,
                    "crossFilters": {
                        "chartsInScope": [110],
                        "scope": {"excluded": [101, 102, 103]},
                    },
                },
                "104": {
                    "id": 104,
                    "crossFilters": {
                        "chartsInScope": [110],
                        "scope": "global",
                    },
                },
            },
            "global_chart_configuration": {
                "chartsInScope": [101, 103, 110],
                "scope": {"excluded": [102, 110]},
            },
            "native_filter_configuration": [
                {
                    "chartsInScope": [101, 102, 103, 110],
                    "scope": {"excluded": [101, 102, 103, 110]},
                }
            ],
        },
    }
    chart_ids = {"uuid1": 1, "uuid2": 2, "uuid3": 3, "uuid4": 4}
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
            "CHART3": {
                "id": "CHART3",
                "meta": {"chartId": 3, "uuid": "uuid3"},
                "type": "CHART",
            },
            "CHART4": {
                "id": "CHART4",
                "meta": {"chartId": 4, "uuid": "uuid4"},
                "type": "CHART",
            },
        },
        "metadata": {
            "chart_configuration": {
                "1": {
                    "id": 1,
                    "crossFilters": {
                        "chartsInScope": [2, 3],
                        "scope": {"excluded": [1]},
                    },
                },
                "2": {
                    "id": 2,
                    "crossFilters": {
                        "chartsInScope": [],
                        "scope": {"excluded": [1, 2, 3]},
                    },
                },
                "3": {
                    "id": 3,
                    "crossFilters": {
                        "chartsInScope": [],
                        "scope": {"excluded": [1, 2, 3]},
                    },
                },
                "4": {
                    "id": 4,
                    "crossFilters": {
                        "chartsInScope": [],
                        "scope": "global",
                    },
                },
            },
            "global_chart_configuration": {
                "chartsInScope": [1, 3],
                "scope": {"excluded": [2]},
            },
            "native_filter_configuration": [
                {"chartsInScope": [1, 2, 3], "scope": {"excluded": [1, 2, 3]}}
            ],
        },
    }
