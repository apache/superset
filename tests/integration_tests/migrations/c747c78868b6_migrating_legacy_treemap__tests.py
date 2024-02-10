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

from superset.app import SupersetApp
from superset.migrations.shared.migrate_viz import MigrateTreeMap

treemap_form_data = """{
  "adhoc_filters": [
    {
      "clause": "WHERE",
      "comparator": [
        "Edward"
      ],
      "expressionType": "SIMPLE",
      "filterOptionName": "filter_xhbus6irfa_r10k9nwmwy",
      "isExtra": false,
      "isNew": false,
      "operator": "IN",
      "operatorId": "IN",
      "sqlExpression": null,
      "subject": "name"
    }
  ],
  "color_scheme": "bnbColors",
  "datasource": "2__table",
  "extra_form_data": {},
  "granularity_sqla": "ds",
  "groupby": [
    "state",
    "gender"
  ],
  "metrics": [
    "sum__num"
  ],
  "number_format": ",d",
  "order_desc": true,
  "row_limit": 10,
  "time_range": "No filter",
  "timeseries_limit_metric": "sum__num",
  "treemap_ratio": 1.618033988749895,
  "viz_type": "treemap"
}
"""


def test_treemap_migrate(app_context: SupersetApp) -> None:
    from superset.models.slice import Slice

    slc = Slice(
        viz_type=MigrateTreeMap.source_viz_type,
        datasource_type="table",
        params=treemap_form_data,
        query_context=f'{{"form_data": {treemap_form_data}}}',
    )

    MigrateTreeMap.upgrade_slice(slc)
    assert slc.viz_type == MigrateTreeMap.target_viz_type
    # verify form_data
    new_form_data = json.loads(slc.params)
    assert new_form_data["metric"] == "sum__num"
    assert new_form_data["viz_type"] == "treemap_v2"
    assert "metrics" not in new_form_data
    assert json.dumps(new_form_data["form_data_bak"], sort_keys=True) == json.dumps(
        json.loads(treemap_form_data), sort_keys=True
    )

    # verify query_context
    new_query_context = json.loads(slc.query_context)
    assert new_query_context["form_data"]["viz_type"] == "treemap_v2"

    # downgrade
    MigrateTreeMap.downgrade_slice(slc)
    assert slc.viz_type == MigrateTreeMap.source_viz_type
    assert json.dumps(json.loads(slc.params), sort_keys=True) == json.dumps(
        json.loads(treemap_form_data), sort_keys=True
    )
