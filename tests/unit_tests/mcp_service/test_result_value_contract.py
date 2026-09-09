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

"""Contract tests for user-authored MCP result values.

The inventory records every result path that used the removed in-band marker
or its delimiter escaping. Individual serializer/tool tests exercise the
concrete Pydantic models. These tests lock the cross-cutting protocol and
read-modify-write guarantees in one place.
"""

from pathlib import Path

AFFECTED_RESULT_PATHS = (
    # Annotation layers and annotations.
    "annotation_layers[].name",
    "annotation_layers[].descr",
    "annotations[].short_descr",
    "annotations[].long_descr",
    "annotations[].json_metadata",
    # Charts: metadata, generated form data, query results, previews, and SQL.
    "ChartError.message",
    "ChartInfo.slice_name",
    "ChartInfo.description",
    "ChartInfo.certified_by",
    "ChartInfo.certification_details",
    "ChartInfo.datasource_name",
    "ChartInfo.filters/** (including string keys)",
    "ChartInfo.form_data/** (including string keys)",
    "ChartInfo.form_data.metrics[].sqlExpression",
    "ChartInfo.form_data.metrics[].label",
    "ChartInfo.form_data.metric.sqlExpression",
    "ChartInfo.form_data.metric.label",
    "ChartInfo.tags[].name",
    "ChartInfo.tags[].description",
    "ChartData.chart_name",
    "ChartData.summary",
    "ChartData.csv_data",
    "ChartData.insights/** (including string keys)",
    "ChartData.data/** (including string keys)",
    "ChartData.query_results[].data/** (including string keys)",
    "ChartData.columns[].sample_values/** (including string keys)",
    "ChartPreview.chart_name",
    "ChartPreview.chart_description",
    "ChartPreview.accessibility.alt_text",
    "ChartPreview.content.ascii_content",
    "ChartPreview.content.table_data",
    "ChartPreview.content.html_content",
    "ChartPreview.content.specification.description",
    "ChartPreview.content.specification.data.values/** (including string keys)",
    "ChartSql.chart_name",
    "ChartSql.datasource_name",
    "ChartSql.sql",
    "ChartSql.error",
    "DeleteChartResponse.deleted_name",
    "DeleteChartResponse.message",
    "DeleteChartResponse.error (chart name or identifier echo)",
    "RestoreChartResponse.restored_name",
    "RestoreChartResponse.message",
    "RestoreChartResponse.error (chart name or identifier echo)",
    "GenerateChartResponse.error.message (update identifier echo)",
    "GenerateChartResponse.error.details (update identifier echo)",
    "GenerateChartResponse.form_data/** (generate/update, including string keys)",
    # Dashboards: metadata, layout, native filters, governance, and datasets.
    "DashboardError.error",
    "AddChartToDashboardResponse.error",
    "RemoveChartFromDashboardResponse.error",
    "DuplicateDashboardResponse.error",
    "ManageDashboardOwnersResponse.error",
    "ManageDashboardRolesResponse.error",
    "ManageDashboardCertificationResponse.error",
    "ManageNativeFiltersResponse.error",
    "DashboardInfo.dashboard_title",
    "DashboardInfo.description",
    "DashboardInfo.css",
    "DashboardInfo.certified_by",
    "DashboardInfo.certification_details",
    "DashboardInfo.native_filters[].name",
    "DashboardInfo.native_filters[].targets/** (including string keys)",
    "DashboardInfo.charts[].slice_name",
    "DashboardInfo.charts[].description",
    "DashboardInfo.charts[].datasource_name",
    "DashboardInfo.filter_state/** (including string keys)",
    "DashboardInfo.tags[].name",
    "DashboardInfo.tags[].description",
    "ManageDashboardOwnersResponse.owners[].label",
    "ManageDashboardRolesResponse.roles[].label",
    "ManageDashboardCertificationResponse.certified_by",
    "ManageDashboardCertificationResponse.certification_details",
    "DashboardLayout.dashboard_title",
    "DashboardLayout.tabs[].name",
    "DashboardLayout.charts[].slice_name",
    "DashboardLayout.charts[].tab_path[]",
    "DashboardDatasets.dashboard_title",
    "DashboardDatasets.datasets[].database.name",
    "DashboardDatasets.datasets[].table_name",
    "DashboardDatasets.datasets[].schema_name",
    "DashboardDatasets.datasets[].columns[].column_name",
    "DashboardDatasets.datasets[].columns[].verbose_name",
    "DashboardDatasets.datasets[].metrics[].metric_name",
    "DashboardDatasets.datasets[].metrics[].verbose_name",
    "DashboardDatasets.datasets[].metrics[].expression",
    "ManageNativeFiltersResponse.filters[].name",
    "ManageNativeFiltersResponse.filters[].id",
    "ManageNativeFiltersResponse.filters[].filter_type",
    "ManageNativeFiltersResponse.filters[].targets/** (including string keys)",
    "DeleteDashboardResponse.deleted_name",
    "DeleteDashboardResponse.message",
    "DeleteDashboardResponse.error (dashboard title or identifier echo)",
    "RestoreDashboardResponse.restored_name",
    "RestoreDashboardResponse.message",
    "RestoreDashboardResponse.error (dashboard title or identifier echo)",
    # Datasets, columns, metrics, and tags.
    "DatasetError.error",
    "DatasetInfo.table_name",
    "DatasetInfo.schema_name",
    "DatasetInfo.database_name",
    "DatasetInfo.schema_perm",
    "DatasetInfo.description",
    "DatasetInfo.certified_by",
    "DatasetInfo.certification_details",
    "DatasetInfo.sql",
    "DatasetInfo.extra/** (including string keys)",
    "DatasetInfo.params/** (including string keys)",
    "DatasetInfo.template_params/** (including string keys)",
    "DatasetInfo.columns[].column_name",
    "DatasetInfo.columns[].description",
    "DatasetInfo.columns[].verbose_name",
    "DatasetInfo.metrics[].metric_name",
    "DatasetInfo.metrics[].expression",
    "DatasetInfo.metrics[].description",
    "DatasetInfo.metrics[].verbose_name",
    "DatasetInfo.tags[].name",
    "DatasetInfo.tags[].description",
    "UpdateDatasetMetricResponse.metric.metric_name",
    "UpdateDatasetMetricResponse.metric.verbose_name",
    "UpdateDatasetMetricResponse.metric.expression",
    "UpdateDatasetMetricResponse.metric.description",
    "UpdateDatasetMetricResponse.metric.warning_text",
    "UpdateDatasetMetricResponse.metric.extra",
    "UpdateDatasetMetricResponse.error (metric identifier/suggestions/names)",
    # SQL Lab, reports, roles, users, tags, tasks, and themes.
    "SqlLabResponse.url.query.sql",
    "SqlLabResponse.url.query.name",
    "SqlLabResponse.title",
    "SqlLabResponse.error",
    "ReportError.error",
    "ReportInfo.name",
    "ReportInfo.description",
    "RoleError.error",
    "RoleInfo.name",
    "RoleInfo.permissions[]",
    "UserError.error",
    "UserInfo.username",
    "UserInfo.first_name",
    "UserInfo.last_name",
    "UserInfo.email",
    "UserInfo.roles[]",
    "TagInfo.name",
    "TagInfo.description",
    "TaskInfo.task_key",
    "TaskInfo.task_name",
    "ThemeInfo.theme_name",
    "ThemeInfo.json_data",
    "CreateThemeResponse.theme_name",
    "CreateThemeResponse.message",
)


def test_affected_result_path_inventory_is_unique() -> None:
    """Keep the audited field inventory explicit without posing as path coverage."""
    assert len(AFFECTED_RESULT_PATHS) == 147
    assert len(AFFECTED_RESULT_PATHS) == len(set(AFFECTED_RESULT_PATHS))


def test_production_code_defines_no_fixed_in_band_marker() -> None:
    source_root = Path(__file__).parents[3] / "superset" / "mcp_service"
    opening_marker = "<" + "UNTRUSTED-CONTENT>"
    closing_marker = "</" + "UNTRUSTED-CONTENT>"
    escaped_open_marker = "[ESCAPED-" + "UNTRUSTED-CONTENT-OPEN]"
    escaped_close_marker = "[ESCAPED-" + "UNTRUSTED-CONTENT-CLOSE]"

    offenders = []
    for path in source_root.rglob("*.py"):
        source = path.read_text(encoding="utf-8")
        if any(
            marker in source
            for marker in (
                opening_marker,
                closing_marker,
                escaped_open_marker,
                escaped_close_marker,
            )
        ):
            offenders.append(str(path.relative_to(source_root)))

    assert offenders == []
