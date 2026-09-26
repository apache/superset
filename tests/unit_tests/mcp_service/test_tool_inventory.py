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

"""Per-tool size and schema fidelity budgets for the entire registered inventory."""

from copy import deepcopy

import pytest
from jsonschema import Draft202012Validator

from superset.mcp_service.app import mcp
from superset.mcp_service.mcp_config import MCP_TOOL_SEARCH_CONFIG
from superset.mcp_service.server import _create_search_result_serializer, _strip_titles
from superset.utils import json

# Compact JSON including tool metadata, measured as UTF-8 bytes.
# Small-tool budgets are fixed snapshots: ceil(measured_bytes / 100) * 100 + 100,
# leaving 100-199 bytes for incidental description edits. Do not recompute limits
# at test time: they must catch schema growth. Large chart tools retain their
# explicit delivery budgets, well below the sizes produced by reference inlining.
TOOL_BUDGETS = {
    "add_chart_to_existing_dashboard": 1_500,
    "apply_dashboard_filters": 2_900,
    "create_dataset": 1_800,
    "create_theme": 1_100,
    "create_virtual_dataset": 3_700,
    "delete_chart": 1_100,
    "delete_dashboard": 1_100,
    "duplicate_dashboard": 1_900,
    "execute_sql": 2_100,
    "find_users": 1_500,
    "generate_bug_report": 2_600,
    "generate_chart": 50_000,
    "generate_dashboard": 3_400,
    "generate_explore_link": 50_000,
    "get_annotation_layer_info": 1_000,
    "get_catalog": 1_600,
    "get_chart_data": 2_900,
    "get_chart_info": 3_600,
    "get_chart_preview": 3_400,
    "get_chart_sql": 2_100,
    "get_chart_type_schema": 900,
    "get_compatible_dimensions": 1_500,
    "get_compatible_metrics": 1_500,
    "get_dashboard_data": 2_400,
    "get_dashboard_datasets": 1_100,
    "get_dashboard_info": 3_100,
    "get_dashboard_layout": 1_600,
    "get_database_info": 1_400,
    "get_dataset_info": 2_400,
    "get_instance_info": 900,
    "get_layer_annotation_info": 1_100,
    "get_query_info": 1_100,
    "get_report_info": 1_400,
    "get_rls_filter_info": 1_000,
    "get_role_info": 900,
    "get_saved_query_info": 1_200,
    "get_schema": 1_100,
    "get_table": 3_900,
    "get_tag_info": 1_000,
    "get_task_info": 1_100,
    "get_theme_info": 1_000,
    "get_user_info": 1_000,
    "health_check": 700,
    "list_annotation_layers": 2_700,
    # Include the deleted_state edit/restore audience and under-enumeration
    # caveats from #44128: 5,149 and 4,626 bytes, plus the headroom above.
    # Keep the complete-schema parity test below alongside these size limits.
    "list_charts": 5_300,
    "list_dashboards": 4_800,
    "list_databases": 3_500,
    "list_datasets": 4_600,
    "list_layer_annotations": 2_900,
    "list_metrics": 1_900,
    "list_queries": 3_000,
    "list_reports": 3_900,
    "list_rls_filters": 2_600,
    "list_roles": 2_700,
    "list_saved_queries": 3_000,
    "list_tags": 3_100,
    "list_tasks": 2_700,
    "list_themes": 3_000,
    "list_users": 2_900,
    "manage_dashboard_certification": 1_900,
    "manage_dashboard_owners": 2_200,
    "manage_dashboard_roles": 1_900,
    "manage_native_filters": 6_700,
    "open_sql_lab_with_context": 1_800,
    "query_dataset": 3_700,
    "remove_chart_from_dashboard": 1_300,
    "restore_chart": 1_100,
    "restore_dashboard": 1_000,
    "save_sql_query": 1_600,
    "update_chart": 55_000,
    "update_chart_preview": 55_000,
    "update_dashboard": 4_100,
    "update_dataset_metric": 3_100,
}


@pytest.mark.asyncio
async def test_inventory_budgets_cover_every_registered_tool() -> None:
    """New or renamed tools must get explicit budgets instead of escaping checks."""
    tools = await mcp.list_tools(run_middleware=False)
    assert {tool.name for tool in tools} == set(TOOL_BUDGETS)


@pytest.mark.asyncio
@pytest.mark.parametrize("name", TOOL_BUDGETS)
async def test_tool_inventory_size(name: str) -> None:
    """Limit every real serialized entry, including non-chart tools and metadata."""
    tool = await mcp.get_tool(name)
    assert tool is not None
    entry = _create_search_result_serializer(MCP_TOOL_SEARCH_CONFIG)([tool])[0]
    assert "inputSchema" in entry  # Summary mode must not hide schema growth.
    text = json.dumps(entry, ensure_ascii=False, separators=(",", ":"))
    byte_count = len(text.encode("utf-8"))
    byte_budget = TOOL_BUDGETS[name]
    assert byte_count <= byte_budget, (name, byte_count, byte_budget)


@pytest.mark.asyncio
@pytest.mark.parametrize("name", TOOL_BUDGETS)
async def test_tool_inventory_preserves_complete_schema(name: str) -> None:
    """Size optimizations must not discard nullable unions, refs or constraints."""
    tool = await mcp.get_tool(name)
    assert tool is not None
    original = deepcopy(tool.parameters)
    entry = _create_search_result_serializer(MCP_TOOL_SEARCH_CONFIG)([tool])[0]
    schema = entry["inputSchema"]
    assert schema == _strip_titles(original)
    assert tool.parameters == original
    Draft202012Validator.check_schema(schema)


@pytest.mark.asyncio
async def test_inventory_budget_allows_incidental_description_edit() -> None:
    """A small wording change must not exhaust the chart preview byte budget."""
    tool = await mcp.get_tool("get_chart_preview")
    assert tool is not None
    entry = _create_search_result_serializer(MCP_TOOL_SEARCH_CONFIG)([tool])[0]
    entry["description"] += " A chart preview."
    text = json.dumps(entry, ensure_ascii=False, separators=(",", ":"))
    assert len(text.encode("utf-8")) <= TOOL_BUDGETS["get_chart_preview"]
