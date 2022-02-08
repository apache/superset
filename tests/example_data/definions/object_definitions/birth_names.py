#  Licensed to the Apache Software Foundation (ASF) under one
#  or more contributor license agreements.  See the NOTICE file
#  distributed with this work for additional information
#  regarding copyright ownership.  The ASF licenses this file
#  to you under the Apache License, Version 2.0 (the
#  "License"); you may not use this file except in compliance
#  with the License.  You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing,
#  software distributed under the License is distributed on an
#  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
#  KIND, either express or implied.  See the License for the
#  specific language governing permissions and limitations
#  under the License.
import logging
from typing import Any, Callable, Dict, List

from . import BaseExampleDataDefinitionsHolder, filter_definition_factory

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

GENDER_IS_GIRL_FILTER = filter_definition_factory("gender", "girl")
DEFAULT_AD_HOC_FILTERS = [GENDER_IS_GIRL_FILTER.copy()]

DEFAULT_DASHBOARD_META_DATA = {
    "label_colors": {
        "Girls": "#FF69B4",
        "Boys": "#ADD8E6",
        "girl": "#FF69B4",
        "boy": "#ADD8E6",
    }
}
DEFAULT_DASHBOARD_POSITIONS = {
    "CHART-6GdlekVise": {
        "children": [],
        "id": "CHART-6GdlekVise",
        "meta": {
            "chartId": 5547,
            "height": 50,
            "sliceName": "Top 10 Girl Name Share",
            "width": 5,
        },
        "parents": ["ROOT_ID", "GRID_ID", "ROW-eh0w37bWbR"],
        "type": "CHART",
    },
    "CHART-6n9jxb30JG": {
        "children": [],
        "id": "CHART-6n9jxb30JG",
        "meta": {
            "chartId": 5540,
            "height": 36,
            "sliceName": "Genders by State",
            "width": 5,
        },
        "parents": ["ROOT_ID", "GRID_ID", "ROW--EyBZQlDi"],
        "type": "CHART",
    },
    "CHART-Jj9qh1ol-N": {
        "children": [],
        "id": "CHART-Jj9qh1ol-N",
        "meta": {
            "chartId": 5545,
            "height": 50,
            "sliceName": "Boy Name Cloud",
            "width": 4,
        },
        "parents": ["ROOT_ID", "GRID_ID", "ROW-kzWtcvo8R1"],
        "type": "CHART",
    },
    "CHART-ODvantb_bF": {
        "children": [],
        "id": "CHART-ODvantb_bF",
        "meta": {
            "chartId": 5548,
            "height": 50,
            "sliceName": "Top 10 Boy Name Share",
            "width": 5,
        },
        "parents": ["ROOT_ID", "GRID_ID", "ROW-kzWtcvo8R1"],
        "type": "CHART",
    },
    "CHART-PAXUUqwmX9": {
        "children": [],
        "id": "CHART-PAXUUqwmX9",
        "meta": {"chartId": 5538, "height": 34, "sliceName": "Genders", "width": 3},
        "parents": ["ROOT_ID", "GRID_ID", "ROW-2n0XgiHDgs"],
        "type": "CHART",
    },
    "CHART-_T6n_K9iQN": {
        "children": [],
        "id": "CHART-_T6n_K9iQN",
        "meta": {"chartId": 5539, "height": 36, "sliceName": "Trends", "width": 7},
        "parents": ["ROOT_ID", "GRID_ID", "ROW--EyBZQlDi"],
        "type": "CHART",
    },
    "CHART-eNY0tcE_ic": {
        "children": [],
        "id": "CHART-eNY0tcE_ic",
        "meta": {
            "chartId": 5537,
            "height": 34,
            "sliceName": "Participants",
            "width": 3,
        },
        "parents": ["ROOT_ID", "GRID_ID", "ROW-2n0XgiHDgs"],
        "type": "CHART",
    },
    "CHART-g075mMgyYb": {
        "children": [],
        "id": "CHART-g075mMgyYb",
        "meta": {"chartId": 5541, "height": 50, "sliceName": "Girls", "width": 3},
        "parents": ["ROOT_ID", "GRID_ID", "ROW-eh0w37bWbR"],
        "type": "CHART",
    },
    "CHART-n-zGGE6S1y": {
        "children": [],
        "id": "CHART-n-zGGE6S1y",
        "meta": {
            "chartId": 5542,
            "height": 50,
            "sliceName": "Girl Name Cloud",
            "width": 4,
        },
        "parents": ["ROOT_ID", "GRID_ID", "ROW-eh0w37bWbR"],
        "type": "CHART",
    },
    "CHART-vJIPjmcbD3": {
        "children": [],
        "id": "CHART-vJIPjmcbD3",
        "meta": {"chartId": 5543, "height": 50, "sliceName": "Boys", "width": 3},
        "parents": ["ROOT_ID", "GRID_ID", "ROW-kzWtcvo8R1"],
        "type": "CHART",
    },
    "DASHBOARD_VERSION_KEY": "v2",
    "GRID_ID": {
        "children": [
            "ROW-2n0XgiHDgs",
            "ROW--EyBZQlDi",
            "ROW-eh0w37bWbR",
            "ROW-kzWtcvo8R1",
        ],
        "id": "GRID_ID",
        "parents": ["ROOT_ID"],
        "type": "GRID",
    },
    "HEADER_ID": {"id": "HEADER_ID", "meta": {"text": "Births"}, "type": "HEADER"},
    "MARKDOWN-zaflB60tbC": {
        "children": [],
        "id": "MARKDOWN-zaflB60tbC",
        "meta": {
            "code": '<div style=\\"text-align:center\\">  <h1>Birth Names Dashboard</h1>  <img src=\\"/static/assets/images/babies.png\\" style=\\"width:50%;\\"></div>',
            "height": 34,
            "width": 6,
        },
        "parents": ["ROOT_ID", "GRID_ID", "ROW-2n0XgiHDgs"],
        "type": "MARKDOWN",
    },
    "ROOT_ID": {"children": ["GRID_ID"], "id": "ROOT_ID", "type": "ROOT"},
    "ROW--EyBZQlDi": {
        "children": ["CHART-_T6n_K9iQN", "CHART-6n9jxb30JG"],
        "id": "ROW--EyBZQlDi",
        "meta": {"background": "BACKGROUND_TRANSPARENT"},
        "parents": ["ROOT_ID", "GRID_ID"],
        "type": "ROW",
    },
    "ROW-2n0XgiHDgs": {
        "children": ["CHART-eNY0tcE_ic", "MARKDOWN-zaflB60tbC", "CHART-PAXUUqwmX9"],
        "id": "ROW-2n0XgiHDgs",
        "meta": {"background": "BACKGROUND_TRANSPARENT"},
        "parents": ["ROOT_ID", "GRID_ID"],
        "type": "ROW",
    },
    "ROW-eh0w37bWbR": {
        "children": ["CHART-g075mMgyYb", "CHART-n-zGGE6S1y", "CHART-6GdlekVise"],
        "id": "ROW-eh0w37bWbR",
        "meta": {"background": "BACKGROUND_TRANSPARENT"},
        "parents": ["ROOT_ID", "GRID_ID"],
        "type": "ROW",
    },
    "ROW-kzWtcvo8R1": {
        "children": ["CHART-vJIPjmcbD3", "CHART-Jj9qh1ol-N", "CHART-ODvantb_bF"],
        "id": "ROW-kzWtcvo8R1",
        "meta": {"background": "BACKGROUND_TRANSPARENT"},
        "parents": ["ROOT_ID", "GRID_ID"],
        "type": "ROW",
    },
}

DEFAULT_METRIC = "sum__num"
DEFAULT_METRICS = [
    {
        "expressionType": "SIMPLE",
        "column": {"column_name": "num", "type": "BIGINT"},
        "aggregate": "SUM",
        "label": "Births",
        "optionName": "metric_11",
    }
]
SLICES_DEFINITIONS = {
    "Participants": {
        "viz_type": "big_number",
        "params": {
            "viz_type": "big_number",
            "granularity_sqla": "ds",
            "compare_lag": "5",
            "compare_suffix": "over 5Y",
            "metric": DEFAULT_METRIC,
        },
    },
    "Genders": {
        "viz_type": "pie",
        "params": {"viz_type": "pie", "groupby": ["gender"], "metric": DEFAULT_METRIC},
    },
    "Trends": {
        "viz_type": "line",
        "params": {
            "viz_type": "line",
            "groupby": ["name"],
            "granularity_sqla": "ds",
            "rich_tooltip": True,
            "show_legend": True,
            "metrics": DEFAULT_METRICS,
        },
    },
    "Genders by State": {
        "viz_type": "dist_bar",
        "params": {
            "adhoc_filters": [
                {
                    "clause": "WHERE",
                    "expressionType": "SIMPLE",
                    "filterOptionName": "2745eae5",
                    "comparator": ["other"],
                    "operator": "NOT IN",
                    "subject": "state",
                }
            ],
            "viz_type": "dist_bar",
            "metrics": [
                {
                    "expressionType": "SIMPLE",
                    "column": {"column_name": "num_boys", "type": "BIGINT(20)"},
                    "aggregate": "SUM",
                    "label": "Boys",
                    "optionName": "metric_11",
                },
                {
                    "expressionType": "SIMPLE",
                    "column": {"column_name": "num_girls", "type": "BIGINT(20)"},
                    "aggregate": "SUM",
                    "label": "Girls",
                    "optionName": "metric_12",
                },
            ],
            "groupby": ["state"],
        },
    },
    "Girls": {
        "viz_type": "table",
        "params": {
            "groupby": ["name"],
            "adhoc_filters": DEFAULT_AD_HOC_FILTERS.copy(),
            "row_limit": 50,
            "timeseries_limit_metric": DEFAULT_METRIC,
            "metrics": [DEFAULT_METRIC],
        },
    },
    "Girl Name Cloud": {
        "viz_type": "word_cloud",
        "params": {
            "viz_type": "word_cloud",
            "size_from": "10",
            "series": "name",
            "size_to": "70",
            "rotation": "square",
            "limit": "100",
            "adhoc_filters": DEFAULT_AD_HOC_FILTERS.copy(),
            "metric": DEFAULT_METRIC,
        },
    },
    "Boys": {
        "viz_type": "table",
        "params": {
            "groupby": ["name"],
            "adhoc_filters": DEFAULT_AD_HOC_FILTERS.copy(),
            "row_limit": 50,
            "timeseries_limit_metric": DEFAULT_METRIC,
            "metrics": [DEFAULT_METRIC],
        },
    },
    "Boy Name Cloud": {
        "viz_type": "word_cloud",
        "params": {
            "viz_type": "word_cloud",
            "size_from": "10",
            "series": "name",
            "size_to": "70",
            "rotation": "square",
            "limit": "100",
            "adhoc_filters": DEFAULT_AD_HOC_FILTERS.copy(),
            "metric": DEFAULT_METRIC,
        },
    },
    "Top 10 Girl Name Share": {
        "viz_type": "area",
        "params": {
            "adhoc_filters": DEFAULT_AD_HOC_FILTERS.copy(),
            "comparison_type": "values",
            "groupby": ["name"],
            "limit": 10,
            "stacked_style": "expand",
            "time_grain_sqla": "P1D",
            "viz_type": "area",
            "x_axis_forma": "smart_date",
            "compare_suffix": "over 5Y",
            "metrics": DEFAULT_METRICS,
        },
    },
    "Top 10 Boy Name Share": {
        "viz_type": "area",
        "params": {
            "adhoc_filters": DEFAULT_AD_HOC_FILTERS.copy(),
            "comparison_type": "values",
            "groupby": ["name"],
            "limit": 10,
            "stacked_style": "expand",
            "time_grain_sqla": "P1D",
            "viz_type": "area",
            "x_axis_forma": "smart_date",
            "compare_suffix": "over 5Y",
            "metrics": DEFAULT_METRICS,
        },
    },
    "Pivot Table v2": {
        "viz_type": "pivot_table_v2",
        "params": {
            "viz_type": "pivot_table_v2",
            "groupbyRows": ["name"],
            "groupbyColumns": ["state"],
            "metrics": [DEFAULT_METRIC],
        },
        "queries": [{"columns": ["name", "state"], "metrics": [DEFAULT_METRIC]}],
    },
}

DEFAULT_SLICE_PARAMS = {
    "compare_lag": "10",
    "compare_suffix": "o10Y",
    "limit": "25",
    "time_range": "No filter",
    "time_range_endpoints": ["inclusive", "exclusive"],
    "granularity_sqla": "ds",
    "groupby": [],
    "since": "100 years ago",
    "until": "now",
    "viz_type": "table",
    "markup_type": "markdown",
}

DEFAULT_SLICE_QUERY_CONTEXT = {
    "result_format": "json",
    "result_type": "full",
    "datasource": {"id": None, "type": "table",},
    "queries": [{"columns": [], "metrics": [],},],
}

raw_misc_slices = {
    "Average and Sum Trends": {
        "viz_type": "dual_line",
        "params": {
            "viz_type": "dual_line",
            "metric": {
                "expressionType": "SIMPLE",
                "column": {"column_name": "num", "type": "BIGINT(20)"},
                "aggregate": "AVG",
                "label": "AVG(num)",
                "optionName": "metric_vgops097wej_g8uff99zhk7",
            },
            "metric_2": "sum__num",
            "granularity_sqla": "ds",
            "metrics": DEFAULT_METRICS,
        },
    },
    "Num Births Trend": {
        "viz_type": "line",
        "params": {"viz_type": "line", "metrics": DEFAULT_METRICS},
    },
    "Daily Totals": {
        "viz_type": "table",
        "params": {
            "groupby": ["ds"],
            "since": "40 years ago",
            "until": "now",
            "viz_type": "table",
            "metrics": DEFAULT_METRICS,
        },
    },
    "Number of California Births": {
        "viz_type": "big_number_total",
        "params": {
            "metric": {
                "expressionType": "SIMPLE",
                "column": {
                    "column_name": "num_california",
                    "expression": "CASE WHEN state = 'CA' THEN num ELSE 0 END",
                },
                "aggregate": "SUM",
                "label": "SUM(num_california)",
            },
            "viz_type": "big_number_total",
            "granularity_sqla": "ds",
        },
    },
    "Top 10 California Names Timeseries": {
        "viz_type": "line",
        "params": {
            "metrics": [
                {
                    "expressionType": "SIMPLE",
                    "column": {
                        "column_name": "num_california",
                        "expression": "CASE WHEN state = 'CA' THEN num ELSE 0 END",
                    },
                    "aggregate": "SUM",
                    "label": "SUM(num_california)",
                }
            ],
            "viz_type": "line",
            "granularity_sqla": "ds",
            "groupby": ["name"],
            "timeseries_limit_metric": {
                "expressionType": "SIMPLE",
                "column": {
                    "column_name": "num_california",
                    "expression": "CASE WHEN state = 'CA' THEN num ELSE 0 END",
                },
                "aggregate": "SUM",
                "label": "SUM(num_california)",
            },
            "limit": "10",
        },
    },
    "Names Sorted by Num in California": {
        "viz_type": "table",
        "params": {
            "metrics": DEFAULT_METRICS,
            "groupby": ["name"],
            "row_limit": 50,
            "timeseries_limit_metric": {
                "expressionType": "SIMPLE",
                "column": {
                    "column_name": "num_california",
                    "expression": "CASE WHEN state = 'CA' THEN num ELSE 0 END",
                },
                "aggregate": "SUM",
                "label": "SUM(num_california)",
            },
        },
    },
    "Number of Girls": {
        "viz_type": "big_number_total",
        "params": {
            "metric": DEFAULT_METRIC,
            "viz_type": "big_number_total",
            "granularity_sqla": "ds",
            "adhoc_filters": DEFAULT_AD_HOC_FILTERS.copy(),
            "subheader": "total female participants",
        },
    },
    "Pivot Table": {
        "viz_type": "pivot_table",
        "params": {
            "viz_type": "pivot_table",
            "groupby": ["name"],
            "columns": ["state"],
            "metrics": DEFAULT_METRICS,
        },
    },
}

from tests.common.logger_utils import log


@log
class BirthNamesDefinitionsHolder(BaseExampleDataDefinitionsHolder):
    _default_slice_params: Dict[str, Any]

    def __init__(
        self,
        example_table_columns_supplier: Callable[[], List[Dict[str, Any]]],
        row_limit_configuration: int,
    ):
        super(BirthNamesDefinitionsHolder, self).__init__(
            example_table_columns_supplier
        )
        self._default_slice_params = DEFAULT_SLICE_PARAMS.copy()
        self._default_slice_params["row_limit"] = row_limit_configuration  # type: ignore

    def get_default_dashboard_metadata(self) -> Dict[str, Any]:
        return DEFAULT_DASHBOARD_META_DATA.copy()

    def get_dashboard_positions(self) -> Dict[str, Any]:
        return DEFAULT_DASHBOARD_POSITIONS.copy()

    def get_slices_definitions(self) -> Dict[str, Any]:
        return SLICES_DEFINITIONS.copy()

    def get_default_slice_params(self) -> Dict[str, Any]:
        return self._default_slice_params.copy()

    def get_default_slice_query_context(self) -> Dict[str, Any]:
        return DEFAULT_SLICE_QUERY_CONTEXT.copy()

    def get_aggregated_example_columns(self) -> List[Dict[str, Any]]:
        return [
            {
                "name": "num_california",
                "expression": f"CASE WHEN state = 'CA' THEN num ELSE 0 END",
            }
        ]

    def get_table_metrics(self) -> List[Dict[str, Any]]:
        return super().get_table_metrics() + [
            {"metric_name": "sum__num", "expression": "SUM(name)"}
        ]
