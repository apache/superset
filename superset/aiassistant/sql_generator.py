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
"""AI-powered SQL generation service using HuggingFace models."""

import logging
from typing import Any

from flask import current_app

logger = logging.getLogger(__name__)


class SQLGeneratorService:
    """Service for generating SQL from natural language using AI models."""

    DEFAULT_MODEL = "Qwen/Qwen2.5-Coder-32B-Instruct"

    @staticmethod
    def get_api_token() -> str | None:
        """
        Get HuggingFace API token from Superset config.

        Returns:
            API token string or None if not configured
        """
        return current_app.config.get("HF_API_TOKEN") or current_app.config.get(
            "HF_TOKEN"
        )

    @staticmethod
    def generate_sql(user_query: str, schema_info: str) -> dict[str, Any]:
        """
        Generate SQL from natural language query.

        Args:
            user_query: Natural language question from the user
            schema_info: Schema information about the dataset

        Returns:
            Dictionary with 'sql' and optional 'error' keys
        """
        try:
            from huggingface_hub import InferenceClient
        except ImportError:
            logger.error("huggingface_hub package is not installed")
            return {
                "error": "AI SQL generation is not available. Missing huggingface_hub package."
            }

        api_token = SQLGeneratorService.get_api_token()

        if not api_token:
            logger.warning(
                "No HuggingFace API token configured. "
                "Set HF_API_TOKEN in superset_config.py"
            )
            return {
                "error": "AI SQL generation is not configured. Please set HF_API_TOKEN in superset_config.py"
            }

        try:
            # Initialize the inference client
            client = InferenceClient(token=api_token)

            # Construct the messages for chat completion
            messages = [
                {"role": "system", "content": schema_info},
                {"role": "user", "content": f"Convert this request into SQL: {user_query}"},
            ]

            logger.info(
                f"Generating SQL for query: {user_query[:100]}..."
            )  # Log first 100 chars

            # Call the model using chat completion
            response = client.chat_completion(
                messages=messages,
                model=SQLGeneratorService.DEFAULT_MODEL,
                max_tokens=500,
                temperature=0.1,  # Low temperature for deterministic output
            )

            # Extract the SQL query
            sql_query = response.choices[0].message.content.strip()

            # Clean up the response (remove markdown code blocks if present)
            if "```sql" in sql_query:
                sql_query = sql_query.split("```sql")[1].split("```")[0].strip()
            elif "```" in sql_query:
                sql_query = sql_query.split("```")[1].split("```")[0].strip()

            # Validate it's a SELECT query
            if not sql_query.upper().strip().startswith("SELECT"):
                logger.warning(f"Generated query is not a SELECT statement: {sql_query}")
                return {
                    "error": "Only SELECT queries are supported",
                    "sql": sql_query,
                }

            logger.info("Successfully generated SQL query")
            return {"sql": sql_query}

        except Exception as e:
            logger.exception("Error generating SQL with AI model")
            return {"error": f"Failed to generate SQL: {str(e)}"}
