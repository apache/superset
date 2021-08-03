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

import pytest

from superset import db
from superset.utils.migrate_viz import get_migrate_class, MirateVizEnum
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,
)

pivot_table_v1_data = """{
    "adhoc_filters": [
    ],
    "columns": [
        "country"
    ],
    "combine_metric": true,
    "datasource": "5__table",
    "date_format": "%d/%m/%Y",
    "extra_form_data": {},
    "granularity_sqla": "order_date",
    "groupby": [
        "deal_size"
    ],
    "metrics": [
    ],
    "number_format": ",d",
    "order_desc": true,
    "pandas_aggfunc": "sum",
    "pivot_margins": true,
    "row_limit": 10000,
    "slice_id": 307,
    "time_grain_sqla": "P1D",
    "time_range": "No filter",
    "time_range_endpoints": [
        "inclusive",
        "exclusive"
    ],
    "timeseries_limit_metric": {
    },
    "transpose_pivot": true,
    "url_params": {},
    "viz_type": "pivot_table"
}
"""


class TestDatasource(SupersetTestCase):
    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_pivottable_v1_to_v2(self):
        slc = self.get_slice("Boys", db.session)
        slc.viz_type = "pivot_table"
        slc.params = pivot_table_v1_data
        slc_pivottable_v2 = get_migrate_class[MirateVizEnum.pivot_table].upgrade(slc)
        pivottable_v2 = json.loads(slc_pivottable_v2.params)
        assert "groupbyRows" in pivottable_v2
        assert "groupbyColumns" in pivottable_v2
        assert "aggregateFunction" in pivottable_v2
        assert "combineMetric" in pivottable_v2
        assert "transposePivot" in pivottable_v2
        assert "valueFormat" in pivottable_v2
        assert "colTotals" in pivottable_v2
        assert "rowTotals" in pivottable_v2
        assert "groupby" not in pivottable_v2
        assert "columns" not in pivottable_v2
        assert "pandas_aggfunc" not in pivottable_v2
        assert "combine_metric" not in pivottable_v2
        assert "transpose_pivot" not in pivottable_v2
        assert "number_format" not in pivottable_v2
        assert pivottable_v2["aggregateFunction"] == "Sum"
        assert pivottable_v2["viz_type"] == "pivot_table_v2"
        assert slc_pivottable_v2.viz_type == "pivot_table_v2"
