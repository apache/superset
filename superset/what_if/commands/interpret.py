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
"""What-If Analysis interpretation command using OpenRouter."""

from __future__ import annotations

import logging
from typing import Any

import httpx
from flask import current_app

from superset.commands.base import BaseCommand
from superset.utils import json
from superset.what_if.exceptions import OpenRouterAPIError, OpenRouterConfigError

logger = logging.getLogger(__name__)


class WhatIfInterpretCommand(BaseCommand):
    """Command to get AI interpretation of what-if analysis results."""

    def __init__(self, data: dict[str, Any]) -> None:
        self._data = data

    def run(self) -> dict[str, Any]:
        self.validate()
        return self._get_ai_interpretation()

    def validate(self) -> None:
        api_key = current_app.config.get("OPENROUTER_API_KEY")
        if not api_key:
            raise OpenRouterConfigError("OPENROUTER_API_KEY not configured")

        if not self._data.get("modifications"):
            raise ValueError("At least one modification is required")

        if not self._data.get("charts"):
            raise ValueError("At least one chart comparison is required")

    def _format_filter(self, flt: dict[str, Any]) -> str:
        """Format a single filter for display in the prompt."""
        col = flt.get("col", "")
        op = flt.get("op", "")
        val = flt.get("val", "")

        # Format the value based on type
        if isinstance(val, list):
            val_str = ", ".join(str(v) for v in val)
            return f"{col} {op} [{val_str}]"
        if isinstance(val, str) and op == "TEMPORAL_RANGE":
            return f"{col} in time range '{val}'"
        return f"{col} {op} {val}"

    def _build_prompt(self) -> str:
        modifications = self._data["modifications"]
        charts = self._data["charts"]
        dashboard_name = self._data.get("dashboard_name") or "Dashboard"

        # Build modification description
        mod_descriptions = []
        for mod in modifications:
            pct_change = (mod["multiplier"] - 1) * 100
            sign = "+" if pct_change >= 0 else ""
            base_desc = f"- {mod['column']}: {sign}{pct_change:.1f}%"

            # Add filter conditions if present
            filters = mod.get("filters") or []
            if filters:
                filter_strs = [self._format_filter(f) for f in filters]
                filter_desc = " AND ".join(filter_strs)
                base_desc += f" (only where {filter_desc})"

            mod_descriptions.append(base_desc)

        modifications_text = "\n".join(mod_descriptions)

        # Build chart impact summary
        chart_summaries = []
        for chart in charts:
            metrics_text = []
            for metric in chart["metrics"]:
                sign = "+" if metric["percentage_change"] >= 0 else ""
                metrics_text.append(
                    f"  - {metric['metric_name']}: "
                    f"{metric['original_value']:,.2f} -> {metric['modified_value']:,.2f} "
                    f"({sign}{metric['percentage_change']:.1f}%)"
                )
            chart_summaries.append(
                f"**{chart['chart_name']}** ({chart['chart_type']}):\n"
                + "\n".join(metrics_text)
            )

        charts_text = "\n\n".join(chart_summaries)

        return f"""You are a business intelligence analyst. A user is performing a what-if analysis on their "{dashboard_name}" dashboard.

## Scenario
The user modified the following column(s):
{modifications_text}

## Impact on Charts
{charts_text}

## Your Task
Analyze this what-if scenario and provide:

1. **Summary**: A 1-2 sentence executive summary of the overall impact.

2. **Key Observations**: 2-3 specific observations about how the changes affected different metrics.

3. **Business Implications**: What does this mean for the business? Consider:
   - Revenue/cost implications
   - Operational efficiency
   - Risk factors

4. **Recommendations**: 1-2 actionable recommendations based on this analysis.

Please be concise, specific, and focus on business value. Use the actual numbers from the data.

Respond in JSON format:
{{
  "summary": "...",
  "insights": [
    {{"title": "...", "description": "...", "type": "observation"}},
    {{"title": "...", "description": "...", "type": "implication"}},
    {{"title": "...", "description": "...", "type": "recommendation"}}
  ]
}}"""

    def _get_ai_interpretation(self) -> dict[str, Any]:
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
                        "You are a business intelligence analyst. "
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
                return {
                    "summary": parsed.get("summary", ""),
                    "insights": parsed.get("insights", []),
                    "raw_response": content if current_app.debug else None,
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
