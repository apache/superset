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
import dataclasses
from typing import Any, Dict, List, Optional

from superset.common.chart_data import ChartDataResultType
from superset.utils.core import AnnotationType, DTTM_ALIAS

query_birth_names = {
    "extras": {"where": "", "time_grain_sqla": "P1D"},
    "columns": ["name"],
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
                "groupby": ["name"],
                "aggregates": {
                    "q1": {
                        "operator": "percentile",
                        "column": "sum__num",
                        # todo: rename "interpolation" to "method" when we updated
                        #  numpy.
                        #  https://numpy.org/doc/stable/reference/generated/numpy.percentile.html
                        "options": {"q": 25, "interpolation": "lower"},
                    },
                    "median": {"operator": "median", "column": "sum__num",},
                },
            },
        },
        {"operation": "sort", "options": {"columns": {"q1": False, "name": True},},},
    ]
}


def get_query_object(
    query_name: str, add_postprocessing_operations: bool, add_time_offsets: bool,
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
    if add_time_offsets:
        query_object["time_offsets"] = ["1 year ago"]

    return query_object


def _get_postprocessing_operation(query_name: str) -> List[Dict[str, Any]]:
    if query_name not in QUERY_OBJECTS:
        raise Exception(
            f"Post-processing fixture not defined for datasource: {query_name}"
        )
    return copy.deepcopy(POSTPROCESSING_OPERATIONS[query_name])


@dataclasses.dataclass
class Table:
    id: int
    type: str
    name: str


class QueryContextGenerator:
    def generate(
        self,
        query_name: str,
        add_postprocessing_operations: bool = False,
        add_time_offsets: bool = False,
        table_id=1,
        table_type="table",
        form_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        form_data = form_data or {}
        table_name = query_name.split(":")[0]
        table = self.get_table(table_name, table_id, table_type)
        return {
            "datasource": {"id": table.id, "type": table.type},
            "queries": [
                get_query_object(
                    query_name, add_postprocessing_operations, add_time_offsets,
                )
            ],
            "result_type": ChartDataResultType.FULL,
            "form_data": form_data,
        }

    def get_table(self, name, id_, type_):
        return Table(id_, type_, name)
