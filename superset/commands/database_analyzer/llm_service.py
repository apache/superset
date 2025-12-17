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
from __future__ import annotations

import logging
from typing import Any

from flask import current_app

from superset.utils import json

logger = logging.getLogger(__name__)


class LLMService:
    """Service for LLM integration to generate descriptions and infer joins"""

    def __init__(self) -> None:
        import os
        # Try environment variables first, then fall back to config
        self.api_key = os.environ.get("SUPERSET_LLM_API_KEY") or current_app.config.get("LLM_API_KEY")
        self.model = os.environ.get("SUPERSET_LLM_MODEL") or current_app.config.get("LLM_MODEL", "gpt-4o")
        self.temperature = float(os.environ.get("SUPERSET_LLM_TEMPERATURE", current_app.config.get("LLM_TEMPERATURE", 0.3)))
        self.max_tokens = int(os.environ.get("SUPERSET_LLM_MAX_TOKENS", current_app.config.get("LLM_MAX_TOKENS", 4096)))
        self.base_url = os.environ.get("SUPERSET_LLM_BASE_URL") or current_app.config.get(
            "LLM_BASE_URL", "https://api.openai.com/v1"
        )

    def is_available(self) -> bool:
        """Check if LLM service is configured and available"""
        return bool(self.api_key)

    def generate_table_descriptions(
        self,
        table_name: str,
        table_comment: str | None,
        columns: list[dict[str, Any]],
        sample_data: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """
        Generate AI descriptions for a table and its columns.

        :param table_name: Name of the table
        :param table_comment: Existing table comment
        :param columns: List of column information
        :param sample_data: Sample rows from the table
        :return: Dict with table_description and column_descriptions
        """
        if not self.is_available():
            return {"table_description": None, "column_descriptions": {}}

        prompt = self._build_table_description_prompt(
            table_name, table_comment, columns, sample_data
        )

        try:
            response = self._call_llm(prompt)
            return self._parse_table_description_response(response)
        except Exception as e:
            logger.error("Error calling LLM for table descriptions: %s", str(e))
            return {"table_description": None, "column_descriptions": {}}

    def infer_joins(
        self,
        schema_context: list[dict[str, Any]],
        existing_foreign_keys: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """
        Infer potential joins between tables using AI.

        :param schema_context: List of tables with their columns and descriptions
        :param existing_foreign_keys: Already known foreign key relationships
        :return: List of inferred joins
        """
        if not self.is_available():
            return []

        prompt = self._build_join_inference_prompt(
            schema_context, existing_foreign_keys
        )

        try:
            response = self._call_llm(prompt)
            return self._parse_join_inference_response(response)
        except Exception as e:
            logger.error("Error calling LLM for join inference: %s", str(e))
            return []

    def _build_table_description_prompt(
        self,
        table_name: str,
        table_comment: str | None,
        columns: list[dict[str, Any]],
        sample_data: list[dict[str, Any]],
    ) -> str:
        """Build prompt for generating table descriptions"""
        prompt = (
            "You are a database documentation expert. Generate brief but "
            "informative descriptions for the following database table "
            f"and its columns.\n\nTable Name: {table_name}\n"
            f"Existing Comment: {table_comment or 'None'}\n\n"
            "Columns:\n"
        )
        for col in columns:
            prompt += f"- {col['name']} ({col['type']})"
            if col.get("is_pk"):
                prompt += " [PRIMARY KEY]"
            if col.get("is_fk"):
                prompt += " [FOREIGN KEY]"
            if col.get("comment"):
                prompt += f" - {col['comment']}"
            prompt += "\n"

        if sample_data:
            prompt += (
                f"\nSample Data (3 rows):\n{json.dumps(sample_data[:3], indent=2)}\n"
            )

        prompt += """
Based on the table name, column names, types, and sample data, provide:
1. A brief description of what this table represents (2-3 sentences)
2. Brief descriptions for each column explaining its purpose

Return the response as JSON in this format:
{
  "table_description": "Description of the table",
  "column_descriptions": {
    "column_name": "Description of this column",
    ...
  }
}
"""
        return prompt

    def _build_join_inference_prompt(
        self,
        schema_context: list[dict[str, Any]],
        existing_foreign_keys: list[dict[str, Any]],
    ) -> str:
        """Build prompt for inferring joins"""
        prompt = (
            "You are a database architect expert. Analyze the following "
            "database schema and identify potential join relationships "
            "between tables.\n\nSchema Information:\n"
        )
        for table in schema_context:
            prompt += f"\nTable: {table['name']}\n"
            if table.get("description"):
                prompt += f"Description: {table['description']}\n"
            prompt += "Columns:\n"
            for col in table["columns"]:
                prompt += f"  - {col['name']} ({col['type']})"
                if col.get("is_pk"):
                    prompt += " [PK]"
                if col.get("is_fk"):
                    prompt += " [FK]"
                if col.get("description"):
                    prompt += f" - {col['description']}"
                prompt += "\n"

        if existing_foreign_keys:
            prompt += "\nExisting Foreign Keys:\n"
            for fk in existing_foreign_keys:
                src = f"{fk['source_table']}.{fk['source_columns']}"
                tgt = f"{fk['target_table']}.{fk['target_columns']}"
                prompt += f"- {src} -> {tgt}\n"

        prompt += """
Identify potential join relationships based on:
1. Column name patterns (e.g., user_id, customer_id)
2. Data type compatibility
3. Semantic relationships
4. Common database patterns

For each join, provide:
- source_table and source_columns
- target_table and target_columns
- join_type (inner, left, right, full)
- cardinality (1:1, 1:N, N:1, N:M)
- semantic_context explaining the relationship
- confidence_score (0.0 to 1.0)

Return ONLY joins not already covered by existing foreign keys.
Focus on the most likely and useful joins.

Return the response as JSON array:
[
  {
    "source_table": "table1",
    "source_columns": ["col1"],
    "target_table": "table2",
    "target_columns": ["col2"],
    "join_type": "inner",
    "cardinality": "N:1",
    "semantic_context": "Explanation of the relationship",
    "confidence_score": 0.85,
    "suggested_by": "ai_inference"
  },
  ...
]
"""
        return prompt

    def _call_llm(self, prompt: str) -> str:
        """Call the LLM API with the given prompt"""
        import requests
        
        if not self.api_key:
            logger.warning("No API key configured for LLM service")
            return json.dumps({})
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        
        # For OpenRouter, we might need additional headers
        if "openrouter" in self.base_url.lower():
            headers["HTTP-Referer"] = "http://localhost:8088"  # Optional but recommended
            headers["X-Title"] = "Superset Database Analyzer"  # Optional
        
        data = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": "You are a database expert helping to document and understand database schemas. Respond only with valid JSON as requested."
                },
                {
                    "role": "user", 
                    "content": prompt
                }
            ],
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=data,
                timeout=60
            )
            
            if response.status_code != 200:
                logger.error(f"LLM API error: {response.status_code} - {response.text}")
                return json.dumps({})
            
            result = response.json()
            content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            
            # Try to extract JSON from the response
            if content:
                # Clean up the response - sometimes LLMs add markdown formatting
                content = content.strip()
                if content.startswith("```json"):
                    content = content[7:]
                if content.startswith("```"):
                    content = content[3:]
                if content.endswith("```"):
                    content = content[:-3]
                content = content.strip()
            
            return content
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Error calling LLM API: {e}")
            return json.dumps({})
        except Exception as e:
            logger.error(f"Unexpected error in LLM call: {e}")
            return json.dumps({})

    def _parse_table_description_response(self, response: str) -> dict[str, Any]:
        """Parse the LLM response for table descriptions"""
        try:
            result = json.loads(response)
            return {
                "table_description": result.get("table_description"),
                "column_descriptions": result.get("column_descriptions", {}),
            }
        except json.JSONDecodeError:
            logger.error("Failed to parse LLM response as JSON")
            return {"table_description": None, "column_descriptions": {}}

    def _parse_join_inference_response(self, response: str) -> list[dict[str, Any]]:
        """Parse the LLM response for join inference"""
        try:
            joins = json.loads(response)
            if not isinstance(joins, list):
                logger.error("LLM response is not a list")
                return []

            # Validate and clean up each join
            valid_joins = []
            for join in joins:
                if self._validate_join(join):
                    valid_joins.append(join)

            return valid_joins
        except json.JSONDecodeError:
            logger.error("Failed to parse LLM response as JSON")
            return []

    def _validate_join(self, join: dict[str, Any]) -> bool:
        """Validate a join object has required fields"""
        required_fields = [
            "source_table",
            "source_columns",
            "target_table",
            "target_columns",
        ]

        for field in required_fields:
            if field not in join:
                logger.warning("Join missing required field: %s", field)
                return False

        # Ensure columns are lists
        if not isinstance(join["source_columns"], list):
            join["source_columns"] = [join["source_columns"]]
        if not isinstance(join["target_columns"], list):
            join["target_columns"] = [join["target_columns"]]

        # Set defaults for optional fields
        join.setdefault("join_type", "inner")
        join.setdefault("cardinality", "N:1")
        join.setdefault("confidence_score", 0.5)
        join.setdefault("suggested_by", "ai_inference")

        return True
