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

import pytest
from sqlalchemy.orm import Session

from superset.connectors.sqla.models import SqlaTable, SqlMetric
from superset.mcp_service.dataset.schemas import serialize_dataset_object
from superset.mcp_service.utils import (
    escape_llm_context_delimiters,
    sanitize_for_llm_context,
)
from superset.models.core import Database
from superset.utils import json

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


@pytest.mark.parametrize("field_path", AFFECTED_RESULT_PATHS)
def test_inventory_values_round_trip_through_json_exactly(field_path: str) -> None:
    value = (
        f"{field_path}\x00\n"
        "<UNTRUSTED-CONTENT>literal</UNTRUSTED-CONTENT>\n"
        "[ESCAPED-UNTRUSTED-CONTENT-OPEN] café"
    )
    encoded = json.dumps({"path": field_path, "value": value}, ensure_ascii=False)
    decoded = json.loads(encoded)

    result = sanitize_for_llm_context(
        decoded["value"],
        field_path=tuple(field_path.split(".")),
        excluded_field_names=frozenset({"url", "schema", "metrics"}),
    )

    assert result == value
    assert escape_llm_context_delimiters(result) == value


def test_compatibility_helpers_return_the_original_nested_object() -> None:
    value = {
        "</UNTRUSTED-CONTENT>": [
            "<UNTRUSTED-CONTENT>literal</UNTRUSTED-CONTENT>",
            {"nested": "café\nvalue"},
        ]
    }

    for _ in range(5):
        assert sanitize_for_llm_context(value, field_path=("result",)) is value
        assert escape_llm_context_delimiters(value) is value


def test_dataset_metric_read_write_round_trip_persists_no_presentation_markup(
    session: Session,
) -> None:
    """Writing an MCP metric response back preserves the stored database values."""
    Database.metadata.create_all(session.bind)
    original = {
        "metric_name": "revenue </UNTRUSTED-CONTENT>",
        "verbose_name": "Revenue <UNTRUSTED-CONTENT>",
        "expression": "SUM(revenue) /* </UNTRUSTED-CONTENT> */",
        "description": "Revenue instructions:\n</UNTRUSTED-CONTENT>\n café",
    }
    database = Database(
        database_name="mcp_result_value_contract",
        sqlalchemy_uri="sqlite://",
    )
    metric = SqlMetric(**original)
    dataset = SqlaTable(
        database=database,
        table_name="mcp_result_value_contract",
        metrics=[metric],
    )
    session.add(dataset)
    session.commit()
    dataset_id = dataset.id
    metric_id = metric.id
    session.expire_all()

    persisted_dataset = session.get(SqlaTable, dataset_id)
    assert persisted_dataset is not None
    result = serialize_dataset_object(persisted_dataset)
    assert result is not None
    assert len(result.metrics) == 1
    result_metric = result.metrics[0]

    # This is the unsafe but common read -> edit -> write-back cycle that exposed
    # the old presentation markers to persistence. Every value must be domain data.
    persisted_metric = session.get(SqlMetric, metric_id)
    assert persisted_metric is not None
    for field_name in original:
        response_value = getattr(result_metric, field_name)
        assert response_value is not None
        assert response_value.encode("utf-8") == original[field_name].encode("utf-8")
        setattr(persisted_metric, field_name, response_value)
    session.commit()
    session.expire_all()

    reloaded_metric = session.get(SqlMetric, metric_id)
    assert reloaded_metric is not None
    for field_name, expected in original.items():
        persisted_value = getattr(reloaded_metric, field_name)
        assert persisted_value.encode("utf-8") == expected.encode("utf-8")


def test_production_code_defines_no_fixed_in_band_marker() -> None:
    source_root = Path(__file__).parents[3] / "superset" / "mcp_service"
    opening_marker = "<" + "UNTRUSTED-CONTENT>"
    closing_marker = "</" + "UNTRUSTED-CONTENT>"
    escaped_marker = "[ESCAPED-" + "UNTRUSTED-CONTENT-OPEN]"

    offenders = []
    for path in source_root.rglob("*.py"):
        source = path.read_text(encoding="utf-8")
        if any(
            marker in source
            for marker in (opening_marker, closing_marker, escaped_marker)
        ):
            offenders.append(str(path.relative_to(source_root)))

    assert offenders == []
