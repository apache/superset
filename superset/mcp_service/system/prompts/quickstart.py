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

"""
System prompts for general guidance
"""

from flask import current_app
from superset_core.mcp import prompt


def _get_app_name() -> str:
    """Get the application name from Flask config."""
    try:
        return current_app.config.get("APP_NAME", "Superset")
    except RuntimeError:
        # Outside of Flask application context
        return "Superset"


@prompt("quickstart")
async def quickstart_prompt(
    user_type: str = "analyst", focus_area: str = "general"
) -> str:
    """
    Guide new users through their first experience with the platform.

    Args:
        user_type: Type of user (analyst, executive, developer)
        focus_area: Area of interest (sales, marketing, operations, general)
    """
    app_name = _get_app_name()

    # Workflow varies by user type
    workflows = {
        "analyst": f"""**Workflow for Analysts:**

1. Call `get_instance_info` to see what's available in this {app_name} instance
2. Call `list_datasets` to find datasets relevant to {focus_area}
3. Call `get_dataset_info(id)` to examine columns and metrics
4. Call `generate_explore_link` to create interactive chart previews
5. Iterate on chart configuration until the visualization answers your question
6. Call `generate_chart(save_chart=True)` to save charts you want to keep
7. Call `generate_dashboard` with your saved chart IDs to build a dashboard""",
        "executive": f"""**Workflow for Executives:**

1. Call `get_instance_info` to see available dashboards and charts
2. Call `list_dashboards` to find existing dashboards relevant to {focus_area}
3. Call `get_dashboard_info(id)` to view dashboard details and chart list
4. To create a new KPI dashboard:
   a. Call `list_datasets` to find data sources
   b. Create charts with `generate_chart` (line/bar/table)
   c. Call `generate_dashboard` with chart IDs""",
        "developer": """**Workflow for Developers:**

1. Call `get_instance_info` to understand the instance
2. Call `get_schema(model_type)` to discover columns and filters
3. Use `execute_sql(database_id, sql)` to run queries
4. Use `open_sql_lab_with_context` for SQL Lab URLs
5. Use `list_datasets`/`list_charts`/`list_dashboards` with filters
6. Use `generate_explore_link` for chart previews without saving""",
    }

    selected_workflow = workflows.get(user_type, workflows["analyst"])

    return f"""**{app_name} Quickstart Guide**

{selected_workflow}

**Available Tools Summary:**
- `get_instance_info` - Instance overview (databases, dataset count, chart count)
- `list_datasets` / `get_dataset_info` - Find and examine data sources
- `list_charts` / `get_chart_info` - Browse existing charts
- `list_dashboards` / `get_dashboard_info` - Browse existing dashboards
- `generate_explore_link` - Create interactive chart preview (no save)
- `generate_chart` - Create and save a chart permanently
- `generate_dashboard` - Create a dashboard from chart IDs
- `execute_sql` - Run SQL queries against a database
- `get_schema` - Discover filterable/sortable columns for list tools

Start by calling `get_instance_info` to see what data is available."""
