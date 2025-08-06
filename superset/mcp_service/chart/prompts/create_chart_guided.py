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

import logging

from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.mcp_app import mcp

logger = logging.getLogger(__name__)


@mcp.prompt("create_chart_guided")
@mcp_auth_hook
async def create_chart_guided_prompt(
    chart_type: str = "auto", business_goal: str = "exploration"
) -> str:
    """
    Guide users through creating effective charts based on their data and goals.

    This prompt helps users:
    1. Choose the right chart type for their data
    2. Configure appropriate metrics and dimensions
    3. Apply best practices for visualization design
    4. Optimize chart performance

    Args:
        chart_type: Preferred chart type (auto, line, bar, pie, table, etc.)
        business_goal: Purpose of the chart (exploration, reporting, monitoring,
        presentation)
    """

    chart_guidance = {
        "line": "Perfect for showing trends over time. Best for continuous data with "
        "temporal dimension.",
        "bar": "Great for comparing categories. Ideal for discrete data comparisons.",
        "pie": "Shows parts of a whole. Best limited to 5-7 categories maximum.",
        "table": "Detailed data view. Good for exact values and multiple metrics.",
        "scatter": "Shows relationships between two numerical variables.",
        "area": "Like line charts but emphasizes volume. Good for stacked metrics.",
        "auto": "I'll recommend the best chart type based on your data structure.",
    }

    goal_guidance = {
        "exploration": "We'll focus on interactive charts that help you discover "
        "patterns and insights.",
        "reporting": "We'll create clear, professional charts suitable for regular "
        "reporting.",
        "monitoring": "We'll build charts optimized for real-time monitoring with "
        "appropriate alerts.",
        "presentation": "We'll design visually appealing charts perfect for "
        "stakeholder presentations.",
    }

    chart_hint = chart_guidance.get(chart_type, chart_guidance["auto"])
    goal_hint = goal_guidance.get(business_goal, goal_guidance["exploration"])

    return f"""I'll help you create an effective chart for your data!

**Chart Type**: {chart_type} - {chart_hint}
**Business Goal**: {business_goal} - {goal_hint}

Here's my step-by-step approach:

1. 📊 **Analyze Your Data**
   - I'll examine the dataset structure using `get_dataset_info`
   - Identify available metrics and dimensions
   - Check data types and cardinality

2. 📈 **Choose Optimal Visualization**
   - Recommend the best chart type for your data
   - Consider your business goal: {business_goal}
   - Apply visualization best practices

3. ⚙️ **Configure Chart Settings**
   - Select appropriate metrics and grouping
   - Set up filters and time ranges
   - Configure formatting and colors

4. 🎯 **Optimize Performance**
   - Apply row limits and caching
   - Use appropriate aggregations
   - Ensure fast load times

Let's start! Which dataset would you like to visualize? I can:
- Show you available datasets with `list_datasets`
- Explore a specific dataset with `get_dataset_info [dataset_id]`
- Create the chart once we understand your data

What dataset are you interested in working with?"""
