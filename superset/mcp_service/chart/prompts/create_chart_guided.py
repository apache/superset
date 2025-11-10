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

from superset.mcp_service.app import mcp
from superset.mcp_service.auth import mcp_auth_hook

logger = logging.getLogger(__name__)


@mcp.prompt("create_chart_guided")
@mcp_auth_hook
async def create_chart_guided_prompt(
    chart_type: str = "auto", business_goal: str = "exploration"
) -> str:
    """
    AI-powered chart creation guide following Anthropic's agent design principles.

    This prompt implements:
    - Transparency: Clear reasoning at each step
    - Proactive Intelligence: Suggests insights before being asked
    - Context Awareness: Maintains conversational flow
    - Business Focus: Translates data into actionable insights
    - Validation: Verifies choices before proceeding
    - Natural Interaction: Conversational, not configuration-driven

    Args:
        chart_type: Preferred chart type (auto, line, bar, pie, table, scatter, area)
        business_goal: Purpose (exploration, reporting, monitoring, presentation)
    """

    # Enhanced chart intelligence with business context
    chart_intelligence = {
        "line": {
            "description": "Time series visualization for trend analysis",
            "best_for": "Tracking performance over time, identifying patterns",
            "business_value": "Reveals growth trends, seasonality, and patterns",
            "data_requirements": "Temporal column + continuous metrics",
        },
        "bar": {
            "description": "Category comparison visualization",
            "best_for": "Ranking, comparisons, and performance by category",
            "business_value": "Identifies top performers, bottlenecks, and gaps",
            "data_requirements": "Categorical dimensions + aggregatable metrics",
        },
        "scatter": {
            "description": "Correlation and relationship analysis",
            "best_for": "Finding relationships, outlier detection, clustering",
            "business_value": "Uncovers hidden correlations and identifies anomalies",
            "data_requirements": "Two continuous variables, optional grouping",
        },
        "table": {
            "description": "Detailed data exploration and exact values",
            "best_for": "Detailed analysis, data validation, precise values",
            "business_value": "Provides granular insights and detailed reporting",
            "data_requirements": "Any combination of dimensions and metrics",
        },
        "area": {
            "description": "Volume and composition over time",
            "best_for": "Showing cumulative effects, stacked comparisons",
            "business_value": "Visualizes contribution and total volume trends",
            "data_requirements": "Temporal dimension + stackable metrics",
        },
        "auto": {
            "description": "AI-powered visualization recommendation",
            "best_for": "When you're not sure what chart type to use",
            "business_value": "Optimizes chart choice based on data characteristics",
            "data_requirements": "I'll analyze your data and recommend the best type",
        },
    }

    # Business context intelligence
    goal_intelligence = {
        "exploration": {
            "approach": "Interactive discovery and pattern finding",
            "features": "Filters, drill-downs, multiple perspectives",
            "outcome": "Uncover hidden insights and generate hypotheses",
        },
        "reporting": {
            "approach": "Clear, professional, and consistent presentation",
            "features": "Clean design, appropriate aggregation, clear labels",
            "outcome": "Reliable, repeatable business reporting",
        },
        "monitoring": {
            "approach": "Real-time tracking with clear thresholds",
            "features": "Alert conditions, trend indicators, key metrics",
            "outcome": "Proactive issue detection and performance tracking",
        },
        "presentation": {
            "approach": "Compelling visual storytelling",
            "features": "Engaging colors, clear messaging, audience-appropriate detail",
            "outcome": "Persuasive data-driven presentations for stakeholders",
        },
    }

    selected_chart = chart_intelligence.get(chart_type, chart_intelligence["auto"])
    selected_goal = goal_intelligence.get(
        business_goal, goal_intelligence["exploration"]
    )

    return f"""🎯 **AI-Powered Chart Creation Assistant**

I'm your intelligent data visualization partner! Let me help you create charts.

**Your Visualization Goal:**
📊 **Chart Focus**: {chart_type.title()} - {selected_chart["description"]}
🎯 **Business Purpose**: {business_goal.title()} - {selected_goal["approach"]}
💡 **Expected Value**: {selected_chart["business_value"]}

---

## 🚀 My Intelligent Approach

### **Phase 1: Data Intelligence** 📊
I'll automatically analyze your dataset to understand:
- **Data characteristics** (types, distributions, quality)
- **Business relationships** (correlations, hierarchies, trends)
- **Visualization opportunities** (what stories your data can tell)
- **Performance considerations** (size, complexity, aggregation needs)

*Why this matters: The right chart depends on your data's unique characteristics*

### **Phase 2: Smart Recommendations** 🧠
Based on your data analysis, I'll:
- **Recommend optimal chart types** with confidence scores and reasoning
- **Suggest meaningful metrics** that align with your business goal
- **Identify interesting patterns** you might want to highlight
- **Propose filters** to focus on what matters most

*Why this matters: I'll spot opportunities you might miss and save you time*

### **Phase 3: Intelligent Configuration** ⚙️
I'll configure your chart with:
- **Business-appropriate aggregations** (daily, weekly, monthly for time series)
- **Meaningful labels and formatting** (currency, percentages, readable names)
- **Performance optimizations** (appropriate limits, caching strategies)
- **Visual best practices** (colors, scales, legends that enhance understanding)

*Why this matters: Proper configuration makes charts both beautiful and actionable*

### **Phase 4: Validation & Refinement** 🎯
Before finalizing, I'll:
- **Verify the chart answers your business question**
- **Check data quality and completeness**
- **Suggest improvements** based on visualization best practices
- **Provide preview** so you can see exactly what you're getting

*Why this matters: Great charts require iteration and validation*

---

## 🎬 Let's Begin Your Data Story

I'm ready to be your proactive data exploration partner. Here's how we can start:

**Option 1: Quick Start** ⚡
Tell me: *"What business question are you trying to answer?"*
(e.g., "How are our sales trending?" or "Which products perform best?")

**Option 2: Dataset Exploration** 🔍
I can show you available datasets: `list_datasets`
Or explore a specific one: `get_dataset_info [dataset_id]`

**Option 3: Visual Inspiration** 🎨
Browse pre-built chart configurations: `superset://chart/configs` resource
Perfect for when you want to see examples of great charts!

**Option 4: Autonomous Discovery** 🤖
Just point me to a dataset and say *"Find something interesting"*
I'll explore autonomously and surface the most compelling insights!

---

💡 **Pro Tip**: Great charts combine business intuition with data analysis!

**What's your data challenge today?** 🚀"""
