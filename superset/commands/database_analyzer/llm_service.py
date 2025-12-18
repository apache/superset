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
LLM Service for Database Analyzer.

Provides AI-powered features for database schema analysis:
- Table and column description generation
- Join relationship inference
"""
from __future__ import annotations

import logging
from typing import Any

from superset.llm.base import BaseLLMClient, LLMConfig
from superset.utils import json

logger = logging.getLogger(__name__)


class LLMService(BaseLLMClient):
    """
    LLM service for database analysis tasks.

    Extends BaseLLMClient with domain-specific methods for:
    - Generating table/column descriptions from schema and sample data
    - Inferring join relationships between tables
    - Validating analysis confidence

    Uses the "database_analyzer" feature configuration, which defaults to
    a large-context model (google/gemini-2.0-flash-001) optimized for
    processing large database schemas.
    """

    # Feature name for automatic configuration
    feature_name = "database_analyzer"

    def __init__(self, config: LLMConfig | None = None) -> None:
        super().__init__(config)

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

        response = self.chat_json(
            prompt=prompt,
            system_prompt=(
                "You are a database documentation expert. Generate brief but "
                "informative descriptions for database tables and columns."
            ),
        )

        if not response.success or not response.json_content:
            logger.error(
                "Error calling LLM for table descriptions: %s",
                response.error or "No content",
            )
            return {"table_description": None, "column_descriptions": {}}

        return {
            "table_description": response.json_content.get("table_description"),
            "column_descriptions": response.json_content.get(
                "column_descriptions", {}
            ),
        }

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

        prompt = self._build_join_inference_prompt(schema_context, existing_foreign_keys)

        response = self.chat_json(
            prompt=prompt,
            system_prompt=(
                "You are a database architect expert. Analyze database schemas "
                "to identify potential join relationships between tables."
            ),
        )

        if not response.success or not response.json_content:
            logger.error(
                "Error calling LLM for join inference: %s",
                response.error or "No content",
            )
            return []

        return self._parse_join_inference_response(response.json_content)

    def _build_table_description_prompt(
        self,
        table_name: str,
        table_comment: str | None,
        columns: list[dict[str, Any]],
        sample_data: list[dict[str, Any]],
    ) -> str:
        """Build prompt for generating table descriptions."""
        prompt = f"""Analyze this database table and generate descriptions.

Table Name: {table_name}
Existing Comment: {table_comment or 'None'}

Columns:
"""
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
            prompt += f"\nSample Data (3 rows):\n{json.dumps(sample_data[:3], indent=2)}\n"

        prompt += """
Based on the table name, column names, types, and sample data, provide:
1. A brief description of what this table represents (2-3 sentences)
2. Brief descriptions for each column explaining its purpose

Return as JSON:
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
        """Build prompt for inferring joins."""
        prompt = """Analyze this database schema and identify potential join relationships.

Schema Information:
"""
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

Return ONLY joins not already covered by existing foreign keys.

Return as JSON array:
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
  }
]
"""
        return prompt

    def _parse_join_inference_response(
        self, joins: dict[str, Any] | list[Any]
    ) -> list[dict[str, Any]]:
        """Parse and validate the join inference response."""
        if not isinstance(joins, list):
            logger.error("LLM response is not a list")
            return []

        valid_joins = []
        for i, join in enumerate(joins):
            logger.debug(
                "Raw join %d: join_type=%s, cardinality=%s",
                i,
                join.get("join_type"),
                join.get("cardinality"),
            )
            if self._validate_join(join):
                logger.debug(
                    "Validated join %d: join_type=%s, cardinality=%s",
                    i,
                    join.get("join_type"),
                    join.get("cardinality"),
                )
                valid_joins.append(join)
            else:
                logger.warning("Join %d failed validation", i)

        return valid_joins

    def _validate_join(self, join: dict[str, Any]) -> bool:
        """Validate a join object has required fields."""
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

        # Normalize join_type to lowercase
        if "join_type" in join:
            join["join_type"] = str(join["join_type"]).lower()

        # Normalize cardinality to use enum values
        if "cardinality" in join:
            cardinality_map = {
                "ONE_TO_ONE": "1:1",
                "1:1": "1:1",
                "ONE_TO_MANY": "1:N",
                "1:N": "1:N",
                "MANY_TO_ONE": "N:1",
                "N:1": "N:1",
                "MANY_TO_MANY": "N:M",
                "N:M": "N:M",
            }
            raw_cardinality = str(join["cardinality"]).upper()
            join["cardinality"] = cardinality_map.get(raw_cardinality, "N:1")

        # Set defaults for optional fields
        join.setdefault("join_type", "inner")
        join.setdefault("cardinality", "N:1")
        join.setdefault("confidence_score", 0.5)
        join.setdefault("suggested_by", "ai_inference")

        return True

    def validate_analysis_confidence(
        self,
        schema_name: str,
        tables: list[dict[str, Any]],
        joins: list[dict[str, Any]],
        ai_descriptions: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Validate the confidence of the analysis using another LLM.

        :param schema_name: Name of the schema analyzed
        :param tables: List of analyzed tables with metadata
        :param joins: List of inferred joins
        :param ai_descriptions: AI-generated descriptions
        :return: Dict with confidence scores and recommendations
        """
        if not self.is_available():
            return {
                "overall_confidence": 0.5,
                "confidence_breakdown": {},
                "recommendations": [],
                "validation_notes": "LLM validation not available",
            }

        prompt = self._build_confidence_validation_prompt(
            schema_name, tables, joins, ai_descriptions
        )

        response = self.chat_json(
            prompt=prompt,
            system_prompt=(
                "You are a database analysis quality auditor. Review database "
                "schema analyses and provide confidence scores."
            ),
        )

        if not response.success or not response.json_content:
            logger.error(
                "Error calling LLM for confidence validation: %s",
                response.error or "No content",
            )
            return {
                "overall_confidence": 0.5,
                "confidence_breakdown": {},
                "recommendations": [],
                "validation_notes": f"Validation failed: {response.error or 'Unknown error'}",
            }

        return self._parse_confidence_validation_response(response.json_content)

    def _build_confidence_validation_prompt(
        self,
        schema_name: str,
        tables: list[dict[str, Any]],
        joins: list[dict[str, Any]],
        ai_descriptions: dict[str, Any],
    ) -> str:
        """Build prompt for validating analysis confidence"""
        prompt = (
            "You are a database analysis quality auditor. Review the following "
            "database schema analysis and provide confidence scores.\n\n"
            f"Schema: {schema_name}\n"
            f"Number of tables: {len(tables)}\n"
            f"Number of inferred joins: {len(joins)}\n\n"
            "Analysis Summary:\n"
        )

        # Add table information
        prompt += "\nTables analyzed:\n"
        for table in tables[:10]:  # Limit to first 10 tables for context
            prompt += f"- {table.get('name', 'Unknown')}: "
            prompt += f"{table.get('columns_count', 0)} columns, "
            prompt += f"{table.get('row_count', 'unknown')} rows\n"
            if table.get("ai_description"):
                prompt += f"  Description: {table['ai_description'][:100]}...\n"

        # Add join information
        if joins:
            prompt += f"\nInferred joins ({len(joins)} total):\n"
            for join in joins[:5]:  # Show first 5 joins
                prompt += (
                    f"- {join.get('source_table')}.{join.get('source_columns')} -> "
                )
                prompt += f"{join.get('target_table')}.{join.get('target_columns')}\n"
                prompt += f"  Type: {join.get('join_type', 'unknown')}, "
                prompt += f"Cardinality: {join.get('cardinality', 'unknown')}, "
                prompt += f"Confidence: {join.get('confidence_score', 0)}\n"

        prompt += """
Please evaluate the quality and completeness of this analysis and provide:

1. overall_confidence: A score from 0.0 to 1.0 indicating overall confidence
2. confidence_breakdown: Individual confidence scores for different aspects:
   - table_descriptions: How accurate/complete are the table descriptions
   - column_descriptions: How accurate/complete are the column descriptions
   - join_inference: How accurate are the inferred joins
   - schema_coverage: How complete is the schema analysis
3. recommendations: List of specific recommendations to improve the analysis
4. potential_issues: Any red flags or concerns noticed
5. validation_notes: Additional context about the validation

Consider factors like:
- Consistency of descriptions
- Plausibility of inferred relationships
- Completeness of metadata
- Semantic accuracy

Return the response as JSON:
{
  "overall_confidence": 0.75,
  "confidence_breakdown": {
    "table_descriptions": 0.8,
    "column_descriptions": 0.7,
    "join_inference": 0.65,
    "schema_coverage": 0.9
  },
  "recommendations": [
    "Review join between X and Y - seems unlikely",
    "Table Z description needs more detail"
  ],
  "potential_issues": [
    "Missing relationships between related tables",
    "Some descriptions are too generic"
  ],
  "validation_notes": "Analysis appears mostly complete with minor gaps"
}
"""
        return prompt

    def _parse_confidence_validation_response(
        self, result: dict[str, Any]
    ) -> dict[str, Any]:
        """Parse the LLM response for confidence validation"""
        try:
            # Ensure all required fields exist with defaults
            return {
                "overall_confidence": float(result.get("overall_confidence", 0.5)),
                "confidence_breakdown": result.get("confidence_breakdown", {}),
                "recommendations": result.get("recommendations", []),
                "potential_issues": result.get("potential_issues", []),
                "validation_notes": result.get("validation_notes", ""),
            }
        except (ValueError, TypeError) as e:
            logger.error("Failed to parse confidence validation response: %s", str(e))
            return {
                "overall_confidence": 0.5,
                "confidence_breakdown": {},
                "recommendations": [],
                "potential_issues": [],
                "validation_notes": "Failed to parse validation response",
            }
