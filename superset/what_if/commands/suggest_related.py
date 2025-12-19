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
"""What-If Analysis suggest related columns command using OpenRouter."""

from __future__ import annotations

import logging
from typing import Any

import httpx
from flask import current_app

from superset.commands.base import BaseCommand
from superset.utils import json
from superset.what_if.exceptions import OpenRouterAPIError, OpenRouterConfigError

logger = logging.getLogger(__name__)


class WhatIfSuggestRelatedCommand(BaseCommand):
    """Command to get AI suggestions for related column modifications."""

    def __init__(self, data: dict[str, Any]) -> None:
        self._data = data

    def run(self) -> dict[str, Any]:
        self.validate()
        return self._get_ai_suggestions()

    def validate(self) -> None:
        api_key = current_app.config.get("OPENROUTER_API_KEY")
        if not api_key:
            raise OpenRouterConfigError("OPENROUTER_API_KEY not configured")

        if not self._data.get("selected_column"):
            raise ValueError("selected_column is required")

        if not self._data.get("available_columns"):
            raise ValueError("available_columns list is required")

        if self._data.get("user_multiplier") is None:
            raise ValueError("user_multiplier is required")

    def _build_prompt(self) -> str:
        selected_column = self._data["selected_column"]
        user_multiplier = self._data["user_multiplier"]
        available_columns = self._data["available_columns"]
        dashboard_name = self._data.get("dashboard_name") or "Dashboard"

        pct_change = (user_multiplier - 1) * 100
        sign = "+" if pct_change >= 0 else ""

        # Build column list with descriptions
        columns_text = []
        for col in available_columns:
            # Skip the selected column - we don't want to suggest modifying it again
            if col["column_name"] == selected_column:
                continue

            col_desc = f"- **{col['column_name']}**"
            if col.get("verbose_name"):
                col_desc += f" ({col['verbose_name']})"
            if col.get("description"):
                col_desc += f": {col['description']}"
            columns_text.append(col_desc)

        if not columns_text:
            columns_text = ["No other columns available"]

        return f"""You are a business intelligence analyst helping with what-if scenario analysis.

## Context
A user is working on a "{dashboard_name}" dashboard and wants to simulate the cascading effects of changing a metric.

## User's Modification
The user is modifying **{selected_column}** by {sign}{pct_change:.1f}%

## Other Available Columns
These are the other numeric columns available in the dashboard:
{chr(10).join(columns_text)}

## Your Task
Analyze the relationships between these columns and suggest which OTHER columns should also be modified as a cascading effect of the user's change to {selected_column}.

Consider:
1. **Causal relationships**: If column A affects column B in real business scenarios
2. **Mathematical relationships**: Derived metrics, ratios, calculated fields
3. **Domain knowledge**: Industry-standard relationships (e.g., increasing customers often increases orders and revenue)

For each suggested column, provide:
- The appropriate multiplier (proportional, dampened, amplified, or inverse based on the relationship)
- A brief reasoning explaining the relationship (1 sentence)
- Your confidence level (high/medium/low)

Guidelines:
- Only suggest columns that have a clear logical relationship to {selected_column}
- Be conservative - don't suggest modifications without good reasoning
- The multiplier should be realistic (e.g., if {selected_column} increases 10%, a related column might increase 5-15%, not 100%)
- If no clear relationships exist, return an empty suggestions array

Respond in JSON format:
{{
  "suggested_modifications": [
    {{
      "column": "column_name",
      "multiplier": 1.08,
      "reasoning": "Brief explanation of the relationship",
      "confidence": "high"
    }}
  ],
  "explanation": "Overall summary of the analysis (1-2 sentences)"
}}"""

    def _get_ai_suggestions(self) -> dict[str, Any]:
        api_key = current_app.config.get("OPENROUTER_API_KEY")
        model = current_app.config.get("OPENROUTER_MODEL", "x-ai/grok-4.1-fast")
        api_base = current_app.config.get(
            "OPENROUTER_API_BASE", "https://openrouter.ai/api/v1"
        )
        timeout = current_app.config.get("OPENROUTER_TIMEOUT", 30)

        prompt = self._build_prompt()

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": current_app.config.get("WEBDRIVER_BASEURL", ""),
            "X-Title": "Apache Superset What-If Analysis",
        }

        payload = {
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are a business intelligence analyst specializing in "
                        "data relationships and cascading effects analysis. "
                        "Respond only with valid JSON."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.3,
            "max_tokens": 1000,
            "response_format": {"type": "json_object"},
        }

        try:
            with httpx.Client(timeout=timeout) as client:
                response = client.post(
                    f"{api_base}/chat/completions",
                    headers=headers,
                    json=payload,
                )
                response.raise_for_status()

                result = response.json()
                content = result["choices"][0]["message"]["content"]

                # Parse the JSON response
                parsed = json.loads(content)

                # Validate and normalize the response
                suggestions = parsed.get("suggested_modifications", [])
                validated_suggestions = []

                for suggestion in suggestions:
                    # Ensure required fields exist
                    if all(
                        k in suggestion
                        for k in ["column", "multiplier", "reasoning", "confidence"]
                    ):
                        # Normalize confidence to lowercase
                        confidence = suggestion["confidence"].lower()
                        if confidence not in ("high", "medium", "low"):
                            confidence = "medium"

                        validated_suggestions.append(
                            {
                                "column": suggestion["column"],
                                "multiplier": float(suggestion["multiplier"]),
                                "reasoning": suggestion["reasoning"],
                                "confidence": confidence,
                            }
                        )

                return {
                    "suggested_modifications": validated_suggestions,
                    "explanation": parsed.get("explanation"),
                }

        except httpx.HTTPStatusError as ex:
            logger.error("OpenRouter API error: %s", ex.response.status_code)
            raise OpenRouterAPIError(
                f"OpenRouter API error: {ex.response.status_code}"
            ) from ex
        except json.JSONDecodeError as ex:
            logger.error("Failed to parse AI response: %s", ex)
            raise OpenRouterAPIError("Failed to parse AI response") from ex
        except httpx.TimeoutException as ex:
            logger.error("OpenRouter API timeout")
            raise OpenRouterAPIError("AI service timed out") from ex
        except Exception as ex:
            logger.exception("Unexpected error calling OpenRouter")
            raise OpenRouterAPIError(f"Unexpected error: {ex!s}") from ex
