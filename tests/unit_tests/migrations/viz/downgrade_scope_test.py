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
from superset.migrations.shared.migrate_viz import MigrateCompareChart, MigrateLineChart
from superset.models.slice import Slice
from superset.utils import json


def test_downgrade_slice_ignores_a_slice_from_a_different_source_migration() -> None:
    """MigrateCompareChart and MigrateLineChart both migrate onto
    echarts_timeseries_line, so `downgrade()`'s SQL filter (target_viz_type +
    a form_data_bak marker) matches slices from either migration. Calling
    the wrong class's `downgrade_slice` on a slice it didn't upgrade must be
    a no-op rather than reverting it to the wrong source viz_type."""
    line_source = {
        "viz_type": "line",
        "datasource": "1__table",
        "x_axis_label": "x",
    }

    slc = Slice(
        viz_type="line",
        datasource_type="table",
        params=json.dumps(line_source),
        query_context=f'{{"form_data": {json.dumps(line_source)}, "queries": []}}',
    )
    MigrateLineChart.upgrade_slice(slc)
    assert slc.viz_type == "echarts_timeseries_line"
    upgraded_params = json.loads(slc.params)

    # MigrateCompareChart's downgrade must not touch a slice that
    # MigrateLineChart (not MigrateCompareChart) upgraded, even though both
    # target echarts_timeseries_line and the slice's params contain a
    # form_data_bak key.
    MigrateCompareChart.downgrade_slice(slc)

    assert slc.viz_type == "echarts_timeseries_line"
    assert json.loads(slc.params) == upgraded_params

    # The matching migration still downgrades it correctly.
    MigrateLineChart.downgrade_slice(slc)
    assert slc.viz_type == "line"
    assert json.loads(slc.params) == line_source
