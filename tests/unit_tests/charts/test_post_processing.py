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

from superset.charts.post_processing import pivot_table, pivot_table_v2
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
            "data": [
                {"state": "OH", "gender": "boy", "Births": int("2376385")},
                {"state": "TX", "gender": "girl", "Births": int("2313186")},
                {"state": "MA", "gender": "boy", "Births": int("1285126")},
                {"state": "MA", "gender": "girl", "Births": int("842146")},
                {"state": "PA", "gender": "boy", "Births": int("2390275")},
                {"state": "NY", "gender": "boy", "Births": int("3543961")},
                {"state": "FL", "gender": "boy", "Births": int("1968060")},
                {"state": "TX", "gender": "boy", "Births": int("3311985")},
                {"state": "NJ", "gender": "boy", "Births": int("1486126")},
                {"state": "CA", "gender": "girl", "Births": int("3567754")},
                {"state": "CA", "gender": "boy", "Births": int("5430796")},
                {"state": "IL", "gender": "girl", "Births": int("1614427")},
                {"state": "FL", "gender": "girl", "Births": int("1312593")},
                {"state": "NY", "gender": "girl", "Births": int("2280733")},
                {"state": "NJ", "gender": "girl", "Births": int("992702")},
                {"state": "MI", "gender": "girl", "Births": int("1326229")},
                {"state": "other", "gender": "girl", "Births": int("15058341")},
                {"state": "other", "gender": "boy", "Births": int("22044909")},
                {"state": "MI", "gender": "boy", "Births": int("1938321")},
                {"state": "IL", "gender": "boy", "Births": int("2357411")},
                {"state": "PA", "gender": "girl", "Births": int("1615383")},
                {"state": "OH", "gender": "girl", "Births": int("1622814")},
            ],
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
    assert pivot_table(result, form_data) == {
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
                "data": [
                    {
                        "Births CA": 5430796,
                        "Births FL": 1968060,
                        "Births IL": 2357411,
                        "Births MA": 1285126,
                        "Births MI": 1938321,
                        "Births NJ": 1486126,
                        "Births NY": 3543961,
                        "Births OH": 2376385,
                        "Births PA": 2390275,
                        "Births TX": 3311985,
                        "Births other": 22044909,
                        "Births All": 48133355,
                        "gender": "boy",
                    },
                    {
                        "Births CA": 3567754,
                        "Births FL": 1312593,
                        "Births IL": 1614427,
                        "Births MA": 842146,
                        "Births MI": 1326229,
                        "Births NJ": 992702,
                        "Births NY": 2280733,
                        "Births OH": 1622814,
                        "Births PA": 1615383,
                        "Births TX": 2313186,
                        "Births other": 15058341,
                        "Births All": 32546308,
                        "gender": "girl",
                    },
                    {
                        "Births CA": 8998550,
                        "Births FL": 3280653,
                        "Births IL": 3971838,
                        "Births MA": 2127272,
                        "Births MI": 3264550,
                        "Births NJ": 2478828,
                        "Births NY": 5824694,
                        "Births OH": 3999199,
                        "Births PA": 4005658,
                        "Births TX": 5625171,
                        "Births other": 37103250,
                        "Births All": 80679663,
                        "gender": "All",
                    },
                ],
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
    assert pivot_table_v2(result, form_data) == {
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
                "data": [
                    {
                        "All Births": 1.0,
                        "boy Births": 0.5965983645717509,
                        "girl Births": 0.40340163542824914,
                        "state": "All",
                    },
                    {
                        "All Births": 1.0,
                        "boy Births": 0.6035190113962805,
                        "girl Births": 0.3964809886037195,
                        "state": "CA",
                    },
                    {
                        "All Births": 1.0,
                        "boy Births": 0.5998988615985903,
                        "girl Births": 0.4001011384014097,
                        "state": "FL",
                    },
                    {
                        "All Births": 1.0,
                        "boy Births": 0.5935315085862012,
                        "girl Births": 0.40646849141379887,
                        "state": "IL",
                    },
                    {
                        "All Births": 1.0,
                        "boy Births": 0.6041192663655611,
                        "girl Births": 0.3958807336344389,
                        "state": "MA",
                    },
                    {
                        "All Births": 1.0,
                        "boy Births": 0.5937482960898133,
                        "girl Births": 0.4062517039101867,
                        "state": "MI",
                    },
                    {
                        "All Births": 1.0,
                        "boy Births": 0.5995276800165239,
                        "girl Births": 0.40047231998347604,
                        "state": "NJ",
                    },
                    {
                        "All Births": 1.0,
                        "boy Births": 0.6084372844307357,
                        "girl Births": 0.39156271556926425,
                        "state": "NY",
                    },
                    {
                        "All Births": 1.0,
                        "boy Births": 0.5942152416021308,
                        "girl Births": 0.40578475839786915,
                        "state": "OH",
                    },
                    {
                        "All Births": 1.0,
                        "boy Births": 0.596724682935987,
                        "girl Births": 0.40327531706401293,
                        "state": "PA",
                    },
                    {
                        "All Births": 1.0,
                        "boy Births": 0.5887794344385264,
                        "girl Births": 0.41122056556147357,
                        "state": "TX",
                    },
                    {
                        "All Births": 1.0,
                        "boy Births": 0.5941503507105172,
                        "girl Births": 0.40584964928948275,
                        "state": "other",
                    },
                ],
                "applied_filters": [],
                "rejected_filters": [],
            }
        ],
    }
