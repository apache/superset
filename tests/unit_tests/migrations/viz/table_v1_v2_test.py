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
from typing import Any

import pytest

from superset.migrations.shared.migrate_viz import MigrateTableChart
from superset.utils import json
from tests.unit_tests.migrations.viz.utils import migrate_and_assert

SOURCE_FORM_DATA: dict[str, Any] = {
    "datasource": "1__table",
    "any_other_key": "untouched",
    "viz_type": "table",
    "query_mode": "aggregate",
    "groupby": ["name"],
    "metrics": ["count"],
    "percent_metrics": [],
    "all_columns": [],
    "row_limit": 1000,
    "order_desc": True,
    "table_timestamp_format": "smart_date",
    "page_length": 20,
    "include_search": False,
    "show_cell_bars": True,
    "align_pn": False,
    "color_pn": True,
    "allow_rearrange_columns": True,
    "allow_render_html": True,
}

TARGET_FORM_DATA: dict[str, Any] = {
    "datasource": "1__table",
    "any_other_key": "untouched",
    "viz_type": "ag-grid-table",
    "query_mode": "aggregate",
    "groupby": ["name"],
    "metrics": ["count"],
    "percent_metrics": [],
    "all_columns": [],
    "row_limit": 1000,
    "order_desc": True,
    "table_timestamp_format": "smart_date",
    "page_length": 20,
    "include_search": False,
    "show_cell_bars": True,
    "align_pn": False,
    "color_pn": True,
    "form_data_bak": SOURCE_FORM_DATA,
}


def test_migration() -> None:
    migrate_and_assert(MigrateTableChart, SOURCE_FORM_DATA, TARGET_FORM_DATA)


def test_migration_without_datasource_key_in_params() -> None:
    """Some slices don't have a "datasource" key inside params, relying
    instead on the datasource_id/datasource_type columns — that key is
    normally injected on the fly by Slice.form_data, which the migration
    framework bypasses by reading params directly. upgrade_slice must
    synthesize the same "id__type" string from those columns, or
    _build_query() raises KeyError('datasource') for charts missing it."""
    from superset.models.slice import Slice
    from superset.utils import json

    source: dict[str, Any] = {
        k: v for k, v in SOURCE_FORM_DATA.items() if k != "datasource"
    }
    dumped_form_data: str = json.dumps(source)

    slc: Slice = Slice(
        viz_type=MigrateTableChart.source_viz_type,
        datasource_id=1,
        datasource_type="table",
        params=dumped_form_data,
        query_context=f'{{"form_data": {dumped_form_data}, "queries": []}}',
    )

    MigrateTableChart.upgrade_slice(slc)

    assert slc.viz_type == MigrateTableChart.target_viz_type
    new_form_data: dict[str, Any] = json.loads(slc.params)
    assert new_form_data["datasource"] == "1__table"


def test_migration_raw_mode() -> None:
    source: dict[str, Any] = {
        **SOURCE_FORM_DATA,
        "query_mode": "raw",
        "groupby": [],
        "metrics": [],
        "all_columns": ["name", "sales"],
    }
    target: dict[str, Any] = {
        **TARGET_FORM_DATA,
        "query_mode": "raw",
        "groupby": [],
        "metrics": [],
        "all_columns": ["name", "sales"],
        "form_data_bak": source,
    }
    migrate_and_assert(MigrateTableChart, source, target)


def test_migration_page_length_all_maps_to_max() -> None:
    """page_length: 0 ('All rows') has no v2 dropdown choice; map to 200,
    the max of v2's PAGE_SIZE_OPTIONS, so migrated charts keep showing as
    many rows per page as v2 supports."""
    source: dict[str, Any] = {**SOURCE_FORM_DATA, "page_length": 0}
    target: dict[str, Any] = {
        **TARGET_FORM_DATA,
        "page_length": 200,
        "form_data_bak": source,
    }
    migrate_and_assert(MigrateTableChart, source, target)


def test_migration_page_length_all_as_string_maps_to_max() -> None:
    source: dict[str, Any] = {**SOURCE_FORM_DATA, "page_length": "0"}
    target: dict[str, Any] = {
        **TARGET_FORM_DATA,
        "page_length": 200,
        "form_data_bak": source,
    }
    migrate_and_assert(MigrateTableChart, source, target)


def test_migration_percent_metric_calculation_all_records_carries_over() -> None:
    """percent_metric_calculation now has a v2 equivalent (control panel +
    buildQuery all_records branch), so it should carry over unchanged."""
    source: dict[str, Any] = {
        **SOURCE_FORM_DATA,
        "percent_metrics": ["sum__sales"],
        "percent_metric_calculation": "all_records",
    }
    target: dict[str, Any] = {
        **TARGET_FORM_DATA,
        "percent_metrics": ["sum__sales"],
        "percent_metric_calculation": "all_records",
        "form_data_bak": source,
    }
    migrate_and_assert(MigrateTableChart, source, target)


def test_migration_entire_row_conditional_formatting_carries_over() -> None:
    """'entire row' conditional formatting now has a v2 equivalent (control
    panel + getCellStyle.ts), so it should carry over unchanged."""
    conditional_formatting: list[dict[str, Any]] = [
        {
            "operator": ">",
            "targetValue": 0,
            "colorScheme": "#ACE1C4",
            "column": "sales",
            "columnFormatting": "ENTIRE_ROW",
        }
    ]
    source: dict[str, Any] = {
        **SOURCE_FORM_DATA,
        "conditional_formatting": conditional_formatting,
    }
    target: dict[str, Any] = {
        **TARGET_FORM_DATA,
        "conditional_formatting": conditional_formatting,
        "form_data_bak": source,
    }
    migrate_and_assert(MigrateTableChart, source, target)


def test_migration_strips_matrixify_keys() -> None:
    """Matrixify has no v2 control panel surface at all. Table charts can't
    reach the Matrixify tab through today's Explore UI, but a chart saved
    during the ~5 months before that exclusion was added (or edited directly
    via the API) can still carry matrixify_* keys. Those keys should be
    dropped and the migration should proceed normally rather than skipping
    the slice."""
    source: dict[str, Any] = {
        **SOURCE_FORM_DATA,
        "matrixify_enable": True,
        "matrixify_mode_rows": "dimensions",
        "matrixify_dimension_rows": "category",
    }
    target: dict[str, Any] = {**TARGET_FORM_DATA, "form_data_bak": source}
    migrate_and_assert(MigrateTableChart, source, target)


@pytest.mark.parametrize(
    "auto_currency_form_data",
    [
        {
            **SOURCE_FORM_DATA,
            "column_config": {
                "sales": {
                    "currencyFormat": {"symbol": "AUTO", "symbolPosition": "prefix"}
                }
            },
        },
    ],
)
def test_migration_auto_currency_carries_over(
    auto_currency_form_data: dict[str, Any],
) -> None:
    """AUTO currency resolution now has a v2 equivalent (transformProps.ts +
    formatValue.ts), so column_config carries over unchanged."""
    target: dict[str, Any] = {
        **TARGET_FORM_DATA,
        "column_config": auto_currency_form_data["column_config"],
        "form_data_bak": auto_currency_form_data,
    }
    migrate_and_assert(MigrateTableChart, auto_currency_form_data, target)


def test_build_query_extra_form_data_time_compare_overrides_chart_level() -> None:
    """A dashboard-level time_compare override (extra_form_data.time_compare)
    must replace the chart-level time_compare shifts in the migrated
    query_context, mirroring buildQuery.ts's override precedence."""
    form_data: dict[str, Any] = {
        "datasource": "1__table",
        "viz_type": "table",
        "query_mode": "aggregate",
        "groupby": ["name"],
        "metrics": ["count"],
        "time_compare": ["1 year ago"],
        "extra_form_data": {"time_compare": "4 weeks ago"},
    }
    main_query = MigrateTableChart(json.dumps(form_data))._build_query()["queries"][0]
    assert main_query["time_offsets"] == ["4 weeks ago"]


def test_build_query_extra_form_data_time_grain_sqla_overrides_chart_level() -> None:
    """A dashboard-level time_grain_sqla override (extra_form_data) must be
    used to decide temporal-column promotion, mirroring buildQuery.ts's
    `extra_form_data?.time_grain_sqla || formData.time_grain_sqla`
    precedence, even when the chart has no top-level time_grain_sqla set."""
    form_data: dict[str, Any] = {
        "datasource": "1__table",
        "viz_type": "table",
        "query_mode": "aggregate",
        "groupby": ["ds", "name"],
        "metrics": ["count"],
        "temporal_columns_lookup": {"ds": True},
        "extra_form_data": {"time_grain_sqla": "P1D"},
    }
    main_query = MigrateTableChart(json.dumps(form_data))._build_query()["queries"][0]
    assert main_query["columns"][0] == {
        "timeGrain": "P1D",
        "columnType": "BASE_AXIS",
        "sqlExpression": "ds",
        "label": "ds",
        "expressionType": "SQL",
    }


def test_build_query_percent_metric_expands_with_time_comparison() -> None:
    """When time comparison is enabled, percent-metric contribution columns
    must include the time-offset-suffixed labels (e.g. "metric__1 year
    ago"), mirroring buildQuery.ts's addComparisonPercentMetrics, so shifted
    percent columns are computed/renamed rather than only the base metric."""
    form_data: dict[str, Any] = {
        "datasource": "1__table",
        "viz_type": "table",
        "query_mode": "aggregate",
        "groupby": ["name"],
        "metrics": ["sum__sales"],
        "percent_metrics": ["sum__sales"],
        "time_compare": ["1 year ago"],
        "comparison_type": "values",
    }
    main_query = MigrateTableChart(json.dumps(form_data))._build_query()["queries"][0]
    contribution = next(
        pp for pp in main_query["post_processing"] if pp["operation"] == "contribution"
    )
    assert contribution["options"]["columns"] == [
        "sum__sales",
        "sum__sales__1 year ago",
    ]
    assert contribution["options"]["rename_columns"] == [
        "%sum__sales",
        "%sum__sales__1 year ago",
    ]
