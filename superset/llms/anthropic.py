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
from typing import List

import anthropic

from superset.daos.database import DatabaseDAO
from superset.llms.base_llm import BaseLlm

logger = logging.getLogger(__name__)


class AnthropicLlm(BaseLlm):
    llm_type = "Anthropic"
    cached_context_size = None

    def _trim_markdown(self, text: str) -> bool:
        # Check the body for SQL wrapped in markdown ```{language}\n...\n```
        try:
            sql_start = text.index("```")
            # Find the first newline after the start of the SQL block
            sql_start_len = text.index("\n", sql_start) + 1 if sql_start != -1 else 0
            sql_end = text.index("\n```")
            sql = text[sql_start + sql_start_len : sql_end]
        except ValueError:
            # There was no markdown, so assume for now the whole response is the SQL
            sql = text

        return sql

    @classmethod
    def get_system_instructions(cls, dialect) -> str:
        system_instructions = f"""You are a {dialect} database expert. Given an input question, create a syntactically correct {dialect} query. You MUST only answer with the SQL query, nothing else. Unless the user specifies a specific number of results they wish to obtain, always limit your query to at most return {cls.max_results} results. You can order the results by relevant columns. You MUST check that the query doesn't contain syntax errors or incorrect table, views, column names or joins on wrong columns. Fix any error you might find before returning your answer. DO NOT make any DML statements (INSERT, UPDATE, DELETE, DROP etc.) to the database. To construct your database query you MUST ALWAYS use the database metadata information provided to you as a JSON file. Do NOT skip this step. This JSON file specifies all the database schemas, for each schema all its relations (which are tables, and views) and for each table its columns, indexes, and foreign key constraints. The unique indexes are very useful to understand what differentiates one record to another in the same relation. The foreign key constraints are very useful to find the correct columns to join. Do not include any markdown syntax in your response."""
        return system_instructions

    @staticmethod
    def get_models():
        return {
            "claude-3-5-haiku-latest": {
                "name": "Claude Haiku 3.5",
                "input_token_limit": 200000,
            },
            "claude-sonnet-4-0": {
                "name": "Claude Sonnet 4",
                "input_token_limit": 200000,
            },
            "claude-3-7-sonnet-latest": {
                "name": "Claude Sonnet 3.7",
                "input_token_limit": 200000,
            },
            "claude-opus-4-0": {"name": "Claude Opus 4", "input_token_limit": 200000},
        }

    def generate_sql(self, prompt: str, history: str, schemas: List[str] | None) -> str:
        """
        Generate SQL from a user prompt using the Anthropic SDK.
        """
        db = DatabaseDAO.find_by_id(self.pk, True)
        if not db:
            logger.error(f"Database {self.pk} not found.")
            return

        if not db.llm_connection.enabled:
            logger.error(f"LLM is not enabled for database {self.pk}.")
            return

        if not db.llm_connection.provider == self.llm_type:
            logger.error(f"LLM provider is not {self.llm_type} for database {self.pk}.")
            return

        llm_api_key = db.llm_connection.api_key
        if not llm_api_key:
            logger.error(f"API key not set for database {self.pk}.")
            return

        llm_model = db.llm_connection.model
        if not llm_model:
            logger.error(f"Model not set for database {self.pk}.")
            return

        logger.info(f"Using model {llm_model} for database {self.pk}")

        user_instructions = db.llm_context_options.instructions
        client = anthropic.Anthropic(api_key=llm_api_key)

        # Compose system prompt and context
        system_prompt = (
            user_instructions
            if user_instructions
            else self.get_system_instructions(self.dialect)
        )
        context_json = json.dumps(
            [
                schema
                for schema in self.context
                if not schemas or schema["schema_name"] in schemas
            ]
        )

        message_parts = [system_prompt, "Database metadata:", context_json]
        if history:
            message_parts.append(history)
        message_parts.append(prompt)

        try:
            response = client.messages.create(
                model=llm_model,
                messages=[{"role": "user", "content": "\n".join(message_parts)}],
                max_tokens=8192,
            )
        except Exception as e:
            logger.error(f"Anthropic API error: {e}")
            return f"-- Failed to generate SQL: {str(e)}"

        if not response or not response.content:
            logger.error("No response from Anthropic API.")
            return "-- Failed to generate SQL: No response from Anthropic API."

        reply = "\n".join(
            [part.text for part in response.content if part.type == "text"]
        )

        sql = self._trim_markdown(reply)
        if not sql:
            return "-- Unable to find valid SQL in the LLM response"

        logger.info(f"Generated SQL: {sql}")
        return sql

    def get_context_size(self) -> int:
        """
        Count the number of tokens in the prompt using the Anthropic SDK.
        Cache the result in self.cached_size, which expires when self.cache_expiry changes.
        """
        db = DatabaseDAO.find_by_id(self.pk, True)
        if not db:
            logger.error(f"Database {self.pk} not found.")
            return

        if not db.llm_connection.provider == self.llm_type:
            logger.error(f"LLM provider is not {self.llm_type} for database {self.pk}.")
            return

        llm_api_key = db.llm_connection.api_key
        if not llm_api_key:
            logger.error(f"API key not set for database {self.pk}.")
            return

        llm_model = db.llm_connection.model
        if not llm_model:
            logger.error(f"Model not set for database {self.pk}.")
            return

        # If we have a cached size and a valid cache_expiry, return the cached size
        if self.cached_context_size is not None:
            logger.info(f"Using cached context size: {self.cached_context_size}")
            return self.cached_context_size
        else:
            # Invalidate any old cached size
            self.cached_context_size = None

        user_instructions = db.llm_context_options.instructions
        system_prompt = (
            user_instructions
            if user_instructions
            else self.get_system_instructions(self.dialect)
        )
        context_json = json.dumps([schema for schema in self.context])

        # Anthropic expects a list of messages, similar to OpenAI
        messages = [
            {
                "role": "user",
                "content": "\n".join(
                    [system_prompt, "Database metadata:", context_json]
                ),
            },
        ]

        try:
            client = anthropic.Anthropic(api_key=llm_api_key)
            # Use the count_tokens method from the Anthropic SDK
            response = client.messages.count_tokens(
                model=llm_model,
                messages=messages,
            )
            total_tokens = response.input_tokens
            logger.info(f"Calculated context size: {total_tokens}")
        except Exception as e:
            logger.error(f"Anthropic API error: {e}")
            return

        # Cache the size until cache_expiry changes or is reached
        self.cached_context_size = total_tokens
        return self.cached_context_size
