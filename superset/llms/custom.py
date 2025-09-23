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

import json
import logging
import re
import requests
from typing import Any, Dict, List

from superset.daos.database import DatabaseDAO
from superset.llms.base_llm import BaseLlm
from superset.models.core import CustomLlmProvider

logger = logging.getLogger(__name__)


class CustomLlm(BaseLlm):
    llm_type = "Custom"
    cached_context_size = None

    def __init__(self, pk, dialect, context):
        super().__init__(pk, dialect, context)
        self._provider_config = None
        self._load_provider_config()

    def _load_provider_config(self):
        """Load custom provider configuration from database."""
        db = DatabaseDAO.find_by_id(self.pk, True)
        if not db:
            logger.error(f"Database {self.pk} not found.")
            return

        provider_name = db.llm_connection.provider
        if not provider_name.startswith("custom_"):
            logger.error(f"Invalid custom provider name: {provider_name}")
            return

        # Extract provider ID (remove 'custom_' prefix)
        try:
            provider_id = int(provider_name[7:])  # Remove 'custom_' prefix
        except ValueError:
            logger.error(f"Invalid custom provider ID in: {provider_name}")
            return

        # Load custom provider configuration from database
        from superset.extensions import db as superset_db
        custom_provider = superset_db.session.query(CustomLlmProvider).filter_by(
            id=provider_id, enabled=True
        ).first()

        if not custom_provider:
            logger.error(f"Custom provider with ID {provider_id} not found or disabled.")
            return

        self._provider_config = custom_provider
        logger.info(f"Loaded custom provider config for '{custom_provider.name}'")

    def _trim_markdown(self, text: str) -> str:
        """Remove markdown code blocks from SQL response."""
        try:
            sql_start = text.index("```")
            sql_start_len = text.index("\n", sql_start) + 1 if sql_start != -1 else 0
            sql_end = text.index("\n```")
            sql = text[sql_start + sql_start_len : sql_end]
        except ValueError:
            sql = text
        return sql

    def _extract_response_content(self, response_data: Dict[str, Any], path: str) -> str:
        """Extract content from API response using JSONPath-like syntax."""
        try:
            current = response_data

            # Simple JSONPath parser for basic paths like "choices[0].message.content"
            parts = re.split(r'[\.\[\]]', path)
            parts = [p for p in parts if p]  # Remove empty strings

            for part in parts:
                if part.isdigit():
                    current = current[int(part)]
                else:
                    current = current[part]

            return str(current)
        except (KeyError, IndexError, TypeError) as e:
            logger.error(f"Failed to extract content using path '{path}': {e}")
            return ""

    def _substitute_template_variables(self, template: Any, variables: Dict[str, Any]) -> Any:
        """Recursively substitute variables in template (string, dict, or list)."""
        if isinstance(template, str):
            # Replace {variable} placeholders
            for key, value in variables.items():
                if isinstance(value, (dict, list)):
                    # For complex objects, convert to JSON string
                    template = template.replace(f"{{{key}}}", json.dumps(value))
                else:
                    template = template.replace(f"{{{key}}}", str(value))
            return template
        elif isinstance(template, dict):
            return {k: self._substitute_template_variables(v, variables) for k, v in template.items()}
        elif isinstance(template, list):
            return [self._substitute_template_variables(item, variables) for item in template]
        else:
            return template

    @classmethod
    def get_system_instructions(cls, dialect) -> str:
        """Default system instructions for custom providers."""
        return f"""You are a {dialect} database expert. Given an input question, create a syntactically correct {dialect} query. You MUST only answer with the SQL query, nothing else. Unless the user specifies a specific number of results they wish to obtain, always limit your query to at most return {cls.max_results} results. You can order the results by relevant columns. You MUST check that the query doesn't contain syntax errors or incorrect table, views, column names or joins on wrong columns. Fix any error you might find before returning your answer. DO NOT make any DML statements (INSERT, UPDATE, DELETE, DROP etc.) to the database. To construct your database query you MUST ALWAYS use the database metadata information provided to you as a JSON file. Do NOT skip this step. This JSON file specifies all the database schemas, for each schema all its relations (which are tables, and views) and for each table its columns, indexes, and foreign key constraints. The unique indexes are very useful to understand what differentiates one record to another in the same relation. The foreign key constraints are very useful to find the correct columns to join. Do not include any markdown syntax in your response."""

    @staticmethod
    def get_models() -> Dict[str, Dict[str, Any]]:
        """Return empty dict - models are loaded dynamically from config."""
        return {}

    def get_provider_models(self) -> Dict[str, Dict[str, Any]]:
        """Get models for this specific custom provider."""
        if not self._provider_config:
            return {}

        try:
            models = json.loads(self._provider_config.models)
            return models
        except (json.JSONDecodeError, AttributeError):
            logger.error("Failed to parse models configuration for custom provider.")
            return {}

    def generate_sql(self, prompt: str, history: str, schemas: List[str] | None) -> str:
        """Generate SQL using custom LLM provider."""
        db = DatabaseDAO.find_by_id(self.pk, True)
        if not db:
            logger.error(f"Database {self.pk} not found.")
            return "-- Error: Database not found"

        if not db.llm_connection.enabled:
            logger.error(f"LLM is not enabled for database {self.pk}.")
            return "-- Error: LLM not enabled"

        if not self._provider_config:
            logger.error(f"Custom provider configuration not found for database {self.pk}.")
            return "-- Error: Custom provider configuration not found"

        llm_api_key = db.llm_connection.api_key
        if not llm_api_key:
            logger.error(f"API key not set for database {self.pk}.")
            return "-- Error: API key not set"

        llm_model = db.llm_connection.model
        if not llm_model:
            logger.error(f"Model not set for database {self.pk}.")
            return "-- Error: Model not set"

        # Build messages
        user_instructions = db.llm_context_options.instructions
        system_prompt = (
            user_instructions
            if user_instructions
            else (self._provider_config.system_instructions or self.get_system_instructions(self.dialect))
        )

        context_json = json.dumps([
            schema for schema in self.context
            if not schemas or schema["schema_name"] in schemas
        ])

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Database metadata:\n{context_json}"},
        ]
        if history:
            messages.append({"role": "user", "content": history})
        messages.append({"role": "user", "content": prompt})

        # Prepare request data using template
        try:
            request_template = json.loads(self._provider_config.request_template)
        except json.JSONDecodeError:
            logger.error("Invalid request_template JSON in custom provider configuration.")
            return "-- Error: Invalid request template configuration"

        template_variables = {
            "model": llm_model,
            "messages": messages,
            "api_key": llm_api_key,
        }

        request_data = self._substitute_template_variables(request_template, template_variables)

        # Prepare headers
        headers = {"Content-Type": "application/json"}
        if self._provider_config.headers:
            try:
                custom_headers = json.loads(self._provider_config.headers)
                headers.update(self._substitute_template_variables(custom_headers, template_variables))
            except json.JSONDecodeError:
                logger.error("Invalid headers JSON in custom provider configuration.")

        # Make API request
        timeout = self._provider_config.timeout or 30
        try:
            response = requests.post(
                self._provider_config.endpoint_url,
                json=request_data,
                headers=headers,
                timeout=timeout
            )
            response.raise_for_status()
            response_data = response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Custom LLM API request failed: {e}")
            return f"-- Failed to generate SQL: {str(e)}"
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON response from custom LLM: {e}")
            return "-- Failed to generate SQL: Invalid JSON response"

        # Extract SQL from response
        raw_content = self._extract_response_content(response_data, self._provider_config.response_path)

        if not raw_content:
            logger.error("No content extracted from custom LLM response.")
            return "-- Failed to generate SQL: No content in response"

        sql = self._trim_markdown(raw_content)
        if not sql:
            return "-- Unable to find valid SQL in the LLM response"

        logger.info(f"Generated SQL: {sql}")
        return sql

    def get_context_size(self) -> int:
        """Estimate context size for custom provider."""
        if self.cached_context_size is not None:
            return self.cached_context_size

        # Simple token estimation (roughly 4 chars per token)
        context_text = json.dumps(self.context)
        estimated_tokens = len(context_text) // 4

        self.cached_context_size = estimated_tokens
        logger.info(f"Estimated context size: {estimated_tokens}")
        return self.cached_context_size