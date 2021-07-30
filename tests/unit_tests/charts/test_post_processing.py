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
from typing import Any, Dict

from superset.charts.post_processing import apply_post_process
from superset.utils.core import GenericDataType, QueryStatus

RESULT: Dict[str, Any] = {
    "query_context": None,
    "queries": [
        {
            "cache_key": "1bd3ab8c01e98a0e349fb61bc76d9b90",
            "cached_dttm": None,
            "cache_timeout": 86400,
            "annotation_data": {},
            "error": None,
            "is_cached": None,
            "query": """SELECT state AS state,
       gender AS gender,
       sum(num) AS \"Births\"
FROM birth_names
WHERE ds >= TO_TIMESTAMP('1921-07-28 00:00:00.000000', 'YYYY-MM-DD HH24:MI:SS.US')
  AND ds < TO_TIMESTAMP('2021-07-28 10:39:44.000000', 'YYYY-MM-DD HH24:MI:SS.US')
GROUP BY state,
         gender
LIMIT 50000;

""",
            "status": QueryStatus.SUCCESS,
            "stacktrace": None,
            "rowcount": 22,
            "colnames": ["state", "gender", "Births"],
            "coltypes": [
                GenericDataType.STRING,
                GenericDataType.STRING,
                GenericDataType.NUMERIC,
            ],
            "data": """state,gender,Births
OH,boy,2376385
TX,girl,2313186
MA,boy,1285126
MA,girl,842146
PA,boy,2390275
NY,boy,3543961
FL,boy,1968060
TX,boy,3311985
NJ,boy,1486126
CA,girl,3567754
CA,boy,5430796
IL,girl,1614427
FL,girl,1312593
NY,girl,2280733
NJ,girl,992702
MI,girl,1326229
other,girl,15058341
other,boy,22044909
MI,boy,1938321
IL,boy,2357411
PA,girl,1615383
OH,girl,1622814
            """,
            "applied_filters": [],
            "rejected_filters": [],
        }
    ],
}


def test_pivot_table():
    form_data = {
        "adhoc_filters": [],
        "columns": ["state"],
        "datasource": "3__table",
        "date_format": "smart_date",
        "extra_form_data": {},
        "granularity_sqla": "ds",
        "groupby": ["gender"],
        "metrics": [
            {
                "aggregate": "SUM",
                "column": {"column_name": "num", "type": "BIGINT"},
                "expressionType": "SIMPLE",
                "label": "Births",
                "optionName": "metric_11",
            }
        ],
        "number_format": "SMART_NUMBER",
        "order_desc": True,
        "pandas_aggfunc": "sum",
        "pivot_margins": True,
        "row_limit": 50000,
        "slice_id": 143,
        "time_grain_sqla": "P1D",
        "time_range": "100 years ago : now",
        "time_range_endpoints": ["inclusive", "exclusive"],
        "url_params": {},
        "viz_type": "pivot_table",
    }
    result = copy.deepcopy(RESULT)
    assert apply_post_process(result, form_data) == {
        "query_context": None,
        "queries": [
            {
                "cache_key": "1bd3ab8c01e98a0e349fb61bc76d9b90",
                "cached_dttm": None,
                "cache_timeout": 86400,
                "annotation_data": {},
                "error": None,
                "is_cached": None,
                "query": """SELECT state AS state,
       gender AS gender,
       sum(num) AS \"Births\"
FROM birth_names
WHERE ds >= TO_TIMESTAMP('1921-07-28 00:00:00.000000', 'YYYY-MM-DD HH24:MI:SS.US')
  AND ds < TO_TIMESTAMP('2021-07-28 10:39:44.000000', 'YYYY-MM-DD HH24:MI:SS.US')
GROUP BY state,
         gender
LIMIT 50000;

""",
                "status": QueryStatus.SUCCESS,
                "stacktrace": None,
                "rowcount": 3,
                "colnames": [
                    "Births CA",
                    "Births FL",
                    "Births IL",
                    "Births MA",
                    "Births MI",
                    "Births NJ",
                    "Births NY",
                    "Births OH",
                    "Births PA",
                    "Births TX",
                    "Births other",
                    "Births All",
                ],
                "coltypes": [
                    GenericDataType.NUMERIC,
                    GenericDataType.NUMERIC,
                    GenericDataType.NUMERIC,
                    GenericDataType.NUMERIC,
                    GenericDataType.NUMERIC,
                    GenericDataType.NUMERIC,
                    GenericDataType.NUMERIC,
                    GenericDataType.NUMERIC,
                    GenericDataType.NUMERIC,
                    GenericDataType.NUMERIC,
                    GenericDataType.NUMERIC,
                    GenericDataType.NUMERIC,
                ],
                "data": """gender,Births CA,Births FL,Births IL,Births MA,Births MI,Births NJ,Births NY,Births OH,Births PA,Births TX,Births other,Births All
boy,5430796,1968060,2357411,1285126,1938321,1486126,3543961,2376385,2390275,3311985,22044909,48133355
girl,3567754,1312593,1614427,842146,1326229,992702,2280733,1622814,1615383,2313186,15058341,32546308
All,8998550,3280653,3971838,2127272,3264550,2478828,5824694,3999199,4005658,5625171,37103250,80679663
""",
                "applied_filters": [],
                "rejected_filters": [],
            }
        ],
    }


def test_pivot_table_v2():
    form_data = {
        "adhoc_filters": [],
        "aggregateFunction": "Sum as Fraction of Rows",
        "colOrder": "key_a_to_z",
        "colTotals": True,
        "combineMetric": True,
        "datasource": "3__table",
        "date_format": "smart_date",
        "extra_form_data": {},
        "granularity_sqla": "ds",
        "groupbyColumns": ["state"],
        "groupbyRows": ["gender"],
        "metrics": [
            {
                "aggregate": "SUM",
                "column": {"column_name": "num", "type": "BIGINT"},
                "expressionType": "SIMPLE",
                "label": "Births",
                "optionName": "metric_11",
            }
        ],
        "metricsLayout": "ROWS",
        "rowOrder": "key_a_to_z",
        "rowTotals": True,
        "row_limit": 50000,
        "slice_id": 72,
        "time_grain_sqla": None,
        "time_range": "100 years ago : now",
        "time_range_endpoints": ["inclusive", "exclusive"],
        "transposePivot": True,
        "url_params": {},
        "valueFormat": "SMART_NUMBER",
        "viz_type": "pivot_table_v2",
    }
    result = copy.deepcopy(RESULT)
    assert apply_post_process(result, form_data) == {
        "query_context": None,
        "queries": [
            {
                "cache_key": "1bd3ab8c01e98a0e349fb61bc76d9b90",
                "cached_dttm": None,
                "cache_timeout": 86400,
                "annotation_data": {},
                "error": None,
                "is_cached": None,
                "query": """SELECT state AS state,
       gender AS gender,
       sum(num) AS \"Births\"
FROM birth_names
WHERE ds >= TO_TIMESTAMP('1921-07-28 00:00:00.000000', 'YYYY-MM-DD HH24:MI:SS.US')
  AND ds < TO_TIMESTAMP('2021-07-28 10:39:44.000000', 'YYYY-MM-DD HH24:MI:SS.US')
GROUP BY state,
         gender
LIMIT 50000;

""",
                "status": QueryStatus.SUCCESS,
                "stacktrace": None,
                "rowcount": 12,
                "colnames": ["All Births", "boy Births", "girl Births"],
                "coltypes": [
                    GenericDataType.NUMERIC,
                    GenericDataType.NUMERIC,
                    GenericDataType.NUMERIC,
                ],
                "data": """state,All Births,boy Births,girl Births
All,1.0,0.5965983645717509,0.40340163542824914
CA,1.0,0.6035190113962805,0.3964809886037195
FL,1.0,0.5998988615985903,0.4001011384014097
IL,1.0,0.5935315085862012,0.40646849141379887
MA,1.0,0.6041192663655611,0.3958807336344389
MI,1.0,0.5937482960898133,0.4062517039101867
NJ,1.0,0.5995276800165239,0.40047231998347604
NY,1.0,0.6084372844307357,0.39156271556926425
OH,1.0,0.5942152416021308,0.40578475839786915
PA,1.0,0.596724682935987,0.40327531706401293
TX,1.0,0.5887794344385264,0.41122056556147357
other,1.0,0.5941503507105172,0.40584964928948275
""",
                "applied_filters": [],
                "rejected_filters": [],
            }
        ],
    }
