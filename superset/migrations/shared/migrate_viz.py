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
from typing import Dict, Set


class MigrateViz:
    remove_keys: Set = set([])

    mapping_keys: Dict[str, str] = {}

    viz_type: str

    def __init__(self, v1_data: str) -> None:
        self.raw_data = v1_data
        self.data = json.loads(v1_data)

    def post_processing(self, data: Dict) -> Dict:
        raise NotImplementedError()

    def migrate(self) -> str:
        if self.data.get("viz_type") != self.viz_type:
            return self.raw_data

        rv_data = {}
        for (key, value) in self.data.items():
            if key in self.mapping_keys and self.mapping_keys[key] in rv_data:
                raise ValueError("Duplicate key in target viz")

            if key in self.remove_keys:
                continue

            if key in self.mapping_keys:
                rv_data[self.mapping_keys[key]] = value
            else:
                rv_data[key] = value

        rv_data = self.post_processing(rv_data)
        return json.dumps(rv_data)


class MigratePivotTable(MigrateViz):
    viz_type = "pivot_table"
    mapping_keys = {
        "groupby": "groupbyRows",
        "columns": "groupbyColumns",
        "pandas_aggfunc": "aggregateFunction",
        "combine_metric": "combineMetric",
        "transpose_pivot": "transposePivot",
        "number_format": "valueFormat",
    }

    @staticmethod
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

    def post_processing(self, data: Dict) -> Dict:
        if "viz_type" in data:
            data["viz_type"] = "pivot_table_v2"
        if "aggregateFunction" in data:
            data["aggregateFunction"] = self.convert_total_function(
                data["aggregateFunction"]
            )

        if data.get("pivot_margins"):
            return {
                **data,
                "colTotals": True,
                "rowTotals": True,
            }
        return data
