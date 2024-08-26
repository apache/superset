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

from importlib import import_module

from superset.utils import json

chart_ds_constraint = import_module(
    "superset.migrations.versions." "2023-03-27_12-30_7e67aecbf3f1_chart_ds_constraint",
)

Slice = chart_ds_constraint.Slice
upgrade_slice = chart_ds_constraint.upgrade_slc

sample_params = {
    "adhoc_filters": [],
    "all_columns": ["country_name", "country_code", "region", "year", "SP_UWT_TFRT"],
    "applied_time_extras": {},
    "datasource": "35__query",
    "groupby": [],
    "row_limit": 1000,
    "time_range": "No filter",
    "viz_type": "table",
    "granularity_sqla": "year",
    "percent_metrics": [],
    "dashboards": [],
}


def test_upgrade():
    slc = Slice(datasource_type="query", params=json.dumps(sample_params))

    upgrade_slice(slc)

    params = json.loads(slc.params)
    assert slc.datasource_type == "table"
    assert params.get("datasource") == "35__table"


def test_upgrade_bad_json():
    slc = Slice(datasource_type="query", params=json.dumps(sample_params))

    assert None is upgrade_slice(slc)  # noqa: E711
