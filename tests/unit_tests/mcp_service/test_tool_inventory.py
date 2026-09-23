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
import tiktoken
from jsonschema import Draft202012Validator

from superset.mcp_service.app import mcp
from superset.mcp_service.mcp_config import MCP_TOOL_SEARCH_CONFIG
from superset.mcp_service.server import _create_search_result_serializer, _strip_titles
from superset.utils import json

# Compact JSON including tool metadata, measured independently as UTF-8 bytes
# and tiktoken 0.14.0 / cl100k_base tokens (BPE estimates, not Claude counts).
# Small tools round up to 100 bytes / 25 tokens; large chart tools retain their
# explicit delivery budgets. Keep both limits: bytes are not a token estimate.
TOOL_BUDGETS = {
    "add_chart_to_existing_dashboard": (1_400, 325),
    "apply_dashboard_filters": (2_800, 625),
    "create_dataset": (1_700, 375),
    "create_theme": (1_000, 225),
    "create_virtual_dataset": (3_600, 800),
    "delete_chart": (1_000, 225),
    "delete_dashboard": (1_000, 225),
    "duplicate_dashboard": (1_800, 375),
    "execute_sql": (2_000, 450),
    "find_users": (1_400, 325),
    "generate_bug_report": (2_500, 575),
    "generate_chart": (50_000, 20_000),
    "generate_dashboard": (3_300, 725),
    "generate_explore_link": (50_000, 20_000),
    "get_annotation_layer_info": (900, 200),
    "get_chart_data": (2_800, 625),
    "get_chart_info": (3_500, 800),
    "get_chart_preview": (3_300, 750),
    "get_chart_sql": (2_000, 450),
    "get_chart_type_schema": (800, 150),
    "get_compatible_dimensions": (1_400, 300),
    "get_compatible_metrics": (1_400, 300),
    "get_dashboard_data": (2_300, 525),
    "get_dashboard_datasets": (1_000, 225),
    "get_dashboard_info": (3_000, 650),
    "get_dashboard_layout": (1_500, 325),
    "get_database_info": (1_300, 300),
    "get_dataset_info": (2_300, 550),
    "get_instance_info": (800, 175),
    "get_layer_annotation_info": (1_000, 225),
    "get_query_info": (1_000, 225),
    "get_report_info": (1_300, 275),
    "get_rls_filter_info": (900, 225),
    "get_role_info": (800, 200),
    "get_saved_query_info": (1_100, 250),
    "get_schema": (1_000, 225),
    "get_table": (3_800, 900),
    "get_tag_info": (900, 225),
    "get_task_info": (1_000, 225),
    "get_theme_info": (900, 200),
    "get_user_info": (900, 225),
    "health_check": (600, 150),
    "list_annotation_layers": (2_600, 575),
    "list_charts": (5_000, 1_125),
    "list_dashboards": (4_500, 1_000),
    "list_databases": (3_400, 775),
    "list_datasets": (4_500, 1_000),
    "list_layer_annotations": (2_800, 650),
    "list_metrics": (1_800, 375),
    "list_queries": (2_900, 650),
    "list_reports": (3_800, 850),
    "list_rls_filters": (2_500, 600),
    "list_roles": (2_600, 625),
    "list_saved_queries": (2_900, 675),
    "list_tags": (3_000, 725),
    "list_tasks": (2_600, 600),
    "list_themes": (2_900, 675),
    "list_users": (2_800, 650),
    "manage_dashboard_certification": (1_800, 400),
    "manage_dashboard_owners": (2_100, 450),
    "manage_dashboard_roles": (1_800, 400),
    "manage_native_filters": (6_600, 1_450),
    "open_sql_lab_with_context": (1_700, 375),
    "query_dataset": (3_600, 850),
    "remove_chart_from_dashboard": (1_200, 250),
    "restore_chart": (1_000, 225),
    "restore_dashboard": (900, 200),
    "save_sql_query": (1_500, 350),
    "update_chart": (55_000, 20_000),
    "update_chart_preview": (55_000, 20_000),
    "update_dashboard": (4_000, 850),
    "update_dataset_metric": (3_000, 700),
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
    token_count = len(
        tiktoken.get_encoding("cl100k_base").encode(text, disallowed_special=())
    )
    byte_budget, token_budget = TOOL_BUDGETS[name]
    assert byte_count <= byte_budget, (name, byte_count, byte_budget)
    assert token_count <= token_budget, (name, token_count, token_budget)


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
