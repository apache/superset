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
import json
from typing import Dict


def convert_total_function(value):
    agg_mapping = {
        "sum": "Sum",
        "mean": "Average",
        "min": "Minimum",
        "max": "Maximum",
        "std": "Sample Standard Deviation",
        "var": "Sample Variance",
    }
    return agg_mapping.get(value, None)


remove_keys = {}

mapping_keys = {
    "groupby": "groupbyRows",
    "columns": "groupbyColumns",
    "pandas_aggfunc": "aggregateFunction",
    "combine_metric": "combineMetric",
    "transpose_pivot": "transposePivot",
    "number_format": "valueFormat",
}


def post_processing(data: Dict) -> Dict:
    if "viz_type" in data:
        data["viz_type"] = "pivot_table_v2"
    if "aggregateFunction" in data:
        data["aggregateFunction"] = convert_total_function(data["aggregateFunction"])

    if data.get("pivot_margins"):
        return {
            **data,
            "colTotals": True,
            "rowTotals": True,
        }
    return data


def pivottable_v1_to_v2(v1_data: str, viz_type) -> str:
    data = json.loads(v1_data)
    if data.get("viz_type") != viz_type:
        return v1_data

    rv_data = {}
    for (key, value) in data.items():
        if key in mapping_keys and mapping_keys[key] in rv_data:
            raise ValueError("Duplicate key in target viz")

        if key in remove_keys:
            continue

        if key in mapping_keys:
            rv_data[mapping_keys[key]] = value
        else:
            rv_data[key] = value

    rv_data = post_processing(rv_data)
    return json.dumps(rv_data)


class MigrateViz:
    pass
