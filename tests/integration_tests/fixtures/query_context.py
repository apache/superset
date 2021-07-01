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
import copy
from typing import Any, Dict, List

from superset.utils.core import AnnotationType, DTTM_ALIAS, TimeRangeEndpoint
from tests.integration_tests.base_tests import get_table_by_name

query_birth_names = {
    "extras": {
        "where": "",
        "time_range_endpoints": (
            TimeRangeEndpoint.INCLUSIVE,
            TimeRangeEndpoint.EXCLUSIVE,
        ),
        "time_grain_sqla": "P1D",
    },
    "groupby": ["name"],
    "metrics": [{"label": "sum__num"}],
    "orderby": [("sum__num", False)],
    "row_limit": 100,
    "granularity": "ds",
    "time_range": "100 years ago : now",
    "timeseries_limit": 0,
    "timeseries_limit_metric": None,
    "order_desc": True,
    "filters": [
        {"col": "gender", "op": "==", "val": "boy"},
        {"col": "num", "op": "IS NOT NULL"},
        {"col": "name", "op": "NOT IN", "val": ["<NULL>", '"abc"']},
    ],
    "having": "",
    "having_filters": [],
    "where": "",
}

QUERY_OBJECTS: Dict[str, Dict[str, object]] = {
    "birth_names": query_birth_names,
    # `:suffix` are overrides only
    "birth_names:include_time": {"groupby": [DTTM_ALIAS, "name"],},
    "birth_names:orderby_dup_alias": {
        "metrics": [
            {
                "expressionType": "SIMPLE",
                "column": {"column_name": "num_girls", "type": "BIGINT(20)"},
                "aggregate": "SUM",
                "label": "num_girls",
            },
            {
                "expressionType": "SIMPLE",
                "column": {"column_name": "num_boys", "type": "BIGINT(20)"},
                "aggregate": "SUM",
                "label": "num_boys",
            },
        ],
        "orderby": [
            [
                {
                    "expressionType": "SIMPLE",
                    "column": {"column_name": "num_girls", "type": "BIGINT(20)"},
                    "aggregate": "SUM",
                    # the same underlying expression, but different label
                    "label": "SUM(num_girls)",
                },
                False,
            ],
            # reference the ambiguous alias in SIMPLE metric
            [
                {
                    "expressionType": "SIMPLE",
                    "column": {"column_name": "num_boys", "type": "BIGINT(20)"},
                    "aggregate": "AVG",
                    "label": "AVG(num_boys)",
                },
                False,
            ],
            # reference the ambiguous alias in CUSTOM SQL metric
            [
                {
                    "expressionType": "SQL",
                    "sqlExpression": "MAX(CASE WHEN num_boys > 0 THEN 1 ELSE 0 END)",
                    "label": "MAX(CASE WHEN...",
                },
                True,
            ],
        ],
    },
    "birth_names:only_orderby_has_metric": {"metrics": [],},
}

ANNOTATION_LAYERS = {
    AnnotationType.FORMULA: {
        "annotationType": "FORMULA",
        "color": "#ff7f44",
        "hideLine": False,
        "name": "my formula",
        "opacity": "",
        "overrides": {"time_range": None},
        "show": True,
        "showMarkers": False,
        "sourceType": "",
        "style": "solid",
        "value": "3+x",
        "width": 5,
    },
    AnnotationType.EVENT: {
        "name": "my event",
        "annotationType": "EVENT",
        "sourceType": "NATIVE",
        "color": "#e04355",
        "opacity": "",
        "style": "solid",
        "width": 5,
        "showMarkers": False,
        "hideLine": False,
        "value": 1,
        "overrides": {"time_range": None},
        "show": True,
        "titleColumn": "",
        "descriptionColumns": [],
        "timeColumn": "",
        "intervalEndColumn": "",
    },
    AnnotationType.INTERVAL: {
        "name": "my interval",
        "annotationType": "INTERVAL",
        "sourceType": "NATIVE",
        "color": "#e04355",
        "opacity": "",
        "style": "solid",
        "width": 1,
        "showMarkers": False,
        "hideLine": False,
        "value": 1,
        "overrides": {"time_range": None},
        "show": True,
        "titleColumn": "",
        "descriptionColumns": [],
        "timeColumn": "",
        "intervalEndColumn": "",
    },
    AnnotationType.TIME_SERIES: {
        "annotationType": "TIME_SERIES",
        "color": None,
        "descriptionColumns": [],
        "hideLine": False,
        "intervalEndColumn": "",
        "name": "my line",
        "opacity": "",
        "overrides": {"time_range": None},
        "show": True,
        "showMarkers": False,
        "sourceType": "line",
        "style": "dashed",
        "timeColumn": "",
        "titleColumn": "",
        "value": 837,
        "width": 5,
    },
}

POSTPROCESSING_OPERATIONS = {
    "birth_names": [
        {
            "operation": "aggregate",
            "options": {
                "groupby": ["gender"],
                "aggregates": {
                    "q1": {
                        "operator": "percentile",
                        "column": "sum__num",
                        "options": {"q": 25},
                    },
                    "median": {"operator": "median", "column": "sum__num",},
                },
            },
        },
        {"operation": "sort", "options": {"columns": {"q1": False, "gender": True},},},
    ]
}


def get_query_object(
    query_name: str, add_postprocessing_operations: bool
) -> Dict[str, Any]:
    if query_name not in QUERY_OBJECTS:
        raise Exception(f"QueryObject fixture not defined for datasource: {query_name}")
    obj = QUERY_OBJECTS[query_name]

    # apply overrides
    if ":" in query_name:
        parent_query_name = query_name.split(":")[0]
        obj = {
            **QUERY_OBJECTS[parent_query_name],
            **obj,
        }

    query_object = copy.deepcopy(obj)
    if add_postprocessing_operations:
        query_object["post_processing"] = _get_postprocessing_operation(query_name)
    return query_object


def _get_postprocessing_operation(query_name: str) -> List[Dict[str, Any]]:
    if query_name not in QUERY_OBJECTS:
        raise Exception(
            f"Post-processing fixture not defined for datasource: {query_name}"
        )
    return copy.deepcopy(POSTPROCESSING_OPERATIONS[query_name])


def get_query_context(
    query_name: str, add_postprocessing_operations: bool = False,
) -> Dict[str, Any]:
    """
    Create a request payload for retrieving a QueryContext object via the
    `api/v1/chart/data` endpoint. By default returns a payload corresponding to one
    generated by the "Boy Name Cloud" chart in the examples.

    :param query_name: name of an example query, which is always in the format
           of `datasource_name[:test_case_name]`, where `:test_case_name` is optional.
    :param datasource_id: id of datasource to query.
    :param datasource_type: type of datasource to query.
    :param add_postprocessing_operations: Add post-processing operations to QueryObject
    :return: Request payload
    """
    table_name = query_name.split(":")[0]
    table = get_table_by_name(table_name)
    return {
        "datasource": {"id": table.id, "type": table.type},
        "queries": [get_query_object(query_name, add_postprocessing_operations)],
    }
