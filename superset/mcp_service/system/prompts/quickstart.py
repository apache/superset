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

import logging

from flask import current_app
from superset_core.mcp import prompt

logger = logging.getLogger(__name__)


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

    This prompt helps users:
    1. Understand what data is available
    2. Create their first visualization
    3. Build a simple dashboard
    4. Learn key Superset concepts

    Args:
        user_type: Type of user (analyst, executive, developer)
        focus_area: Area of interest (sales, marketing, operations, general)
    """
    # Build personalized prompt based on user type
    intro_messages = {
        "analyst": "I see you're an analyst. Let's explore the data and build some "
        "detailed visualizations.",
        "executive": "Welcome! Let's create a high-level dashboard with key business "
        "metrics.",
        "developer": "Great to have a developer here! Let's explore both the UI and "
        "API capabilities.",
    }

    focus_examples = {
        "sales": "Since you're interested in sales, we'll focus on revenue, customer, "
        "and product metrics.",
        "marketing": "For marketing analytics, we'll look at campaigns, conversions, "
        "and customer acquisition.",
        "operations": "Let's explore operational efficiency, inventory, and process "
        "metrics.",
        "general": "We'll explore various datasets to find what's most relevant to "
        "you.",
    }

    intro = intro_messages.get(user_type, intro_messages["analyst"])
    focus = focus_examples.get(focus_area, focus_examples["general"])
    app_name = _get_app_name()

    return f"""Welcome to {app_name}! I'll guide you through creating your first
    dashboard.

{intro} {focus}

I'll help you through these steps:
1. **Explore Available Data** - See what datasets you can work with
2. **Understand Your Data** - Examine columns, metrics, and sample data
3. **Create Visualizations** - Build charts that tell a story
4. **Design a Dashboard** - Combine charts into an interactive dashboard
5. **Learn Advanced Features** - Discover filters, SQL Lab, and more

To get started, I'll use these tools:
- `get_instance_info` - Overview of your {app_name} instance
- `list_datasets` - Find available datasets
- `get_dataset_info` - Explore dataset details
- `generate_chart` - Create visualizations
- `generate_dashboard` - Build your dashboard

Let me begin by checking what's available in your {app_name} instance. I'll first get
an overview, then show you the datasets filtered by your interest in {focus_area}.

Would you like me to start by showing you what data you can work with?"""
