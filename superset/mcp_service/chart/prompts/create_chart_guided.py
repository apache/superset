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
Chart prompts for visualization guidance
"""

from superset_core.mcp import prompt


@prompt("create_chart_guided")
async def create_chart_guided_prompt(
    chart_type: str = "auto", business_goal: str = "exploration"
) -> str:
    """
    Guided chart creation with step-by-step workflow.

    Args:
        chart_type: Preferred chart type (auto, line, bar, table, scatter, area)
        business_goal: Purpose (exploration, reporting, monitoring, presentation)
    """

    chart_intelligence = {
        "line": {
            "description": "Time series trends",
            "data_requirements": "Temporal column + continuous metrics",
        },
        "bar": {
            "description": "Category comparison",
            "data_requirements": "Categorical dimensions + aggregatable metrics",
        },
        "scatter": {
            "description": "Correlation analysis",
            "data_requirements": "Two continuous variables, optional grouping",
        },
        "table": {
            "description": "Detailed data view",
            "data_requirements": "Any combination of dimensions and metrics",
        },
        "area": {
            "description": "Volume over time",
            "data_requirements": "Temporal dimension + stackable metrics",
        },
        "auto": {
            "description": "Recommend based on data",
            "data_requirements": "Any - will analyze columns to determine best type",
        },
    }

    goal_context = {
        "exploration": "interactive discovery with filters and drill-downs",
        "reporting": "clean, professional presentation with clear labels",
        "monitoring": "real-time tracking with key metrics highlighted",
        "presentation": "compelling visual storytelling for stakeholders",
    }

    selected_chart = chart_intelligence.get(chart_type, chart_intelligence["auto"])
    selected_goal = goal_context.get(business_goal, goal_context["exploration"])
    valid_kinds = ("line", "bar", "area", "scatter")
    kind = chart_type if chart_type in valid_kinds else "line"

    return f"""**Guided Chart Creation**

Chart type: {chart_type} - {selected_chart["description"]}
Data needs: {selected_chart["data_requirements"]}
Goal: {business_goal} - {selected_goal}

---

## Step-by-Step Workflow

Follow these steps in order:

### Step 1: Find a Dataset
Call `list_datasets` to see available datasets.

### Step 2: Examine Columns
Call `get_dataset_info(dataset_id)` to see columns, types, and metrics.

### Step 3: Choose Chart Configuration
Based on column types:
- Temporal x-axis + numeric y -> line or area chart
- Categorical x-axis + numeric y -> bar chart
- Two numeric columns -> scatter plot
- Any columns for detail -> table

### Step 4: Create the Chart
Use `generate_explore_link` for interactive preview (preferred), or
`generate_chart` with `save_chart=True` to save permanently.

Example XY chart config:
```json
{{
  "dataset_id": <id>,
  "config": {{
    "chart_type": "xy",
    "kind": "{kind}",
    "x": {{"name": "<column_name>"}},
    "y": [{{"name": "<column_name>", "aggregate": "SUM"}}],
    "time_grain": "P1D"
  }}
}}
```

Example table config:
```json
{{
  "dataset_id": <id>,
  "config": {{
    "chart_type": "table",
    "columns": [
      {{"name": "<dimension_column>"}},
      {{"name": "<metric_column>", "aggregate": "SUM", "label": "Total"}}
    ]
  }}
}}
```

### Step 5: Validate Results
- If you get a column validation error, call `get_dataset_info` to check
  the exact column names available
- If data is empty, check if filters are too restrictive
- If the chart type doesn't suit the data, try a different kind

## Available Aggregations
SUM, COUNT, AVG, MIN, MAX, COUNT_DISTINCT, STDDEV, VAR, MEDIAN

## Time Grain Options (for temporal x-axis)
PT1H (hourly), P1D (daily), P1W (weekly), P1M (monthly), P3M (quarterly), P1Y (yearly)

## Additional Options
- group_by: Add a dimension to split data into series
- filters: [{{"column": "col", "op": "=", "value": "x"}}]
- stacked: true (for bar/area charts)
- legend: {{"show": true, "position": "right"}}
- x_axis/y_axis: {{"title": "Label", "format": "$,.0f"}}"""
